import { PIN_PATTERN } from '@11tv/shared';
import { useState } from 'preact/hooks';
import { changePin } from '../api';

interface Props {
  notify: (message: string) => void;
}

/**
 * PIN permanent de connexion. Ce téléphone étant déjà connecté, le PIN actuel n'est pas
 * demandé (celui du premier démarrage, affiché une seule fois sur la TV, est rarement connu).
 */
export function PinSettings({ notify }: Props) {
  const [pin, setPin] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!PIN_PATTERN.test(pin)) {
      setError('Le PIN doit compter 4 à 8 chiffres.');
      return;
    }
    if (pin !== confirmation) {
      setError('Les deux saisies diffèrent.');
      return;
    }
    setBusy(true);
    try {
      const result = await changePin({ pin });
      if (result.ok) {
        setPin('');
        setConfirmation('');
        notify('PIN enregistré. Les autres téléphones devront se reconnecter.');
      } else {
        setError('PIN refusé par la Surface.');
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
        autocomplete="new-password"
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
      <p class="muted">
        Code permanent pour connecter un téléphone, en plus du code affiché sur la TV quand aucun
        téléphone n’est connecté.
      </p>
      <form
        class="stack stack--tight"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {pinInput('Nouveau PIN (4 à 8 chiffres)', pin, setPin)}
        {pinInput('Confirmer le PIN', confirmation, setConfirmation)}
        {error && (
          <p class="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" class="button" disabled={busy || !pin || !confirmation}>
          Enregistrer le PIN
        </button>
      </form>
    </section>
  );
}
