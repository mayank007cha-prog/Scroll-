# Fiber Checkout — Android app

A small Android app that runs the checkout prototype from `../fiber-checkout/` full screen
in a WebView, so you can try the mobile flow on a real phone.

## Run it on your phone

1. Install [Android Studio](https://developer.android.com/studio).
2. **File → Open…** and pick this `fiber-checkout-android` folder. Let Gradle sync finish.
3. On your phone, turn on **Developer options → USB debugging**, then plug it in.
4. Choose your phone in the device menu and press **Run ▶**. The app installs and opens.

## Make an APK file to share or sideload

**Build → Build App Bundle(s) / APK(s) → Build APK(s)**, then click **locate**.
The file is `app/build/outputs/apk/debug/app-debug.apk`. Copy it to the phone and open it
(allow "Install unknown apps" for your file manager when asked).

## Updating the checkout

The web files live in `app/src/main/assets/`. After changing `../fiber-checkout/index.html`, copy it
(and its `assets/` folder) into `app/src/main/assets/` and run again.
