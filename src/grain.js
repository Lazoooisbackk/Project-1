/* Filmkorn: kleiner Canvas, 12 fps, ca. 4 % Deckkraft (CSS). */
export function initGrain() {
  const c = document.createElement('canvas');
  c.className = 'grain';
  c.setAttribute('aria-hidden', 'true');
  document.body.appendChild(c);
  const ctx = c.getContext('2d', { alpha: true });
  let w = 0, h = 0, img = null, timer = null, hidden = false;

  const resize = () => {
    w = Math.ceil(window.innerWidth / 2);
    h = Math.ceil(window.innerHeight / 2);
    c.width = w; c.height = h;
    img = ctx.createImageData(w, h);
  };

  const draw = () => {
    if (hidden || !img) return;
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  };

  const start = () => { if (!timer) timer = setInterval(draw, 1000 / 12); };
  const stop = () => { clearInterval(timer); timer = null; };

  resize();
  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', () => {
    hidden = document.hidden;
    if (hidden) stop(); else start();
  });
  start();
  return { canvas: c, stop, start };
}
