import type { MouseButton, RemoteKey, VolumeAction } from '@11tv/shared';
import type { BrowserController } from '../browser/browser-controller';
import type { InputDriver } from './input-driver';

/** Touches de la télécommande -> noms de touches Playwright. */
export const KEY_MAP: Record<RemoteKey, string> = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  ok: 'Enter',
  escape: 'Escape',
  space: 'Space',
  tab: 'Tab',
  'shift-tab': 'Shift+Tab',
  backspace: 'Backspace',
};

/**
 * Le trackpad du téléphone envoie des déplacements en pixels CSS ; la molette de Windows
 * compte 120 unités par cran. Un glissement de 60 px correspond donc à environ 2 crans.
 */
export const SCROLL_UNITS_PER_PX = 4;

/** Traduit les commandes de la télécommande en entrées clavier (CDP) et souris (système). */
export class RemoteControl {
  constructor(
    private readonly browser: BrowserController,
    private readonly input: InputDriver,
  ) {}

  get pointerAvailable(): boolean {
    return this.input.available;
  }

  key(key: RemoteKey): Promise<void> {
    return this.browser.pressKey(KEY_MAP[key]);
  }

  async text(text: string, submit: boolean): Promise<void> {
    await this.browser.insertText(text);
    if (submit) await this.browser.pressKey('Enter');
  }

  back(): Promise<void> {
    return this.browser.goBack();
  }

  move(dx: number, dy: number): void {
    this.input.moveMouse(dx, dy);
  }

  click(button: MouseButton): void {
    this.input.click(button);
  }

  /** dy positif = doigt vers le bas = contenu qui descend, comme sur un trackpad. */
  scroll(dy: number): void {
    this.input.scroll(-dy * SCROLL_UNITS_PER_PX);
  }

  volume(action: VolumeAction): void {
    this.input.volume(action);
  }
}
