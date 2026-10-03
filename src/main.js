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
import { initSiteBackground } from './siteBackground.js';
import { runLoader, introWillPlay } from './loader.js';
import { preloadMaterials } from './materials.js';
import { initManifest } from './sections/manifest.js';
import { initWorks } from './sections/works.js';
import { initServices } from './sections/services.js';
import { initStudio } from './sections/studio.js';
import { initReel } from './sections/reel.js';
import { initPlay } from './sections/play.js';
import { initContact } from './sections/contact.js';
import { initFooter } from './sections/footer.js';

document.documentElement.classList.add('js');

const fonts = Promise.all([
  document.fonts.load('500 100px "Newsreader"'),
  document.fonts.load('400 16px "Geist"'),
  document.fonts.load('600 100px "Geist"'),
  document.fonts.load('400 11px "Geist Mono"'),
]).catch(() => {});

/* Die Material-Os so früh wie möglich laden, aber nur wenn das Intro spielt */
if (introWillPlay()) preloadMaterials();

initScroll();
initGrain();
initTransitions();
const sound = initSound();
initNav({ sound });
const cursor = initCursor();
const hero = initHero();
/* nach dem Hero, damit ein fehlendes WebGL (.no-gl) schon erkannt ist; läuft erst, wenn das Intro den Hero freigibt */
initSiteBackground({ waitFor: 'loader:hero-reveal-start' });

initManifest();
initReel();
initWorks({ cursor });
initServices();
initStudio();
initPlay({ cursor });
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

runLoader({ hero, fonts }).then(() => {
  ScrollTrigger.refresh();
});
window.addEventListener('load', () => ScrollTrigger.refresh());
window.addEventListener('loader:hero-revealed', () => ScrollTrigger.refresh());
