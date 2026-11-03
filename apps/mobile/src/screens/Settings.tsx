import { logout } from '../api';
import { PinSettings } from '../components/PinSettings';
import { SlideIntervalSettings } from '../components/SlideIntervalSettings';
import { WallpaperSettings } from '../components/WallpaperSettings';
import type { ScreenProps } from '../Shell';

interface Props extends ScreenProps {
  onLogout: () => void;
}

export function Settings({ state, send, notify, onLogout }: Props) {
  return (
    <div class="stack">
      <WallpaperSettings wallpapers={state?.wallpapers ?? []} send={send} notify={notify} />
      {state && (
        <SlideIntervalSettings
          seconds={state.slideIntervalSec}
          onChange={(seconds) => {
            send({ type: 'set-slide-interval', seconds });
          }}
        />
      )}
      <PinSettings notify={notify} />
      <button
        type="button"
        class="link"
        onClick={() => {
          void logout().finally(onLogout);
        }}
      >
        Se déconnecter
      </button>
    </div>
  );
}
