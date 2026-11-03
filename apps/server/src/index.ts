import { mkdir } from 'node:fs/promises';
import { AuthService } from './auth/auth-service';
import { LoginLimiter } from './auth/rate-limit';
import { SessionStore } from './auth/sessions';
import { EdgeBrowser } from './browser/edge-browser';
import { loadConfig, loadDotEnv } from './config';
import { ConnectionInfo } from './connection-info';
import { buildLanApp } from './http/lan-app';
import { buildSetupApp } from './http/setup-app';
import { buildTvApp } from './http/tv-app';
import { StateHub } from './hub/state-hub';
import { createLogger } from './log';
import { getLanAddresses } from './net/addresses';
import { SettingsService } from './settings/settings';
import { TlsManager } from './tls/tls-manager';
import { RemoteControl } from './input/remote-control';
import { createInputDriver } from './input/win32-input-driver';
import { WallpaperLibrary } from './wallpapers/library';
import { WallpaperManager } from './wallpapers/manager';

const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const ADDRESS_CHECK_INTERVAL_MS = 60_000;

async function main(): Promise<void> {
  loadDotEnv();
  const config = loadConfig();
  await mkdir(config.paths.data, { recursive: true });
  const log = createLogger(config);
  log.info({ dataDir: config.paths.data, env: config.env }, 'Démarrage de 11TV');

  process.on('unhandledRejection', (err) => {
    log.error({ err }, 'Promesse rejetée non gérée');
  });

  // --- Réglages et authentification ---------------------------------------------------
  const settings = await SettingsService.load(config.paths.settings, log);
  const sessions = await SessionStore.load(config.paths.sessions, SESSION_TTL_MS, log);
  const auth = new AuthService(
    settings,
    sessions,
    new LoginLimiter({ maxAttempts: 5, baseLockMs: 30_000, maxLockMs: 15 * 60_000 }),
    new LoginLimiter({ maxAttempts: 20, baseLockMs: 60_000, maxLockMs: 15 * 60_000 }),
    log,
  );
  await auth.init();

  // --- Réseau et certificats ----------------------------------------------------------
  const serverNames = (ips: string[]) => ({
    dns: ['localhost', config.hostname],
    ips: ['127.0.0.1', ...ips],
  });
  let lanIps = getLanAddresses();
  const tls = new TlsManager(config.paths.certs, log);
  const certificate = await tls.ensure(serverNames(lanIps));
  const connection = new ConnectionInfo(config);
  await connection.update(lanIps);
  log.info({ urls: connection.appUrls }, 'Adresses du téléphone');

  // --- Navigateur et hub --------------------------------------------------------------
  const homeUrl = `http://127.0.0.1:${String(config.ports.tv)}/`;
  const browser = new EdgeBrowser(
    {
      executable: config.edge.executable,
      profileDir: config.paths.edgeProfile,
      debugPort: config.edge.debugPort,
      kiosk: config.edge.kiosk,
      launch: config.edge.launch,
      startUrl: homeUrl,
    },
    log.child({ module: 'edge' }),
  );
  const wallpapers = new WallpaperLibrary(config.paths.wallpapers, log);
  const wallpaperManager = new WallpaperManager(wallpapers, settings, config.paths.thumbs, log);
  const remote = new RemoteControl(browser, createInputDriver(log.child({ module: 'input' })));
  const hub = new StateHub(
    {
      browser,
      remote,
      homeUrl,
      settings: {
        slideIntervalSec: () => settings.get().slideIntervalSec,
        setSlideInterval: async (seconds) => {
          await settings.update((s) => ({ ...s, slideIntervalSec: seconds }));
        },
      },
      wallpapers: {
        list: () => wallpapers.list(settings.get().wallpaperOrder),
        has: (id) => wallpaperManager.exists(id),
        remove: (id) => wallpaperManager.remove(id),
        reorder: (order) => wallpaperManager.reorder(order),
      },
      pairing: () => connection.pairing(auth.pairingPin, tls.caFingerprint),
    },
    log.child({ module: 'hub' }),
  );
  settings.on('change', () => {
    hub.broadcast();
  });
  auth.on('pairingChange', () => {
    hub.broadcast();
  });
  await wallpapers.init(() => {
    hub.broadcast();
  });

  // --- Serveurs HTTP ------------------------------------------------------------------
  const tvApp = await buildTvApp(config, log, hub);
  const lanApp = await buildLanApp({
    config,
    log,
    hub,
    auth,
    wallpapers: wallpaperManager,
    tls: { key: certificate.keyPem, cert: certificate.certPem },
  });
  const setupApp = buildSetupApp(log, {
    caCertPem: () => tls.caCertPem,
    caFingerprint: () => tls.caFingerprint,
    appUrls: () => connection.appUrls,
  });

  await tvApp.listen({ host: '127.0.0.1', port: config.ports.tv });
  await lanApp.listen({ host: '0.0.0.0', port: config.ports.https });
  await setupApp.listen({ host: '0.0.0.0', port: config.ports.setup });
  browser.start();

  // --- Changement d'adresse IP (pas d'IP fixe) ----------------------------------------
  const addressWatch = setInterval(() => {
    const next = getLanAddresses();
    if (next.join() === lanIps.join()) return;
    log.warn({ before: lanIps, after: next }, 'Adresse IP modifiée');
    lanIps = next;
    void (async () => {
      const renewed = await tls.ensure(serverNames(next));
      if (renewed.changed) {
        lanApp.server.setSecureContext({ key: renewed.keyPem, cert: renewed.certPem });
      }
      await connection.update(next);
      hub.broadcast();
    })().catch((err: unknown) => {
      log.error({ err }, 'Mise à jour après changement d’adresse impossible');
    });
  }, ADDRESS_CHECK_INTERVAL_MS);

  // --- Arrêt propre -------------------------------------------------------------------
  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    log.info({ signal }, 'Arrêt de 11TV');
    clearInterval(addressWatch);
    wallpapers.close();
    await browser.stop();
    await Promise.allSettled([tvApp.close(), lanApp.close(), setupApp.close()]);
    log.flush();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err: unknown) => {
  console.error('11TV n’a pas pu démarrer :', err);
  process.exit(1);
});
