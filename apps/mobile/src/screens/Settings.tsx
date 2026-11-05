import { logout } from '../api';
import { displayMode } from '../display-mode';
import { ModuleSettings } from '../components/ModuleSettings';
import { PinSettings } from '../components/PinSettings';
import { SlideIntervalSettings } from '../components/SlideIntervalSettings';
import { UpdateSettings } from '../components/UpdateSettings';
import { WallpaperSettings } from '../components/WallpaperSettings';
import type { ScreenProps } from '../Shell';

const MODE_LABELS: Record<string, string> = {
  fullscreen: 'plein écran',
  standalone: 'application',
  'minimal-ui': 'application (barre minimale)',
  browser: 'navigateur',
};

/** Version et mode d'affichage, pour diagnostiquer un souci sur le téléphone. */
function DisplayInfo() {
  const mode = displayMode();
  return (
    <p class="diagnostics muted">
      Version du {__BUILD_ID__} · affichage : {MODE_LABELS[mode] ?? mode}
    </p>
  );
}

interface Props extends ScreenProps {
  onLogout: () => void;
}

export function Settings({ state, send, notify, onLogout }: Props) {
  return (
    <div class="stack">
      <ModuleSettings modules={state?.modules ?? []} send={send} />
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
      <UpdateSettings />
      <button
        type="button"
        class="link"
        onClick={() => {
          void logout().finally(onLogout);
        }}
      >
        Se déconnecter
      </button>
      <DisplayInfo />
    </div>
  );
}
