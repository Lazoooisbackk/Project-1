import './styles/main.css';
import { ScrollTrigger } from './utils/gsap.js';
import { $$ } from './utils/dom.js';
import { initScroll } from './scroll.js';
import { initNav } from './nav.js';
import { initTransitions } from './transitions.js';
import { initMagnetic } from './interactions.js';
import { initHero } from './hero.js';
import { initIphones } from './iphone3d.js';
import { initWall } from './sections/wall.js';
import { initScreens } from './sections/screens.js';
import { runLoader, introWillPlay, preloadIntro, releaseLoader } from './loader.js';
import { initManifest } from './sections/manifest.js';
import { initStudio } from './sections/studio.js';
import { initServices } from './sections/services.js';
import { initBooking } from './sections/booking.js';
import { initOffer } from './sections/offer.js';
import { initContact } from './sections/contact.js';
import { initCheck } from './sections/check.js';
import { initWhatsApp } from './sections/whatsapp.js';
import { initFooter } from './sections/footer.js';

document.documentElement.classList.add('js');

const fonts = Promise.all([
  document.fonts.load('700 100px "Geist"'),
  document.fonts.load('500 16px "Geist"'),
  document.fonts.load('500 10px "IBM Plex Mono"'),
]).catch(() => {});

/* Die Ballons für das Intro so früh wie möglich laden, aber nur wenn es spielt */
if (introWillPlay()) preloadIntro();

/* Jeder Teil startet für sich: Ein Fehler in einem Abschnitt darf nie die ganze Seite (oder den Vorhang) blockieren */
const safe = (name, fn) => { try { return fn(); } catch (err) { console.error(`[${name}]`, err); return null; } };

safe('scroll', initScroll);
safe('transitions', initTransitions);
safe('nav', initNav);
const hero = safe('hero', initHero);
// Das schwebende Zeichen oben in der Mitte (heroLogo.js) ist seit 20.11.2026 aus (Lazar). Im Namen bleibt das Chrom-O.

safe('manifest', initManifest);
safe('iphones', initIphones);
safe('wall', initWall);
safe('screens', initScreens);
safe('studio', initStudio);
safe('services', initServices);
safe('booking', initBooking);
safe('offer', initOffer);
const contact = safe('contact', initContact);
safe('check', () => initCheck(contact || {}));
safe('footer', initFooter);
safe('magnetic', initMagnetic);
safe('whatsapp', initWhatsApp);

/* Anker-Links in der Seite über Lenis scrollen */
import('./scroll.js').then(({ scrollTo }) => {
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      /* Sprungziele aus der Leiste landen unter der Leiste, nicht dahinter. Der Start bleibt ganz oben. */
      if (id.length > 1 && document.querySelector(id)) { e.preventDefault(); scrollTo(id, { offset: id === '#stage' || !a.closest('.nav') ? 0 : -88 }); }
    });
  });
});

/* Ohne Start-Bereich oder bei einem Fehler im Intro: Vorhang weg, Seite frei */
(hero ? runLoader({ hero, fonts }) : Promise.reject(new Error('Start-Bereich fehlt')))
  .catch((err) => { console.error('[loader]', err); releaseLoader(hero); })
  .then(() => ScrollTrigger.refresh());
window.addEventListener('load', () => ScrollTrigger.refresh());
window.addEventListener('loader:hero-revealed', () => ScrollTrigger.refresh());
