import { describe, expect, it } from 'vitest';
import { buildEdgeArgs, pickPages, type EdgeOptions } from './edge-browser';

const base: EdgeOptions = {
  executable: 'msedge.exe',
  profileDir: 'C:\\data\\edge-profile',
  debugPort: 9222,
  kiosk: true,
  launch: true,
  startUrl: 'http://127.0.0.1:8080/',
};

describe('buildEdgeArgs', () => {
  it('lance Edge en plein écran avec un profil dédié et le port de debug', () => {
    const args = buildEdgeArgs(base);
    expect(args).toContain('--user-data-dir=C:\\data\\edge-profile');
    expect(args).toContain('--remote-debugging-port=9222');
    expect(args).toContain('--start-fullscreen');
    // Le kiosque d'Edge efface les connexions aux services à chaque fermeture.
    expect(args).not.toContain('--kiosk');
    expect(args).toContain('http://127.0.0.1:8080/');
    expect(args).not.toContain('--enable-automation');
  });

  it('ouvre une fenêtre d’application hors plein écran', () => {
    const args = buildEdgeArgs({ ...base, kiosk: false });
    expect(args).toContain('--app=http://127.0.0.1:8080/');
    expect(args).not.toContain('--kiosk');
  });
});

describe('pickPages', () => {
  const home = 'http://127.0.0.1:8080/';
  const music = 'https://music.youtube.com/watch?v=abc';

  const twitch = 'https://www.twitch.tv/zerator';

  it('retrouve la fenêtre de musique à côté de l’onglet principal, dans les deux ordres', () => {
    expect(pickPages([home, music], home)).toEqual({ main: 0, music: 1, video: null });
    expect(pickPages([music, home], home)).toEqual({ main: 1, music: 0, video: null });
  });

  it('retrouve la fenêtre des services, quel que soit l’ordre des onglets', () => {
    expect(pickPages([twitch, home, music], home)).toEqual({ main: 1, music: 2, video: 0 });
    expect(pickPages([home, `${home}navigateur`], home)).toEqual({
      main: 0,
      music: null,
      video: 1,
    });
  });

  it('prend le premier onglet comme principal s’il n’y a pas d’accueil', () => {
    expect(pickPages([music], home)).toEqual({ main: 0, music: null, video: null });
    expect(pickPages([twitch, music], home)).toEqual({ main: 0, music: 1, video: null });
  });
});
