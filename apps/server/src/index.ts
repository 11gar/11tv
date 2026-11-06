import { mkdir } from 'node:fs/promises';
import { AuthService } from './auth/auth-service';
import { LoginLimiter } from './auth/rate-limit';
import { SessionStore } from './auth/sessions';
import { EdgeBrowser } from './browser/edge-browser';
import { loadConfig, loadDotEnv } from './config';
import { ConnectionInfo } from './connection-info';
import { buildLanApp } from './http/lan-app';
import { Updater } from './update/updater';
import { loadCardModules } from './cards/registry';
import { PostItBoard } from './postits/board';
import { ModuleManager } from './modules/module-manager';
import { POSTITS_MODULE_ID } from '@11tv/shared';
import { buildSetupApp } from './http/setup-app';
import { buildTvApp } from './http/tv-app';
import { StateHub } from './hub/state-hub';
import { createLogger } from './log';
import { ArtworkProxy } from './music/artwork';
import { MusicHistory } from './music/history';
import { MusicService } from './music/music-service';
import { getLanAddresses } from './net/addresses';
import { SettingsService } from './settings/settings';
import { TlsManager } from './tls/tls-manager';
import { RemoteControl } from './input/remote-control';
import { createInputDriver } from './input/win32-input-driver';
import { WallpaperLibrary } from './wallpapers/library';
import { WallpaperManager } from './wallpapers/manager';

const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const ADDRESS_CHECK_INTERVAL_MS = 60_000;
const LOG_ROTATION_INTERVAL_MS = 60 * 60_000;

async function main(): Promise<void> {
  loadDotEnv();
  const config = loadConfig();
  await mkdir(config.paths.data, { recursive: true });
  const { log, rotate: rotateLogs } = await createLogger(config);
  log.info({ dataDir: config.paths.data, env: config.env }, 'Démarrage de 11TV');

  process.on('unhandledRejection', (err) => {
    log.error({ err }, 'Promesse rejetée non gérée');
  });
  // État inconnu après une exception non rattrapée : on s'arrête, le lanceur redémarre le
  // serveur (scripts/run-11tv.ps1). Edge, détaché, reste ouvert.
  process.on('uncaughtException', (err) => {
    log.fatal({ err }, 'Exception non gérée, arrêt du serveur');
    log.flush();
    process.exit(1);
  });
  const logRotation = setInterval(() => {
    rotateLogs().catch((err: unknown) => {
      log.warn({ err }, 'Rotation des journaux impossible');
    });
  }, LOG_ROTATION_INTERVAL_MS);

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
  const artwork = new ArtworkProxy();
  const music = new MusicService(
    browser,
    await MusicHistory.load(config.paths.musicHistory, log),
    artwork,
    log.child({ module: 'musique' }),
  );
  // Modules, allumés ou éteints depuis le téléphone : les post-it, et un module par outil
  // externe (Me'Mories…), qui ne fonctionne que s'il est configuré.
  const cardModules = await loadCardModules(config.paths.modules, log);
  const postIts = await PostItBoard.load(config.paths.postIts, log);
  postIts.on('change', () => {
    hub.broadcast();
  });
  const modules = new ModuleManager(
    [
      {
        id: POSTITS_MODULE_ID,
        name: 'Post-it',
        description: 'Petits mots collés depuis le téléphone, à droite de l’accueil',
        configured: true,
        problem: null,
        start: () => undefined,
        stop: () => undefined,
      },
      ...cardModules.map(({ entry, module, problem }) => ({
        id: entry.id,
        name: entry.name,
        description: entry.description,
        configured: module !== null,
        problem,
        options: entry.options,
        start: () => module?.start(),
        stop: () => module?.stop(),
      })),
    ],
    {
      disabledModules: () => settings.get().disabledModules,
      setDisabledModules: async (ids) => {
        await settings.update((s) => ({ ...s, disabledModules: ids }));
      },
      moduleOptions: () => settings.get().moduleOptions,
      setModuleOptions: async (id, values) => {
        await settings.update((s) => ({
          ...s,
          moduleOptions: { ...s.moduleOptions, [id]: values },
        }));
      },
    },
    log,
  );
  const hub = new StateHub(
    {
      browser,
      music,
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
      // Un module éteint n'envoie plus sa carte, même s'il en garde une en mémoire.
      cards: () =>
        cardModules.flatMap(({ entry, module }) => {
          const card = module && modules.isActive(entry.id) ? module.card() : null;
          return card ? [{ ...card, options: modules.optionValues(entry.id) }] : [];
        }),
      postIts,
      modules,
    },
    log.child({ module: 'hub' }),
  );
  for (const { module } of cardModules) {
    module?.on('change', () => {
      hub.broadcast();
    });
  }
  settings.on('change', () => {
    hub.broadcast();
  });
  auth.on('pairingChange', () => {
    hub.broadcast();
  });
  music.on('change', () => {
    hub.broadcast();
  });
  await wallpapers.init(() => {
    hub.broadcast();
  });

  // --- Serveurs HTTP ------------------------------------------------------------------
  const tvApp = await buildTvApp(config, log, hub, artwork);
  const lanApp = await buildLanApp({
    config,
    log,
    hub,
    auth,
    wallpapers: wallpaperManager,
    artwork,
    updater: new Updater({ config, log }),
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
  music.start();
  modules.startActive();

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
    clearInterval(logRotation);
    music.stop();
    modules.stopAll();
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
