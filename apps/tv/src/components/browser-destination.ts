const HOST = /^(localhost|[\w-]+(\.[\w-]+)+)(:\d+)?([/?#].*)?$/i;

/**
 * Ce que l'on tape devient une adresse : « twitch.tv », « https://… » ou « localhost:3000 »
 * s'ouvrent tels quels (https par défaut), le reste part en recherche Google.
 */
export function destinationFor(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  if (/^https?:\/\//i.test(text)) return text;
  if (!/\s/.test(text) && HOST.test(text)) return `https://${text}`;
  return `https://www.google.com/search?q=${encodeURIComponent(text)}`;
}
