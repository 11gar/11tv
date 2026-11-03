import { AsnConvert } from '@peculiar/asn1-schema';
import { NameConstraints } from '@peculiar/asn1-x509';
import * as x509 from '@peculiar/x509';
import { X509Certificate } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  certificateNames,
  createCertificateAuthority,
  issueServerCertificate,
  sameNames,
} from './certificates';
import { encodeNameConstraints } from './der';

describe('encodeNameConstraints', () => {
  it('produit un DER relisible par une implémentation ASN.1 indépendante', () => {
    const der = encodeNameConstraints({ dns: ['local'], ipv4: ['192.168.0.0/16', '10.0.0.0/8'] });
    const parsed = AsnConvert.parse(der, NameConstraints);
    const subtrees = parsed.permittedSubtrees ?? [];
    expect(subtrees).toHaveLength(3);
    expect(subtrees[0]?.base.dNSName).toBe('local');
    // asn1-x509 restitue l'adresse et le masque sous forme d'octets.
    expect(subtrees[1]?.base.iPAddress).toBeDefined();
  });

  it('rejette une plage invalide', () => {
    expect(() => encodeNameConstraints({ dns: [], ipv4: ['300.1.1.1/8'] })).toThrow();
  });
});

describe('certificats', () => {
  it('émet un certificat serveur signé par l’autorité, avec les bons noms', async () => {
    const ca = await createCertificateAuthority();
    const names = { dns: ['localhost', '11tv.local'], ips: ['127.0.0.1', '192.168.1.23'] };
    const server = await issueServerCertificate(ca, names);

    const caCert = new X509Certificate(ca.certPem);
    const leaf = new X509Certificate(server.certPem);
    expect(caCert.ca).toBe(true);
    expect(leaf.ca).toBe(false);
    expect(leaf.checkIssued(caCert)).toBe(true);
    expect(leaf.verify(caCert.publicKey)).toBe(true);
    expect(sameNames(certificateNames(server.certPem), names)).toBe(true);
    expect(leaf.checkIP('192.168.1.23')).toBe('192.168.1.23');
  });

  it('marque les contraintes de nom de l’autorité comme critiques', async () => {
    const ca = await createCertificateAuthority();
    const ext = new x509.X509Certificate(ca.certPem).getExtension('2.5.29.30');
    expect(ext?.critical).toBe(true);
  });

  it('compare les noms sans tenir compte de l’ordre', () => {
    expect(
      sameNames({ dns: ['a', 'b'], ips: ['1.1.1.1'] }, { dns: ['b', 'a'], ips: ['1.1.1.1'] }),
    ).toBe(true);
    expect(sameNames({ dns: ['a'], ips: ['1.1.1.1'] }, { dns: ['a'], ips: ['1.1.1.2'] })).toBe(
      false,
    );
  });
});
