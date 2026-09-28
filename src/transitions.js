/* Seitenwechsel: schwarzer Vorhang (0.8 s, studio) mit Mini-Zähler. */
import { gsap } from './utils/gsap.js';
import { pad3, session, reducedMotion } from './utils/dom.js';

const KEY = 'gs-transition';

export function initTransitions() {
  const curtain = document.createElement('div');
  curtain.className = 'curtain';
  curtain.setAttribute('aria-hidden', 'true');
  curtain.innerHTML = '<span class="curtain__count">000</span>';
  document.body.appendChild(curtain);
  const count = curtain.firstElementChild;
  const reduce = reducedMotion();
  gsap.set(curtain, { yPercent: 101, visibility: 'visible' });

  /* Ankunft: Vorhang liegt über der Seite und hebt sich */
  if (session.get(KEY)) {
    session.set(KEY, '');
    gsap.set(curtain, { yPercent: 0 });
    curtain.classList.add('is-active');
    const c = { v: 0 };
    gsap.timeline()
      .to(c, { v: 100, duration: reduce ? 0.2 : 0.6, ease: 'power2.inOut', onUpdate: () => { count.textContent = pad3(c.v); } })
      .to(curtain, { yPercent: -101, duration: reduce ? 0.2 : 0.8, ease: 'studio', onComplete: () => curtain.classList.remove('is-active') }, reduce ? 0 : 0.35);
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
    const href = a.getAttribute('href') || '';
    if (!/^(\.\/)?[\w-]+\.html(#[\w-]*)?$/.test(href) && !/^(\.\/)?index\.html$/.test(href)) return;
    e.preventDefault();
    session.set(KEY, '1');
    curtain.classList.add('is-active');
    count.textContent = '000';
    const c = { v: 0 };
    gsap.timeline({ onComplete: () => { window.location.href = href; } })
      .fromTo(curtain, { yPercent: 101 }, { yPercent: 0, duration: reduce ? 0.2 : 0.8, ease: 'studio' })
      .to(c, { v: 100, duration: reduce ? 0.2 : 0.6, ease: 'power2.inOut', onUpdate: () => { count.textContent = pad3(c.v); } }, 0.2);
  });
}
