import { useCallback, useEffect, useState } from 'preact/hooks';
import { fetchSession } from './api';
import { Login } from './screens/Login';
import { Shell } from './Shell';

type AuthState = 'checking' | 'login' | 'ready' | 'offline';

export function App() {
  const [auth, setAuth] = useState<AuthState>('checking');

  const check = async () => {
    try {
      setAuth((await fetchSession()) ? 'ready' : 'login');
    } catch {
      setAuth('offline');
    }
  };

  useEffect(() => {
    void check();
  }, []);

  const onSessionLost = useCallback(() => {
    setAuth('login');
  }, []);

  switch (auth) {
    case 'checking':
      return <div class="centered muted">Connexion…</div>;
    case 'offline':
      return (
        <div class="centered">
          <p class="muted">Impossible de joindre la Surface.</p>
          <button type="button" class="button" onClick={() => void check()}>
            Réessayer
          </button>
        </div>
      );
    case 'login':
      return (
        <Login
          onSuccess={() => {
            setAuth('ready');
          }}
        />
      );
    case 'ready':
      return <Shell onSessionLost={onSessionLost} />;
  }
}
