import type { AppState, ClientMessage } from '@11tv/shared';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { AppSocket, defaultSocketUrl, type SocketStatus } from './socket';

export interface SocketError {
  message: string;
  /** Change à chaque erreur, même si le message est identique. */
  id: number;
}

export interface AppSocketHook<S extends AppState> {
  state: S | null;
  status: SocketStatus;
  error: SocketError | null;
  send: (message: ClientMessage) => boolean;
}

export function useAppSocket<S extends AppState>(enabled = true): AppSocketHook<S> {
  const [state, setState] = useState<S | null>(null);
  const [status, setStatus] = useState<SocketStatus>('connecting');
  const [error, setError] = useState<SocketError | null>(null);
  const socketRef = useRef<AppSocket<S> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const socket = new AppSocket<S>(defaultSocketUrl(), {
      onState: setState,
      onStatus: setStatus,
      onError: (message) => {
        setError((prev) => ({ message, id: (prev?.id ?? 0) + 1 }));
      },
    });
    socketRef.current = socket;
    socket.connect();
    return () => {
      socket.dispose();
      socketRef.current = null;
    };
  }, [enabled]);

  const send = useCallback(
    (message: ClientMessage) => socketRef.current?.send(message) ?? false,
    [],
  );

  return { state, status, error, send };
}
