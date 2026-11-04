import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../config';
import type { Logger } from '../log';
import { failureSummary, UP_TO_DATE_EXIT_CODE, Updater } from './updater';

const log = { info: vi.fn(), error: vi.fn(), warn: vi.fn() } as unknown as Logger;

function setup(env: AppConfig['env'] = 'production') {
  const repo = mkdtempSync(path.join(os.tmpdir(), '11tv-update-'));
  const logs = path.join(repo, 'logs');
  mkdirSync(path.join(repo, 'scripts'));
  mkdirSync(logs);
  writeFileSync(path.join(repo, 'scripts', 'update.ps1'), '');
  const config = { env, paths: { repo, logs } } as AppConfig;
  const child = new EventEmitter() as ChildProcess;
  const spawnScript = vi.fn((_script: string, fd: number) => {
    writeFileSync(
      fd,
      '== Construction\nerreur TS2345\nÉchec de la mise à jour : Construction : échec (code 1)\n',
    );
    return child;
  });
  const updater = new Updater({ config, log, spawnScript, platform: 'win32' });
  return { updater, child, spawnScript };
}

describe('Updater', () => {
  it('refuse en développement et hors Windows', () => {
    expect(setup('development').updater.start()).toBe(false);
    const { updater } = setup();
    expect(
      new Updater({
        config: { env: 'production', paths: { repo: '/x', logs: '/x' } } as AppConfig,
        log,
        platform: 'linux',
      }).state.state,
    ).toBe('unavailable');
    expect(updater.state.state).toBe('idle');
  });

  it('ne lance qu’une mise à jour à la fois', () => {
    const { updater, spawnScript } = setup();
    expect(updater.start()).toBe(true);
    expect(updater.state.state).toBe('running');
    expect(updater.start()).toBe(false);
    expect(spawnScript).toHaveBeenCalledTimes(1);
  });

  it('signale « déjà à jour »', () => {
    const { updater, child } = setup();
    updater.start();
    child.emit('exit', UP_TO_DATE_EXIT_CODE);
    expect(updater.state.state).toBe('up-to-date');
    expect(updater.start()).toBe(true); // On peut relancer ensuite.
  });

  it('résume le journal en cas d’échec', () => {
    const { updater, child } = setup();
    updater.start();
    child.emit('exit', 1);
    const state = updater.state;
    expect(state.state).toBe('failed');
    if (state.state === 'failed') expect(state.message).toContain('Construction : échec (code 1)');
  });
});

describe('failureSummary', () => {
  it('garde les dernières lignes utiles', () => {
    const text = 'a\n\nb\n+ CategoryInfo : x\nc\nd\ne\nf\ng\n';
    expect(failureSummary(text)).toBe('b\nc\nd\ne\nf\ng');
  });
});
