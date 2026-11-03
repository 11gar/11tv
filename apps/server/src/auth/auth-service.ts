import { timingSafeEqual } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { Logger } from '../log';
import type { SettingsService } from '../settings/settings';
import { generatePin, hashPin, verifyPin } from './pin';
import type { LoginLimiter } from './rate-limit';
import type { SessionStore } from './sessions';

export interface PinFailure {
  ok: false;
  reason: 'invalid' | 'locked';
  retryAfterSec?: number;
}

export type LoginResult = { ok: true; token: string } | PinFailure;

const GLOBAL_KEY = '*';

function sameCode(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * PIN, appairage et sessions.
 *
 * Au premier démarrage (aucun PIN), un PIN aléatoire est généré et affiché sur la TV jusqu'à
 * la première connexion réussie. Seule son empreinte est stockée : si le serveur redémarre
 * avant l'appairage, un nouveau PIN est généré.
 *
 * Ensuite, dès qu'aucun téléphone n'a de session (déconnexion, expiration), un code
 * d'appairage à usage unique est affiché sur la TV. Il est accepté en plus du PIN, qu'il ne
 * remplace pas, et n'existe qu'en mémoire. Voir la TV suffit donc toujours pour se reconnecter.
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
    if (auth && !auth.pairingPending) {
      this.openPairingIfNoSession();
      return;
    }
    const pin = generatePin();
    const pinHash = await hashPin(pin);
    await this.settings.update((s) => ({ ...s, auth: { pinHash, pairingPending: true } }));
    this.pairingPinValue = pin;
    this.log.info('Appairage en attente : le PIN est affiché sur la TV');
  }

  /** Code à afficher sur la TV tant qu'aucun téléphone n'est associé. */
  get pairingPin(): string | null {
    return this.pairingPinValue;
  }

  async login(pin: string, ip: string, label: string): Promise<LoginResult> {
    const check = await this.checkPin(pin, ip, true);
    if (!check.ok) return check;

    const token = await this.sessions.create(label);
    if (this.pairingPinValue !== null) {
      if (this.settings.get().auth?.pairingPending) {
        await this.settings.update((s) => ({
          ...s,
          auth: s.auth && { ...s.auth, pairingPending: false },
        }));
      }
      this.pairingPinValue = null;
      this.emit('pairingChange');
      this.log.info('Appairage terminé');
    }
    this.log.info({ ip, label }, 'Nouvelle session');
    return { ok: true, token };
  }

  /**
   * Change le PIN après vérification de l'actuel (soumise au même limiteur que la connexion).
   * Toutes les sessions sont révoquées ; une nouvelle est ouverte pour le téléphone appelant.
   */
  async changePin(current: string, next: string, ip: string, label: string): Promise<LoginResult> {
    const check = await this.checkPin(current, ip, false);
    if (!check.ok) return check;

    const pinHash = await hashPin(next);
    await this.settings.update((s) => ({ ...s, auth: { pinHash, pairingPending: false } }));
    await this.sessions.revokeAll();
    this.log.info({ ip }, 'PIN modifié, sessions révoquées');
    return { ok: true, token: await this.sessions.create(label) };
  }

  authenticate(token: string | undefined): boolean {
    const valid = this.sessions.validate(token);
    // Une session peut avoir expiré : sans téléphone associé, la TV doit proposer un code.
    if (!valid) this.openPairingIfNoSession();
    return valid;
  }

  async logout(token: string): Promise<void> {
    await this.sessions.revoke(token);
    this.openPairingIfNoSession();
  }

  private openPairingIfNoSession(): void {
    if (this.pairingPinValue !== null || this.sessions.count > 0) return;
    this.pairingPinValue = generatePin();
    this.emit('pairingChange');
    this.log.info('Aucun téléphone connecté : un code d’appairage est affiché sur la TV');
  }

  /** `allowPairing` : le code affiché sur la TV ouvre une session, mais ne change pas le PIN. */
  private async checkPin(
    pin: string,
    ip: string,
    allowPairing: boolean,
  ): Promise<{ ok: true } | PinFailure> {
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
    const pairing = allowPairing && this.pairingPinValue !== null;
    const valid =
      (pairing && sameCode(pin, this.pairingPinValue ?? '')) ||
      (auth != null && (await verifyPin(pin, auth.pinHash)));
    if (!valid) {
      this.ipLimiter.recordFailure(ip);
      this.globalLimiter.recordFailure(GLOBAL_KEY);
      this.log.warn({ ip }, 'PIN incorrect');
      return { ok: false, reason: 'invalid' };
    }
    this.ipLimiter.recordSuccess(ip);
    return { ok: true };
  }
}
