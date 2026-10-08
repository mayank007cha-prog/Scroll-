# Google → Incognito transition (mobile)

A mobile prototype of the "go Incognito" moment, built from the
[Interactions-motion Figma file](https://www.figma.com/design/drf0JtS2gg4BL55VLqCkHP/Interactions-motion?node-id=46-6312)
(frames 1 → 5). It needs no build step: open `incognito-android.html` (a single
self-contained file), or serve this folder. On a phone it fills the screen;
anywhere else it renders inside an Android phone frame (412 × 915 dp).

The screens follow Chrome for Android (141+), dark theme: Chrome's toolbar sits
at the top (home, tab switcher, ⋮ menu). The new tab page has the search box
with the **AI Mode** and **Incognito** shortcuts under it, a row of Most visited
tiles and the Discover feed. In Incognito the location bar ("Search or type
URL") appears in the toolbar as the page is revealed, and the page ends with
the "Block third-party cookies" switch card.

```sh
cd incognito && python3 -m http.server 8000
# open http://localhost:8000            — tap Incognito under the search box (tab switcher goes back)
# open http://localhost:8000/?speed=0.25 — slow motion for motion review
# open http://localhost:8000/?autoplay   — plays once on load
```

Recordings: `preview/incognito-transition.mp4` (real time) and
`preview/incognito-transition-slowmo.mp4` (0.3×).

## Choreography

All times are in ms and run on one `requestAnimationFrame` clock (`main.js`).

| Time        | Beat (Figma frame)                                                                  | Curve                          |
|-------------|-------------------------------------------------------------------------------------|--------------------------------|
| 0 – 300     | Logo letters blur out from the "o"s outward; search, chips and tiles drop away       | `0.4, 0, 0.6, 1`               |
| 40 – 560    | The two "o"s slide together, lift, shrink and thin into the glasses (1 → 2)          | `0.5, 0, 0.1, 1` (x), arc (y)  |
| 420 – 620   | The bridge snaps in between the lenses                                                | `0.16, 1, 0.3, 1`              |
| 500 – 840   | The hat line draws outward from the centre (3)                                        | emphasized `0.2, 0, 0, 1`      |
| 640 – 1060  | The hat rises out of the line with a soft settle (4)                                  | `0.3, 1.35, 0.5, 1`            |
| 860 – 1340  | The grey disc blooms from the glyph's centre, inverting the glyph as it passes (5)    | emphasized                     |
| 1060 – 1700 | The Incognito page opens out from behind the disc (circular reveal)                   | `0.4, 0, 0.1, 1`               |
| 1140 +      | Page copy rises in, 50 ms stagger                                                     | `0.16, 1, 0.3, 1`              |

The "o" rings start exactly on top of the font's glyphs: their centre, radius and
stroke are measured from the rendered font, so the swap from text to vector cannot
be seen. The badge geometry uses the Figma frame's own coordinates.
`prefers-reduced-motion` falls back to a short crossfade.

### Smoothness

- Frames are timed off the vsync timestamp, with a one-frame pre-roll, so
  the first paint of the new state never costs animation time.
- All layout reads (font metrics, badge position, reveal distances) are done
  ahead of time on load, font load and resize — never on the tap.
- The page reveal is a flat disc scaled on the compositor instead of a
  per-frame `clip-path`, and every moving element gets its own layer during
  the transition. No per-frame blur filters, and a solid (not backdrop-blurred)
  toolbar.
