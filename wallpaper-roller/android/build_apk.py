#!/usr/bin/env python3
"""Build an installable Android APK of the wallpaper-roller prototype.

No Android SDK needed: everything is written here with the Python standard
library, plus `openssl` for the signing key and signature, and Pillow for the
launcher icon.

The app is one Activity that shows the prototype full screen in a WebView,
loaded from assets/index.html (a single self-contained page with every image
inlined, so it works offline).

    python3 android/build_apk.py [output.apk]

Pieces it writes:
  classes.dex          the Activity, as hand-assembled Dalvik bytecode
  AndroidManifest.xml  in Android's binary XML format
  resources.arsc       resource table holding the launcher icon
  APK                  zip with STORED entries 4-byte aligned, signed with
                       APK Signature Scheme v2 (enough for minSdk 24+)
"""
import base64, hashlib, io, os, re, struct, subprocess, sys, tempfile, zlib

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.dirname(HERE)                      # wallpaper-roller/
PKG = "com.mayank.wallpaperroller"
APP_LABEL = "Wallpaper Roller"
VERSION_CODE, VERSION_NAME = 1, "1.0"
MIN_SDK, TARGET_SDK = 24, 34
KEY_DIR = os.path.join(HERE, "debug-key")        # git-ignored; created on first build

u8 = lambda v: struct.pack("<B", v)
u16 = lambda v: struct.pack("<H", v)
u32 = lambda v: struct.pack("<I", v & 0xFFFFFFFF)
u64 = lambda v: struct.pack("<Q", v)
pad4 = lambda b: b + b"\0" * (-len(b) % 4)


# --------------------------------------------------------------------------
# Web page: the prototype as one self-contained HTML file
# --------------------------------------------------------------------------
def build_page():
    def uri(name):
        mime = "image/png" if name.endswith(".png") else "image/jpeg"
        with open(os.path.join(WEB, "assets", name), "rb") as f:
            return "data:%s;base64,%s" % (mime, base64.b64encode(f.read()).decode())

    html = open(os.path.join(WEB, "index.html"), encoding="utf-8").read()
    css = open(os.path.join(WEB, "style.css"), encoding="utf-8").read()
    js = open(os.path.join(WEB, "app.js"), encoding="utf-8").read()
    for name in os.listdir(os.path.join(WEB, "assets")):
        key = "assets/" + name
        css, js, html = css.replace(key, uri(name)), js.replace(key, uri(name)), html.replace(key, uri(name))
    # offline: no web fonts (the font stack falls back to the system font)
    html = re.sub(r'\s*<link rel="preconnect"[^>]*>', "", html)
    html = re.sub(r'\s*<link href="https://fonts.googleapis.com[^>]*>', "", html)
    html = re.sub(r'\s*<link rel="preload"[^>]*>', "", html)
    html = html.replace('<link rel="stylesheet" href="style.css">', "<style>\n%s\n</style>" % css)
    html = html.replace('<script src="app.js"></script>', "<script>\n%s\n</script>" % js)
    assert "assets/" not in html and 'href="style.css"' not in html and 'src="app.js"' not in html
    return html.encode("utf-8")


# --------------------------------------------------------------------------
# classes.dex
# --------------------------------------------------------------------------
def uleb(v):
    out = bytearray()
    while True:
        b = v & 0x7F
        v >>= 7
        if v:
            out.append(b | 0x80)
        else:
            out.append(b)
            return bytes(out)


def build_dex():
    MAIN = "L%s/MainActivity;" % PKG.replace(".", "/")
    ACT, CTX, BUNDLE = "Landroid/app/Activity;", "Landroid/content/Context;", "Landroid/os/Bundle;"
    VIEW, WINDOW = "Landroid/view/View;", "Landroid/view/Window;"
    WEBVIEW, SETTINGS, STRING = "Landroid/webkit/WebView;", "Landroid/webkit/WebSettings;", "Ljava/lang/String;"
    URL = "file:///android_asset/index.html"

    # (class, name, return, params)
    M = {
        "act_init": (ACT, "<init>", "V", ()),
        "act_onCreate": (ACT, "onCreate", "V", (BUNDLE,)),
        "act_getWindow": (ACT, "getWindow", WINDOW, ()),
        "act_setContentView": (ACT, "setContentView", "V", (VIEW,)),
        "main_init": (MAIN, "<init>", "V", ()),
        "main_onCreate": (MAIN, "onCreate", "V", (BUNDLE,)),
        "win_status": (WINDOW, "setStatusBarColor", "V", ("I",)),
        "win_nav": (WINDOW, "setNavigationBarColor", "V", ("I",)),
        "win_decor": (WINDOW, "getDecorView", VIEW, ()),
        "view_sysui": (VIEW, "setSystemUiVisibility", "V", ("I",)),
        "wv_init": (WEBVIEW, "<init>", "V", (CTX,)),
        "wv_settings": (WEBVIEW, "getSettings", SETTINGS, ()),
        "wv_load": (WEBVIEW, "loadUrl", "V", (STRING,)),
        "wv_bg": (WEBVIEW, "setBackgroundColor", "V", ("I",)),
        "ws_js": (SETTINGS, "setJavaScriptEnabled", "V", ("Z",)),
        "ws_dom": (SETTINGS, "setDomStorageEnabled", "V", ("Z",)),
        "ws_file": (SETTINGS, "setAllowFileAccess", "V", ("Z",)),
    }

    def shorty(ret, params):
        s = lambda t: "L" if t[0] in "L[" else t
        return s(ret) + "".join(s(p) for p in params)

    types = sorted({t for c, _, r, ps in M.values() for t in (c, r) + ps})
    protos_set = sorted({(r, ps) for _, _, r, ps in M.values()})
    strings = set(types) | {n for _, n, _, _ in M.values()} | {shorty(r, ps) for r, ps in protos_set} | {URL}
    strings = sorted(strings)                                  # ASCII: code-point order
    sidx = {s: i for i, s in enumerate(strings)}
    types.sort(key=lambda t: sidx[t])
    tidx = {t: i for i, t in enumerate(types)}
    protos = sorted(protos_set, key=lambda p: (tidx[p[0]], [tidx[x] for x in p[1]]))
    pidx = {p: i for i, p in enumerate(protos)}
    methods = sorted(set(M.values()), key=lambda m: (tidx[m[0]], sidx[m[1]], pidx[(m[2], m[3])]))
    midx = {m: i for i, m in enumerate(methods)}
    mi = lambda k: midx[M[k]]

    # --- instructions (16-bit code units)
    def inv(op, meth, *regs):
        a = len(regs)
        r = list(regs) + [0] * (5 - a)
        return [(a << 12) | (r[4] << 8) | op, meth, (r[3] << 12) | (r[2] << 8) | (r[1] << 4) | r[0]]

    def const(reg, val):                       # const vAA, #+BBBBBBBB (31i)
        val &= 0xFFFFFFFF
        return [(reg << 8) | 0x14, val & 0xFFFF, val >> 16]

    const4 = lambda reg, v: [((v & 0xF) << 12) | (reg << 8) | 0x12]
    const16 = lambda reg, v: [(reg << 8) | 0x13, v & 0xFFFF]
    move_result_object = lambda reg: [(reg << 8) | 0x0C]
    new_instance = lambda reg, t: [(reg << 8) | 0x22, t]
    const_string = lambda reg, s: [(reg << 8) | 0x1A, s]
    RETURN_VOID = [0x000E]
    INVOKE_VIRTUAL, INVOKE_SUPER, INVOKE_DIRECT = 0x6E, 0x6F, 0x70

    # constructor: registers v0 = this
    init_code = inv(INVOKE_DIRECT, mi("act_init"), 0) + RETURN_VOID
    # onCreate: locals v0..v3, this = v4, bundle = v5
    P0, P1 = 4, 5
    oncreate = (
        inv(INVOKE_SUPER, mi("act_onCreate"), P0, P1)
        + inv(INVOKE_VIRTUAL, mi("act_getWindow"), P0) + move_result_object(0)
        + const(1, 0xFFFBFAF7) + inv(INVOKE_VIRTUAL, mi("win_status"), 0, 1)
        + const(1, 0xFFFBFBFB) + inv(INVOKE_VIRTUAL, mi("win_nav"), 0, 1)
        + inv(INVOKE_VIRTUAL, mi("win_decor"), 0) + move_result_object(2)
        + const16(1, 0x2010)          # SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | LIGHT_NAVIGATION_BAR
        + inv(INVOKE_VIRTUAL, mi("view_sysui"), 2, 1)
        + new_instance(0, tidx[WEBVIEW]) + inv(INVOKE_DIRECT, mi("wv_init"), 0, P0)
        + inv(INVOKE_VIRTUAL, mi("wv_settings"), 0) + move_result_object(1)
        + const4(2, 1)
        + inv(INVOKE_VIRTUAL, mi("ws_js"), 1, 2)
        + inv(INVOKE_VIRTUAL, mi("ws_dom"), 1, 2)
        + inv(INVOKE_VIRTUAL, mi("ws_file"), 1, 2)
        + const(2, 0xFFF5F2EB) + inv(INVOKE_VIRTUAL, mi("wv_bg"), 0, 2)
        + const_string(3, sidx[URL]) + inv(INVOKE_VIRTUAL, mi("wv_load"), 0, 3)
        + inv(INVOKE_VIRTUAL, mi("act_setContentView"), P0, 0)
        + RETURN_VOID
    )

    def code_item(regs, ins, outs, insns):
        return u16(regs) + u16(ins) + u16(outs) + u16(0) + u32(0) + u32(len(insns)) + b"".join(u16(x) for x in insns)

    codes = [code_item(1, 1, 1, init_code), code_item(6, 2, 2, oncreate)]

    # --- layout
    HEADER = 0x70
    off_strings = HEADER
    off_types = off_strings + 4 * len(strings)
    off_protos = off_types + 4 * len(types)
    off_methods = off_protos + 12 * len(protos)
    off_classes = off_methods + 8 * len(methods)
    data_off = off_classes + 32

    data = bytearray()
    def place(blob, align=1):
        while (data_off + len(data)) % align:
            data.append(0)
        o = data_off + len(data)
        data.extend(blob)
        return o

    code_offs = [place(c, 4) for c in codes]
    first_code = code_offs[0]
    type_lists = {}
    first_tl = None
    for r, ps in protos:
        if ps and ps not in type_lists:
            tl = u32(len(ps)) + b"".join(u16(tidx[p]) for p in ps)
            type_lists[ps] = place(tl, 4)
            first_tl = first_tl or type_lists[ps]
    string_offs = []
    for s in strings:
        b = s.encode("utf-8")
        string_offs.append(place(uleb(len(s)) + b + b"\0"))
    # class data: 0 static fields, 0 instance fields, 1 direct, 1 virtual
    m_init, m_oncreate = midx[M["main_init"]], midx[M["main_onCreate"]]
    class_data = (uleb(0) + uleb(0) + uleb(1) + uleb(1)
                  + uleb(m_init) + uleb(0x10001) + uleb(code_offs[0])
                  + uleb(m_oncreate) + uleb(0x0004) + uleb(code_offs[1]))
    class_data_off = place(class_data)
    # map list
    map_off_guess = data_off + len(data) + (-(data_off + len(data)) % 4)
    items = [
        (0x0000, 1, 0), (0x0001, len(strings), off_strings), (0x0002, len(types), off_types),
        (0x0003, len(protos), off_protos), (0x0005, len(methods), off_methods),
        (0x0006, 1, off_classes), (0x2001, len(codes), first_code),
    ]
    if type_lists:
        items.append((0x1001, len(type_lists), first_tl))
    items += [(0x2002, len(strings), string_offs[0]), (0x2000, 1, class_data_off), (0x1000, 1, map_off_guess)]
    items.sort(key=lambda x: x[2])
    map_blob = u32(len(items)) + b"".join(u16(t) + u16(0) + u32(n) + u32(o) for t, n, o in items)
    map_off = place(map_blob, 4)
    assert map_off == map_off_guess

    body = bytearray()
    body += b"".join(u32(o) for o in string_offs)
    body += b"".join(u32(sidx[t]) for t in types)
    for r, ps in protos:
        body += u32(sidx[shorty(r, ps)]) + u32(tidx[r]) + u32(type_lists.get(ps, 0))
    for c, n, r, ps in methods:
        body += u16(tidx[c]) + u16(pidx[(r, ps)]) + u32(sidx[n])
    body += (u32(tidx[MAIN]) + u32(0x0001) + u32(tidx[ACT]) + u32(0) + u32(0xFFFFFFFF)
             + u32(0) + u32(class_data_off) + u32(0))
    assert HEADER + len(body) == data_off
    file_size = data_off + len(data)
    header = bytearray(b"dex\n035\0" + b"\0" * 4 + b"\0" * 20)
    header += u32(file_size) + u32(HEADER) + u32(0x12345678) + u32(0) + u32(0) + u32(map_off)
    header += u32(len(strings)) + u32(off_strings) + u32(len(types)) + u32(off_types)
    header += u32(len(protos)) + u32(off_protos) + u32(0) + u32(0)
    header += u32(len(methods)) + u32(off_methods) + u32(1) + u32(off_classes)
    header += u32(len(data)) + u32(data_off)
    assert len(header) == HEADER
    dex = bytearray(header + body + data)
    dex[12:32] = hashlib.sha1(bytes(dex[32:])).digest()
    dex[8:12] = u32(zlib.adler32(bytes(dex[12:])))
    return bytes(dex)


# --------------------------------------------------------------------------
# Binary XML / resource table helpers
# --------------------------------------------------------------------------
def string_pool(strings):
    """ResStringPool, UTF-16."""
    offs, blob = [], bytearray()
    for s in strings:
        offs.append(len(blob))
        e = s.encode("utf-16-le")
        blob += u16(len(s)) + e + b"\0\0"
    blob = pad4(bytes(blob))
    header_size = 28
    strings_start = header_size + 4 * len(strings)
    size = strings_start + len(blob)
    return (u16(0x0001) + u16(header_size) + u32(size) + u32(len(strings)) + u32(0) + u32(0)
            + u32(strings_start) + u32(0) + b"".join(u32(o) for o in offs) + blob)


ANDROID_NS = "http://schemas.android.com/apk/res/android"
ATTR_IDS = {  # from android.R.attr (read with javap from the android stubs jar)
    "theme": 0x01010000, "label": 0x01010001, "icon": 0x01010002, "name": 0x01010003,
    "exported": 0x01010010, "screenOrientation": 0x0101001E, "configChanges": 0x0101001F,
    "minSdkVersion": 0x0101020C, "versionCode": 0x0101021B, "versionName": 0x0101021C,
    "targetSdkVersion": 0x01010270, "hardwareAccelerated": 0x010102D3,
}
THEME_DEVICE_DEFAULT_LIGHT_NO_ACTIONBAR = 16974124  # android.R.style
ICON_ID = 0x7F010000                                # @mipmap/ic_launcher (package 0x7f, type 1, entry 0)

T_REF, T_STRING, T_DEC, T_HEX, T_BOOL = 0x01, 0x03, 0x10, 0x11, 0x12


def build_manifest():
    # element tree: (tag, [(android?, attr, type, value)], children)
    A = True
    tree = ("manifest", [(A, "versionCode", T_DEC, VERSION_CODE), (A, "versionName", T_STRING, VERSION_NAME),
                         (False, "package", T_STRING, PKG)], [
        ("uses-sdk", [(A, "minSdkVersion", T_DEC, MIN_SDK), (A, "targetSdkVersion", T_DEC, TARGET_SDK)], []),
        ("application", [(A, "theme", T_REF, THEME_DEVICE_DEFAULT_LIGHT_NO_ACTIONBAR),
                         (A, "label", T_STRING, APP_LABEL), (A, "icon", T_REF, ICON_ID),
                         (A, "hardwareAccelerated", T_BOOL, True)], [
            ("activity", [(A, "theme", T_REF, THEME_DEVICE_DEFAULT_LIGHT_NO_ACTIONBAR),
                          (A, "name", T_STRING, PKG + ".MainActivity"), (A, "exported", T_BOOL, True),
                          (A, "screenOrientation", T_DEC, 1),     # portrait
                          (A, "configChanges", T_HEX, 0x7A0)],    # orientation|keyboardHidden|screenSize|screenLayout|uiMode
             [("intent-filter", [], [
                 ("action", [(A, "name", T_STRING, "android.intent.action.MAIN")], []),
                 ("category", [(A, "name", T_STRING, "android.intent.category.LAUNCHER")], []),
             ])]),
        ]),
    ])

    # strings: attribute names with resource IDs first (matching the resource map)
    attr_names = []
    others = ["android", ANDROID_NS]

    def walk(node):
        tag, attrs, kids = node
        others.append(tag)
        for andr, name, t, v in attrs:
            if andr:
                if name not in attr_names:
                    attr_names.append(name)
            else:
                others.append(name)
            if t == T_STRING:
                others.append(v)
        for k in kids:
            walk(k)
    walk(tree)
    strings = list(attr_names)
    for s in others:
        if s not in strings:
            strings.append(s)
    si = {s: i for i, s in enumerate(strings)}

    chunks = bytearray()
    resmap = u16(0x0180) + u16(8) + u32(8 + 4 * len(attr_names)) + b"".join(u32(ATTR_IDS[n]) for n in attr_names)
    NONE = 0xFFFFFFFF
    line = [1]

    def node_hdr(t, size):
        line[0] += 1
        return u16(t) + u16(16) + u32(size) + u32(line[0]) + u32(NONE)

    ns_body = u32(si["android"]) + u32(si[ANDROID_NS])
    chunks += node_hdr(0x0100, 24) + ns_body

    def emit(node):
        tag, attrs, kids = node
        # sort: attributes with resource IDs ascending, then plain attributes
        attrs = sorted(attrs, key=lambda a: (0, ATTR_IDS[a[1]]) if a[0] else (1, 0))
        ab = bytearray()
        for andr, name, t, v in attrs:
            ns = si[ANDROID_NS] if andr else NONE
            if t == T_STRING:
                raw, data = si[v], si[v]
            elif t == T_BOOL:
                raw, data = NONE, 0xFFFFFFFF if v else 0
            else:
                raw, data = NONE, v
            ab += u32(ns) + u32(si[name]) + u32(raw) + u16(8) + u8(0) + u8(t) + u32(data)
        ext = u32(NONE) + u32(si[tag]) + u16(20) + u16(20) + u16(len(attrs)) + u16(0) + u16(0) + u16(0)
        chunks.extend(node_hdr(0x0102, 16 + len(ext) + len(ab)) + ext + ab)
        for k in kids:
            emit(k)
        chunks.extend(node_hdr(0x0103, 24) + u32(NONE) + u32(si[tag]))
    emit(tree)
    chunks += node_hdr(0x0101, 24) + ns_body

    body = string_pool(strings) + resmap + bytes(chunks)
    return u16(0x0003) + u16(8) + u32(8 + len(body)) + body


def build_arsc(icon_path):
    values = string_pool([icon_path])
    types = string_pool(["mipmap"])
    keys = string_pool(["ic_launcher"])
    CONFIG_DENSITY = 0x0100
    spec = u16(0x0202) + u16(16) + u32(16 + 4) + u8(1) + u8(0) + u16(0) + u32(1) + u32(CONFIG_DENSITY)
    # ResTable_config (64 bytes): density 640 (xxxhdpi), sdkVersion 4 like aapt
    cfg = bytearray(64)
    cfg[0:4] = u32(64)
    cfg[14:16] = u16(640)
    cfg[24:26] = u16(4)
    entry = u16(8) + u16(0) + u32(0) + u16(8) + u8(0) + u8(T_STRING) + u32(0)
    type_hdr = 20 + 64
    entries_start = type_hdr + 4
    tchunk = (u16(0x0201) + u16(type_hdr) + u32(entries_start + len(entry)) + u8(1) + u8(0) + u16(0)
              + u32(1) + u32(entries_start) + bytes(cfg) + u32(0) + entry)
    name = PKG.encode("utf-16-le")
    name = name + b"\0" * (256 - len(name))
    PKG_HDR = 288
    type_strings_off = PKG_HDR
    key_strings_off = PKG_HDR + len(types)
    pkg_body = types + keys + spec + tchunk
    pkg = (u16(0x0200) + u16(PKG_HDR) + u32(PKG_HDR + len(pkg_body)) + u32(0x7F) + name
           + u32(type_strings_off) + u32(1) + u32(key_strings_off) + u32(1) + u32(0) + pkg_body)
    body = values + pkg
    return u16(0x0002) + u16(12) + u32(12 + len(body)) + u32(1) + body


# --------------------------------------------------------------------------
# Launcher icon
# --------------------------------------------------------------------------
def build_icon(size=192):
    from PIL import Image, ImageDraw, ImageFilter
    s = size * 4
    bg = Image.new("RGB", (s, s))
    top, bottom = (80, 150, 214), (31, 84, 150)
    px = bg.load()
    for y in range(s):
        t = y / (s - 1)
        c = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        for x in range(s):
            px[x, y] = c
    # a strip of fresh wallpaper being rolled up, under the roller
    d = ImageDraw.Draw(bg)
    d.rectangle((0, int(s * 0.58), s, s), fill=(245, 242, 235))
    d.rectangle((0, int(s * 0.555), s, int(s * 0.60)), fill=(92, 108, 128))
    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, s - 1, s - 1), radius=int(s * 0.23), fill=255)
    icon = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    icon.paste(bg, (0, 0), mask)
    roller = Image.open(os.path.join(WEB, "assets", "roller.png")).convert("RGBA")
    roller = roller.crop(roller.getbbox())
    rw = int(s * 0.62)
    roller = roller.resize((rw, int(roller.height * rw / roller.width)), Image.LANCZOS)
    shadow = Image.new("RGBA", icon.size, (0, 0, 0, 0))
    sx, sy = (s - rw) // 2, int(s * 0.17)
    shadow.paste((0, 0, 0, 90), (sx + 6, sy + 18), roller.split()[3])
    shadow = shadow.filter(ImageFilter.GaussianBlur(14))
    icon = Image.alpha_composite(icon, Image.composite(shadow, Image.new("RGBA", icon.size), mask))
    icon.alpha_composite(roller, (sx, sy))
    icon = icon.resize((size, size), Image.LANCZOS)
    out = io.BytesIO()
    icon.save(out, "PNG", optimize=True)
    return out.getvalue()


# --------------------------------------------------------------------------
# Zip (with alignment) and APK Signature Scheme v2
# --------------------------------------------------------------------------
def build_zip(entries):
    """entries: [(name, data, store)]; stored entries are 4-byte aligned."""
    out, central = bytearray(), bytearray()
    for name, data, store in entries:
        nb = name.encode()
        crc = zlib.crc32(data) & 0xFFFFFFFF
        if store:
            method, comp = 0, data
        else:
            co = zlib.compressobj(9, zlib.DEFLATED, -15)
            method, comp = 8, co.compress(data) + co.flush()
        offset = len(out)
        extra = b""
        base = offset + 30 + len(nb)
        if store and base % 4:
            need = 4 + (-(base + 4) % 4)               # 4-byte extra header + zero padding
            extra = u16(0xD935) + u16(need - 4) + b"\0" * (need - 4)
        hdr = (u32(0x04034B50) + u16(20) + u16(0x0800) + u16(method) + u16(0) + u16(0x21) + u32(crc)
               + u32(len(comp)) + u32(len(data)) + u16(len(nb)) + u16(len(extra)))
        out += hdr + nb + extra
        if store:
            assert len(out) % 4 == 0, name
        out += comp
        central += (u32(0x02014B50) + u16(20) + u16(20) + u16(0x0800) + u16(method) + u16(0) + u16(0x21)
                    + u32(crc) + u32(len(comp)) + u32(len(data)) + u16(len(nb)) + u16(0) + u16(0) + u16(0)
                    + u16(0) + u32(0) + u32(offset) + nb)
    cd_off = len(out)
    eocd = (u32(0x06054B50) + u16(0) + u16(0) + u16(len(entries)) + u16(len(entries))
            + u32(len(central)) + u32(cd_off) + u16(0))
    return bytes(out), bytes(central), eocd


def lp(b):
    return u32(len(b)) + b


def v2_digest(sections):
    chunks = []
    for sec in sections:
        for i in range(0, len(sec), 1 << 20):
            c = sec[i:i + (1 << 20)]
            chunks.append(hashlib.sha256(b"\xa5" + u32(len(c)) + c).digest())
    return hashlib.sha256(b"\x5a" + u32(len(chunks)) + b"".join(chunks)).digest()


def ensure_key():
    os.makedirs(KEY_DIR, exist_ok=True)
    key, cert = os.path.join(KEY_DIR, "key.pem"), os.path.join(KEY_DIR, "cert.pem")
    if not os.path.exists(key):
        subprocess.run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key,
                        "-out", cert, "-days", "10000", "-subj", "/CN=Wallpaper Roller debug"],
                       check=True, capture_output=True)
    cert_der = subprocess.run(["openssl", "x509", "-in", cert, "-outform", "DER"], check=True, capture_output=True).stdout
    pub = subprocess.run(["openssl", "x509", "-in", cert, "-pubkey", "-noout"], check=True, capture_output=True).stdout
    spki = subprocess.run(["openssl", "pkey", "-pubin", "-outform", "DER"], input=pub, check=True, capture_output=True).stdout
    return key, cert_der, spki


def sign_v2(contents, central, eocd):
    key, cert_der, spki = ensure_key()
    ALG = 0x0103                                       # RSASSA-PKCS1-v1_5 with SHA2-256
    cd_off = len(contents)
    digest = v2_digest([contents, central, eocd[:16] + u32(cd_off) + eocd[20:]])
    signed_data = lp(lp(u32(ALG) + lp(digest))) + lp(lp(cert_der)) + lp(b"")
    with tempfile.NamedTemporaryFile() as f:
        f.write(signed_data)
        f.flush()
        sig = subprocess.run(["openssl", "dgst", "-sha256", "-sign", key, f.name],
                             check=True, capture_output=True).stdout
    signer = lp(signed_data) + lp(lp(u32(ALG) + lp(sig))) + lp(spki)
    value = lp(lp(signer))
    pair = u64(4 + len(value)) + u32(0x7109871A) + value
    size = len(pair) + 8 + 16
    block = u64(size) + pair + u64(size) + b"APK Sig Block 42"
    new_eocd = eocd[:16] + u32(cd_off + len(block)) + eocd[20:]
    return contents + block + central + new_eocd


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "WallpaperRoller.apk")
    icon_path = "res/mipmap-xxxhdpi-v4/ic_launcher.png"
    entries = [
        ("AndroidManifest.xml", build_manifest(), False),
        ("classes.dex", build_dex(), False),
        ("resources.arsc", build_arsc(icon_path), True),
        (icon_path, build_icon(), True),
        ("assets/index.html", build_page(), False),
    ]
    apk = sign_v2(*build_zip(entries))
    with open(out, "wb") as f:
        f.write(apk)
    print("wrote %s (%.2f MB)" % (out, len(apk) / 1e6))


if __name__ == "__main__":
    main()
