import { z } from 'zod';
import { PIN_PATTERN } from './constants';
import type { ClientMessage, LoginRequest } from './messages';
import { SERVICE_IDS } from './services';

// Validation des entrées côté serveur. `satisfies` garantit que chaque schéma reste aligné
// avec le type déclaré dans ./messages.

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('launch'), service: z.enum(SERVICE_IDS) }),
  z.object({ type: z.literal('home') }),
]) satisfies z.ZodType<ClientMessage>;

export const loginRequestSchema = z.object({
  pin: z.string().regex(PIN_PATTERN),
}) satisfies z.ZodType<LoginRequest>;
