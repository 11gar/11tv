// Pictogrammes en trait (24 × 24), à la couleur du texte.

interface IconProps {
  class?: string;
}

function Icon({ class: className = 'icon', d }: IconProps & { d: string }) {
  return (
    <svg
      class={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

const SPEAKER = 'M4 9.5h3.2L12 5.5v13l-4.8-4H4z';

export const GearIcon = (p: IconProps) => (
  <Icon
    {...p}
    d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM18.4 13.5l1.6 1.2-2 3.4-1.9-.7a7.6 7.6 0 0 1-1.9 1.1L14 20.5h-4l-.3-2a7.6 7.6 0 0 1-1.9-1.1l-1.9.7-2-3.4 1.6-1.2a7.7 7.7 0 0 1 0-2.9L3.9 9.3l2-3.4 1.9.7a7.6 7.6 0 0 1 1.9-1.1L10 3.5h4l.3 2a7.6 7.6 0 0 1 1.9 1.1l1.9-.7 2 3.4-1.6 1.2a7.7 7.7 0 0 1 0 2.9Z"
  />
);

export const VolumeUpIcon = (p: IconProps) => (
  <Icon {...p} d={`${SPEAKER}M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11`} />
);

export const VolumeDownIcon = (p: IconProps) => (
  <Icon {...p} d={`${SPEAKER}M15.5 9a4.2 4.2 0 0 1 0 6`} />
);

export const KeyboardIcon = (p: IconProps) => (
  <Icon
    {...p}
    d="M3.5 6.5h17a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1ZM6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M7.5 14h9"
  />
);

export const CloseIcon = (p: IconProps) => <Icon {...p} d="M6 6l12 12M18 6 6 18" />;

export const PrevIcon = (p: IconProps) => <Icon {...p} d="M6 5v14M18 5.5v13L9 12z" />;

export const NextIcon = (p: IconProps) => <Icon {...p} d="M18 5v14M6 5.5v13L15 12z" />;

/** Lecture et pause sont pleines, comme sur les lecteurs du système. */
export function PlayPauseIcon({
  playing,
  class: className = 'icon',
}: IconProps & { playing: boolean }) {
  return (
    <svg class={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {playing ? (
        <path d="M7 5h3.2v14H7zM13.8 5H17v14h-3.2z" />
      ) : (
        <path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.2-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5Z" />
      )}
    </svg>
  );
}
