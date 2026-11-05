/** Couleurs de papier proposées, dans l'ordre du sélecteur du téléphone. */
export const POSTIT_COLORS = ['yellow', 'pink', 'blue', 'green', 'orange'] as const;
export type PostItColor = (typeof POSTIT_COLORS)[number];

/** Post-it au plus sur la TV : en coller un de plus décolle le plus ancien. */
export const POSTIT_MAX = 6;
export const POSTIT_TEXT_MAX = 120;

export interface PostIt {
  id: string;
  text: string;
  color: PostItColor;
  /** Date de collage (ms) : ordre d'affichage, et le plus ancien part en premier. */
  createdAt: number;
}
