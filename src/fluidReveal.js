/*
  Stable-Fluids-Simulation (Jos Stam) auf three.js-Render-Targets.
  Doppelte FBOs für Geschwindigkeit und Farbe, Curl/Vorticity, 20 Druck-Iterationen,
  Splat bei Zeigerbewegung. Die Farbe (dye) dient dem Papier-Shader als Alpha-Maske.
*/
import * as THREE from 'three';

const BASE_V = `
varying vec2 vUv, vL, vR, vT, vB;
uniform vec2 texelSize;
void main(){
  vUv = uv;
  vL = vUv - vec2(texelSize.x, 0.0);
  vR = vUv + vec2(texelSize.x, 0.0);
  vT = vUv + vec2(0.0, texelSize.y);
  vB = vUv - vec2(0.0, texelSize.y);
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const HEAD = 'varying vec2 vUv, vL, vR, vT, vB;\n';

const CLEAR_F = HEAD + `
uniform sampler2D uTexture; uniform float value;
void main(){ gl_FragColor = value * texture2D(uTexture, vUv); }`;

const SPLAT_F = HEAD + `
uniform sampler2D uTarget; uniform float aspectRatio; uniform vec3 color; uniform vec2 point; uniform float radius;
void main(){
  vec2 p = vUv - point; p.x *= aspectRatio;
  vec3 splat = exp(-dot(p, p) / radius) * color;
  vec3 base = texture2D(uTarget, vUv).xyz;
  gl_FragColor = vec4(base + splat, 1.0);
}`;

const ADVECT_F = HEAD + `
uniform sampler2D uVelocity, uSource; uniform vec2 texelSize; uniform float dt, dissipation;
void main(){
  vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
  gl_FragColor = dissipation * texture2D(uSource, coord);
  gl_FragColor.a = 1.0;
}`;

const CURL_F = HEAD + `
uniform sampler2D uVelocity;
void main(){
  float L = texture2D(uVelocity, vL).y, R = texture2D(uVelocity, vR).y;
  float T = texture2D(uVelocity, vT).x, B = texture2D(uVelocity, vB).x;
  gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`;

const VORT_F = HEAD + `
uniform sampler2D uVelocity, uCurl; uniform float curl, dt;
void main(){
  float L = texture2D(uCurl, vL).x, R = texture2D(uCurl, vR).x;
  float T = texture2D(uCurl, vT).x, B = texture2D(uCurl, vB).x;
  float C = texture2D(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= curl * C; force.y *= -1.0;
  vec2 vel = texture2D(uVelocity, vUv).xy + force * dt;
  vel = min(max(vel, -1000.0), 1000.0);
  gl_FragColor = vec4(vel, 0.0, 1.0);
}`;

const DIV_F = HEAD + `
uniform sampler2D uVelocity;
void main(){
  float L = texture2D(uVelocity, vL).x, R = texture2D(uVelocity, vR).x;
  float T = texture2D(uVelocity, vT).y, B = texture2D(uVelocity, vB).y;
  vec2 C = texture2D(uVelocity, vUv).xy;
  if (vL.x < 0.0) L = -C.x; if (vR.x > 1.0) R = -C.x;
  if (vT.y > 1.0) T = -C.y; if (vB.y < 0.0) B = -C.y;
  gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`;

const PRESS_F = HEAD + `
uniform sampler2D uPressure, uDivergence;
void main(){
  float L = texture2D(uPressure, vL).x, R = texture2D(uPressure, vR).x;
  float T = texture2D(uPressure, vT).x, B = texture2D(uPressure, vB).x;
  float div = texture2D(uDivergence, vUv).x;
  gl_FragColor = vec4((L + R + B + T - div) * 0.25, 0.0, 0.0, 1.0);
}`;

const GRAD_F = HEAD + `
uniform sampler2D uPressure, uVelocity;
void main(){
  float L = texture2D(uPressure, vL).x, R = texture2D(uPressure, vR).x;
  float T = texture2D(uPressure, vT).x, B = texture2D(uPressure, vB).x;
  vec2 v = texture2D(uVelocity, vUv).xy - vec2(R - L, T - B);
  gl_FragColor = vec4(v, 0.0, 1.0);
}`;

function resolution(res, w, h) {
  let ar = w / h; if (ar < 1) ar = 1 / ar;
  const min = Math.round(res), max = Math.round(res * ar);
  return w > h ? { w: max, h: min } : { w: min, h: max };
}

export function createFluid(renderer, opts = {}) {
  const o = {
    simRes: 128, dyeRes: 1024, pressureIterations: 20, curl: 30,
    velocityDissipation: 0.985, dyeDissipation: 0.965,
    splatRadius: 0.0032, splatForce: 5200,
    ...opts,
  };
  const type = THREE.HalfFloatType;
  const mk = (w, h, filter) => new THREE.WebGLRenderTarget(w, h, {
    type, format: THREE.RGBAFormat, minFilter: filter, magFilter: filter,
    wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping, depthBuffer: false, stencilBuffer: false,
  });
  const dbl = (w, h, filter) => {
    const d = { read: mk(w, h, filter), write: mk(w, h, filter) };
    d.swap = () => { const t = d.read; d.read = d.write; d.write = t; };
    d.resize = (nw, nh) => { d.read.setSize(nw, nh); d.write.setSize(nw, nh); };
    return d;
  };

  let sim = { w: 128, h: 72 }, dye = { w: 1024, h: 576 };
  const velocity = dbl(sim.w, sim.h, THREE.LinearFilter);
  const dyeT = dbl(dye.w, dye.h, THREE.LinearFilter);
  const pressure = dbl(sim.w, sim.h, THREE.NearestFilter);
  const divergence = mk(sim.w, sim.h, THREE.NearestFilter);
  const curlT = mk(sim.w, sim.h, THREE.NearestFilter);

  const scene = new THREE.Scene(), cam = new THREE.Camera();
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  mesh.frustumCulled = false;
  scene.add(mesh);

  const mat = (frag, uniforms) => new THREE.ShaderMaterial({ uniforms: { texelSize: { value: new THREE.Vector2() }, ...uniforms }, vertexShader: BASE_V, fragmentShader: frag, depthTest: false, depthWrite: false });
  const M = {
    clear: mat(CLEAR_F, { uTexture: { value: null }, value: { value: 0.8 } }),
    splat: mat(SPLAT_F, { uTarget: { value: null }, aspectRatio: { value: 1 }, color: { value: new THREE.Vector3() }, point: { value: new THREE.Vector2() }, radius: { value: 0.003 } }),
    advect: mat(ADVECT_F, { uVelocity: { value: null }, uSource: { value: null }, dt: { value: 0.016 }, dissipation: { value: 1 } }),
    curl: mat(CURL_F, { uVelocity: { value: null } }),
    vort: mat(VORT_F, { uVelocity: { value: null }, uCurl: { value: null }, curl: { value: o.curl }, dt: { value: 0.016 } }),
    div: mat(DIV_F, { uVelocity: { value: null } }),
    press: mat(PRESS_F, { uPressure: { value: null }, uDivergence: { value: null } }),
    grad: mat(GRAD_F, { uPressure: { value: null }, uVelocity: { value: null } }),
  };

  const simTexel = new THREE.Vector2(), dyeTexel = new THREE.Vector2();
  const pass = (m, target, texel) => {
    m.uniforms.texelSize.value.copy(texel);
    mesh.material = m;
    renderer.setRenderTarget(target);
    renderer.render(scene, cam);
  };

  const splats = [];
  const api = {
    texture: dyeT.read.texture,
    aspect: 1,
    resize(w, h) {
      api.aspect = w / h;
      sim = resolution(o.simRes, w, h);
      dye = resolution(o.dyeRes, w, h);
      velocity.resize(sim.w, sim.h); pressure.resize(sim.w, sim.h);
      divergence.setSize(sim.w, sim.h); curlT.setSize(sim.w, sim.h);
      dyeT.resize(dye.w, dye.h);
      simTexel.set(1 / sim.w, 1 / sim.h); dyeTexel.set(1 / dye.w, 1 / dye.h);
      api.texture = dyeT.read.texture;
    },
    /* x, y in 0..1 (y nach oben), dx/dy normierte Bewegung, a Farbstärke */
    splat(x, y, dx, dy, a = 1) { splats.push({ x, y, dx: dx * o.splatForce, dy: dy * o.splatForce, a }); },
    step(dt) {
      dt = Math.min(Math.max(dt, 1 / 240), 1 / 30);
      const prevTarget = renderer.getRenderTarget();
      const prevAutoClear = renderer.autoClear;
      renderer.autoClear = false;

      while (splats.length) {
        const s = splats.shift();
        M.splat.uniforms.aspectRatio.value = api.aspect;
        M.splat.uniforms.point.value.set(s.x, s.y);
        M.splat.uniforms.radius.value = o.splatRadius;
        M.splat.uniforms.uTarget.value = velocity.read.texture;
        M.splat.uniforms.color.value.set(s.dx, s.dy, 0);
        pass(M.splat, velocity.write, simTexel); velocity.swap();
        M.splat.uniforms.uTarget.value = dyeT.read.texture;
        M.splat.uniforms.color.value.set(s.a, s.a, s.a);
        pass(M.splat, dyeT.write, dyeTexel); dyeT.swap();
      }

      M.curl.uniforms.uVelocity.value = velocity.read.texture;
      pass(M.curl, curlT, simTexel);

      M.vort.uniforms.uVelocity.value = velocity.read.texture;
      M.vort.uniforms.uCurl.value = curlT.texture;
      M.vort.uniforms.dt.value = dt;
      pass(M.vort, velocity.write, simTexel); velocity.swap();

      M.div.uniforms.uVelocity.value = velocity.read.texture;
      pass(M.div, divergence, simTexel);

      M.clear.uniforms.uTexture.value = pressure.read.texture;
      pass(M.clear, pressure.write, simTexel); pressure.swap();

      M.press.uniforms.uDivergence.value = divergence.texture;
      for (let i = 0; i < o.pressureIterations; i++) {
        M.press.uniforms.uPressure.value = pressure.read.texture;
        pass(M.press, pressure.write, simTexel); pressure.swap();
      }

      M.grad.uniforms.uPressure.value = pressure.read.texture;
      M.grad.uniforms.uVelocity.value = velocity.read.texture;
      pass(M.grad, velocity.write, simTexel); velocity.swap();

      const f = dt * 60;
      M.advect.uniforms.dt.value = dt;
      M.advect.uniforms.uVelocity.value = velocity.read.texture;
      M.advect.uniforms.uSource.value = velocity.read.texture;
      M.advect.uniforms.dissipation.value = Math.pow(o.velocityDissipation, f);
      pass(M.advect, velocity.write, simTexel); velocity.swap();

      M.advect.uniforms.uVelocity.value = velocity.read.texture;
      M.advect.uniforms.uSource.value = dyeT.read.texture;
      M.advect.uniforms.dissipation.value = Math.pow(o.dyeDissipation, f);
      pass(M.advect, dyeT.write, dyeTexel); dyeT.swap();

      api.texture = dyeT.read.texture;
      renderer.setRenderTarget(prevTarget);
      renderer.autoClear = prevAutoClear;
    },
    dispose() {
      [velocity, dyeT, pressure].forEach((d) => { d.read.dispose(); d.write.dispose(); });
      divergence.dispose(); curlT.dispose();
      Object.values(M).forEach((m) => m.dispose());
    },
  };
  return api;
}
