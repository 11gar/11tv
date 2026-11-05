import type { TvState } from '@11tv/shared';
import { useAppSocket, Wallpapers } from '@11tv/web';
import { CardSlot } from './cards/CardSlot';
import { Clock } from './components/Clock';
import { NowPlayingBar } from './components/NowPlayingBar';
import { PairingPanel } from './components/PairingPanel';

/** Écran d'accueil : on le pilote depuis le téléphone, il n'a donc rien d'interactif. */
export function App() {
  const { state, status } = useAppSocket<TvState>();

  return (
    <main class="screen">
      <Wallpapers images={state?.wallpapers ?? []} intervalSec={state?.slideIntervalSec ?? 30} />
      <div class="veil" />
      <Clock />
      <CardSlot slot="left" cards={state?.cards ?? []} />
      <CardSlot slot="right" cards={state?.cards ?? []} />
      {state?.pairing && <PairingPanel pairing={state.pairing} />}
      <NowPlayingBar nowPlaying={state?.music.nowPlaying ?? null} />
      {status !== 'open' && <div class="status-badge glass">Connexion au serveur…</div>}
    </main>
  );
}
