import { LogController, type FastifyBaseLogger } from 'fastify';
import path from 'node:path';
import pino, { type Logger } from 'pino';
import pretty from 'pino-pretty';
import type { AppConfig } from './config';
import { rotateIfLarger } from './log-rotation';

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

const LOG_MAX_BYTES = 10 * 1024 * 1024;
const LOG_FILES_KEPT = 5;

export interface Logging {
  log: Logger;
  /** Fait tourner le fichier de journaux s'il est trop gros (à appeler régulièrement). */
  rotate: () => Promise<void>;
}

/**
 * Journaux lisibles dans la console en développement, JSON dans un fichier dans tous les cas
 * (logs/11tv.log, 10 Mo au plus, 5 anciens fichiers gardés), pour pouvoir diagnostiquer la
 * Surface après coup sans remplir le disque.
 */
export async function createLogger(config: AppConfig): Promise<Logging> {
  const level = config.logLevel;
  const filePath = path.join(config.paths.logs, '11tv.log');
  await rotateIfLarger(filePath, LOG_MAX_BYTES, LOG_FILES_KEPT);
  const file = pino.destination({ dest: filePath, mkdir: true });
  const console =
    config.env === 'production'
      ? process.stdout
      : pretty({ colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' });

  const log = pino(
    { level, base: undefined, timestamp: pino.stdTimeFunctions.isoTime },
    pino.multistream([
      { level, stream: console },
      { level, stream: file },
    ]),
  );
  return {
    log,
    rotate: async () => {
      if (await rotateIfLarger(filePath, LOG_MAX_BYTES, LOG_FILES_KEPT)) file.reopen();
    },
  };
}
