import type { UpdateStatus } from '@11tv/shared';
import { spawn, type ChildProcess } from 'node:child_process';
import { closeSync, existsSync, openSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { AppConfig } from '../config';
import type { Logger } from '../log';

/** Code de sortie de update.ps1 quand il n'y a rien de nouveau à installer. */
export const UP_TO_DATE_EXIT_CODE = 3;

export interface UpdaterOptions {
  config: AppConfig;
  log: Logger;
  /** Remplaçable dans les tests. */
  spawnScript?: (script: string, logFile: number) => ChildProcess;
  platform?: NodeJS.Platform;
}

function spawnPowerShell(config: AppConfig) {
  return (script: string, logFile: number) =>
    spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script],
      {
        cwd: config.paths.repo,
        // Pas « detached » : PowerShell, lancé sans console, s'arrêterait sans rien faire.
        // Le script est donc arrêté avec ce serveur, ce qui est sans conséquence : arrêter
        // le serveur est sa dernière action.
        windowsHide: true,
        stdio: ['ignore', logFile, logFile],
      },
    );
}

/** Dernières lignes utiles du journal, pour expliquer un échec sur le téléphone. */
export function failureSummary(logText: string, maxLines = 6): string {
  const lines = logText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line && !/^[+~]|^Au caractère|^At line|CategoryInfo|FullyQualifiedErrorId/.test(line),
    );
  return lines.slice(-maxLines).join('\n') || 'Échec sans message.';
}

/**
 * Lance scripts/update.ps1 à la demande du téléphone : récupération du code, construction,
 * puis arrêt du serveur, que le lanceur relance avec la nouvelle version. Le script est
 * fixe et ne prend aucun paramètre venant du téléphone.
 */
export class Updater {
  private status: UpdateStatus;
  private readonly script: string;
  private readonly logPath: string;
  private readonly spawnScript: (script: string, logFile: number) => ChildProcess;

  constructor(private readonly options: UpdaterOptions) {
    const { config } = options;
    this.script = path.join(config.paths.repo, 'scripts', 'update.ps1');
    this.logPath = path.join(config.paths.logs, 'update.log');
    this.spawnScript = options.spawnScript ?? spawnPowerShell(config);
    const platform = options.platform ?? process.platform;
    if (platform !== 'win32') {
      this.status = { state: 'unavailable', message: 'Disponible uniquement sur la Surface.' };
    } else if (config.env === 'development') {
      this.status = { state: 'unavailable', message: 'Indisponible en développement.' };
    } else if (!existsSync(this.script)) {
      this.status = { state: 'unavailable', message: 'Script de mise à jour introuvable.' };
    } else {
      this.status = { state: 'idle' };
    }
  }

  get state(): UpdateStatus {
    return this.status;
  }

  /** Lance la mise à jour ; renvoie false si elle est indisponible ou déjà en cours. */
  start(): boolean {
    if (this.status.state === 'unavailable' || this.status.state === 'running') return false;
    const { log } = this.options;

    const logFile = openSync(this.logPath, 'w');
    let child: ChildProcess;
    try {
      child = this.spawnScript(this.script, logFile);
    } finally {
      closeSync(logFile); // Le processus enfant garde sa propre copie.
    }
    this.status = { state: 'running', startedAt: Date.now() };
    log.info({ pid: child.pid }, 'Mise à jour lancée depuis le téléphone');

    child.on('error', (err) => {
      log.error({ err }, 'Mise à jour impossible à lancer');
      this.finish({ state: 'failed', finishedAt: Date.now(), message: err.message });
    });
    child.on('exit', (code) => {
      // Quand une nouvelle version est installée, ce serveur est arrêté avant d'arriver ici.
      if (code === UP_TO_DATE_EXIT_CODE) {
        log.info('Mise à jour : rien de nouveau');
        this.finish({ state: 'up-to-date', finishedAt: Date.now() });
        return;
      }
      const message =
        code === 0
          ? 'Nouvelle version construite, mais le serveur n’a pas été relancé : redémarrez la Surface.'
          : failureSummary(this.readLog());
      log.error({ code, message }, 'Mise à jour échouée');
      this.finish({ state: 'failed', finishedAt: Date.now(), message });
    });
    return true;
  }

  private finish(status: UpdateStatus) {
    if (this.status.state === 'running') this.status = status;
  }

  private readLog(): string {
    try {
      return readFileSync(this.logPath, 'utf8');
    } catch {
      return '';
    }
  }
}
