import { describe, expect, it, vi } from 'vitest';
import { meMoriesConfigSchema } from './config';
import { FirebaseReader } from './firebase-reader';
import { decodeDocument } from './firestore-values';
import { describeRecurrence, toTodosData } from './todos';

const config = meMoriesConfigSchema.parse({
  apiKey: 'cle-test',
  projectId: 'me-mories-test',
  ownerUid: 'Owner123',
  email: 'tv@example.com',
  password: 'secret',
});

function todo(overrides: Record<string, unknown>) {
  return {
    id: 't',
    title: 'Tâche',
    dueDate: '2026-11-05',
    status: 'todo',
    deletedAt: null,
    recurrence: null,
    tagIds: [],
    postponeCount: 0,
    createdAt: '2026-11-01T10:00:00Z',
    ...overrides,
  };
}

describe('decodeDocument', () => {
  it('convertit les valeurs Firestore et garde l’identifiant', () => {
    const doc = decodeDocument({
      name: 'projects/p/databases/(default)/documents/users/u/todos/abc',
      fields: {
        title: { stringValue: 'Courses' },
        postponeCount: { integerValue: '2' },
        deletedAt: { nullValue: null },
        recurrence: {
          mapValue: { fields: { unit: { stringValue: 'week' }, interval: { integerValue: '1' } } },
        },
        tagIds: { arrayValue: { values: [{ stringValue: 'tag1' }] } },
        createdAt: { timestampValue: '2026-11-01T10:00:00Z' },
      },
    });
    expect(doc).toEqual({
      id: 'abc',
      title: 'Courses',
      postponeCount: 2,
      deletedAt: null,
      recurrence: { unit: 'week', interval: 1 },
      tagIds: ['tag1'],
      createdAt: '2026-11-01T10:00:00Z',
    });
  });
});

describe('toTodosData', () => {
  it('garde les todos ouverts et datés, triés par échéance, avec leurs tags', () => {
    const data = toTodosData(
      [
        todo({ id: 'b', dueDate: '2026-11-08', tagIds: ['t1', 'supprime'] }),
        todo({ id: 'a', dueDate: '2026-11-02', recurrence: { unit: 'day', interval: 2 } }),
        todo({ id: 'fait', status: 'done' }),
        todo({ id: 'corbeille', deletedAt: '2026-11-03T00:00:00Z' }),
        todo({ id: 'sans-date', dueDate: null }),
        { id: 'casse' },
      ],
      [{ id: 't1', title: 'Maison', color: '#12855a' }],
    );
    expect(data.todos.map((t) => t.id)).toEqual(['a', 'b']);
    expect(data.todos[0]?.recurrence).toBe('tous les 2 jours');
    expect(data.todos[1]?.tags).toEqual([{ title: 'Maison', color: '#12855a' }]);
  });

  it('reprend la formulation des récurrences de Me’Mories', () => {
    expect(describeRecurrence({ unit: 'week', interval: 1 })).toBe('toutes les semaines');
    expect(describeRecurrence({ unit: 'week', interval: 3 })).toBe('toutes les 3 semaines');
    expect(describeRecurrence({ unit: 'month', interval: 2 })).toBe('tous les 2 mois');
  });
});

describe('FirebaseReader', () => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  it('se connecte une fois puis réutilise le jeton', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('signInWithPassword')) {
        return Promise.resolve(json({ idToken: 'jeton', refreshToken: 'r', expiresIn: '3600' }));
      }
      return Promise.resolve(
        json([
          {
            document: {
              name: 'projects/p/databases/(default)/documents/users/Owner123/todos/x',
              fields: { title: { stringValue: 'A' } },
            },
          },
          { readTime: '2026-11-05T00:00:00Z' },
        ]),
      );
    });
    const reader = new FirebaseReader(config, fetchMock as unknown as typeof fetch);

    const [todos] = await Promise.all([
      reader.query('todos', { field: 'status', equals: 'todo' }),
      reader.query('tags'),
    ]);
    expect(todos).toEqual([{ id: 'x', title: 'A' }]);

    const calls = fetchMock.mock.calls.map(([url]) => url);
    expect(calls.filter((url) => url.includes('signInWithPassword'))).toHaveLength(1);
    expect(calls).toContain(
      'https://firestore.googleapis.com/v1/projects/me-mories-test/databases/(default)/documents/users/Owner123:runQuery',
    );
    const firestoreCall = fetchMock.mock.calls.find(([url]) =>
      url.includes(':runQuery'),
    ) as unknown as [string, RequestInit];
    expect((firestoreCall[1].headers as Record<string, string>).Authorization).toBe('Bearer jeton');
  });

  it('traduit les erreurs de connexion et d’accès', async () => {
    const refused = new FirebaseReader(config, () =>
      Promise.resolve(json({ error: { message: 'INVALID_LOGIN_CREDENTIALS' } }, 400)),
    );
    await expect(refused.query('todos')).rejects.toThrow('Identifiants Me’Mories refusés');

    const badKey = new FirebaseReader(config, () =>
      Promise.resolve(
        json({ error: { message: 'API key not valid. Please pass a valid API key.' } }, 400),
      ),
    );
    await expect(badKey.query('todos')).rejects.toThrow('Clé d’API Firebase refusée');

    const denied = new FirebaseReader(config, ((url: string) =>
      Promise.resolve(
        url.includes('signIn')
          ? json({ idToken: 'j', refreshToken: 'r', expiresIn: '3600' })
          : json({ error: { status: 'PERMISSION_DENIED' } }, 403),
      )) as unknown as typeof fetch);
    await expect(denied.query('todos')).rejects.toThrow('Accès refusé par Firestore');
  });
});
