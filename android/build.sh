#!/usr/bin/env bash
# Builds FloatingPlayer.apk: a full-screen, offline WebView app around ../spotify-player.
# Needs Java 17+, Python 3 and network access to Maven Central (for apktool and apksig).
set -euo pipefail
cd "$(dirname "$0")"
OUT=build; TOOLS=tools; WEB=../spotify-player
mkdir -p "$OUT" "$TOOLS"

fetch() { [ -s "$TOOLS/$1" ] || curl -fsSL --retry 4 -o "$TOOLS/$1" "$2"; }
fetch apktool.jar https://repo.maven.apache.org/maven2/org/apktool/apktool-cli/3.0.3/apktool-cli-3.0.3.jar
fetch apksig.jar https://repo.maven.apache.org/maven2/com/android/tools/build/apksig/2.3.0/apksig-2.3.0.jar

# 1. Stage the app: sources plus the prototype as bundled assets.
rm -rf "$OUT/app" && cp -r app "$OUT/app"
W="$OUT/app/assets/www"; mkdir -p "$W/assets/media" "$W/assets/fonts"
cp -r "$WEB/assets/posters" "$WEB/assets/icons" "$W/assets/"
for f in koi-fariyaad.mp3 tamasha.mp4 standin-ghazal.mp3 standin-video.mp4; do
  [ -f "$WEB/assets/media/$f" ] && cp "$WEB/assets/media/$f" "$W/assets/media/"
done
# Skip a stand-in when the real recording is there.
[ -f "$W/assets/media/koi-fariyaad.mp3" ] && rm -f "$W/assets/media/standin-ghazal.mp3"
[ -f "$W/assets/media/tamasha.mp4" ] && rm -f "$W/assets/media/standin-video.mp4"
cp fonts/*.woff2 "$W/assets/fonts/"
python3 - "$WEB/index.html" "$W/index.html" <<'PY'
import re, sys
s = open(sys.argv[1]).read()
# Offline: swap Google Fonts for the bundled Inter files.
s = re.sub(r'\s*<link rel="preconnect"[^>]*>', '', s)
s = re.sub(r'\s*<link href="https://fonts.googleapis.com[^>]*>', '', s)
faces = ''.join(
    f"  @font-face {{ font-family: 'Inter'; font-style: normal; font-weight: {w}; font-display: block;"
    f" src: url('assets/fonts/inter-latin-{w}-normal.woff2') format('woff2'); }}\n"
    for w in (400, 500, 600, 700, 800))
s = s.replace('<style>\n', '<style>\n' + faces, 1)
open(sys.argv[2], 'w').write(s)
PY
cat > "$OUT/app/apktool.yml" <<'YML'
version: 3.0.3
apkFileName: FloatingPlayer.apk
isFrameworkApk: false
usesFramework:
  ids:
  - 1
sdkInfo:
  minSdkVersion: 24
  targetSdkVersion: 34
packageInfo:
  forcedPackageId: 127
versionInfo:
  versionCode: 1
  versionName: 1.0
doNotCompress:
- resources.arsc
- mp3
- mp4
- png
- jpg
- woff2
YML

# 2. Build, align, sign.
java -jar "$TOOLS/apktool.jar" b "$OUT/app" -o "$OUT/unsigned.apk"
python3 align.py "$OUT/unsigned.apk" "$OUT/aligned.apk"
KS=release.p12; PASS=${KEY_PASS:-floatingplayer}
[ -f "$KS" ] || keytool -genkeypair -keystore "$KS" -storetype PKCS12 -storepass "$PASS" -keypass "$PASS" \
  -alias player -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Floating Player, O=Concept" >/dev/null
javac -cp "$TOOLS/apksig.jar" -d "$OUT" Signer.java
# apksig 2.3.0 uses JDK-internal certificate classes.
JX="--add-exports java.base/sun.security.x509=ALL-UNNAMED --add-exports java.base/sun.security.pkcs=ALL-UNNAMED --add-exports java.base/sun.security.util=ALL-UNNAMED"
java $JX -cp "$TOOLS/apksig.jar:$OUT" Signer "$OUT/aligned.apk" "$OUT/FloatingPlayer.apk" "$KS" player "$PASS"
java $JX -cp "$TOOLS/apksig.jar:$OUT" Signer verify "$OUT/FloatingPlayer.apk"
ls -lh "$OUT/FloatingPlayer.apk"
