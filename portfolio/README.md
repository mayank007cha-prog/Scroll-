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

1. **Video**: autoplays once (muted, no loop). Once you scroll, the scroll position takes over and scrubs `currentTime` from 0 to 100%.
2. **Hero moves back**: `translateZ(0 → heroDepth)` and `scale(1 → heroScale)`, so it becomes the first card in the row.
3. **Floating row**: the video shrinks to card size while case study 01 slides in beside it, then the whole row (video first, then the case studies from `ProjectStack`) glides right → left with scroll. Each item turns away (`rotateY`) and sinks back (`translateZ`) by its distance from the centre, which bends the row into a gentle curve.
4. **Footer**: the last item on the row, ending centred and flat.

Clicking a card opens `/work/[slug]`, a placeholder case study page generated from `projects.ts`.

`SceneFrame` is the rounded `overflow: hidden` window with the CSS `perspective`.

| File | Purpose |
| --- | --- |
| `src/lib/sceneConfig.ts` | **All** animation values (perspective, depths, curve, scrub, distances) plus the mobile overrides |
| `src/data/projects.ts` | Case-study content (title, one-liner, description) and footer/contact links |
| `src/components/ScrollStage.tsx` | Pin, timeline, Lenis, video scrubbing, curve |
| `src/components/{HeroVideo,SceneFrame,ProjectStack,ProjectCard,Footer}.tsx` | Presentational pieces |
| `src/app/work/[slug]/page.tsx` | Dummy case study page |

## Video

`public/video/hero.mp4` is the source video cropped to the top **1920×856**, which stops just above the watermark in the bottom-right (rows 865–978). It is encoded with every frame as a keyframe so scroll scrubbing stays smooth in both directions. `hero.webm` (VP9) is a fallback for browsers without H.264, and `hero-poster.jpg` is the first frame.

```bash
ffmpeg -i hero-video.mp4 -vf "crop=1920:856:0:0" -an -c:v libx264 -crf 24 -g 1 \
  -pix_fmt yuv420p -movflags +faststart hero.mp4
```

## Mobile and accessibility

- On screens up to 767px wide, the smaller depth and curve values from `mobileOverrides` are used and the cards get wider.
- With `prefers-reduced-motion: reduce` there is no pinning, no 3D and no Lenis. Everything becomes a plain vertical stack, and the video gets native controls.
- Only `transform` and `opacity` are animated.
