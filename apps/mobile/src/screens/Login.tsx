import { useState } from 'preact/hooks';
import { login } from '../api';

const PIN_MAX = 8;
const PIN_MIN = 4;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

interface Props {
  onSuccess: () => void;
}

export function Login({ onSuccess }: Props) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const press = (digit: string) => {
    setError(null);
    setPin((p) => (p.length < PIN_MAX ? p + digit : p));
  };

  const submit = async () => {
    if (pin.length < PIN_MIN || busy) return;
    setBusy(true);
    try {
      const result = await login(pin);
      if (result.ok) {
        onSuccess();
        return;
      }
      setPin('');
      setError(
        result.reason === 'locked'
          ? `Trop de tentatives. Réessayez dans ${String(result.retryAfterSec ?? 30)} s.`
          : 'PIN incorrect.',
      );
    } catch {
      setError('Impossible de joindre la Surface.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main class="login">
      <h1 class="login__title">11TV</h1>
      <p class="muted">Saisissez votre PIN, ou le code affiché sur la TV</p>

      <div class="pin-dots" aria-label={`${String(pin.length)} chiffres saisis`}>
        {Array.from({ length: Math.max(6, pin.length) }, (_, i) => (
          <span key={i} class={i < pin.length ? 'pin-dot pin-dot--filled' : 'pin-dot'} />
        ))}
      </div>
      <p class="login__error" role="alert">
        {error}
      </p>

      <div class="keypad">
        {KEYS.map((digit) => (
          <button
            key={digit}
            type="button"
            class="key"
            onClick={() => {
              press(digit);
            }}
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          class="key key--secondary"
          onClick={() => {
            setPin((p) => p.slice(0, -1));
          }}
          aria-label="Effacer"
        >
          ⌫
        </button>
        <button
          type="button"
          class="key"
          onClick={() => {
            press('0');
          }}
        >
          0
        </button>
        <button
          type="button"
          class="key key--primary"
          disabled={pin.length < PIN_MIN || busy}
          onClick={() => void submit()}
          aria-label="Valider"
        >
          OK
        </button>
      </div>
    </main>
  );
}
