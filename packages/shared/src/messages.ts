// Types seulement : les schémas zod qui les valident vivent dans ./schemas, importé par le
// serveur uniquement, pour ne pas embarquer zod dans les interfaces web.
import type { ServiceId } from './services';

// ---------------------------------------------------------------------------
// Client -> serveur (validé côté serveur)
// ---------------------------------------------------------------------------

export type ClientMessage = { type: 'launch'; service: ServiceId } | { type: 'home' };

// ---------------------------------------------------------------------------
// État partagé, poussé en entier à chaque changement (il reste petit)
// ---------------------------------------------------------------------------

/** Ce qu'affiche l'onglet principal d'Edge. */
export type View = 'home' | ServiceId | 'other';

export type BrowserStatus = 'starting' | 'ready' | 'unavailable';

export interface Wallpaper {
  id: string;
  url: string;
}

export interface AppState {
  view: View;
  browser: BrowserStatus;
  slideIntervalSec: number;
}

export interface PairingInfo {
  /** PIN généré au premier démarrage, affiché uniquement sur la TV. */
  pin: string;
  appUrl: string;
  setupUrl: string;
  setupQrSvg: string;
  caFingerprint: string;
}

/** Vue réservée à l'écran TV (servi en local uniquement). */
export interface TvState extends AppState {
  wallpapers: Wallpaper[];
  pairing: PairingInfo | null;
}

export type ServerMessage<S extends AppState = AppState> =
  { type: 'state'; state: S } | { type: 'error'; message: string } | { type: 'heartbeat' };

// ---------------------------------------------------------------------------
// API HTTP d'authentification
// ---------------------------------------------------------------------------

export interface LoginRequest {
  pin: string;
}

export type LoginResponse =
  { ok: true } | { ok: false; reason: 'invalid' | 'locked'; retryAfterSec?: number };

export interface SessionResponse {
  authenticated: boolean;
}
