#!/usr/bin/env python3
"""Builds IncognitoMotion.apk — a full-screen WebView app around the prototype.

No Android SDK needed. The only inputs are a JDK (javac, keytool) and three
jars fetched from Maven Central on first run:

  * Android framework classes (Robolectric's android-all, API 34) to compile
    against,
  * dalvik-dx to turn the classes into classes.dex,
  * apksig to sign with APK Signature Scheme v2 and verify.

The binary AndroidManifest.xml, the adaptive-icon XML and resources.arsc are
written by this script directly, so aapt2 isn't needed either.

    python3 build_apk.py          # -> android/IncognitoMotion.apk
"""

import os
import shutil
import struct
import subprocess
import time
import urllib.request
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
PROTOTYPE = os.path.join(os.path.dirname(HERE), 'incognito-android.html')
CACHE = os.path.join(HERE, '.tools')
BUILD = os.path.join(HERE, 'build')
OUT = os.path.join(HERE, 'IncognitoMotion.apk')

PACKAGE = 'com.mayank.incognitomotion'
LABEL = 'Incognito Motion'
VERSION_CODE, VERSION_NAME = 1, '1.0'
MIN_SDK, TARGET_SDK = 24, 34

# A throwaway local signing key; kept out of git. Installing a build signed
# with a different key over an existing install needs an uninstall first.
KEYSTORE = os.path.join(HERE, 'signing.p12')
KEY_ALIAS, KEY_PASSWORD = 'incognito', 'incognito-motion'

MAVEN = 'https://repo1.maven.org/maven2/'
TOOLS = {
    'android-all.jar': 'org/robolectric/android-all/14-robolectric-10818077/android-all-14-robolectric-10818077.jar',
    'dx.jar': 'com/jakewharton/android/repackaged/dalvik-dx/16.0.1/dalvik-dx-16.0.1.jar',
    'apksig.jar': 'com/android/tools/build/apksig/2.3.0/apksig-2.3.0.jar',
}

# android.R.attr / android.R.style values (identical on every API level).
ATTR = {
    'theme': 0x01010000, 'label': 0x01010001, 'icon': 0x01010002, 'name': 0x01010003,
    'exported': 0x01010010, 'screenOrientation': 0x0101001e, 'configChanges': 0x0101001f,
    'drawable': 0x01010199, 'minSdkVersion': 0x0101020c, 'versionCode': 0x0101021b,
    'versionName': 0x0101021c, 'targetSdkVersion': 0x01010270, 'allowBackup': 0x01010280,
    'hardwareAccelerated': 0x010102d3, 'compileSdkVersion': 0x01010572,
}
THEME_MATERIAL_NO_ACTION_BAR = 0x0103022e

# This app's resources: one "mipmap" type, three entries.
IC_LAUNCHER, IC_FG, IC_BG = 0x7f010000, 0x7f010001, 0x7f010002

ANDROID_NS = 'http://schemas.android.com/apk/res/android'


# ───────────────────────────── Binary XML / resource table ─────────────────────────────

def string_pool(strings):
    """ResStringPool chunk, UTF-16."""
    offsets, data = [], b''
    for s in strings:
        offsets.append(len(data))
        units = s.encode('utf-16-le')
        data += struct.pack('<H', len(units) // 2) + units + b'\0\0'
    data += b'\0' * (-len(data) % 4)
    header_size = 28
    strings_start = header_size + 4 * len(strings)
    size = strings_start + len(data)
    return (struct.pack('<HHIIIIII', 0x0001, header_size, size, len(strings), 0, 0, strings_start, 0)
            + b''.join(struct.pack('<I', o) for o in offsets) + data)


TYPE_REFERENCE, TYPE_STRING, TYPE_INT_DEC, TYPE_INT_HEX, TYPE_INT_BOOLEAN = 0x01, 0x03, 0x10, 0x11, 0x12


def binary_xml(root):
    """Compiles an element tree into Android binary XML (what aapt2 emits).

    Elements are (tag, [(namespaced?, attr, (type, value))], [children]).
    """
    attr_names, other = [], []

    def collect(node):
        tag, attrs, children = node
        for ns, name, _ in attrs:
            if ns and name not in attr_names:
                attr_names.append(name)
        for ns, name, (kind, value) in attrs:
            if not ns and name not in other:
                other.append(name)
            if kind == TYPE_STRING and value not in other:
                other.append(value)
        if tag not in other:
            other.append(tag)
        for child in children:
            collect(child)

    collect(root)
    # Attribute names with resource ids come first, mirrored by the resource map.
    strings = attr_names + [s for s in ['android', ANDROID_NS] + other if s not in attr_names]
    strings = list(dict.fromkeys(strings))
    idx = {s: i for i, s in enumerate(strings)}
    none = 0xFFFFFFFF

    body = b''
    body += struct.pack('<HHI', 0x0180, 8, 8 + 4 * len(attr_names))
    body += b''.join(struct.pack('<I', ATTR[n]) for n in attr_names)
    body += struct.pack('<HHIIIII', 0x0100, 16, 24, 1, none, idx['android'], idx[ANDROID_NS])

    def emit(node, line=[2]):
        nonlocal body
        tag, attrs, children = node
        # Framework lookups assume attributes sorted by resource id.
        attrs = sorted(attrs, key=lambda a: ATTR[a[1]] if a[0] else 0)
        body += struct.pack('<HHIIIIIHHHHHH', 0x0102, 16, 36 + 20 * len(attrs), line[0], none,
                            none, idx[tag], 20, 20, len(attrs), 0, 0, 0)
        for ns, name, (kind, value) in attrs:
            if kind == TYPE_STRING:
                raw, data = idx[value], idx[value]
            elif kind == TYPE_INT_BOOLEAN:
                raw, data = none, 0xFFFFFFFF if value else 0
            else:
                raw, data = none, value
            body += struct.pack('<IIIHBBI', idx[ANDROID_NS] if ns else none, idx[name], raw, 8, 0, kind, data)
        line[0] += 1
        for child in children:
            emit(child)
        body += struct.pack('<HHIIIII', 0x0103, 16, 24, line[0], none, none, idx[tag])
        line[0] += 1

    emit(root)
    body += struct.pack('<HHIIIII', 0x0101, 16, 24, 1, none, idx['android'], idx[ANDROID_NS])

    pool = string_pool(strings)
    content = pool + body
    return struct.pack('<HHI', 0x0003, 8, 8 + len(content)) + content


def res_config(density=0, sdk=0):
    cfg = bytearray(64)
    struct.pack_into('<I', cfg, 0, 64)
    struct.pack_into('<H', cfg, 14, density)
    struct.pack_into('<H', cfg, 24, sdk)
    return bytes(cfg)


def resource_table(files):
    """resources.arsc for one mipmap type.

    files: {(entry_index, config_bytes): 'res/path'} for entries
    ic_launcher (0), ic_fg (1), ic_bg (2).
    """
    keys = ['ic_launcher', 'ic_fg', 'ic_bg']
    values = sorted(set(files.values()))
    vidx = {v: i for i, v in enumerate(values)}

    configs = []
    for (_, cfg) in files:
        if cfg not in configs:
            configs.append(cfg)

    type_strings = string_pool(['mipmap'])
    key_strings = string_pool(keys)

    spec_flags = [0x0100 | 0x0400, 0x0100, 0x0100]  # density / version vary
    spec = struct.pack('<HHIBBHI', 0x0202, 16, 16 + 4 * len(keys), 1, 0, 0, len(keys))
    spec += b''.join(struct.pack('<I', f) for f in spec_flags)

    types = b''
    for cfg in configs:
        offsets, entries = [], b''
        for e in range(len(keys)):
            path = files.get((e, cfg))
            if path is None:
                offsets.append(0xFFFFFFFF)
                continue
            offsets.append(len(entries))
            entries += struct.pack('<HHI', 8, 0, e) + struct.pack('<HBBI', 8, 0, TYPE_STRING, vidx[path])
        header_size = 20 + len(cfg)
        entries_start = header_size + 4 * len(keys)
        size = entries_start + len(entries)
        types += (struct.pack('<HHIBBHII', 0x0201, header_size, size, 1, 0, 0, len(keys), entries_start)
                  + cfg + b''.join(struct.pack('<I', o) for o in offsets) + entries)

    pkg_header_size = 288
    name = PACKAGE.encode('utf-16-le').ljust(256, b'\0')
    type_strings_off = pkg_header_size
    key_strings_off = type_strings_off + len(type_strings)
    pkg_body = type_strings + key_strings + spec + types
    package = (struct.pack('<HHII', 0x0200, pkg_header_size, pkg_header_size + len(pkg_body), 0x7f) + name
               + struct.pack('<IIIII', type_strings_off, 1, key_strings_off, len(keys), 0) + pkg_body)

    values_pool = string_pool(values)
    content = values_pool + package
    return struct.pack('<HHII', 0x0002, 12, 12 + len(content), 1) + content


def manifest():
    S, I, H, B, R = TYPE_STRING, TYPE_INT_DEC, TYPE_INT_HEX, TYPE_INT_BOOLEAN, TYPE_REFERENCE
    config_changes = 0x0080 | 0x0400 | 0x0100 | 0x0020 | 0x0200 | 0x0800 | 0x1000
    activity = ('activity', [
        (True, 'name', (S, PACKAGE + '.MainActivity')),
        (True, 'exported', (B, True)),
        (True, 'screenOrientation', (I, 1)),  # portrait
        (True, 'configChanges', (H, config_changes)),
    ], [
        ('intent-filter', [], [
            ('action', [(True, 'name', (S, 'android.intent.action.MAIN'))], []),
            ('category', [(True, 'name', (S, 'android.intent.category.LAUNCHER'))], []),
        ]),
    ])
    application = ('application', [
        (True, 'label', (S, LABEL)),
        (True, 'icon', (R, IC_LAUNCHER)),
        (True, 'theme', (R, THEME_MATERIAL_NO_ACTION_BAR)),
        (True, 'allowBackup', (B, False)),
        (True, 'hardwareAccelerated', (B, True)),
    ], [activity])
    return binary_xml(('manifest', [
        (False, 'package', (S, PACKAGE)),
        (True, 'versionCode', (I, VERSION_CODE)),
        (True, 'versionName', (S, VERSION_NAME)),
        (True, 'compileSdkVersion', (I, TARGET_SDK)),
    ], [
        ('uses-sdk', [(True, 'minSdkVersion', (I, MIN_SDK)), (True, 'targetSdkVersion', (I, TARGET_SDK))], []),
        application,
    ]))


def adaptive_icon():
    R = TYPE_REFERENCE
    return binary_xml(('adaptive-icon', [], [
        ('background', [(True, 'drawable', (R, IC_BG))], []),
        ('foreground', [(True, 'drawable', (R, IC_FG))], []),
    ]))


# ───────────────────────────── Build steps ─────────────────────────────

def fetch_tools():
    os.makedirs(CACHE, exist_ok=True)
    for name, path in TOOLS.items():
        target = os.path.join(CACHE, name)
        if os.path.exists(target):
            continue
        for attempt in range(6):
            try:
                print('fetching', name)
                with urllib.request.urlopen(MAVEN + path) as r, open(target + '.part', 'wb') as f:
                    shutil.copyfileobj(r, f)
                os.replace(target + '.part', target)
                break
            except Exception as e:  # Maven Central rate-limits bursts (429)
                print('  retrying:', e)
                time.sleep(10 * (attempt + 1))
        else:
            raise SystemExit('could not download ' + name)


def run(*cmd):
    subprocess.run(cmd, check=True)


def compile_dex():
    classes = os.path.join(BUILD, 'classes')
    shutil.rmtree(classes, ignore_errors=True)
    os.makedirs(classes)
    sources = [os.path.join(dp, f) for dp, _, fs in os.walk(os.path.join(HERE, 'src')) for f in fs if f.endswith('.java')]
    run('javac', '--release', '8', '-Xlint:-options', '-cp', os.path.join(CACHE, 'android-all.jar'),
        '-d', classes, *sources)
    dex = os.path.join(BUILD, 'classes.dex')
    run('java', '-cp', os.path.join(CACHE, 'dx.jar'), 'com.android.dx.command.Main', '--dex',
        '--min-sdk-version=%d' % MIN_SDK, '--output=' + dex, classes)
    return open(dex, 'rb').read()


def write_apk(path, entries):
    """Zip with every stored entry's data 4-byte aligned (zipalign's rule)."""
    with zipfile.ZipFile(path, 'w') as z:
        for name, data, stored in entries:
            info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_STORED if stored else zipfile.ZIP_DEFLATED
            if stored:
                start = z.fp.tell() + 30 + len(name.encode())
                pad = 6 + (-(start + 6) % 4)
                info.extra = struct.pack('<HHH', 0xD935, pad - 4, 4) + b'\0' * (pad - 6)
            z.writestr(info, data)


def ensure_keystore():
    if os.path.exists(KEYSTORE):
        return
    run('keytool', '-genkeypair', '-storetype', 'PKCS12', '-keystore', KEYSTORE, '-alias', KEY_ALIAS,
        '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000', '-dname', 'CN=' + LABEL,
        '-storepass', KEY_PASSWORD, '-keypass', KEY_PASSWORD)


def main():
    # Always package the current page.
    run('python3', os.path.join(os.path.dirname(HERE), 'build_standalone.py'))
    fetch_tools()
    os.makedirs(BUILD, exist_ok=True)

    xxxhdpi = res_config(density=640, sdk=4)
    anydpi_v26 = res_config(density=0xFFFE, sdk=26)
    files = {
        (0, xxxhdpi): 'res/mipmap-xxxhdpi-v4/ic_launcher.png',
        (1, xxxhdpi): 'res/mipmap-xxxhdpi-v4/ic_fg.png',
        (2, xxxhdpi): 'res/mipmap-xxxhdpi-v4/ic_bg.png',
        (0, anydpi_v26): 'res/mipmap-anydpi-v26/ic_launcher.xml',
    }
    icon = lambda n: open(os.path.join(HERE, 'res', n), 'rb').read()

    unsigned = os.path.join(BUILD, 'unsigned.apk')
    write_apk(unsigned, [
        ('AndroidManifest.xml', manifest(), False),
        ('classes.dex', compile_dex(), False),
        ('resources.arsc', resource_table(files), True),
        ('res/mipmap-xxxhdpi-v4/ic_launcher.png', icon('ic_launcher.png'), True),
        ('res/mipmap-xxxhdpi-v4/ic_fg.png', icon('ic_fg.png'), True),
        ('res/mipmap-xxxhdpi-v4/ic_bg.png', icon('ic_bg.png'), True),
        ('res/mipmap-anydpi-v26/ic_launcher.xml', adaptive_icon(), False),
        ('assets/index.html', open(PROTOTYPE, 'rb').read(), False),
    ])

    ensure_keystore()
    # apksig 2.3.0 (the newest on Maven Central) reaches into JDK internals.
    exports = [flag for pkg in ('sun.security.x509', 'sun.security.pkcs', 'sun.security.util')
               for flag in ('--add-exports', 'java.base/%s=ALL-UNNAMED' % pkg)]
    run('java', *exports, '-cp', os.path.join(CACHE, 'apksig.jar'), os.path.join(HERE, 'tools', 'Sign.java'),
        unsigned, OUT, KEYSTORE, KEY_PASSWORD, KEY_ALIAS)
    print('built', OUT, os.path.getsize(OUT), 'bytes')


if __name__ == '__main__':
    main()
