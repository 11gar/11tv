import { render } from 'preact';
import { App } from './App';
import '@11tv/web/glass.css';
import './styles.css';

// L'interface est servie depuis le cache du service worker : sans cela, une nouvelle version
// n'apparaîtrait qu'à la deuxième ouverture. Quand une nouvelle version prend la main, on
// recharge une fois (pas à la toute première installation, où il n'y avait rien avant).
if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
}

const root = document.getElementById('app');
if (root) render(<App />, root);
