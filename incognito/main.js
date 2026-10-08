(function () {
    'use strict';

    // ───────────────────────────── Setup ─────────────────────────────

    var app = document.querySelector('.App');
    var home = app.querySelector('.Home');
    var incognito = app.querySelector('.Incognito');
    var badge = app.querySelector('.Badge-icon');
    var menu = app.querySelector('.Menu');
    var menuButton = app.querySelector('[data-action="menu"]');
    var tabsCount = app.querySelector('.Tabs-count');

    var morphRoot = app.querySelector('.Morph-root');
    var reveal = app.querySelector('.Reveal');
    var discs = toArray(app.querySelectorAll('.Morph-disc'));
    var hat = app.querySelector('.Morph-hat');
    var brim = app.querySelector('.Morph-brim');
    var bridge = app.querySelector('.Morph-bridge');
    var rings = toArray(app.querySelectorAll('.Morph-ring'));

    var logoOs = toArray(home.querySelectorAll('.Logo-o'));
    var logoLetters = toArray(home.querySelectorAll('.Logo-letter'));
    var exitItems = toArray(home.querySelectorAll('[data-exit]'));
    var enterItems = toArray(incognito.querySelectorAll('[data-enter]'));

    var params = new URLSearchParams(location.search);
    var speed = Math.max(0.05, parseFloat(params.get('speed')) || 1);
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var busy = false;

    // Geometry of the finished badge, in the Figma frame's coordinates
    // (frame "5"). The morph layer draws in this space too, so the numbers
    // below are lifted straight from the design.
    var FIG = {
        box: { x: 659.5, y: 194, size: 121 },
        disc: { cx: 720, cy: 254.5, r: 60.5 },
        rings: [{ cx: 702.77, cy: 272.5 }, { cx: 737.23, cy: 272.5 }],
        ringR: 11.75,
        ringW: 3.5,
        bridgeCx: 719.75,
        brimCx: 720,
        hatDrop: 32
    };

    // ───────────────────────────── Easing ─────────────────────────────

    function bezier(x1, y1, x2, y2) {
        var cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
        var cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;

        function sampleX(t) { return ((ax * t + bx) * t + cx) * t; }
        function sampleY(t) { return ((ay * t + by) * t + cy) * t; }
        function slopeX(t) { return (3 * ax * t + 2 * bx) * t + cx; }

        return function (x) {
            if (x <= 0) return 0;
            if (x >= 1) return 1;

            var t = x, i, err, d;
            for (i = 0; i < 8; i++) {
                err = sampleX(t) - x;
                if (Math.abs(err) < 1e-6) return sampleY(t);
                d = slopeX(t);
                if (Math.abs(d) < 1e-6) break;
                t -= err / d;
            }

            var lo = 0, hi = 1;
            t = x;
            while (hi - lo > 1e-6) {
                if (sampleX(t) < x) lo = t; else hi = t;
                t = (lo + hi) / 2;
            }
            return sampleY(t);
        };
    }

    var ease = {
        // Material 3 "emphasized" — fast departure, long soft landing.
        emphasized: bezier(0.2, 0, 0, 1),
        // The "o" → lens morph: an unhurried start so the change reads as
        // a transformation rather than a jump, then a long soft landing.
        morph: bezier(0.5, 0, 0.1, 1),
        // Slightly later curve for the vertical axis of the ring travel,
        // so the "o"s glide on a gentle arc instead of a straight line.
        arc: bezier(0.6, 0, 0.1, 1),
        exit: bezier(0.4, 0, 0.6, 1),
        out: bezier(0.16, 1, 0.3, 1),
        settle: bezier(0.3, 1.35, 0.5, 1),
        linear: function (p) { return p; }
    };

    // ───────────────────────────── Timeline ─────────────────────────────

    // Runs a set of tracks on a single rAF clock. Each track is
    // { at, dur, ease, update(easedProgress) }; every track is applied at
    // progress 0 synchronously, so the first painted frame is already correct.
    function play(tracks) {
        return new Promise(function (resolve) {
            var scale = 1 / speed;
            var end = 0;

            tracks.forEach(function (track) {
                track.at *= scale;
                track.dur *= scale;
                track.last = 0;
                track.update(0);
                end = Math.max(end, track.at + track.dur);
            });

            var start = null;

            function frame(now) {
                if (start === null) start = now;
                // Frames are timed off the vsync timestamp, so a late frame
                // lands where it should rather than stuttering the motion.
                var t = now - start;

                tracks.forEach(function (track) {
                    var p = clamp((t - track.at) / track.dur, 0, 1);
                    if (p === track.last) return;
                    track.last = p;
                    track.update((track.ease || ease.linear)(p));
                });

                if (t < end) requestAnimationFrame(frame);
                else resolve();
            }

            // Pre-roll one frame: the first paint of the new state (layers
            // being promoted, the Incognito page rasterising) happens before
            // the clock starts, so it can never show up as a hitch.
            requestAnimationFrame(function () {
                requestAnimationFrame(frame);
            });
        });
    }

    function wait(ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms / speed); });
    }

    // ───────────────────────────── Measuring ─────────────────────────────

    var measureCanvas = document.createElement('canvas');
    var measureCtx = measureCanvas.getContext('2d', { willReadFrequently: true });

    // Finds where an "o" of the logo is actually inked: centre, outer radius
    // and stroke thickness. Uses the font's own metrics plus a raster scan, so
    // the ring drawn in the morph layer lands exactly on top of the glyph.
    function measureO(span) {
        var style = getComputedStyle(span);
        var size = parseFloat(style.fontSize);
        var font = style.fontStyle + ' ' + style.fontWeight + ' ' + size + 'px ' + style.fontFamily;
        var rect = relativeRect(span);

        measureCtx.font = font;
        var m = measureCtx.measureText('o');
        var inkLeft = -m.actualBoundingBoxLeft;
        var inkRight = m.actualBoundingBoxRight;
        var ascent = m.fontBoundingBoxAscent;
        var descent = m.fontBoundingBoxDescent;
        if (typeof ascent !== 'number') { ascent = size * 0.927; descent = size * 0.244; }

        // The box is centred on the font's content area (half-leading), so
        // this holds for inline and inline-block letters alike.
        var baseline = rect.top + (rect.height + ascent - descent) / 2;
        var cx = rect.left + (inkLeft + inkRight) / 2;
        var cy = baseline - (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
        var outer = (inkRight - inkLeft) / 2;

        return { cx: cx, cy: cy, outer: outer, stroke: measureStroke(font, size, m) || outer * 0.38 };
    }

    function measureStroke(font, size, metrics) {
        var s = 4;
        var w = Math.ceil(size * 1.2), h = Math.ceil(size * 1.4);
        measureCanvas.width = w * s;
        measureCanvas.height = h * s;
        measureCtx.setTransform(s, 0, 0, s, 0, 0);
        measureCtx.clearRect(0, 0, w, h);
        measureCtx.font = font;
        measureCtx.fillStyle = '#000';
        var baseline = size;
        measureCtx.fillText('o', size * 0.1, baseline);

        var y = Math.round((baseline - (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2) * s);
        var row = measureCtx.getImageData(0, y, w * s, 1).data;
        var inStart = -1;
        for (var x = 0; x < w * s; x++) {
            var on = row[x * 4 + 3] > 127;
            if (on && inStart < 0) inStart = x;
            if (!on && inStart >= 0) return (x - inStart) / s;
        }
        return 0;
    }

    // Rect relative to the app, in the app's own CSS pixels — the device
    // frame may be scaled down to fit the window.
    function relativeRect(el) {
        var a = app.getBoundingClientRect();
        var r = el.getBoundingClientRect();
        var s = a.width / app.offsetWidth || 1;
        return { left: (r.left - a.left) / s, top: (r.top - a.top) / s, width: r.width / s, height: r.height / s };
    }

    // Maps the Figma coordinate space onto the app, using the badge's resting
    // place on the Incognito page as the anchor.
    function badgeSpace() {
        var r = relativeRect(badge);
        var k = r.width / FIG.box.size;
        return {
            k: k,
            tx: r.left - FIG.box.x * k,
            ty: r.top - FIG.box.y * k,
            cx: r.left + r.width / 2,
            cy: r.top + r.height / 2
        };
    }

    // ───────────────────────────── Forward: Google → Incognito ─────────────────────────────

    // All layout reads happen here, ahead of time (on load, font load and
    // resize), so a tap starts the motion without forcing layout or a canvas
    // read-back on the critical frame.
    var geometry = null;

    function measure() {
        if (app.dataset.mode !== 'normal') return geometry;

        var space = badgeSpace();
        var from = logoOs.map(measureO).map(function (o) {
            return {
                cx: (o.cx - space.tx) / space.k,
                cy: (o.cy - space.ty) / space.k,
                r: (o.outer - o.stroke / 2) / space.k,
                w: o.stroke / space.k
            };
        });

        var aw = app.offsetWidth, ah = app.offsetHeight;
        var revealMax = Math.max(
            Math.hypot(space.cx, space.cy),
            Math.hypot(aw - space.cx, space.cy),
            Math.hypot(space.cx, ah - space.cy),
            Math.hypot(aw - space.cx, ah - space.cy)
        );

        // How far each piece of Incognito copy sits from the badge, so it can
        // fade in exactly as the reveal passes over it.
        function distanceTo(el) {
            var r = relativeRect(el);
            var dx = Math.max(r.left - space.cx, 0, space.cx - (r.left + r.width));
            var dy = Math.max(r.top - space.cy, 0, space.cy - (r.top + r.height));
            return Math.hypot(dx, dy);
        }
        var enterDistance = enterItems.map(distanceTo);
        // The Android toolbar sits above the badge; it turns Incognito (and
        // shows its address bar) as the reveal sweeps up into it.
        var toolbarDistance = distanceTo(app.querySelector('.Toolbar'));

        geometry = { space: space, from: from, revealMax: revealMax, enterDistance: enterDistance, toolbarDistance: toolbarDistance };
        return geometry;
    }

    var remeasureQueued = false;
    function invalidate() {
        if (remeasureQueued) return;
        remeasureQueued = true;
        requestAnimationFrame(function () {
            remeasureQueued = false;
            measure();
        });
    }

    function enterIncognito() {
        if (busy || app.dataset.mode !== 'normal') return;
        busy = true;

        closeMenu();
        incognito.scrollTop = 0;

        if (reduceMotion) return crossfadeTo('incognito');

        var g = geometry || measure();
        var space = g.space, from = g.from, revealMax = g.revealMax;

        morphRoot.setAttribute('transform', 'translate(' + space.tx + ' ' + space.ty + ') scale(' + space.k + ')');

        var tracks = [];

        // 1 · Everything except the two "o"s clears off the stage.
        var letterOrder = [1, 2, 0, 3]; // g, l, G, e — closest to the "o"s first
        logoLetters.forEach(function (letter, i) {
            tracks.push({
                at: letterOrder[i] * 24, dur: 240, ease: ease.exit,
                update: function (p) {
                    letter.style.opacity = 1 - p;
                    letter.style.transform = 'translate3d(0,' + lerp(0, 4, p) + 'px,0) scale(' + lerp(1, 0.86, p) + ')';
                }
            });
        });

        exitItems.forEach(function (el, i) {
            tracks.push({
                at: 10 + i * 16, dur: 240, ease: ease.exit,
                update: function (p) {
                    el.style.opacity = 1 - p;
                    el.style.transform = 'translate3d(0,' + lerp(0, 14, p) + 'px,0) scale(' + lerp(1, 0.97, p) + ')';
                }
            });
        });

        // 2 · The "o"s become the glasses: they slide together, lift, shrink
        //     and thin their stroke down to the icon's weight.
        rings.forEach(function (ring, i) {
            var f = from[i], t = FIG.rings[i];
            tracks.push({
                at: 40, dur: 520, ease: ease.morph,
                update: function (p) {
                    ring.setAttribute('cx', lerp(f.cx, t.cx, p));
                    ring.setAttribute('r', lerp(f.r, FIG.ringR, p));
                    ring.setAttribute('stroke-width', lerp(f.w, FIG.ringW, p));
                }
            });
            tracks.push({
                at: 40, dur: 520, ease: ease.arc,
                update: function (p) {
                    ring.setAttribute('cy', lerp(f.cy, t.cy, p));
                }
            });
        });

        // 3 · The bridge snaps in between the lenses.
        tracks.push({
            at: 420, dur: 200, ease: ease.out,
            update: function (p) {
                bridge.setAttribute('opacity', p > 0 ? 1 : 0);
                bridge.setAttribute('transform', scaleXAround(FIG.bridgeCx, p));
            }
        });

        // 4 · The hat line draws outward from the centre.
        tracks.push({
            at: 500, dur: 340, ease: ease.emphasized,
            update: function (p) {
                brim.setAttribute('opacity', p > 0 ? 1 : 0);
                brim.setAttribute('transform', scaleXAround(FIG.brimCx, p));
            }
        });

        // 5 · The hat rises out of the line and settles.
        tracks.push({
            at: 640, dur: 420, ease: ease.settle,
            update: function (p) {
                hat.setAttribute('transform', 'translate(0 ' + lerp(FIG.hatDrop, 0, p) + ')');
            }
        });

        // 6 · The grey disc blooms from the centre of the glyph, inverting it
        //     as it passes, and the Incognito page pours out from behind it.
        tracks.push({
            at: 860, dur: 480, ease: ease.emphasized,
            update: function (p) {
                var r = lerp(0, FIG.disc.r, p);
                discs.forEach(function (disc) { disc.setAttribute('r', r); });
            }
        });
        var REVEAL_AT = 1060, REVEAL_DUR = 640, revealEase = bezier(0.4, 0, 0.1, 1);
        var revealStart = space.k * FIG.disc.r * 0.8;
        function revealRadius(p) {
            return lerp(revealStart, revealMax, p);
        }

        reveal.style.width = reveal.style.height = (revealMax * 2) + 'px';
        reveal.style.left = (space.cx - revealMax) + 'px';
        reveal.style.top = (space.cy - revealMax) + 'px';
        tracks.push({
            at: REVEAL_AT, dur: REVEAL_DUR, ease: revealEase,
            update: function (p) {
                // A flat disc scaled on the compositor: no repaint per frame.
                // Starts tucked under the badge disc, so the page seems to
                // spill out from behind it.
                var s = p === 0 ? 0 : revealRadius(p) / revealMax;
                reveal.style.transform = 'scale(' + s + ')';
            }
        });
        tracks.push({
            // The toolbar recolours as the reveal sweeps down to it (CSS eases it).
            at: Math.max(REVEAL_AT, reachedAt(g.toolbarDistance) - 220), dur: 1, ease: ease.linear,
            update: function (p) {
                if (p < 1) return;
                app.classList.add('is-incognito-chrome');
                swapTabCount('1');
            }
        });

        // 7 · The page copy arrives.
        // Time at which the reveal edge has passed a given distance.
        function reachedAt(d) {
            for (var step = 0; step <= 60; step++) {
                if (revealRadius(revealEase(step / 60)) >= d) return REVEAL_AT + step / 60 * REVEAL_DUR;
            }
            return REVEAL_AT + REVEAL_DUR;
        }

        enterItems.forEach(function (el, i) {
            tracks.push({
                at: Math.max(REVEAL_AT + 80 + i * 40, reachedAt(g.enterDistance[i] + 24)), dur: 560, ease: ease.out,
                update: function (p) {
                    el.style.opacity = p;
                    el.style.transform = 'translate3d(0,' + lerp(16, 0, p) + 'px,0)';
                }
            });
        });

        app.dataset.mode = 'transition';

        play(tracks).then(function () {
            app.dataset.mode = 'incognito';
            clearStyle(reveal);
            enterItems.forEach(clearStyle);
            setPagesHidden(true);
            busy = false;
        });
    }

    // ───────────────────────────── Back: Incognito → Google ─────────────────────────────

    function exitIncognito() {
        if (busy || app.dataset.mode !== 'incognito') return;
        busy = true;

        if (reduceMotion) return crossfadeTo('normal');

        app.dataset.mode = 'returning';
        app.classList.remove('is-incognito-chrome');
        swapTabCount('3');

        var homeItems = logoLetters.concat(logoOs, exitItems);
        var tracks = [{
            at: 0, dur: 220, ease: ease.exit,
            update: function (p) {
                incognito.style.opacity = 1 - p;
                incognito.style.transform = 'translate3d(0,0,0) scale(' + lerp(1, 1.04, p) + ')';
            }
        }];

        homeItems.forEach(function (el, i) {
            tracks.push({
                at: 160 + i * 18, dur: 480, ease: ease.out,
                update: function (p) {
                    el.style.opacity = p;
                    el.style.transform = 'translate3d(0,' + lerp(10, 0, p) + 'px,0) scale(' + lerp(0.97, 1, p) + ')';
                }
            });
        });

        play(tracks).then(function () {
            app.dataset.mode = 'normal';
            homeItems.forEach(clearStyle);
            clearStyle(incognito);
            resetMorph();
            setPagesHidden(false);
            busy = false;
            invalidate();
        });
    }

    function crossfadeTo(mode) {
        var showIncognito = mode === 'incognito';
        app.dataset.mode = showIncognito ? 'transition' : 'returning';
        app.classList.toggle('is-incognito-chrome', showIncognito);
        swapTabCount(showIncognito ? '1' : '3');
        badge.style.visibility = 'visible';

        play([{
            at: 0, dur: 220, ease: ease.linear,
            update: function (p) {
                incognito.style.opacity = showIncognito ? p : 1 - p;
            }
        }]).then(function () {
            app.dataset.mode = mode;
            clearStyle(incognito);
            clearStyle(badge);
            setPagesHidden(showIncognito);
            busy = false;
        });
    }

    function resetMorph() {
        [bridge, brim].forEach(function (el) { el.setAttribute('opacity', 0); });
        discs.forEach(function (disc) { disc.setAttribute('r', 0); });
        hat.setAttribute('transform', 'translate(0 ' + FIG.hatDrop + ')');
    }

    function setPagesHidden(isIncognito) {
        incognito.setAttribute('aria-hidden', String(!isIncognito));
        home.setAttribute('aria-hidden', String(isIncognito));
    }

    function swapTabCount(value) {
        if (tabsCount.textContent === value) return;
        tabsCount.textContent = value;
        if (tabsCount.animate && !reduceMotion) {
            tabsCount.animate([
                { opacity: 0, transform: 'translateY(4px) scale(.7)' },
                { opacity: 1, transform: 'none' }
            ], { duration: 320 / speed, easing: 'cubic-bezier(.2, 0, 0, 1)' });
        }
    }

    // ───────────────────────────── Menu ─────────────────────────────

    function openMenu() {
        menu.classList.add('is-open');
        menuButton.setAttribute('aria-expanded', 'true');
        var first = menu.querySelector('[data-action="incognito"]');
        if (first) first.focus({ preventScroll: true });
    }

    function closeMenu() {
        menu.classList.remove('is-open');
        menuButton.setAttribute('aria-expanded', 'false');
    }

    app.addEventListener('click', function (event) {
        var target = event.target.closest('[data-action]');
        var action = target && target.getAttribute('data-action');

        if (action !== 'menu' && !event.target.closest('.Menu')) closeMenu();
        if (!action) return;

        event.preventDefault();

        switch (action) {
            case 'menu':
                if (busy) return;
                menu.classList.contains('is-open') ? closeMenu() : openMenu();
                break;
            case 'incognito':
                if (busy || app.dataset.mode !== 'normal') return closeMenu();
                // Let the press state register before the stage clears.
                target.classList.add('is-pressed');
                closeMenu();
                wait(60).then(function () {
                    target.classList.remove('is-pressed');
                    enterIncognito();
                });
                break;
            case 'tabs':
                exitIncognito();
                break;
            case 'newtab':
                closeMenu();
                exitIncognito();
                break;
            case 'close':
                closeMenu();
                break;
        }
    });

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') closeMenu();
    });

    // ───────────────────────────── Helpers ─────────────────────────────

    function scaleXAround(cx, s) {
        return 'translate(' + cx + ' 0) scale(' + Math.max(s, 0.0001) + ' 1) translate(' + (-cx) + ' 0)';
    }

    function lerp(a, b, p) {
        return a + (b - a) * p;
    }

    function clamp(v, min, max) {
        return v < min ? min : v > max ? max : v;
    }

    function clearStyle(el) {
        el.removeAttribute('style');
    }

    function toArray(list) {
        return Array.prototype.slice.call(list);
    }

    resetMorph();

    (document.fonts ? document.fonts.ready : Promise.resolve()).then(measure);
    if (document.fonts) document.fonts.addEventListener('loadingdone', invalidate);
    window.addEventListener('resize', invalidate);

    if (params.has('autoplay')) {
        (document.fonts ? document.fonts.ready : Promise.resolve()).then(function () {
            setTimeout(enterIncognito, 700);
        });
    }
})();
