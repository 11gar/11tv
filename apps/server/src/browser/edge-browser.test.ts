import { describe, expect, it } from 'vitest';
import { buildEdgeArgs, type EdgeOptions } from './edge-browser';

const base: EdgeOptions = {
  executable: 'msedge.exe',
  profileDir: 'C:\\data\\edge-profile',
  debugPort: 9222,
  kiosk: true,
  launch: true,
  startUrl: 'http://127.0.0.1:8080/',
};

describe('buildEdgeArgs', () => {
  it('lance le mode kiosque plein écran avec un profil dédié et le port de debug', () => {
    const args = buildEdgeArgs(base);
    expect(args).toContain('--user-data-dir=C:\\data\\edge-profile');
    expect(args).toContain('--remote-debugging-port=9222');
    expect(args).toContain('--kiosk');
    expect(args).toContain('--edge-kiosk-type=fullscreen');
    expect(args).toContain('http://127.0.0.1:8080/');
    expect(args).not.toContain('--enable-automation');
  });

  it('ouvre une fenêtre d’application hors mode kiosque', () => {
    const args = buildEdgeArgs({ ...base, kiosk: false });
    expect(args).toContain('--app=http://127.0.0.1:8080/');
    expect(args).not.toContain('--kiosk');
  });
});
