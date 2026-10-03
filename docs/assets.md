# Herkunft der Bilder und Videos

Alle Medien sind neu erzeugt oder von den eigenen Kundenseiten aufgenommen. Von noth.in stammt keine Datei.

## Mit Higgsfield erzeugt (3. Oktober 2026)

Bildmodell: Nano Banana 2 (2K, die Folie in 4K). Videomodell: Veo 3.1, 8 Sekunden, 1280 × 720.
Die Videos laufen auf der Seite vorwärts und rückwärts hintereinander, damit die Schleife keinen Sprung hat.

### Folien-Ballons (`public/objects/`)

Grund-Prompt:

> Studio product photo of one inflated mylar foil balloon in the shape of a {FORM}, {FARBE} metallic foil, visible heat-sealed seams, soft wrinkles and crinkles along the seams, glossy mirror reflections of softboxes, floating, centred, the whole object inside the frame with margin, no string, no ribbon, isolated on a pure black background (#000000), no floor, no shadow, no text, no logo, sharp focus, 85 mm lens, very high detail.

| Datei | Form | Farbe | Job-ID |
| --- | --- | --- | --- |
| `smiley` | round smiley face, embossed | silver aluminium | 46845939-d12e-49bb-9923-50e8688be228 |
| `cursor` | mouse-pointer arrow | orchid (#DA70D6) | ef046911-eb6d-4bc1-be50-c65f15991119 |
| `flower` | daisy with six round petals | chrome silver | 189c8eba-dfbd-4c4c-80f4-298c06c9e9f6 |
| `bolt` | lightning bolt | holographic iridescent silver | 6f2928d6-1824-47b6-8b00-37db5091096a |
| `cloud` | cloud | pearl silver | b4fe4d5b-9e61-4679-bbc7-8900ab28ff16 |
| `bubble` | speech bubble | orchid (#DA70D6) | 4ff6f376-60c9-4915-b748-f404677da4fe |
| `at` | at sign (@) | silver aluminium | 02f8980b-7583-42dc-94c2-e3182b927f09 |

Nachbearbeitung: dunkle Pixel auf reines Schwarz gesetzt, quadratisch mit Rand zugeschnitten, 1200 px, WebP (Qualität 90) und PNG.
Sterne und Herzen wurden auf Wunsch entfernt.

### Folie für den Wisch-Effekt (`public/hero/`)

- Standbild (Job e8bf39a6-edd2-45e8-bded-603465929169): „Extreme macro of crumpled iridescent silver mylar foil filling the entire frame, soft folds, holographic reflections in orchid, cyan and gold, studio softbox highlights, no objects, no text.“
- Video (Job 317f1079-08c6-4e2a-8084-f7c9057c78cc): „The foil undulates very slowly as if it were breathing. Soft studio light sweeps slowly across the folds … Locked-off camera.“

### Video mit der Figur im Folien-Kostüm (`public/video/manifest.*`)

- Standbild (Job 7784cccf-4e3a-4d4d-bbd5-7587071d1eeb): eine Person in einem Ganzkörper-Kostüm aus aufgeblasener silberner Folie mit rundem Folien-Kopf, der das Gesicht ganz verdeckt, in einer Aufzugshalle aus gebürstetem Stahl, umgeben von silbernen und orchidfarbenen Folien-Ballons (rund, Wolken, Blitze, Sprechblasen; keine Sterne, keine Herzen).
- Video (Job 5e6cf042-f3d1-4613-8363-971c7b1c25ce): die Figur tanzt langsam, kommt näher und winkt. Keine Haut und kein Gesicht sichtbar.

### Standbilder

| Datei | Motiv | Job-ID |
| --- | --- | --- |
| `public/studio/small` | silberner Wolken-Ballon auf einem Betonwürfel | 68c168ec-f6bf-4485-a42a-21c2e2237c1b |
| `public/studio/big` | orchidfarbener Wolken-Ballon über einer Wiese | 4948462c-75d1-4f1d-b929-2d1c957be323 |
| `public/manifest/card-1` | halb leerer Smiley-Ballon auf weißem Tisch | 368efc8d-9ea0-4c60-b1b1-211470a46ddd |
| `public/manifest/card-2` | Mauszeiger-Ballon unter einer Bürodecke | 7307c177-5631-422c-bf24-3de436f5f2d8 |

## Eigene Arbeit, nicht erzeugt

- `public/works/ounji.*`, `public/works/fleischerei-guskic.*`: Screenshots der Kundenseiten (1600 × 1000).
- `public/video/reel-ounji.mp4`, `public/video/showreel.mp4`: Scroll-Aufnahmen der Kundenseiten mit `scripts/record.mjs`.
- `public/og.jpg`: Screenshot des Start-Bereichs mit `?foil=1`.
- Die Wortmarke (`src/wordmark.js`) ist aus der freien Schrift Geist Bold erzeugt.
