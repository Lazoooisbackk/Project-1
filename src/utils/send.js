/*
  Formulare absenden. Die Angaben kommen als Liste [Bezeichnung, Wert] und gehen an Web3Forms
  (src/content.js: contact.form.endpoint und accessKey), der Dienst leitet sie als E-Mail weiter. Die Zeile „E-Mail“ wird dabei
  zur Antwort-Adresse: auf die Nachricht lässt sich direkt antworten.
  Klappt das Senden nicht, liefert mailtoLink() dieselben Angaben als fertige E-Mail.
*/
import { content } from '../content.js';

const cfg = content.contact.form;

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function mailtoLink(subject, rows) {
  const body = rows.map(([k, v]) => `${k}: ${v}`).join('\n');
  return `mailto:${cfg.mailto}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export async function sendForm(subject, rows) {
  const data = { access_key: cfg.accessKey, subject, from_name: 'guskic studiO Website', botcheck: '' };
  rows.forEach(([k, v]) => { data[k === 'E-Mail' ? 'email' : k] = v; });   // „email“ nutzt der Dienst als Antwort-Adresse
  const stop = new AbortController(), timer = setTimeout(() => stop.abort(), 12000);
  try {
    const res = await fetch(cfg.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data), signal: stop.signal });
    const answer = await res.json().catch(() => ({}));
    return res.ok && answer.success === true;
  } catch { return false; } finally { clearTimeout(timer); }
}

/* Hinweis unter einem Feld zeigen oder entfernen. „box“ ist das Element, das Feld und Hinweis umschließt. */
export function markWrong(input, box, text, cls = 'form__hint') {
  clearWrong(input, box, cls);
  const hint = document.createElement('p');
  hint.className = cls; hint.id = `${input.id}-hint`; hint.textContent = text;
  box.classList.add('is-wrong'); box.appendChild(hint);
  input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', hint.id);
}
export function clearWrong(input, box, cls = 'form__hint') {
  box.classList.remove('is-wrong');
  input.removeAttribute('aria-invalid'); input.removeAttribute('aria-describedby');
  const hint = box.querySelector(`.${cls}`); if (hint) hint.remove();
}
