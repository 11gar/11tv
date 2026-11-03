// Types seulement : les schémas zod qui les valident vivent dans ./schemas, importé par le
// serveur uniquement, pour ne pas embarquer zod dans les interfaces web.
import type { RemoteKey, VolumeAction, MouseButton } from './remote';
import type { ServiceId } from './services';

// ---------------------------------------------------------------------------
// Client -> serveur (validé côté serveur)
// ---------------------------------------------------------------------------

export type ClientMessage =
  // Navigation entre l'accueil et les services
  | { type: 'launch'; service: ServiceId }
  | { type: 'home' }
  | { type: 'history-back' }
  // Télécommande
  | { type: 'key'; key: RemoteKey }
  | { type: 'text'; text: string; submit: boolean }
  | { type: 'pointer-move'; dx: number; dy: number }
  | { type: 'pointer-click'; button: MouseButton }
  | { type: 'pointer-scroll'; dy: number }
  | { type: 'volume'; action: VolumeAction }
  // Réglages
  | { type: 'set-slide-interval'; seconds: number }
  | { type: 'delete-wallpaper'; id: string }
  | { type: 'reorder-wallpapers'; order: string[] };

export type ClientMessageType = ClientMessage['type'];

// ---------------------------------------------------------------------------
// État partagé, poussé en entier à chaque changement (il reste petit)
// ---------------------------------------------------------------------------

/** Ce qu'affiche l'onglet principal d'Edge. */
export type View = 'home' | ServiceId | 'other';

export type BrowserStatus = 'starting' | 'ready' | 'unavailable';

export interface Wallpaper {
  /** Nom du fichier dans le dossier des fonds d'écran. */
  id: string;
  /** Image en taille réelle, servie à la TV. */
  url: string;
  /** Vignette, servie au téléphone. */
  thumbUrl: string;
}

export interface AppState {
  view: View;
  browser: BrowserStatus;
  slideIntervalSec: number;
  wallpapers: Wallpaper[];
  /** Faux si le pilote souris et volume de Windows n'est pas disponible. */
  pointerAvailable: boolean;
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
  pairing: PairingInfo | null;
}

export type ServerMessage<S extends AppState = AppState> =
  { type: 'state'; state: S } | { type: 'error'; message: string } | { type: 'heartbeat' };

// ---------------------------------------------------------------------------
// API HTTP
// ---------------------------------------------------------------------------

export interface LoginRequest {
  pin: string;
}

export type LoginResponse =
  { ok: true } | { ok: false; reason: 'invalid' | 'locked'; retryAfterSec?: number };

export interface SessionResponse {
  authenticated: boolean;
}

export interface ChangePinRequest {
  current: string;
  next: string;
}

export type ChangePinResponse = LoginResponse;

export type UploadWallpaperResponse =
  { ok: true; wallpaper: Wallpaper } | { ok: false; message: string };
