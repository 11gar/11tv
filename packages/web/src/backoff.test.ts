import { describe, expect, it } from 'vitest';
import { RECONNECT_BASE_MS, RECONNECT_MAX_MS, reconnectDelay } from './backoff';

describe('reconnectDelay', () => {
  it('double à chaque tentative', () => {
    const max = () => 1;
    expect(reconnectDelay(0, max)).toBe(RECONNECT_BASE_MS);
    expect(reconnectDelay(1, max)).toBe(RECONNECT_BASE_MS * 2);
    expect(reconnectDelay(3, max)).toBe(RECONNECT_BASE_MS * 8);
  });

  it('est plafonné', () => {
    expect(reconnectDelay(50, () => 1)).toBe(RECONNECT_MAX_MS);
  });

  it('garde au moins la moitié du délai avec la part aléatoire', () => {
    expect(reconnectDelay(2, () => 0)).toBe((RECONNECT_BASE_MS * 4) / 2);
  });
});
