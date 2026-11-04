import { SERVICES, type TvState } from '@11tv/shared';
import { useAppSocket } from '@11tv/web';
import { Clock } from './components/Clock';
import { NowPlayingBar } from './components/NowPlayingBar';
import { PairingPanel } from './components/PairingPanel';
import { ServiceTiles } from './components/ServiceTiles';
import { Wallpapers } from './components/Wallpapers';

export function App() {
  const { state, status, send } = useAppSocket<TvState>();

  return (
    <main class="screen">
      <Wallpapers images={state?.wallpapers ?? []} intervalSec={state?.slideIntervalSec ?? 30} />
      <div class="veil" />
      <Clock />
      <ServiceTiles
        services={SERVICES}
        onLaunch={(service) => {
          send({ type: 'launch', service });
        }}
      />
      {state?.pairing ? (
        <PairingPanel pairing={state.pairing} />
      ) : (
        <NowPlayingBar nowPlaying={state?.music.nowPlaying ?? null} />
      )}
      {status !== 'open' && <div class="status-badge">Connexion au serveur…</div>}
    </main>
  );
}
