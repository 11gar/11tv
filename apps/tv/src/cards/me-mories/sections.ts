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

const SECTIONS = [
  { id: 'today', title: 'Aujourd’hui' },
  { id: 'undated', title: 'Sans date' },
] as const;

/**
 * Pages de la carte : « Aujourd'hui » (retards compris, comme dans Me'Mories) puis « Sans
 * date », `maxPerPage` lignes au plus par page. Le nombre de pages est le plus petit
 * possible, et les lignes y sont réparties au plus juste : 7 todos donnent 4 + 3 plutôt que
 * 6 + 1. Une page reprend l'en-tête de chaque section qu'elle contient, avec le total de la
 * section. Les todos à venir ne sont pas affichés.
 */
export function paginateTodos(
  todos: readonly MeMoriesTodo[],
  today: string,
  maxPerPage: number,
): TodoSectionView[][] {
  const bySection = {
    today: todos.filter((todo) => todo.dueDate !== null && todo.dueDate <= today),
    undated: todos.filter((todo) => todo.dueDate === null),
  };
  const rows = SECTIONS.flatMap(({ id }) => bySection[id].map((todo) => ({ id, todo })));
  const pageCount = Math.ceil(rows.length / maxPerPage);
  // Taille de base de chaque page ; le reste ajoute une ligne aux premières (13 → 5, 4, 4).
  const base = Math.floor(rows.length / Math.max(1, pageCount));
  const extra = rows.length % Math.max(1, pageCount);

  const pages: TodoSectionView[][] = [];
  let start = 0;
  for (let index = 0; index < pageCount; index++) {
    const size = base + (index < extra ? 1 : 0);
    const chunk = rows.slice(start, start + size);
    start += size;
    pages.push(
      SECTIONS.flatMap(({ id, title }) => {
        const here = chunk.filter((row) => row.id === id).map((row) => row.todo);
        return here.length > 0 ? [{ id, title, todos: here, total: bySection[id].length }] : [];
      }),
    );
  }
  return pages;
}
