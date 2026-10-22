# Upload 45: Paket 3, der Live-Sichtbarkeits-Check

Was drin ist: Der Block „Gratis Website-Check“ ist jetzt ein Werkzeug. Der Besucher tippt seine Adresse ein, Google misst die Seite am Handy, nach etwa 30 Sekunden erscheinen das Handy-Bild, vier Ampeln (Tempo, Handy, Sicherheit, Google) und ein Satz, was die Ladezeit kostet. Danach kann er seine E-Mail-Adresse eintragen: das Ergebnis kommt zu Ihnen, Sie schicken ihm innerhalb von 24 Stunden drei Verbesserungen. Klappt die Messung nicht, geht die Adresse per Formular an Sie. Dazu: Datenschutz-Absatz für Google, README.

## Wichtig: der Google-Schlüssel (10 Minuten, nur Sie)

Ohne Schlüssel nimmt Google nur wenige Messungen am Tag an, dann greift immer der Ersatzweg. So bekommen Sie den Schlüssel (gratis):
1. https://console.cloud.google.com öffnen, mit dem Google-Konto anmelden, oben „Projekt erstellen“ (Name: guskic-studio).
2. Links „APIs und Dienste“ → „Bibliothek“ → „PageSpeed Insights API“ suchen → „Aktivieren“.
3. „APIs und Dienste“ → „Anmeldedaten“ → „Anmeldedaten erstellen“ → „API-Schlüssel“. Den Schlüssel kopieren.
4. Beim Schlüssel „Einschränken“: Anwendungseinschränkung „Websites“, Einträge `https://guskicstudio.vercel.app/*` und `https://lazoooisbackk.github.io/*`; API-Einschränkung: nur „PageSpeed Insights API“. Speichern.
5. Den Schlüssel mir schicken, ich trage ihn in `src/content.js` bei `check.psiKey` ein und Sie laden die Datei hoch.

## So laden Sie hoch (Safari, GitHub Lazoooisbackk/Project-1)

1. **Add file → Upload files**.
2. Im Finder alle Einträge dieses Ordners markieren (Cmd+A) und ins Browserfenster ziehen (nicht den Ordner selbst).
3. Warten, bis alle 7 Dateien in der Liste stehen (plus diese Anleitung).
4. Als Nachricht: `Paket 3: Live-Sichtbarkeits-Check` und **Commit changes** drücken.
5. Mir „hab“ schreiben, ich prüfe live.

## Dateien (7)

index.html, datenschutz.html, README.md, src/content.js, src/main.js, src/sections/check.js, src/styles/offer.css
