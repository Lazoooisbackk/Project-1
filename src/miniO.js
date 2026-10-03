/*
  Kleines, freistehendes Chrom-O (gleiche Geometrie und gleiches Material wie im Hero).
  Für das Intro und die Wortmarke in der Fußzeile. opts.aspect = Breite / Höhe des O.
  Rendert nur, solange es sichtbar ist und der Tab aktiv ist.
*/
import * as THREE from 'three';
import { buildO, makeEnv, makeFoilMaterial, oAspect } from './chromeO.js';

export function createMiniO(canvas, opts = {}) {
  const o = { fill: 0.8, crumple: 1, scale: 1, spin: 0.35, observe: true, ...opts };
  if (document.documentElement.classList.contains('no-gl')) return null;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch (e) {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const env = makeEnv(renderer);
  scene.environment = env;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.z = 10;
  const viewH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

  const U = { uAmt: { value: o.crumple }, uSeed: { value: Math.random() * 10 } };
  const mat = makeFoilMaterial(U);
  const geo = buildO(o.aspect || oAspect());
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);

  const state = { scale: o.scale, crumple: o.crumple, running: false, inView: !o.observe };
  const ptr = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
  const onMove = (e) => { ptr.x = (e.clientX / innerWidth) * 2 - 1; ptr.y = (e.clientY / innerHeight) * 2 - 1; };
  addEventListener('pointermove', onMove, { passive: true });

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  let T0 = performance.now();
  let raf = 0;
  function render(now = performance.now()) {
    const t = (now - T0) / 1000;
    cur.x += (ptr.x - cur.x) * 0.06;
    cur.y += (ptr.y - cur.y) * 0.06;
    mesh.rotation.set(Math.sin(t * 0.5) * 0.16 + cur.y * 0.25, t * o.spin + cur.x * 0.4, 0);
    mesh.scale.setScalar(viewH * o.fill * Math.max(state.scale, 0.001));
    mesh.visible = state.scale > 0.001;
    U.uAmt.value = state.crumple;
    renderer.render(scene, camera);
  }
  function loop(now) {
    if (!state.running) return;
    render(now);
    raf = requestAnimationFrame(loop);
  }
  const start = () => { if (state.running) return; state.running = true; raf = requestAnimationFrame(loop); };
  const stop = () => { state.running = false; cancelAnimationFrame(raf); };

  resize();
  const ro = new ResizeObserver(() => { resize(); if (!state.running) render(); });
  ro.observe(canvas);

  let io = null;
  const sync = () => { if (state.inView && !document.hidden) start(); else stop(); };
  if (o.observe) {
    io = new IntersectionObserver(([e]) => { state.inView = e.isIntersecting; sync(); }, { rootMargin: '120px' });
    io.observe(canvas);
    document.addEventListener('visibilitychange', sync);
  }

  /* Shader vorab kompilieren, damit das erste Einblenden nicht ruckelt */
  renderer.compile(scene, camera);
  render();

  return {
    state, start, stop, render, resize,
    restart() { T0 = performance.now(); },
    dispose() {
      stop();
      ro.disconnect();
      if (io) io.disconnect();
      document.removeEventListener('visibilitychange', sync);
      removeEventListener('pointermove', onMove);
      geo.dispose(); mat.dispose(); env.dispose();
      renderer.dispose();
      if (renderer.forceContextLoss) renderer.forceContextLoss();
    },
  };
}
