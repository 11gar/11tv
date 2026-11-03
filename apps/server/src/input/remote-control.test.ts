import { REMOTE_KEYS } from '@11tv/shared';
import { describe, expect, it } from 'vitest';
import { KEY_MAP } from './remote-control';

describe('KEY_MAP', () => {
  it('associe chaque touche de la télécommande à une touche clavier', () => {
    for (const key of REMOTE_KEYS) expect(KEY_MAP[key]).toBeTruthy();
  });
});
