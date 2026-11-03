export const RECONNECT_BASE_MS = 500;
export const RECONNECT_MAX_MS = 15_000;

/**
 * Délai avant la n-ième tentative de reconnexion : exponentiel, plafonné, avec une part
 * aléatoire (50 à 100 %) pour que la TV et le téléphone ne se reconnectent pas en rafale.
 */
export function reconnectDelay(attempt: number, random: () => number = Math.random): number {
  const ceiling = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** attempt);
  return Math.round(ceiling * (0.5 + random() / 2));
}
