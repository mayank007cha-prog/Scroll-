# Mayank Chauhan Portfolio

A static portfolio site with no build step. Open `index.html` in a browser, or serve the folder:

```bash
cd portfolio && python3 -m http.server 8000
```

## What's inside

| Part | Where |
| --- | --- |
| Intro (bouncing ball → phone → loading count → tagline) | `index.html` `#intro`, timings in `assets/js/main.js` |
| Home: hero, 2 case studies, 5 concept phones, about, contact | `index.html` `data-view="home"` |
| Case studies (Who / What / Why / How) | `index.html` `data-view="demedic"` and `data-view="earthlink"`, opened at `#demedic` / `#earthlink` |
| Spider + Who/What/Why/How cube (three.js) | `assets/js/cube.js` |
| Styles, light + dark tokens | `assets/css/style.css` (top of file) |
| three.js r128 (bundled, so no CDN needed) | `assets/vendor/three.min.js` |

## Adding your media

The full list of images, videos, logos and sizes is in [ASSETS.md](ASSETS.md).

**Concept videos.** Put screen recordings in `assets/media/` and set `data-video` on the matching
`<figure class="phone-card">`, e.g. `data-video="assets/media/spotify-mini-player.mp4"`.
Use 9:19.5 portrait MP4s (H.264, muted). The CSS preview shows until the video loads.

**Case study images and videos.** Every dashed box (`.media-box`) shows the suggested file path.
Drop the file there and add it inside the box:

```html
<div class="media-box" style="--ar:4/5">
  <img src="assets/media/demedic/duty-tab.png" alt="Duty tab with offered and bid states">
</div>
```

For video use `<video src="..." autoplay muted loop playsinline></video>` instead.

## Still to fill in

- Resume, LinkedIn, Behance and GitHub links (search `TODO` in `index.html`).
- Outcome numbers for DE Medic, if you have them.
- The placeholder images and videos above.

## Tweaks

- **Cube hover behaviour.** Hover pauses the loop. Change `syncPaused()` in `cube.js` to flip it.
- **Intro length.** Change the `at(ms, …)` timings in `startIntro()` in `main.js`.
- **Default theme.** Light. The toggle remembers the visitor's choice.

## Hosting on GitHub Pages

Settings → Pages → deploy from a branch → pick the branch and the `/` folder.
The site is then at `https://<user>.github.io/<repo>/portfolio/`.
