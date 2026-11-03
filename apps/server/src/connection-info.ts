import type { PairingInfo } from '@11tv/shared';
import QRCode from 'qrcode';
import type { AppConfig } from './config';

/**
 * Adresses auxquelles le téléphone joint la Surface. Sans IP fixe, elles peuvent changer :
 * elles sont recalculées (avec le QR code) à chaque changement d'adresse.
 */
export class ConnectionInfo {
  private ips: string[] = [];
  private setupQrSvg = '';

  constructor(private readonly config: AppConfig) {}

  async update(ips: string[]): Promise<void> {
    this.ips = ips;
    this.setupQrSvg = await QRCode.toString(this.setupUrl, {
      type: 'svg',
      margin: 1,
      errorCorrectionLevel: 'M',
    });
  }

  get primaryHost(): string {
    return this.ips[0] ?? '127.0.0.1';
  }

  get setupUrl(): string {
    return `http://${this.primaryHost}:${String(this.config.ports.setup)}/`;
  }

  /** Adresse IP d'abord (fiable), nom mDNS ensuite (pratique si Android le résout). */
  get appUrls(): string[] {
    const port = String(this.config.ports.https);
    return [...this.ips, this.config.hostname].map((host) => `https://${host}:${port}/`);
  }

  pairing(pin: string | null, caFingerprint: string): PairingInfo | null {
    if (!pin) return null;
    return {
      pin,
      appUrl: this.appUrls[0] ?? '',
      setupUrl: this.setupUrl,
      setupQrSvg: this.setupQrSvg,
      caFingerprint,
    };
  }
}
