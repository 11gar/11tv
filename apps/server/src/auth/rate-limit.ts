export interface LimiterOptions {
  /** Échecs tolérés avant un blocage. */
  maxAttempts: number;
  /** Durée du premier blocage ; elle double à chaque blocage suivant. */
  baseLockMs: number;
  maxLockMs: number;
}

interface Entry {
  failures: number;
  locks: number;
  lockedUntil: number;
}

export type LimitCheck = { allowed: true } | { allowed: false; retryAfterMs: number };

/**
 * Limite les tentatives de PIN par clé (adresse IP, ou « * » pour un plafond global).
 * Après `maxAttempts` échecs, la clé est bloquée, de plus en plus longtemps.
 */
export class LoginLimiter {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly options: LimiterOptions,
    private readonly now: () => number = Date.now,
  ) {}

  check(key: string): LimitCheck {
    const entry = this.entries.get(key);
    const remaining = entry ? entry.lockedUntil - this.now() : 0;
    return remaining > 0 ? { allowed: false, retryAfterMs: remaining } : { allowed: true };
  }

  recordFailure(key: string): void {
    const entry = this.entries.get(key) ?? { failures: 0, locks: 0, lockedUntil: 0 };
    entry.failures += 1;
    if (entry.failures >= this.options.maxAttempts) {
      const duration = Math.min(this.options.maxLockMs, this.options.baseLockMs * 2 ** entry.locks);
      entry.lockedUntil = this.now() + duration;
      entry.locks += 1;
      entry.failures = 0;
    }
    this.entries.set(key, entry);
  }

  recordSuccess(key: string): void {
    this.entries.delete(key);
  }
}
