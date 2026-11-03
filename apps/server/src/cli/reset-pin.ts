// Réinitialise le PIN : supprime le PIN actuel et toutes les sessions. Au prochain démarrage
// du serveur, un nouveau PIN est généré et affiché sur la TV.
import pino from 'pino';
import { SessionStore } from '../auth/sessions';
import { loadConfig, loadDotEnv } from '../config';
import { SettingsService } from '../settings/settings';

loadDotEnv();
const config = loadConfig();
const log = pino({ level: 'warn' });

const settings = await SettingsService.load(config.paths.settings, log);
await settings.update((s) => ({ ...s, auth: null }));
const sessions = await SessionStore.load(config.paths.sessions, Number.MAX_SAFE_INTEGER, log);
await sessions.revokeAll();

console.log('PIN réinitialisé et téléphones déconnectés.');
console.log('Redémarrez le serveur : un nouveau PIN s’affichera sur la TV.');
