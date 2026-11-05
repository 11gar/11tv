import type { MeMoriesTodo, MeMoriesTodosCard } from '@11tv/shared';
import type { CSSProperties } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { dueLabel, overdueDays, splitTodos, toIsoDate } from './sections';
import './todos-card.css';

/** Lignes visibles au plus : la carte doit tenir en hauteur, même avec des tags partout. */
const MAX_ROWS = 6;

const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

// Icônes de Me'Mories (src/ui/Icon), même tracé.
const ICONS = {
  repeat:
    'M17 2.5 21.5 7 17 11.5M2.5 12v-1.5A3.5 3.5 0 0 1 6 7h15.5M7 21.5 2.5 17 7 12.5M21.5 12v1.5a3.5 3.5 0 0 1-3.5 3.5H2.5',
  tag: 'M3 3h7.6a2 2 0 0 1 1.4.6l8.4 8.4a2 2 0 0 1 0 2.8l-6.6 6.6a2 2 0 0 1-2.8 0L3.6 13A2 2 0 0 1 3 11.6V3ZM7.5 7.5h.01',
  checkSquare:
    'M20.5 11.3V18a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 18V6A2.5 2.5 0 0 1 6 3.5h9M8.5 11.5l3.2 3.2L21 5.5',
} as const;

function Icon({ name, class: className }: { name: keyof typeof ICONS; class?: string }) {
  return (
    <svg
      class={className ?? 'mm-icon'}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

/** Date du jour, revue chaque minute : les libellés changent à minuit sans actualisation. */
function useToday(): string {
  const [today, setToday] = useState(() => toIsoDate(new Date()));
  useEffect(() => {
    const timer = window.setInterval(() => {
      setToday(toIsoDate(new Date()));
    }, 60_000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);
  return today;
}

function TodoRow({ todo, today }: { todo: MeMoriesTodo; today: string }) {
  const overdue = overdueDays(todo.dueDate, today) > 0;
  return (
    <li class="mm-item">
      <span class="mm-box" aria-hidden="true" />
      <div class="mm-body">
        <span class="mm-title">{todo.title}</span>
        <p class="mm-meta">
          <span class={overdue ? 'mm-due mm-overdue' : 'mm-due'}>
            {dueLabel(todo.dueDate, today)}
          </span>
          {todo.recurrence && (
            <span class="mm-subtle">
              <Icon name="repeat" />
              {todo.recurrence}
            </span>
          )}
          {todo.postponeCount > 0 && (
            <span class="mm-subtle">reporté {String(todo.postponeCount)} fois</span>
          )}
        </p>
        {todo.tags.length > 0 && (
          <div class="mm-chips">
            {todo.tags.map((tag) => (
              <span
                key={tag.title}
                class="mm-chip"
                style={{ '--chip-color': tag.color } as CSSProperties}
              >
                <Icon name="tag" />
                <span class="mm-chip__label">{tag.title}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

/** Carte « Todos » de Me'Mories, dans le style de l'application (palette sombre). */
export function TodosCard({ card }: { card: MeMoriesTodosCard }) {
  const today = useToday();
  const { sections, hidden } = splitTodos(card.data.todos, today, MAX_ROWS);

  return (
    <section class="mm-card">
      <header class="mm-card__header">
        <Icon name="checkSquare" class="mm-card__logo" />
        <span>Todos</span>
      </header>

      {sections.length === 0 ? (
        <p class="mm-empty">Rien de prévu. Profitez-en !</p>
      ) : (
        sections.map((section) => (
          <div key={section.id} class="mm-section">
            <h2 class="mm-section__title">
              {section.title}
              <span class="mm-count">{section.total}</span>
            </h2>
            <ul class="mm-list">
              {section.todos.map((todo) => (
                <TodoRow key={todo.id} todo={todo} today={today} />
              ))}
            </ul>
          </div>
        ))
      )}

      {hidden > 0 && <p class="mm-more">et {String(hidden)} de plus dans Me’Mories</p>}
      {card.error && (
        <p class="mm-stale">
          Me’Mories injoignable : liste de {timeFormat.format(new Date(card.updatedAt))}
        </p>
      )}
    </section>
  );
}
