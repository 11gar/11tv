import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import Fastify from 'fastify';
import type { AppConfig } from '../config';
import type { StateHub } from '../hub/state-hub';
import { fastifyLogging, type Logger } from '../log';
import { WALLPAPER_ROUTE } from '../wallpapers/library';
import { addSecurityHeaders, restrictToLoopback, serveSpa } from './common';
import { registerHubSocket } from './hub-socket';

/**
 * Serveur de l'écran TV, en HTTP sur 127.0.0.1 uniquement : seul Edge, sur la même
 * machine, y accède. Pas de PIN ici, et localhost est un contexte sécurisé pour le navigateur.
 */
export async function buildTvApp(config: AppConfig, log: Logger, hub: StateHub) {
  const app = Fastify(fastifyLogging(log, 'tv'));

  restrictToLoopback(app);
  addSecurityHeaders(app);
  await app.register(fastifyWebsocket, { options: { maxPayload: 64 * 1024 } });

  await app.register(fastifyStatic, {
    root: config.paths.wallpapers,
    prefix: WALLPAPER_ROUTE,
    decorateReply: false,
    maxAge: '1h',
  });

  registerHubSocket(app, hub, 'tv');
  await serveSpa(app, config.paths.tvDist, 'TV');

  return app;
}
