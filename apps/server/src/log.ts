import { LogController, type FastifyBaseLogger } from 'fastify';
import path from 'node:path';
import pino, { type Logger } from 'pino';
import pretty from 'pino-pretty';
import type { AppConfig } from './config';

export type { Logger };

/**
 * Options de journalisation d'une instance Fastify : logger enfant, sans une ligne par requête
 * (la TV charge beaucoup d'images). Le logger est typé `FastifyBaseLogger` : un `Logger` pino
 * donnerait à l'instance un type générique incompatible avec `FastifyInstance`.
 */
export function fastifyLogging(log: Logger, server: string) {
  const loggerInstance: FastifyBaseLogger = log.child({ server });
  return { loggerInstance, logController: new LogController({ disableRequestLogging: true }) };
}

/**
 * Journaux lisibles dans la console en développement, JSON dans un fichier dans tous les cas
 * (logs/11tv.log), pour pouvoir diagnostiquer la Surface après coup.
 */
export function createLogger(config: AppConfig): Logger {
  const level = config.logLevel;
  const file = pino.destination({ dest: path.join(config.paths.logs, '11tv.log'), mkdir: true });
  const console =
    config.env === 'production'
      ? process.stdout
      : pretty({ colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' });

  return pino(
    { level, base: undefined, timestamp: pino.stdTimeFunctions.isoTime },
    pino.multistream([
      { level, stream: console },
      { level, stream: file },
    ]),
  );
}
