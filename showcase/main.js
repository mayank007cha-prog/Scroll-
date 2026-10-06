(function () {
  'use strict';

  // Photo pixel space (all three environment shots share it).
  var IMG_W = 2048;
  var IMG_H = 1144;

  // Where a board rests on the mat, between the hands (from the Figma frames).
  var REST_X = 1061;
  var REST_Y = 934;

  // Waiting board: set down on the desk at the left, smaller and dimmed.
  var PEEK_DX = -821;
  var PEEK_DY = 22;
  var PEEK_SCALE = 0.6;
  // Finished board: lifted away to the right, off the frame.
  var EXIT_DX = 1560;
  // While travelling, a board is lifted toward the camera, over the hands.
  var LIFT_Y = 78;
  var LIFT_SCALE = 0.07;

  var ACCENTS = [
    [255, 122, 56],  // ember
    [70, 170, 255],  // frost
    [168, 120, 255]  // prism
  ];

  // Lowest point of a resting board incl. contact shadow, in photo px, and the
  // breathing room to keep between it and the dock.
  var BOARD_BOTTOM = 1034;
  var DOCK_GAP = 28;

  var section = document.getElementById('showcase');
  var sticky = section.querySelector('.kb-sticky');
  var scene = document.getElementById('scene');
  var layerRest = document.getElementById('layer-rest');
  var layerMove = document.getElementById('layer-move');
  var boards = [].slice.call(scene.querySelectorAll('.kb-board'));
  var envLayers = [].slice.call(scene.querySelectorAll('.kb-env .kb-bg'));
  var handLayers = [].slice.call(scene.querySelectorAll('.kb-hands .kb-bg'));
  var products = [].slice.call(document.querySelectorAll('.kb-product'));
  var ticks = [].slice.call(document.querySelectorAll('.kb-rail button'));
  var cta = document.getElementById('cta');
  var dock = document.querySelector('.kb-dock');
  var nextBtn = document.getElementById('next');
  var nextName = nextBtn.querySelector('.kb-next-name');
  var root = document.documentElement;
  var count = boards.length;
  var names = products.map(function (p) { return p.querySelector('strong').textContent; });

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var k = 1;           // photo px → CSS px
  var current = 0;     // rendered position (0 … count-1)
  var target = 0;      // position the scroll asks for
  var activeIndex = -1;
  var lastTime = 0;
  var running = false;

  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  function smoothstep(v) {
    v = clamp(v, 0, 1);
    return v * v * (3 - 2 * v);
  }

  // Quintic ease (zero 1st and 2nd derivative at both ends): no visible
  // start or stop in the environment dissolve.
  function smootherstep(v) {
    v = clamp(v, 0, 1);
    return v * v * v * (v * (v * 6 - 15) + 10);
  }

  // Environment blend across a board change: spread over most of the move.
  function envMix(f) {
    return smootherstep((f - 0.08) / 0.84);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // ---------- Smooth scroll (Lenis) with fallback to native ----------

  var lenis = null;
  if (window.Lenis && !reduceMotion) {
    lenis = new window.Lenis({
      lerp: 0.085,
      wheelMultiplier: 0.9,
      smoothWheel: true,
      syncTouch: false
    });
    (function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    })(performance.now());
  }

  function scrollY() {
    return lenis ? lenis.scroll : window.pageYOffset;
  }

  function scrollToY(y, slow) {
    if (lenis) {
      lenis.scrollTo(y, {
        duration: slow ? 1.6 : 1.15,
        easing: function (t) { return 1 - Math.pow(1 - t, 4); },
        onComplete: function () { snapping = false; }
      });
    } else {
      window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
      snapping = false;
    }
  }

  // ---------- Layout: cover-fit the photo, framed on the keyboard ----------

  boards.forEach(function (board) {
    var img = board.querySelector('img');
    var w = parseFloat(board.getAttribute('data-w'));
    function place() {
      var h = w * (img.naturalHeight / img.naturalWidth || 0.255);
      board.style.width = (w / IMG_W) * 100 + '%';
      board.style.left = ((REST_X - w / 2) / IMG_W) * 100 + '%';
      board.style.top = ((REST_Y - h / 2) / IMG_H) * 100 + '%';
    }
    if (img.complete) place();
    img.addEventListener('load', place);
  });

  function layout() {
    var vw = sticky.clientWidth;
    var vh = sticky.clientHeight;
    var sx, sy;

    if (vw / vh > 1) {
      // Landscape: cover the viewport, centred.
      k = Math.max(vw / IMG_W, vh / IMG_H);
      sx = (vw - IMG_W * k) / 2;
      sy = (vh - IMG_H * k) / 2;
    } else {
      // Portrait: keep the keyboard ~75% of the width and centre on it,
      // leaving room for the headline above and the dock below.
      k = (vw * 2.2) / IMG_W;
      sx = vw / 2 - REST_X * k;
      sy = vh * 0.58 - REST_Y * k;
    }

    // Lift the frame so the resting board (and its contact shadow) always
    // clears the floating dock. Any strip this opens at the bottom is
    // feathered into the night by the scene's mask.
    var dockTop = dock.getBoundingClientRect().top - sticky.getBoundingClientRect().top;
    var limit = dockTop - DOCK_GAP;
    var boardBottom = sy + BOARD_BOTTOM * k;
    if (boardBottom > limit) sy -= boardBottom - limit;

    scene.style.setProperty('--sw', IMG_W * k + 'px');
    scene.style.setProperty('--sh', IMG_H * k + 'px');
    scene.style.setProperty('--sx', sx + 'px');
    scene.style.setProperty('--sy', sy + 'px');
    // 1em = 40 photo px, for blur/offsets inside the scene.
    scene.style.fontSize = 40 * k + 'px';
  }

  // ---------- Scroll → position ----------

  function track() {
    var distance = section.offsetHeight - sticky.clientHeight;
    var top = section.getBoundingClientRect().top + window.pageYOffset;
    return { top: top, distance: distance };
  }

  // Each board change gets an equal slice of the scroll, with a short hold at
  // either end so a board settles before the next one lifts.
  function readScroll() {
    var t = track();
    var u = t.distance > 0 ? clamp((scrollY() - t.top) / t.distance, 0, 1) : 0;
    var q = u * (count - 1);
    var i = Math.min(Math.floor(q), count - 2);
    return i + smoothstep((q - i - 0.1) / 0.8);
  }

  function restY(i) {
    var t = track();
    return t.top + (t.distance * i) / (count - 1);
  }

  function goTo(i) {
    settledIndex = i;
    snapping = true;
    scrollToY(restY(i), true);
  }

  // Snap: once scrolling settles inside the pinned range, glide on to the
  // board you were heading for, so each one lands exactly in its place. A
  // nudge of ~12% of a step is enough to commit to the next board.
  var snapping = false;
  var idleTimer = 0;
  var settledIndex = 0;
  var COMMIT = 0.12;

  function maybeSnap() {
    if (snapping || reduceMotion) return;
    // Wait until the wheel's own easing has finished, or it would override
    // the snap mid-way.
    if (lenis && lenis.isScrolling) {
      idleTimer = setTimeout(maybeSnap, 80);
      return;
    }
    var t = track();
    var y = scrollY();
    if (y < t.top - 2 || y > t.top + t.distance + 2) return;
    var q = clamp((y - t.top) / t.distance, 0, 1) * (count - 1);
    var dest;
    if (q > settledIndex + COMMIT) dest = Math.ceil(q - COMMIT);
    else if (q < settledIndex - COMMIT) dest = Math.floor(q + COMMIT);
    else dest = settledIndex;
    dest = clamp(dest, 0, count - 1);
    settledIndex = dest;
    if (Math.abs(restY(dest) - y) < 2) return;
    snapping = true;
    scrollToY(restY(dest), false);
  }

  // Fresh input takes over from an in-flight snap (Lenis retargets on its
  // own), so clear the flag or the interrupted snap would block later ones.
  function onInput() {
    snapping = false;
  }
  window.addEventListener('wheel', onInput, { passive: true });
  window.addEventListener('touchstart', onInput, { passive: true });
  window.addEventListener('keydown', onInput);

  function onScroll() {
    kick();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(maybeSnap, lenis ? 140 : 220);
  }

  // ---------- Render ----------

  function poseFor(t) {
    // t = 0 at rest, +1 waiting on the left, -1 gone to the right.
    var a = Math.abs(t);
    var near = clamp(a, 0, 1);
    var far = clamp(a - 1, 0, 1.5);
    var lift = Math.sin(Math.PI * near);
    var x, y, s, o, dim;

    if (t >= 0) {
      x = PEEK_DX * near - 900 * far;
      y = PEEK_DY * near;
      s = lerp(1, PEEK_SCALE, near) - 0.1 * far;
      o = 1 - clamp(far * 1.6, 0, 1);
      dim = smoothstep(near);
    } else {
      x = EXIT_DX * near;
      y = PEEK_DY * near;
      s = lerp(1, PEEK_SCALE + 0.1, near);
      o = 1 - smoothstep((near - 0.6) / 0.4);
      dim = smoothstep(near) * 0.6;
    }

    y -= lift * LIFT_Y;
    s *= 1 + lift * LIFT_SCALE;
    return { x: x, y: y, s: s, o: o, lift: lift, dim: dim };
  }

  function render(p) {
    var i, t, pose, board, d, w;

    for (i = 0; i < count; i++) {
      board = boards[i];
      t = i - p;
      pose = poseFor(t);
      board.style.transform =
        'translate3d(' + (pose.x * k).toFixed(2) + 'px,' + (pose.y * k).toFixed(2) + 'px,0) scale(' + pose.s.toFixed(4) + ')';
      board.style.opacity = pose.o.toFixed(3);
      board.style.visibility = pose.o < 0.01 ? 'hidden' : 'visible';
      board.style.setProperty('--lift', pose.lift.toFixed(3));
      board.style.setProperty('--bright', (1 - pose.dim * 0.42).toFixed(3));
      board.style.setProperty('--sat', (1 - pose.dim * 0.35).toFixed(3));

      // A board at rest sits under the fingertips; anything in motion (or
      // waiting at the side) is lifted above the hands.
      var layer = Math.abs(t) < 0.02 ? layerRest : layerMove;
      if (board.parentNode !== layer) layer.appendChild(board);
      board.classList.toggle('is-peek', Math.abs(t - 1) < 0.02);

      // One specular pass as the board comes down into place.
      var settle = clamp(1 - Math.abs(t) * 1.6, 0, 1);
      board.style.setProperty('--sheen', (Math.sin(Math.PI * settle) * 0.8).toFixed(3));
      board.style.setProperty('--sheen-x', (t > 0 ? lerp(150, -50, settle) : lerp(-50, 150, settle)).toFixed(1) + '%');
    }

    // Environment: each photo dissolves in across almost the whole change.
    for (i = 1; i < count; i++) {
      w = envMix(p - (i - 1));
      envLayers[i].style.opacity = w.toFixed(3);
      handLayers[i].style.opacity = w.toFixed(3);
    }

    var base = Math.min(Math.floor(p), count - 2);
    var mix = envMix(p - base);
    var a = ACCENTS[base];
    var b = ACCENTS[base + 1];
    root.style.setProperty('--accent-rgb',
      Math.round(lerp(a[0], b[0], mix)) + ' ' +
      Math.round(lerp(a[1], b[1], mix)) + ' ' +
      Math.round(lerp(a[2], b[2], mix)));

    // In motion: key-light dims, mist gathers around the hands.
    var travel = Math.sin(Math.PI * (p - Math.floor(p)));
    scene.style.setProperty('--spot', (1 - travel * 0.5).toFixed(3));
    scene.style.setProperty('--mist', (0.6 + travel * 0.4).toFixed(3));

    // Product line in the dock: cross-fade with a short vertical drift.
    for (i = 0; i < count; i++) {
      d = p - i;
      // Sequenced hand-off around the midpoint: the old name rolls out just
      // before the new one rolls in, so they never overlap.
      var o = 1 - smoothstep((Math.abs(d) - 0.3) / 0.2);
      products[i].style.opacity = o.toFixed(3);
      products[i].style.transform = 'translate3d(0,' + (-clamp(d, -0.6, 0.6) * 30).toFixed(2) + 'px,0)';
      products[i].style.visibility = o < 0.01 ? 'hidden' : 'visible';
      ticks[i].querySelector('span').style.setProperty('--on', (1 - smoothstep(Math.abs(p - i))).toFixed(3));
    }

    // "Next" tag over the waiting board, only while things are at rest.
    var rest = 1 - smoothstep(Math.abs(p - Math.round(p)) / 0.12);
    var hasNext = Math.round(p) < count - 1;
    var nextO = hasNext ? rest : 0;
    scene.style.setProperty('--next', nextO.toFixed(3));
    scene.style.setProperty('--next-vis', nextO < 0.01 ? 'hidden' : 'visible');

    var nextActive = Math.round(p);
    if (nextActive !== activeIndex) {
      activeIndex = nextActive;
      cta.href = products[activeIndex].getAttribute('data-href');
      cta.setAttribute('aria-label', 'Shop ' + names[activeIndex] + ' on Meckeys');
      if (activeIndex < count - 1) nextName.textContent = names[activeIndex + 1];
      for (i = 0; i < count; i++) {
        var on = i === activeIndex;
        products[i].setAttribute('aria-hidden', on ? 'false' : 'true');
        if (on) ticks[i].setAttribute('aria-current', 'true');
        else ticks[i].removeAttribute('aria-current');
      }
    }
  }

  // ---------- Loop: ease towards the scroll position ----------

  function frame(now) {
    var dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 1 / 60;
    lastTime = now;

    if (reduceMotion) {
      current = target;
    } else {
      // Lenis already smooths the scroll; this adds a light, frame-rate
      // independent follow so the boards glide rather than track 1:1.
      current += (target - current) * (1 - Math.exp(-dt * (lenis ? 9 : 5.5)));
    }

    if (Math.abs(target - current) < 0.0004) current = target;
    render(current);

    if (current !== target) {
      requestAnimationFrame(frame);
    } else {
      running = false;
      lastTime = 0;
    }
  }

  function kick() {
    target = readScroll();
    if (!running) {
      running = true;
      requestAnimationFrame(frame);
    }
  }

  ticks.forEach(function (btn, i) {
    btn.addEventListener('click', function () { goTo(i); });
  });
  nextBtn.addEventListener('click', function () { goTo(Math.min(activeIndex + 1, count - 1)); });
  boards.forEach(function (board, i) {
    board.addEventListener('click', function () {
      if (board.classList.contains('is-peek')) goTo(i);
    });
  });

  if (lenis) lenis.on('scroll', onScroll);
  else window.addEventListener('scroll', onScroll, { passive: true });

  window.addEventListener('resize', function () {
    layout();
    render(current);
    kick();
  });

  layout();
  current = target = readScroll();
  settledIndex = Math.round(current);
  render(current);

  // Reveal once the first environment + board are decoded.
  var first = [envLayers[0], boards[0].querySelector('img')];
  Promise.all(first.map(function (img) {
    return img.decode ? img.decode().catch(function () {}) : Promise.resolve();
  })).then(function () {
    document.body.classList.add('is-ready');
  });
})();
