import { EventEmitter } from 'node:events';
import type { Logger } from '../log';
import type { SettingsService } from '../settings/settings';
import { generatePin, hashPin, verifyPin } from './pin';
import type { LoginLimiter } from './rate-limit';
import type { SessionStore } from './sessions';

export type LoginResult =
  { ok: true; token: string } | { ok: false; reason: 'invalid' | 'locked'; retryAfterSec?: number };

const GLOBAL_KEY = '*';

/**
 * PIN, appairage et sessions.
 *
 * Au premier démarrage (aucun PIN), un PIN aléatoire est généré et affiché sur la TV jusqu'à
 * la première connexion réussie. Seule son empreinte est stockée : si le serveur redémarre
 * avant l'appairage, un nouveau PIN est généré.
 */
export class AuthService extends EventEmitter<{ pairingChange: [] }> {
  private pairingPinValue: string | null = null;

  constructor(
    private readonly settings: SettingsService,
    private readonly sessions: SessionStore,
    private readonly ipLimiter: LoginLimiter,
    private readonly globalLimiter: LoginLimiter,
    private readonly log: Logger,
  ) {
    super();
  }

  async init(): Promise<void> {
    const auth = this.settings.get().auth;
    if (auth && !auth.pairingPending) return;
    const pin = generatePin();
    const pinHash = await hashPin(pin);
    await this.settings.update((s) => ({ ...s, auth: { pinHash, pairingPending: true } }));
    this.pairingPinValue = pin;
    this.log.info('Appairage en attente : le PIN est affiché sur la TV');
  }

  /** PIN à afficher sur la TV tant que l'appairage n'est pas fait. */
  get pairingPin(): string | null {
    return this.pairingPinValue;
  }

  async login(pin: string, ip: string, label: string): Promise<LoginResult> {
    for (const [limiter, key] of [
      [this.ipLimiter, ip],
      [this.globalLimiter, GLOBAL_KEY],
    ] as const) {
      const check = limiter.check(key);
      if (!check.allowed) {
        return { ok: false, reason: 'locked', retryAfterSec: Math.ceil(check.retryAfterMs / 1000) };
      }
    }

    const auth = this.settings.get().auth;
    const valid = auth ? await verifyPin(pin, auth.pinHash) : false;
    if (!valid || !auth) {
      this.ipLimiter.recordFailure(ip);
      this.globalLimiter.recordFailure(GLOBAL_KEY);
      this.log.warn({ ip }, 'PIN incorrect');
      return { ok: false, reason: 'invalid' };
    }

    this.ipLimiter.recordSuccess(ip);
    const token = await this.sessions.create(label);
    if (auth.pairingPending) {
      await this.settings.update((s) => ({ ...s, auth: { ...auth, pairingPending: false } }));
      this.pairingPinValue = null;
      this.emit('pairingChange');
      this.log.info('Appairage terminé');
    }
    this.log.info({ ip, label }, 'Nouvelle session');
    return { ok: true, token };
  }

  authenticate(token: string | undefined): boolean {
    return this.sessions.validate(token);
  }

  logout(token: string): Promise<void> {
    return this.sessions.revoke(token);
  }
}
