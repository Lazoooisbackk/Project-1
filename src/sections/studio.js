import { gsap, ScrollTrigger } from '../utils/gsap.js';
import { $, $$, rand, reducedMotion, debounce } from '../utils/dom.js';
import { splitLines } from '../utils/split.js';

export function initStudio() {
  const section = $('.studio');
  if (!section) return;
  const reduce = reducedMotion();

  const portrait = $('.studio__portrait', section), img = $('.studio__img', section);
  if (img) {
    const missing = () => portrait.classList.add('is-missing');
    if (img.complete && img.naturalWidth === 0) missing();
    img.addEventListener('error', missing);
    if (!reduce) gsap.fromTo(img, { yPercent: -5 }, { yPercent: 5, ease: 'none', scrollTrigger: { trigger: portrait, start: 'top bottom', end: 'bottom top', scrub: 1.5 } });
  }

  const text = $('.studio__text', section);
  let { lines } = splitLines(text);
  let shown = reduce;
  gsap.set(lines, { yPercent: reduce ? 0 : 110 });
  if (!reduce) ScrollTrigger.create({ trigger: text, start: 'top 80%', once: true, onEnter: () => { shown = true; gsap.to(lines, { yPercent: 0, duration: 1.2, ease: 'power4.out', stagger: 0.1 }); } });
  window.addEventListener('resize', debounce(() => { ({ lines } = splitLines(text)); gsap.set(lines, { yPercent: shown ? 0 : 110 }); }, 250));

  /* Laufband: Geschwindigkeit reagiert auf Scroll-Tempo, Geister-Zeilen als Textur */
  const marquee = $('.marquee', section);
  const track = $('.marquee__track', marquee);
  const ghosts = $$('.marquee__track--ghost', marquee);
  const fill = (t) => { const base = t.innerHTML; while (t.scrollWidth < window.innerWidth * 2.2) t.innerHTML += base; };
  [track, ...ghosts].forEach(fill);
  if (reduce) return;

  let x = 0, vel = 0, lastY = window.scrollY, half = track.scrollWidth / 2;
  window.addEventListener('resize', () => { half = track.scrollWidth / 2; }, { passive: true });
  let visible = false;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 }).observe(marquee);
  gsap.ticker.add((time, dt) => {
    const y = window.scrollY, dy = y - lastY; lastY = y;
    vel += (Math.abs(dy) - vel) * 0.1;
    if (!visible) return;
    x -= (60 + vel * 4) * (dt / 1000);
    if (x < -half) x += half;
    track.style.transform = `translate3d(${x}px,0,0)`;
    ghosts.forEach((g, i) => { g.style.transform = `translate3d(${x * (1 + (i + 1) * 0.04) + (i + 1) * 6}px,${(i + 1) * 2}px,0)`; });
  });
  setInterval(() => {
    ghosts.forEach((g) => { g.style.opacity = Math.random() < 0.15 ? 0.16 : (g.classList.contains('marquee__track--ghost2') ? 0.05 : 0.08); g.style.marginLeft = `${rand(-4, 4)}px`; });
  }, 320);
}
