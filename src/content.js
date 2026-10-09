/*
  Listen und Texte, die das JavaScript braucht. Die sichtbaren Texte stehen in index.html.
*/
export const content = {
  brand: { name: 'guskic studiO' },

  nav: {
    menuOpen: 'Menü öffnen',
    menuClose: 'Menü schließen',
    soundOn: 'Sound on',
    soundOff: 'Sound off',
  },

  /* Folien-Ballons: Dateien in public/objects (1200 × 1200 px, WebP + PNG, auf reinem Schwarz).
     Sie stehen nur auf schwarzen Flächen und werden mit „lighten“ gemischt. */
  objects: {
    intro: ['smiley', 'cursor', 'flower', 'at', 'bolt'],
    /* Leistungen: x/y in % der Ballon-Fläche (Desktop), mx/my bis 991 px Breite, size in vw, rot in Grad */
    cluster: [
      { id: 'cloud', x: 33, y: 30, mx: 26, my: 22, size: 19, rot: -10 },
      { id: 'bubble', x: 55, y: 60, mx: 66, my: 52, size: 20, rot: 12 },
      { id: 'bolt', x: 68, y: 26, mx: 78, my: 20, size: 14, rot: 16 },
      { id: 'flower', x: 42, y: 78, mx: 26, my: 76, size: 14, rot: -18 },
      { id: 'at', x: 63, y: 86, mx: 72, my: 86, size: 11, rot: 8 },
      { id: 'smiley', x: 24, y: 66, mx: 46, my: 30, size: 10, rot: -6 },
    ],
    letters: [],                                   // einzelne Buchstaben zwischen den Ballons: vorerst keine
  },

  manifestVideo: {
    line: 'das ist guskic studiO',
  },

  /* Pakete und Notiz.
     showPrices: false = die Seite zeigt keine einzige Zahl. true = unter jedem Paket steht sein Preis (in Euro, hier eintragen). */
  offer: {
    showPrices: false,
    prices: { onepager: 'ab 800 €', website: 'ab 1.200 €', care: '49 € im Monat' },
    note: {
      subject: 'Notiz zur Website',
      thanks: 'Danke, Ihre Notiz ist angekommen.',
    },
  },

  contact: {
    form: {
      /* Das Formular schickt die Angaben an Web3Forms, der Dienst leitet sie als E-Mail weiter.
         Klappt das einmal nicht, öffnet sich als Ersatz das E-Mail-Programm mit dem fertigen Text. */
      endpoint: 'https://api.web3forms.com/submit',
      accessKey: '66309881-baef-4ea0-99dd-f8f40d98b2c9',   // öffentlicher Schlüssel von Web3Forms, gehört zu guskic.studio@gmail.com
      mailto: 'guskic.studio@gmail.com',
      subject: 'Projektanfrage über guskic.studio',
      thanks: 'Danke, Ihre Nachricht ist angekommen.',
      types: {
        projekt: { title: 'Projekt anfragen', subject: 'Projektanfrage', message: 'Worum geht es?' },
        check: { title: 'Gratis Website-Check', subject: 'Website-Check', message: 'Was soll besser werden? (freiwillig)' },
        termin: { title: 'Erstgespräch anfragen', subject: 'Terminanfrage Erstgespräch', message: 'Worum geht es? (freiwillig)' },
      },
    },
  },
};

export default content;
