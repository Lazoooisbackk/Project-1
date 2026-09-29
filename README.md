# guskic studiO

Webdesign-Studio von Lazar Guskic (Maria Ellend / Wien).
Schreibweise immer **guskic studiO**: alles klein, nur das O am Ende groß.
Spruch: „Websites, die man anfassen möchte.“

Der vollständige Auftrag steht in `PROMPT-website.md`.

## Starten

Voraussetzung: Node 20 oder neuer.

```
npm install
npm run dev       # Entwicklung, http://localhost:5173
npm run build     # fertige Seite nach dist/
npm run preview   # dist/ lokal ansehen, http://localhost:4173
```

## Logo

- Die ursprüngliche Logo-Seite liegt unverändert in `reference/logo.html` (Referenz, nicht Teil des Builds).
- Das O ist ein three.js-Objekt aus zerknitterter Chromfolie über zerknittertem Papier.
  Es dreht sich zum Zeiger, Klick zerknittert es neu. Der Code dafür steckt jetzt in `src/chromeO.js`
  (Hero) und `src/miniO.js` (kleine Chrom-Os im Loader, in „Leistungen“ und in der Karte „Dein Projekt?“).
- Stilvorbild: noth.in (nur Technik und Anspruch, kein Code, keine Texte, keine Bilder).

## Design

- Papier `#F5F3EE` · Tinte `#131313` · Grau `#5F5B54` · Loader-Schwarz `#0B0B0C` · Weiß `#FFFFFF`
- Einziger UI-Akzent: Orchid `#DA70D6` (Zähler bei 000, Unterstreichung beim Link-Hover)
- Schriften, selbst gehostet in `public/fonts` (keine Google-Fonts-Anfragen, DSGVO):
  Newsreader (Wortmarke, Display), Geist (Text), Geist Mono (Labels, Zähler)

## Bilder und Medien

| Ordner           | Dateien                                              | Wirkung |
| ---------------- | ---------------------------------------------------- | ------- |
| `public/intro/`  | `o-01-wolke`, `o-02-moos`, `o-03-pixel`, `o-04-puffy` (je `.webp` und `.png`) | Das O in vier Materialien: im Loader-Karussell und schwebend in „Leistungen“. |
| `public/works/`  | `ounji.jpg`, `fleischerei-guskic.jpg`                | Screenshots der Projekte. Fehlen sie, zeigt die Karte einen markierten Platzhalter. |
| `public/hero/`   | `reveal.mp4` (optional)                              | Schicht unter dem Papier beim Tinten-Effekt im Hero. Ohne Video: dunkle Chromfolie. |
| `public/studio/` | `lazar.jpg` (optional, Hochformat 4:5)               | Portrait in „Studio“. Ohne Bild: Platzhalter. |
| `public/`        | `og.jpg`, `favicon.png`, `favicon.svg`               | Vorschaubild für Links und Favicon (Chrom-O). |

**Material-Os:** freigestellt, ca. 800 px hoch, die weichen Kanten sind gegen Schwarz vormultipliziert.
Sie werden deshalb nur auf `#0B0B0C` gezeigt (Loader, „Leistungen“), nie auf dem Papier.
Reihenfolge im Intro: Wolke → Moos → Pixel → Puffy, zweimal, dann das echte 3D-Chrom-O.
Neue Versionen mit gleichem Dateinamen einfach ersetzen. Neue Maße in `src/content.js` unter `intro.materials` eintragen.

## Texte ändern

Alle Texte stehen gesammelt in `src/content.js` (Marke, Navigation, Hero, Manifest, Arbeiten,
Leistungen inkl. Position der schwebenden Os, Studio, Kontakt, Footer). Für eine englische Version dort
ein zweites Objekt anlegen. Die Sektionen in `index.html` enthalten die deutschen Texte zusätzlich im Markup;
wer dort etwas ändert, ändert beide Stellen.

Impressum und Datenschutz: `impressum.html` und `datenschutz.html`, Platzhalter in eckigen Klammern ausfüllen.

## Struktur

```
index.html                Startseite
impressum.html            Impressum (ECG und MedienG)
datenschutz.html          Datenschutz
reference/logo.html       Original-Logo-Seite (Referenz)
src/content.js            Alle Texte
src/main.js, src/page.js  Einstieg Startseite / Unterseiten
src/loader.js             Intro „Ein O, viele Materialien“ (einmal pro Session)
src/materials.js          Laden der vier Material-Os (WebP + PNG-Fallback)
src/hero.js               Hero: Wortmarke, Chrom-O, Tinten-Reveal, Übergabe vom Loader
src/chromeO.js            Chrom-O und Papier (aus dem Logo)
src/miniO.js              Kleines Chrom-O für Loader, Leistungen, Projektkarte
src/fluidReveal.js        Fluid-Simulation (Stable Fluids) als Maske
src/sections/*.js         Manifest, Arbeiten, Leistungen, Studio, Kontakt, Footer
src/nav.js, cursor.js, transitions.js, sound.js, grain.js, scroll.js, interactions.js
src/utils/split.js        Text-Splitting (Zeilen, Wörter, Buchstaben mit Masken)
src/styles/*.css          Tokens, Basis, Loader, Nav, Hero, Sektionen, Footer, Cursor, Seiten
.github/workflows/deploy.yml   Deploy auf GitHub Pages
```

## Deploy (GitHub Pages)

Jeder Push auf `main` baut die Seite und veröffentlicht `dist/` über GitHub Actions.
Einmalig in den Repo-Einstellungen: Settings → Pages → Source „GitHub Actions“.
Adresse: https://lazoooisbackk.github.io/Project-1/

Der Build nutzt relative Pfade und läuft deshalb auch unter `/Project-1/`.
Nach dem Umzug auf eine eigene Domain `og:image` in `index.html` auf die absolute URL ändern.
