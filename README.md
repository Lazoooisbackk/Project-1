# guskic studiO

Website des Webdesign-Studios von Lazar Guskic (Maria Ellend / Wien).
Schreibweise immer **guskic studiO**: alles klein, nur das O am Ende groß.

Das O im Logo ist ein three.js-Objekt aus zerknitterter Chromfolie über einem
prozeduralen Knitterpapier. Es dreht sich zum Zeiger, Klick zerknittert es neu.
Tagline: „Websites, die man anfassen möchte.“

## Starten

```
npm install
npm run dev       # http://localhost:5173
npm run build     # erzeugt dist/
npm run preview   # dist/ lokal ansehen
```

Voraussetzung: Node 20 oder neuer.

## Stack

- Vite + Vanilla JavaScript (ES-Module), plain CSS
- GSAP 3 mit ScrollTrigger, Flip, Observer und CustomEase (`studio` = 0.76, 0, 0.24, 1)
- Lenis (Smooth Scroll, mit ScrollTrigger synchronisiert)
- three.js (Chrom-O, Papier-Shader, Fluid-Simulation für den Hero, Objekt-Renderer)
- Schriften selbst gehostet in `public/fonts` (Newsreader, Geist, Geist Mono), keine Google-Fonts-Anfragen

## Struktur

```
index.html                Startseite
impressum.html            Impressum (Platzhalter in eckigen Klammern ausfüllen)
datenschutz.html          Datenschutz (Platzhalter ausfüllen)
src/content.js            Alle Texte der Website
src/main.js               Einstieg Startseite
src/page.js               Einstieg Unterseiten
src/loader.js             Intro-Loader (einmal pro Session)
src/hero.js               Hero: Wortmarke, Chrom-O, Fluid-Reveal, Übergabe vom Loader
src/chromeO.js            Chrom-O und Papier (aus der ursprünglichen Logo-Seite)
src/fluidReveal.js        Stable-Fluids-Simulation als Alpha-Maske
src/objects.js            Die acht Chrom-/Folienobjekte (PNG oder prozedural)
src/shaders.js            Gemeinsame GLSL-Bausteine
src/sections/*.js         Manifest, Arbeiten, Leistungen, Studio, Kontakt, Footer
src/nav.js                Menü (vier Punkte → X), Vollbild-Overlay
src/cursor.js             Cursor-Blase „Ansehen“ auf den Projektkarten
src/transitions.js        Seitenwechsel mit Vorhang und Mini-Zähler
src/sound.js              Optionaler Sound (WebAudio, standardmäßig aus)
src/grain.js              Filmkorn
src/scroll.js             Lenis + ScrollTrigger
src/interactions.js       Magnetische Buttons
src/utils/split.js        Text-Splitting (Zeilen, Wörter, Buchstaben, mit Masken)
src/styles/*.css          Tokens, Basis, Loader, Nav, Hero, Sektionen, Footer, Cursor, Seiten
public/                   Statische Dateien (siehe unten)
.github/workflows/        Deploy auf GitHub Pages
```

## Texte ändern

Alle Texte stehen in `src/content.js` (Marke, Navigation, Hero, Manifest, Arbeiten,
Leistungen, Studio, Kontakt, Footer). Für eine englische Version dort ein zweites
Objekt anlegen. Die Sektionen in `index.html` enthalten die deutschen Texte
zusätzlich im Markup; wer sie ändert, ändert beide Stellen.

## Bilder und Medien

| Ordner           | Dateien                                   | Wirkung                                                                 |
| ---------------- | ----------------------------------------- | ----------------------------------------------------------------------- |
| `public/intro/`  | `obj-01.png` … `obj-08.png` (transparent) | Objekte im Loader und in „Leistungen“. Fehlen sie, rendert three.js Ersatz. |
| `public/works/`  | `ounji.jpg`, `fleischerei-guskic.jpg`     | Screenshots der Projekte. Fehlen sie, zeigt die Karte einen Platzhalter.  |
| `public/hero/`   | `reveal.mp4` (optional)                   | Schicht unter dem Papier beim Fluid-Reveal. Sonst dunkle Chromfolie.      |
| `public/studio/` | `lazar.jpg` (optional, 4:5)               | Portrait. Sonst Platzhalter.                                              |
| `public/`        | `og.jpg`, `favicon.png`, `favicon.svg`    | Open-Graph-Bild und Favicon.                                              |

Die aktuellen `obj-*.png` sind prozedural gerendert und können durch eigene
Renderings ersetzt werden (quadratisch, transparent, ca. 640 px).
Dateinamen der Projekt-Screenshots stehen in `src/content.js` und `index.html`.

## Deploy

**GitHub Pages:** Der Workflow `.github/workflows/deploy.yml` baut bei jedem Push
auf `main` und veröffentlicht `dist/`. Im Repo unter Settings → Pages die Quelle
„GitHub Actions“ wählen. Der Build nutzt relative Pfade, läuft also auch unter
`/Project-1/`.

**Vercel:** Repo importieren (Framework Vite wird erkannt, Build `npm run build`,
Output `dist`). Konfiguration liegt in `vercel.json`.

Für Open Graph muss `og:image` in `index.html` nach dem Launch auf die absolute
URL der Domain geändert werden.

## Barrierefreiheit und Performance

- `prefers-reduced-motion`: kein Karussell, kein Fluid, keine fallenden Buchstaben, nur Fades
- WebGL-Fallback: ohne WebGL steht das O als Newsreader-Buchstabe, der Fluid-Reveal entfällt
- Alle WebGL-Schleifen und das Video pausieren, sobald der Hero aus dem Bild ist oder der Tab inaktiv wird
- Pixel-Ratio auf 2 begrenzt, Bilder lazy, Fonts und Loader-Objekte vorgeladen
- Skip-Link, sichtbare Fokuszustände, Alt-Texte, `aria-hidden` auf dekorativen Canvases

## Brand

Papier `#F5F3EE` · Tinte `#131313` · Grau `#5F5B54` · Loader-Schwarz `#0B0B0C` · Weiß `#FFFFFF`
Newsreader 500 (Display, Wortmarke) · Geist (Text) · Geist Mono (Labels, Zähler)
