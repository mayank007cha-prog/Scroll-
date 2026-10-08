# Wallpaper roller — chat wallpaper change prototype

Mobile prototype of the "paint roller" wallpaper change, built from the Figma
file *Interactions-motion → Chat Background Change animation*.

Open `index.html` through any static server (e.g. `python3 -m http.server`).
Tap **⋮** at the top right, choose **Chat background**, and pick a wallpaper:
the roller animation pastes it over the current one. There are four built-in
backgrounds: Doodles (the original), Blue cat, Sunset and Mint. Add more in the
`WALLPAPERS` list at the top of `app.js`.

- `?speed=0.25` in the URL plays it in slow motion.
- All timing/physics lives in `CONFIG` at the top of `app.js`.

How it works: the new wallpaper is a sheet of paper laid over the chat. It
slides in from the bottom with the roller, covering about a quarter of the
screen. Its loose upper part flops onto the roller, and then the roller rolls
up and presses it flat. Below the roller, the stuck paper is a DOM layer. The
loose flap above the roller is a small WebGL mesh that bends in perspective,
with lighting, a curled lip showing the back of the paper, and a cast shadow.
A soft spring that reacts to the roller's speed drives the flap. The flap's
top edge knocks the chat bubbles off as it reaches them. Once the roller has
gone and the last falling chat has left the screen, the chat comes back,
newest message first, each chat sliding up from the side it fell towards
(green from the bottom right, white from the bottom left). The whole
sequence takes about 2.3s.

Layers, bottom to top: old wallpaper, chat, new paper, roller.

Assets in `assets/`: the roller image, the doodle chat wallpaper and the
blue cat wallpaper come from Figma; the sunset and mint wallpapers were drawn
for this prototype.
