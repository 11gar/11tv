import type { ComponentChildren } from 'preact';
import { useRepeat } from '../hooks/use-repeat';

interface Props {
  onPress: () => void;
  class?: string;
  label: string;
  children: ComponentChildren;
}

/** Bouton qui agit dès l'appui et se répète tant qu'on le maintient. */
export function RepeatButton({ onPress, class: className, label, children }: Props) {
  const handlers = useRepeat(onPress);
  return (
    <button type="button" class={className} aria-label={label} {...handlers}>
      {children}
    </button>
  );
}
