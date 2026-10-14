# Minimal zipalign: rewrite a zip so every STORED entry's data starts on a 4-byte boundary.
import sys, zipfile
src, dst = sys.argv[1:3]
zin = zipfile.ZipFile(src)
with open(dst, 'wb') as fp, zipfile.ZipFile(fp, 'w') as zout:
    for info in zin.infolist():
        data = zin.read(info)
        out = zipfile.ZipInfo(info.filename, date_time=info.date_time)
        out.compress_type = info.compress_type
        out.external_attr = info.external_attr
        out.create_system = info.create_system
        if info.compress_type == zipfile.ZIP_STORED:
            pos = fp.tell()
            base = 30 + len(info.filename.encode())
            pad = (4 - (pos + base) % 4) % 4
            out.extra = b'\0' * pad
        zout.writestr(out, data)
