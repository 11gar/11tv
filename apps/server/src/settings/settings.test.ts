import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { SettingsService } from './settings';

const log = pino({ level: 'silent' });

describe('SettingsService', () => {
  it('n’écrase pas une modification par une autre lancée en même temps', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), '11tv-settings-'));
    const file = path.join(dir, 'settings.json');
    const settings = await SettingsService.load(file, log);

    await Promise.all([
      settings.update((s) => ({ ...s, wallpaperOrder: ['b', 'a'] })),
      settings.update((s) => ({ ...s, slideIntervalSec: 60 })),
    ]);
    expect(settings.get()).toMatchObject({ wallpaperOrder: ['b', 'a'], slideIntervalSec: 60 });

    const reloaded = await SettingsService.load(file, log);
    expect(reloaded.get()).toMatchObject({ wallpaperOrder: ['b', 'a'], slideIntervalSec: 60 });
  });

  it('rejette une valeur invalide sans bloquer les suivantes', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), '11tv-settings-'));
    const settings = await SettingsService.load(path.join(dir, 'settings.json'), log);
    await expect(settings.update((s) => ({ ...s, slideIntervalSec: 1 }))).rejects.toThrow();
    await settings.update((s) => ({ ...s, slideIntervalSec: 45 }));
    expect(settings.get().slideIntervalSec).toBe(45);
  });
});
