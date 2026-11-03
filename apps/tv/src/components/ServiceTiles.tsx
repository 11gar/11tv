import type { ServiceDefinition, ServiceId } from '@11tv/shared';
import { useEffect, useRef, useState } from 'preact/hooks';

interface Props {
  services: readonly ServiceDefinition[];
  onLaunch: (service: ServiceId) => void;
}

/**
 * Tuiles des services, navigables aux flèches (focus « itinérant ») : la télécommande du
 * téléphone envoie des touches clavier à Edge, l'accueil se pilote donc comme une app TV.
 */
export function ServiceTiles({ services, onLaunch }: Props) {
  const [focused, setFocused] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    refs.current[focused]?.focus();
  }, [focused]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') setFocused((i) => Math.min(services.length - 1, i + 1));
      else if (event.key === 'ArrowLeft') setFocused((i) => Math.max(0, i - 1));
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [services.length]);

  return (
    <nav class="tiles" aria-label="Services">
      {services.map((service, index) => (
        <button
          key={service.id}
          ref={(el) => {
            refs.current[index] = el;
          }}
          type="button"
          class="tile"
          tabIndex={index === focused ? 0 : -1}
          style={{ '--accent': service.accent }}
          onFocus={() => {
            setFocused(index);
          }}
          onClick={() => {
            onLaunch(service.id);
          }}
        >
          <span class="tile__name">{service.name}</span>
        </button>
      ))}
    </nav>
  );
}
