/*
  Drei Wege und die Notiz. Die Notiz ist ein leerer weißer Kasten: Der Besucher schreibt hinein, wie seine Website
  werden soll. Beim Senden fragt derselbe Kasten einmal nach der E-Mail-Adresse, dann geht die Notiz als E-Mail ab,
  auf die sich direkt antworten lässt (src/utils/send.js).
  Ob unter den Namen Preise stehen, entscheidet src/content.js (offer.showPrices).
*/
import { gsap, ScrollTrigger } from '../utils/gsap.js';
import { $, $$, reducedMotion, debounce } from '../utils/dom.js';
import { splitLines } from '../utils/split.js';
import { EMAIL, sendForm, mailtoLink } from '../utils/send.js';
import { scrollTo } from '../scroll.js';
import { content } from '../content.js';

export function initOffer() {
  const section = $('.offer');
  if (!section) return;
  const cfg = content.offer;
  const reduce = reducedMotion();

  /* Preise nur zeigen, wenn sie eingeschaltet sind */
  $$('[data-price]', section).forEach((el) => {
    el.textContent = cfg.showPrices ? cfg.prices[el.dataset.price] : '';
    el.hidden = !cfg.showPrices;
  });

  /* ---------- Notiz ---------- */
  const note = $('[data-note]', section);
  const bubble = $('[data-note-bubble]', note), done = $('[data-note-done]', note);
  const mailBox = $('[data-note-mail]', note), hint = $('[data-note-hint]', note);
  const text = note.elements.notiz, email = note.elements.email;
  let sending = false;
  $('[data-note-thanks]', note).textContent = cfg.note.thanks;

  /* Der Kasten wächst mit dem Text; der Sende-Knopf ist grau, solange nichts drinsteht */
  const grow = () => { text.style.height = 'auto'; text.style.height = `${text.scrollHeight}px`; };
  const mark = () => note.classList.toggle('is-empty', !text.value.trim());
  const say = (message) => { hint.textContent = message || ''; hint.hidden = !message; };
  text.addEventListener('input', () => { grow(); mark(); say(''); });
  email.addEventListener('input', () => say(''));
  window.addEventListener('resize', debounce(grow, 200));
  mark();

  /* Ein Klick irgendwo in den Kasten setzt die Schreibmarke hinein */
  bubble.addEventListener('click', (e) => { if (e.target === bubble) (mailBox.hidden ? text : email).focus(); });

  /* Der Pfeil bei „Betreuung“ führt zur Notiz */
  $$('[data-to-note]', section).forEach((btn) => btn.addEventListener('click', () => {
    if (bubble.hidden) { bubble.hidden = false; done.hidden = true; note.classList.remove('is-done'); }
    scrollTo(note, { offset: -90 });
    setTimeout(() => text.focus({ preventScroll: true }), reduce ? 0 : 900);
  }));

  note.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending) return;
    const message = text.value.trim();
    if (!message) { say('Bitte schreiben Sie zuerst ein paar Stichworte in den Kasten.'); text.focus(); return; }
    if (mailBox.hidden) {                                // erster Klick: nach der Adresse für die Antwort fragen
      mailBox.hidden = false; say('');
      email.focus({ preventScroll: true });
      ScrollTrigger.refresh();
      return;
    }
    const address = email.value.trim();
    if (!EMAIL.test(address)) { say('Bitte geben Sie eine gültige E-Mail-Adresse an, damit ich antworten kann.'); email.focus(); return; }

    const rows = [['Anfrage', cfg.note.subject], ['Notiz', message], ['E-Mail', address]];
    const subject = `${cfg.note.subject} von ${address}`;
    const bot = note.elements._honey.value !== '';       // nur Spam-Programme füllen dieses Feld aus
    sending = true; note.classList.add('is-sending'); say('');
    const ok = bot || await sendForm(subject, rows);
    sending = false; note.classList.remove('is-sending');
    if (ok) {
      note.reset(); mailBox.hidden = true; grow(); mark();
      bubble.hidden = true; done.hidden = false; note.classList.add('is-done');
      done.focus({ preventScroll: true });
      ScrollTrigger.refresh();
      return;
    }
    /* Senden hat nicht geklappt: die Notiz bleibt stehen und geht als fertige E-Mail auf */
    say('Das Senden hat gerade nicht geklappt. Ihre Notiz ist noch da. ');
    const link = document.createElement('a');
    link.href = mailtoLink(subject, rows); link.textContent = 'Stattdessen als E-Mail senden';
    hint.appendChild(link);
    link.focus();
  });

  /* ---------- Einblenden beim Hinscrollen, wie in den anderen Abschnitten ---------- */
  if (reduce) return;
  const title = $('.offer__title', section);
  let { lines } = splitLines(title);
  let shown = false;
  gsap.set(lines, { yPercent: 110 });
  ScrollTrigger.create({ trigger: title, start: 'top 85%', once: true, onEnter: () => { shown = true; gsap.to(lines, { yPercent: 0, duration: 1.2, ease: 'power4.out', stagger: 0.08 }); } });
  window.addEventListener('resize', debounce(() => { ({ lines } = splitLines(title)); gsap.set(lines, { yPercent: shown ? 0 : 110 }); }, 250));
  [['.pack', '.offer__packs'], ['.note__title, .note__bubble, .note__intro', '.note'], ['.more', '.offer__more']].forEach(([items, trigger]) => {
    const els = $$(items, section);
    gsap.set(els, { y: 28, opacity: 0 });
    ScrollTrigger.create({ trigger: $(trigger, section), start: 'top 88%', once: true, onEnter: () => gsap.to(els, { y: 0, opacity: 1, duration: 1, ease: 'power4.out', stagger: 0.08, clearProps: 'transform,opacity' }) });
  });
}
