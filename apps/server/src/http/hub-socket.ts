import { HEARTBEAT_INTERVAL_MS, WS_PATH } from '@11tv/shared';
import { clientMessageSchema } from '@11tv/shared/schemas';
import type { FastifyInstance, preValidationAsyncHookHandler } from 'fastify';
import type { RawData } from 'ws';
import { BrowserUnavailableError } from '../browser/browser-controller';
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
export function registerHubSocket(
  app: FastifyInstance,
  hub: StateHub,
  role: ClientRole,
  preValidation?: preValidationAsyncHookHandler,
): void {
  app.get(
    WS_PATH,
    { websocket: true, ...(preValidation ? { preValidation } : {}) },
    (socket, req) => {
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
        alive = false;
        socket.ping();
        client.send({ type: 'heartbeat' });
      }, HEARTBEAT_INTERVAL_MS);

      socket.on('message', (data) => {
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
          if (err instanceof BrowserUnavailableError) {
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
