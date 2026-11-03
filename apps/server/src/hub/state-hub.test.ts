import type { BrowserStatus, PairingInfo, ServerMessage } from '@11tv/shared';
import { EventEmitter } from 'node:events';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import {
  BrowserUnavailableError,
  type BrowserController,
  type BrowserEvents,
} from '../browser/browser-controller';
import { StateHub, viewForUrl, type ClientRole, type HubClient } from './state-hub';

const HOME = 'http://127.0.0.1:8080/';

class FakeBrowser extends EventEmitter<BrowserEvents> implements BrowserController {
  status: BrowserStatus = 'ready';
  readonly visited: string[] = [];
  start(): void {
    this.emit('status', this.status);
  }
  stop(): Promise<void> {
    return Promise.resolve();
  }
  navigate(url: string): Promise<void> {
    if (this.status !== 'ready') return Promise.reject(new BrowserUnavailableError());
    this.visited.push(url);
    this.emit('navigated', url);
    return Promise.resolve();
  }
}

const pairing: PairingInfo = {
  pin: '123456',
  appUrl: 'https://192.168.1.23:8443/',
  setupUrl: 'http://192.168.1.23:8081/',
  setupQrSvg: '<svg/>',
  caFingerprint: 'AA:BB',
};

function setup() {
  const browser = new FakeBrowser();
  const hub = new StateHub(
    {
      browser,
      homeUrl: HOME,
      slideIntervalSec: () => 30,
      wallpapers: () => [{ id: 'a.jpg', url: '/wallpapers/a.jpg' }],
      pairing: () => pairing,
    },
    pino({ level: 'silent' }),
  );
  const client = (role: ClientRole) => {
    const received: ServerMessage[] = [];
    const c: HubClient = { role, send: (m) => received.push(m) };
    return { c, received, last: () => received.at(-1) };
  };
  return { browser, hub, client };
}

describe('viewForUrl', () => {
  it('distingue accueil, services et autres pages', () => {
    expect(viewForUrl(HOME, HOME)).toBe('home');
    expect(viewForUrl(`${HOME}?x=1`, HOME)).toBe('home');
    expect(viewForUrl('https://www.disneyplus.com/fr-fr', HOME)).toBe('disney-plus');
    expect(viewForUrl('https://www.google.com/', HOME)).toBe('other');
  });
});

describe('StateHub', () => {
  it('envoie l’état à la connexion, sans données TV pour le téléphone', () => {
    const { hub, client } = setup();
    const tv = client('tv');
    const remote = client('remote');
    hub.addClient(tv.c);
    hub.addClient(remote.c);

    expect(tv.last()).toMatchObject({ type: 'state', state: { view: 'home', pairing } });
    const remoteState = remote.last();
    expect(remoteState).toMatchObject({ type: 'state', state: { view: 'home', browser: 'ready' } });
    expect(JSON.stringify(remoteState)).not.toContain('123456');
    expect(JSON.stringify(remoteState)).not.toContain('wallpapers');
  });

  it('lance un service, puis revient à l’accueil, et diffuse la nouvelle vue', async () => {
    const { hub, client, browser } = setup();
    const remote = client('remote');
    hub.addClient(remote.c);

    await hub.handle({ type: 'launch', service: 'prime-video' });
    expect(browser.visited).toEqual(['https://www.primevideo.com/']);
    expect(remote.last()).toMatchObject({ state: { view: 'prime-video' } });

    await hub.handle({ type: 'home' });
    expect(browser.visited.at(-1)).toBe(HOME);
    expect(remote.last()).toMatchObject({ state: { view: 'home' } });
  });

  it('propage l’erreur si le navigateur est indisponible', async () => {
    const { hub, browser } = setup();
    browser.status = 'unavailable';
    await expect(hub.handle({ type: 'launch', service: 'youtube' })).rejects.toBeInstanceOf(
      BrowserUnavailableError,
    );
  });

  it('diffuse les changements d’état du navigateur et arrête d’écrire aux clients partis', () => {
    const { hub, client, browser } = setup();
    const remote = client('remote');
    const remove = hub.addClient(remote.c);
    browser.status = 'starting';
    browser.emit('status', 'starting');
    expect(remote.last()).toMatchObject({ state: { browser: 'starting' } });

    remove();
    const before = remote.received.length;
    hub.broadcast();
    expect(remote.received.length).toBe(before);
    expect(hub.remoteCount).toBe(0);
  });
});
