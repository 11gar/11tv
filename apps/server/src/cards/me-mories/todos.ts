import type { MeMoriesTag, MeMoriesTodo, MeMoriesTodosData } from '@11tv/shared';
import { z } from 'zod';

/** Au-delà, la carte n'en afficherait de toute façon pas davantage. */
export const MAX_TODOS = 50;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * Ce que la carte lit d'un Todo Me'Mories (src/domain/models/todo.ts). Lecture tolérante :
 * un document inattendu est ignoré plutôt que de vider la carte.
 */
const todoSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  dueDate: isoDate.nullable().catch(null),
  status: z.string(),
  deletedAt: z.string().nullable().catch(null),
  recurrence: z
    .object({ unit: z.enum(['day', 'week', 'month']), interval: z.number().int().min(1) })
    .nullable()
    .catch(null),
  tagIds: z.array(z.string()).catch([]),
  postponeCount: z.number().int().min(0).catch(0),
  createdAt: z.string().catch(''),
});

const tagSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .catch('#8b83ff'),
});

const UNIT_LABELS = {
  day: { singular: 'tous les jours', plural: 'jours' },
  week: { singular: 'toutes les semaines', plural: 'semaines' },
  month: { singular: 'tous les mois', plural: 'mois' },
} as const;

/** Même formulation que Me'Mories (describeRecurrence). */
export function describeRecurrence(rule: { unit: keyof typeof UNIT_LABELS; interval: number }) {
  const labels = UNIT_LABELS[rule.unit];
  if (rule.interval === 1) return labels.singular;
  const article = rule.unit === 'week' ? 'toutes les' : 'tous les';
  return `${article} ${String(rule.interval)} ${labels.plural}`;
}

/** Jour civil local « AAAA-MM-JJ » (la Surface et la TV partagent le même fuseau). */
function localIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Todos à afficher : ouverts et non supprimés, échus aujourd'hui ou en retard, plus ceux
 * sans date. Ceux de demain sont aussi envoyés : la TV, qui connaît l'heure, les montre
 * dès minuit sans attendre l'actualisation suivante. Tri comme dans Me'Mories : échéance
 * la plus ancienne d'abord, sans date à la fin, puis ordre de création.
 */
export function toTodosData(
  rawTodos: readonly Record<string, unknown>[],
  rawTags: readonly Record<string, unknown>[],
  now: Date = new Date(),
): MeMoriesTodosData {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const until = localIsoDate(tomorrow);

  const tags = new Map<string, MeMoriesTag>();
  for (const raw of rawTags) {
    const tag = tagSchema.safeParse(raw);
    if (tag.success) tags.set(tag.data.id, { title: tag.data.title, color: tag.data.color });
  }

  const todos = rawTodos
    .flatMap((raw) => {
      const parsed = todoSchema.safeParse(raw);
      return parsed.success ? [parsed.data] : [];
    })
    .filter(
      (todo) =>
        todo.status === 'todo' &&
        todo.deletedAt === null &&
        (todo.dueDate === null || todo.dueDate <= until),
    )
    .sort((a, b) => {
      if (a.dueDate !== b.dueDate) {
        if (a.dueDate === null) return 1;
        if (b.dueDate === null) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      }
      return a.createdAt.localeCompare(b.createdAt);
    })
    .slice(0, MAX_TODOS)
    .map((todo): MeMoriesTodo => ({
      id: todo.id,
      title: todo.title,
      dueDate: todo.dueDate,
      recurrence: todo.recurrence ? describeRecurrence(todo.recurrence) : null,
      postponeCount: todo.postponeCount,
      // Un tag supprimé (ou pas encore lu) disparaît, comme dans Me'Mories.
      tags: todo.tagIds.flatMap((id) => {
        const tag = tags.get(id);
        return tag ? [tag] : [];
      }),
    }));

  return { todos };
}
