export const SERVICE_IDS = ['youtube', 'youtube-music', 'disney-plus', 'prime-video'] as const;

export type ServiceId = (typeof SERVICE_IDS)[number];

export interface ServiceDefinition {
  id: ServiceId;
  name: string;
  url: string;
  /** Domaines rattachés au service (sous-domaines inclus). */
  domains: readonly string[];
  /** Couleur d'accent des tuiles. */
  accent: string;
}

export const SERVICES: readonly ServiceDefinition[] = [
  {
    id: 'youtube',
    name: 'YouTube',
    url: 'https://www.youtube.com/',
    domains: ['youtube.com'],
    accent: '#ff3d3d',
  },
  {
    id: 'youtube-music',
    name: 'YouTube Music',
    url: 'https://music.youtube.com/',
    domains: ['music.youtube.com'],
    accent: '#ff5c8a',
  },
  {
    id: 'disney-plus',
    name: 'Disney+',
    url: 'https://www.disneyplus.com/',
    domains: ['disneyplus.com'],
    accent: '#3d7bff',
  },
  {
    id: 'prime-video',
    name: 'Prime Video',
    url: 'https://www.primevideo.com/',
    domains: ['primevideo.com'],
    accent: '#1fb5ff',
  },
];

export function getService(id: ServiceId): ServiceDefinition {
  const service = SERVICES.find((s) => s.id === id);
  if (!service) throw new Error(`Service inconnu : ${id}`);
  return service;
}

function matchesDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

/**
 * Retrouve le service correspondant à une URL. Le domaine le plus spécifique gagne,
 * pour que music.youtube.com soit YouTube Music et non YouTube.
 */
export function serviceForUrl(url: string): ServiceId | null {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  let best: { id: ServiceId; length: number } | null = null;
  for (const service of SERVICES) {
    for (const domain of service.domains) {
      if (matchesDomain(hostname, domain) && (!best || domain.length > best.length)) {
        best = { id: service.id, length: domain.length };
      }
    }
  }
  return best?.id ?? null;
}
