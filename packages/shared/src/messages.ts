// Types seulement : les schémas zod qui les valident vivent dans ./schemas, importé par le
// serveur uniquement, pour ne pas embarquer zod dans les interfaces web.
import type { TvCard } from './cards';
import type { ModuleInfo } from './modules';
import type { MusicAction, MusicState } from './music';
import type { PostIt, PostItColor } from './postits';
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
  // Musique
  | { type: 'music'; action: MusicAction }
  | { type: 'play-track'; videoId: string; playlistId: string | null }
  // Post-it
  | { type: 'add-postit'; text: string; color: PostItColor }
  | { type: 'remove-postit'; id: string }
  | { type: 'clear-postits' }
  // Réglages
  | { type: 'set-module-enabled'; id: string; enabled: boolean }
  | { type: 'set-slide-interval'; seconds: number }
  | { type: 'delete-wallpaper'; id: string }
  | { type: 'reorder-wallpapers'; order: string[] };

export type ClientMessageType = ClientMessage['type'];

// ---------------------------------------------------------------------------
// État partagé, poussé en entier à chaque changement (il reste petit)
// ---------------------------------------------------------------------------

/** Ce qu'affiche la TV : l'onglet principal d'Edge, ou YouTube Music quand il est devant. */
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
  music: MusicState;
  /** Post-it collés sur la TV, du plus ancien au plus récent (vide si le module est éteint). */
  postIts: PostIt[];
  /** Modules (Me'Mories, post-it…) et leur état, pour Réglages → Modules. */
  modules: ModuleInfo[];
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
  /** Cartes des modules externes : données personnelles, jamais envoyées au téléphone. */
  cards: TvCard[];
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

/** Nouveau PIN permanent ; la session du téléphone suffit, l'actuel n'est pas demandé. */
export interface ChangePinRequest {
  pin: string;
}

export type ChangePinResponse = LoginResponse;

export type UploadWallpaperResponse =
  { ok: true; wallpaper: Wallpaper } | { ok: false; message: string };

/**
 * Mise à jour lancée depuis le téléphone (scripts/update.ps1). Quand une nouvelle version
 * est installée, le serveur est arrêté puis relancé : l'état repart alors de « idle ».
 */
export type UpdateStatus =
  | { state: 'unavailable'; message: string }
  | { state: 'idle' }
  | { state: 'running'; startedAt: number }
  | { state: 'up-to-date'; finishedAt: number }
  | { state: 'failed'; finishedAt: number; message: string };
