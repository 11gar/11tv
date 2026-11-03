import fastifyStatic from '@fastify/static';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { isLoopbackAddress, isPrivateAddress } from '../net/addresses';

/** Refuse toute requête qui ne vient pas du réseau local. */
export function restrictToPrivateNetwork(app: FastifyInstance): void {
  app.addHook('onRequest', async (req, reply) => {
    if (isPrivateAddress(req.ip)) return;
    req.log.warn({ ip: req.ip }, 'Requête hors réseau local refusée');
    await reply.code(403).send();
  });
}

/** Refuse toute requête qui ne vient pas de la machine elle-même. */
export function restrictToLoopback(app: FastifyInstance): void {
  app.addHook('onRequest', async (req, reply) => {
    if (isLoopbackAddress(req.ip)) return;
    req.log.warn({ ip: req.ip }, 'Requête non locale refusée');
    await reply.code(403).send();
  });
}

const CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
].join('; ');

export function addSecurityHeaders(app: FastifyInstance): void {
  app.addHook('onSend', async (_req, reply) => {
    reply.header('Content-Security-Policy', CSP);
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
  });
}

/** Les fichiers à nom fixe doivent toujours être revalidés, les autres sont versionnés par Vite. */
const NO_CACHE_FILES = new Set(['index.html', 'sw.js', 'manifest.webmanifest', 'registerSW.js']);

/**
 * Sert une application construite par Vite, avec repli sur index.html pour les routes
 * côté client. Si le build est absent, une page explique comment le produire.
 */
export async function serveSpa(app: FastifyInstance, root: string, name: string): Promise<void> {
  if (!existsSync(path.join(root, 'index.html'))) {
    app.log.warn({ root }, `Interface ${name} non construite`);
    app.get('/', async (_req, reply) =>
      reply
        .type('text/html; charset=utf-8')
        .send(`<p>Interface ${name} non construite : lancez <code>pnpm build</code>.</p>`),
    );
    return;
  }

  await app.register(fastifyStatic, {
    root,
    wildcard: true,
    setHeaders(res, filePath) {
      const file = path.basename(filePath);
      res.setHeader(
        'Cache-Control',
        NO_CACHE_FILES.has(file) || file.startsWith('workbox-')
          ? 'no-cache'
          : 'public, max-age=31536000, immutable',
      );
    },
  });

  app.setNotFoundHandler(async (req: FastifyRequest, reply: FastifyReply) => {
    const isPage = req.method === 'GET' && (req.headers.accept ?? '').includes('text/html');
    if (isPage && !req.url.startsWith('/api/')) return reply.sendFile('index.html');
    return reply.code(404).send({ error: 'Introuvable' });
  });
}
