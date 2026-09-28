import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Relativer base-Pfad: läuft unter einer Domain-Root (Vercel) genauso wie
// unter einem Unterpfad (GitHub Pages, /Project-1/).
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        impressum: resolve(__dirname, 'impressum.html'),
        datenschutz: resolve(__dirname, 'datenschutz.html'),
      },
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('node_modules/gsap') || id.includes('node_modules/lenis')) return 'motion';
        },
      },
    },
  },
  server: { port: 5173 },
});
