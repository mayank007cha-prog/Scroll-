# Keyboard hero — scroll-driven first fold

Open `index.html` through any static server (e.g. `npx serve keyboard-hero`),
no build step needed.

- `main.js` – scroll progress → scene blend, keyboard card, fog and pager.
  Per-scene colours live in `SCENES` at the top.
- `style.css` – layout (based on the Figma frames) and the edge-fade mask.
- `assets/` – backgrounds (`bg-*.jpg`) and transparent keyboard cut-outs (`kb-*.png`).
- `vendor/` – [Lenis](https://github.com/darkroomengineering/lenis) 1.3 for smooth wheel scrolling (MIT).

To add a scene: add an `<img class="Hero-scene">`, an `<img class="Product-kb">`,
a `.Product-item`, a counter `<span>` and a pager button, then add an entry to `SCENES`.
