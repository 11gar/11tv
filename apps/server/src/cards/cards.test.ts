import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { Logger } from '../log';
import { PollingCardModule, type CardModule } from './card-module';
import { loadCardModules } from './registry';

const log = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: () => log,
} as unknown as Logger;

const data = { todos: [] };

function polling(fetch: () => Promise<typeof data>) {
  return new PollingCardModule({
    id: 'me-mories',
    kind: 'me-mories-todos',
    slot: 'left',
    intervalMs: 60_000,
    log,
    fetch,
  });
}

describe('PollingCardModule', () => {
  it('n’affiche rien tant qu’aucune actualisation n’a réussi', async () => {
    const module = polling(() => Promise.reject(new Error('hors ligne')));
    const change = vi.fn();
    module.on('change', change);
    await module.refresh();
    expect(module.card()).toBeNull();
    expect(change).not.toHaveBeenCalled();
  });

  it('garde les dernières données et note l’erreur', async () => {
    let fail = false;
    const module = polling(() =>
      fail ? Promise.reject(new Error('hors ligne')) : Promise.resolve(data),
    );
    await module.refresh();
    expect(module.card()).toMatchObject({ kind: 'me-mories-todos', data, error: null });

    fail = true;
    await module.refresh();
    expect(module.card()).toMatchObject({ data, error: 'hors ligne' });
  });
});

describe('loadCardModules', () => {
  it('n’active que les modules configurés, et ignore une configuration invalide', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), '11tv-modules-'));
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'valide.json'), '﻿{"ok":true}');
    writeFileSync(path.join(dir, 'invalide.json'), '{pas du json');

    const create = vi.fn(() => polling(() => Promise.resolve(data)) as CardModule);
    const modules = await loadCardModules(dir, log, {
      valide: create,
      invalide: create,
      absent: create,
    });

    expect(modules).toHaveLength(1);
    expect(create).toHaveBeenCalledWith({ ok: true }, log);
  });
});
