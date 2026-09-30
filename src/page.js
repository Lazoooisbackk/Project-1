/* Einstieg für Impressum und Datenschutz */
import './styles/main.css';
import { initScroll } from './scroll.js';
import { initGrain } from './grain.js';
import { initNav } from './nav.js';
import { initTransitions } from './transitions.js';
import { initSound } from './sound.js';
import { initMagnetic } from './interactions.js';
import { initSiteBackground } from './siteBackground.js';

document.documentElement.classList.add('js');
initScroll();
initSiteBackground();
initGrain();
initTransitions();
const sound = initSound();
initNav({ sound });
initMagnetic();
const year = document.querySelector('[data-year]');
if (year) year.textContent = String(new Date().getFullYear());
