/*
  Animierter Neon-Verlauf als Hintergrund für einen beliebigen Container.

    import { init } from './gradientBackground.js';
    const bg = init(document.querySelector('.site-bg'), { grain: 0 });

  WebGL: ein Fullscreen-Fragment-Shader auf Schwarz. Sechs Farbfelder wandern auf geschlossenen
  Sinus-Bahnen (eine Runde = loop Sekunden, nahtlos), skalieren und drehen sich leicht und
  leuchten wie Neonlicht: Kern plus weicher Halo (smoothstep-Falloff), additiv gemischt (screen),
  Intensität pulsiert leicht. Beim Scrollen wandern die Felder mit (eigener Faktor je Feld);
  wer unten hinausläuft, kommt oben wieder herein. Eine weiche Helligkeitsgrenze (ceiling) hält
  helle Schrift darüber lesbar. Dither gegen Banding.
  Ohne WebGL: geschichtete CSS-Radial-Verläufe (screen) mit Keyframes, gleiche Farben.

  Farben ändern:
    - dauerhaft:     DEFAULTS.palette unten (orchid, frozen, zitrus) und DEFAULTS.base
    - beim Start:    init(el, { palette: { orchid: '#DA70D6' }, base: '#0B0B0C' })
    - zur Laufzeit:  bg.setColors({ zitrus: '#E4FD97' })   oder   bg.uniforms.uColors.value[i].set('#…')
  Tempo: bg.setSpeed(0.5) bzw. bg.uniforms.uSpeed.value (1 = eine Runde pro loop Sekunden)
  Leuchtkraft: bg.uniforms.uCeiling / uHaloGain / uHalo, Stärke je Feld: FIELDS[].g
  Anhalten von außen (z. B. wenn der Verlauf ganz verdeckt ist): bg.suspend(true / false)
*/
import * as THREE from 'three';
import './styles/gradient.css';

/* c: Farbe aus der Palette. x/y: 0..1 im Container (y von oben), r: Kernradien der Ellipse
   (relativ zur Wurzel der Fläche), a/f/p: Bahn-Amplitude, -Frequenz, -Phase,
   s: Scroll-Faktor (Felder wandern um scrollY × s nach unten), g: Leuchtstärke */
const FIELDS = [
  { c: 'orchid', x: 0.18, y: 0.20, r: [0.34, 0.28], a: [0.08, 0.05], f: [1, 1], p: 0.0, s: 0.22, g: 1.00 },
  { c: 'frozen', x: 0.80, y: 0.30, r: [0.37, 0.29], a: [0.07, 0.06], f: [1, 2], p: 1.1, s: 0.31, g: 0.85 },
  { c: 'zitrus', x: 0.50, y: 0.60, r: [0.25, 0.21], a: [0.10, 0.06], f: [2, 1], p: 2.3, s: 0.17, g: 0.90 },
  { c: 'orchid', x: 0.86, y: 0.84, r: [0.33, 0.26], a: [0.06, 0.07], f: [1, 1], p: 3.4, s: 0.27, g: 0.95 },
  { c: 'frozen', x: 0.12, y: 0.76, r: [0.36, 0.28], a: [0.08, 0.06], f: [1, 1], p: 4.6, s: 0.35, g: 0.85 },
  { c: 'zitrus', x: 0.44, y: 0.04, r: [0.23, 0.18], a: [0.09, 0.05], f: [1, 2], p: 5.5, s: 0.25, g: 0.80 },
];

const DEFAULTS = {
  palette: { orchid: '#DA70D6', frozen: '#A0BDDB', zitrus: '#E4FD97' },
  base: '#0B0B0C',   // Grundfarbe, die ganze Fläche
  speed: 1,          // Tempo-Faktor
  loop: 14,          // Sekunden pro Runde bei speed 1
  glow: 1,           // Leuchtstärke aller Felder (1 = Spitze eines Feldes an der Helligkeitsgrenze)
  halo: 2.4,         // Halo-Radius als Vielfaches des Kernradius
  haloGain: 0.6,     // Stärke des Halos
  pulse: 0.10,       // Intensität pulsiert um ±10 % (eine Welle pro Runde)
  ceiling: 0.16,     // max. relative Leuchtdichte: 0.16 = helle Schrift #F5F3EE überall ≥ 4,5:1
  scroll: true,      // Felder wandern beim Scrollen mit (für fest stehende Hintergründe)
  grain: 0.03,       // Deckkraft des Korns
  dither: 1,         // Dither in 1/255-Stufen gegen Banding (unsichtbar)
  pointer: true,     // Maus zieht das nächste Farbfeld an (nie auf Touch)
  dpr: 1.5,          // Obergrenze Pixel Ratio
};

const TAU = Math.PI * 2;
const N = FIELDS.length;
const SCALE_MAX = 1.08;  // Skalierung der Felder schwankt um ±8 %
const PULL_MAX = 0.22;   // max. Zug zur Maus (skalierte Einheiten)

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const fragmentShader = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime, uLoop, uSeed, uGrain, uDither, uHalo, uHaloGain, uCeiling;
uniform vec3 uColors[${N}];
uniform vec3 uBase;
uniform vec2 uCenter[${N}];
uniform vec4 uShape[${N}];
uniform float uGain[${N}];
uniform float uPeriod[${N}];

vec3 toSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
  float asp = uRes.x / uRes.y;
  vec2 k = vec2(sqrt(asp), 1.0 / sqrt(asp));
  vec2 p = (uv - 0.5) * k;
  float th = 6.2831853 * uTime / uLoop;

  /* Flüssige Verformung, nur ganzzahlige Vielfache von th: die Runde schließt nahtlos */
  p += 0.075 * vec2(sin(p.y * 2.3 + th + 0.7), sin(p.x * 1.9 - th + 1.9))
     + 0.030 * vec2(sin(p.x * 3.7 + p.y * 1.1 + 2.0 * th), sin(p.y * 3.1 - p.x * 1.4 - 2.0 * th + 4.0));

  /* Neon: Kern + weicher Halo je Feld, additiv wie Licht (screen). Jedes Feld zweimal,
     im Abstand seiner Scroll-Periode: läuft es unten hinaus, ist es oben schon wieder da. */
  vec3 dark = vec3(1.0);
  for (int i = 0; i < ${N}; i++) {
    vec4 s = uShape[i];
    for (int j = 0; j < 2; j++) {
      vec2 d = p - uCenter[i] + vec2(0.0, float(j) * uPeriod[i]);
      d = vec2(s.z * d.x + s.w * d.y, -s.w * d.x + s.z * d.y) / s.xy;
      float r = length(d);
      float core = 1.0 - smoothstep(0.0, 1.0, r);
      float halo = 1.0 - smoothstep(0.0, uHalo, r);
      float g = (core * core * core + uHaloGain * halo * halo * halo) * uGain[i];
      dark *= 1.0 - clamp(uColors[i] * g, 0.0, 1.0);
    }
  }
  vec3 col = 1.0 - (1.0 - uBase) * dark;

  /* Helligkeitsgrenze mit weichem Knie: helle Schrift bleibt überall lesbar, keine harte Kante */
  float L = dot(col, vec3(0.2126, 0.7152, 0.0722));
  float knee = uCeiling * 0.6, span = uCeiling - knee;
  if (L > knee) col *= (knee + span * (1.0 - exp(-(L - knee) / span))) / L;

  col = toSRGB(col);
  col = mix(col, vec3(hash(gl_FragCoord.xy + uSeed * 17.31)), uGrain);
  col += (hash(gl_FragCoord.xy * 1.37 + uSeed * 3.1) - 0.5) * uDither / 255.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

export function init(container, options = {}) {
  const o = { ...DEFAULTS, ...options, palette: { ...DEFAULTS.palette, ...options.palette } };
  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const madeRelative = getComputedStyle(container).position === 'static';
  container.classList.add('gbg-host');
  if (madeRelative) container.classList.add('gbg-host--relative');

  let inView = true, held = false;
  let io = null;
  const cleanup = [];
  const listen = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); cleanup.push(() => target.removeEventListener(type, fn, opts)); };

  /* ---------- CSS-Fallback ---------- */
  function mountCSS() {
    const el = document.createElement('div');
    el.className = 'gbg gbg--css';
    el.setAttribute('aria-hidden', 'true');
    el.style.setProperty('--gbg-loop', `${o.loop / Math.max(o.speed, 0.01)}s`);
    el.style.setProperty('--gbg-grain', String(o.grain));
    el.innerHTML = FIELDS.map((f, i) => `<i style="--c:var(--gbg-${f.c});--x:${f.x * 100}%;--y:${f.y * 100}%;--w:${f.r[0] * 2 * 1.6 * 90}%;--h:${f.r[1] * 2 * 1.6 * 110}%;--o:${Math.round(f.a[0] * 90)}%;--g:${(0.4 * f.g).toFixed(2)};--d:${-(f.p / TAU) * o.loop}s;--dir:${i % 2 ? 'reverse' : 'normal'}"></i>`).join('');
    container.prepend(el);
    const setColors = (palette = {}, base = null) => {
      Object.assign(o.palette, palette);
      Object.entries(o.palette).forEach(([key, c]) => el.style.setProperty(`--gbg-${key}`, c));
      if (base) o.base = base;
      el.style.setProperty('--gbg-base', o.base);
    };
    setColors();
    const sync = () => el.classList.toggle('is-paused', !inView || document.hidden || held);
    io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; sync(); });
    io.observe(container);
    listen(document, 'visibilitychange', sync);
    return {
      mode: 'css', canvas: null, element: el, uniforms: null,
      setColors,
      setSpeed(v) { el.style.setProperty('--gbg-loop', `${o.loop / Math.max(v, 0.01)}s`); },
      suspend(v = true) { held = v; sync(); },
      start() {}, stop() {}, render() {},
      destroy() {
        io.disconnect(); cleanup.forEach((fn) => fn());
        el.remove();
        container.classList.remove('gbg-host', 'gbg-host--relative');
      },
    };
  }

  if (document.documentElement.classList.contains('no-gl')) return mountCSS();

  /* ---------- WebGL ---------- */
  const canvas = document.createElement('canvas');
  canvas.className = 'gbg';
  canvas.setAttribute('aria-hidden', 'true');
  container.prepend(canvas);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power' });
  } catch (e) {
    canvas.remove();
    return mountCSS();
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, o.dpr));

  const uniforms = {
    uRes: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uLoop: { value: o.loop },
    uSpeed: { value: o.speed },
    uSeed: { value: 0 },
    uGrain: { value: o.grain },
    uDither: { value: o.dither },
    uHalo: { value: o.halo },
    uHaloGain: { value: o.haloGain },
    uCeiling: { value: o.ceiling },
    uColors: { value: FIELDS.map((f) => new THREE.Color(o.palette[f.c])) },
    uBase: { value: new THREE.Color(o.base) },
    uCenter: { value: FIELDS.map(() => new THREE.Vector2()) },
    uShape: { value: FIELDS.map(() => new THREE.Vector4(1, 1, 1, 0)) },
    uGain: { value: FIELDS.map(() => 1) },
    uPeriod: { value: FIELDS.map(() => 1) },
  };
  const geo = new THREE.PlaneGeometry(2, 2);
  const mat = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, depthTest: false, depthWrite: false });
  const quad = new THREE.Mesh(geo, mat);
  quad.frustumCulled = false;
  const cam = new THREE.Camera();

  const reduced = () => mqReduce.matches;

  /* Bahnen (CPU): Mittelpunkt, Skalierung, Drehung, Puls je Feld; alle mit ganzzahligen Frequenzen -> nahtlose Runde.
     Scrollen schiebt jedes Feld nach unten; y wird in [oben, unten + Ausdehnung) umgebrochen. Die Periode
     (Höhe + Ausdehnung inkl. Halo und Mauszug) ist konstant, der Shader zeichnet die zweite Kopie eine Periode höher. */
  const pull = FIELDS.map(() => ({ x: 0, y: 0 }));
  const base = FIELDS.map(() => ({ x: 0, y: 0 }));
  let kx = 1, ky = 1, rsx = 1, rsy = 1, hostH = 1;
  function layoutFields() {
    const u = uniforms;
    const th = TAU * (u.uTime.value / u.uLoop.value);
    const sy = o.scroll && !reduced() ? window.scrollY : 0;
    FIELDS.forEach((f, i) => {
      const s = 1 + (SCALE_MAX - 1) * Math.sin(th + f.p * 0.7);
      const rx = f.r[0] * s * rsx, ry = f.r[1] * s * rsy;
      const ext = Math.max(f.r[0] * rsx, f.r[1] * rsy) * SCALE_MAX * u.uHalo.value + PULL_MAX;
      const P = ky + ext;
      const x = (f.x - 0.5) * kx + f.a[0] * rsx * Math.sin(f.f[0] * th + f.p);
      let y = (f.y - 0.5) * ky + f.a[1] * rsy * Math.cos(f.f[1] * th + f.p * 1.3) + (sy * f.s / hostH) * ky;
      y = ((((y + ky / 2) % P) + P) % P) - ky / 2;
      base[i].x = x; base[i].y = y;
      const rot = 0.35 * Math.sin(th + f.p * 1.1) + f.p;
      u.uCenter.value[i].set(x + pull[i].x, y + pull[i].y);
      u.uShape.value[i].set(rx, ry, Math.cos(rot), Math.sin(rot));
      u.uPeriod.value[i] = P;
      /* Spitze jedes Feldes ≈ ceiling, egal wie hell die Farbe ist: weiches Profil statt gekappter Scheibe */
      const c = u.uColors.value[i], lum = Math.max(0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b, 1e-3);
      const norm = u.uCeiling.value / (lum * (1 + u.uHaloGain.value));
      u.uGain.value[i] = f.g * o.glow * norm * (1 + o.pulse * Math.sin(th + f.p * 1.9));
    });
  }

  /* Maus: das nächste Feld (bzw. seine sichtbare Kopie) wird sanft angezogen (lerp ~0.05 pro Frame bei 60 fps) */
  const ptr = { x: 0, y: 0, active: false };
  let nearest = -1;
  if (o.pointer && finePointer) {
    listen(window, 'pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      ptr.x = e.clientX; ptr.y = e.clientY; ptr.active = true;
    }, { passive: true });
    listen(document.documentElement, 'mouseleave', () => { ptr.active = false; });
  }
  function updatePull(dt) {
    let tx = 0, ty = 0;
    if (ptr.active) {
      const r = container.getBoundingClientRect();
      const inside = ptr.x >= r.left && ptr.x <= r.right && ptr.y >= r.top && ptr.y <= r.bottom;
      if (inside) {
        const px = ((ptr.x - r.left) / r.width - 0.5) * kx, py = ((ptr.y - r.top) / r.height - 0.5) * ky;
        /* Abstand zur näheren der beiden Kopien, dy relativ zu dieser Kopie */
        const near = (i) => {
          const b = base[i], P = uniforms.uPeriod.value[i];
          const d0 = Math.hypot(px - b.x, py - b.y), d1 = Math.hypot(px - b.x, py - (b.y - P));
          return d0 <= d1 ? { d: d0, dy: py - b.y } : { d: d1, dy: py - (b.y - P) };
        };
        let best = -1, bd = Infinity;
        FIELDS.forEach((_, i) => { const n = near(i).d; if (n < bd) { bd = n; best = i; } });
        /* kleine Hysterese, damit das Feld nicht zwischen zwei gleich nahen hin- und herspringt */
        if (nearest < 0 || best === nearest || bd < 0.9 * near(nearest).d) nearest = best;
        tx = (px - base[nearest].x) * 0.35; ty = near(nearest).dy * 0.35;
        const len = Math.hypot(tx, ty);
        if (len > PULL_MAX) { tx *= PULL_MAX / len; ty *= PULL_MAX / len; }
      } else nearest = -1;
    } else nearest = -1;
    const a = 1 - Math.pow(1 - 0.05, dt * 60);
    pull.forEach((pl, i) => {
      const gx = i === nearest ? tx : 0, gy = i === nearest ? ty : 0;
      pl.x += (gx - pl.x) * a; pl.y += (gy - pl.y) * a;
    });
  }

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    renderer.getDrawingBufferSize(uniforms.uRes.value);
    hostH = h;
    const asp = w / h;
    kx = Math.sqrt(asp); ky = 1 / Math.sqrt(asp);
    /* Hochformat: Felder und Bahnen schmaler, sonst überdecken sie sich zu stark */
    rsx = Math.min(1, Math.sqrt(asp));
    rsy = Math.min(1, Math.pow(asp, 0.2));
  }

  function render() {
    layoutFields();
    renderer.render(quad, cam);
  }

  let raf = 0, last = 0, running = false;
  function frame(now) {
    if (!running) return;
    const dt = Math.min(Math.max((now - last) / 1000, 0), 0.1);
    last = now;
    const u = uniforms;
    u.uTime.value = (u.uTime.value + dt * u.uSpeed.value) % u.uLoop.value;
    u.uSeed.value = Math.floor(now / 1000 * 24) % 1000;
    updatePull(dt);
    render();
    raf = requestAnimationFrame(frame);
  }
  const start = () => {
    if (running || reduced()) return;
    running = true; last = performance.now();
    raf = requestAnimationFrame(frame);
  };
  const stop = () => { running = false; cancelAnimationFrame(raf); };
  const sync = () => {
    if (reduced()) { stop(); render(); return; }
    if (inView && !document.hidden && !held) start(); else stop();
  };

  /* Reduzierte Bewegung: ein statisches Bild, ohne Scroll-Wandern */
  const STATIC_TIME = o.loop * 0.1;
  const onReduce = () => { if (reduced()) { uniforms.uTime.value = STATIC_TIME; pull.forEach((pl) => { pl.x = 0; pl.y = 0; }); } sync(); };
  if (reduced()) uniforms.uTime.value = STATIC_TIME;
  listen(mqReduce, 'change', onReduce);

  resize();
  const ro = new ResizeObserver(() => { resize(); if (!running) render(); });
  ro.observe(container);
  io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; sync(); }, { rootMargin: '100px' });
  io.observe(container);
  listen(document, 'visibilitychange', sync);

  /* Kontext verloren (z. B. zu viele WebGL-Kontexte auf dem Handy): auf CSS umschalten */
  let api;
  listen(canvas, 'webglcontextlost', (e) => {
    e.preventDefault();
    teardown();
    Object.assign(api, mountCSS());
  });

  renderer.compile(quad, cam);
  render();
  sync();

  function teardown() {
    stop();
    ro.disconnect(); io.disconnect();
    cleanup.splice(0).forEach((fn) => fn());
    geo.dispose(); mat.dispose(); renderer.dispose();
    canvas.remove();
  }

  api = {
    mode: 'webgl', canvas, element: canvas, uniforms,
    setColors(palette = {}, baseColor = null) {
      Object.assign(o.palette, palette);
      FIELDS.forEach((f, i) => uniforms.uColors.value[i].set(o.palette[f.c]));
      if (baseColor) uniforms.uBase.value.set(baseColor);
      if (!running) render();
    },
    setSpeed(v) { uniforms.uSpeed.value = v; },
    suspend(v = true) { held = v; sync(); },
    start, stop, render,
    destroy() {
      teardown();
      container.classList.remove('gbg-host', 'gbg-host--relative');
    },
  };
  return api;
}
