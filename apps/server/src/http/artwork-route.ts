import type { FastifyInstance, preValidationAsyncHookHandler } from 'fastify';
import { ARTWORK_ROUTE, type ArtworkProxy } from '../music/artwork';

/** Pochettes de YouTube Music, relayées pour la TV et le téléphone. */
export function registerArtworkRoute(
  app: FastifyInstance,
  artwork: ArtworkProxy,
  preValidation?: preValidationAsyncHookHandler,
): void {
  app.get<{ Params: { key: string } }>(
    `${ARTWORK_ROUTE}:key`,
    preValidation ? { preValidation } : {},
    async (req, reply) => {
      let image;
      try {
        image = await artwork.get(req.params.key);
      } catch (err) {
        req.log.warn({ err }, 'Pochette indisponible');
        return reply.code(502).send();
      }
      if (!image) return reply.code(404).send();
      // La clé dépend de l'URL d'origine : une même clé désigne toujours la même image.
      return reply
        .type(image.type)
        .header('Cache-Control', 'private, max-age=86400, immutable')
        .send(image.body);
    },
  );
}
