/*
  Nimmt die echten Kunden-Websites auf: ein Screenshot für die Projekt-Karte und ein ruhiges Scroll-Video.
  Aufruf: PW=/pfad/zu/playwright-core node scripts/record.mjs <name> <url> [ausgabe-ordner]
  Danach setzt ffmpeg die Einzelbilder zu einem .mp4 zusammen (siehe README).
*/
import { createRequire } from 'node:module';
import { mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || 'playwright-core');

const [name, url, outDir = '_assets/rec'] = process.argv.slice(2);
if (!name || !url) { console.error('usage: record.mjs <name> <url> [outDir]'); process.exit(1); }
mkdirSync(outDir, { recursive: true });

const launch = async () => {
  try { return await chromium.launch({ channel: 'chrome' }); } catch (e) { return chromium.launch(); }
};
const browser = await launch();

/* 1. Screenshot vom Seitenanfang für die Projekt-Karte */
{
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3500);
  await page.screenshot({ path: resolve(outDir, `${name}.png`) });
  await ctx.close();
}

/* 2. Scroll-Video: Bild für Bild aufnehmen (30 Bilder pro Sekunde), danach mit ffmpeg zusammensetzen */
{
  const size = { width: 1600, height: 900 };
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const total = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  const dist = Math.min(total, 5200);
  const frames = 300, hold = 24;                       // 10 Sekunden, davon am Anfang kurz stehen
  const dir = resolve(outDir, `${name}-frames`);
  mkdirSync(dir, { recursive: true });
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  for (let i = 0; i < frames; i++) {
    const t = Math.max(0, (i - hold) / (frames - hold - 1));
    await page.evaluate((y) => window.scrollTo(0, y), Math.round(ease(t) * dist));
    await page.waitForTimeout(45);
    await page.screenshot({ path: resolve(dir, `f${String(i).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 88 });
  }
  await ctx.close();
}

await browser.close();
console.log('ok', name, readdirSync(outDir).filter((f) => f.startsWith(name)));
