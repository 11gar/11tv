import {
  POSTIT_COLORS,
  POSTIT_MAX,
  POSTIT_TEXT_MAX,
  type PostIt,
  type PostItColor,
} from '@11tv/shared';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { z } from 'zod';
import type { Logger } from '../log';
import { JsonFile } from '../storage/json-file';

const postItSchema = z.object({
  id: z.string().min(1).max(64),
  text: z.string().min(1).max(POSTIT_TEXT_MAX),
  color: z.enum(POSTIT_COLORS),
  createdAt: z.number(),
});

const boardFileSchema = z.object({ postIts: z.array(postItSchema) });

/**
 * Post-it collés sur la TV depuis le téléphone, gardés d'un redémarrage à l'autre
 * (`postits.json`). Au-delà de POSTIT_MAX, le plus ancien est décollé.
 */
export class PostItBoard extends EventEmitter<{ change: [] }> {
  private constructor(
    private readonly file: JsonFile<z.infer<typeof boardFileSchema>>,
    private postIts: PostIt[],
  ) {
    super();
  }

  static async load(filePath: string, log: Logger): Promise<PostItBoard> {
    const file = new JsonFile(filePath, boardFileSchema, () => ({ postIts: [] }), log);
    const { postIts } = await file.load();
    return new PostItBoard(file, postIts.slice(-POSTIT_MAX));
  }

  list(): PostIt[] {
    return this.postIts;
  }

  async add(text: string, color: PostItColor, now = Date.now()): Promise<PostIt> {
    const postIt: PostIt = { id: randomUUID(), text: text.trim(), color, createdAt: now };
    await this.update([...this.postIts, postIt].slice(-POSTIT_MAX));
    return postIt;
  }

  /** Sans effet si le post-it a déjà été décollé (depuis un autre téléphone, par exemple). */
  async remove(id: string): Promise<void> {
    if (!this.postIts.some((p) => p.id === id)) return;
    await this.update(this.postIts.filter((p) => p.id !== id));
  }

  async clear(): Promise<void> {
    if (this.postIts.length === 0) return;
    await this.update([]);
  }

  private async update(postIts: PostIt[]): Promise<void> {
    this.postIts = postIts;
    this.emit('change');
    await this.file.save({ postIts });
  }
}
