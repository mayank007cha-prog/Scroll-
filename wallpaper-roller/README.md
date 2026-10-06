# Wallpaper roller — chat wallpaper change prototype

Mobile prototype of the "paint roller" wallpaper change, built from the Figma
file *Interactions-motion → Chat Background Change animation*.

Open `index.html` through any static server (e.g. `python3 -m http.server`) and
**tap the screen** to play. Tap again when it finishes to replay.

- `?speed=0.25` in the URL plays it in slow motion.
- All timing/physics lives in `CONFIG` at the top of `app.js`.

How it works: one `requestAnimationFrame` loop moves the roller; the paint edge
(new wallpaper reveal) is derived from the roller position, and each chat bubble
reacts to that edge — it gets nudged, then knocked off sideways with a little
lift, spin and gravity. After a 2s hold on the clean wallpaper the chat column
rises back from the bottom on a damped spring.

Assets in `assets/` were exported from Figma: the roller image, the original
chat wallpaper and the new wallpaper.
