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

Ein Push auf `main` baut die Seite und stellt sie über GitHub Pages online (`.github/workflows/deploy.yml`).

## Aufbau der Seite

1. **Intro** (`src/loader.js`): schwarze Fläche, „g“ und „O“, dazwischen wechseln Folien-Ballons, der Zähler läuft von 100 auf 000. Spielt einmal pro Sitzung.
2. **Start** (`src/hero.js`, `src/heroStage.js`, `src/fluid.js`, `src/balloonLetters.js`): weiße Fläche mit der Wortmarke. Wischen mit dem Zeiger hinterlässt eine feste schwarze Fläche wie verschüttete Tinte, die nach 2–3 Sekunden wieder verschwindet; darin steht der Name als Folien-Ballons. Das O ist immer das Chrom-O.
3. **Manifest**: Aussage, Showreel im Rahmen, kleiner Absatz mit fallenden Buchstaben.
4. **Arbeiten**: wandernde Überschrift, versetzte Projekt-Karten.
5. **Showreel** über die ganze Breite mit dem Schalter „Sound“.
6. **Studio**: Text und eine leere weiße Form mit runden Ecken.
7. **Leistungen**: Folien-Ballons und die Buchstaben g u s k i c, die dem Zeiger ausweichen.
8. **Video** mit der Figur im Folien-Kostüm, darüber Textblöcke und zwei Bildkarten.
9. **Kontakt** und **Fußzeile** mit der Wortmarke.

## Texte ändern

Die sichtbaren Texte stehen in `index.html`. Listen, die das JavaScript braucht (Ballons im Intro, Positionen der Ballons, die Zeile über dem Video, E-Mail-Adresse des Formulars), stehen in `src/content.js`.

Noch Platzhalter: die Adresse und die Telefonnummer in `impressum.html` und `datenschutz.html`.

## Bilder und Videos

| Ordner | Inhalt |
| --- | --- |
| `public/objects/` | Folien-Ballons, je 1200 × 1200 px als WebP und PNG, auf reinem Schwarz |
| `public/hero/` | Folien-Schleife (`foil.mp4`, Standbild `foil.webp`/`foil.jpg`), läuft in der Video-Kachel im Manifest |
| `public/video/` | `reel-ounji.mp4`, `showreel.mp4`, `manifest.mp4`, jeweils mit Standbild |
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
