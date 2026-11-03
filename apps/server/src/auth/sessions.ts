import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { Logger } from '../log';
import { JsonFile } from '../storage/json-file';

const storedSessionSchema = z.object({
  /** Empreinte SHA-256 du jeton : le jeton lui-même n'est jamais écrit sur disque. */
  id: z.string(),
  label: z.string(),
  createdAt: z.number(),
  lastSeenAt: z.number(),
});

const sessionsFileSchema = z.object({ sessions: z.array(storedSessionSchema) });

type StoredSession = z.infer<typeof storedSessionSchema>;

/** On ne réécrit le fichier pour « dernière activité » qu'au plus une fois par heure. */
const TOUCH_PERSIST_INTERVAL_MS = 60 * 60 * 1000;

function digest(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Sessions du téléphone, à expiration glissante. */
export class SessionStore {
  private constructor(
    private readonly file: JsonFile<z.infer<typeof sessionsFileSchema>>,
    private sessions: StoredSession[],
    private readonly ttlMs: number,
    private readonly now: () => number,
  ) {}

  static async load(
    filePath: string,
    ttlMs: number,
    log: Logger,
    now: () => number = Date.now,
  ): Promise<SessionStore> {
    const file = new JsonFile(filePath, sessionsFileSchema, () => ({ sessions: [] }), log);
    const { sessions } = await file.load();
    const store = new SessionStore(file, sessions, ttlMs, now);
    store.sessions = store.sessions.filter((s) => !store.isExpired(s));
    return store;
  }

  async create(label: string): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    const at = this.now();
    this.sessions.push({ id: digest(token), label, createdAt: at, lastSeenAt: at });
    await this.persist();
    return token;
  }

  /** Vérifie un jeton et prolonge la session. */
  validate(token: string | undefined): boolean {
    if (!token) return false;
    const id = digest(token);
    const session = this.sessions.find((s) => s.id === id);
    if (!session) return false;
    if (this.isExpired(session)) {
      this.sessions = this.sessions.filter((s) => s !== session);
      void this.persist();
      return false;
    }
    const at = this.now();
    const shouldPersist = at - session.lastSeenAt > TOUCH_PERSIST_INTERVAL_MS;
    session.lastSeenAt = at;
    if (shouldPersist) void this.persist();
    return true;
  }

  async revoke(token: string): Promise<void> {
    const id = digest(token);
    this.sessions = this.sessions.filter((s) => s.id !== id);
    await this.persist();
  }

  async revokeAll(): Promise<void> {
    this.sessions = [];
    await this.persist();
  }

  get count(): number {
    return this.sessions.length;
  }

  private isExpired(session: StoredSession): boolean {
    return this.now() - session.lastSeenAt > this.ttlMs;
  }

  private persist(): Promise<void> {
    return this.file.save({ sessions: this.sessions });
  }
}
