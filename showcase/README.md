# Keyboard showcase — "Your board. Your vibe."

A scroll-driven hero. As you scroll, the next keyboard (waiting, dimmed, on the left of
the desk) is lifted over the hands and set down on the mat, while the whole setup relights
to match it (ember → frost → prism). Product names and prices come from meckeys.com.

Open `index.html` directly, or serve the folder with any static server:

```sh
python3 -m http.server --directory showcase 8080
```

## How it works

- `.kb-scene` is laid out in the photos' own pixel space (2048×1144) and scaled to cover
  the viewport (portrait screens frame the keyboard band instead), so the boards, glow and
  hand mask stay aligned at every size.
- Layers, bottom to top: environment photos, key-light, the board at rest, a copy of the
  photo stack masked to the hands (`assets/hands-mask.png`, so fingertips stay on top of
  the resting board's edge), drifting mist, then boards in motion. A travelling board is
  lifted toward the camera and passes over the hands; its shadow stays on the mat and
  spreads with the height, and the mist thickens around the hands while it moves.
- Smooth scrolling uses [Lenis](https://github.com/darkroomengineering/lenis) (vendored in
  `vendor/`, MIT). When scrolling settles, the page glides on to the board you were
  heading for, so every board lands exactly in place. `prefers-reduced-motion` turns
  smoothing, snapping and easing off.

## Assets

`assets/src` holds the Figma exports. `tools/build_assets.py` converts them to WebP,
aligns the frost photo to the other two (it was shot slightly higher, which caused a
double image during the cross-fade), and draws the feathered hand mask from traced
outlines, and generates the tileable mist texture. Re-run it after you replace any image:

```sh
pip install pillow numpy
python3 showcase/tools/build_assets.py
```
