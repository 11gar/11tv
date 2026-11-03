// Encodage DER minimal, juste ce qu'il faut pour l'extension NameConstraints (RFC 5280 §4.2.1.10),
// que @peculiar/x509 ne sait pas construire avec des plages d'adresses IP.

function encodeLength(length: number): Uint8Array {
  if (length < 0x80) return Uint8Array.of(length);
  const bytes: number[] = [];
  for (let n = length; n > 0; n >>= 8) bytes.unshift(n & 0xff);
  return Uint8Array.of(0x80 | bytes.length, ...bytes);
}

export function tlv(tag: number, ...contents: Uint8Array[]): Uint8Array {
  const body = Buffer.concat(contents);
  return Buffer.concat([Uint8Array.of(tag), encodeLength(body.length), body]);
}

const SEQUENCE = 0x30;
/** [0] IMPLICIT, construit : permittedSubtrees. */
const PERMITTED_SUBTREES = 0xa0;
/** GeneralName dNSName [2] IMPLICIT IA5String. */
const DNS_NAME = 0x82;
/** GeneralName iPAddress [7] IMPLICIT OCTET STRING (adresse puis masque). */
const IP_ADDRESS = 0x87;

export interface PermittedNames {
  dns: string[];
  /** Plages IPv4 au format CIDR, ex. « 192.168.0.0/16 ». */
  ipv4: string[];
}

function ipv4Subnet(cidr: string): Uint8Array {
  const [address, bitsText] = cidr.split('/');
  const bits = Number(bitsText);
  const octets = (address ?? '').split('.').map(Number);
  if (
    octets.length !== 4 ||
    octets.some((o) => !(o >= 0 && o <= 255)) ||
    !(bits >= 0 && bits <= 32)
  ) {
    throw new Error(`Plage IPv4 invalide : ${cidr}`);
  }
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return Uint8Array.of(
    ...octets,
    mask >>> 24,
    (mask >>> 16) & 0xff,
    (mask >>> 8) & 0xff,
    mask & 0xff,
  );
}

/** Valeur DER de l'extension NameConstraints, limitée à des sous-arbres autorisés. */
export function encodeNameConstraints(permitted: PermittedNames): Uint8Array {
  const subtrees = [
    ...permitted.dns.map((name) => tlv(SEQUENCE, tlv(DNS_NAME, Buffer.from(name, 'ascii')))),
    ...permitted.ipv4.map((cidr) => tlv(SEQUENCE, tlv(IP_ADDRESS, ipv4Subnet(cidr)))),
  ];
  return tlv(SEQUENCE, tlv(PERMITTED_SUBTREES, ...subtrees));
}
