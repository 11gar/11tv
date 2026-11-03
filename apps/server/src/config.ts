import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';

const boolish = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

const port = z.coerce.number().int().min(1).max(65_535);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  ELEVENTV_DATA_DIR: z.string().min(1).optional(),
  ELEVENTV_HTTPS_PORT: port.default(8443),
  ELEVENTV_TV_PORT: port.default(8080),
  ELEVENTV_SETUP_PORT: port.default(8081),
  ELEVENTV_EDGE_PATH: z
    .string()
    .default('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'),
  ELEVENTV_EDGE_LAUNCH: boolish.default(true),
  ELEVENTV_EDGE_KIOSK: boolish.default(true),
  ELEVENTV_EDGE_DEBUG_PORT: port.default(9222),
  ELEVENTV_HOSTNAME: z.string().min(1).optional(),
  ELEVENTV_LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export interface AppConfig {
  env: 'development' | 'production' | 'test';
  logLevel: string;
  /** Nom mDNS inclus dans le certificat, ex. « 11tv.local ». */
  hostname: string;
  ports: { https: number; tv: number; setup: number };
  paths: {
    data: string;
    settings: string;
    sessions: string;
    wallpapers: string;
    certs: string;
    logs: string;
    edgeProfile: string;
    tvDist: string;
    mobileDist: string;
  };
  edge: {
    executable: string;
    launch: boolean;
    kiosk: boolean;
    debugPort: number;
  };
}

/** Racine du dépôt, que le code tourne depuis src/ (tsx) ou dist/ (bundle). */
const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');

/** Charge le fichier .env à la racine du dépôt s'il existe (jamais versionné). */
export function loadDotEnv(): void {
  const file = path.join(repoRoot, '.env');
  if (existsSync(file)) process.loadEnvFile(file);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')} : ${issue.message}`)
      .join('\n');
    throw new Error(`Configuration invalide :\n${details}`);
  }
  const e = parsed.data;

  const defaultDataDir = path.join(env.LOCALAPPDATA ?? os.homedir(), '11TV');
  const data = path.resolve(repoRoot, e.ELEVENTV_DATA_DIR ?? defaultDataDir);

  return {
    env: e.NODE_ENV,
    logLevel: e.ELEVENTV_LOG_LEVEL,
    hostname: (e.ELEVENTV_HOSTNAME ?? `${os.hostname()}.local`).toLowerCase(),
    ports: { https: e.ELEVENTV_HTTPS_PORT, tv: e.ELEVENTV_TV_PORT, setup: e.ELEVENTV_SETUP_PORT },
    paths: {
      data,
      settings: path.join(data, 'settings.json'),
      sessions: path.join(data, 'sessions.json'),
      wallpapers: path.join(data, 'wallpapers'),
      certs: path.join(data, 'certs'),
      logs: path.join(data, 'logs'),
      edgeProfile: path.join(data, 'edge-profile'),
      tvDist: path.join(repoRoot, 'apps', 'tv', 'dist'),
      mobileDist: path.join(repoRoot, 'apps', 'mobile', 'dist'),
    },
    edge: {
      executable: e.ELEVENTV_EDGE_PATH,
      launch: e.ELEVENTV_EDGE_LAUNCH,
      kiosk: e.ELEVENTV_EDGE_KIOSK,
      debugPort: e.ELEVENTV_EDGE_DEBUG_PORT,
    },
  };
}
