import type { CardSlot as Slot, TvCard, TvCardKind } from '@11tv/shared';
import type { ComponentType } from 'preact';
import { usePixelShift } from '../hooks/use-pixel-shift';
import { TodosCard } from './me-mories/TodosCard';

/**
 * Affichage de chaque type de carte : un module externe y ajoute son composant, rangé dans
 * son propre dossier (cards/<module>). Le typage impose un composant par carte de TvCard.
 */
const RENDERERS: { [K in TvCardKind]: ComponentType<{ card: Extract<TvCard, { kind: K }> }> } = {
  'me-mories-todos': TodosCard,
};

function CardView({ card }: { card: TvCard }) {
  const Renderer = RENDERERS[card.kind] as ComponentType<{ card: TvCard }>;
  return <Renderer card={card} />;
}

/** Colonne de cartes à un emplacement de l'écran (pour l'instant : à gauche). */
export function CardSlot({ slot, cards }: { slot: Slot; cards: readonly TvCard[] }) {
  const shift = usePixelShift();
  const here = cards.filter((card) => card.slot === slot);
  if (here.length === 0) return null;
  return (
    <aside class={`card-slot card-slot--${slot}`} style={{ transform: shift }}>
      {here.map((card) => (
        <CardView key={card.id} card={card} />
      ))}
    </aside>
  );
}
