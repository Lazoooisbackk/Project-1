# Build the website for "guskic studiO": an award-level, motion-driven studio site

## 0. Context and ground rules
- Read `README.md` and `index.html` in this repo first. `index.html` contains my existing logo: the wordmark **guskic studiO** set in Newsreader 500, where the final capital **O** is a live three.js object made of **crumpled chrome foil** (custom tube geometry, ridged-noise vertex displacement, flatShading, metalness 1, iridescence, custom PMREM studio environment). It tilts toward the pointer and re-crumples on click, over a procedural **crumpled-paper** background. Reuse this code and look. It is the heart of the brand.
- The spelling is always exactly **guskic studiO**: all lowercase except the final capital O. Never "Guskic Studio", never "GUSKIC".
- guskic studiO is the one-person web design studio of Lazar Guskic (17, Maria Ellend / Vienna, Austria). Tagline: **"Websites, die man anfassen möchte."** The site language is **German**. Keep all copy in one `content.js` so an English version can be added later.
- Style reference: the motion design of the Paris studio noth.in (black and white, huge type, crumpled chrome and foil objects, a playful intro). **Build an original implementation.** Do not copy their code, texts, images or logo. Only the techniques and the level of craft are the reference. My site uses no foreign objects at all: the only objects are material versions of **my own O** (cloud, moss, pixel, puffy, and the live chrome O).
- Quality bar: Awwwards "Site of the Day" level. Everything must be smooth at 60 fps, pixel-precise, free of layout shifts, and must work flawlessly on mobile.

## 1. Tech stack
- Vite + vanilla JavaScript (ES modules) and plain CSS. No React.
- **GSAP 3** with ScrollTrigger, Flip, Observer and CustomEase (all free now).
- **Lenis** for smooth scrolling, synced with the ScrollTrigger ticker.
- **three.js** for the chrome O and the WebGL effects.
- Deploy as a static site (GitHub Pages or Vercel). Add a GitHub Action for Pages.
- **Self-host all fonts** in `/public/fonts` (woff2), with no Google Fonts requests, because of GDPR in Austria:
  - Newsreader for the display and wordmark
  - Geist for body and UI text
  - Geist Mono for labels, counters and numbers
- Structure: `src/loader.js`, `src/hero.js`, `src/chromeO.js` (from index.html), `src/fluidReveal.js`, `src/sections/*.js`, `src/cursor.js`, `src/utils/split.js`, `src/content.js`, `src/styles/*.css`.

## 2. Design tokens
- Paper `#F5F3EE`, ink `#131313`, muted `#5F5B54`, loader black `#0B0B0C`, white `#FFFFFF`. The only color accents come from the material Os: orchid `#DA70D6`, the lilac of the puffy O, the moss green, and the chrome reflections. Use orchid sparingly as the single UI accent, for example the counter at 000 or link hover states.
- Type scale:
  - Wordmark: fitted to the viewport width (fit-text, like in index.html), letter-spacing -0.035em.
  - H1 statements: clamp(40px, 6vw, 96px), line-height 1.02.
  - Body: 16–18px.
  - Labels: Geist Mono 11–12px, uppercase, letter-spacing 0.07em.
- A subtle film-grain overlay on the whole site (fixed canvas or SVG noise, about 4% opacity, animated at 12 fps).
- Custom easing: `CustomEase.create("studio", "0.76, 0, 0.24, 1")`, similar to power4.inOut.
- Nav: logo mark "gO" top left. Top right a menu button made of four dots (2×2 grid) that morphs into an X. Full-screen menu overlay with big Newsreader links that slide up line by line.

## 3. The intro loader (most important part, follow these timings exactly)
Full-screen black overlay (`#0B0B0C`, z-index above everything). It plays **once per session** (a sessionStorage key). On later visits it is skipped instantly.
1. **t = 0:** Bottom center shows a counter in Geist Mono 11px white, reading **"100"** (always 3 digits, zero-padded).
2. In the center, the two outer letters of the wordmark: a white lowercase **"g"** (Newsreader, about 9vw) on the left and a white capital **"O"** on the right.
   - The "g" slides up from `yPercent: 100` to `0` inside an overflow-hidden mask (1.0 s, power4.inOut).
   - At the same time the "O" scales from 0 to 1 around its center (1.0 s, power4.inOut).
   - They start almost touching ("gO").
3. **The gap opens:** an image window between "g" and "O" animates its width from 1rem to **20rem** (10rem at ≤ 991px), 1.2 s power4.inOut, pushing the letters apart.
4. **"One O, many materials" carousel inside the gap:** this is the signature idea of the brand. The gap never shows random objects. It always shows **my logo O**, each time made of a different material, until it becomes the real chrome O.
   - The images already exist in this repo (transparent WebP with a PNG fallback, about 800px, made for display on the black loader):
     1. `/public/intro/o-01-wolke.webp`: the O as a white cloud
     2. `/public/intro/o-02-moos.webp`: the O covered in green moss with orchid flowers
     3. `/public/intro/o-03-pixel.webp`: the O built from orchid and black voxel cubes
     4. `/public/intro/o-04-puffy.webp`: the O as a puffy, inflated lilac balloon
   - Use them **as they are**, in this exact order, at full quality. Do not recolor, filter, compress further or crop them. Render them with `object-fit: contain` inside the gap window, centered, at a height of about 70% of the window, with `image-rendering: auto` and no CSS scaling above 100% of their pixel size on DPR 2.
   - Preload all 4 with `new Image()` plus `decode()` before the loader starts, so no image ever pops in half-loaded. Use `<picture>` with the WebP and the PNG fallback.
   - The first O (cloud) pops in: `scale 0 → 1, rotate 0 → 8deg`, 0.8 s, `back.out(0.9)`, delay 0.5 s.
   - Then the materials swap: cloud → moss → pixel → puffy. Loop through them twice, about 240 ms per image. Each new one appears with `scale 0.85 → 1, opacity 0 → 1`, 0.32 s `back.out(1.2)`, and a small random rotation between -8° and 8°.
   - **Final beat:** after the last puffy O, the gap shows the **live three.js chrome O** from `index.html`, rendered small in the gap with the same material, rotating slowly and crumpling in. This is the last image before the exit.
   - Meanwhile the counter tweens **100 → 000** (power2.inOut) over the carousel duration of about 2.6 s. Use the counter as the real preload progress where possible.
   - **If an image fails to load**, skip it silently. The loader must never break or show an empty frame.
   - These PNG/WebP files are made for dark backgrounds only, because their soft edges are premultiplied against black. **Only ever place them on `#0B0B0C` or darker.** Never place them on the paper background.
5. **Exit:**
   - The current object scales to 0 (0.6 s power4.inOut, delay 0.5 s).
   - The gap closes back to 1rem (0.8 s power4.inOut, delay 0.6 s).
   - The counter fades out (0.5 s).
   - Then the whole overlay collapses its **height to 0 from the bottom up** (1.8 s power4.inOut), like a curtain pulled up, revealing the hero.
   - Simultaneously the loader "g" slides down out of its mask and the loader "O" scales to 0.
6. **Hero handoff:**
   - The big wordmark letters "guskic studi" rise from `yPercent: 120` to `0` in **random order** (1.8 s power4.inOut, stagger 0.07, delay 0.2), each inside its own mask.
   - At 1.5 s the **chrome O** materializes: scale 0 → 1 with `back.out(0.9)`, while its crumple amount animates from 0 (smooth chrome) to 1 (crumpled).
   - Dispatch the custom events `loader:hero-reveal-start` and `loader:hero-revealed`.
7. `prefers-reduced-motion`: skip the carousel and do a 400 ms fade instead.

## 4. Sections (top to bottom)
**4.1 Hero**
- Crumpled-paper background (from index.html).
- Giant wordmark **guskic studiO** spanning the full width, with the live chrome O.
- Top labels: "Webdesign · Wien" left, "N°01 — 2026" right.
- Bottom labels: "Scroll" left, live readout right (O rotation + "Knitter 1.00", like index.html).
- **WebGL fluid mask reveal:** implement a real-time fluid simulation (stable fluids: double FBOs for velocity and dye, sim resolution 128, dye resolution 1024, curl/vorticity, pressure iterations 20, splat on pointer move).
  - Use the dye as an alpha mask: where the pointer moves, the paper surface dissolves like ink and reveals a layer underneath. That layer is `/public/hero/reveal.mp4` if present, otherwise a dark chrome-foil shader texture.
  - The mask heals back over about 1.5 s. On touch devices, drag to paint.
  - Pause the simulation when the hero is off-screen.
- Tagline under the wordmark: "Websites, die man anfassen möchte." (Newsreader italic), revealed line by line.

**4.2 Manifest**
- A large statement set word by word, where each word sits on its own line in narrow columns (editorial rhythm). Example:
  > "Die meisten Websites werden weggescrollt. Meine werden angefasst."
- Reveal: lines slide up from masks on enter. Mask trick: child `padding-bottom: .15em`, mask `margin-bottom: -.15em`, so descenders are not clipped.
- Side block (small, Geist): "Ich baue Websites für Menschen, die nicht wie alle anderen aussehen wollen: von Wien aus, für überall."
- **Falling letters on scroll:** when this block scrolls out (start "top top", end "center 30%", scrub 2), every letter falls with random y 40–160px, x ±10px, rotation ±20° and opacity → 0, each with a random delay of 0–0.6 s. Scroll velocity adds extra jitter.

**4.3 Arbeiten (Works)**
- Black section.
- The heading "A R B E I T E N" is built from single letters: scrubbed with GSAP Flip, the letters travel from a horizontal row into a vertical stack along the left edge and back (stagger from the end, scale 1 → 0.2 → 1, scrub 3).
- Project list, alternating left and right, with parallax (inner image 110% height, yPercent drift, scrub 1.5–3) and a clip-path reveal on enter (inset from the bottom, 1 s power4.inOut, start "top 88%"):
  1. **OUNJI**: brow and lash studio. Webflow, 2026. Link: https://ounji.webflow.io. Short line: "Ein Studio, das man spürt, bevor man es betritt."
  2. **Fleischerei Guskic**: family butcher shop at the Hannovermarkt, Wien. Link: https://fleischerei-guskic.webflow.io. Short line: "Tradition seit Generationen, jetzt online."
  3. **Dein Projekt?**: a card with a pulsing chrome O and "Hier könnte deine Marke stehen."
- Use full-page screenshots from `/public/works/` (generate them with Playwright if a browser is available, otherwise leave clearly marked placeholders).
- Each card has a number label in the form W'01, W'02.
- **Custom cursor on the cards:** the system cursor is hidden and a round white bubble reading "Ansehen" follows with lerp 0.09. It scales in with `back.out(1.8)` over 0.6 s and out with power3.in over 0.38 s.
- A "Alle ansehen (03)" link at the bottom.

**4.4 Was ich mache (Services)**
- This section has a **black background (`#0B0B0C`)** with white text, so the material Os can be used here as well.
- Two columns:
  - Left: "Ich gestalte:"
  - Right: the list "Websites · Landingpages · Online-Shops · Branding · Betreuung"
  - Below: "Perspektive ist, wo Strategie auf Gestaltung trifft."
- Scattered around: the 4 material Os from `/public/intro/` (cloud, moss, pixel, puffy) plus one small live chrome O, in different sizes (8–22vw), with base rotations of -20° to 20° and a slow idle float. Nothing else: the brand's only objects are its own Os.
- **Cursor repulsion:** within an influence radius of 460px (260px on mobile), objects are pushed away from the pointer.
  - Strength falloff: `pow((R - d) / R, 1.6)`.
  - Maximum offset 380px (110px on mobile), extra rotation up to 30° (12° on mobile), scale up to +0.2.
  - Motion: 0.45 s power4.out. Outside the radius they spring back with `elastic.out(1, 0.35)` over 1.2 s.

**4.5 Studio / Über mich**
- Big portrait placeholder (`/public/studio/lazar.jpg`, optional), with a subtle parallax. Short text:
  > "Ich bin Lazar, 17, aus Maria Ellend. Ich baue Websites mit Gefühl für Details, weil der erste Eindruck heute online passiert."
- A marquee band with repeating "guskic studiO — Websites, die man anfassen möchte —", whose speed reacts to scroll velocity. Slightly glitched duplicate lines at low opacity, as a texture.

**4.6 Kontakt (CTA)**
- Huge line: "Lass uns anfangen."
- Buttons:
  - "Projekt anfragen" → `mailto:` (placeholder address)
  - "Instagram" → placeholder link
- **Scroll-past interaction:** when the user keeps scrolling at the very bottom, a thin timeline bar fills. Wheel delta accumulates, divided by 2600, and eases with a lerp of 0.12. When it is full, the contact form overlay opens. Touch works the same way with a 2.5× multiplier.

**4.7 Footer**
- The wordmark **guskic studiO** again as a giant SVG or text spanning the full width.
- On enter, its letters rise from `yPercent: 120` in random order (1.2 s power4.inOut, stagger 0.03), and the final O pops in with `back.out(0.9)`.
- **Hover a letter:** it squashes to scale 0.05 (0.6 s power2.inOut), then bounces back with `elastic.out(1, 0.8)` over 1.8 s.
- Small links: Impressum · Datenschutz · Instagram · © 2026 guskic studiO.

## 5. Global interactions and polish
- Lenis smooth scroll (lerp about 0.1) and ScrollTrigger sync. Disable Lenis while the menu is open.
- Text splitting utility for lines, words and letters with masks. Re-split on resize, debounced.
- Page transitions between Home, Impressum and Datenschutz: a black curtain wipe (0.8 s studio ease) with a mini version of the counter.
- An optional sound toggle (Geist Mono "Sound on/off" pill with a sliding tick). Soft UI clicks and ambient sound fade in and out over 0.35 s. Sound is off by default.
- Hover states on every link: an underline that draws from left to right. Buttons get a light magnetic pull (up to 8px).
- Visible focus states, keyboard navigation, alt texts, `aria-hidden` on decorative canvases, and a skip link.
- `prefers-reduced-motion`: no fluid effect, no falling letters, no carousel. Show simple fades instead.

## 6. Performance and quality checklist
- Lighthouse Performance ≥ 90 on mobile. LCP under 2.5 s. CLS 0.
- DPR capped at 2. Pause every WebGL loop and every video when it is off-screen or the tab is hidden (IntersectionObserver + visibilitychange).
- Lazy-load images and videos. Use AVIF/WebP with fallbacks. Preload only the loader objects and the fonts.
- WebGL fallback: if WebGL is unavailable, the O is shown as the Newsreader letter and the fluid reveal is hidden.
- Test at 375px, 768px, 1440px and 1920px widths. There must be no horizontal scroll at any width.
- Meta tags, Open Graph image (a still of the hero), favicon made from the chrome O, `lang="de"`.
- The **Impressum** page must follow the Austrian E-Commerce-Gesetz and Mediengesetz, with placeholders for name, address and contact. The **Datenschutz** page is a placeholder (no cookies, no tracking, self-hosted fonts).

## 7. Deliverables
1. The working site in this repo, with `npm run dev` and `npm run build`.
2. A GitHub Pages deploy workflow.
3. `README.md` updated with: how to run it, where to put the images (`/public/intro`, `/public/works`, `/public/hero`, `/public/studio`), and how to change the texts in `src/content.js`.
4. Before you finish: open the site in a browser, record or screenshot the loader sequence, the hero and every section at mobile and desktop width, check everything against this brief, fix every issue, and only then report back.
