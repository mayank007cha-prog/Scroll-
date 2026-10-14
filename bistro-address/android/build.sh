#!/usr/bin/env bash
# Builds the Bistro Concept APK without the Android SDK.
# Tools go in ./tools (not committed), all from Maven Central / npm:
#   org/apktool/apktool-lib/3.0.3 (unzip prebuilt/linux/aapt2 and prebuilt/android-framework.jar),
#   com/google/android/android/4.1.1.4, com/google/android/tools/dx/1.7,
#   com/android/tools/build/apksig/2.3.0, and npm @fontsource/figtree@5.1.1 unpacked into tools/font.
# Icons and web assets are generated into ./build-proj; the signing key is created on first run.
set -euo pipefail
B=$(cd "$(dirname "$0")" && pwd); T=$B/tools; O=$B/out
REPO=$(cd "$B/.." && pwd)
P=$B/build-proj
rm -rf "$P" && mkdir -p "$P/assets/assets" "$P/assets/fonts" && cp -r "$B/AndroidManifest.xml" "$B/src" "$B/res" "$P/"
rm -rf "$O" && mkdir -p "$O"/{compiled,classes} "$P"/res/drawable-xxxhdpi
for d in mdpi:48 hdpi:72 xhdpi:96 xxhdpi:144 xxxhdpi:192; do mkdir -p "$P/res/mipmap-${d%%:*}"; done

# --- icons + web assets ---
python3 -I "$B/prep.py" "$REPO" "$P" "$T/font/package/files"

# --- resources ---
"$T/prebuilt/linux/aapt2" compile --dir "$P/res" -o "$O/compiled/res.zip"
"$T/prebuilt/linux/aapt2" link -o "$O/base.apk" -I "$T/prebuilt/android-framework.jar" \
  --manifest "$P/AndroidManifest.xml" -A "$P/assets" "$O/compiled/res.zip" \
  --min-sdk-version 24 --target-sdk-version 34 --version-code 1 --version-name 1.0 \
  -0 woff2 -0 png

# --- code ---
javac -nowarn --release 8 -cp "$T/android-4.1.1.4.jar" -d "$O/classes" $(find "$P/src" -name '*.java') 2>&1 | grep -v 'bootstrap\|^1 warning\|^warning' || true
# dx 1.7 predates class file 52; this code uses no Java 8 features, so mark it 50 (Java 6).
find "$O/classes" -name '*.class' -exec python3 -I -c 'import sys
for f in sys.argv[1:]:
    b=bytearray(open(f,"rb").read()); assert b[7]==52; b[7]=50; open(f,"wb").write(b)' {} +
java -cp "$T/dx-1.7.jar" com.android.dx.command.Main --dex --output="$O/classes.dex" "$O/classes"

# --- package + sign ---
cp "$O/base.apk" "$O/unsigned.apk"
(cd "$O" && zip -q -0 unsigned.apk classes.dex)
python3 -I "$B/zipalign.py" "$O/unsigned.apk" "$O/aligned.apk"
[ -f "$B/release.p12" ] || keytool -genkeypair -keystore "$B/release.p12" -storetype PKCS12 -storepass bistro123 \
  -alias app -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Bistro Concept" >/dev/null 2>&1
java --add-exports java.base/sun.security.x509=ALL-UNNAMED --add-exports java.base/sun.security.pkcs=ALL-UNNAMED --add-exports java.base/sun.security.util=ALL-UNNAMED -cp "$T/apksig-2.3.0.jar" "$B/Sign.java" "$B/release.p12" bistro123 "$O/aligned.apk" "$O/bistro-concept.apk"
