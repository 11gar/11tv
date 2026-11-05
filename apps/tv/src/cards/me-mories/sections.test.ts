import type { MeMoriesTodo } from '@11tv/shared';
import { describe, expect, it } from 'vitest';
import { dueLabel, splitTodos, toIsoDate } from './sections';

const todo = (id: string, dueDate: string): MeMoriesTodo => ({
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
    expect(dueLabel('2026-11-06', '2026-11-05')).toBe('demain');
    expect(dueLabel('2026-12-24', '2026-11-05')).toBe('24 décembre');
    expect(dueLabel('2027-01-03', '2026-11-05')).toBe('3 janvier 2027');
  });

  it('formate le jour local', () => {
    expect(toIsoDate(new Date(2026, 0, 9))).toBe('2026-01-09');
  });
});

describe('splitTodos', () => {
  it('met les retards dans « Aujourd’hui » et limite le nombre de lignes', () => {
    const todos = [
      todo('retard', '2026-11-01'),
      todo('jour', '2026-11-05'),
      todo('demain', '2026-11-06'),
      todo('plus-tard', '2026-11-20'),
    ];
    const { sections, hidden } = splitTodos(todos, '2026-11-05', 3);
    expect(sections.map((s) => [s.id, s.todos.map((t) => t.id), s.total])).toEqual([
      ['today', ['retard', 'jour'], 2],
      ['upcoming', ['demain'], 2],
    ]);
    expect(hidden).toBe(1);
  });

  it('n’affiche pas de section vide', () => {
    expect(splitTodos([todo('demain', '2026-11-06')], '2026-11-05', 8).sections).toHaveLength(1);
  });
});
