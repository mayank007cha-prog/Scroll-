# Hero video clean-up

Scripts that turn the supplied 720p render into `hero/hero-loop.mp4`. They expect the source frames
as PNGs in `src/0000.png … src/0799.png` next to the scripts and write the result frames to `out/`.

```bash
ffmpeg -i source.mp4 -frames:v 800 -start_number 0 src/%04d.png
```

```bash
python3 render.py ../../hero/hero-loop.mp4
```

What each step does, in the order `render.py` applies it to every frame:

1. `split_fix.py`: smooths the landing of the ball (f131–134), the switch between the two dot renders
   (f148–161) and a two-frame stutter (f238–250).
2. `cards.py`: hides the two glass cards beside the phone through the dissolve (f588–617) and redraws
   the laptop edge behind them.
3. `bar_fill.py`: paints out the loading bar on every frame it appears in (f472–690), using the
   track in `bar_ref.json` (made by `track_bar.py` and `refine_bar.py`).
4. `phone_fix.py`: rebuilds the phone through the dissolve (f594–627) so it has one outline and no
   matte around it, using the corner track in `phone_raw.json` (made by `track_phone.py`).

Needs Python with `numpy`, `scipy` and `opencv-python-headless`, plus `ffmpeg`.
