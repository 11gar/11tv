// Cartes de la TV : chaque outil externe (Me'Mories, et les suivants) est un module isolé
// côté serveur (apps/server/src/cards/<module>) et côté TV (apps/tv/src/cards/<module>).
// Ce fichier n'en partage que la forme des données affichées.

/** Emplacement d'une carte sur l'écran d'accueil, de part et d'autre de l'horloge. */
export type CardSlot = 'left' | 'right';

interface CardBase<K extends string, D> {
  /** Identifiant du module, unique : sert de clé à l'affichage. */
  id: string;
  kind: K;
  slot: CardSlot;
  /** Dernières données reçues ; gardées en cas d'échec d'une actualisation. */
  data: D;
  /** Date de la dernière actualisation réussie (ms). */
  updatedAt: number;
  /** Échec de la dernière actualisation, à afficher discrètement. */
  error: string | null;
}

// --- Me'Mories : Todos à venir ------------------------------------------------------------

export interface MeMoriesTag {
  title: string;
  /** Couleur « #rrggbb » choisie dans Me'Mories. */
  color: string;
}

export interface MeMoriesTodo {
  id: string;
  title: string;
  /** Jour d'échéance « AAAA-MM-JJ » (jour civil, pas un instant). */
  dueDate: string;
  /** « toutes les semaines », « tous les 2 jours »… ; null hors série. */
  recurrence: string | null;
  postponeCount: number;
  tags: MeMoriesTag[];
}

export interface MeMoriesTodosData {
  /** Todos ouverts et datés, du plus urgent au plus lointain. */
  todos: MeMoriesTodo[];
}

export type MeMoriesTodosCard = CardBase<'me-mories-todos', MeMoriesTodosData>;

// --- Toutes les cartes ---------------------------------------------------------------------

/** Union de toutes les cartes : un nouveau module y ajoute la sienne. */
export type TvCard = MeMoriesTodosCard;
export type TvCardKind = TvCard['kind'];
