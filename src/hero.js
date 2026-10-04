import { gsap, ScrollTrigger } from './utils/gsap.js';
import { $, $$, reducedMotion, emit } from './utils/dom.js';
import { buildWordmark } from './utils/wordmarkSvg.js';
import { createHeroStage } from './heroStage.js';

export function initHero() {
  const stage = $('#stage'), canvas = $('#gl'), mark = $('#mark');
  const reduce = reducedMotion();

  /* Wortmarke: Buchstaben als SVG-Pfade, das O bleibt frei für das Chrom-O */
  const { svg, letters, o } = buildWordmark();
  mark.appendChild(svg);
  gsap.set(letters, { yPercent: 120 });
  const tagLines = $$('.hero__tag .line', stage);
  const fades = $$('.hero__top .magnetic, .hero__bar', stage);
  gsap.set(tagLines, { yPercent: 115 });
  gsap.set(fades, { opacity: 0 });

  let revealed = false;
  const api = createHeroStage({ canvas, stage, svg, ghost: o, reduce });
  const state = api.state;

  /* Klick oder Tipp auf die freie Fläche: das O dreht sich einmal und knittert neu */
  stage.addEventListener('click', (e) => { if (!e.target.closest('a, button')) api.crumpleAgain(); });

  /* Rendern nur, wenn der Start sichtbar ist, der Tab aktiv ist und das Intro ihn nicht mehr verdeckt */
  let inView = true;
  const sync = () => {
    const on = revealed && inView && !document.hidden;
    if (on) api.start(); else api.stop();
  };
  new IntersectionObserver(([entry]) => { inView = entry.intersectionRatio > 0.12; sync(); }, { threshold: [0, 0.12, 0.3] }).observe(stage);
  document.addEventListener('visibilitychange', sync);
  document.fonts.ready.then(() => api.layout());

  /* Das Zeichen „gO“ oben links erscheint erst, wenn der Start vorbei ist */
  ScrollTrigger.create({
    trigger: stage, start: 'bottom top+=72',
    onEnter: () => document.body.classList.add('is-past-hero'),
    onLeaveBack: () => document.body.classList.remove('is-past-hero'),
  });

  /* Nach dem Auftritt: die Buchstaben wandern in die Leinwand, ab jetzt kann man wischen */
  const settle = () => {
    stage.classList.add('is-settled');
    if (api.bake()) {
      gsap.set(letters, { autoAlpha: 0 });
      /* ?foil=1 zeigt die ganze Fläche als Folienwelt (zum Prüfen und für das Vorschaubild) */
      if (new URLSearchParams(location.search).get('foil') === '1') api.fill(1);
    }
    emit('loader:hero-revealed');
  };

  function reveal({ instant = false } = {}) {
    if (revealed) return;
    revealed = true;
    emit('loader:hero-reveal-start');
    api.layout();
    sync();
    if (instant || reduce) {
      gsap.set(letters, { yPercent: 0 });
      gsap.set(tagLines, { yPercent: 0 });
      gsap.set(fades, { opacity: 1 });
      state.scale = 1; state.crumple = 1;
      settle();
      return;
    }
    const order = gsap.utils.shuffle(letters.slice());
    const tl = gsap.timeline({ onComplete: settle });
    tl.to(order, { yPercent: 0, duration: 1.8, ease: 'power4.inOut', stagger: 0.07 }, 0.2)
      .to(state, { scale: 1, duration: 1.1, ease: 'back.out(0.9)' }, 1.5)
      .to(state, { crumple: 1, duration: 1.3, ease: 'power2.inOut' }, 1.5)
      .to(tagLines, { yPercent: 0, duration: 1.2, ease: 'power4.out', stagger: 0.1 }, 1.3)
      .to(fades, { opacity: 1, duration: 0.8, ease: 'none', stagger: 0.1 }, 1.6);
  }

  return { ...api, state, reveal };
}
