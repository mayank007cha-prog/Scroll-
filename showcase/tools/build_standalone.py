"""Bundles the showcase into one self-contained HTML file.

    python3 showcase/tools/build_standalone.py

Writes showcase/keyboard-showcase.html: index.html with style.css,
main.js and every asset inlined (images as data URIs), so
it opens straight from disk or any host with no other files. Only the
Archivo web font is still fetched from Google Fonts (system fallback
offline).
"""
import base64
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "keyboard-showcase.html"
MIME = {".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml"}


def data_uri(rel):
    path = ROOT / rel
    return f"data:{MIME[path.suffix]};base64," + base64.b64encode(path.read_bytes()).decode()


def inline_assets(text):
    return re.sub(r"assets/[\w@.-]+\.(?:webp|png|svg)", lambda m: data_uri(m.group(0)), text)


def main():
    html = (ROOT / "index.html").read_text()
    css = (ROOT / "style.css").read_text()
    js = (ROOT / "main.js").read_text()

    # Each keyboard image is used three times (img + two masks). Set the mask
    # once per board as an inherited CSS variable instead of repeating the
    # data, keyed on a data attribute (boards move between layers at runtime).
    boards = re.findall(r'<img src="(assets/kb-[\w-]+\.webp)"', html)
    html = re.sub(r' style="--kb: url\(assets/kb-[\w-]+\.webp\)"', "", html)
    for i in range(len(boards)):
        html = html.replace('<div class="kb-board" data-w', f'<div class="kb-board" data-i="{i}" data-w', 1)
    css += "\n/* Standalone build: one mask image per board. */\n" + "".join(
        f'.kb-board[data-i="{i}"] {{ --kb: url({src}); }}\n' for i, src in enumerate(boards)
    )

    # Embed each background once. The scene photos pick 1x/2x by pixel
    # density (src is the 1x candidate); the hand overlay reuses the same
    # strings at load instead of carrying its own copies.
    html = re.sub(r'\s*<link rel="preload"[^>]*>', "", html)
    html = re.sub(r' srcset="assets/(bg-[\w-]+)\.webp 2048w, assets/[\w@.-]+ 4096w" sizes="[^"]*"',
                  r' srcset="assets/\1@2x.webp 2x"', html)
    for cls in ("kb-hands", "kb-screen"):
        block = re.search(r'<div class="' + cls + r'"[^>]*>(.*?)</div>', html, re.S)
        stripped = re.sub(r'<img class="kb-bg" [^>]*>', '<img class="kb-bg" alt="" decoding="async">', block.group(1))
        html = html[:block.start(1)] + stripped + html[block.end(1):]  # this block only
    copy_js = ("<script>(function(){var s=document.querySelectorAll('.kb-env .kb-bg'),"
               "d=document.querySelectorAll('.kb-hands .kb-bg, .kb-screen .kb-bg');"
               "for(var i=0;i<d.length;i++){var o=s[i%s.length];d[i].srcset=o.getAttribute('srcset');d[i].src=o.getAttribute('src');}})();"
               "</script>\n  ")
    # Mask images are referenced twice (-webkit- and standard): embed once.
    shared = sorted(set(re.findall(r"url\((assets/[\w@.-]+\.(?:png|svg))\)", css)))
    for i, src in enumerate(shared):
        css = css.replace(f"url({src})", f"var(--asset-{i})")
    css = ":root {\n" + "".join(f"  --asset-{i}: url({src});\n" for i, src in enumerate(shared)) + "}\n" + css
    html = html.replace('<link rel="stylesheet" href="style.css">', "<style>\n" + inline_assets(css) + "\n</style>")
    html = html.replace('<script src="main.js"></script>', copy_js + "<script>\n" + js + "\n</script>")
    html = inline_assets(html)

    leftover = re.findall(r'(?:src|href)="(?!https?:|data:|#)[^"]+"', html)
    assert not leftover, f"unbundled references: {leftover}"
    OUT.write_text(html)
    print(f"{OUT.relative_to(ROOT.parent)}  {OUT.stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
