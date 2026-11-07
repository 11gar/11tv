import { describe, expect, it } from 'vitest';
import { destinationFor } from './browser-destination';

describe('destinationFor', () => {
  it('ouvre les adresses telles quelles, en https par défaut', () => {
    expect(destinationFor('twitch.tv')).toBe('https://twitch.tv');
    expect(destinationFor('  www.lemonde.fr/international ')).toBe(
      'https://www.lemonde.fr/international',
    );
    expect(destinationFor('http://192.168.1.10:8123')).toBe('http://192.168.1.10:8123');
    expect(destinationFor('localhost:3000')).toBe('https://localhost:3000');
  });

  it('cherche sur Google le reste', () => {
    expect(destinationFor('météo paris')).toBe(
      'https://www.google.com/search?q=m%C3%A9t%C3%A9o%20paris',
    );
    expect(destinationFor('chats')).toBe('https://www.google.com/search?q=chats');
  });

  it('ne fait rien sans texte', () => {
    expect(destinationFor('   ')).toBeNull();
  });
});
