# Keyboard showcase — "Your board. Your vibe."

A scroll-driven hero. As you scroll, the next keyboard (waiting, dimmed, on the left of
the desk) is lifted over the hands and set down on the mat, the one you just passed moves
over to the right of the desk, and the whole setup relights to match (ember → frost →
prism). Arrow keys (and Page Up / Down) step between boards. Product names and prices come
from meckeys.com.

Open `index.html` directly, or serve the folder with any static server:

```sh
python3 -m http.server --directory showcase 8080
```

## Single-file version

`keyboard-showcase.html` is the whole page in one file (CSS, JS and every image
inlined), for opening straight from disk or dropping onto any host. Rebuild it after changes:

```sh
python3 showcase/tools/build_standalone.py
```

## How it works

- The stage is `position: fixed` and its height is locked (on touch devices it only re-measures
  when the width changes), so the frame never moves: scrolling only swaps the keyboard, the room
  lighting and the copy.
- Scrolling is native. When a scroll comes to rest between boards it glides (1.1-2 s, sine
  ease-in-out) on to the next board in the direction you scrolled (one step is 70% of the screen height); arrow / Page keys step
  one board at a time.
- Backgrounds are the Figma "Keyboard Interaction" frames 1-3 exactly as exported (2048 px; the
  monitor screen with its gradient and headline is designed into them). The frost frame is
  lined up with the other two in CSS so the room never shifts; the screen edges are softly
  blurred through a feathered mask (`assets/screen-edge.png`), plus a light blur at the top.
- `.kb-scene` is laid out in the photos' own pixel space (2048×1144) and scaled to cover
  the viewport (portrait screens frame the keyboard band instead), so the boards, glow and
  hand mask stay aligned at every size.
- Layers, bottom to top: environment photos, key-light, the board at rest, a copy of the
  photo stack masked to the hands (`assets/hands-mask.png`, so fingertips stay on top of
  the resting board's edge), a light top blur, drifting mist, then boards in motion. A travelling board is
  lifted toward the camera and passes over the hands; its shadow stays on the mat and
  spreads with the height, and the mist thickens around the hands while it moves.
- With a mouse, the centre board leans toward the cursor on a soft spring.

## Assets

`assets/src` holds the Figma exports. `tools/upscale.py` makes 2x versions with Real-ESRGAN
(the large 2x PNGs are git-ignored; rerun it to regenerate them). With those present,
`build_assets.py` smooths the noisy felt on the dark hex wall (edge-preserving, so the lit
strips stay crisp), writes `bg-<env>@2x.webp` for high-DPI screens via `srcset`, and
downscales the 1x files from the cleaned images. `tools/build_assets.py` converts them to WebP,
aligns the frost photo to the other two (it was shot slightly higher, which caused a
double image during the cross-fade), and draws the feathered hand mask from traced
outlines, and generates the tileable mist texture. Re-run it after you replace any image:

```sh
pip install pillow numpy opencv-python-headless
python3 showcase/tools/build_assets.py
```
