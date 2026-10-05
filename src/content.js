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
    letters: [
      { ch: 'g', x: 21, y: 22, rot: -24 },
      { ch: 'u', x: 46, y: 12, rot: 14 },
      { ch: 's', x: 78, y: 52, rot: 28 },
      { ch: 'k', x: 30, y: 90, rot: -12 },
      { ch: 'i', x: 74, y: 78, rot: 20 },
      { ch: 'c', x: 13, y: 48, rot: 34 },
    ],
  },

  manifestVideo: {
    line: 'das ist guskic studiO',
  },

  contact: {
    form: {
      mailto: 'guskic.studio@gmail.com',
      subject: 'Projektanfrage über guskic.studio',
    },
  },
};

export default content;
