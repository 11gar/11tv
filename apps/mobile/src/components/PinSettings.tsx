import { PIN_PATTERN } from '@11tv/shared';
import { useState } from 'preact/hooks';
import { changePin } from '../api';

interface Props {
  notify: (message: string) => void;
}

export function PinSettings({ notify }: Props) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!PIN_PATTERN.test(next)) {
      setError('Le nouveau PIN doit compter 4 à 8 chiffres.');
      return;
    }
    if (next !== confirmation) {
      setError('Les deux saisies du nouveau PIN diffèrent.');
      return;
    }
    setBusy(true);
    try {
      const result = await changePin({ current, next });
      if (result.ok) {
        setCurrent('');
        setNext('');
        setConfirmation('');
        notify('PIN modifié. Les autres téléphones devront se reconnecter.');
      } else {
        setError(
          result.reason === 'locked'
            ? `Trop de tentatives. Réessayez dans ${String(result.retryAfterSec ?? 30)} s.`
            : 'PIN actuel incorrect.',
        );
      }
    } catch {
      setError('Impossible de joindre la Surface.');
    } finally {
      setBusy(false);
    }
  };

  const pinInput = (label: string, value: string, set: (v: string) => void) => (
    <label class="field">
      <span class="muted">{label}</span>
      <input
        class="input"
        type="password"
        inputMode="numeric"
        autocomplete="off"
        maxLength={8}
        value={value}
        onInput={(e) => {
          set(e.currentTarget.value.replace(/\D/g, ''));
        }}
      />
    </label>
  );

  return (
    <section class="card">
      <h2 class="card__title">Code PIN</h2>
      <form
        class="stack stack--tight"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {pinInput('PIN actuel', current, setCurrent)}
        {pinInput('Nouveau PIN (4 à 8 chiffres)', next, setNext)}
        {pinInput('Confirmer le nouveau PIN', confirmation, setConfirmation)}
        {error && (
          <p class="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" class="button" disabled={busy || !current || !next}>
          Changer le PIN
        </button>
      </form>
    </section>
  );
}
