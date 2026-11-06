import type { MeMoriesTodo } from '@11tv/shared';
import { describe, expect, it } from 'vitest';
import { dueLabel, paginateTodos, toIsoDate } from './sections';

const todo = (id: string, dueDate: string | null): MeMoriesTodo => ({
  id,
  title: id,
  dueDate,
  recurrence: null,
  postponeCount: 0,
  tags: [],
});

describe('dueLabel', () => {
  it('reprend les libellés de Me’Mories', () => {
    expect(dueLabel('2026-11-02', '2026-11-05')).toBe('en retard de 3 j');
    expect(dueLabel('2026-11-05', '2026-11-05')).toBe("aujourd'hui");
  });

  it('formate le jour local', () => {
    expect(toIsoDate(new Date(2026, 0, 9))).toBe('2026-01-09');
  });
});

describe('paginateTodos', () => {
  const summary = (pages: ReturnType<typeof paginateTodos>) =>
    pages.map((page) => page.map((s) => [s.id, s.todos.map((t) => t.id), s.total]));

  it('répartit aujourd’hui puis sans date sur des pages, sans ceux à venir', () => {
    const todos = [
      todo('retard', '2026-11-01'),
      todo('jour', '2026-11-05'),
      todo('demain', '2026-11-06'),
      todo('sans-date-1', null),
      todo('sans-date-2', null),
    ];
    expect(summary(paginateTodos(todos, '2026-11-05', 3))).toEqual([
      [
        ['today', ['retard', 'jour'], 2],
        ['undated', ['sans-date-1'], 2],
      ],
      [['undated', ['sans-date-2'], 2]],
    ]);
  });

  it('n’a aucune page quand il n’y a rien à faire', () => {
    expect(paginateTodos([todo('demain', '2026-11-06')], '2026-11-05', 6)).toEqual([]);
  });

  it('montre demain dès minuit, sans attendre l’actualisation', () => {
    expect(paginateTodos([todo('demain', '2026-11-06')], '2026-11-06', 6)).toHaveLength(1);
  });
});
