import type {
  ChangePinRequest,
  ChangePinResponse,
  LoginResponse,
  SessionResponse,
  UpdateStatus,
  UploadWallpaperResponse,
} from '@11tv/shared';

export async function fetchSession(): Promise<boolean> {
  const res = await fetch('/api/auth/session', { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`Session : HTTP ${String(res.status)}`);
  return ((await res.json()) as SessionResponse).authenticated;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 403) throw new Error('Requête refusée par le serveur');
  return (await res.json()) as T;
}

export function login(pin: string): Promise<LoginResponse> {
  return postJson('/api/auth/login', { pin });
}

export function changePin(request: ChangePinRequest): Promise<ChangePinResponse> {
  return postJson('/api/auth/pin', request);
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
}

export async function fetchUpdateStatus(): Promise<UpdateStatus> {
  const res = await fetch('/api/update', { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`Mise à jour : HTTP ${String(res.status)}`);
  return (await res.json()) as UpdateStatus;
}

/** Lance la mise à jour ; renvoie l'état (« running », ou la raison d'un refus). */
export async function startUpdate(): Promise<UpdateStatus> {
  const res = await fetch('/api/update', { method: 'POST', credentials: 'same-origin' });
  if (res.status !== 202 && res.status !== 409) {
    throw new Error(`Mise à jour : HTTP ${String(res.status)}`);
  }
  return (await res.json()) as UpdateStatus;
}

export async function uploadWallpaper(file: File): Promise<UploadWallpaperResponse> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/wallpapers', {
    method: 'POST',
    credentials: 'same-origin',
    body: form,
  });
  try {
    return (await res.json()) as UploadWallpaperResponse;
  } catch {
    return { ok: false, message: `Échec de l’envoi (HTTP ${String(res.status)})` };
  }
}
