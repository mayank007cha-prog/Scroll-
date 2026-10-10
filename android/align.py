"""Rewrite an APK so stored (uncompressed) entries start on 4-byte boundaries, like zipalign -p 4.

resources.arsc and media are stored uncompressed; Android 11+ requires resources.arsc aligned.
"""
import sys, zipfile

STORE = ('.arsc', '.mp3', '.mp4', '.webm', '.png', '.jpg', '.woff2')

def main(src, dst):
    with zipfile.ZipFile(src) as zin, open(dst, 'wb') as raw:
        zout = zipfile.ZipFile(raw, 'w')
        for info in zin.infolist():
            data = zin.read(info.filename)
            out = zipfile.ZipInfo(info.filename, date_time=(1981, 1, 1, 0, 0, 0))
            out.external_attr = info.external_attr
            if info.filename.lower().endswith(STORE):
                out.compress_type = zipfile.ZIP_STORED
                header = 30 + len(info.filename.encode())
                pad = (-(raw.tell() + header)) % 4
                out.extra = b'\x00' * pad
            else:
                out.compress_type = zipfile.ZIP_DEFLATED
            zout.writestr(out, data)
        zout.close()

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
