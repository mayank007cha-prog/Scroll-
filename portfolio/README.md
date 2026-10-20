# Portfolio: scroll interaction prototype

Next.js + TypeScript + GSAP ScrollTrigger + Lenis + CSS 3D transforms (no Three.js).
The styling is intentionally minimal (grey background, white cards, black text) so the interaction can be tested on its own.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

## How it works

A single pinned scene (`ScrollStage`) drives one scrubbed GSAP timeline, so scrolling up simply plays it in reverse:

1. **Video**: autoplays once (muted, no loop). Once you scroll, the scroll position takes over and scrubs `currentTime` from 0 to 100%. Meanwhile the intro text changes: part one (headline and focus areas) melts away with a liquid ripple (an SVG turbulence/displacement filter), then a short "About me" paragraph rises in. Copy lives in `intro` in `projects.ts`.
2. **Hero moves back**: `translateZ(0 → heroDepth)` and `scale(1 → heroScale)`, so it becomes the first card in the row.
3. **Floating row**: the video shrinks to card size while case study 01 slides in beside it, then the whole row (video first, then the case studies from `ProjectStack`) glides right → left with scroll. The row itself stays flat and level, so every card in view lines up at the same height and size. At the left and right edges of the frame, `SceneWarp` curls whatever passes through towards the viewer, like paper as a card enters and leaves: an SVG displacement filter whose map (drawn by ScrollStage) is flat in the middle and stretches (taller, slightly squeezed) content in each edge zone (`edgeBend`, `edgeZone`). The bend fades in as the video becomes a card. It's desktop-only; phones keep a gentle inward curve (`curveRotate`/`curveDepth`, `curveInward`). A soft spring tied to the scroll speed drives the paper feel (`paperLean`, off by default so cards stay level), and a shading layer darkens each card's edge as it curls and adds a faint sheen (`paperShade`). Once the row is moving, the video card gives way to keep its gap to the first case study, so the two never overlap.
4. **Footer**: the last item on the row, ending centred and flat.

The video has a theme-coloured gradient over the window side with the intro text (from `intro` in `projects.ts`) and moving film grain. It starts full-bleed with square corners; as it becomes a card, a matte vignette and its hairline border fade in and its corners round to the cards' 6px radius (counter-scaled to match them). Behind everything, `DepthField` floats quiet, monochrome CSS-3D product-design objects (wireframe cubes, an exploded layer stack, a pen-tool curve, a cursor, a selection frame, a type specimen, dashed orbit rings, registration marks, a spacing measurement) over a dark grid room: a wall of dashed layout guides with a perspective floor, built on one grid so the lines meet. The objects sit in the thin bands above and below the cards and are sized from the frame height so they fit those bands on any screen; they appear once the video is card-sized, drift with the row (deeper ones move slower) and are hidden on phones. The wall and floor shift within one grid cell and wrap, so they look endless without huge planes being redrawn.

Motion: Lenis smooth scrolling while the video plays. In the card row it goes **card by card**: one wheel or trackpad gesture glides to the next (or previous) card with a gentle ease-in-out (`snap`, `snapDuration`); further input during the glide, and a trackpad's inertia tail, is ignored, while a wheel that keeps spinning carries on card by card. Touch swipes, keys and scrollbar drags settle the same way: a small nudge carries on to the next card in that direction (`settle`). The background objects and grid are softly blurred (deeper objects more), like a shallow depth of field.

Clicking a card opens `/work/[slug]`, a plain, fast case study page with a sticky **Contents** list on the left (it highlights the section in view and glides to a section on click; a scrollable row on small screens).

Colour is minimal and has one job each: `--accent` (violet) marks things you can act on or "you are here" — links, the main button, the current Contents item, the quote rule, keyboard focus. `--dusk` (a deeper violet) appears only as faint light in the background only. The video card is matte black: a black vignette rolls in from its edges as it zooms out, under a two-layer film grain. Everything else is neutral.

`SceneFrame` is the rounded `overflow: hidden` window with the CSS `perspective`.

| File | Purpose |
| --- | --- |
| `src/lib/sceneConfig.ts` | **All** animation values (perspective, depths, curve, scrub, distances) plus the mobile overrides |
| `src/data/projects.ts` | Case-study content (title, one-liner, description), owner, intro copy, footer/contact links |
| `src/components/ScrollStage.tsx` | Pin, timeline, Lenis, video scrubbing, curve |
| `src/components/{HeroVideo,SceneFrame,ProjectStack,ProjectCard,Footer}.tsx` | Presentational pieces |
| `src/components/DepthField.tsx` | Background objects and their placement (x, y, z, size, spin) |
| `src/app/work/[slug]/page.tsx` + `case-study.css` | Case study page (dummy content) |
| `src/components/CaseToc.tsx` | Contents sidebar with scroll highlight |

## Video

`public/video/hero.mp4` is the source video cropped to the top **1920×856**, which stops just above the watermark in the bottom-right (rows 865–978). It is encoded with every frame as a keyframe so scroll scrubbing stays smooth in both directions. `hero.webm` (VP9) is a fallback for browsers without H.264, and `hero-poster.jpg` is the first frame.

```bash
ffmpeg -i hero-video.mp4 -vf "crop=1920:856:0:0" -an -c:v libx264 -crf 24 -g 1 \
  -pix_fmt yuv420p -movflags +faststart hero.mp4
```

## Mobile and accessibility

- On screens up to 767px wide (`mobileOverrides`), the row travels **vertically**: cards stack in a column and glide bottom → top with the same easing, rests and settle, and the curve bends top and bottom instead of left and right. Depth and curve values are softer and the cards are wider.
- With `prefers-reduced-motion: reduce` there is no pinning, no 3D and no Lenis. Everything becomes a plain vertical stack, and the video gets native controls.
- Only `transform` and `opacity` are animated.

## Glass

Case-study cards are sized so they appear exactly as large as the shrunken video card (ScrollStage derives `--card-w`/`--card-h` from `heroScale`, `heroDepth` and `trackDepth`). On desktop, all depths and the perspective scale with the frame width (tuned at 1440px), so the curve and background keep the same proportions on every screen size. Each case study is one card: a label row, then the title and one-liner beside a media slot. To show a video or GIF of the work there, put the file in `public/work/` and set `media` on the project in `projects.ts` (`{ type: "video", src, poster }` or `{ type: "image", src }`); until then the slot shows a quiet placeholder.

Cards share one `.glass` style in `globals.css`: a dense frosted base with a light gradient, a hairline border, a top sheen and a faint grain. There's no backdrop blur (browsers don't apply it inside the 3D scene, and it costs frames). The case study pages deliberately skip glass.
