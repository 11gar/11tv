import Fastify from 'fastify';
import { X509Certificate } from 'node:crypto';
import { fastifyLogging, type Logger } from '../log';
import { restrictToPrivateNetwork } from './common';

export interface SetupInfo {
  caCertPem: () => string;
  caFingerprint: () => string;
  appUrls: () => string[];
}

export const CA_DOWNLOAD_PATH = '/11tv-ca.crt';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${String(c.charCodeAt(0))};`);
}

function page(info: SetupInfo): string {
  const links = info
    .appUrls()
    .map((url) => `<li><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></li>`)
    .join('');
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>11TV – Installation</title>
<style>
  body { font-family: system-ui, sans-serif; background: #0d0f14; color: #e8eaf0; margin: 0; padding: 24px 16px; line-height: 1.5; }
  main { max-width: 560px; margin: 0 auto; }
  h1 { font-size: 1.6rem; }
  a { color: #7fb2ff; }
  .button { display: inline-block; background: #3d7bff; color: #fff; padding: 12px 18px; border-radius: 10px; text-decoration: none; font-weight: 600; }
  code { word-break: break-all; background: #1b1f2a; padding: 2px 6px; border-radius: 6px; }
  li { margin-bottom: 8px; }
</style>
</head>
<body><main>
<h1>Installer 11TV sur ce téléphone</h1>
<ol>
  <li>
    <p>Téléchargez le certificat de la Surface :</p>
    <p><a class="button" href="${CA_DOWNLOAD_PATH}">Télécharger le certificat</a></p>
  </li>
  <li>
    <p>Installez-le : <strong>Paramètres → Sécurité et confidentialité → Plus de paramètres de sécurité →
    Chiffrement et identifiants → Installer un certificat → Certificat CA</strong>
    (le chemin varie un peu selon les téléphones).</p>
    <p>Vérifiez que son empreinte correspond à celle affichée sur la TV :<br><code>${escapeHtml(info.caFingerprint())}</code></p>
  </li>
  <li>
    <p>Ouvrez 11TV dans Chrome, entrez le PIN affiché sur la TV, puis
    <strong>menu ⋮ → Ajouter à l'écran d'accueil</strong> :</p>
    <ul>${links}</ul>
  </li>
</ol>
</main></body>
</html>`;
}

/**
 * Petit serveur HTTP qui ne sert que la page d'installation et le certificat public de
 * l'autorité locale (rien de secret), pour amorcer la confiance HTTPS sur le téléphone.
 */
export function buildSetupApp(log: Logger, info: SetupInfo) {
  const app = Fastify(fastifyLogging(log, 'installation'));
  restrictToPrivateNetwork(app);

  app.get('/', async (_req, reply) => reply.type('text/html; charset=utf-8').send(page(info)));

  app.get(CA_DOWNLOAD_PATH, async (_req, reply) =>
    reply
      .type('application/x-x509-ca-cert')
      .header('Content-Disposition', 'attachment; filename="11tv-ca.crt"')
      .send(new X509Certificate(info.caCertPem()).raw),
  );

  return app;
}
