const DISPLAY_MODES = ['fullscreen', 'standalone', 'minimal-ui', 'browser'] as const;

/**
 * Mode d'affichage qu'Android applique réellement à l'application installée. Le manifeste
 * demande le plein écran, mais Android peut en décider autrement selon l'installation.
 */
export function displayMode(): string {
  return DISPLAY_MODES.find((m) => window.matchMedia(`(display-mode: ${m})`).matches) ?? 'inconnu';
}
