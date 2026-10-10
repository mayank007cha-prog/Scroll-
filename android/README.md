# Floating Player – Android app

A full-screen, offline Android app (WebView) around the prototype in `../spotify-player`.
It hides the status and navigation bars, keeps the screen on, plays media without a tap,
and the Back button closes the song page, then the album, then the app.

Build:

```sh
./build.sh          # → build/FloatingPlayer.apk (Android 7.0+, signed with APK Signature Scheme v2)
```

Needs Java 17+, Python 3 and Maven Central access; it downloads apktool 3.0.3 (aapt2 + smali)
and apksig into `tools/`. The real song files are bundled only if they exist in
`../spotify-player/assets/media/` (they are git-ignored); otherwise the stand-ins are used.
A signing key is created as `release.p12` on first build. Keep it to sign future updates
(an update must be signed with the same key), and never commit it.
