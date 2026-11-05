import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { z } from 'zod';
import type { Logger } from '../log';

/**
 * Fichier JSON validé par un schéma zod, écrit de façon atomique (fichier temporaire puis
 * renommage) et sérialisé : deux sauvegardes concurrentes ne peuvent pas s'entremêler.
 */
export class JsonFile<T> {
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly file: string,
    private readonly schema: z.ZodType<T>,
    private readonly defaults: () => T,
    private readonly log: Logger,
  ) {}

  async load(): Promise<T> {
    let raw: string;
    try {
      raw = await readFile(this.file, 'utf8');
      // Un fichier retouché à la main sous Windows commence parfois par un BOM.
      if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return this.defaults();
      throw err;
    }
    try {
      const parsed = this.schema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
      this.log.warn({ file: this.file, issues: parsed.error.issues }, 'Fichier invalide');
    } catch (err) {
      this.log.warn({ file: this.file, err }, 'Fichier JSON illisible');
    }
    // On garde une copie du fichier abîmé pour pouvoir l'examiner, puis on repart des défauts.
    const backup = `${this.file}.corrupt-${String(Date.now())}`;
    await rename(this.file, backup).catch(() => undefined);
    this.log.warn({ backup }, 'Valeurs par défaut utilisées, copie de sauvegarde conservée');
    return this.defaults();
  }

  save(value: T): Promise<void> {
    const task = this.queue.then(() => this.write(value));
    this.queue = task.catch(() => undefined);
    return task;
  }

  private async write(value: T): Promise<void> {
    await mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await renameWithRetry(tmp, this.file);
  }
}

/** Sous Windows, un antivirus ou l'indexeur peut verrouiller brièvement le fichier cible. */
async function renameWithRetry(from: string, to: string, attempts = 5): Promise<void> {
  for (let i = 1; ; i++) {
    try {
      await rename(from, to);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (i >= attempts || (code !== 'EPERM' && code !== 'EBUSY')) throw err;
      await new Promise((resolve) => setTimeout(resolve, 50 * i));
    }
  }
}
