const PRESETS = [5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600];

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${String(seconds)} s`;
  if (seconds < 3600) {
    const min = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return rest ? `${String(min)} min ${String(rest)} s` : `${String(min)} min`;
  }
  return `${String(Math.round(seconds / 3600))} h`;
}

interface Props {
  seconds: number;
  onChange: (seconds: number) => void;
}

export function SlideIntervalSettings({ seconds, onChange }: Props) {
  const options = PRESETS.includes(seconds) ? PRESETS : [...PRESETS, seconds].sort((a, b) => a - b);

  return (
    <section class="card">
      <h2 class="card__title">Défilement des fonds d’écran</h2>
      <label class="field">
        <span class="muted">Changer d’image toutes les</span>
        <select
          class="input"
          value={String(seconds)}
          onChange={(e) => {
            onChange(Number(e.currentTarget.value));
          }}
        >
          {options.map((value) => (
            <option key={value} value={String(value)}>
              {formatDuration(value)}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
