import type { BrowserStatus } from '@11tv/shared';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { chromium, type Browser, type Page } from 'playwright-core';
import type { Logger } from '../log';
import {
  BrowserUnavailableError,
  type BrowserController,
  type BrowserEvents,
} from './browser-controller';

export interface EdgeOptions {
  executable: string;
  profileDir: string;
  debugPort: number;
  kiosk: boolean;
  /** Faux : on se contente de s'attacher à un Edge lancé par ailleurs. */
  launch: boolean;
  startUrl: string;
}

const RECONCILE_INTERVAL_MS = 5_000;
/** Délai minimal entre deux lancements, pour ne pas boucler si Edge plante au démarrage. */
const RELAUNCH_COOLDOWN_MS = 20_000;
const NAVIGATION_TIMEOUT_MS = 15_000;

export function buildEdgeArgs(options: EdgeOptions): string[] {
  const args = [
    `--user-data-dir=${options.profileDir}`,
    `--remote-debugging-port=${String(options.debugPort)}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required',
  ];
  if (options.kiosk) {
    args.push('--kiosk', options.startUrl, '--edge-kiosk-type=fullscreen');
  } else {
    args.push(`--app=${options.startUrl}`);
  }
  return args;
}

/**
 * Edge piloté par le protocole DevTools (CDP).
 *
 * Une boucle de réconciliation vérifie toutes les 5 s que le port de debug répond et que
 * l'onglet principal est attaché ; sinon elle (re)lance Edge ou s'y rattache. Le serveur peut
 * donc redémarrer sans tuer Edge, et Edge peut planter sans que le serveur ne s'en soucie.
 *
 * Edge est lancé par nous et non par Playwright : Playwright ajouterait --enable-automation,
 * que Google et les plateformes de streaming détectent.
 */
export class EdgeBrowser extends EventEmitter<BrowserEvents> implements BrowserController {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private timer: NodeJS.Timeout | null = null;
  private reconciling = false;
  private stopping = false;
  private lastLaunchAt = 0;
  private currentStatus: BrowserStatus = 'starting';

  constructor(
    private readonly options: EdgeOptions,
    private readonly log: Logger,
  ) {
    super();
  }

  get status(): BrowserStatus {
    return this.currentStatus;
  }

  start(): void {
    void this.reconcile();
    this.timer = setInterval(() => void this.reconcile(), RECONCILE_INTERVAL_MS);
  }

  async stop(): Promise<void> {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    // Pour un navigateur attaché via CDP, close() se déconnecte sans fermer Edge.
    await this.browser?.close().catch(() => undefined);
  }

  async navigate(url: string): Promise<void> {
    const page = this.page;
    if (!page || page.isClosed()) throw new BrowserUnavailableError();
    await page.bringToFront();
    await page.goto(url, { waitUntil: 'commit', timeout: NAVIGATION_TIMEOUT_MS });
  }

  private setStatus(status: BrowserStatus): void {
    if (status === this.currentStatus) return;
    this.currentStatus = status;
    this.log.info({ status }, 'État du navigateur');
    this.emit('status', status);
  }

  private async reconcile(): Promise<void> {
    if (this.reconciling || this.stopping) return;
    this.reconciling = true;
    try {
      if (this.browser?.isConnected() && this.page && !this.page.isClosed()) return;

      if (this.browser?.isConnected()) {
        this.attachPage(this.browser);
        return;
      }

      if (!(await this.debugPortResponds())) {
        if (this.options.launch) this.launch();
        this.setStatus(this.options.launch ? 'starting' : 'unavailable');
        return;
      }

      await this.connect();
    } catch (err) {
      this.log.warn({ err }, 'Connexion au navigateur impossible');
      this.setStatus('unavailable');
    } finally {
      this.reconciling = false;
    }
  }

  private async debugPortResponds(): Promise<boolean> {
    try {
      const res = await fetch(`http://127.0.0.1:${String(this.options.debugPort)}/json/version`, {
        signal: AbortSignal.timeout(1_500),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  private launch(): void {
    const now = Date.now();
    if (now - this.lastLaunchAt < RELAUNCH_COOLDOWN_MS) return;
    this.lastLaunchAt = now;

    const args = buildEdgeArgs(this.options);
    this.log.info({ executable: this.options.executable, args }, 'Lancement d’Edge');
    const child = spawn(this.options.executable, args, { detached: true, stdio: 'ignore' });
    child.on('error', (err) => {
      this.log.error({ err }, 'Edge n’a pas pu être lancé');
    });
    // Edge vit sa vie : le serveur peut redémarrer sans le fermer.
    child.unref();
  }

  private async connect(): Promise<void> {
    const browser = await chromium.connectOverCDP(
      `http://127.0.0.1:${String(this.options.debugPort)}`,
      { timeout: 10_000 },
    );
    browser.on('disconnected', () => {
      if (this.browser !== browser) return;
      this.browser = null;
      this.page = null;
      this.log.warn('Navigateur déconnecté');
      this.setStatus(this.stopping ? 'unavailable' : 'starting');
    });
    this.browser = browser;
    this.attachPage(browser);
  }

  private attachPage(browser: Browser): void {
    const context = browser.contexts()[0];
    const page = context?.pages().find((p) => !p.url().startsWith('devtools://'));
    if (!page) {
      // Normalement impossible en mode kiosque ; la prochaine réconciliation réessaiera.
      this.log.warn('Aucun onglet trouvé dans Edge');
      this.setStatus('unavailable');
      return;
    }
    this.page = page;
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) this.emit('navigated', frame.url());
    });
    page.on('close', () => {
      if (this.page === page) this.page = null;
    });
    this.emit('navigated', page.url());
    this.setStatus('ready');
    this.log.info({ url: page.url() }, 'Onglet principal attaché');
  }
}
