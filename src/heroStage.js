/*
  Die Bühne im Start-Bereich: eine Leinwand, ein Renderer.
  1. Flüssigkeits-Simulation: der Zeiger malt eine Maske.
  2. Misch-Durchgang: mix(Basis, Folienwelt, Maske).
     Basis      = weiße Seite mit den schwarzen Buchstaben „guskic studi“
     Folienwelt = schwarze Seite, dieselben Buchstaben als aufgeblasene Folien-Ballons
  3. Darüber im selben Bild: das Chrom-O (immer sichtbar, auf Weiß und auf Schwarz).
*/
import * as THREE from 'three';
import { buildO, makeEnv, makeFoilMaterial, oAspect } from './chromeO.js';
import { createFluid, fluidSupported } from './fluid.js';
import { WORDMARK } from './wordmark.js';
import { asset, isMobile } from './utils/dom.js';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

const QUAD_V = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

const MIX_F = `precision highp float;
varying vec2 vUv;
uniform sampler2D tDye;     // Maske aus der Simulation
uniform sampler2D tBase;    // weiß mit schwarzen Buchstaben
uniform sampler2D tBlur;    // weichgezeichnete Buchstaben = Höhe der Ballons
uniform sampler2D tFoil;    // Folien-Video oder Folien-Bild
uniform vec2 uRes;
uniform vec2 uFoilFit;
uniform vec2 uLight;
uniform float uTime;
uniform float uMaskOn;
uniform float uFill;        // 0..1: ganze Fläche als Folienwelt (zum Prüfen und für das Vorschaubild)
uniform vec4 uSh;           // Schatten unter dem Chrom-O: Mitte (uv), Radien
uniform float uShA;
uniform float uAspect;

vec3 foilAt(vec2 uv){
  vec2 f = (uv - 0.5) * uFoilFit + 0.5;
  return texture2D(tFoil, clamp(f, 0.002, 0.998)).rgb;
}

void main(){
  vec3 raw = texture2D(tBase, vUv).rgb;
  vec3 base = raw;
  vec2 q = vUv - uSh.xy; q.x *= uAspect;
  float sd = length(q / uSh.zw);
  base *= 1.0 - uShA * exp(-sd * sd * 1.6);

  float dye = uMaskOn > 0.5 ? texture2D(tDye, vUv).r : 0.0;
  float m = max(smoothstep(0.10, 0.34, dye), uFill);

  vec3 col = base;
  if (m > 0.001) {
    float letter = 1.0 - raw.r;
    float h = texture2D(tBlur, vUv).r;
    vec2 e = 5.0 / uRes;
    float hx = texture2D(tBlur, vUv + vec2(e.x, 0.0)).r - texture2D(tBlur, vUv - vec2(e.x, 0.0)).r;
    float hy = texture2D(tBlur, vUv + vec2(0.0, e.y)).r - texture2D(tBlur, vUv - vec2(0.0, e.y)).r;
    vec3 n = normalize(vec3(-hx * 7.0, -hy * 7.0, 1.0));

    /* Folie: über die Wölbung verschoben abgetastet, das wirkt wie eine Spiegelung auf dem Ballon */
    vec3 foil = foilAt(vUv + n.xy * 0.07);
    float lum = dot(foil, vec3(0.299, 0.587, 0.114));

    vec3 ldir = normalize(vec3(uLight * 0.7 + vec2(-0.25, 0.45), 0.85));
    float diff = clamp(dot(n, ldir), 0.0, 1.0);
    float spec = pow(clamp(dot(reflect(-ldir, n), vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 26.0);
    float body = smoothstep(0.12, 0.8, h);                 // zum Rand hin dunkler: die Naht des Ballons
    vec3 film = 0.5 + 0.5 * cos(6.2831853 * (dot(n.xy, vec2(1.7, 0.9)) + lum * 0.55 + uLight.x * 0.22 + uTime * 0.035) + vec3(0.0, 2.1, 4.2));

    /* Ballon: in der Mitte hell und prall, zur Naht hin dunkel; dazu ein schmaler Glanz auf dem Rücken */
    float ridge = smoothstep(0.62, 0.98, h);
    vec3 balloon = foil * (0.26 + 1.0 * diff) * mix(0.16, 1.0, body);
    balloon += film * 0.2 * body;
    balloon += spec * 0.7 + ridge * 0.10;

    vec3 reveal = balloon * letter;
    col = mix(base, reveal, m);

    /* heller, schillernder Saum an der Kante der Flüssigkeit */
    float edge = smoothstep(0.0, 0.5, m) * (1.0 - smoothstep(0.5, 1.0, m));
    col += film * edge * 0.10 * (1.0 - uFill);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

/* Einfacher Weichzeichner auf einem kleinen Graustufen-Bild (3 Durchgänge, Kasten-Filter) */
function boxBlur(data, w, h, r) {
  const tmp = new Float32Array(w * h);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {
      let acc = 0;
      for (let x = -r; x <= r; x++) acc += data[y * w + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        tmp[y * w + x] = acc / (2 * r + 1);
        acc += data[y * w + Math.min(w - 1, x + r + 1)] - data[y * w + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        data[y * w + x] = acc / (2 * r + 1);
        acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
      }
    }
  }
}

export function createHeroStage({ canvas, stage, svg, ghost, reduce = false }) {
  const state = {
    ok: false,
    scale: 0,        // 0..1, Größe des Chrom-O (Intro)
    crumple: 0,      // 0..1, Knitter
    running: false,
    fluid: false,    // Wischen aktiv
    baked: false,    // Buchstaben liegen in der Leinwand
    reduce,
  };
  const api = { state, layout() {}, bake() {}, start() {}, stop() {}, crumpleAgain() {}, fill() {}, dispose() {} };

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (e) {
    document.documentElement.classList.add('no-gl');
    return api;
  }
  state.ok = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0xffffff, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.autoClear = false;

  /* Chrom-O */
  const scene = new THREE.Scene();
  scene.environment = makeEnv(renderer);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.z = 10;
  const U = { uAmt: { value: 0 }, uSeed: { value: 0 } };
  const foilMat = makeFoilMaterial(U);
  let mesh = null, box = null, baseScale = 1;

  /* Flüssigkeit */
  const canFluid = !reduce && fluidSupported(renderer);
  const fluid = canFluid ? createFluid(renderer, isMobile() ? { simResolution: 128, dyeResolution: 256 } : {}) : null;

  /* Texturen */
  const baseCanvas = document.createElement('canvas');
  const baseCtx = baseCanvas.getContext('2d');
  const baseTex = new THREE.CanvasTexture(baseCanvas);
  baseTex.minFilter = THREE.LinearFilter; baseTex.magFilter = THREE.LinearFilter; baseTex.generateMipmaps = false;
  const blurTex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat);
  blurTex.needsUpdate = true;

  /* Folie: zuerst das Standbild, danach das Video, sobald es spielt */
  const foilSize = { w: 16, h: 9 };
  let foilTex = new THREE.DataTexture(new Uint8Array([190, 190, 196, 255]), 1, 1, THREE.RGBAFormat);
  foilTex.needsUpdate = true;
  let video = null;

  const mixMat = new THREE.ShaderMaterial({
    vertexShader: QUAD_V, fragmentShader: MIX_F, depthTest: false, depthWrite: false,
    uniforms: {
      tDye: { value: fluid ? fluid.texture : null }, tBase: { value: baseTex }, tBlur: { value: blurTex }, tFoil: { value: foilTex },
      uRes: { value: new THREE.Vector2(1, 1) }, uFoilFit: { value: new THREE.Vector2(1, 1) }, uLight: { value: new THREE.Vector2() },
      uTime: { value: 0 }, uMaskOn: { value: 0 }, uFill: { value: 0 },
      uSh: { value: new THREE.Vector4(0.5, 0.5, 0.2, 0.1) }, uShA: { value: 0 }, uAspect: { value: 1 },
    },
  });
  const quadScene = new THREE.Scene();
  const quadCam = new THREE.Camera();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mixMat);
  quad.frustumCulled = false;
  quadScene.add(quad);

  function fitFoil() {
    const w = stage.clientWidth || 1, h = stage.clientHeight || 1;
    const fa = foilSize.w / foilSize.h, sa = w / h;
    if (sa > fa) mixMat.uniforms.uFoilFit.value.set(1, fa / sa);
    else mixMat.uniforms.uFoilFit.value.set(sa / fa, 1);
  }

  new THREE.TextureLoader().load(asset('hero/foil.webp'), (t) => {
    if (video) { t.dispose(); return; }
    t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
    foilTex.dispose(); foilTex = t; mixMat.uniforms.tFoil.value = t;
    foilSize.w = t.image.width; foilSize.h = t.image.height; fitFoil();
    if (!state.running) renderFrame(performance.now(), 0);
  }, undefined, () => {});

  if (!reduce) {
    const v = document.createElement('video');
    v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
    v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
    v.addEventListener('playing', () => {
      if (video) return;
      video = v;
      const t = new THREE.VideoTexture(v);
      t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
      foilTex.dispose(); foilTex = t; mixMat.uniforms.tFoil.value = t;
      foilSize.w = v.videoWidth || 16; foilSize.h = v.videoHeight || 9; fitFoil();
    }, { once: true });
    v.addEventListener('error', () => {}, { once: true });
    api.loadVideo = () => { if (!v.src) { v.src = asset('hero/foil.mp4'); v.play().catch(() => {}); } };
    api.video = v;
  } else {
    api.loadVideo = () => {};
  }

  /* Buchstaben in die Basis-Textur zeichnen (pixelgenau dort, wo das SVG steht) */
  function drawBase() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    const dpr = renderer.getPixelRatio();
    const cw = Math.round(w * dpr), ch = Math.round(h * dpr);
    if (baseCanvas.width !== cw || baseCanvas.height !== ch) { baseCanvas.width = cw; baseCanvas.height = ch; }
    baseCtx.setTransform(1, 0, 0, 1, 0, 0);
    baseCtx.fillStyle = '#fff';
    baseCtx.fillRect(0, 0, cw, ch);

    const sr = stage.getBoundingClientRect(), r = svg.getBoundingClientRect();
    const k = (r.width / WORDMARK.width);
    const letters = state.baked ? WORDMARK.letters : [];
    if (letters.length) {
      baseCtx.setTransform(k * dpr, 0, 0, k * dpr, (r.left - sr.left) * dpr, (r.top - sr.top) * dpr);
      baseCtx.fillStyle = '#000';
      letters.forEach((l) => baseCtx.fill(new Path2D(l.d)));
    }
    baseTex.needsUpdate = true;

    /* Höhenbild: dieselben Buchstaben, klein und weichgezeichnet */
    const s = 5;
    const bw = Math.max(2, Math.round(w / s)), bh = Math.max(2, Math.round(h / s));
    const small = document.createElement('canvas');
    small.width = bw; small.height = bh;
    const sctx = small.getContext('2d');
    sctx.fillStyle = '#000'; sctx.fillRect(0, 0, bw, bh);
    if (letters.length) {
      sctx.setTransform(k / s, 0, 0, k / s, (r.left - sr.left) / s, (r.top - sr.top) / s);
      sctx.fillStyle = '#fff';
      letters.forEach((l) => sctx.fill(new Path2D(l.d)));
    }
    const img = sctx.getImageData(0, 0, bw, bh).data;
    const gray = new Float32Array(bw * bh);
    for (let i = 0; i < gray.length; i++) gray[i] = img[i * 4];
    /* Radius ≈ halbe Strichstärke der Buchstaben, damit die Mitte am höchsten ist */
    const stroke = 0.13 * WORDMARK.height * k;
    boxBlur(gray, bw, bh, Math.max(1, Math.round((stroke * 0.42) / s)));
    const out = new Uint8Array(bw * bh * 4);
    /* DataTexture hat die erste Zeile unten: Zeilen spiegeln, damit es zur Basis-Textur passt */
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      const v = Math.min(255, gray[(bh - 1 - y) * bw + x] * 1.25);
      const o = (y * bw + x) * 4;
      out[o] = v; out[o + 1] = v; out[o + 2] = v; out[o + 3] = 255;
    }
    const tex = new THREE.DataTexture(out, bw, bh, THREE.RGBAFormat);
    tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.needsUpdate = true;
    mixMat.uniforms.tBlur.value.dispose();
    mixMat.uniforms.tBlur.value = tex;
  }

  function layout() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    const dpr = renderer.getPixelRatio();
    camera.aspect = w / h; camera.updateProjectionMatrix();
    mixMat.uniforms.uRes.value.set(w * dpr, h * dpr);
    mixMat.uniforms.uAspect.value = w / h;
    if (fluid) fluid.setAspect(w / h);
    fitFoil();

    /* Chrom-O genau auf den (unsichtbaren) Buchstaben O setzen */
    const sr = stage.getBoundingClientRect(), g = ghost.getBoundingClientRect();
    box = { cx: g.left - sr.left + g.width / 2, cy: g.top - sr.top + g.height / 2, w: g.width, h: g.height };
    const ar = box.w / box.h;
    if (!mesh) { mesh = new THREE.Mesh(buildO(Number.isFinite(ar) && ar > 0 ? ar : oAspect()), foilMat); scene.add(mesh); }
    const wpp = (2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / h;
    mesh.position.set((box.cx - w / 2) * wpp, -(box.cy - h / 2) * wpp, 0);
    baseScale = box.h * wpp;

    drawBase();
    if (!state.running) renderFrame(performance.now(), 0);
  }
  api.layout = layout;

  /* Nach dem Intro: Buchstaben wandern vom SVG in die Leinwand, das Wischen wird scharf */
  api.bake = () => {
    if (!fluid) return false;       // ohne Simulation bleiben die Buchstaben im SVG stehen
    state.baked = true;
    drawBase();
    state.fluid = !!fluid;
    mixMat.uniforms.uMaskOn.value = fluid ? 1 : 0;
    if (!state.running) renderFrame(performance.now(), 0);
    return !!fluid;
  };
  api.fill = (v) => { mixMat.uniforms.uFill.value = v; if (!state.running) renderFrame(performance.now(), 0); };

  /* Zeiger */
  const ptr = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
  let last = null;
  const toUv = (e) => {
    const r = stage.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: 1 - (e.clientY - r.top) / r.height };
  };
  const onMove = (e) => {
    ptr.x = (e.clientX / innerWidth) * 2 - 1; ptr.y = (e.clientY / innerHeight) * 2 - 1;
    if (!state.fluid) return;
    const p = toUv(e);
    if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) { last = null; return; }
    if (last) {
      const dx = p.x - last.x, dy = p.y - last.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.0004) {
        /* schnelle Bewegung: mehrere Tupfer auf der Strecke, damit die Spur nicht abreißt */
        const n = Math.min(8, Math.max(1, Math.ceil(dist / 0.02)));
        for (let i = 1; i <= n; i++) fluid.addSplat(last.x + (dx * i) / n, last.y + (dy * i) / n, dx / n, dy / n, 0.55);
      }
    }
    last = p;
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  stage.addEventListener('pointerleave', () => { last = null; });
  stage.addEventListener('pointerdown', (e) => { last = toUv(e); }, { passive: true });

  let spin = null, seed = 0;
  api.crumpleAgain = () => { if (!spin) spin = { t: performance.now(), s0: seed }; };

  const T0 = performance.now();
  let lastT = T0, raf = 0;

  function renderFrame(now, dtRaw) {
    const t = (now - T0) / 1000;
    const dt = Math.min(dtRaw, 1 / 30);
    cur.x += (ptr.x - cur.x) * 0.07; cur.y += (ptr.y - cur.y) * 0.07;

    let spinA = 0, bump = 0;
    if (spin) {
      const k = clamp01((now - spin.t) / 1200), e = easeInOut(k);
      spinA = state.reduce ? 0 : e * Math.PI * 2;
      seed = spin.s0 + e;
      bump = Math.sin(Math.PI * k) * 0.8;
      if (k >= 1) spin = null;
    }
    U.uSeed.value = seed;
    U.uAmt.value = state.crumple * (1 + bump);

    const drift = state.reduce ? 0 : 1;
    const ry = cur.x * 0.6 * drift + Math.sin(t * 0.4) * 0.16 * drift + spinA;
    const rx = cur.y * 0.42 * drift + Math.cos(t * 0.31) * 0.05 * drift;
    if (mesh) { mesh.rotation.set(rx, ry, 0); mesh.scale.setScalar(baseScale * Math.max(state.scale, 0.001)); mesh.visible = state.scale > 0.001; }

    if (fluid && state.fluid) { fluid.step(dt); mixMat.uniforms.tDye.value = fluid.texture; }

    mixMat.uniforms.uLight.value.set(cur.x, -cur.y);
    mixMat.uniforms.uTime.value = t;
    if (box) {
      const w = stage.clientWidth, h = stage.clientHeight;
      mixMat.uniforms.uSh.value.set(
        (box.cx - cur.x * box.h * 0.12) / w,
        1 - (box.cy + box.h * 0.12 - cur.y * box.h * 0.06) / h,
        (box.w * 0.66) / h, (box.h * 0.58) / h);
      mixMat.uniforms.uShA.value = 0.1 * clamp01(state.scale);
    }

    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(quadScene, quadCam);
    renderer.clearDepth();
    renderer.render(scene, camera);
  }

  function loop(now) {
    if (!state.running) return;
    const dt = (now - lastT) / 1000; lastT = now;
    renderFrame(now, dt);
    raf = requestAnimationFrame(loop);
  }
  api.start = () => {
    if (state.running) return;
    state.running = true; lastT = performance.now(); raf = requestAnimationFrame(loop);
    if (video) video.play().catch(() => {});
  };
  api.stop = () => { state.running = false; cancelAnimationFrame(raf); if (video) video.pause(); };
  api.dispose = () => { api.stop(); if (fluid) fluid.dispose(); renderer.dispose(); };

  layout();
  let pending = false;
  new ResizeObserver(() => { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; layout(); }); }).observe(stage);
  return api;
}
