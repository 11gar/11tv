import type os from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  getLanAddresses,
  isLoopbackAddress,
  isPrivateAddress,
  normalizeAddress,
} from './addresses';

describe('isPrivateAddress', () => {
  it.each([
    '192.168.1.20',
    '10.0.0.4',
    '172.20.3.1',
    '127.0.0.1',
    '::1',
    '::ffff:192.168.1.5',
    'fe80::1%12',
    'fd12::3',
  ])('%s est local', (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each(['8.8.8.8', '172.32.0.1', '::ffff:1.2.3.4', '2001:db8::1'])(
    '%s est public',
    (address) => {
      expect(isPrivateAddress(address)).toBe(false);
    },
  );
});

describe('isLoopbackAddress / normalizeAddress', () => {
  it('reconnaît la boucle locale sous toutes ses formes', () => {
    expect(isLoopbackAddress('127.0.0.1')).toBe(true);
    expect(isLoopbackAddress('::ffff:127.0.0.1')).toBe(true);
    expect(isLoopbackAddress('::1')).toBe(true);
    expect(isLoopbackAddress('192.168.1.2')).toBe(false);
    expect(normalizeAddress('::ffff:10.0.0.1')).toBe('10.0.0.1');
  });
});

describe('getLanAddresses', () => {
  const iface = (address: string, internal = false): os.NetworkInterfaceInfo => ({
    address,
    family: 'IPv4',
    internal,
    netmask: '255.255.255.0',
    mac: '00:00:00:00:00:00',
    cidr: `${address}/24`,
  });

  it('garde les IPv4 privées, Wi-Fi en premier, sans cartes virtuelles', () => {
    expect(
      getLanAddresses({
        Ethernet: [iface('192.168.0.10')],
        'Wi-Fi': [iface('192.168.1.23')],
        'vEthernet (WSL)': [iface('172.28.0.1')],
        'Loopback Pseudo-Interface 1': [iface('127.0.0.1', true)],
        Autre: [iface('169.254.3.3'), iface('8.8.8.8')],
      }),
    ).toEqual(['192.168.1.23', '192.168.0.10']);
  });
});
