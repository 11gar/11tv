import { serviceForUrl, type BrowserStatus } from '@11tv/shared';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { chromium, type Browser, type CDPSession, type Page } from 'playwright-core';
import type { Logger } from '../log';
import {
  BrowserUnavailableError,
  type BrowserController,
  type BrowserEvents,
  type Foreground,
} from './browser-controller';

export interface EdgeOptions {
  executable: string;
  profileDir: string;
  debugPort: number;
  /**
   * Vrai : plein écran pour la TV (ELEVENTV_EDGE_KIOSK, nom historique). Faux : fenêtre
   * d'application, pratique en développement.
   */
  kiosk: boolean;
  /** Faux : on se contente de s'attacher à un Edge lancé par ailleurs. */
  launch: boolean;
  startUrl: string;
}

const RECONCILE_INTERVAL_MS = 5_000;
/** Délai minimal entre deux lancements, pour ne pas boucler si Edge plante au démarrage. */
const RELAUNCH_COOLDOWN_MS = 20_000;
const NAVIGATION_TIMEOUT_MS = 15_000;

type WindowState = 'normal' | 'minimized' | 'maximized' | 'fullscreen';
interface WindowBounds {
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  windowState?: WindowState;
}

export function buildEdgeArgs(options: EdgeOptions): string[] {
  const args = [
    `--user-data-dir=${options.profileDir}`,
    `--remote-debugging-port=${String(options.debugPort)}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required',
  ];
  if (options.kiosk) {
    // Plein écran et non --kiosk : le vrai kiosque d'Edge efface cookies et stockage à
    // chaque fermeture, donc toutes les connexions aux services à chaque redémarrage.
    args.push('--start-fullscreen', '--hide-crash-restore-bubble', options.startUrl);
  } else {
    args.push(`--app=${options.startUrl}`);
  }
  return args;
}

/**
 * Retrouve les rôles des onglets ouverts, au démarrage ou après un redémarrage du serveur :
 * la fenêtre de musique est un onglet YouTube Music à côté de l'onglet principal. Seul, un
 * onglet YouTube Music est l'onglet principal.
 */
export function pickPages(urls: readonly string[]): { main: number; music: number | null } {
  if (urls.length < 2) return { main: 0, music: null };
  const music = urls.findLastIndex((url) => serviceForUrl(url) === 'youtube-music');
  if (music === -1) return { main: 0, music: null };
  return { main: music === 0 ? 1 : 0, music };
}

/**
 * Edge piloté par le protocole DevTools (CDP).
 *
 * Une boucle de réconciliation vérifie toutes les 5 s que le port de debug répond et que
 * l'onglet principal est attaché ; sinon elle (re)lance Edge ou s'y rattache. Le serveur peut
 * donc redémarrer sans tuer Edge, et Edge peut planter sans que le serveur ne s'en soucie.
 *
 * YouTube Music vit dans sa propre fenêtre, créée réduite. L'afficher la passe en plein écran
 * par-dessus le kiosque ; revenir à l'accueil la réduit, sans couper la lecture (une page
 * réduite reste « visible » pour Chromium et n'est pas ralentie).
 *
 * Edge est lancé par nous et non par Playwright : Playwright ajouterait --enable-automation,
 * que Google et les plateformes de streaming détectent.
 */
export class EdgeBrowser extends EventEmitter<BrowserEvents> implements BrowserController {
  private browser: Browser | null = null;
  private cdp: CDPSession | null = null;
  private page: Page | null = null;
  private musicPage: Page | null = null;
  private musicWindowId: number | null = null;
  private foregroundValue: Foreground = 'main';
  private timer: NodeJS.Timeout | null = null;
  private reconciling = false;
  private stopping = false;
  private lastLaunchAt = 0;
  private currentStatus: BrowserStatus = 'starting';
  /** Les changements de fenêtre sont sérialisés : deux appuis rapides ne s'entremêlent pas. */
  private windowQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly options: EdgeOptions,
    private readonly log: Logger,
  ) {
    super();
  }

  get status(): BrowserStatus {
    return this.currentStatus;
  }

  get foreground(): Foreground {
    return this.foregroundValue;
  }

  get hasMusic(): boolean {
    return this.musicPage !== null && !this.musicPage.isClosed();
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
    const page = this.mainPage();
    await this.showMain();
    await page.goto(url, { waitUntil: 'commit', timeout: NAVIGATION_TIMEOUT_MS });
  }

  showMusic(url: string, reload: boolean): Promise<void> {
    return this.inWindowQueue(async () => {
      let page = this.hasMusic ? this.musicPage : null;
      if (!page) {
        page = await this.createMusicPage(url);
      } else if (reload) {
        await page.goto(url, { waitUntil: 'commit', timeout: NAVIGATION_TIMEOUT_MS });
      }
      await this.setMusicWindow(true);
      await page.bringToFront();
      this.setForeground('music');
    });
  }

  showMain(): Promise<void> {
    return this.inWindowQueue(async () => {
      const page = this.mainPage();
      if (this.hasMusic) await this.setMusicWindow(false);
      await page.bringToFront();
      this.setForeground('main');
    });
  }

  async evaluateInMusic(expression: string): Promise<unknown> {
    const page = this.hasMusic ? this.musicPage : null;
    if (!page) return undefined;
    return page.evaluate(expression);
  }

  async goBack(): Promise<void> {
    await this.frontPage().goBack({ waitUntil: 'commit', timeout: NAVIGATION_TIMEOUT_MS });
  }

  async pressKey(key: string): Promise<void> {
    await this.frontPage().keyboard.press(key);
  }

  async insertText(text: string): Promise<void> {
    await this.frontPage().keyboard.insertText(text);
  }

  private mainPage(): Page {
    const page = this.page;
    if (!page || page.isClosed()) throw new BrowserUnavailableError();
    return page;
  }

  private frontPage(): Page {
    if (this.foregroundValue === 'music' && this.musicPage && !this.musicPage.isClosed()) {
      return this.musicPage;
    }
    return this.mainPage();
  }

  private inWindowQueue(task: () => Promise<void>): Promise<void> {
    const run = this.windowQueue.then(task);
    this.windowQueue = run.catch(() => undefined);
    return run;
  }

  private setForeground(foreground: Foreground): void {
    if (foreground === this.foregroundValue) return;
    this.foregroundValue = foreground;
    this.log.debug({ foreground }, 'Premier plan');
    this.emit('foreground', foreground);
  }

  private setStatus(status: BrowserStatus): void {
    if (status === this.currentStatus) return;
    this.currentStatus = status;
    this.log.info({ status }, 'État du navigateur');
    this.emit('status', status);
  }

  // --- Fenêtre de musique ---------------------------------------------------------------

  private browserCdp(): CDPSession {
    if (!this.cdp) throw new BrowserUnavailableError();
    return this.cdp;
  }

  private async createMusicPage(url: string): Promise<Page> {
    const context = this.browser?.contexts()[0];
    if (!context) throw new BrowserUnavailableError();
    // Créée réduite et en arrière-plan : rien ne s'affiche par-dessus la TV avant qu'on le décide.
    const created = context.waitForEvent('page', { timeout: NAVIGATION_TIMEOUT_MS });
    const { targetId } = await this.browserCdp().send('Target.createTarget', {
      url,
      newWindow: true,
      background: true,
      windowState: 'minimized',
    });
    const page = await created;
    const { windowId } = await this.browserCdp().send('Browser.getWindowForTarget', {
      targetId,
    });
    this.trackMusicPage(page, windowId);
    this.log.info('Fenêtre YouTube Music créée');
    return page;
  }

  private trackMusicPage(page: Page, windowId: number): void {
    this.musicPage = page;
    this.musicWindowId = windowId;
    page.on('close', () => {
      if (this.musicPage !== page) return;
      this.musicPage = null;
      this.musicWindowId = null;
      this.log.warn('Fenêtre YouTube Music fermée');
      this.setForeground('main');
    });
  }

  private async setMusicWindow(visible: boolean): Promise<void> {
    const windowId = this.musicWindowId;
    if (windowId === null) return;
    const setBounds = (bounds: WindowBounds) =>
      this.browserCdp().send('Browser.setWindowBounds', { windowId, bounds });

    // Chromium refuse de passer directement de « réduite » à « plein écran » et inversement.
    await setBounds({ windowState: 'normal' }).catch(() => undefined);
    if (!visible) {
      await setBounds({ windowState: 'minimized' });
    } else if (this.options.kiosk) {
      await setBounds({ windowState: 'fullscreen' });
    } else {
      // En développement, la musique prend la place de la fenêtre d'application.
      const { left, top, width, height } = await this.windowOf(this.mainPage());
      await setBounds({ left, top, width, height });
    }
  }

  private async windowOf(page: Page): Promise<WindowBounds & { windowId?: number }> {
    const session = await page.context().newCDPSession(page);
    try {
      const { windowId, bounds } = await session.send('Browser.getWindowForTarget');
      const { left, top, width, height } = bounds;
      return { windowId, left, top, width, height, windowState: bounds.windowState };
    } finally {
      await session.detach().catch(() => undefined);
    }
  }

  // --- Connexion ------------------------------------------------------------------------

  private async reconcile(): Promise<void> {
    if (this.reconciling || this.stopping) return;
    this.reconciling = true;
    try {
      if (this.browser?.isConnected() && this.page && !this.page.isClosed()) return;

      if (this.browser?.isConnected()) {
        await this.attachPages(this.browser);
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
      this.cdp = null;
      this.page = null;
      this.musicPage = null;
      this.musicWindowId = null;
      this.log.warn('Navigateur déconnecté');
      this.setForeground('main');
      this.setStatus(this.stopping ? 'unavailable' : 'starting');
    });
    this.browser = browser;
    this.cdp = await browser.newBrowserCDPSession();
    await this.attachPages(browser);
  }

  private async attachPages(browser: Browser): Promise<void> {
    const context = browser.contexts()[0];
    const pages = context?.pages().filter((p) => !p.url().startsWith('devtools://')) ?? [];
    const roles = pickPages(pages.map((p) => p.url()));
    const page = pages[roles.main];
    if (!page) {
      // Normalement impossible : Edge est lancé sur l'accueil ; la prochaine réconciliation réessaiera.
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

    const music = roles.music === null ? undefined : pages[roles.music];
    if (music && this.musicPage !== music) {
      const { windowId, windowState } = await this.windowOf(music);
      if (windowId !== undefined) {
        this.trackMusicPage(music, windowId);
        this.setForeground(windowState === 'minimized' ? 'main' : 'music');
        this.log.info('Fenêtre YouTube Music retrouvée');
      }
    }

    this.emit('navigated', page.url());
    this.setStatus('ready');
    this.log.info({ url: page.url() }, 'Onglet principal attaché');
  }
}
