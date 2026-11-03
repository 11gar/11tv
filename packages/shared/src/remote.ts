/** Touches de la télécommande, traduites en touches clavier par le serveur. */
export const REMOTE_KEYS = [
  'up',
  'down',
  'left',
  'right',
  'ok',
  'escape',
  'space',
  'tab',
  'shift-tab',
  'backspace',
] as const;

export type RemoteKey = (typeof REMOTE_KEYS)[number];

export const VOLUME_ACTIONS = ['up', 'down', 'mute'] as const;
export type VolumeAction = (typeof VOLUME_ACTIONS)[number];

export const MOUSE_BUTTONS = ['left', 'right'] as const;
export type MouseButton = (typeof MOUSE_BUTTONS)[number];

/** Limites des messages de la télécommande (validées par le serveur). */
export const TEXT_MAX_LENGTH = 500;
export const POINTER_DELTA_MAX = 2000;

/** Formats acceptés pour l'envoi de fonds d'écran (le HEIC n'est pas décodable par sharp). */
export const WALLPAPER_ACCEPT = 'image/jpeg,image/png,image/webp';
export const WALLPAPER_MAX_BYTES = 30 * 1024 * 1024;
