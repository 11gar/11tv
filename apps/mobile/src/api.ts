import type { LoginResponse, SessionResponse } from '@11tv/shared';

export async function fetchSession(): Promise<boolean> {
  const res = await fetch('/api/auth/session', { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`Session : HTTP ${String(res.status)}`);
  return ((await res.json()) as SessionResponse).authenticated;
}

export async function login(pin: string): Promise<LoginResponse> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });
  if (res.status === 403) throw new Error('Requête refusée par le serveur');
  return (await res.json()) as LoginResponse;
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
}
