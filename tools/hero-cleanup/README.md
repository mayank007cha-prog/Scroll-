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

5. `phone_out.py`: lets the phone's frame dissolve away from its sides (f576–693), leaving the dots, the
   ball and the percentage on a clean background, and lifts the dark matte the footage has around the phone.

`split_fix.py` also rebuilds one corrupted frame (f667) from its neighbours.

`render.py` writes the cleaned film at 720p. The page's files are made from the frames in `out/`:

```bash
ffmpeg -framerate 48 -start_number 0 -i out/%04d.png -vf "hqdn3d=1.0:1.0:2.5:2.5,scale=1920:1080:flags=lanczos+accurate_rnd,cas=0.5,deband=1thr=0.012:2thr=0.012:3thr=0.012:range=20:blur=1,noise=alls=1.5:allf=t" -an -c:v libx264 -preset slow -crf 21 -pix_fmt yuv420p -movflags +faststart ../../hero/hero-loop.mp4
```

```bash
ffmpeg -framerate 48 -start_number 0 -i out/%04d.png -an -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p -movflags +faststart ../../hero/hero-loop-720.mp4
```

Needs Python with `numpy`, `scipy` and `opencv-python-headless`, plus `ffmpeg`.
