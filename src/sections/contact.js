import { gsap, ScrollTrigger } from '../utils/gsap.js';
import { $, $$, clamp, reducedMotion } from '../utils/dom.js';
import { splitChars } from '../utils/split.js';
import { lockScroll, unlockScroll } from '../scroll.js';
import { content } from '../content.js';

export function initContact({ sound } = {}) {
  const section = $('.contact');
  if (!section) return;
  const reduce = reducedMotion();

  const title = $('.contact__title', section);
  const { chars } = splitChars(title);
  gsap.set(chars, { yPercent: reduce ? 0 : 120 });
  if (!reduce) ScrollTrigger.create({ trigger: title, start: 'top 80%', once: true, onEnter: () => gsap.to(chars, { yPercent: 0, duration: 1.4, ease: 'power4.inOut', stagger: { each: 0.03, from: 'random' } }) });

  /* Formular-Overlay */
  const overlay = $('.form-overlay'), closeBtn = $('.form-overlay__close'), form = $('.form', overlay);
  gsap.set(overlay, { autoAlpha: 0 });
  let open = false;
  const openForm = () => {
    if (open) return; open = true;
    overlay.setAttribute('aria-hidden', 'false');
    lockScroll();
    gsap.to(overlay, { autoAlpha: 1, duration: 0.6, ease: 'studio' });
    gsap.fromTo($$('.form-overlay__inner > *', overlay), { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power4.out', stagger: 0.06, delay: 0.2 });
    setTimeout(() => { const f = $('input', form); if (f) f.focus(); }, 500);
    if (sound) sound.click();
  };
  const closeForm = () => {
    if (!open) return; open = false;
    overlay.setAttribute('aria-hidden', 'true');
    gsap.to(overlay, { autoAlpha: 0, duration: 0.5, ease: 'studio', onComplete: unlockScroll });
    progress = target = 0;
  };
  closeBtn.addEventListener('click', closeForm);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) closeForm(); });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const body = `Name: ${data.get('name')}\nE-Mail: ${data.get('email')}\n\n${data.get('message')}`;
    window.location.href = `mailto:${content.contact.form.mailto}?subject=${encodeURIComponent(content.contact.form.subject)}&body=${encodeURIComponent(body)}`;
  });

  /* Weiterscrollen am Seitenende füllt die Zeitleiste; voll = Formular öffnet sich */
  const bar = $('.contact__timeline i', section);
  let target = 0, progress = 0, lastTouch = null;
  const atBottom = () => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
  const push = (delta) => { if (open || !atBottom() || delta <= 0) return; target = clamp(target + delta / 2600, 0, 1); };
  window.addEventListener('wheel', (e) => push(e.deltaY), { passive: true });
  window.addEventListener('touchstart', (e) => { lastTouch = e.touches[0].clientY; }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    const y = e.touches[0].clientY;
    if (lastTouch !== null) push((lastTouch - y) * 2.5);
    lastTouch = y;
  }, { passive: true });
  gsap.ticker.add(() => {
    if (!open && target > 0 && !atBottom()) target = 0;
    if (!open && target > 0) target = Math.max(0, target - 0.0012);
    progress += (target - progress) * 0.12;
    bar.style.transform = `scaleX(${progress.toFixed(4)})`;
    if (progress >= 0.985 && !open) openForm();
  });

  return { openForm, closeForm };
}
