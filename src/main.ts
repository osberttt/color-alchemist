import '@fontsource-variable/fraunces/wght.css';
import '@fontsource-variable/fraunces/wght-italic.css';
import '@fontsource-variable/inter/wght.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';
import './ui/styles.css';
import './ui/potion-anim.css';
import { goTitle } from './flow';
import { unlockAudio } from './audio/sfx';

window.addEventListener('pointerdown', () => unlockAudio(), { once: true });

window.addEventListener('error', (e) => console.error('Uncaught:', e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => console.error('Unhandled:', e.reason));

goTitle();
