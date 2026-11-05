import { decodeDocument, type FirestoreDocument } from './firestore-values';
import type { MeMoriesConfig } from './config';

type Fetch = typeof fetch;

const TIMEOUT_MS = 15_000;
/** Un jeton d'identité Firebase vit une heure ; on le renouvelle un peu avant. */
const TOKEN_MARGIN_MS = 5 * 60 * 1000;

interface Token {
  idToken: string;
  refreshToken: string;
  expiresAt: number;
}

/** Message lisible pour les erreurs connues de Firebase Authentication. */
function authMessage(code: string): string {
  if (/INVALID_LOGIN_CREDENTIALS|INVALID_PASSWORD|EMAIL_NOT_FOUND/.test(code)) {
    return 'Identifiants Me’Mories refusés (e-mail ou mot de passe du compte TV)';
  }
  if (code.includes('USER_DISABLED')) return 'Compte TV désactivé dans Firebase';
  if (/api[ _]key|referer/i.test(code)) {
    return 'Clé d’API Firebase refusée (clé ou restriction de site)';
  }
  if (code.includes('TOO_MANY_ATTEMPTS')) return 'Trop de tentatives de connexion à Firebase';
  return `Connexion à Firebase impossible (${code})`;
}

/**
 * Accès en lecture à Firestore par l'API REST, avec le compte de la TV : pas de SDK, pas
 * de compte de service. Le jeton est gardé en mémoire et renouvelé avant expiration.
 */
export class FirebaseReader {
  private token: Token | null = null;
  private pendingToken: Promise<string> | null = null;

  constructor(
    private readonly config: MeMoriesConfig,
    private readonly fetchImpl: Fetch = fetch,
  ) {}

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...(this.config.referer ? { Referer: this.config.referer } : {}),
    };
  }

  private async post(url: string, body: unknown, idToken?: string): Promise<Response> {
    return this.fetchImpl(url, {
      method: 'POST',
      headers: { ...this.headers(), ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  }

  private async authRequest(url: string, body: unknown): Promise<Token> {
    const res = await this.post(url, body);
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      const error = json.error as { message?: string } | undefined;
      throw new Error(authMessage(error?.message ?? `HTTP ${String(res.status)}`));
    }
    // signInWithPassword et securetoken nomment les champs différemment.
    const idToken = (json.idToken ?? json.id_token) as string;
    const refreshToken = (json.refreshToken ?? json.refresh_token) as string;
    const expiresIn = Number(json.expiresIn ?? json.expires_in ?? 3600);
    return { idToken, refreshToken, expiresAt: Date.now() + expiresIn * 1000 };
  }

  /** Une seule connexion à la fois, même si plusieurs requêtes partent ensemble. */
  private idToken(): Promise<string> {
    this.pendingToken ??= this.obtainToken().finally(() => {
      this.pendingToken = null;
    });
    return this.pendingToken;
  }

  private async obtainToken(): Promise<string> {
    const { apiKey, email, password } = this.config;
    const key = encodeURIComponent(apiKey);
    if (this.token && Date.now() < this.token.expiresAt - TOKEN_MARGIN_MS) {
      return this.token.idToken;
    }
    if (this.token) {
      try {
        this.token = await this.authRequest(
          `https://securetoken.googleapis.com/v1/token?key=${key}`,
          {
            grant_type: 'refresh_token',
            refresh_token: this.token.refreshToken,
          },
        );
        return this.token.idToken;
      } catch {
        this.token = null; // Jeton révoqué : nouvelle connexion ci-dessous.
      }
    }
    this.token = await this.authRequest(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${key}`,
      { email, password, returnSecureToken: true },
    );
    return this.token.idToken;
  }

  private documentsUrl(): string {
    const { projectId, ownerUid } = this.config;
    return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${ownerUid}`;
  }

  private async firestoreError(res: Response): Promise<Error> {
    if (res.status === 403) {
      this.token = null;
      return new Error('Accès refusé par Firestore : règles de lecture du compte TV à vérifier');
    }
    const text = await res.text().catch(() => '');
    return new Error(`Firestore : HTTP ${String(res.status)} ${text.slice(0, 200)}`);
  }

  /** Documents d'une sous-collection du propriétaire, avec un filtre d'égalité facultatif. */
  async query(
    collection: string,
    where?: { field: string; equals: string },
  ): Promise<(Record<string, unknown> & { id: string })[]> {
    const structuredQuery = {
      from: [{ collectionId: collection }],
      ...(where
        ? {
            where: {
              fieldFilter: {
                field: { fieldPath: where.field },
                op: 'EQUAL',
                value: { stringValue: where.equals },
              },
            },
          }
        : {}),
    };
    const res = await this.post(
      `${this.documentsUrl()}:runQuery`,
      { structuredQuery },
      await this.idToken(),
    );
    if (!res.ok) throw await this.firestoreError(res);
    const rows = (await res.json()) as { document?: FirestoreDocument }[];
    return rows.flatMap((row) => (row.document ? [decodeDocument(row.document)] : []));
  }
}
