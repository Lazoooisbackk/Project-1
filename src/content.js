/*
  Alle Texte der Website. Für eine englische Version später eine zweite
  Sprache anlegen und in main.js auswählen.
*/
export const content = {
  brand: {
    name: 'guskic studiO',
    mark: 'guskic studi',
    o: 'O',
    tagline: 'Websites, die man anfassen möchte.',
    city: 'Wien',
    place: 'Maria Ellend',
    year: '2026',
  },

  nav: {
    links: [
      { label: 'Arbeiten', href: '#arbeiten' },
      { label: 'Leistungen', href: '#leistungen' },
      { label: 'Studio', href: '#studio' },
      { label: 'Kontakt', href: '#kontakt' },
    ],
    legal: [
      { label: 'Impressum', href: 'impressum.html' },
      { label: 'Datenschutz', href: 'datenschutz.html' },
    ],
    menuOpen: 'Menü öffnen',
    menuClose: 'Menü schließen',
    soundOn: 'Sound on',
    soundOff: 'Sound off',
  },

  hero: {
    labelLeft: 'Webdesign · Wien',
    labelRight: 'N°01 — 2026',
    scroll: 'Scroll',
    hintMouse: 'Maus bewegen · Klicken zum Zerknittern',
    hintTouch: 'Ziehen zum Drehen · Tippen zum Zerknittern',
    loading: 'Laden',
    noGl: '3D nicht verfügbar',
  },

  /* Intro: ein O, viele Materialien (Dateien in public/intro, WebP + PNG).
     Reihenfolge nicht ändern. w/h = Pixelmaße der Dateien. */
  intro: {
    materials: [
      { id: 'o-01-wolke', name: 'Wolke', w: 727, h: 800 },
      { id: 'o-02-moos', name: 'Moos', w: 682, h: 800 },
      { id: 'o-03-pixel', name: 'Pixel', w: 736, h: 800 },
      { id: 'o-04-puffy', name: 'Puffy', w: 800, h: 786 },
    ],
  },

  manifest: {
    statement: 'Die meisten Websites werden weggescrollt. Meine werden angefasst.',
    side: 'Ich baue Websites für Menschen, die nicht wie alle anderen aussehen wollen: von Wien aus, für überall.',
  },

  works: {
    label: 'Arbeiten',
    title: 'ARBEITEN',
    cursor: 'Ansehen',
    missing: 'Screenshot folgt',
    items: [
      {
        num: "W'01",
        title: 'OUNJI',
        meta: 'Brow & Lash Studio · Webflow · 2026',
        line: 'Ein Studio, das man spürt, bevor man es betritt.',
        href: 'https://ounji.webflow.io',
        img: 'works/ounji.jpg',
        alt: 'Screenshot der Website von OUNJI, Brow & Lash Studio',
      },
      {
        num: "W'02",
        title: 'Fleischerei Guskic',
        meta: 'Fleischerei am Hannovermarkt, Wien · Webflow · 2026',
        line: 'Tradition seit Generationen, jetzt online.',
        href: 'https://fleischerei-guskic.webflow.io',
        img: 'works/fleischerei-guskic.jpg',
        alt: 'Screenshot der Website der Fleischerei Guskic am Hannovermarkt',
      },
    ],
    cta: {
      num: "W'03",
      title: 'Dein Projekt?',
      line: 'Hier könnte deine Marke stehen.',
      href: '#kontakt',
    },
    all: 'Alle ansehen (03)',
  },

  services: {
    label: 'Leistungen',
    lead: 'Ich gestalte:',
    list: ['Websites', 'Landingpages', 'Online-Shops', 'Branding', 'Betreuung'],
    note: 'Perspektive ist, wo Strategie auf Gestaltung trifft.',
    /* Schwebende Os: x/y in % der Sektion (Desktop), mx/my bis 991 px Breite, size in vw (8–22). */
    objects: [
      { type: 'material', id: 'o-01-wolke', x: 30, y: 13, mx: 9, my: 16, size: 16, rot: -12 },
      { type: 'material', id: 'o-02-moos', x: 91, y: 50, mx: 88, my: 22, size: 20, rot: 14 },
      { type: 'material', id: 'o-03-pixel', x: 70, y: 88, mx: 70, my: 84, size: 14, rot: -8 },
      { type: 'material', id: 'o-04-puffy', x: 17, y: 56, mx: 14, my: 82, size: 18, rot: 18 },
      { type: 'chrome', x: 50, y: 10, mx: 50, my: 9, size: 8, rot: -6 },
    ],
  },

  studio: {
    label: 'Studio',
    text: 'Ich bin Lazar, 17, aus Maria Ellend. Ich baue Websites mit Gefühl für Details, weil der erste Eindruck heute online passiert.',
    portraitAlt: 'Lazar Guskic',
    portraitMissing: 'Portrait folgt',
    marquee: 'guskic studiO — Websites, die man anfassen möchte —',
  },

  contact: {
    label: 'Kontakt',
    title: 'Lass uns anfangen.',
    primary: { label: 'Projekt anfragen', href: 'mailto:hallo@guskic.studio' },
    secondary: { label: 'Instagram', href: 'https://www.instagram.com/' },
    scrollHint: 'Weiter scrollen öffnet das Formular',
    form: {
      title: 'Projekt anfragen',
      close: 'Schließen',
      name: 'Name',
      email: 'E-Mail',
      message: 'Worum geht es?',
      submit: 'Absenden',
      mailto: 'hallo@guskic.studio',
      subject: 'Projektanfrage über guskic.studio',
    },
  },

  footer: {
    links: [
      { label: 'Impressum', href: 'impressum.html' },
      { label: 'Datenschutz', href: 'datenschutz.html' },
      { label: 'Instagram', href: 'https://www.instagram.com/', external: true },
    ],
    copyright: '© 2026 guskic studiO',
  },
};

export default content;
