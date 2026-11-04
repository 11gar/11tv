import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { rotateIfLarger } from './log-rotation';

describe('rotateIfLarger', () => {
  it('ne touche pas à un petit fichier', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), '11tv-logs-'));
    const file = path.join(dir, '11tv.log');
    await writeFile(file, 'court');
    expect(await rotateIfLarger(file, 100, 3)).toBe(false);
    expect(await readdir(dir)).toEqual(['11tv.log']);
  });

  it('décale les anciens fichiers et ne garde que les plus récents', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), '11tv-logs-'));
    const file = path.join(dir, '11tv.log');
    for (let round = 1; round <= 5; round++) {
      await writeFile(file, `tour ${String(round)} `.repeat(20));
      expect(await rotateIfLarger(file, 100, 3)).toBe(true);
    }
    expect((await readdir(dir)).sort()).toEqual(['11tv.log.1', '11tv.log.2', '11tv.log.3']);
    expect(await readFile(`${file}.1`, 'utf8')).toContain('tour 5');
    expect(await readFile(`${file}.3`, 'utf8')).toContain('tour 3');
  });

  it('ignore un fichier absent', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), '11tv-logs-'));
    expect(await rotateIfLarger(path.join(dir, 'absent.log'), 100, 3)).toBe(false);
  });
});
