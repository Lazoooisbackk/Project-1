/* Nach dem Build: in dist/404.html relative Pfade (./assets, ./fonts, ./favicon) absolut machen,
   weil Vercel die 404-Seite unter jeder beliebigen Adresse ausliefert (auch /irgendwas/tief). */
import fs from 'node:fs';
const p = new URL('../dist/404.html', import.meta.url);
if (fs.existsSync(p)) {
  const s = fs.readFileSync(p, 'utf8').replace(/(href|src)="\.\//g, '$1="/');
  fs.writeFileSync(p, s);
  console.log('404.html: Pfade absolut gesetzt');
}
