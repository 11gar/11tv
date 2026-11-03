import type { PairingInfo } from '@11tv/shared';

interface Props {
  pairing: PairingInfo;
}

/** Affiché tant qu'aucun téléphone n'est appairé : marche à suivre, QR code et PIN. */
export function PairingPanel({ pairing }: Props) {
  return (
    <aside class="pairing" aria-label="Associer un téléphone">
      <h2 class="pairing__title">Associer un téléphone</h2>
      <div class="pairing__body">
        {/* SVG généré côté serveur par la bibliothèque qrcode à partir de notre propre URL. */}
        <div class="pairing__qr" dangerouslySetInnerHTML={{ __html: pairing.setupQrSvg }} />
        <ol class="pairing__steps">
          <li>
            Scannez le code ou ouvrez <strong>{pairing.setupUrl}</strong> pour installer le
            certificat.
          </li>
          <li>
            Ouvrez ensuite <strong>{pairing.appUrl}</strong> et saisissez le PIN :
          </li>
        </ol>
      </div>
      <div class="pairing__pin">{pairing.pin}</div>
      <p class="pairing__fingerprint">Empreinte du certificat : {pairing.caFingerprint}</p>
    </aside>
  );
}
