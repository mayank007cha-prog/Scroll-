#!/usr/bin/env python3
"""Independent checks for an APK built by build_apk.py.

Parses the APK from its bytes alone (not the builder's code paths) and:
  - checks the zip structure, CRCs and 4-byte alignment of STORED entries
  - finds the APK Signing Block, recomputes the v2 content digest and
    verifies the RSA signature and certificate with openssl
  - checks classes.dex (magic, adler32, sha1, sizes, sort orders, map list)
    and disassembles its methods
  - decodes AndroidManifest.xml and resources.arsc back to readable form

    python3 android/verify_apk.py WallpaperRoller.apk
"""
import hashlib, struct, subprocess, sys, tempfile, zlib

ok = True


def check(cond, msg):
    global ok
    print(("  ok    " if cond else "  FAIL  ") + msg)
    ok = ok and bool(cond)


U16 = lambda b, o: struct.unpack_from("<H", b, o)[0]
U32 = lambda b, o: struct.unpack_from("<I", b, o)[0]
U64 = lambda b, o: struct.unpack_from("<Q", b, o)[0]


def read_zip(apk):
    eocd = apk.rfind(b"PK\x05\x06")
    n, cd_size, cd_off = U16(apk, eocd + 10), U32(apk, eocd + 12), U32(apk, eocd + 16)
    files, p = {}, cd_off
    for _ in range(n):
        assert U32(apk, p) == 0x02014B50
        method, crc, csize, usize = U16(apk, p + 10), U32(apk, p + 16), U32(apk, p + 20), U32(apk, p + 24)
        nlen, xlen, clen, loff = U16(apk, p + 28), U16(apk, p + 30), U16(apk, p + 32), U32(apk, p + 42)
        name = apk[p + 46:p + 46 + nlen].decode()
        p += 46 + nlen + xlen + clen
        assert U32(apk, loff) == 0x04034B50
        lnlen, lxlen = U16(apk, loff + 26), U16(apk, loff + 28)
        doff = loff + 30 + lnlen + lxlen
        raw = apk[doff:doff + csize]
        data = raw if method == 0 else zlib.decompress(raw, -15)
        files[name] = data
        check(zlib.crc32(data) & 0xFFFFFFFF == crc and len(data) == usize, "zip entry %s (%s, %d bytes)"
              % (name, "stored" if method == 0 else "deflated", usize))
        if method == 0:
            check(doff % 4 == 0, "  %s data is 4-byte aligned (offset %d)" % (name, doff))
    return files, eocd, cd_off, cd_size


def verify_v2(apk, eocd, cd_off):
    print("APK Signature Scheme v2")
    check(apk[cd_off - 16:cd_off] == b"APK Sig Block 42", "signing block magic before central directory")
    size = U64(apk, cd_off - 24)
    start = cd_off - size - 8
    check(U64(apk, start) == size, "signing block size fields agree")
    p, v2 = start + 8, None
    while p < cd_off - 24:
        ln = U64(apk, p)
        pid = U32(apk, p + 8)
        if pid == 0x7109871A:
            v2 = apk[p + 12:p + 8 + ln]
        p += 8 + ln
    check(v2 is not None, "v2 signature block present")

    def lpseq(b):
        out, i = [], 0
        while i < len(b):
            ln = U32(b, i)
            out.append(b[i + 4:i + 4 + ln])
            i += 4 + ln
        return out

    signers = lpseq(lpseq(v2)[0])
    check(len(signers) == 1, "one signer")
    signed_data, sigs, spki = lpseq(signers[0])
    digests_seq, certs_seq, _attrs = lpseq(signed_data)
    d = lpseq(digests_seq)[0]
    alg, digest = U32(d, 0), lpseq(d[4:])[0]
    cert = lpseq(certs_seq)[0]
    s = lpseq(sigs)[0]
    salg, sig = U32(s, 0), lpseq(s[4:])[0]
    check(alg == 0x0103 and salg == 0x0103, "algorithm RSA PKCS#1 v1.5 + SHA-256 (0x0103)")
    # recompute the content digest: entries | central directory | EOCD with CD offset = signing block start
    eocd_bytes = bytearray(apk[eocd:])
    eocd_bytes[16:20] = struct.pack("<I", start)
    chunks = []
    for sec in (apk[:start], apk[cd_off:eocd], bytes(eocd_bytes)):
        for i in range(0, len(sec), 1 << 20):
            c = sec[i:i + (1 << 20)]
            chunks.append(hashlib.sha256(b"\xa5" + struct.pack("<I", len(c)) + c).digest())
    top = hashlib.sha256(b"\x5a" + struct.pack("<I", len(chunks)) + b"".join(chunks)).digest()
    check(top == digest, "content digest matches the signed digest")
    with tempfile.TemporaryDirectory() as t:
        open(t + "/pub.der", "wb").write(spki)
        open(t + "/data", "wb").write(signed_data)
        open(t + "/sig", "wb").write(sig)
        open(t + "/cert.der", "wb").write(cert)
        r = subprocess.run(["openssl", "dgst", "-sha256", "-keyform", "DER", "-verify", t + "/pub.der",
                            "-signature", t + "/sig", t + "/data"], capture_output=True, text=True)
        check(r.returncode == 0 and "Verified OK" in r.stdout, "RSA signature verifies (openssl)")
        cpub = subprocess.run(["openssl", "x509", "-inform", "DER", "-in", t + "/cert.der", "-pubkey", "-noout"],
                              capture_output=True).stdout
        cder = subprocess.run(["openssl", "pkey", "-pubin", "-outform", "DER"], input=cpub, capture_output=True).stdout
        check(cder == spki, "certificate public key matches the signer's public key")


def uleb(b, o):
    v = s = 0
    while True:
        x = b[o]
        o += 1
        v |= (x & 0x7F) << s
        s += 7
        if not x & 0x80:
            return v, o


def verify_dex(dex):
    print("classes.dex")
    check(dex[:8] == b"dex\n035\0", "magic dex 035")
    check(U32(dex, 8) == zlib.adler32(dex[12:]), "adler32 checksum")
    check(dex[12:32] == hashlib.sha1(dex[32:]).digest(), "sha1 signature")
    check(U32(dex, 32) == len(dex) and U32(dex, 36) == 0x70 and U32(dex, 40) == 0x12345678, "file size / header / endian")
    (ns, so), (nt, to), (npr, po), (nf, fo), (nm, mo), (nc, co) = [(U32(dex, 56 + 8 * i), U32(dex, 60 + 8 * i)) for i in range(6)]
    data_size, data_off = U32(dex, 104), U32(dex, 108)
    check(data_off + data_size == len(dex) and data_size % 4 == 0, "data section spans to end of file")
    strs = []
    for i in range(ns):
        off = U32(dex, so + 4 * i)
        n, p = uleb(dex, off)
        e = dex.index(b"\0", p)
        strs.append(dex[p:e].decode())
        check(len(strs[-1]) == n, "string length") if len(strs[-1]) != n else None
    check(strs == sorted(strs), "%d strings sorted" % ns)
    types = [strs[U32(dex, to + 4 * i)] for i in range(nt)]
    check([U32(dex, to + 4 * i) for i in range(nt)] == sorted(U32(dex, to + 4 * i) for i in range(nt)), "%d types sorted" % nt)

    def tlist(off):
        return [] if off == 0 else [U16(dex, off + 4 + 2 * i) for i in range(U32(dex, off))]
    protos = []
    for i in range(npr):
        sh, ret, poff = U32(dex, po + 12 * i), U32(dex, po + 12 * i + 4), U32(dex, po + 12 * i + 8)
        params = tlist(poff)
        protos.append((ret, params))
        short = "".join("L" if types[t][0] in "L[" else types[t] for t in [ret] + params)
        check(strs[sh] == short, "proto %d shorty %s" % (i, short)) if strs[sh] != short else None
    check(protos == sorted(protos), "%d protos sorted" % npr)
    meths = [(U16(dex, mo + 8 * i), U32(dex, mo + 8 * i + 4), U16(dex, mo + 8 * i + 2)) for i in range(nm)]
    check(meths == sorted(meths), "%d method ids sorted" % nm)

    def mname(i):
        c, n, p = meths[i]
        r, ps = protos[p]
        return "%s->%s(%s)%s" % (types[c], strs[n], "".join(types[x] for x in ps), types[r])
    check(nc == 1 and nf == 0, "1 class, 0 fields")
    cls, acc, sup = U32(dex, co), U32(dex, co + 4), U32(dex, co + 8)
    cd = U32(dex, co + 24)
    print("        class %s extends %s (flags 0x%x)" % (types[cls], types[sup], acc))
    p = cd
    sf, p = uleb(dex, p); inf, p = uleb(dex, p); dm, p = uleb(dex, p); vm, p = uleb(dex, p)
    OPS = {0x0E: "return-void", 0x0C: "move-result-object", 0x12: "const/4", 0x13: "const/16", 0x14: "const",
           0x1A: "const-string", 0x22: "new-instance", 0x6E: "invoke-virtual", 0x6F: "invoke-super", 0x70: "invoke-direct"}
    for kind, count in (("direct", dm), ("virtual", vm)):
        idx = 0
        for k in range(count):
            d, p = uleb(dex, p); flags, p = uleb(dex, p); code, p = uleb(dex, p)
            idx = d if k == 0 else idx + d
            regs, ins, outs, tries = U16(dex, code), U16(dex, code + 2), U16(dex, code + 4), U16(dex, code + 6)
            n = U32(dex, code + 12)
            print("        %s method %s  flags 0x%x  regs=%d ins=%d outs=%d" % (kind, mname(idx), flags, regs, ins, outs))
            check(code % 4 == 0 and tries == 0, "  code item aligned")
            u = [U16(dex, code + 16 + 2 * i) for i in range(n)]
            i = 0
            while i < n:
                op = u[i] & 0xFF
                name = OPS.get(op)
                check(name is not None, "  known opcode 0x%02x" % op) if name is None else None
                if op in (0x6E, 0x6F, 0x70):
                    a = u[i] >> 12
                    regs_list = [u[i + 2] & 0xF, (u[i + 2] >> 4) & 0xF, (u[i + 2] >> 8) & 0xF, (u[i + 2] >> 12) & 0xF, (u[i] >> 8) & 0xF][:a]
                    print("          %-18s {%s}, %s" % (name, ", ".join("v%d" % r for r in regs_list), mname(u[i + 1])))
                    check(all(r < regs for r in regs_list) and a <= outs, "    registers in range") if not (all(r < regs for r in regs_list) and a <= outs) else None
                    i += 3
                elif op == 0x14:
                    print("          %-18s v%d, 0x%08x" % (name, u[i] >> 8, u[i + 1] | u[i + 2] << 16)); i += 3
                elif op == 0x13:
                    print("          %-18s v%d, 0x%04x" % (name, u[i] >> 8, u[i + 1])); i += 2
                elif op == 0x1A:
                    print("          %-18s v%d, \"%s\"" % (name, u[i] >> 8, strs[u[i + 1]])); i += 2
                elif op == 0x22:
                    print("          %-18s v%d, %s" % (name, u[i] >> 8, types[u[i + 1]])); i += 2
                elif op == 0x12:
                    print("          %-18s v%d, %d" % (name, (u[i] >> 8) & 0xF, u[i] >> 12)); i += 1
                else:
                    print("          %-18s %s" % (name, "v%d" % (u[i] >> 8) if op == 0x0C else "")); i += 1
            check(i == n and u[-1] == 0x000E, "  method ends with return-void")
    mo_ = U32(dex, 52)
    items = [(U16(dex, mo_ + 4 + 12 * i), U32(dex, mo_ + 4 + 12 * i + 4), U32(dex, mo_ + 4 + 12 * i + 8)) for i in range(U32(dex, mo_))]
    check([o for _, _, o in items] == sorted(o for _, _, o in items), "map list (%d items) sorted by offset" % len(items))
    check({t for t, _, _ in items} >= {0x0000, 0x0001, 0x0002, 0x0003, 0x0005, 0x0006, 0x2001, 0x2002, 0x2000, 0x1000},
          "map list covers every section")


def pool(b, o):
    n, flags, start = U32(b, o + 8), U32(b, o + 16), U32(b, o + 20)
    out = []
    for i in range(n):
        so = o + start + U32(b, o + 28 + 4 * i)
        if flags & 0x100:
            raise SystemExit("utf8 pool not expected")
        ln = U16(b, so)
        out.append(b[so + 2:so + 2 + 2 * ln].decode("utf-16-le"))
    return out, U32(b, o + 4)


def decode_axml(x):
    print("AndroidManifest.xml (decoded)")
    check(U16(x, 0) == 0x0003 and U32(x, 4) == len(x), "binary XML header / size")
    strs, plen = pool(x, 8)
    p = 8 + plen
    resmap = []
    if U16(x, p) == 0x0180:
        n = (U32(x, p + 4) - 8) // 4
        resmap = [U32(x, p + 8 + 4 * i) for i in range(n)]
        p += U32(x, p + 4)
    depth = 0
    while p < len(x):
        t, size = U16(x, p), U32(x, p + 4)
        if t == 0x0102:
            name = strs[U32(x, p + 20)]
            cnt = U16(x, p + 28)
            attrs, ids = [], []
            for i in range(cnt):
                a = p + 36 + 20 * i
                an = U32(x, a + 4)
                dt, dv = x[a + 15], U32(x, a + 16)
                val = strs[dv] if dt == 3 else ("true" if dv else "false") if dt == 0x12 else "@0x%08x" % dv if dt == 1 else "0x%x" % dv if dt == 0x11 else str(dv)
                ns = "android:" if U32(x, a) != 0xFFFFFFFF else ""
                rid = resmap[an] if an < len(resmap) else 0
                ids.append(rid)
                attrs.append('%s%s="%s"' % (ns, strs[an], val))
            print("        " + "  " * depth + "<%s %s>" % (name, " ".join(attrs)) if attrs else "        " + "  " * depth + "<%s>" % name)
            with_ids = [r for r in ids if r]
            check(with_ids == sorted(with_ids), "    <%s> attributes sorted by resource id" % name) if with_ids != sorted(with_ids) else None
            depth += 1
        elif t == 0x0103:
            depth -= 1
        p += size
    check(depth == 0, "elements balanced")


def decode_arsc(r, files):
    print("resources.arsc (decoded)")
    check(U16(r, 0) == 0x0002 and U32(r, 4) == len(r) and U32(r, 8) == 1, "table header, 1 package")
    values, vlen = pool(r, 12)
    p = 12 + vlen
    check(U16(r, p) == 0x0200, "package chunk")
    pid = U32(r, p + 8)
    pname = r[p + 12:p + 12 + 256].decode("utf-16-le").rstrip("\0")
    tstr, _ = pool(r, p + U32(r, p + 268))
    kstr, _ = pool(r, p + U32(r, p + 276))
    q = p + U16(r, p + 2)
    end = p + U32(r, p + 4)
    check(end == len(r), "package chunk spans to end")
    while q < end:
        t, hs, size = U16(r, q), U16(r, q + 2), U32(r, q + 4)
        if t == 0x0201:
            tid, cnt, estart = r[q + 8], U32(r, q + 12), U32(r, q + 16)
            density = U16(r, q + 20 + 14)
            for i in range(cnt):
                eo = U32(r, q + hs + 4 * i)
                e = q + estart + eo
                key = kstr[U32(r, e + 4)]
                dt, dv = r[e + 11], U32(r, e + 12)
                rid = (pid << 24) | (tid << 16) | i
                path = values[dv] if dt == 3 else dv
                print("        0x%08x %s:%s/%s [density %d] -> %s" % (rid, pname, tstr[tid - 1], key, density, path))
                check(path in files, "    file %s exists in the APK" % path)
        q += size


def main():
    apk = open(sys.argv[1], "rb").read()
    print("zip")
    files, eocd, cd_off, _ = read_zip(apk)
    verify_v2(apk, eocd, cd_off)
    verify_dex(files["classes.dex"])
    decode_axml(files["AndroidManifest.xml"])
    decode_arsc(files["resources.arsc"], files)
    html = files["assets/index.html"].decode()
    print("assets/index.html")
    check("assets/" not in html and "data:image/jpeg;base64" in html, "page is self-contained (%d KB)" % (len(html) // 1024))
    print("\nALL CHECKS PASSED" if ok else "\nSOME CHECKS FAILED")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
