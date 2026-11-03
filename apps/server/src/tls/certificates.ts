import * as x509 from '@peculiar/x509';
import { X509Certificate, randomBytes, webcrypto } from 'node:crypto';
import { encodeNameConstraints, type PermittedNames } from './der';

type CryptoKey = webcrypto.CryptoKey;

x509.cryptoProvider.set(globalThis.crypto);

const ALGORITHM = { name: 'ECDSA', namedCurve: 'P-256', hash: 'SHA-256' } as const;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * L'autorité ne peut signer que pour ces noms : même si sa clé fuitait, elle ne permettrait
 * pas d'intercepter le trafic du téléphone vers Internet.
 */
export const CA_PERMITTED_NAMES: PermittedNames = {
  dns: ['localhost', 'local'],
  ipv4: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '127.0.0.0/8'],
};

export interface PemPair {
  certPem: string;
  keyPem: string;
}

export interface ServerNames {
  dns: string[];
  ips: string[];
}

function serialNumber(): string {
  // Bit de poids fort à 0 pour que le numéro de série reste positif.
  const bytes = randomBytes(16);
  bytes[0] = (bytes[0] ?? 0) & 0x7f;
  return bytes.toString('hex');
}

async function exportKeyPem(key: CryptoKey): Promise<string> {
  const pkcs8 = await webcrypto.subtle.exportKey('pkcs8', key);
  return x509.PemConverter.encode(pkcs8, 'PRIVATE KEY');
}

export async function createCertificateAuthority(now = new Date()): Promise<PemPair> {
  const keys = await webcrypto.subtle.generateKey(ALGORITHM, true, ['sign', 'verify']);
  const cert = await x509.X509CertificateGenerator.createSelfSigned({
    serialNumber: serialNumber(),
    name: 'CN=11TV Local CA, O=11TV',
    notBefore: new Date(now.getTime() - DAY_MS),
    notAfter: new Date(now.getTime() + 10 * 365 * DAY_MS),
    keys,
    signingAlgorithm: ALGORITHM,
    extensions: [
      new x509.BasicConstraintsExtension(true, 0, true),
      new x509.KeyUsagesExtension(
        x509.KeyUsageFlags.keyCertSign | x509.KeyUsageFlags.cRLSign,
        true,
      ),
      await x509.SubjectKeyIdentifierExtension.create(keys.publicKey),
      new x509.Extension('2.5.29.30', true, encodeNameConstraints(CA_PERMITTED_NAMES)),
    ],
  });
  return { certPem: cert.toString('pem'), keyPem: await exportKeyPem(keys.privateKey) };
}

/** Certificat serveur signé par l'autorité locale, valable 397 jours. */
export async function issueServerCertificate(
  ca: PemPair,
  names: ServerNames,
  now = new Date(),
): Promise<PemPair> {
  const caCert = new x509.X509Certificate(ca.certPem);
  const caKey = await webcrypto.subtle.importKey(
    'pkcs8',
    x509.PemConverter.decodeFirst(ca.keyPem),
    ALGORITHM,
    false,
    ['sign'],
  );
  const keys = await webcrypto.subtle.generateKey(ALGORITHM, true, ['sign', 'verify']);

  const cert = await x509.X509CertificateGenerator.create({
    serialNumber: serialNumber(),
    subject: 'CN=11TV',
    issuer: caCert.subject,
    notBefore: new Date(now.getTime() - 60 * 60 * 1000),
    notAfter: new Date(now.getTime() + 397 * DAY_MS),
    signingKey: caKey,
    publicKey: keys.publicKey,
    signingAlgorithm: ALGORITHM,
    extensions: [
      new x509.BasicConstraintsExtension(false, undefined, true),
      new x509.KeyUsagesExtension(x509.KeyUsageFlags.digitalSignature, true),
      new x509.ExtendedKeyUsageExtension([x509.ExtendedKeyUsage.serverAuth]),
      new x509.SubjectAlternativeNameExtension([
        ...names.dns.map((value) => ({ type: 'dns' as const, value })),
        ...names.ips.map((value) => ({ type: 'ip' as const, value })),
      ]),
      await x509.AuthorityKeyIdentifierExtension.create(caCert),
      await x509.SubjectKeyIdentifierExtension.create(keys.publicKey),
    ],
  });
  return { certPem: cert.toString('pem'), keyPem: await exportKeyPem(keys.privateKey) };
}

/** Noms présents dans le SAN d'un certificat, normalisés pour comparaison. */
export function certificateNames(certPem: string): ServerNames {
  const san = new X509Certificate(certPem).subjectAltName ?? '';
  const dns: string[] = [];
  const ips: string[] = [];
  for (const entry of san.split(', ')) {
    if (entry.startsWith('DNS:')) dns.push(entry.slice(4));
    else if (entry.startsWith('IP Address:')) ips.push(entry.slice(11));
  }
  return { dns, ips };
}

export function sameNames(a: ServerNames, b: ServerNames): boolean {
  const key = (n: ServerNames) => JSON.stringify([[...n.dns].sort(), [...n.ips].sort()]);
  return key(a) === key(b);
}

/** Empreinte SHA-256 affichée sur la TV, pour vérifier le certificat installé sur le téléphone. */
export function fingerprint(certPem: string): string {
  return new X509Certificate(certPem).fingerprint256;
}

export function expiresBefore(certPem: string, date: Date): boolean {
  return new X509Certificate(certPem).validToDate.getTime() < date.getTime();
}
