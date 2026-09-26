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
2. **Hero moves back**: `translateZ(0 → heroDepth)` and `scale(1 → heroScale)`.
3. **Cards**: each card enters from the right (`x: entryDistance vw`, `z: projectDepth`, `opacity 0`), finishing at `x 0 / z 0 / scale 1 / opacity 1`. At the same time the card in front recedes to `projectDepth / cardScale / recededOpacity`, and the card before that fades out further back.
4. **Footer**: rises in the same way after project 05.

`SceneFrame` is the rounded `overflow: hidden` window with the CSS `perspective`, so cards look as if they slide in from behind the edge of the frame.

| File | Purpose |
| --- | --- |
| `src/lib/sceneConfig.ts` | **All** animation values (perspective, depths, scales, scrub, distances) plus the mobile overrides |
| `src/data/projects.ts` | Case-study content and footer/contact links |
| `src/components/ScrollStage.tsx` | Pin, timeline, Lenis, video scrubbing |
| `src/components/{HeroVideo,SceneFrame,ProjectStack,ProjectCard,Footer}.tsx` | Presentational pieces |

## Video

`public/video/hero.mp4` is the source video cropped to the top **1920×720** (which removes the watermark in the bottom-right). It is encoded with every frame as a keyframe so scroll scrubbing stays smooth in both directions. `hero.webm` (VP9) is a fallback for browsers without H.264, and `hero-poster.jpg` is the first frame.

```bash
ffmpeg -i hero-video.mp4 -vf "crop=1920:720:0:0" -an -c:v libx264 -crf 24 -g 1 \
  -pix_fmt yuv420p -movflags +faststart hero.mp4
```

## Mobile and accessibility

- On screens up to 767px wide, the smaller X/Z/scale values from `mobileOverrides` are used and cards stack their text above the visual.
- With `prefers-reduced-motion: reduce` there is no pinning, no 3D and no Lenis. Everything becomes a plain vertical stack, and the video gets native controls.
- Only `transform` and `opacity` are animated.
- Project images (`image` in `projects.ts`) render through `next/image`, which lazy loads them.
