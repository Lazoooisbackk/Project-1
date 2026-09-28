import './styles/main.css';
import { gsap, ScrollTrigger } from './utils/gsap.js';
import { $$ } from './utils/dom.js';
import { initScroll } from './scroll.js';
import { initGrain } from './grain.js';
import { initNav } from './nav.js';
import { initCursor } from './cursor.js';
import { initTransitions } from './transitions.js';
import { initSound } from './sound.js';
import { initMagnetic } from './interactions.js';
import { initHero } from './hero.js';
import { runLoader } from './loader.js';
import { loadObjects } from './objects.js';
import { initManifest } from './sections/manifest.js';
import { initWorks } from './sections/works.js';
import { initServices } from './sections/services.js';
import { initStudio } from './sections/studio.js';
import { initContact } from './sections/contact.js';
import { initFooter } from './sections/footer.js';

document.documentElement.classList.add('js');

const fonts = Promise.all([
  document.fonts.load('500 100px "Newsreader"'),
  document.fonts.load('italic 400 20px "Newsreader"'),
  document.fonts.load('400 16px "Geist"'),
  document.fonts.load('400 11px "Geist Mono"'),
]).catch(() => {});

const objects = loadObjects();

initScroll();
initGrain();
initTransitions();
const sound = initSound();
initNav({ sound });
const cursor = initCursor();
const hero = initHero();

initManifest();
initWorks({ cursor, objects });
initServices({ objects });
initStudio();
initContact({ sound });
initFooter();
initMagnetic();

/* Anker-Links in der Seite über Lenis scrollen */
import('./scroll.js').then(({ scrollTo }) => {
  $$('a[href^="#"]').forEach((a) => {
    if (a.closest('.menu')) return;
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length > 1 && document.querySelector(id)) { e.preventDefault(); scrollTo(id); }
    });
  });
});

runLoader({ hero, objects, fonts }).then(() => {
  ScrollTrigger.refresh();
});
window.addEventListener('load', () => ScrollTrigger.refresh());
window.addEventListener('loader:hero-revealed', () => ScrollTrigger.refresh());
