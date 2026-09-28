/*
  Die acht Chrom- und Folienobjekte für Loader und Leistungen.
  Zuerst werden PNGs aus /public/intro geladen (obj-01.png … obj-08.png).
  Fehlen sie, werden die Objekte prozedural mit three.js gerendert, mit
  demselben Folien-Material wie das Chrom-O, damit der Loader nie bricht.
*/
import * as THREE from 'three';
import { buildO, makeEnv, makeFoilMaterial } from './chromeO.js';
import { asset } from './utils/dom.js';

export const OBJECT_COUNT = 8;
export const OBJECT_NAMES = [
  'Zerknitterte Chromfolien-Kugel', 'Chrom-Herz aus Folie', 'Blaue irisierende Folie', 'Chrom-Bonbonpapier',
  'Dunkle matte Papierkugel', 'Rosa Metallic-Ballon', 'Chrom-Stern', 'Zerknittertes Chrom-O',
];

const withAT = (g, v = 1) => {
  const n = g.attributes.position.count;
  g.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(n).fill(v), 1));
  return g;
};

function heartShape() {
  const s = new THREE.Shape();
  const x = 0, y = 0;
  s.moveTo(x, y + 0.5);
  s.bezierCurveTo(x, y + 0.5, x - 0.1, y + 1.0, x - 0.6, y + 1.0);
  s.bezierCurveTo(x - 1.3, y + 1.0, x - 1.3, y + 0.2, x - 1.3, y + 0.2);
  s.bezierCurveTo(x - 1.3, y - 0.3, x - 0.8, y - 0.85, x, y - 1.4);
  s.bezierCurveTo(x + 0.8, y - 0.85, x + 1.3, y - 0.3, x + 1.3, y + 0.2);
  s.bezierCurveTo(x + 1.3, y + 0.2, x + 1.3, y + 1.0, x + 0.6, y + 1.0);
  s.bezierCurveTo(x + 0.1, y + 1.0, x, y + 0.5, x, y + 0.5);
  return s;
}

function starShape(points = 5, outer = 1, inner = 0.46) {
  const s = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(a) * r, py = Math.sin(a) * r;
    if (i === 0) s.moveTo(px, py); else s.lineTo(px, py);
  }
  s.closePath();
  return s;
}

function candyGeometry() {
  const pts = [
    [0.03, -1.15], [0.12, -0.9], [0.13, -0.62], [0.46, -0.48], [0.56, 0], [0.46, 0.48], [0.13, 0.62], [0.12, 0.9], [0.03, 1.15],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(pts, 72);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (Math.abs(y) > 0.6) {
      const tw = (Math.abs(y) - 0.6) * 4.0 * Math.sign(y);
      const c = Math.cos(tw), s = Math.sin(tw);
      p.setXYZ(i, x * c - z * s, y, x * s + z * c);
    }
  }
  p.needsUpdate = true;
  g.rotateZ(Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

function extrude(shape, depth, bevel) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 5, steps: 2, curveSegments: 24 });
  g.center();
  return g;
}

const OBJECTS = [
  { geo: () => new THREE.SphereGeometry(0.95, 128, 96), amt: 1.4, opts: {}, rot: [0.3, -0.4, 0.1] },
  { geo: () => extrude(heartShape(), 0.5, 0.14).scale(0.78, 0.78, 0.78), amt: 0.9, opts: {}, rot: [0.35, -0.5, 0.2] },
  { geo: () => new THREE.SphereGeometry(0.95, 128, 96), amt: 1.25, opts: { color: 0x3a56ff, roughness: 0.14, iridescence: 1, iridescenceThicknessRange: [120, 480] }, rot: [0.2, 0.5, -0.1] },
  { geo: () => candyGeometry(), amt: 1.0, opts: {}, rot: [0.5, 0.2, 0.35] },
  { geo: () => new THREE.SphereGeometry(0.9, 128, 96), amt: 2.0, opts: { color: 0x2a292b, metalness: 0, roughness: 0.96, iridescence: 0, envMapIntensity: 0.6 }, rot: [0.4, -0.3, 0] },
  { geo: () => new THREE.SphereGeometry(0.85, 96, 72).scale(1, 1.18, 1), amt: 0, opts: { color: 0xf0a6cd, roughness: 0.22, iridescence: 0.3, flatShading: false }, rot: [0.15, -0.35, 0.25], knot: true },
  { geo: () => extrude(starShape(), 0.36, 0.1).scale(0.92, 0.92, 0.92), amt: 0.6, opts: {}, rot: [0.3, 0.35, 0.15] },
  { geo: () => buildO(0.82).scale(1.75, 1.75, 1.75), amt: 1.0, opts: {}, rot: [0.25, -0.45, 0.12] },
];

/* Rendert alle Objekte in transparente PNGs (Data-URLs). */
export async function renderProceduralObjects({ size = 512 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const env = makeEnv(renderer);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0, 4.6);
  const results = [];

  for (const def of OBJECTS) {
    const scene = new THREE.Scene();
    scene.environment = env;
    const U = { uAmt: { value: def.amt }, uSeed: { value: Math.random() * 10 } };
    const mat = makeFoilMaterial(U, def.opts);
    const geo = withAT(def.geo());
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.set(...def.rot);
    scene.add(mesh);
    if (def.knot) {
      const knot = new THREE.Mesh(withAT(new THREE.ConeGeometry(0.16, 0.3, 24)), makeFoilMaterial({ uAmt: { value: 0 }, uSeed: { value: 0 } }, def.opts));
      knot.position.set(0, -1.05, 0); knot.rotation.x = Math.PI;
      mesh.add(knot);
    }
    renderer.clear();
    renderer.render(scene, camera);
    results.push(canvas.toDataURL('image/png'));
    geo.dispose(); mat.dispose();
    await new Promise((r) => setTimeout(r, 0));
  }
  env.dispose();
  renderer.dispose();
  return results;
}

export async function loadObjects() {
  const urls = Array.from({ length: OBJECT_COUNT }, (_, i) => asset(`intro/obj-${String(i + 1).padStart(2, '0')}.png`));
  const checks = await Promise.all(urls.map((u) => new Promise((resolve) => {
    const img = new Image();
    const t = setTimeout(() => resolve(false), 8000);
    img.onload = () => { clearTimeout(t); resolve(true); };
    img.onerror = () => { clearTimeout(t); resolve(false); };
    img.src = u;
  })));
  if (checks.every(Boolean)) return { urls, procedural: false };
  try {
    const data = await renderProceduralObjects();
    return { urls: data, procedural: true };
  } catch (e) {
    return { urls: [], procedural: true };
  }
}
