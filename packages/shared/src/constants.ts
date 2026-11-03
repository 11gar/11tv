/** Bornes du délai de défilement des fonds d'écran, en secondes. */
export const SLIDE_INTERVAL_MIN_SEC = 5;
export const SLIDE_INTERVAL_MAX_SEC = 3600;
export const SLIDE_INTERVAL_DEFAULT_SEC = 30;

/** Un PIN est composé de 4 à 8 chiffres. */
export const PIN_PATTERN = /^\d{4,8}$/;

/** Intervalle des messages « heartbeat » envoyés par le serveur sur le WebSocket. */
export const HEARTBEAT_INTERVAL_MS = 15_000;

/** Au-delà de ce silence, le client considère la connexion morte et se reconnecte. */
export const HEARTBEAT_TIMEOUT_MS = 40_000;

export const WS_PATH = '/ws';
