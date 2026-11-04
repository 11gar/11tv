import { render } from 'preact';
import { App } from './App';
import '@11tv/web/glass.css';
import './styles.css';

const root = document.getElementById('app');
if (root) render(<App />, root);
