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

/** Jours de retard ; 0 si l'échéance n'est pas passée. Arrondi : un jour d'heure d'été dure 23 h. */
export function overdueDays(dueDate: string, today: string): number {
  if (dueDate >= today) return 0;
  return Math.round((fromIsoDate(today).getTime() - fromIsoDate(dueDate).getTime()) / 86_400_000);
}

/** « en retard de 3 j » ou « aujourd'hui » : libellés de Me'Mories. */
export function dueLabel(dueDate: string, today: string): string {
  const late = overdueDays(dueDate, today);
  return late > 0 ? `en retard de ${String(late)} j` : "aujourd'hui";
}

export interface TodoSectionView {
  id: 'today' | 'undated';
  title: string;
  todos: MeMoriesTodo[];
  /** Todos de la section, affichés ou non. */
  total: number;
}

/**
 * « Aujourd'hui » (retards compris, comme dans Me'Mories) puis « Sans date », dans la limite
 * de `max` lignes au total : aujourd'hui passe en premier, le reste est compté à part. Les
 * todos à venir ne sont pas affichés.
 */
export function splitTodos(todos: readonly MeMoriesTodo[], today: string, max: number) {
  const now = todos.filter((todo) => todo.dueDate !== null && todo.dueDate <= today);
  const undated = todos.filter((todo) => todo.dueDate === null);
  const shownNow = now.slice(0, max);
  const shownUndated = undated.slice(0, Math.max(0, max - shownNow.length));

  const sections: TodoSectionView[] = [
    { id: 'today' as const, title: 'Aujourd’hui', todos: shownNow, total: now.length },
    { id: 'undated' as const, title: 'Sans date', todos: shownUndated, total: undated.length },
  ].filter((section) => section.total > 0);

  return {
    sections,
    hidden: now.length + undated.length - shownNow.length - shownUndated.length,
  };
}
