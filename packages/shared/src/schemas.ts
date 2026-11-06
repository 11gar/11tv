import { z } from 'zod';
import { PIN_PATTERN, SLIDE_INTERVAL_MAX_SEC, SLIDE_INTERVAL_MIN_SEC } from './constants';
import type { ChangePinRequest, ClientMessage, LoginRequest } from './messages';
import { MUSIC_ACTIONS, PLAYLIST_ID_PATTERN, VIDEO_ID_PATTERN } from './music';
import { MODULE_ID_PATTERN, MODULE_OPTION_KEY_PATTERN } from './modules';
import { POSTIT_COLORS, POSTIT_TEXT_MAX } from './postits';
import {
  MOUSE_BUTTONS,
  POINTER_DELTA_MAX,
  REMOTE_KEYS,
  TEXT_MAX_LENGTH,
  VOLUME_ACTIONS,
} from './remote';
import { SERVICE_IDS } from './services';

// Validation des entrées côté serveur. `satisfies` garantit que chaque schéma reste aligné
// avec le type déclaré dans ./messages.

const delta = z.number().int().min(-POINTER_DELTA_MAX).max(POINTER_DELTA_MAX);
const wallpaperId = z.string().min(1).max(200);
const pin = z.string().regex(PIN_PATTERN);

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('launch'), service: z.enum(SERVICE_IDS) }),
  z.object({ type: z.literal('home') }),
  z.object({ type: z.literal('history-back') }),
  z.object({ type: z.literal('key'), key: z.enum(REMOTE_KEYS) }),
  z.object({
    type: z.literal('text'),
    text: z.string().min(1).max(TEXT_MAX_LENGTH),
    submit: z.boolean(),
  }),
  z.object({ type: z.literal('pointer-move'), dx: delta, dy: delta }),
  z.object({ type: z.literal('pointer-click'), button: z.enum(MOUSE_BUTTONS) }),
  z.object({ type: z.literal('pointer-scroll'), dy: delta }),
  z.object({ type: z.literal('volume'), action: z.enum(VOLUME_ACTIONS) }),
  z.object({ type: z.literal('music'), action: z.enum(MUSIC_ACTIONS) }),
  z.object({
    type: z.literal('play-track'),
    videoId: z.string().regex(VIDEO_ID_PATTERN),
    playlistId: z.string().regex(PLAYLIST_ID_PATTERN).nullable(),
  }),
  z.object({
    type: z.literal('add-postit'),
    // Espaces et sauts de ligne en trop retirés ; un post-it vide est refusé.
    text: z.string().trim().min(1).max(POSTIT_TEXT_MAX),
    color: z.enum(POSTIT_COLORS),
  }),
  z.object({ type: z.literal('remove-postit'), id: z.string().min(1).max(64) }),
  z.object({ type: z.literal('clear-postits') }),
  z.object({
    type: z.literal('set-module-enabled'),
    id: z.string().regex(MODULE_ID_PATTERN),
    enabled: z.boolean(),
  }),
  // La valeur est revérifiée par le module : elle doit faire partie de ses choix.
  z.object({
    type: z.literal('set-module-option'),
    id: z.string().regex(MODULE_ID_PATTERN),
    key: z.string().regex(MODULE_OPTION_KEY_PATTERN),
    value: z.number(),
  }),
  z.object({
    type: z.literal('set-slide-interval'),
    seconds: z.number().int().min(SLIDE_INTERVAL_MIN_SEC).max(SLIDE_INTERVAL_MAX_SEC),
  }),
  z.object({ type: z.literal('delete-wallpaper'), id: wallpaperId }),
  z.object({ type: z.literal('reorder-wallpapers'), order: z.array(wallpaperId).max(1000) }),
]) satisfies z.ZodType<ClientMessage>;

export const loginRequestSchema = z.object({ pin }) satisfies z.ZodType<LoginRequest>;

export const changePinRequestSchema = z.object({ pin }) satisfies z.ZodType<ChangePinRequest>;
