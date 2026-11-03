import { HEARTBEAT_INTERVAL_MS, WS_PATH } from '@11tv/shared';
import { clientMessageSchema } from '@11tv/shared/schemas';
import type { FastifyInstance, FastifyRequest, preValidationAsyncHookHandler } from 'fastify';
import type { RawData } from 'ws';
import { UserFacingError } from '../errors';
import type { ClientRole, HubClient, StateHub } from '../hub/state-hub';

function decode(data: RawData): string {
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
  return (data instanceof ArrayBuffer ? Buffer.from(data) : data).toString('utf8');
}

/**
 * WebSocket relié au hub. Le serveur envoie un ping de protocole (pour détecter les clients
 * morts) et un message « heartbeat » (pour que le client détecte un serveur muet, les pings
 * de protocole étant invisibles côté navigateur).
 */
export interface HubSocketAuth {
  /** Vérifié avant l'ouverture de la connexion. */
  preValidation: preValidationAsyncHookHandler;
  /** Revérifié à chaque message et à chaque heartbeat (session révoquée entre-temps). */
  stillAuthorized: (req: FastifyRequest) => boolean;
}

/** Code de fermeture applicatif : session révoquée. */
const CLOSE_UNAUTHORIZED = 4401;

export function registerHubSocket(
  app: FastifyInstance,
  hub: StateHub,
  role: ClientRole,
  auth?: HubSocketAuth,
): void {
  app.get(
    WS_PATH,
    { websocket: true, ...(auth ? { preValidation: auth.preValidation } : {}) },
    (socket, req) => {
      const authorized = () => {
        if (!auth || auth.stillAuthorized(req)) return true;
        log.info('Session révoquée, connexion fermée');
        socket.close(CLOSE_UNAUTHORIZED, 'Session révoquée');
        return false;
      };
      const log = req.log.child({ ws: role });
      const client: HubClient = {
        role,
        send(message) {
          if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
        },
      };
      const remove = hub.addClient(client);
      log.debug('Client connecté');

      let alive = true;
      socket.on('pong', () => {
        alive = true;
      });
      const heartbeat = setInterval(() => {
        if (!alive) {
          log.debug('Client muet, connexion fermée');
          socket.terminate();
          return;
        }
        if (!authorized()) return;
        alive = false;
        socket.ping();
        client.send({ type: 'heartbeat' });
      }, HEARTBEAT_INTERVAL_MS);

      socket.on('message', (data) => {
        if (!authorized()) return;
        let parsed: unknown;
        try {
          parsed = JSON.parse(decode(data));
        } catch {
          parsed = undefined;
        }
        const message = clientMessageSchema.safeParse(parsed);
        if (!message.success) {
          client.send({ type: 'error', message: 'Message invalide' });
          return;
        }
        hub.handle(message.data).catch((err: unknown) => {
          if (err instanceof UserFacingError) {
            client.send({ type: 'error', message: err.message });
            return;
          }
          log.error({ err, message: message.data }, 'Commande en échec');
          client.send({ type: 'error', message: 'La commande a échoué' });
        });
      });

      socket.on('close', () => {
        clearInterval(heartbeat);
        remove();
        log.debug('Client déconnecté');
      });
    },
  );
}
