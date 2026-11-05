import type { MeMoriesTodo } from '@11tv/shared';

/** Jour civil local « AAAA-MM-JJ », comme Me'Mories (toIsoDate). */
export function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function addDays(iso: string, days: number): string {
  const date = fromIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

const dayMonth = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });
const dayMonthYear = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** Jours de retard ; 0 si l'échéance n'est pas passée. Arrondi : un jour d'heure d'été dure 23 h. */
export function overdueDays(dueDate: string, today: string): number {
  if (dueDate >= today) return 0;
  return Math.round((fromIsoDate(today).getTime() - fromIsoDate(dueDate).getTime()) / 86_400_000);
}

/** « en retard de 3 j », « aujourd'hui », « demain », « 12 mars » : libellés de Me'Mories. */
export function dueLabel(dueDate: string, today: string): string {
  const late = overdueDays(dueDate, today);
  if (late > 0) return `en retard de ${String(late)} j`;
  if (dueDate === today) return "aujourd'hui";
  if (dueDate === addDays(today, 1)) return 'demain';
  const date = fromIsoDate(dueDate);
  return (date.getFullYear() === fromIsoDate(today).getFullYear() ? dayMonth : dayMonthYear).format(
    date,
  );
}

export interface TodoSectionView {
  id: 'today' | 'upcoming';
  title: string;
  todos: MeMoriesTodo[];
  /** Todos de la section, affichés ou non. */
  total: number;
}

/**
 * « Aujourd'hui » (retards compris, comme dans Me'Mories) puis « À venir », dans la limite de
 * `max` lignes au total : aujourd'hui passe en premier, le reste est compté à part.
 */
export function splitTodos(todos: readonly MeMoriesTodo[], today: string, max: number) {
  const now = todos.filter((todo) => todo.dueDate <= today);
  const later = todos.filter((todo) => todo.dueDate > today);
  const shownNow = now.slice(0, max);
  const shownLater = later.slice(0, Math.max(0, max - shownNow.length));

  const sections: TodoSectionView[] = [
    { id: 'today' as const, title: 'Aujourd’hui', todos: shownNow, total: now.length },
    { id: 'upcoming' as const, title: 'À venir', todos: shownLater, total: later.length },
  ].filter((section) => section.total > 0);

  return { sections, hidden: todos.length - shownNow.length - shownLater.length };
}
