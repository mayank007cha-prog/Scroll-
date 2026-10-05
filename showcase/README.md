# Keyboard showcase — "Your board. Your vibe."

A scroll-driven hero. As you scroll, a new keyboard slides in from the left and settles
**under the hands** on the desk while the whole setup relights to match it
(ember → frost → prism). Product names and prices come from meckeys.com.

Open `index.html` directly, or serve the folder with any static server:

```sh
python3 -m http.server --directory showcase 8080
```

## How it works

- `.kb-scene` is laid out in the photos' own pixel space (2048×1144) and scaled to cover
  the viewport (portrait screens frame the keyboard band instead), so the boards, glow and
  hand mask stay aligned at every size.
- Layers, bottom to top: environment photos, key-light, keyboards, then a **second copy of
  the photo stack masked to the hands and forearms** (`assets/hands-mask.png`). That top
  layer is what makes the keyboards pass under the hands.
- Scroll sets a target position with short holds at each board; the rendered position
  eases towards it every frame (`1 - e^(-dt·5.5)`), which gives the gentle, inertial
  feel without hijacking native scroll. `prefers-reduced-motion` turns the easing off.

## Assets

`assets/src` holds the Figma exports. `tools/build_assets.py` converts them to WebP,
aligns the frost photo to the other two (it was shot slightly higher, which caused a
double image during the cross-fade), and draws the feathered hand mask from traced
outlines. Re-run it after you replace any image:

```sh
pip install pillow numpy
python3 showcase/tools/build_assets.py
```
