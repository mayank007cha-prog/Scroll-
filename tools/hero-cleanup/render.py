"""Render the cleaned film at normal speed. Every frame goes through the same chain:
landing / dot-render / stutter smoothing -> side cards hidden -> loading bar painted out -> phone rebuilt through the dissolve."""
import subprocess, sys, numpy as np, cv2
import split_fix, phone_fix
from bar_fill import remove_bar, BAR
from cards import remove_cards
dst = sys.argv[1]
def base(f):
    o = split_fix.fix(f)
    return split_fix.load(f) if o is None else o
def clean(f): return remove_bar(np.clip(remove_cards(base(f), f), 0, 255), f).astype(np.float32)
phone_fix.prepare(clean)
enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', '1280x720', '-r', '48', '-i', '-',
                        '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', dst], stdin=subprocess.PIPE)
touched = 0
for f in range(800):
    o = phone_fix.fix_phone(clean(f), f)
    im = np.clip(o + 0.5, 0, 255).astype(np.uint8)
    cv2.imwrite('out/%04d.png' % f, im)
    enc.stdin.write(im.tobytes())
enc.stdin.close(); enc.wait(); print('done')
