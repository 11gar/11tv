import fastifyCookie from '@fastify/cookie';
import fastifyWebsocket from '@fastify/websocket';
import type { LoginResponse, SessionResponse } from '@11tv/shared';
import { loginRequestSchema } from '@11tv/shared/schemas';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import type { AuthService } from '../auth/auth-service';
import type { AppConfig } from '../config';
import type { StateHub } from '../hub/state-hub';
import { fastifyLogging, type Logger } from '../log';
import { normalizeAddress } from '../net/addresses';
import { addSecurityHeaders, restrictToPrivateNetwork, serveSpa } from './common';
import { registerHubSocket } from './hub-socket';

/** Préfixe __Host- : cookie Secure, sans Domain, limité à ce serveur. */
export const SESSION_COOKIE = '__Host-11tv-session';
const SESSION_TTL_SEC = 90 * 24 * 60 * 60;

export interface LanAppDeps {
  config: AppConfig;
  log: Logger;
  hub: StateHub;
  auth: AuthService;
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

/** Serveur HTTPS du téléphone, exposé au réseau local et protégé par le PIN. */
export async function buildLanApp({ config, log, hub, auth, tls }: LanAppDeps) {
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

  const requireSession = async (req: FastifyRequest, reply: FastifyReply) => {
    if (!isSameOrigin(req, dev)) return reply.code(403).send({ error: 'Origine refusée' });
    if (!auth.authenticate(req.cookies[SESSION_COOKIE])) {
      return reply.code(401).send({ error: 'Non authentifié' });
    }
  };

  app.post('/api/auth/login', async (req, reply): Promise<LoginResponse> => {
    if (!isSameOrigin(req, dev)) return reply.code(403).send();
    const body = loginRequestSchema.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ ok: false, reason: 'invalid' } satisfies LoginResponse);
    }
    const label = (req.headers['user-agent'] ?? 'inconnu').slice(0, 120);
    const result = await auth.login(body.data.pin, normalizeAddress(req.ip), label);
    if (!result.ok) {
      const { ok, reason, retryAfterSec } = result;
      return reply
        .code(reason === 'locked' ? 429 : 401)
        .send({ ok, reason, ...(retryAfterSec ? { retryAfterSec } : {}) } satisfies LoginResponse);
    }
    reply.setCookie(SESSION_COOKIE, result.token, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: SESSION_TTL_SEC,
    });
    return { ok: true };
  });

  app.get('/api/auth/session', (req, reply) =>
    reply.send({
      authenticated: auth.authenticate(req.cookies[SESSION_COOKIE]),
    } satisfies SessionResponse),
  );

  app.post('/api/auth/logout', { preValidation: requireSession }, async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) await auth.logout(token);
    reply.clearCookie(SESSION_COOKIE, {
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'strict',
    });
    return { ok: true };
  });

  registerHubSocket(app, hub, 'remote', requireSession);
  await serveSpa(app, config.paths.mobileDist, 'mobile');

  return app;
}

export type LanApp = Awaited<ReturnType<typeof buildLanApp>>;
