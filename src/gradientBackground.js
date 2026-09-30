/*
  Animierter Mesh-Verlauf als Hintergrund für einen beliebigen Container.

    import { init } from './gradientBackground.js';
    const bg = init(document.querySelector('#kontakt'), { speed: 1 });

  WebGL: ein Fullscreen-Fragment-Shader. Fünf Farbfelder wandern auf geschlossenen
  Sinus-Bahnen (eine Runde = loop Sekunden, nahtlos), skalieren und drehen sich leicht
  und werden über den Abstand mit smoothstep-Falloff in OKLab gemischt. Zum Rand hin
  übernimmt die Grundfarbe. Dazu ca. 3 % Filmkorn gegen Banding.
  Ohne WebGL: geschichtete CSS-Radial-Verläufe mit Keyframes, gleiche Farben.

  Farben ändern:
    - beim Start:    init(el, { colors: [...5 Farben], base: '#F4F6FF' })
    - zur Laufzeit:  bg.setColors([...], base)   oder   bg.uniforms.uColors.value[0].set('#3F8CFF')
  Tempo: bg.setSpeed(0.5) bzw. bg.uniforms.uSpeed.value (1 = eine Runde pro loop Sekunden)
*/
import * as THREE from 'three';
import './styles/gradient.css';

/* Reihenfolge = Reihenfolge von options.colors. x/y: 0..1 im Container (y von oben),
   r: Radien der Ellipse (relativ zur Wurzel der Fläche), a/f/p: Bahn-Amplitude, -Frequenz, -Phase */
const FIELDS = [
  { x: 0.50, y: 0.12, r: [0.88, 0.56], a: [0.10, 0.05], f: [1, 1], p: 0.0 }, // Blau, oben Mitte
  { x: 0.90, y: 0.10, r: [0.62, 0.50], a: [0.06, 0.05], f: [1, 2], p: 1.7 }, // Himmelblau, oben rechts
  { x: 0.12, y: 0.88, r: [0.80, 0.60], a: [0.08, 0.06], f: [1, 1], p: 3.1 }, // Rot-Pink, unten links
  { x: 0.42, y: 0.60, r: [0.66, 0.46], a: [0.10, 0.07], f: [2, 1], p: 4.4 }, // Koralle, Richtung Mitte
  { x: 0.90, y: 0.74, r: [0.78, 0.58], a: [0.07, 0.08], f: [1, 1], p: 5.6 }, // Violett, rechts / unten rechts
];

const DEFAULTS = {
  colors: ['#3F8CFF', '#A9D4FF', '#FF2D55', '#FF5A6E', '#A78BFA'],
  base: '#F4F6FF',   // Grundfarbe an Rändern und Ecken
  speed: 1,          // Tempo-Faktor
  loop: 14,          // Sekunden pro Runde bei speed 1
  grain: 0.03,       // Deckkraft des Korns
  edge: 0.22,        // Breite der hellen Randzone (0..0.5)
  pointer: true,     // Maus zieht das nächste Farbfeld an (nie auf Touch)
  dpr: 1.5,          // Obergrenze Pixel Ratio
};

const TAU = Math.PI * 2;
const N = FIELDS.length;

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const fragmentShader = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime, uLoop, uSeed, uGrain, uEdge;
uniform vec3 uColors[${N}];
uniform vec3 uBase;
uniform vec2 uCenter[${N}];
uniform vec4 uShape[${N}];

/* Lineares sRGB <-> OKLab: gleichmäßige Übergänge ohne graue oder dunkle Mitte */
vec3 toLab(vec3 c) {
  vec3 lms = mat3(0.4122214708, 0.2119034982, 0.0883024619,
                  0.5363325363, 0.6806995451, 0.2817188376,
                  0.0514459929, 0.1073969566, 0.6299787005) * c;
  lms = pow(max(lms, 0.0), vec3(1.0 / 3.0));
  return mat3(0.2104542553, 1.9779984951, 0.0259040371,
              0.7936177850, -2.4285922050, 0.7827717662,
              -0.0040720468, 0.4505937099, -0.8086757660) * lms;
}
vec3 fromLab(vec3 L) {
  vec3 lms = mat3(1.0, 1.0, 1.0,
                  0.3963377774, -0.1055613458, -0.0894841775,
                  0.2158037573, -0.0638541728, -1.2914855480) * L;
  lms = lms * lms * lms;
  return mat3(4.0767416621, -1.2684380046, -0.0041960863,
              -3.3077115913, 2.6097574011, -0.7034186147,
              0.2309699292, -0.3413193965, 1.7076147010) * lms;
}
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

  /* Farbton: Felder untereinander gewichtet (w²). Deckung: weiche Vereinigung aller Felder (w) */
  vec3 baseLab = toLab(uBase);
  vec3 lab = baseLab * 1e-5;
  float wh = 1e-5, cover = 1.0;
  for (int i = 0; i < ${N}; i++) {
    vec2 d = p - uCenter[i];
    vec4 s = uShape[i];
    d = vec2(s.z * d.x + s.w * d.y, -s.w * d.x + s.z * d.y) / s.xy;
    float w = 1.0 - smoothstep(0.0, 1.0, length(d));
    lab += toLab(uColors[i]) * w * w;
    wh += w * w;
    cover *= 1.0 - w;
  }
  cover = 1.0 - cover;

  /* Ränder und Ecken laufen elliptisch in die Grundfarbe aus */
  float r = length(uv * 2.0 - 1.0);
  cover *= 1.0 - smoothstep(1.0 - uEdge * 2.0, 1.42, r);

  vec3 col = toSRGB(fromLab(mix(baseLab, lab / wh, cover)));

  col = mix(col, vec3(hash(gl_FragCoord.xy + uSeed * 17.31)), uGrain);
  gl_FragColor = vec4(col, 1.0);
}
`;

export function init(container, options = {}) {
  const o = { ...DEFAULTS, ...options };
  const colors = FIELDS.map((_, i) => o.colors[i] || DEFAULTS.colors[i]);
  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const madeRelative = getComputedStyle(container).position === 'static';
  container.classList.add('gbg-host');
  if (madeRelative) container.classList.add('gbg-host--relative');

  let inView = true;
  let io = null;
  const cleanup = [];
  const listen = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); cleanup.push(() => target.removeEventListener(type, fn, opts)); };

  /* ---------- CSS-Fallback ---------- */
  function mountCSS() {
    const el = document.createElement('div');
    el.className = 'gbg gbg--css';
    el.setAttribute('aria-hidden', 'true');
    el.style.setProperty('--gbg-loop', `${o.loop / Math.max(o.speed, 0.01)}s`);
    el.innerHTML = FIELDS.map((f, i) => `<i style="--x:${f.x * 100}%;--y:${f.y * 100}%;--w:${f.r[0] * 150}%;--h:${f.r[1] * 190}%;--o:${Math.round(f.a[0] * 90)}%;--d:${-(f.p / TAU) * o.loop}s;--dir:${i % 2 ? 'reverse' : 'normal'}"></i>`).join('');
    container.prepend(el);
    const setColors = (list = colors, base = o.base) => {
      list.forEach((c, i) => { if (c) el.style.setProperty(`--c${i}`, c); });
      el.style.setProperty('--gbg-base', base);
    };
    setColors();
    const sync = () => el.classList.toggle('is-paused', !inView || document.hidden);
    io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; sync(); });
    io.observe(container);
    listen(document, 'visibilitychange', sync);
    return {
      mode: 'css', canvas: null, element: el, uniforms: null,
      setColors,
      setSpeed(v) { el.style.setProperty('--gbg-loop', `${o.loop / Math.max(v, 0.01)}s`); },
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
    uEdge: { value: o.edge },
    uColors: { value: colors.map((c) => new THREE.Color(c)) },
    uBase: { value: new THREE.Color(o.base) },
    uCenter: { value: FIELDS.map(() => new THREE.Vector2()) },
    uShape: { value: FIELDS.map(() => new THREE.Vector4(1, 1, 1, 0)) },
  };
  const geo = new THREE.PlaneGeometry(2, 2);
  const mat = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, depthTest: false, depthWrite: false });
  const quad = new THREE.Mesh(geo, mat);
  quad.frustumCulled = false;
  const cam = new THREE.Camera();

  /* Bahnen (CPU): Mittelpunkt, Skalierung, Drehung je Feld; alle mit ganzzahligen Frequenzen -> nahtlose Runde */
  const pull = FIELDS.map(() => ({ x: 0, y: 0 }));
  const base = FIELDS.map(() => ({ x: 0, y: 0 }));
  let kx = 1, ky = 1, rsx = 1, rsy = 1;
  function layoutFields() {
    const th = TAU * (uniforms.uTime.value / uniforms.uLoop.value);
    FIELDS.forEach((f, i) => {
      base[i].x = (f.x - 0.5) * kx + f.a[0] * rsx * Math.sin(f.f[0] * th + f.p);
      base[i].y = (f.y - 0.5) * ky + f.a[1] * rsy * Math.cos(f.f[1] * th + f.p * 1.3);
      const s = 1 + 0.08 * Math.sin(th + f.p * 0.7);
      const rot = 0.35 * Math.sin(th + f.p * 1.1) + f.p;
      uniforms.uCenter.value[i].set(base[i].x + pull[i].x, base[i].y + pull[i].y);
      uniforms.uShape.value[i].set(f.r[0] * s * rsx, f.r[1] * s * rsy, Math.cos(rot), Math.sin(rot));
    });
  }

  /* Maus: das nächste Feld wird sanft angezogen (lerp ~0.05 pro Frame bei 60 fps) */
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
        let best = -1, bd = Infinity;
        base.forEach((b, i) => { const d = Math.hypot(px - b.x, py - b.y); if (d < bd) { bd = d; best = i; } });
        /* kleine Hysterese, damit das Feld nicht zwischen zwei gleich nahen hin- und herspringt */
        if (nearest < 0 || best === nearest || bd < 0.9 * Math.hypot(px - base[nearest].x, py - base[nearest].y)) nearest = best;
        tx = (px - base[nearest].x) * 0.35; ty = (py - base[nearest].y) * 0.35;
        const len = Math.hypot(tx, ty), max = 0.22;
        if (len > max) { tx *= max / len; ty *= max / len; }
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
    const asp = w / h;
    kx = Math.sqrt(asp); ky = 1 / Math.sqrt(asp);
    /* Hochformat: Felder und Bahnen schmaler, sonst überdecken Rot-Pink und Koralle das Violett */
    rsx = Math.min(1, Math.sqrt(asp));
    rsy = Math.min(1, Math.pow(asp, 0.2));
  }

  function render() {
    layoutFields();
    renderer.render(quad, cam);
  }

  let raf = 0, last = 0, running = false;
  const reduced = () => mqReduce.matches;
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
    if (inView && !document.hidden) start(); else stop();
  };

  /* Reduzierte Bewegung: ein statisches Bild */
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
    setColors(list = colors, baseColor) {
      list.forEach((c, i) => { if (c && uniforms.uColors.value[i]) uniforms.uColors.value[i].set(c); });
      if (baseColor) uniforms.uBase.value.set(baseColor);
      if (!running) render();
    },
    setSpeed(v) { uniforms.uSpeed.value = v; },
    start, stop, render,
    destroy() {
      teardown();
      container.classList.remove('gbg-host', 'gbg-host--relative');
    },
  };
  return api;
}
