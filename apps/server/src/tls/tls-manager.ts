import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Logger } from '../log';
import {
  certificateNames,
  createCertificateAuthority,
  expiresBefore,
  fingerprint,
  issueServerCertificate,
  sameNames,
  type PemPair,
  type ServerNames,
} from './certificates';

const RENEW_BEFORE_MS = 30 * 24 * 60 * 60 * 1000;

async function readPair(certFile: string, keyFile: string): Promise<PemPair | null> {
  try {
    return { certPem: await readFile(certFile, 'utf8'), keyPem: await readFile(keyFile, 'utf8') };
  } catch {
    return null;
  }
}

/**
 * Autorité locale (créée une fois) et certificat serveur, réémis automatiquement quand
 * les adresses de la machine changent ou que l'échéance approche.
 */
export class TlsManager {
  private ca: PemPair | null = null;
  private server: PemPair | null = null;

  constructor(
    private readonly dir: string,
    private readonly log: Logger,
  ) {}

  private file(name: string): string {
    return path.join(this.dir, name);
  }

  get caCertPem(): string {
    if (!this.ca) throw new Error('TlsManager non initialisé');
    return this.ca.certPem;
  }

  get caFingerprint(): string {
    return fingerprint(this.caCertPem);
  }

  /** Renvoie le certificat serveur pour ces noms ; `changed` indique s'il vient d'être réémis. */
  async ensure(names: ServerNames): Promise<PemPair & { changed: boolean }> {
    await mkdir(this.dir, { recursive: true });

    if (!this.ca) {
      this.ca = await readPair(this.file('ca.crt'), this.file('ca-key.pem'));
      if (!this.ca) {
        this.ca = await createCertificateAuthority();
        await writeFile(this.file('ca-key.pem'), this.ca.keyPem, { mode: 0o600 });
        await writeFile(this.file('ca.crt'), this.ca.certPem);
        this.log.info('Autorité de certification locale créée');
      }
    }

    this.server ??= await readPair(this.file('server.crt'), this.file('server-key.pem'));
    const renewDate = new Date(Date.now() + RENEW_BEFORE_MS);
    const upToDate =
      this.server &&
      sameNames(certificateNames(this.server.certPem), names) &&
      !expiresBefore(this.server.certPem, renewDate);
    if (upToDate && this.server) return { ...this.server, changed: false };

    this.server = await issueServerCertificate(this.ca, names);
    await writeFile(this.file('server-key.pem'), this.server.keyPem, { mode: 0o600 });
    await writeFile(this.file('server.crt'), this.server.certPem);
    this.log.info({ names }, 'Certificat serveur émis');
    return { ...this.server, changed: true };
  }
}
