/*
  Erstgespräch buchen: Tag wählen, Uhrzeit wählen, Namen eintragen. Die Anfrage geht als fertige WhatsApp-Nachricht
  an Lazar, er bestätigt den Termin im Chat. Es gibt keinen Kalender im Hintergrund und nichts wird gespeichert.
  Wunschzeiten je Wochentag: src/content.js → booking.slots.
*/
import { $ } from '../utils/dom.js';
import { content } from '../content.js';

export function initBooking() {
  const form = $('#book');
  if (!form) return;
  const { mode, phone, mail, days: count, slots } = content.booking;
  /* Standard ist die einfache Karte. Nur im Modus „kalender“ tauscht die Buchung mit Tag und Uhrzeit sie aus. */
  if (mode !== 'kalender') return;
  const quick = $('#quick'); if (quick) quick.hidden = true;
  form.hidden = false;
  const daysEl = $('#book-days', form), timesEl = $('#book-times', form), sum = $('#book-summary', form);
  const hint = $('#book-hint', form), mailLink = $('#book-mail', form);
  const fmtDay = new Intl.DateTimeFormat('de-AT', { weekday: 'short' });
  const fmtDate = new Intl.DateTimeFormat('de-AT', { day: 'numeric', month: 'numeric' });
  const fmtLong = new Intl.DateTimeFormat('de-AT', { weekday: 'long', day: 'numeric', month: 'long' });
  const state = { day: null, time: null };

  /* Die nächsten Tage mit Wunschzeiten, ab morgen */
  const days = [];
  const d = new Date(); d.setHours(12, 0, 0, 0);
  for (let i = 0; days.length < count && i < 60; i++) { d.setDate(d.getDate() + 1); if (slots[d.getDay()]?.length) days.push(new Date(d)); }

  const chip = (cls, onPick) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'slot ' + cls;
    b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', 'false');
    b.addEventListener('click', () => onPick(b));
    return b;
  };
  const pick = (group, b) => group.querySelectorAll('.slot').forEach((c) => c.setAttribute('aria-checked', String(c === b)));
  const name = () => form.elements.name.value.trim(), firm = () => form.elements.betrieb.value.trim();
  const message = () => `Grüß Gott, Lazar! Ich möchte ein Erstgespräch am ${fmtLong.format(state.day)} um ${state.time} Uhr.`
    + (name() ? ` Mein Name: ${name()}.` : '') + (firm() ? ` Mein Betrieb: ${firm()}.` : '');

  const update = () => {
    hint.textContent = ''; hint.classList.remove('is-error');
    if (state.day && state.time) {
      sum.textContent = `Ihr Wunschtermin: ${fmtLong.format(state.day)}, ${state.time} Uhr`;
      mailLink.href = `mailto:${mail}?subject=${encodeURIComponent('Erstgespräch')}&body=${encodeURIComponent(message())}`;
    } else {
      sum.textContent = state.day ? 'Wählen Sie jetzt eine Uhrzeit.' : 'Wählen Sie zuerst einen Tag und eine Uhrzeit.';
      mailLink.href = `mailto:${mail}?subject=${encodeURIComponent('Erstgespräch')}`;
    }
  };
  const showTimes = () => {
    timesEl.replaceChildren(); state.time = null;
    if (!state.day) {
      const p = document.createElement('p'); p.className = 'slots__empty';
      p.textContent = 'Die Uhrzeiten erscheinen, sobald Sie einen Tag gewählt haben.';
      timesEl.append(p); return;
    }
    slots[state.day.getDay()].forEach((t) => {
      const b = chip('', (el) => { state.time = t; pick(timesEl, el); update(); });
      b.textContent = t; timesEl.append(b);
    });
  };
  days.forEach((day) => {
    const b = chip('slot--day', (el) => { state.day = day; pick(daysEl, el); showTimes(); update(); });
    const small = document.createElement('small'); small.textContent = fmtDay.format(day).replace('.', '');
    b.append(small, fmtDate.format(day));
    b.setAttribute('aria-label', fmtLong.format(day));
    daysEl.append(b);
  });
  showTimes(); update();
  form.addEventListener('input', update);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const err = (text, el) => { hint.textContent = text; hint.classList.add('is-error'); el?.focus(); };
    if (!state.day) return err('Bitte wählen Sie einen Tag.', $('.slot', daysEl));
    if (!state.time) return err('Bitte wählen Sie eine Uhrzeit.', $('.slot', timesEl));
    if (!name()) return err('Bitte tragen Sie Ihren Namen ein.', form.elements.name);
    const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message())}`;
    hint.classList.remove('is-error');
    hint.textContent = 'WhatsApp ist geöffnet. Tippen Sie dort auf Senden, ich bestätige den Termin im Chat.';
    /* Am Handy im selben Tab (springt direkt in die App), am Computer ein neuer Tab für WhatsApp Web (wie src/sections/whatsapp.js) */
    if (window.matchMedia('(pointer: coarse)').matches) window.location.href = url;
    else window.open(url, '_blank', 'noopener');
  });
}
