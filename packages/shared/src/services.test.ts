import { describe, expect, it } from 'vitest';
import { clientMessageSchema } from './schemas';
import { serviceForUrl } from './services';

describe('serviceForUrl', () => {
  it.each([
    ['https://www.youtube.com/watch?v=abc', 'youtube'],
    ['https://youtube.com/', 'youtube'],
    ['https://music.youtube.com/watch?v=abc', 'youtube-music'],
    ['https://www.disneyplus.com/fr-fr/home', 'disney-plus'],
    ['https://www.primevideo.com/region/eu/storefront', 'prime-video'],
    ['https://www.twitch.tv/directory', 'twitch'],
  ])('%s -> %s', (url, expected) => {
    expect(serviceForUrl(url)).toBe(expected);
  });

  it('ignore les domaines qui ne font que ressembler', () => {
    expect(serviceForUrl('https://notyoutube.com/')).toBeNull();
    expect(serviceForUrl('http://127.0.0.1:8080/')).toBeNull();
    expect(serviceForUrl('pas une url')).toBeNull();
  });
});

describe('clientMessageSchema', () => {
  it('accepte un lancement de service connu', () => {
    expect(clientMessageSchema.safeParse({ type: 'launch', service: 'youtube' }).success).toBe(
      true,
    );
  });

  it('refuse un service inconnu ou un type inconnu', () => {
    expect(clientMessageSchema.safeParse({ type: 'launch', service: 'netflix' }).success).toBe(
      false,
    );
    expect(clientMessageSchema.safeParse({ type: 'shutdown' }).success).toBe(false);
  });
});
