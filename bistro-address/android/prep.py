import sys, os, re, shutil
from PIL import Image, ImageDraw
repo, proj, fonts = sys.argv[1:4]

# ---- launcher icon: white map pin with a green bolt on Bistro green ----
def draw_fg(size, bg=None, round_mask=False):
    S = size * 4
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0) if bg is None else bg)
    d = ImageDraw.Draw(im)
    if bg is None:
        scale = 0.5        # adaptive foreground: keep art inside the 66% safe zone
    else:
        scale = 0.62
    cx, cy = S / 2, S / 2
    r = S * scale * 0.36
    top = cy - r * 1.25
    # pin: circle + triangle
    d.ellipse([cx - r, top, cx + r, top + 2 * r], fill='white')
    d.polygon([(cx - r * 0.82, top + r * 1.55), (cx + r * 0.82, top + r * 1.55), (cx, top + r * 2.75)], fill='white')
    # bolt inside the pin head
    k = r / 12
    oy = top + r - 12 * k
    bolt = [(13.5, 1), (4, 13.5), (11, 13.5), (9.5, 23), (20, 9.5), (13, 9.5), (14.5, 1)]
    d.polygon([(cx + (x - 12) * k, oy + y * k) for x, y in bolt], fill=(19, 162, 75, 255))
    im = im.resize((size, size), Image.LANCZOS)
    if round_mask:
        m = Image.new('L', (S, S), 0); ImageDraw.Draw(m).ellipse([0, 0, S - 1, S - 1], fill=255)
        im.putalpha(m.resize((size, size), Image.LANCZOS))
    return im

draw_fg(432).save(os.path.join(proj, 'res/drawable-xxxhdpi/ic_fg.png'))
for name, px in [('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)]:
    draw_fg(px, bg=(19, 162, 75, 255), round_mask=True).save(os.path.join(proj, f'res/mipmap-{name}/ic_launcher.png'))
draw_fg(512, bg=(19, 162, 75, 255), round_mask=True).save(os.path.join(os.path.dirname(proj), 'icon-preview.png'))

# ---- web assets ----
a = os.path.join(proj, 'assets')
for f in os.listdir(os.path.join(repo, 'assets')):
    shutil.copy(os.path.join(repo, 'assets', f), os.path.join(a, 'assets', f))
faces = []
for w in (400, 500, 600, 700, 800, 900):
    for style in ('normal', 'italic'):
        fn = f'figtree-latin-{w}-{style}.woff2'
        shutil.copy(os.path.join(fonts, fn), os.path.join(a, 'fonts', fn))
        faces.append(f"@font-face{{font-family:'Figtree';font-style:{style};font-weight:{w};font-display:block;src:url(fonts/{fn}) format('woff2')}}")

html = open(os.path.join(repo, 'index.html')).read()
html, n = re.subn(r'<link rel="preconnect"[^>]*>\n|<link href="https://fonts.googleapis.com[^>]*>\n', '', html)
assert n == 3, n
html = html.replace('<style>\n', '<style>\n  ' + '\n  '.join(faces) + '\n  body { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }\n', 1)
# Back-button bridge: the activity reads document.title and calls window.__back().
bridge = '''
  (function () {
    const home = $('#home');
    const report = () => {
      document.title = phone.classList.contains('sheet-open') ? 'sheet' : (!home.hidden ? 'home' : 'landing');
    };
    new MutationObserver(report).observe(phone, { attributes: true, attributeFilter: ['class'] });
    new MutationObserver(report).observe(home, { attributes: true, attributeFilter: ['hidden'] });
    report();
    window.__back = () => {
      if (phone.classList.contains('sheet-open')) { closeSheet(); return; }
      if (!home.hidden) {
        const prev = previousId && byId(previousId);
        selectAddress(prev && prev.eta == null ? prev.id : 'work', { silent: true });
      }
    };
  })();
</script>'''
assert html.count('  renderCarousel();\n</script>') == 1
html = html.replace('  renderCarousel();\n</script>', '  renderCarousel();\n' + bridge)
open(os.path.join(a, 'index.html'), 'w').write(html)
print('prepared', len(html), 'bytes html')
