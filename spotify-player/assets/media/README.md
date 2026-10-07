# Song media

Two songs play real media in the prototype. Drop the real files here with these names
and they're picked up automatically (they take priority over the stand-ins):

| Song | Real file (add yourself) | Bundled stand-in |
| --- | --- | --- |
| Koi Fariyaad (audio) | `koi-fariyaad.mp3` or `koi-fariyaad.mp4` | `standin-ghazal.mp3` |
| Matargashti, Tamasha (video) | `tamasha.mp4` (H.264/AAC) | `standin-video.mp4` / `standin-video.webm` |

The stand-ins are synthesised (generated melody and an animated gradient), so they carry
no copyright. They exist only so playback, pause/play and the transitions can be tested.
Browsers start sound only after the first tap on the page.

The real files are listed in the repo's `.gitignore`, because this repository is public and
those recordings are copyrighted. Keep them local or in the private preview only.
