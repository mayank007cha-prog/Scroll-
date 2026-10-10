#!/usr/bin/env python3
"""Builds incognito-android.html: index.html with its CSS, JS, the Discover
image and the Google Sans font all inlined, so the prototype is one file that
works offline (and inside the Android app's WebView).

    python3 build_standalone.py
"""

import base64
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))


def read(name, mode='r'):
    with open(os.path.join(HERE, name), mode) as f:
        return f.read()


def data_uri(name, mime):
    return 'data:%s;base64,%s' % (mime, base64.b64encode(read(name, 'rb')).decode())


page = read('index.html')

page = page.replace('    <link rel="stylesheet" href="styles.css">\n',
                    '    <style>\n' + read('styles.css') + '    </style>\n')
page = page.replace('<script src="main.js"></script>', '<script>\n' + read('main.js') + '</script>')

assert 'src="assets/discover-story.jpg"' in page
page = page.replace('src="assets/discover-story.jpg"', 'src="%s"' % data_uri('assets/discover-story.jpg', 'image/jpeg'))

# Embed Google Sans (variable, latin subset) so the page renders the same
# offline or inside a file viewer that blocks web fonts.
page = re.sub(r'    <link rel="preconnect"[^\n]*\n', '', page)
page = re.sub(r'    <link rel="stylesheet" href="https://fonts\.googleapis\.com[^\n]*\n', '', page)
font_face = """    <style>
@font-face {
    font-family: 'Google Sans';
    font-style: normal;
    font-weight: 100 900;
    font-display: block;
    src: url(%s) format('woff2');
}
    </style>
""" % data_uri('assets/google-sans-latin.woff2', 'font/woff2')
page = page.replace('    <style>\n', font_face + '    <style>\n', 1)

with open(os.path.join(HERE, 'incognito-android.html'), 'w') as f:
    f.write(page)
print('built incognito-android.html', len(page), 'bytes')
