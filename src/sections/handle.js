/*
  Instagram-Fläche im Kontakt-Bereich: ein kleines dunkles Quadrat wächst zur hellen Fläche,
  das Zeichen erscheint, dann der Name Buchstabe für Buchstabe von rechts nach links. Nach 4 Sekunden von vorn.
  Im HTML: <div class="contact__handle"><a class="handle" data-handle><svg class="handle__icon">…</svg><span class="handle__name">…</span></a></div>
*/
import { gsap } from '../utils/gsap.js';
import { $, reducedMotion } from '../utils/dom.js';

const LOOP = 4;                 // Sekunden für eine Runde
const DARK = '#3A3A3A', LIGHT = '#CACACA';

export function initHandle(root = document) {
  const pill = $('[data-handle]', root);
  if (!pill || reducedMotion()) return;             // weniger Bewegung: die fertige Fläche bleibt einfach stehen
  const wrap = pill.parentElement;
  const icon = $('.handle__icon', pill), name = $('.handle__name', pill);

  /* Name in einzelne Buchstaben teilen */
  const text = name.textContent;
  name.textContent = '';
  const letters = [...text].map((ch) => { const i = document.createElement('i'); i.textContent = ch; name.appendChild(i); return i; });

  let tl = null, visible = false, hover = false;
  function build() {
    const at = tl ? tl.time() : 0;
    if (tl) tl.kill();
    pill.classList.remove('is-moving');
    gsap.set([pill, icon, ...letters], { clearProps: 'all' });
    const full = pill.offsetWidth, h = pill.offsetHeight;
    if (!full) return;
    wrap.style.width = `${full}px`;                  // Platz der fertigen Fläche freihalten, sie wächst aus der Mitte
    pill.classList.add('is-moving');                 // der Name hängt jetzt am rechten Rand
    tl = gsap.timeline({ repeat: -1, paused: true })
      .set(pill, { width: h, scale: 0.28, backgroundColor: DARK }, 0)
      .set(icon, { opacity: 0, scale: 0.7 }, 0)
      .set(letters, { opacity: 0 }, 0)
      .to(pill, { scale: 1, backgroundColor: LIGHT, duration: 0.3, ease: 'power2.out' }, 0)
      .to(icon, { opacity: 1, scale: 1, duration: 0.25, ease: 'power2.out' }, 0.12)
      .to(pill, { width: full, duration: 0.6, ease: 'power2.out' }, 0.3)
      .to(letters, { opacity: 1, duration: 0.17, ease: 'none', stagger: { each: 0.04, from: 'end' } }, 0.4)
      .to({}, { duration: 0.01 }, LOOP - 0.01);
    tl.time(at);
    sync();
  }
  function sync() {
    if (!tl) return;
    if (hover) { tl.pause().time(1.2); return; }     // unter dem Mauszeiger bleibt die Fläche offen und klickbar
    if (visible && !document.hidden) tl.play(); else tl.pause();
  }

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }, { rootMargin: '80px 0px' }).observe(wrap);
  document.addEventListener('visibilitychange', sync);
  const hold = (e) => { if (e.pointerType === 'touch') return; hover = true; sync(); };     // nur Maus und Tastatur, nicht beim Antippen
  const free = () => { hover = false; sync(); };
  pill.addEventListener('pointerenter', hold); pill.addEventListener('focus', hold);
  pill.addEventListener('pointerleave', free); pill.addEventListener('blur', free);

  let lastW = window.innerWidth;
  window.addEventListener('resize', () => { if (window.innerWidth !== lastW) { lastW = window.innerWidth; build(); } });
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(build);
}
