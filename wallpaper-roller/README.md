# Wallpaper roller — chat wallpaper change prototype

Mobile prototype of the "paint roller" wallpaper change, built from the Figma
file *Interactions-motion → Chat Background Change animation*.

Open `index.html` through any static server (e.g. `python3 -m http.server`) and
**tap the screen** to play. A tap plays the change once, and taps while it is
playing are ignored. Once the wallpaper has changed, the next tap replays the
whole sequence from the start (old wallpaper).

- `?speed=0.25` in the URL plays it in slow motion.
- Sound effects are short, muted gesture sounds synthesised with Web Audio.
  Nothing plays until the chats start falling: each chat gets a tiny tick as
  it falls, the paper landing on the roller gets a quiet thud, and one light,
  short tone plays as the last chat settles back. Add `?sound=0` to mute
  them.
- All timing/physics lives in `CONFIG` at the top of `app.js`.

How it works: the new wallpaper is a sheet of paper laid over the chat. It
slides in from the bottom with the roller, covering about a quarter of the
screen. Its loose upper part flops onto the roller, and then the roller rolls
up and presses it flat. Below the roller, the stuck paper is a DOM layer. The
loose flap above the roller is a small WebGL mesh that bends in perspective,
with lighting, a curled lip showing the back of the paper, and a cast shadow.
A soft spring that reacts to the roller's speed drives the flap. The flap's
top edge knocks the chat bubbles off as it reaches them. Once the roller has
gone, the clean new wallpaper is shown on its own for 0.5s, and then the chat
comes back, newest message first, each chat sliding up from the side it fell
towards (green from the bottom right, white from the bottom left). The whole sequence takes
about 2.5s.

Layers, bottom to top: old wallpaper, chat, new paper, roller.

Assets in `assets/` were exported from Figma: the roller image, the original
chat wallpaper and the new wallpaper.
