/*
  Listen und Texte, die das JavaScript braucht. Die sichtbaren Texte stehen in index.html.
*/
export const content = {
  brand: { name: 'guskic studiO' },

  nav: {
    menuOpen: 'Menü öffnen',
    menuClose: 'Menü schließen',
  },

  /* Folien-Ballons: Dateien in public/objects (1200 × 1200 px, WebP + PNG, auf reinem Schwarz).
     Sie stehen nur auf schwarzen Flächen und werden mit „lighten“ gemischt. */
  objects: {
    intro: ['smiley', 'cursor', 'flower', 'at', 'bolt'],
    /* Leistungen: x/y in % der Ballon-Fläche (Desktop), mx/my bis 991 px Breite, size in vw, rot in Grad */
    cluster: [
      { id: 'hoerer', x: 58, y: 50, mx: 50, my: 50, size: 30, rot: -4 },   /* der rote Hörer, groß rechts */
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
