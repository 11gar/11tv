import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import fastifyWebsocket from '@fastify/websocket';
import {
  WALLPAPER_MAX_BYTES,
  type ChangePinResponse,
  type LoginResponse,
  type SessionResponse,
  type UploadWallpaperResponse,
} from '@11tv/shared';
import { changePinRequestSchema, loginRequestSchema } from '@11tv/shared/schemas';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { createReadStream } from 'node:fs';
import type { AuthService, LoginResult } from '../auth/auth-service';
import type { AppConfig } from '../config';
import type { StateHub } from '../hub/state-hub';
import { fastifyLogging, type Logger } from '../log';
import { normalizeAddress } from '../net/addresses';
import { InvalidImageError, type WallpaperManager } from '../wallpapers/manager';
import { addSecurityHeaders, restrictToPrivateNetwork, serveSpa } from './common';
import { registerHubSocket } from './hub-socket';

/** Préfixe __Host- : cookie Secure, sans Domain, limité à ce serveur. */
export const SESSION_COOKIE = '__Host-11tv-session';
const SESSION_TTL_SEC = 90 * 24 * 60 * 60;
const COOKIE_OPTIONS = { path: '/', httpOnly: true, secure: true, sameSite: 'strict' } as const;

export interface LanAppDeps {
  config: AppConfig;
  log: Logger;
  hub: StateHub;
  auth: AuthService;
  wallpapers: WallpaperManager;
  tls: { key: string; cert: string };
}

/**
 * Protection contre les requêtes inter-sites : l'en-tête Origin doit correspondre à l'hôte.
 * En développement, le serveur Vite (localhost) relaie les requêtes du téléphone.
 */
function isSameOrigin(req: FastifyRequest, dev: boolean): boolean {
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    const { host, hostname } = new URL(origin);
    return (
      host === req.headers.host || (dev && (hostname === 'localhost' || hostname === '127.0.0.1'))
    );
  } catch {
    return false;
  }
}

function sessionLabel(req: FastifyRequest): string {
  return (req.headers['user-agent'] ?? 'inconnu').slice(0, 120);
}

/** Réponse commune à la connexion et au changement de PIN (pose le cookie en cas de succès). */
function replyWithSession(reply: FastifyReply, result: LoginResult) {
  if (!result.ok) {
    const { ok, reason, retryAfterSec } = result;
    return reply
      .code(reason === 'locked' ? 429 : 401)
      .send({ ok, reason, ...(retryAfterSec ? { retryAfterSec } : {}) } satisfies LoginResponse);
  }
  reply.setCookie(SESSION_COOKIE, result.token, { ...COOKIE_OPTIONS, maxAge: SESSION_TTL_SEC });
  return reply.send({ ok: true } satisfies LoginResponse);
}

/** Serveur HTTPS du téléphone, exposé au réseau local et protégé par le PIN. */
export async function buildLanApp({ config, log, hub, auth, wallpapers, tls }: LanAppDeps) {
  const dev = config.env === 'development';
  const app = Fastify({
    ...fastifyLogging(log, 'telephone'),
    https: { key: tls.key, cert: tls.cert },
    bodyLimit: 64 * 1024,
  });

  restrictToPrivateNetwork(app);
  addSecurityHeaders(app);
  await app.register(fastifyCookie);
  await app.register(fastifyWebsocket, { options: { maxPayload: 64 * 1024 } });
  await app.register(fastifyMultipart, {
    limits: { fileSize: WALLPAPER_MAX_BYTES, files: 1, fields: 0 },
  });

  const requireSession = async (req: FastifyRequest, reply: FastifyReply) => {
    if (!isSameOrigin(req, dev)) return reply.code(403).send({ error: 'Origine refusée' });
    if (!auth.authenticate(req.cookies[SESSION_COOKIE])) {
      return reply.code(401).send({ error: 'Non authentifié' });
    }
  };

  // --- Authentification -------------------------------------------------------------

  app.post('/api/auth/login', async (req, reply) => {
    if (!isSameOrigin(req, dev)) return reply.code(403).send();
    const body = loginRequestSchema.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ ok: false, reason: 'invalid' } satisfies LoginResponse);
    }
    const result = await auth.login(body.data.pin, normalizeAddress(req.ip), sessionLabel(req));
    return replyWithSession(reply, result);
  });

  app.get('/api/auth/session', (req, reply) =>
    reply.send({
      authenticated: auth.authenticate(req.cookies[SESSION_COOKIE]),
    } satisfies SessionResponse),
  );

  app.post('/api/auth/logout', { preValidation: requireSession }, async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) await auth.logout(token);
    reply.clearCookie(SESSION_COOKIE, COOKIE_OPTIONS);
    return { ok: true };
  });

  app.post('/api/auth/pin', { preValidation: requireSession }, async (req, reply) => {
    const body = changePinRequestSchema.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ ok: false, reason: 'invalid' } satisfies ChangePinResponse);
    }
    const { current, next } = body.data;
    const result = await auth.changePin(current, next, normalizeAddress(req.ip), sessionLabel(req));
    return replyWithSession(reply, result);
  });

  // --- Fonds d'écran ------------------------------------------------------------------

  app.post('/api/wallpapers', { preValidation: requireSession }, async (req, reply) => {
    let buffer: Buffer;
    try {
      const file = await req.file();
      if (!file) {
        return await reply
          .code(400)
          .send({ ok: false, message: 'Aucun fichier reçu' } satisfies UploadWallpaperResponse);
      }
      buffer = await file.toBuffer();
    } catch (err) {
      req.log.warn({ err }, 'Envoi de fond d’écran refusé');
      const message = `Fichier trop volumineux (${String(WALLPAPER_MAX_BYTES / 1024 / 1024)} Mo maximum)`;
      return reply.code(413).send({ ok: false, message } satisfies UploadWallpaperResponse);
    }
    try {
      const wallpaper = await wallpapers.add(buffer);
      return { ok: true, wallpaper } satisfies UploadWallpaperResponse;
    } catch (err) {
      if (!(err instanceof InvalidImageError)) throw err;
      return reply
        .code(415)
        .send({ ok: false, message: err.message } satisfies UploadWallpaperResponse);
    }
  });

  app.get<{ Params: { id: string } }>(
    '/api/wallpapers/:id/thumb',
    { preValidation: requireSessionForImages },
    async (req, reply) => {
      if (!wallpapers.exists(req.params.id)) return reply.code(404).send();
      const file = await wallpapers.thumbnail(req.params.id);
      return reply
        .type('image/webp')
        .header('Cache-Control', 'private, max-age=3600')
        .send(createReadStream(file));
    },
  );

  /** Les balises <img> n'envoient pas d'en-tête Origin : seul le cookie (SameSite) compte. */
  async function requireSessionForImages(req: FastifyRequest, reply: FastifyReply) {
    if (!auth.authenticate(req.cookies[SESSION_COOKIE])) return reply.code(401).send();
  }

  // Session revérifiée à chaque heartbeat : un téléphone révoqué (PIN changé) est coupé.
  registerHubSocket(app, hub, 'remote', {
    preValidation: requireSession,
    stillAuthorized: (req) => auth.authenticate(req.cookies[SESSION_COOKIE]),
  });
  await serveSpa(app, config.paths.mobileDist, 'mobile');

  return app;
}

export type LanApp = Awaited<ReturnType<typeof buildLanApp>>;
