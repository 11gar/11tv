import { POSTIT_MAX } from '@11tv/shared';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { Logger } from '../log';
import { PostItBoard } from './board';

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as Logger;

function file() {
  return path.join(mkdtempSync(path.join(os.tmpdir(), '11tv-postits-')), 'postits.json');
}

describe('PostItBoard', () => {
  it('colle, décolle et garde les post-it après un redémarrage', async () => {
    const filePath = file();
    const board = await PostItBoard.load(filePath, log);
    const change = vi.fn();
    board.on('change', change);

    const courses = await board.add('  Acheter du pain  ', 'yellow');
    await board.add('Bravo pour ton exam !', 'pink');
    expect(courses.text).toBe('Acheter du pain');

    await board.remove(courses.id);
    await board.remove('deja-decolle');
    expect(change).toHaveBeenCalledTimes(3);

    const reloaded = await PostItBoard.load(filePath, log);
    expect(reloaded.list().map((p) => p.text)).toEqual(['Bravo pour ton exam !']);
  });

  it('décolle le plus ancien au-delà du maximum', async () => {
    const board = await PostItBoard.load(file(), log);
    for (let i = 0; i <= POSTIT_MAX; i++) await board.add(`note ${String(i)}`, 'blue', i);
    const texts = board.list().map((p) => p.text);
    expect(texts).toHaveLength(POSTIT_MAX);
    expect(texts[0]).toBe('note 1');
    expect(texts.at(-1)).toBe(`note ${String(POSTIT_MAX)}`);

    await board.clear();
    expect(board.list()).toEqual([]);
  });
});
