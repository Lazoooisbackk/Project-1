import './styles/main.css';
import { ScrollTrigger } from './utils/gsap.js';
import { $$ } from './utils/dom.js';
import { initAutoVideos } from './utils/video.js';
import { initScroll } from './scroll.js';
import { initNav } from './nav.js';
import { initCursor } from './cursor.js';
import { initTransitions } from './transitions.js';
import { initSound } from './sound.js';
import { initMagnetic } from './interactions.js';
import { initHero } from './hero.js';
import { runLoader, introWillPlay, preloadIntro } from './loader.js';
import { initManifest } from './sections/manifest.js';
import { initWorks } from './sections/works.js';
import { initShowreel } from './sections/showreel.js';
import { initStudio } from './sections/studio.js';
import { initServices } from './sections/services.js';
import { initManifestVideo } from './sections/manifestVideo.js';
import { initContact } from './sections/contact.js';
import { initFooter } from './sections/footer.js';

document.documentElement.classList.add('js');

const fonts = Promise.all([
  document.fonts.load('700 100px "Geist"'),
  document.fonts.load('500 16px "Geist"'),
  document.fonts.load('500 10px "IBM Plex Mono"'),
]).catch(() => {});

/* Die Ballons für das Intro so früh wie möglich laden, aber nur wenn es spielt */
if (introWillPlay()) preloadIntro();

initScroll();
initTransitions();
const sound = initSound();
initNav({ sound });
const cursor = initCursor();
const hero = initHero();

initAutoVideos();
initManifest();
initWorks({ cursor });
initShowreel();
initStudio();
initServices();
initManifestVideo();
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
