import { gsap, ScrollTrigger } from '../utils/gsap.js';
import { $, $$, clamp, reducedMotion } from '../utils/dom.js';
import { splitChars } from '../utils/split.js';
import { lockScroll, unlockScroll } from '../scroll.js';
import { content } from '../content.js';
import { initHandle } from './handle.js';
import { initChips, refreshChips } from '../utils/chips.js';
import { EMAIL, sendForm, mailtoLink, markWrong, clearWrong } from '../utils/send.js';

export function initContact({ sound } = {}) {
  const section = $('.contact');
  if (!section) return;
  const reduce = reducedMotion();
  initHandle(document);                         // die Instagram-Fläche sitzt jetzt im Abschnitt „Drei Wege“

  const title = $('.contact__title', section);
  const { chars } = splitChars(title);
  gsap.set(chars, { yPercent: reduce ? 0 : 125 });
  if (!reduce) ScrollTrigger.create({ trigger: title, start: 'top 80%', once: true, onEnter: () => gsap.to(chars, { yPercent: 0, duration: 1.4, ease: 'power4.inOut', stagger: { each: 0.03, from: 'start' } }) });

  /* ---------- Formular-Overlay: Projekt anfragen, Website-Check oder Erstgespräch ---------- */
  const overlay = $('.form-overlay'), closeBtn = $('.form-overlay__close'), form = $('.form', overlay);
  const cfg = content.contact.form;
  const titleEl = $('#form-title', overlay), messageLabel = $('[data-form-message-label]', form);
  const errorBox = $('[data-form-error]', form), submitText = $('[data-form-submit]', form), done = $('[data-form-done]', overlay);
  const field = (name) => form.elements[name];
  initChips(form);
  gsap.set(overlay, { autoAlpha: 0 });
  let open = false, opener = null, sending = false;

  const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const type = () => (cfg.types[field('type').value] ? field('type').value : 'projekt');

  /* Hinweise unter den Feldern */
  const clearError = (input) => clearWrong(input, input.closest('.form__field'));
  const clearErrors = () => { $$('.form__field.is-wrong input, .form__field.is-wrong textarea', form).forEach(clearError); errorBox.hidden = true; errorBox.textContent = ''; };
  const wrong = (input, text) => markWrong(input, input.closest('.form__field'), text);
  form.addEventListener('input', (e) => { if (e.target.closest('.form__field.is-wrong')) clearError(e.target); });

  const setType = (t) => {
    const key = cfg.types[t] ? t : 'projekt';
    field('type').value = key;
    refreshChips(form);
    titleEl.textContent = cfg.types[key].title;
    messageLabel.textContent = cfg.types[key].message;
    $$('[data-for]', form).forEach((el) => { el.hidden = el.dataset.for !== key; });
    clearErrors();
  };
  $$('input[name="type"]', form).forEach((r) => r.addEventListener('change', () => setType(r.value)));

  const openForm = (t = 'projekt', from = null) => {
    if (open) return; open = true;
    opener = from || document.activeElement;
    form.hidden = false; done.hidden = true;
    setType(t);
    field('day').min = today();
    overlay.scrollTop = 0;
    overlay.setAttribute('aria-hidden', 'false');
    lockScroll();
    gsap.to(overlay, { autoAlpha: 1, duration: 0.6, ease: 'studio' });
    gsap.fromTo($$('.form-overlay__inner > *', overlay), { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power4.out', stagger: 0.06, delay: 0.2 });
    setTimeout(() => { if (open) field('name').focus({ preventScroll: true }); }, 500);
    if (sound) sound.click();
  };
  const closeForm = () => {
    if (!open) return; open = false;
    overlay.setAttribute('aria-hidden', 'true');
    gsap.to(overlay, { autoAlpha: 0, duration: 0.5, ease: 'studio', onComplete: () => { unlockScroll(); if (!open) { form.hidden = false; done.hidden = true; } } });
    progress = target = 0;
    if (opener && opener.focus && document.contains(opener)) opener.focus({ preventScroll: true });
    opener = null;
  };
  closeBtn.addEventListener('click', closeForm);
  $('[data-form-close]', overlay).addEventListener('click', closeForm);
  $$('[data-open-form]').forEach((b) => b.addEventListener('click', () => openForm(b.dataset.openForm, b)));
  document.addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'Escape') { closeForm(); return; }
    if (e.key !== 'Tab') return;                       // die Tab-Taste bleibt im Formular
    const items = $$('button, a[href], input:not([tabindex="-1"]), select, textarea, [tabindex="0"]', overlay).filter((el) => !el.disabled && el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    else if (!overlay.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  });

  /* Prüfen: gibt die erste falsche Eingabe zurück oder null, wenn alles passt */
  const SITE = /^(https?:\/\/)?([a-z0-9äöüß-]+\.)+[a-z]{2,}([/?#]\S*)?$/i;
  const check = () => {
    clearErrors();
    const bad = [];
    const name = field('name'), email = field('email'), site = field('website'), day = field('day');
    if (name.value.trim().length < 2) { wrong(name, 'Bitte geben Sie Ihren Namen an.'); bad.push(name); }
    if (!EMAIL.test(email.value.trim())) { wrong(email, 'Bitte geben Sie eine gültige E-Mail-Adresse an.'); bad.push(email); }
    if (type() === 'check' && !SITE.test(site.value.trim())) { wrong(site, 'Bitte geben Sie die Adresse Ihrer Website an, zum Beispiel www.beispiel.at.'); bad.push(site); }
    if (type() === 'termin' && day.value && day.value < today()) { wrong(day, 'Bitte wählen Sie einen Tag, der noch kommt.'); bad.push(day); }
    return bad[0] || null;
  };

  /* Die Angaben als Liste: [Bezeichnung, Wert]. Daraus entstehen die gesendeten Daten und der Ersatz-Text für die E-Mail. */
  const collect = () => {
    const t = type();
    const rows = [['Anfrage', cfg.types[t].title], ['Name', field('name').value.trim()], ['E-Mail', field('email').value.trim()]];
    if (t === 'check') rows.push(['Website', field('website').value.trim()]);
    if (t === 'termin') {
      const day = field('day').value;
      rows.push(['Wunschtag', day ? new Date(`${day}T12:00:00`).toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'egal']);
      rows.push(['Uhrzeit', field('time').value || 'egal']);
    }
    const message = field('message').value.trim();
    if (message) rows.push(['Nachricht', message]);
    return rows;
  };
  const subject = () => `${cfg.types[type()].subject} von ${field('name').value.trim()}`;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending) return;
    const first = check();
    if (first) { first.focus(); return; }
    const rows = collect();
    const bot = field('_honey').value !== '';            // nur Spam-Programme füllen dieses Feld aus
    sending = true; form.classList.add('is-sending'); submitText.textContent = 'Wird gesendet …';
    const ok = bot || await sendForm(subject(), rows);
    sending = false; form.classList.remove('is-sending'); submitText.textContent = 'Absenden';
    if (!open) return;
    if (ok) {
      form.reset(); setType('projekt');
      titleEl.textContent = cfg.thanks;                  // die Überschrift wird zur Bestätigung
      form.hidden = true; done.hidden = false;
      overlay.scrollTop = 0;
      done.focus({ preventScroll: true });
      return;
    }
    /* Senden hat nicht geklappt: nichts geht verloren, die Angaben bleiben stehen und gehen als fertige E-Mail auf */
    errorBox.textContent = 'Das Senden hat gerade nicht geklappt. Ihre Angaben sind noch da. ';
    const link = document.createElement('a');
    link.href = mailtoLink(subject(), rows); link.textContent = 'Stattdessen als E-Mail senden';
    errorBox.appendChild(link);
    errorBox.hidden = false;
    link.focus();
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
