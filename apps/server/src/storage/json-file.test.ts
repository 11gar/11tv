import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import pino from 'pino';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { JsonFile } from './json-file';

const schema = z.object({ count: z.number() });
const log = pino({ level: 'silent' });

describe('JsonFile', () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), '11tv-json-'));
    file = path.join(dir, 'data.json');
  });

  it('renvoie les valeurs par défaut si le fichier est absent', async () => {
    const store = new JsonFile(file, schema, () => ({ count: 0 }), log);
    expect(await store.load()).toEqual({ count: 0 });
  });

  it('accepte un fichier retouché sous Windows (BOM en tête)', async () => {
    await writeFile(file, '﻿{"count":7}', 'utf8');
    const store = new JsonFile(file, schema, () => ({ count: 0 }), log);
    expect(await store.load()).toEqual({ count: 7 });
  });

  it('relit ce qui a été sauvegardé', async () => {
    const store = new JsonFile(file, schema, () => ({ count: 0 }), log);
    await store.save({ count: 3 });
    expect(await store.load()).toEqual({ count: 3 });
  });

  it('applique les sauvegardes concurrentes dans l’ordre', async () => {
    const store = new JsonFile(file, schema, () => ({ count: 0 }), log);
    await Promise.all([1, 2, 3, 4, 5].map((count) => store.save({ count })));
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ count: 5 });
  });

  it('met de côté un fichier invalide et repart des défauts', async () => {
    await writeFile(file, '{"count":"pas un nombre"}');
    const store = new JsonFile(file, schema, () => ({ count: 0 }), log);
    expect(await store.load()).toEqual({ count: 0 });
    const files = await readdir(dir);
    expect(files.some((name) => name.startsWith('data.json.corrupt-'))).toBe(true);
  });
});
