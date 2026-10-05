/*
  Pakete und Notiz. Die Notiz ist eine Tabelle zum Hineinschreiben: Der Besucher beschreibt in Stichworten, wie seine
  Website werden soll, und schickt sie ab. Sie kommt als E-Mail an, auf die sich direkt antworten lässt (src/utils/send.js).
  Ob unter den Paketen Preise stehen, entscheidet src/content.js (offer.showPrices).
*/
import { gsap, ScrollTrigger } from '../utils/gsap.js';
import { $, $$, reducedMotion, debounce } from '../utils/dom.js';
import { splitLines } from '../utils/split.js';
import { initChips, refreshChips } from '../utils/chips.js';
import { EMAIL, sendForm, mailtoLink, markWrong, clearWrong } from '../utils/send.js';
import { scrollTo } from '../scroll.js';
import { content } from '../content.js';

export function initOffer() {
  const section = $('.offer');
  if (!section) return;
  const cfg = content.offer;
  const reduce = reducedMotion();
  initChips(section);

  /* Preise nur zeigen, wenn sie eingeschaltet sind */
  $$('[data-price]', section).forEach((el) => {
    el.textContent = cfg.showPrices ? cfg.prices[el.dataset.price] : '';
    el.hidden = !cfg.showPrices;
  });

  /* ---------- Notiz ---------- */
  const note = $('[data-note]', section);
  const sheet = $('[data-note-sheet]', note), done = $('[data-note-done]', note);
  const errorBox = $('[data-note-error]', note), submitText = $('[data-note-submit]', note);
  const field = (name) => note.elements[name];
  const areas = $$('textarea', note);
  let sending = false;
  $('[data-note-thanks]', note).textContent = cfg.note.thanks;

  /* Die Zeilen wachsen mit dem Text. Leer sind sie so hoch, dass der Beispieltext ganz zu lesen ist (am Handy bricht er um). */
  const grow = (el) => { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; };
  const fit = (el) => {
    const text = el.value;
    el.style.minHeight = ''; el.style.height = 'auto';
    el.value = el.placeholder; el.style.minHeight = `${el.scrollHeight}px`;
    el.value = text; grow(el);
  };
  areas.forEach((el) => el.addEventListener('input', () => grow(el)));
  window.addEventListener('resize', debounce(() => areas.forEach(fit), 200));
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => areas.forEach(fit));

  const box = (input) => input.closest('.note__row');
  const clearErrors = () => { $$('.note__row.is-wrong', note).forEach((r) => clearWrong($('input, textarea', r), r)); errorBox.hidden = true; errorBox.textContent = ''; };
  note.addEventListener('input', (e) => { const r = e.target.closest('.note__row.is-wrong'); if (r) clearWrong(e.target, r); });

  /* Ein Paket-Knopf hakt das Paket in der Notiz an und führt dorthin */
  $$('[data-pack]', section).forEach((btn) => btn.addEventListener('click', () => {
    const tick = $$('input[name="what"]', note).find((i) => i.value === btn.dataset.pack);
    if (tick) { tick.checked = true; refreshChips(note); }
    if (sheet.hidden) { sheet.hidden = false; done.hidden = true; note.classList.remove('is-done'); }
    scrollTo(note, { offset: -80 });
    setTimeout(() => areas[0].focus({ preventScroll: true }), reduce ? 0 : 900);
  }));

  const collect = () => {
    const rows = [['Anfrage', cfg.note.subject]];
    const what = $$('input[name="what"]:checked', note).map((i) => i.value);
    if (what.length) rows.push(['Gewünscht', what.join(', ')]);
    areas.forEach((el) => { const v = el.value.trim(); if (v) rows.push([$(`label[for="${el.id}"]`, note).textContent.trim(), v]); });
    rows.push(['Name', field('name').value.trim()], ['E-Mail', field('email').value.trim()]);
    return rows;
  };

  note.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending) return;
    clearErrors();
    const bad = [];
    const name = field('name'), email = field('email');
    const empty = !areas.some((el) => el.value.trim()) && !$$('input[name="what"]:checked', note).length;
    if (empty) { markWrong(areas[0], box(areas[0]), 'Bitte schreiben Sie ein paar Stichworte, was Sie sich vorstellen.'); bad.push(areas[0]); }
    if (name.value.trim().length < 2) { markWrong(name, box(name), 'Bitte geben Sie Ihren Namen an.'); bad.push(name); }
    if (!EMAIL.test(email.value.trim())) { markWrong(email, box(email), 'Bitte geben Sie eine gültige E-Mail-Adresse an, damit ich antworten kann.'); bad.push(email); }
    if (bad.length) { bad[0].focus(); return; }

    const rows = collect();
    const subject = `${cfg.note.subject} von ${name.value.trim()}`;
    const bot = field('_honey').value !== '';            // nur Spam-Programme füllen dieses Feld aus
    sending = true; note.classList.add('is-sending'); submitText.textContent = 'Wird gesendet …';
    const ok = bot || await sendForm(subject, rows);
    sending = false; note.classList.remove('is-sending'); submitText.textContent = 'Notiz senden';
    if (ok) {
      note.reset(); refreshChips(note); areas.forEach(grow);
      sheet.hidden = true; done.hidden = false; note.classList.add('is-done');
      done.focus({ preventScroll: true });
      ScrollTrigger.refresh();
      scrollTo(note, { offset: -80, duration: 0.9 });      // die Tabelle ist weg: zur Bestätigung zurückführen
      return;
    }
    /* Senden hat nicht geklappt: die Notiz bleibt stehen und geht als fertige E-Mail auf */
    errorBox.textContent = 'Das Senden hat gerade nicht geklappt. Ihre Notiz ist noch da. ';
    const link = document.createElement('a');
    link.href = mailtoLink(subject, rows); link.textContent = 'Stattdessen als E-Mail senden';
    errorBox.appendChild(link);
    errorBox.hidden = false;
    link.focus();
  });

  /* ---------- Einblenden beim Hinscrollen, wie in den anderen Abschnitten ---------- */
  if (reduce) return;
  [$('.offer__title', section), $('.note__title', section)].forEach((title) => {
    let { lines } = splitLines(title);
    let shown = false;
    gsap.set(lines, { yPercent: 110 });
    ScrollTrigger.create({ trigger: title, start: 'top 85%', once: true, onEnter: () => { shown = true; gsap.to(lines, { yPercent: 0, duration: 1.2, ease: 'power4.out', stagger: 0.08 }); } });
    window.addEventListener('resize', debounce(() => { ({ lines } = splitLines(title)); gsap.set(lines, { yPercent: shown ? 0 : 110 }); }, 250));
  });
  [['.pack', '.offer__packs'], ['.note__intro, .note__sheet', '.note__sheet'], ['.more', '.offer__more']].forEach(([items, trigger]) => {
    const els = $$(items, section);
    gsap.set(els, { y: 28, opacity: 0 });
    ScrollTrigger.create({ trigger: $(trigger, section), start: 'top 88%', once: true, onEnter: () => gsap.to(els, { y: 0, opacity: 1, duration: 1, ease: 'power4.out', stagger: 0.08, clearProps: 'transform,opacity' }) });
  });
}
