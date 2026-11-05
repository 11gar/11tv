import type { MeMoriesTodo } from '@11tv/shared';
import { describe, expect, it } from 'vitest';
import { dueLabel, splitTodos, toIsoDate } from './sections';

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

describe('splitTodos', () => {
  it('garde aujourd’hui (retards compris) et les todos sans date, sans ceux à venir', () => {
    const todos = [
      todo('retard', '2026-11-01'),
      todo('jour', '2026-11-05'),
      todo('demain', '2026-11-06'),
      todo('sans-date-1', null),
      todo('sans-date-2', null),
    ];
    const { sections, hidden } = splitTodos(todos, '2026-11-05', 3);
    expect(sections.map((s) => [s.id, s.todos.map((t) => t.id), s.total])).toEqual([
      ['today', ['retard', 'jour'], 2],
      ['undated', ['sans-date-1'], 2],
    ]);
    expect(hidden).toBe(1);
  });

  it('montre demain dès minuit, sans attendre l’actualisation', () => {
    const todos = [todo('demain', '2026-11-06')];
    expect(splitTodos(todos, '2026-11-05', 8).sections).toHaveLength(0);
    expect(splitTodos(todos, '2026-11-06', 8).sections[0]?.todos).toHaveLength(1);
  });
});
