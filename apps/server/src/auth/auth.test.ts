import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import pino from 'pino';
import { beforeEach, describe, expect, it } from 'vitest';
import { SettingsService } from '../settings/settings';
import { AuthService } from './auth-service';
import { generatePin, hashPin, isValidPin, verifyPin } from './pin';
import { LoginLimiter } from './rate-limit';
import { SessionStore } from './sessions';

const log = pino({ level: 'silent' });

describe('pin', () => {
  it('génère des PIN valides de 6 chiffres', () => {
    for (let i = 0; i < 20; i++) {
      const pin = generatePin();
      expect(pin).toMatch(/^\d{6}$/);
      expect(isValidPin(pin)).toBe(true);
    }
  });

  it('vérifie le bon PIN et rejette les autres', async () => {
    const stored = await hashPin('482913');
    expect(await verifyPin('482913', stored)).toBe(true);
    expect(await verifyPin('482914', stored)).toBe(false);
    expect(await verifyPin('482913', 'format-inconnu')).toBe(false);
  });

  it('refuse de hacher un PIN invalide', async () => {
    await expect(hashPin('12')).rejects.toThrow();
    await expect(hashPin('abcd')).rejects.toThrow();
  });
});

describe('LoginLimiter', () => {
  it('bloque après le nombre d’échecs autorisé, de plus en plus longtemps', () => {
    let now = 0;
    const limiter = new LoginLimiter(
      { maxAttempts: 3, baseLockMs: 1000, maxLockMs: 3000 },
      () => now,
    );

    for (let i = 0; i < 3; i++) {
      expect(limiter.check('ip').allowed).toBe(true);
      limiter.recordFailure('ip');
    }
    expect(limiter.check('ip')).toEqual({ allowed: false, retryAfterMs: 1000 });

    now = 1000;
    expect(limiter.check('ip').allowed).toBe(true);
    for (let i = 0; i < 3; i++) limiter.recordFailure('ip');
    expect(limiter.check('ip')).toEqual({ allowed: false, retryAfterMs: 2000 });

    now = 3000;
    for (let i = 0; i < 3; i++) limiter.recordFailure('ip');
    // Plafonné à maxLockMs.
    expect(limiter.check('ip')).toEqual({ allowed: false, retryAfterMs: 3000 });
  });

  it('remet le compteur à zéro après un succès et isole les clés', () => {
    const limiter = new LoginLimiter(
      { maxAttempts: 2, baseLockMs: 1000, maxLockMs: 1000 },
      () => 0,
    );
    limiter.recordFailure('a');
    limiter.recordSuccess('a');
    limiter.recordFailure('a');
    expect(limiter.check('a').allowed).toBe(true);
    limiter.recordFailure('b');
    limiter.recordFailure('b');
    expect(limiter.check('b').allowed).toBe(false);
    expect(limiter.check('a').allowed).toBe(true);
  });
});

describe('SessionStore', () => {
  let file: string;
  beforeEach(async () => {
    file = path.join(await mkdtemp(path.join(os.tmpdir(), '11tv-sessions-')), 'sessions.json');
  });

  it('valide un jeton créé et le retrouve après rechargement', async () => {
    const store = await SessionStore.load(file, 10_000, log);
    const token = await store.create('test');
    expect(store.validate(token)).toBe(true);
    expect(store.validate('autre')).toBe(false);
    expect(store.validate(undefined)).toBe(false);

    const reloaded = await SessionStore.load(file, 10_000, log);
    expect(reloaded.validate(token)).toBe(true);
  });

  it('expire les sessions inactives, avec expiration glissante', async () => {
    let now = 0;
    const store = await SessionStore.load(file, 1000, log, () => now);
    const token = await store.create('test');
    now = 900;
    expect(store.validate(token)).toBe(true);
    now = 1800; // 900 ms après la dernière activité : toujours valide
    expect(store.validate(token)).toBe(true);
    now = 2900;
    expect(store.validate(token)).toBe(false);
  });

  it('révoque une session', async () => {
    const store = await SessionStore.load(file, 10_000, log);
    const token = await store.create('test');
    await store.revoke(token);
    expect(store.validate(token)).toBe(false);
  });
});

describe('AuthService', () => {
  async function setup() {
    const dir = await mkdtemp(path.join(os.tmpdir(), '11tv-auth-'));
    const settings = await SettingsService.load(path.join(dir, 'settings.json'), log);
    const sessions = await SessionStore.load(path.join(dir, 'sessions.json'), 10_000, log);
    const limiter = () =>
      new LoginLimiter({ maxAttempts: 3, baseLockMs: 60_000, maxLockMs: 60_000 });
    const auth = new AuthService(settings, sessions, limiter(), limiter(), log);
    await auth.init();
    return { auth, settings, dir, limiter };
  }

  it('rouvre l’appairage après déconnexion ; le code et le PIN fonctionnent', async () => {
    const { auth } = await setup();
    const pin = auth.pairingPin!;
    const session = await auth.login(pin, '192.168.1.20', 't');
    if (!session.ok) throw new Error('connexion impossible');
    expect(auth.pairingPin).toBeNull();

    let changes = 0;
    auth.on('pairingChange', () => changes++);
    await auth.logout(session.token);
    const code = auth.pairingPin;
    expect(code).toMatch(/^\d{6}$/);
    expect(changes).toBe(1);

    const viaCode = await auth.login(code!, '192.168.1.20', 't');
    expect(viaCode.ok).toBe(true);
    expect(auth.pairingPin).toBeNull();
    // Le code est à usage unique, le PIN reste valable
    if (code !== pin) expect((await auth.login(code!, '192.168.1.21', 't')).ok).toBe(false);
    expect((await auth.login(pin, '192.168.1.21', 't')).ok).toBe(true);
  });

  it('affiche un code au démarrage s’il ne reste aucune session', async () => {
    const { auth, settings, dir, limiter } = await setup();
    await auth.login(auth.pairingPin!, '192.168.1.20', 't');
    const empty = await SessionStore.load(path.join(dir, 'other.json'), 10_000, log);
    const restarted = new AuthService(settings, empty, limiter(), limiter(), log);
    await restarted.init();
    expect(restarted.pairingPin).toMatch(/^\d{6}$/);
  });

  it('le code d’appairage ne permet pas de changer le PIN', async () => {
    const { auth } = await setup();
    const pin = auth.pairingPin!;
    const session = await auth.login(pin, '192.168.1.20', 't');
    if (!session.ok) throw new Error('connexion impossible');
    await auth.logout(session.token);
    const code = auth.pairingPin!;
    if (code === pin) return;
    expect(await auth.changePin(code, '2468', '192.168.1.20', 't')).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('génère un PIN d’appairage au premier démarrage, puis le retire après connexion', async () => {
    const { auth, settings } = await setup();
    const pin = auth.pairingPin;
    expect(pin).toMatch(/^\d{6}$/);
    expect(settings.get().auth?.pairingPending).toBe(true);

    const result = await auth.login(pin!, '192.168.1.20', 'téléphone');
    expect(result.ok).toBe(true);
    expect(auth.pairingPin).toBeNull();
    expect(settings.get().auth?.pairingPending).toBe(false);
    if (result.ok) expect(auth.authenticate(result.token)).toBe(true);
  });

  it('bloque une adresse après trop d’échecs, même avec le bon PIN', async () => {
    const { auth } = await setup();
    const pin = auth.pairingPin!;
    const wrong = pin === '000000' ? '111111' : '000000';
    for (let i = 0; i < 3; i++) {
      expect(await auth.login(wrong, '192.168.1.20', 't')).toEqual({
        ok: false,
        reason: 'invalid',
      });
    }
    const locked = await auth.login(pin, '192.168.1.20', 't');
    expect(locked).toMatchObject({ ok: false, reason: 'locked' });
  });

  it('change le PIN, révoque toutes les sessions et en rouvre une pour l’appelant', async () => {
    const { auth } = await setup();
    const pin = auth.pairingPin!;
    const other = await auth.login(pin, '192.168.1.21', 'autre téléphone');
    if (!other.ok) throw new Error('connexion impossible');

    const wrong = await auth.changePin(
      pin === '0000' ? '1111' : '0000',
      '2468',
      '192.168.1.20',
      't',
    );
    expect(wrong).toEqual({ ok: false, reason: 'invalid' });

    const changed = await auth.changePin(pin, '2468', '192.168.1.20', 't');
    expect(changed.ok).toBe(true);
    expect(auth.authenticate(other.token)).toBe(false);
    if (changed.ok) expect(auth.authenticate(changed.token)).toBe(true);

    expect((await auth.login(pin, '192.168.1.22', 't')).ok).toBe(false);
    expect((await auth.login('2468', '192.168.1.22', 't')).ok).toBe(true);
  });
});
