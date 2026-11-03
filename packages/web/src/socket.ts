import {
  HEARTBEAT_TIMEOUT_MS,
  WS_PATH,
  type AppState,
  type ClientMessage,
  type ServerMessage,
} from '@11tv/shared';
import { reconnectDelay } from './backoff';

export type SocketStatus = 'connecting' | 'open' | 'closed';

export interface AppSocketHandlers<S extends AppState> {
  onState(state: S): void;
  onStatus(status: SocketStatus): void;
  onError(message: string): void;
}

export function defaultSocketUrl(): string {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${location.host}${WS_PATH}`;
}

/**
 * WebSocket qui se reconnecte tout seul : délai exponentiel, reconnexion immédiate quand la
 * page redevient visible ou que le réseau revient, et détection d'un serveur muet grâce aux
 * messages « heartbeat ». Le serveur renvoie l'état complet à chaque connexion.
 */
export class AppSocket<S extends AppState> {
  private ws: WebSocket | null = null;
  private attempt = 0;
  private reconnectTimer: number | undefined;
  private silenceTimer: number | undefined;
  private disposed = false;

  constructor(
    private readonly url: string,
    private readonly handlers: AppSocketHandlers<S>,
  ) {
    document.addEventListener('visibilitychange', this.onWake);
    window.addEventListener('online', this.onWake);
  }

  connect(): void {
    if (this.disposed || this.ws) return;
    window.clearTimeout(this.reconnectTimer);
    this.handlers.onStatus('connecting');

    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      this.attempt = 0;
      this.handlers.onStatus('open');
      this.watchSilence();
    };
    ws.onmessage = (event: MessageEvent<string>) => {
      this.watchSilence();
      const message = JSON.parse(event.data) as ServerMessage<S>;
      if (message.type === 'state') this.handlers.onState(message.state);
      else if (message.type === 'error') this.handlers.onError(message.message);
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      window.clearTimeout(this.silenceTimer);
      this.handlers.onStatus('closed');
      this.scheduleReconnect();
    };
  }

  send(message: ClientMessage): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(message));
    return true;
  }

  dispose(): void {
    this.disposed = true;
    document.removeEventListener('visibilitychange', this.onWake);
    window.removeEventListener('online', this.onWake);
    window.clearTimeout(this.reconnectTimer);
    window.clearTimeout(this.silenceTimer);
    this.ws?.close();
    this.ws = null;
  }

  private scheduleReconnect(): void {
    if (this.disposed) return;
    const delay = reconnectDelay(this.attempt++);
    this.reconnectTimer = window.setTimeout(() => {
      this.connect();
    }, delay);
  }

  private watchSilence(): void {
    window.clearTimeout(this.silenceTimer);
    this.silenceTimer = window.setTimeout(() => {
      // Serveur muet (Wi-Fi coupé, mise en veille…) : on force une nouvelle connexion.
      this.ws?.close();
    }, HEARTBEAT_TIMEOUT_MS);
  }

  /** Au réveil du téléphone, inutile d'attendre la fin du délai de reconnexion. */
  private readonly onWake = () => {
    if (document.visibilityState !== 'visible' || this.ws || this.disposed) return;
    this.attempt = 0;
    this.connect();
  };
}
