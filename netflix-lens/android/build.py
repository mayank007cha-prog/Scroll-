"""Assemble the Focus Lens APK without the Android SDK.

Writes the binary AndroidManifest.xml and a one-entry resources.arsc by hand, assembles classes.dex
from smali, packs the web prototype into assets/, aligns the zip and signs it with apksig.

usage: python3 build.py <netflix-lens dir> <work dir> <out.apk>

Needs Python 3 with Pillow, a JDK, and the jars for org.smali:smali:2.5.2 and
com.android.tools.build:apksig:2.3.0 (with dependencies) in $APKTOOLS_LIB, e.g. from
`mvn dependency:copy-dependencies`. A signing key is created in the work dir on first run; keep it to
install later builds over the old one.
"""
import io
import os
import re
import struct
import subprocess
import sys
import zipfile
import zlib

from PIL import Image, ImageDraw

SRC, WORK, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.environ["APKTOOLS_LIB"]
CP = ":".join(os.path.join(LIB, f) for f in sorted(os.listdir(LIB)))
PKG = "com.focuslens.app"
ICON_ID = 0x7F010000


# ---------------------------------------------------------------- string pools
def string_pool(strings):
    """UTF-16 ResStringPool chunk."""
    offs, data = [], b""
    for s in strings:
        offs.append(len(data))
        u = s.encode("utf-16-le")
        n = len(u) // 2
        data += (struct.pack("<H", n) if n < 0x8000 else struct.pack("<HH", 0x8000 | (n >> 16), n & 0xFFFF)) + u + b"\0\0"
    while len(data) % 4:
        data += b"\0"
    header = 28
    start = header + 4 * len(strings)
    body = b"".join(struct.pack("<I", o) for o in offs) + data
    return struct.pack("<HHIIIIII", 0x0001, header, header + len(body), len(strings), 0, 0, start, 0) + body


# ---------------------------------------------------------------- binary XML
ANDROID_NS = "http://schemas.android.com/apk/res/android"
ATTR_IDS = {
    "theme": 0x01010000, "label": 0x01010001, "icon": 0x01010002, "name": 0x01010003,
    "exported": 0x01010010, "screenOrientation": 0x0101001E, "configChanges": 0x0101001F,
    "minSdkVersion": 0x0101020C, "versionCode": 0x0101021B, "versionName": 0x0101021C,
    "targetSdkVersion": 0x01010270, "allowBackup": 0x01010280, "hardwareAccelerated": 0x010102D3,
}
T_REF, T_STR, T_DEC, T_HEX, T_BOOL = 0x01, 0x03, 0x10, 0x11, 0x12

# (tag, [(android?, attr, kind, value)], children)
MANIFEST = ("manifest", [
    (True, "versionCode", T_DEC, 1), (True, "versionName", T_STR, "1.0"), (False, "package", T_STR, PKG),
], [
    ("uses-sdk", [(True, "minSdkVersion", T_DEC, 24), (True, "targetSdkVersion", T_DEC, 34)], []),
    ("uses-permission", [(True, "name", T_STR, "android.permission.VIBRATE")], []),
    ("application", [
        (True, "label", T_STR, "Focus Lens"), (True, "icon", T_REF, ICON_ID),
        (True, "allowBackup", T_BOOL, False), (True, "hardwareAccelerated", T_BOOL, True),
    ], [
        ("activity", [
            (True, "name", T_STR, PKG + ".MainActivity"), (True, "exported", T_BOOL, True),
            (True, "screenOrientation", T_DEC, 1), (True, "configChanges", T_HEX, 0x1FA0),
        ], [
            ("intent-filter", [], [
                ("action", [(True, "name", T_STR, "android.intent.action.MAIN")], []),
                ("category", [(True, "name", T_STR, "android.intent.category.LAUNCHER")], []),
            ]),
        ]),
    ]),
])


def build_axml(root):
    # attribute names that carry resource ids come first, in the same order as the resource map
    res_attrs = []
    def walk(node):
        tag, attrs, kids = node
        for a in attrs:
            if a[0] and a[1] not in res_attrs:
                res_attrs.append(a[1])
        for k in kids:
            walk(k)
    walk(root)
    res_attrs.sort(key=lambda n: ATTR_IDS[n])
    strings = list(res_attrs)
    def idx(s):
        if s not in strings:
            strings.append(s)
        return strings.index(s)
    for s in ("android", ANDROID_NS):
        idx(s)

    body = []
    def node_chunks(node, line):
        tag, attrs, kids = node
        attrs = sorted(attrs, key=lambda a: ATTR_IDS[a[1]] if a[0] else -1)
        enc = b""
        for android, name, kind, value in attrs:
            ns = idx(ANDROID_NS) if android else 0xFFFFFFFF
            nm = idx(name)
            raw = 0xFFFFFFFF
            if kind == T_STR:
                raw = data = idx(value)
            elif kind == T_BOOL:
                data = 0xFFFFFFFF if value else 0
            else:
                data = value
            enc += struct.pack("<IIIHBBI", ns, nm, raw, 8, 0, kind, data)
        start = struct.pack("<IIIIHHHHHH", line, 0xFFFFFFFF, 0xFFFFFFFF, idx(tag), 20, 20, len(attrs), 0, 0, 0)
        chunk = start + enc
        body.append(struct.pack("<HHI", 0x0102, 16, 8 + len(chunk)) + chunk)
        for k in kids:
            line = node_chunks(k, line + 1)
        body.append(struct.pack("<HHIIIII", 0x0103, 16, 24, line, 0xFFFFFFFF, 0xFFFFFFFF, idx(tag)))
        return line + 1

    ns_start = struct.pack("<HHIIIII", 0x0100, 16, 24, 1, 0xFFFFFFFF, idx("android"), idx(ANDROID_NS))
    last = node_chunks(root, 2)
    ns_end = struct.pack("<HHIIIII", 0x0101, 16, 24, last, 0xFFFFFFFF, idx("android"), idx(ANDROID_NS))
    pool = string_pool(strings)
    resmap = struct.pack("<HHI", 0x0180, 8, 8 + 4 * len(res_attrs)) + b"".join(struct.pack("<I", ATTR_IDS[n]) for n in res_attrs)
    xml = pool + resmap + ns_start + b"".join(body) + ns_end
    return struct.pack("<HHI", 0x0003, 8, 8 + len(xml)) + xml


# ---------------------------------------------------------------- resources.arsc (one drawable)
def build_arsc(path):
    gpool = string_pool([path])
    types = string_pool(["drawable"])
    keys = string_pool(["ic_launcher"])
    spec = struct.pack("<HHIBBHI", 0x0202, 16, 16 + 4, 1, 0, 0, 1) + struct.pack("<I", 0)
    config = struct.pack("<I", 64) + b"\0" * 60
    th = 20 + len(config)
    entries = struct.pack("<HHI", 8, 0, 0) + struct.pack("<HBBI", 8, 0, T_STR, 0)
    tchunk = struct.pack("<HHIBBHII", 0x0201, th, th + 4 + len(entries), 1, 0, 0, 1, th + 4) + config + struct.pack("<I", 0) + entries
    name = PKG.encode("utf-16-le").ljust(256, b"\0")
    ph = 288
    pkg_body = types + keys + spec + tchunk
    pkg = struct.pack("<HHII", 0x0200, ph, ph + len(pkg_body), 0x7F) + name + struct.pack(
        "<IIIII", ph, 1, ph + len(types), 1, 0) + pkg_body
    table = gpool + pkg
    return struct.pack("<HHII", 0x0002, 12, 12 + len(table), 1) + table


# ---------------------------------------------------------------- icon
def build_icon(size=192):
    s = 4
    im = Image.new("RGBA", (size * s, size * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    W = size * s
    d.rounded_rectangle((0, 0, W - 1, W - 1), radius=int(W * 0.22), fill=(16, 16, 18, 255))
    # three posters, the middle one larger and lit, with a glass title bar
    pw, ph = W * 0.24, W * 0.36
    cy = W * 0.47
    for cx, scale, col in ((W * 0.25, 1.0, (70, 70, 78)), (W * 0.75, 1.0, (70, 70, 78)), (W * 0.5, 1.28, (229, 9, 20))):
        w, h = pw * scale, ph * scale
        d.rounded_rectangle((cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2), radius=int(W * 0.03), fill=col + (255,))
    w, h = pw * 1.28, ph * 1.28
    gx0, gx1 = W * 0.5 - w / 2 + W * 0.02, W * 0.5 + w / 2 - W * 0.02
    gy1 = cy + h / 2 - W * 0.02
    d.rounded_rectangle((gx0, gy1 - W * 0.11, gx1, gy1), radius=int(W * 0.025), fill=(255, 255, 255, 235))
    d.rounded_rectangle((gx0 + W * 0.04, gy1 - W * 0.075, gx1 - W * 0.04, gy1 - W * 0.055), radius=int(W * 0.01), fill=(20, 20, 22, 255))
    d.rounded_rectangle((gx0 + W * 0.07, gy1 - W * 0.04, gx1 - W * 0.07, gy1 - W * 0.025), radius=int(W * 0.01), fill=(120, 120, 126, 255))
    # three short label marks underneath
    for i, x in enumerate((W * 0.36, W * 0.5, W * 0.64)):
        d.rounded_rectangle((x - W * 0.045, W * 0.80, x + W * 0.045, W * 0.825), radius=int(W * 0.01), fill=(200, 200, 205, 255))
    im = im.resize((size, size), Image.LANCZOS)
    b = io.BytesIO()
    im.save(b, "PNG", optimize=True)
    return b.getvalue()


# ---------------------------------------------------------------- web assets
def web_assets():
    html = open(os.path.join(SRC, "index.html"), encoding="utf-8").read()
    html = re.sub(r'<link rel="preconnect"[^>]*>\s*', "", html)
    html, n = re.subn(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com/[^"]+">',
                      '<link rel="stylesheet" href="fonts/fonts.css">', html)
    assert n == 1, "font link not found"
    files = {"assets/index.html": html.encode("utf-8"),
             "assets/posters.js": open(os.path.join(SRC, "posters.js"), "rb").read(),
             "assets/trailer.mp4": open(os.path.join(SRC, "trailer.mp4"), "rb").read()}
    fdir = os.path.join(HERE, "fonts")
    for f in sorted(os.listdir(fdir)):
        files["assets/fonts/" + f] = open(os.path.join(fdir, f), "rb").read()
    return files


# ---------------------------------------------------------------- dex
def build_dex():
    os.makedirs(WORK, exist_ok=True)
    dex = os.path.join(WORK, "classes.dex")
    subprocess.run(["java", "-cp", CP, "org.jf.smali.Main", "assemble", "--api", "24", "-o", dex,
                    os.path.join(HERE, "smali")], check=True)
    return open(dex, "rb").read()


# ---------------------------------------------------------------- zip with 4-byte alignment for stored entries
def write_zip(path, entries):
    """entries: list of (name, data, store). Stored entries are aligned to 4 bytes via extra-field padding."""
    out = io.BytesIO()
    central = []
    for name, data, store in entries:
        nb = name.encode()
        crc = zlib.crc32(data) & 0xFFFFFFFF
        if store:
            comp, method = data, 0
        else:
            c = zlib.compressobj(9, zlib.DEFLATED, -15)
            comp, method = c.compress(data) + c.flush(), 8
        off = out.tell()
        extra = b""
        if store:
            pad = (-(off + 30 + len(nb))) % 4
            extra = b"\0" * pad
        out.write(struct.pack("<IHHHHHIIIHH", 0x04034B50, 20, 0, method, 0, 0x21, crc, len(comp), len(data), len(nb), len(extra)))
        out.write(nb + extra + comp)
        central.append(struct.pack("<IHHHHHHIIIHHHHHII", 0x02014B50, 20, 20, 0, method, 0, 0x21, crc, len(comp), len(data),
                                   len(nb), 0, 0, 0, 0, 0, off) + nb)
    cd_off = out.tell()
    cd = b"".join(central)
    out.write(cd)
    out.write(struct.pack("<IHHHHIIH", 0x06054B50, 0, 0, len(entries), len(entries), len(cd), cd_off, 0))
    open(path, "wb").write(out.getvalue())


def main():
    entries = [("AndroidManifest.xml", build_axml(MANIFEST), False),
               ("classes.dex", build_dex(), False),
               ("resources.arsc", build_arsc("res/drawable/ic_launcher.png"), True),
               ("res/drawable/ic_launcher.png", build_icon(), True)]
    for name, data in web_assets().items():
        entries.append((name, data, name.endswith((".woff2", ".png", ".mp4"))))
    unsigned = os.path.join(WORK, "unsigned.apk")
    write_zip(unsigned, entries)
    zipfile.ZipFile(unsigned).testzip()

    ks = os.path.join(WORK, "focuslens.p12")
    if not os.path.exists(ks):
        subprocess.run(["keytool", "-genkeypair", "-keystore", ks, "-storetype", "PKCS12", "-storepass", "focuslens",
                        "-keypass", "focuslens", "-alias", "focuslens", "-keyalg", "RSA", "-keysize", "2048",
                        "-validity", "10000", "-dname", "CN=Focus Lens prototype"], check=True, capture_output=True)
    subprocess.run(["javac", "-cp", CP, "-d", WORK, os.path.join(HERE, "Sign.java")], check=True)
    opens = [f"--add-exports=java.base/sun.security.{m}=ALL-UNNAMED" for m in ("x509", "pkcs", "util")]
    subprocess.run(["java", *opens, "-cp", CP + ":" + WORK, "Sign", unsigned, OUT, ks, "focuslens", "focuslens"], check=True)


main()
