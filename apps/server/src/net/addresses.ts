import { BlockList, isIPv4 } from 'node:net';
import os from 'node:os';

const privateRanges = new BlockList();
privateRanges.addSubnet('10.0.0.0', 8, 'ipv4');
privateRanges.addSubnet('172.16.0.0', 12, 'ipv4');
privateRanges.addSubnet('192.168.0.0', 16, 'ipv4');
privateRanges.addSubnet('169.254.0.0', 16, 'ipv4');
privateRanges.addSubnet('127.0.0.0', 8, 'ipv4');
privateRanges.addAddress('::1', 'ipv6');
privateRanges.addSubnet('fc00::', 7, 'ipv6');
privateRanges.addSubnet('fe80::', 10, 'ipv6');

/** Retire le préfixe IPv4-mappé (« ::ffff:192.168.1.2 » -> « 192.168.1.2 »). */
export function normalizeAddress(address: string): string {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  return mapped?.[1] ?? address;
}

export function isLoopbackAddress(address: string): boolean {
  const a = normalizeAddress(address);
  return a === '::1' || (isIPv4(a) && a.startsWith('127.'));
}

/** Vrai pour les adresses du réseau local (privées, lien local, boucle locale). */
export function isPrivateAddress(address: string): boolean {
  const a = normalizeAddress(address.split('%')[0] ?? address);
  return privateRanges.check(a, isIPv4(a) ? 'ipv4' : 'ipv6');
}

const VIRTUAL_ADAPTER =
  /vethernet|virtualbox|vmware|hyper-v|wsl|docker|loopback|tailscale|zerotier/i;
const WIRELESS_ADAPTER = /wi-?fi|wireless|wlan/i;

/**
 * Adresses IPv4 privées de la machine sur le réseau local, Wi-Fi en premier,
 * en ignorant les cartes virtuelles (Hyper-V, WSL, VPN…).
 */
export function getLanAddresses(
  interfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]> = os.networkInterfaces(),
): string[] {
  const found: { address: string; wireless: boolean }[] = [];
  for (const [name, infos] of Object.entries(interfaces)) {
    if (!infos || VIRTUAL_ADAPTER.test(name)) continue;
    for (const info of infos) {
      if (info.family !== 'IPv4' || info.internal) continue;
      if (!isPrivateAddress(info.address) || info.address.startsWith('169.254.')) continue;
      found.push({ address: info.address, wireless: WIRELESS_ADAPTER.test(name) });
    }
  }
  found.sort((a, b) => Number(b.wireless) - Number(a.wireless));
  return [...new Set(found.map((f) => f.address))];
}
