// Das Zeichen (vier Schleifen) als 3D-Modell in Chrom: gemeinsame Teile für den Start (heroLogo.js) und die Fußzeile.
// Form aus src/logo-data.js (aus dem Logo-Bild nachgezeichnet), Licht aus einem kleinen Studio mit Perlmutt-Streifen.
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LOGO } from './logo-data.js';

/* Lichtumgebung. hell = für weißen Hintergrund (Vorderseite dunkler, sonst verschwindet das Chrom im Weiß),
   sonst für schwarzen Hintergrund (Vorderseite hell, damit es silbern leuchtet). */
export function chromeEnv(renderer, hell) {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16), new THREE.MeshBasicMaterial({ color: 0x030304, side: THREE.BackSide })));
  const panel = (w, h, color, strength, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(strength), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); scene.add(m);
  };
  if (hell) {
    panel(46, 7, 0xffffff, 1.5, [0, 13, 21]);            // vorne: Lichtband oben
    panel(46, 7, 0xb9c0d0, 0.42, [0, 3.5, 24]);          // graue Mitte
    panel(46, 6, 0x6f7688, 0.3, [0, -4, 23]);            // dunkleres Blaugrau unten
    panel(46, 5, 0x101014, 1.0, [0, -10.5, 20]);         // fast schwarzer Boden
  } else {
    panel(46, 9, 0xffffff, 2.6, [0, 11, 22]);            // vorne: große helle Flächen
    panel(46, 7, 0xf2f4ff, 1.5, [0, 2.5, 24]);
    panel(46, 6, 0xcfe0ff, 0.9, [0, -4.5, 23]);
    panel(46, 5, 0x30303a, 1.0, [0, -10.5, 20]);
  }
  panel(24, 12, 0xffffff, 5.0, [0, 18, 2]);              // oben und seitlich: harte Lichtkanten
  panel(6, 20, 0xffffff, 3.4, [-19, 2, 6]);
  panel(4, 18, 0xffffff, 3.0, [19, 4, 0]);
  panel(9, 3, 0xffb9d6, 5.5, [13, -5, 14]);              // Rosa
  panel(9, 3, 0xaed3ff, 5.5, [-13, -6, 13]);             // Eisblau
  panel(8, 2.6, 0xd2bfff, 5.0, [-4, 13, 15]);            // Flieder
  panel(30, 1.4, 0xffffff, 2.4, [0, -2, -18]);           // Horizont hinten
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(scene, 0.02).texture; pmrem.dispose();
  scene.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  return env;
}

/* Die Form in 3D: in die Tiefe gezogen, Kanten gerundet, weiche Spiegelungen */
export function logoGeometry(mobile) {
  const shape = new THREE.Shape(LOGO.outer.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of LOGO.holes) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  let geo = new THREE.ExtrudeGeometry(shape, { depth: 0.13, curveSegments: 1, steps: 1, bevelEnabled: true, bevelThickness: 0.036, bevelSize: 0.017, bevelOffset: -0.004, bevelSegments: mobile ? 4 : 7 });
  geo.deleteAttribute('uv'); geo.deleteAttribute('normal');
  geo = mergeVertices(geo, 1e-4); geo.computeVertexNormals(); geo.center();
  return geo;
}

export const chromeMaterial = () => new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 1, roughness: 0.06, envMapIntensity: 1.25, iridescence: 0.4, iridescenceIOR: 1.8, iridescenceThicknessRange: [180, 420] });

/* Kamera so weit weg, dass das Zeichen den Anteil fill der Leinwand füllt (Zeichen ist 2,16 Einheiten groß) */
export const cameraDistance = (fill, fov = 28) => 2.16 / (2 * Math.tan(THREE.MathUtils.degToRad(fov / 2)) * fill);

/* Freistehendes Zeichen auf eigener Leinwand (Fußzeile): dreht sich leicht, folgt dem Zeiger, rendert nur wenn sichtbar.
   state.scale steuert den Auftritt (0 = unsichtbar), begin() startet die ruhige Drehung. */
export function createChromeLogo(canvas, { fill = 0.8, hell = false } = {}) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' }); }
  catch (e) { return null; }
  const mobile = window.innerWidth <= 900;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.75 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = hell ? 1.05 : 1.12;
  const scene = new THREE.Scene(); scene.environment = chromeEnv(renderer, hell);
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50); camera.position.z = cameraDistance(fill);
  const group = new THREE.Group(); group.add(new THREE.Mesh(logoGeometry(mobile), chromeMaterial())); scene.add(group);

  const state = { scale: 1, running: false, inView: false, begun: false, t0: 0 };
  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  const onMove = (e) => { ptr.tx = (e.clientX / innerWidth) * 2 - 1; ptr.ty = (e.clientY / innerHeight) * 2 - 1; };
  addEventListener('pointermove', onMove, { passive: true });

  const resize = () => { const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  function render(now = performance.now()) {
    const t = state.begun ? (now - state.t0) / 1000 : 0, k = Math.min(1, t / 2.8), ease = k * k * (3 - 2 * k);
    ptr.x += (ptr.tx - ptr.x) * 0.045; ptr.y += (ptr.ty - ptr.y) * 0.045;
    group.rotation.set(ease * (Math.cos(t * 0.31) * 0.16 + ptr.y * 0.24), ease * (Math.sin(t * 0.42) * 0.5 + ptr.x * 0.45), ease * Math.sin(t * 0.2) * 0.05);
    group.scale.setScalar(Math.max(state.scale, 0.001)); group.visible = state.scale > 0.001;
    renderer.render(scene, camera);
  }
  let raf = 0;
  const loop = (now) => { if (!state.running) return; render(now); raf = requestAnimationFrame(loop); };
  const start = () => { if (state.running) return; state.running = true; raf = requestAnimationFrame(loop); };
  const stop = () => { state.running = false; cancelAnimationFrame(raf); };
  const sync = () => (state.inView && !document.hidden ? start() : stop());
  const io = new IntersectionObserver(([e]) => { state.inView = e.isIntersecting; sync(); }, { rootMargin: '120px' });
  io.observe(canvas); document.addEventListener('visibilitychange', sync);
  new ResizeObserver(() => { resize(); if (!state.running) render(); }).observe(canvas);
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stop(); canvas.hidden = true; });
  resize(); renderer.compile(scene, camera); render();
  return { state, render, begin() { if (!state.begun) { state.begun = true; state.t0 = performance.now(); } } };
}
