import type { BrowserStatus, PairingInfo, ServerMessage, Wallpaper } from '@11tv/shared';
import { EventEmitter } from 'node:events';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import {
  BrowserUnavailableError,
  type BrowserController,
  type BrowserEvents,
} from '../browser/browser-controller';
import { UserFacingError } from '../errors';
import { RemoteControl } from '../input/remote-control';
import type { InputDriver } from '../input/input-driver';
import { StateHub, viewForUrl, type ClientRole, type HubClient } from './state-hub';

const HOME = 'http://127.0.0.1:8080/';

class FakeBrowser extends EventEmitter<BrowserEvents> implements BrowserController {
  status: BrowserStatus = 'ready';
  readonly calls: string[] = [];
  start(): void {
    this.emit('status', this.status);
  }
  stop(): Promise<void> {
    return Promise.resolve();
  }
  navigate(url: string): Promise<void> {
    if (this.status !== 'ready') return Promise.reject(new BrowserUnavailableError());
    this.calls.push(`goto ${url}`);
    this.emit('navigated', url);
    return Promise.resolve();
  }
  goBack(): Promise<void> {
    this.calls.push('back');
    return Promise.resolve();
  }
  pressKey(key: string): Promise<void> {
    this.calls.push(`key ${key}`);
    return Promise.resolve();
  }
  insertText(text: string): Promise<void> {
    this.calls.push(`text ${text}`);
    return Promise.resolve();
  }
}

class FakeInput implements InputDriver {
  readonly available = true;
  readonly calls: string[] = [];
  moveMouse(dx: number, dy: number): void {
    this.calls.push(`move ${String(dx)},${String(dy)}`);
  }
  click(button: string): void {
    this.calls.push(`click ${button}`);
  }
  scroll(delta: number): void {
    this.calls.push(`scroll ${String(delta)}`);
  }
  volume(action: string): void {
    this.calls.push(`volume ${action}`);
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
  const input = new FakeInput();
  let interval = 30;
  let images: Wallpaper[] = [
    { id: 'a.jpg', url: '/wallpapers/a.jpg', thumbUrl: '/api/wallpapers/a.jpg/thumb' },
    { id: 'b.jpg', url: '/wallpapers/b.jpg', thumbUrl: '/api/wallpapers/b.jpg/thumb' },
  ];
  const hub = new StateHub(
    {
      browser,
      remote: new RemoteControl(browser, input),
      homeUrl: HOME,
      settings: {
        slideIntervalSec: () => interval,
        setSlideInterval: (seconds) => {
          interval = seconds;
          hub.broadcast();
          return Promise.resolve();
        },
      },
      wallpapers: {
        list: () => images,
        has: (id) => images.some((w) => w.id === id),
        remove: (id) => {
          images = images.filter((w) => w.id !== id);
          return Promise.resolve();
        },
        reorder: (order) => {
          images = order.map((id) => images.find((w) => w.id === id)).filter((w) => !!w);
          return Promise.resolve();
        },
      },
      pairing: () => pairing,
    },
    pino({ level: 'silent' }),
  );
  const client = (role: ClientRole) => {
    const received: ServerMessage[] = [];
    const c: HubClient = { role, send: (m) => received.push(m) };
    return { c, received, last: () => received.at(-1) };
  };
  return { browser, input, hub, client, images: () => images };
}

describe('viewForUrl', () => {
  it('distingue accueil, services et autres pages', () => {
    expect(viewForUrl(HOME, HOME)).toBe('home');
    expect(viewForUrl(`${HOME}?x=1`, HOME)).toBe('home');
    expect(viewForUrl('https://www.disneyplus.com/fr-fr', HOME)).toBe('disney-plus');
    expect(viewForUrl('https://www.google.com/', HOME)).toBe('other');
  });
});

describe('StateHub : état', () => {
  it('envoie l’état à la connexion, sans le PIN d’appairage pour le téléphone', () => {
    const { hub, client } = setup();
    const tv = client('tv');
    const remote = client('remote');
    hub.addClient(tv.c);
    hub.addClient(remote.c);

    expect(tv.last()).toMatchObject({ type: 'state', state: { view: 'home', pairing } });
    const remoteState = remote.last();
    expect(remoteState).toMatchObject({
      type: 'state',
      state: { view: 'home', browser: 'ready', pointerAvailable: true },
    });
    expect(JSON.stringify(remoteState)).not.toContain('123456');
    expect(JSON.stringify(remoteState)).not.toContain('pairing');
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

describe('StateHub : navigation', () => {
  it('lance un service, puis revient à l’accueil, et diffuse la nouvelle vue', async () => {
    const { hub, client, browser } = setup();
    const remote = client('remote');
    hub.addClient(remote.c);

    await hub.handle({ type: 'launch', service: 'prime-video' });
    expect(browser.calls).toEqual(['goto https://www.primevideo.com/']);
    expect(remote.last()).toMatchObject({ state: { view: 'prime-video' } });

    await hub.handle({ type: 'home' });
    expect(browser.calls.at(-1)).toBe(`goto ${HOME}`);
    expect(remote.last()).toMatchObject({ state: { view: 'home' } });
  });

  it('propage l’erreur si le navigateur est indisponible', async () => {
    const { hub, browser } = setup();
    browser.status = 'unavailable';
    await expect(hub.handle({ type: 'launch', service: 'youtube' })).rejects.toBeInstanceOf(
      BrowserUnavailableError,
    );
  });
});

describe('StateHub : télécommande', () => {
  it('envoie les touches et le texte au navigateur', async () => {
    const { hub, browser } = setup();
    await hub.handle({ type: 'key', key: 'up' });
    await hub.handle({ type: 'key', key: 'ok' });
    await hub.handle({ type: 'key', key: 'shift-tab' });
    await hub.handle({ type: 'text', text: 'chats', submit: true });
    await hub.handle({ type: 'history-back' });
    expect(browser.calls).toEqual([
      'key ArrowUp',
      'key Enter',
      'key Shift+Tab',
      'text chats',
      'key Enter',
      'back',
    ]);
  });

  it('envoie la souris et le volume au pilote système, molette inversée comme un trackpad', async () => {
    const { hub, input } = setup();
    await hub.handle({ type: 'pointer-move', dx: 5, dy: -3 });
    await hub.handle({ type: 'pointer-click', button: 'right' });
    await hub.handle({ type: 'pointer-scroll', dy: 30 });
    await hub.handle({ type: 'volume', action: 'mute' });
    expect(input.calls).toEqual(['move 5,-3', 'click right', 'scroll -120', 'volume mute']);
  });
});

describe('StateHub : réglages', () => {
  it('modifie le délai, supprime et réordonne les fonds d’écran', async () => {
    const { hub, client, images } = setup();
    const remote = client('remote');
    hub.addClient(remote.c);

    await hub.handle({ type: 'set-slide-interval', seconds: 60 });
    expect(remote.last()).toMatchObject({ state: { slideIntervalSec: 60 } });

    await hub.handle({ type: 'reorder-wallpapers', order: ['b.jpg', 'a.jpg'] });
    expect(images().map((w) => w.id)).toEqual(['b.jpg', 'a.jpg']);

    await hub.handle({ type: 'delete-wallpaper', id: 'a.jpg' });
    expect(images().map((w) => w.id)).toEqual(['b.jpg']);
  });

  it('refuse de supprimer un fond d’écran inconnu avec un message lisible', async () => {
    const { hub } = setup();
    await expect(
      hub.handle({ type: 'delete-wallpaper', id: '../settings.json' }),
    ).rejects.toBeInstanceOf(UserFacingError);
  });
});
