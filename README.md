# guskic studiO

Website des Webdesign-Studios von Lazar Guskic (Maria Ellend / Wien).
Schreibweise immer **guskic studiO**: alles klein, nur das O am Ende groß.
Spruch: „Websites, die man anfassen möchte.“

Die Seite folgt in Aufbau, Schriftbild und Bewegung dem Vorbild noth.in. Code, Bilder, Videos und Texte sind eigene.

## Starten

Voraussetzung: Node 20 oder neuer.

```
npm install
npm run dev       # Entwicklung, http://localhost:5173
npm run build     # fertige Seite nach dist/
npm run preview   # dist/ lokal ansehen, http://localhost:4173
```

Ein Push auf `main` baut die Seite auf Vercel (https://guskicstudio.vercel.app, Hauptadresse) und über GitHub Pages (`.github/workflows/deploy.yml`, Zweitkopie). `npm run build` ruft danach `scripts/fix404.mjs` auf, das in `dist/404.html` die Pfade absolut macht (Vercel liefert die 404-Seite unter jeder Adresse aus).

## Aufbau der Seite

1. **Intro** (`src/loader.js`): schwarze Fläche, „g“ und „O“, dazwischen die Folien-Ballons, der Zähler läuft von 100 auf 000, das O wird zum Chrom-O, der Vorhang hebt sich. Rund 2,2 s bis der Vorhang hochgeht, 3 s bis er oben ist. Klick, Tipp oder Taste überspringt. Spielt einmal pro Sitzung. Die Ballons kommen als kleine 480-px-Bilder (`public/objects/*-s.webp`).
2. **Start** (`src/hero.js`, `src/heroStage.js`, `src/fluid.js`, `src/balloonLetters.js`): weiße Fläche mit der Wortmarke. Wischen mit dem Zeiger hinterlässt eine schwarze Fläche wie verschüttete Tinte, darin steht der Name als Folien-Ballons. Das O ist immer das Chrom-O.
3. **Manifest**: „Weggeklickt wird woanders.“, die OUNJI-Seite als Scroll-Aufnahme, Link auf www.ounji.at.
4. **Studio**: die Glas-Säule, in der zwei Jitter-Schleifen (luma, dithering) endlos nach unten laufen (`src/sections/studio.js`).
5. **Leistungen**: die weiße Anruf-Karte mit der Telefonnummer und der rote Hörer, der dem Zeiger ausweicht (`src/sections/services.js`).
6. **Drei Wege**: Onepager, Website, Betreuung (Preise über `offer.showPrices` in `src/content.js`), die Notiz zum Hineinschreiben, der Gratis Website-Check (Formular-Overlay), die Instagram-Fläche.
7. **Kontakt** und **Fußzeile** mit der Wortmarke und dem zweiten Chrom-O.

Unterseiten: `impressum.html`, `datenschutz.html`, `404.html` (alle über `src/page.js`, ohne Menü, mit kleiner Fußzeile). `vercel.json` schaltet saubere Adressen ein (`/impressum` statt `/impressum.html`) und setzt Sicherheits-Header. `public/robots.txt` und `public/sitemap.xml` liegen bei.

## Offene Punkte (Stand 22. Oktober 2026)

- **Eigene Domain und E-Mail.** Sobald die Domain da ist: die Adresse `https://guskicstudio.vercel.app` in `index.html` (canonical, og:url, og:image, JSON-LD), `public/robots.txt` und `public/sitemap.xml` ersetzen; Gmail-Adresse in `index.html`, `impressum.html`, `datenschutz.html` und `src/content.js` tauschen.
- **Impressum nach der Gewerbeanmeldung ergänzen:** Gewerbeberechtigung, WKO-Mitgliedschaft, Behörde, UID oder Kleinunternehmer-Hinweis (Kommentar in `impressum.html`).
- **Besucherzahlen:** Vercel Web Analytics im Vercel-Dashboard einschalten, dann `<script defer src="/_vercel/insights/script.js"></script>` vor `</body>` in `index.html` und einen Satz in `datenschutz.html` ergänzen (cookiefrei).
- **Ballast, der gelöscht werden kann** (wird nicht geladen): `public/video/manifest.mp4`, `manifest.jpg`, `manifest.webp`, `showreel.mp4`, `showreel.jpg`, `src/sections/works.js`, `src/sections/showreel.js`, `insta-slides.html`, `o-render.html` (nur lokal). Löschen geht auf GitHub pro Datei über „…“ → „Delete file“.
- Prüfbericht mit allen Schwachstellen und dem Plan: `../Website-Pruefbericht-2026-10-22.md`.

## Texte ändern

Die sichtbaren Texte stehen in `index.html`. Listen, die das JavaScript braucht (Ballons im Intro, Positionen der Ballons, die Zeile über dem Video, E-Mail-Adresse des Formulars), stehen in `src/content.js`.

Pakete und Notiz: `offer.showPrices` in `src/content.js` schaltet Preise unter den Paketen ein oder aus (Standard: aus, die Seite zeigt keine Zahlen). Die Notiz und das Formular (Projekt, Website-Check, Erstgespräch) senden über Web3Forms (`contact.form.endpoint` und `accessKey`) (`src/utils/send.js`); schlägt das Senden fehl, öffnet sich als Ersatz eine fertige E-Mail.

## Bilder und Videos

| Ordner | Inhalt |
| --- | --- |
| `public/objects/` | Folien-Ballons, je 1200 × 1200 px als WebP und PNG, auf reinem Schwarz |
| `public/hero/` | Folien-Schleife (`foil.mp4`, Standbild `foil.webp`/`foil.jpg`), läuft in der Video-Kachel im Manifest |
| `public/video/` | `reel-ounji.mp4`, `showreel.mp4`, `manifest.mp4`, `luma.mp4` (Jitter-Schleife im Studio-Bereich), jeweils mit Standbild |
| `public/works/` | Screenshots der Kundenseiten |
| `public/manifest/` | die beiden Bildkarten über dem Video |
| `public/og.jpg` | Vorschaubild für geteilte Links |

Die Ballons haben einen durchsichtigen Hintergrund. Ihre Kanten sind für dunkle Flächen gemacht, deshalb stehen sie nur auf Schwarz. Welche Ballons wo erscheinen, steht in `src/content.js` unter `objects`.

Woher jedes Bild und Video stammt, steht in `docs/assets.md`.

### Kundenseiten neu aufnehmen

```
PW=/pfad/zu/playwright-core node scripts/record.mjs ounji https://ounji.webflow.io
```

Das Skript legt einen Screenshot und 300 Einzelbilder ab. Aus den Einzelbildern macht ffmpeg das Video:

```
ffmpeg -framerate 30 -i _assets/rec/ounji-frames/f%04d.jpg -vf "scale=1280:720,format=yuv420p" -an -c:v libx264 -crf 27 -movflags +faststart public/video/reel-ounji.mp4
```

## Schrift

- **Geist** (variabel, 100–900) für alles. Das Vorbild nutzt PP Neue Montreal, die kostet Geld. Mit einer Lizenz: Datei nach `public/fonts` legen, in `public/fonts/fonts.css` eintragen und in `src/styles/tokens.css` bei `--sans` nach vorne stellen.
- **IBM Plex Mono** für kleine Labels und Zähler.
- Beide Schriften liegen in `public/fonts`. Die Seite lädt nichts von Google oder anderen Schrift-Anbietern.

## Wortmarke und Chrom-O

- Die Buchstaben „guskic studi“ sind SVG-Pfade in `src/wordmark.js`, erzeugt aus Geist Bold:
  `node scripts/wordmark.mjs` (nur nötig, wenn sich Schrift, Laufweite oder Text ändern).
- Das O hat die Form des alten Logos: das Serifen-O aus Newsreader (wght 500, opsz 18). Seine Kontur liegt in `scripts/newsreader-o.json` (erzeugt mit `python3 scripts/newsreader-o.py`, braucht `pip install fonttools brotli`). `scripts/wordmark.mjs` skaliert es auf die Versalhöhe von Geist und setzt es auf dieselbe Grundlinie. Die Schrift selbst wird nicht ausgeliefert.
- Das O ist ein three.js-Objekt aus zerknitterter Chromfolie (`src/chromeO.js`): eine Röhre mit dicken Seiten und dünnem Scheitel wie eine Antiqua (`rMax`, `rMin`, `stress` in `buildO()`). Im SVG liegt an seiner Stelle ein unsichtbarer O-Pfad; daran wird das Chrom-O in Größe und Position ausgerichtet. Im Intro ist das weiße O dieselbe Kontur als SVG, damit der Übergang zum Chrom-O deckungsgleich ist.
- Ohne WebGL erscheint das O als normaler Buchstabe und der Wisch-Effekt entfällt.

## Ballon-Buchstaben beim Wischen

Jeder Buchstabe von „guskic studi“ ist ein eigenes 3D-Objekt aus perlweißer, schillernder Folie: Der SVG-Pfad wird über ein Distanzfeld zu einer runden Röhre aufgeblasen, mit gepresster Naht und Knittern am Rand, leicht gekippt, vergrößert und überlappend wie echte Buchstaben-Ballons. Form, Farbe und Glanz stehen oben in `src/balloonLetters.js` (`BALLOON`), Dicke und Lebensdauer der schwarzen Fläche in `src/fluid.js` (`FLUID_DEFAULTS`).

## Flüssig bleiben

- **Scrollen:** Das weiche Scrollen (Lenis) läuft nur, solange der Browser schnell genug zeichnet. `src/scroll.js` misst die Bildrate; fällt sie unter etwa 42 Bilder pro Sekunde (Safari im Energiesparmodus, iPhone im Stromsparmodus, schwache Geräte), übernimmt das normale Scrollen des Browsers. Das bleibt auch dann flüssig.
- **Kein dauerhaftes Mischen:** `mix-blend-mode` ist nur aktiv, solange im Start-Bereich Tinte zu sehen ist (`body.is-inked`). Die Navigation wechselt ihre Farbe sonst über die Klasse `is-light` (`src/nav.js`).
- **Keine erzwungenen Ebenen:** kein `will-change` auf Buchstaben und Bildern.
- **Videos und 3D** laufen nur, solange sie zu sehen sind. Auf dem Handy haben die Ballon-Buchstaben ein gröberes Gitter.

## Prüfen

- `?foil=1` an die Adresse hängen: der Start-Bereich zeigt die ganze Folienwelt (so entsteht auch `og.jpg`).
- Das Intro spielt nur einmal pro Sitzung. Zum Wiederholen den Tab schließen oder im Browser den Session Storage leeren.
- Bei „Bewegung reduzieren“ im Betriebssystem gibt es kein Intro-Karussell, keinen Wisch-Effekt und kein Parallax.
