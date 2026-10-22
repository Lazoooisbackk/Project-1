/*
  Live-Sichtbarkeits-Check: Der Besucher tippt die Adresse seiner Website ein. Die Seite fragt Google
  PageSpeed Insights (Handy-Messung) direkt aus dem Browser ab und zeigt in rund 30 Sekunden:
  das Handy-Bild der Seite, vier Ampeln (Tempo, Handy, Sicherheit, Google) und was die Ladezeit kostet.
  Danach kann der Besucher seine E-Mail-Adresse dalassen: das Ergebnis geht über Web3Forms an mich,
  ich schicke ihm drei konkrete Verbesserungen. Klappt die Messung nicht, öffnet sich das Formular (Website-Check).
  Einstellungen: src/content.js → check (Schlüssel für die Google-API, Texte).
*/
import { $, $$ } from '../utils/dom.js';
import { content } from '../content.js';
import { EMAIL, sendForm, markWrong, clearWrong } from '../utils/send.js';

const cfg = content.check;
const SITE = /^(https?:\/\/)?([a-z0-9äöüß-]+\.)+[a-z]{2,}([/?#]\S*)?$/i;

/* Adresse säubern: Leerzeichen weg, https:// davor, wenn es fehlt */
export function normalizeUrl(raw) {
  let u = (raw || '').trim().replace(/\s+/g, '');
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    const parsed = new URL(u);
    if (!/^([a-z0-9äöüß-]+\.)+[a-z]{2,}$/i.test(parsed.hostname)) return null;
    return parsed.href;
  } catch { return null; }
}

const score = (a) => (a && typeof a.score === 'number' ? a.score : null);
const sec = (n) => (Math.round(n / 100) / 10).toLocaleString('de-AT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/* Aus dem Google-Ergebnis die vier Ampeln und den Kosten-Satz bauen */
export function readResult(json) {
  const lr = json.lighthouseResult || {};
  const a = lr.audits || {}, c = lr.categories || {};
  const perf = c.performance && typeof c.performance.score === 'number' ? Math.round(c.performance.score * 100) : null;
  const lcpMs = a['largest-contentful-paint'] && a['largest-contentful-paint'].numericValue;
  const lcp = typeof lcpMs === 'number' ? lcpMs : null;
  const https = score(a['is-on-https']) === 1;
  /* Google (Lighthouse 13) nennt die Handy-Prüfung „viewport-insight“, ältere Fassungen „viewport“; Schrift- und Knopfgrößen prüft Google nicht mehr */
  const vp = score(a['viewport-insight']) !== null ? score(a['viewport-insight']) : score(a['viewport']);
  const crawl = score(a['is-crawlable']);
  const title = score(a['document-title']) === 1, desc = score(a['meta-description']) === 1;
  /* Bild: zuerst das große Ganzseiten-Bild (412 px breit, scharf), sonst das kleine Standbild */
  const full = (lr.fullPageScreenshot && lr.fullPageScreenshot.screenshot && lr.fullPageScreenshot.screenshot.data)
    || (a['full-page-screenshot'] && a['full-page-screenshot'].details && a['full-page-screenshot'].details.screenshot && a['full-page-screenshot'].details.screenshot.data);
  const shot = full || (a['final-screenshot'] && a['final-screenshot'].details && a['final-screenshot'].details.data);

  const lights = [];
  const lcpText = lcp !== null ? `${sec(lcp)} Sekunden bis der Inhalt am Handy da ist.` : '';
  if (perf === null) lights.push({ id: 'tempo', name: 'Tempo', state: 'grey', text: 'Google konnte das Tempo nicht messen.' });
  else if (perf >= 90) lights.push({ id: 'tempo', name: 'Tempo', state: 'green', text: `Schnell: ${perf} von 100 Punkten. ${lcpText}` });
  else if (perf >= 50) lights.push({ id: 'tempo', name: 'Tempo', state: 'yellow', text: `Mittel: ${perf} von 100 Punkten. ${lcpText}` });
  else lights.push({ id: 'tempo', name: 'Tempo', state: 'red', text: `Langsam: ${perf} von 100 Punkten. ${lcpText}` });

  if (vp === null) lights.push({ id: 'handy', name: 'Handy', state: 'grey', text: 'Google konnte die Handy-Darstellung nicht prüfen.' });
  else if (vp < 1) lights.push({ id: 'handy', name: 'Handy', state: 'red', text: 'Nicht fürs Handy gebaut: die Seite wird winzig angezeigt und muss gezoomt werden.' });
  else lights.push({ id: 'handy', name: 'Handy', state: 'green', text: 'Passt sich dem Handy an: der Darstellungsbereich ist richtig gesetzt.' });

  lights.push(https
    ? { id: 'sicher', name: 'Sicherheit', state: 'green', text: 'Verschlüsselt (https). Browser zeigen das Schloss.' }
    : { id: 'sicher', name: 'Sicherheit', state: 'red', text: 'Nicht verschlüsselt: Browser warnen „Nicht sicher“.' });

  if (crawl === 0) lights.push({ id: 'google', name: 'Google', state: 'red', text: 'Google darf die Seite nicht aufnehmen (noindex): sie taucht in der Suche nicht auf.' });
  else if (title && desc) lights.push({ id: 'google', name: 'Google', state: 'green', text: 'Titel und Beschreibung für Google sind da.' });
  else if (title || desc) lights.push({ id: 'google', name: 'Google', state: 'yellow', text: title ? 'Die Beschreibung für Google fehlt: der Treffer bleibt leer.' : 'Der Seitentitel für Google fehlt.' });
  else lights.push({ id: 'google', name: 'Google', state: 'red', text: 'Google bekommt weder Titel noch Beschreibung.' });

  let cost = '';
  if (lcp !== null) {
    cost = lcp <= 2500
      ? `Ihre Seite braucht am Handy ${sec(lcp)} Sekunden. Das ist gut: unter den 2,5 Sekunden, die Google empfiehlt.`
      : `Ihre Seite braucht am Handy ${sec(lcp)} Sekunden. Laut Google springen 53 Prozent der Besucher ab, wenn es länger als 3 Sekunden dauert.`;
  }
  return { perf, lcp, lights, cost, shot, url: lr.finalDisplayedUrl || lr.requestedUrl || '' };
}

/* Google fragen. Bricht nach 75 Sekunden ab. */
async function measure(url, signal) {
  const q = new URLSearchParams({ url, strategy: 'mobile', locale: 'de' });
  ['performance', 'seo', 'best-practices'].forEach((cat) => q.append('category', cat));
  if (cfg.psiKey) q.set('key', cfg.psiKey);
  const res = await fetch(`${cfg.endpoint}?${q}`, { signal });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const msg = (json.error && json.error.message) || `HTTP ${res.status}`;
    const e = new Error(msg); e.quota = /quota|rate/i.test(msg); throw e;
  }
  return json;
}

export function initCheck({ openForm } = {}) {
  const root = $('[data-check]');
  if (!root) return;
  const form = $('.check__form', root), input = $('#c-url', root), button = $('.check__go', root);
  const hint = $('[data-check-hint]', root), result = $('[data-check-result]', root);
  const shotImg = $('[data-check-shot]', root), phone = $('.phone', root), lightsEl = $('[data-check-lights]', root), costEl = $('[data-check-cost]', root);
  const mail = $('[data-check-mail]', root), mailInput = $('#c-email', root), mailBtn = $('.check__send', root), done = $('[data-check-done]', root);
  const fallback = $$('[data-check-fallback]', root);
  let running = false, current = null, last = null, timer = null;

  const say = (text, kind = '') => { hint.textContent = text; hint.className = `check__hint${kind ? ` is-${kind}` : ''}`; hint.hidden = !text; };
  const openFallback = () => { if (openForm) openForm('check', button); };
  fallback.forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); openFallback(); }));

  const render = (r) => {
    last = r;
    if (r.shot) { shotImg.src = r.shot; phone.hidden = false; } else phone.hidden = true;
    lightsEl.innerHTML = '';
    r.lights.forEach((l) => {
      const li = document.createElement('li');
      li.className = `light is-${l.state}`;
      li.innerHTML = `<span class="light__dot" aria-hidden="true"></span><span class="light__body"><span class="light__name">${l.name}</span><span class="light__text"></span></span>`;
      $('.light__text', li).textContent = l.text;
      lightsEl.appendChild(li);
    });
    costEl.textContent = r.cost; costEl.hidden = !r.cost;
    done.hidden = true; mail.hidden = false;
    result.hidden = false;
    root.classList.add('has-result');
    result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (running) return;
    const url = normalizeUrl(input.value);
    if (!url) { say('Bitte geben Sie die Adresse Ihrer Website an, zum Beispiel www.beispiel.at.', 'wrong'); input.focus(); return; }
    running = true; current = url; root.classList.add('is-running'); button.disabled = true;
    const t0 = Date.now();
    say('Google misst Ihre Seite am Handy. Das dauert etwa 30 Sekunden …');
    timer = setInterval(() => say(`Google misst Ihre Seite am Handy … ${Math.round((Date.now() - t0) / 1000)} s`), 1000);
    const stop = new AbortController(); const kill = setTimeout(() => stop.abort(), 75000);
    try {
      const json = await measure(url, stop.signal);
      const r = readResult(json);
      r.url = r.url || url;
      say('');
      render(r);
    } catch (err) {
      const why = err.name === 'AbortError' ? 'Google hat zu lange gebraucht.' : (err.quota ? 'Google nimmt gerade keine Messungen an.' : 'Google konnte die Seite nicht messen.');
      say(`${why} Schicken Sie mir die Adresse, ich prüfe sie selbst und melde mich.`, 'wrong');
      const b = document.createElement('button'); b.type = 'button'; b.className = 'check__fallback'; b.textContent = 'Adresse an mich schicken';
      b.addEventListener('click', () => { if (openForm) { openForm('check', b); const f = $('#f-url'); if (f) f.value = input.value.trim(); } });
      hint.appendChild(document.createTextNode(' ')); hint.appendChild(b);
    } finally {
      clearInterval(timer); clearTimeout(kill);
      running = false; root.classList.remove('is-running'); button.disabled = false;
    }
  });

  /* Ergebnis an mich: die Adresse des Besuchers plus die vier Ampeln */
  let sending = false;
  mail.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending || !last) return;
    const box = mailInput.closest('.check__field');
    clearWrong(mailInput, box, 'check__wrong');
    const email = mailInput.value.trim();
    if (!EMAIL.test(email)) { markWrong(mailInput, box, 'Bitte geben Sie eine gültige E-Mail-Adresse an.', 'check__wrong'); mailInput.focus(); return; }
    sending = true; mail.classList.add('is-sending'); mailBtn.disabled = true;
    const rows = [['Anfrage', 'Sichtbarkeits-Check'], ['Website', current || last.url], ['E-Mail', email]];
    last.lights.forEach((l) => rows.push([l.name, `${l.state}: ${l.text}`]));
    if (last.perf !== null) rows.push(['Google-Punkte Handy', String(last.perf)]);
    if (last.lcp !== null) rows.push(['Ladezeit', `${sec(last.lcp)} s`]);
    const ok = await sendForm(`Sichtbarkeits-Check von ${current || last.url}`, rows);
    sending = false; mail.classList.remove('is-sending'); mailBtn.disabled = false;
    if (ok) { mail.hidden = true; done.hidden = false; done.focus({ preventScroll: true }); }
    else markWrong(mailInput, box, 'Das Senden hat gerade nicht geklappt. Rufen Sie mich einfach an: +43 676 491 61 44.', 'check__wrong');
  });
}
