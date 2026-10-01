import { gsap } from './utils/gsap.js';
import { $, asset, reducedMotion, isMobile, emit, debounce } from './utils/dom.js';
import { splitChars, splitLines } from './utils/split.js';
import { createStage } from './chromeO.js';
import { createFluid } from './fluidReveal.js';
import { createInkText } from './inkText.js';

export function initHero() {
  const stage = $('#stage'), canvas = $('#gl'), mark = $('#mark'), inner = $('#markInner');
  const charsEl = $('#markChars'), ghost = $('#oGhost'), bl = $('#bl'), readout = $('#readout'), hint = $('#hint');
  const tag = $('.hero__tag');
  const reduce = reducedMotion();

  const split = splitChars(charsEl);
  gsap.set(split.chars, { yPercent: 120 });
  let tagSplit = splitLines(tag);
  gsap.set(tagSplit.lines, { yPercent: 110 });
  window.addEventListener('resize', debounce(() => {
    tagSplit = splitLines(tag);
    gsap.set(tagSplit.lines, { yPercent: revealed ? 0 : 110 });
  }, 250));

  let revealed = false;
  const api = createStage({ canvas, stage, mark, inner, ghost, bl, readout, hint });
  const state = api.state;

  /* Fluid-Maske: Tinte legt schillerndes Weiß frei, Text darunter wird dunkel (inkText) */
  let fluid = null, inkText = null;
  if (state.ok && !reduce) {
    fluid = createFluid(api.renderer, { dyeRes: isMobile() ? 512 : 1024, splatRadius: 0.0014, splatForce: 6000 });
    fluid.resize(stage.clientWidth || 1, stage.clientHeight || 1);
    api.setFluid(fluid);
    /* ?inkdebug=1 füllt den ganzen Hero mit Tinte (Prüfung der Textkopie) */
    const inkDebug = new URLSearchParams(location.search).get('inkdebug') === '1';
    inkText = createInkText({ api, stage, debug: inkDebug });
    if (inkDebug) window.__inkDebug = { ink: api.ink, refresh: inkText.refresh };
    let last = null;
    stage.addEventListener('pointermove', (e) => {
      const r = stage.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = 1 - (e.clientY - r.top) / r.height;
      /* Tinte erst, wenn die dunkle Textkopie bereit ist (nicht während der Buchstaben-Animation) */
      if (last && inkText.ready) {
        const dx = x - last.x, dy = y - last.y;
        if (Math.hypot(dx, dy) > 0.0005) { fluid.splat(x, y, dx, dy, 0.9); inkText.touch(); }
      }
      last = { x, y };
    }, { passive: true });
    stage.addEventListener('pointerleave', () => { last = null; });
    stage.addEventListener('pointerdown', (e) => {
      const r = stage.getBoundingClientRect();
      last = { x: (e.clientX - r.left) / r.width, y: 1 - (e.clientY - r.top) / r.height };
    }, { passive: true });
  }

  /* Optionales Video statt der dunklen Fläche: /public/hero/reveal.mp4 */
  const video = $('.hero__video');
  if (video && state.ok) {
    video.muted = true; video.loop = true; video.playsInline = true;
    video.addEventListener('canplay', () => { api.setVideo(video); if (revealed) video.play().catch(() => {}); }, { once: true });
    video.addEventListener('error', () => { video.remove(); }, { once: true });
    video.src = asset('hero/reveal.mp4');
  }

  /* Render-Loop nur, wenn der Hero sichtbar ist, der Tab aktiv ist und der Loader ihn nicht mehr verdeckt */
  let inView = true;
  const sync = () => {
    const on = revealed && inView && !document.hidden;
    if (on) api.start(); else api.stop();
    if (video) { if (on) video.play().catch(() => {}); else video.pause(); }
  };
  const io = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync(); }, { threshold: 0.01 });
  io.observe(stage);
  document.addEventListener('visibilitychange', sync);

  /* Layout erneut, sobald die Schrift geladen ist (Fit-Text braucht die Metriken) */
  document.fonts.load('500 100px "Newsreader"').then(() => api.layout()).catch(() => {});
  document.fonts.ready.then(() => api.layout());

  function reveal({ instant = false } = {}) {
    if (revealed) return;
    revealed = true;
    emit('loader:hero-reveal-start');
    api.layout();
    sync();
    /* Nach dem Reveal: Buchstaben ohne eigene Grafik-Ebene (optisch gleich), damit die dunkle Textkopie pixelgenau aufliegt */
    const settle = () => { stage.classList.add('is-settled'); emit('loader:hero-revealed'); };
    if (instant || reduce) {
      gsap.set(split.chars, { yPercent: 0 });
      gsap.set(tagSplit.lines, { yPercent: 0 });
      state.scale = 1; state.crumple = 1; state.loaded = true;
      settle();
      return;
    }
    const tl = gsap.timeline({ onComplete: settle });
    tl.to(split.chars, { yPercent: 0, duration: 1.8, ease: 'power4.inOut', stagger: { each: 0.07, from: 'random' } }, 0.2)
      .add(() => { state.loaded = true; }, 1.5)
      .to(state, { scale: 1, duration: 1.1, ease: 'back.out(0.9)' }, 1.5)
      .to(state, { crumple: 1, duration: 1.3, ease: 'power2.inOut' }, 1.5)
      .to(tagSplit.lines, { yPercent: 0, duration: 1.2, ease: 'power4.out', stagger: 0.12 }, 1.9);
  }

  return { ...api, reveal, chars: split.chars, tagLines: tagSplit.lines, fluid };
}
