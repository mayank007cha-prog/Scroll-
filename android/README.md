# Tonal Sort for Android

A native Android shell for the Tonal Sort prototype in [`../tonal-sort`](../tonal-sort).
The game runs full screen in a WebView, edge to edge behind transparent system
bars, straight from the bundled assets (no network needed except for the
Google Sans Flex typeface, which falls back to the system font offline).

What the app adds on top of the web page:

- Android's real status bar and gesture bar replace the drawn ones.
- Haptics use the system's own feedback constants (drag start, gesture end,
  reject, confirm) through a small `TonalNative` bridge.
- Back closes the menu, puts a lifted icon back, leaves the game, then exits.
- Adaptive launcher icon with an Android 13+ themed (monochrome) layer.

## Build

Open this `android/` folder in Android Studio and run, or from the command line:

```sh
gradle :app:assembleRelease     # or ./gradlew if you add a wrapper
```

The APK lands in `app/build/outputs/apk/release/`. The release build is signed
with the debug key so it installs directly; add your own `signingConfig`
before publishing it anywhere.

- Package: `com.tonalsort.app`
- minSdk 26 (Android 8.0), targetSdk 35 (Android 15)
- No AndroidX or other dependencies
