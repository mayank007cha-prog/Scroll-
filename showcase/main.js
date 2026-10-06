(function () {
  'use strict';

  // Photo pixel space (all three environment shots share it).
  var IMG_W = 2048;
  var IMG_H = 1144;

  // Where a board rests on the mat, between the hands (from the Figma frames).
  var REST_X = 1061;
  var REST_Y = 934;

  // Waiting board: set down on the desk at the left, smaller and dimmed.
  var PEEK_DX = -846;
  var PEEK_DY = 22;
  var PEEK_SCALE = 0.48;
  // Previous board: set down on the right of the desk, between the right
  // hand and the PC case, smaller and dimmed (mirrors the waiting board).
  var PREV_DX = 826;
  var PREV_DY = -9;
  var PREV_SCALE = 0.46;
  // While travelling, a board is lifted toward the camera, over the hands.
  var LIFT_Y = 44;
  var LIFT_SCALE = 0.035;

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
  var railEl = document.querySelector('.kb-rail');
  var root = document.documentElement;
  var count = boards.length;
  var names = products.map(function (p) { return p.querySelector('strong').textContent; });

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointerDevice = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var finePointer = finePointerDevice && !reduceMotion;

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

  // ---------- Scrolling: native, with a directional settle ----------

  // The page scrolls natively (wheel, trackpad, touch momentum all feel
  // normal). When a scroll comes to rest between boards, it eases on to the
  // next board in the direction you were scrolling, so a short scroll is
  // enough to change keyboards. Nothing intercepts or holds input.
  function scrollY() {
    return window.pageYOffset;
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
      // Capped by height so tablets in portrait see more of the room.
      k = Math.min(vw * 2.2, vh * 1.15) / IMG_W;
      sx = vw / 2 - REST_X * k;
      sy = vh * 0.58 - REST_Y * k;
    }

    if (vw / vh <= 1) {
      // Portrait: the progress rail and product details sit right under the
      // keyboard. Lift the scene only if the group would run off the screen.
      var railH = railEl.offsetHeight;
      var below = 2 + railH + 10 + 18 + dock.offsetHeight + 28;
      // Settle the group so the details end ~10% above the bottom edge.
      var bottomNow = sy + BOARD_BOTTOM * k;
      sy += vh * 0.9 - (bottomNow + below - 28);
      bottomNow = sy + BOARD_BOTTOM * k;
      if (bottomNow + below > vh) sy -= bottomNow + below - vh;
      var top = sy + BOARD_BOTTOM * k + 2 + railH + 10;
      sticky.style.setProperty('--dock-top', top + 'px');
      sticky.classList.add('is-portrait');
      scene.style.setProperty('--sw', IMG_W * k + 'px');
      scene.style.setProperty('--sh', IMG_H * k + 'px');
      scene.style.setProperty('--sx', sx + 'px');
      scene.style.setProperty('--sy', sy + 'px');
      scene.style.fontSize = 40 * k + 'px';
      return;
    }
    sticky.classList.remove('is-portrait');

    // Landscape: lift the frame so the resting board (and its contact
    // shadow) always clears the floating dock. Any strip this opens at the
    // bottom is feathered into the night by the scene's mask.
    var dockTop = dock.getBoundingClientRect().top - sticky.getBoundingClientRect().top;
    // The progress rail sits just above the dock.
    sticky.style.setProperty('--dock-top', dockTop + 'px');
    // Keep the resting board clear of the dock and the progress rail above it.
    var limit = dockTop - DOCK_GAP - railEl.offsetHeight;
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

  // Board position follows the scroll linearly; the easing lives in the
  // glide, so the motion has no sudden start or stop.
  function readScroll() {
    var t = track();
    var u = t.distance > 0 ? clamp((scrollY() - t.top) / t.distance, 0, 1) : 0;
    return u * (count - 1);
  }

  function restY(i) {
    var t = track();
    return t.top + (t.distance * i) / (count - 1);
  }

  function nearestIndex() {
    var t = track();
    return Math.round(clamp((scrollY() - t.top) / t.distance, 0, 1) * (count - 1));
  }

  var settledIndex = 0;
  var touching = false;
  var settleTimer = 0;
  var COMMIT = 0.04; // fraction of a step that counts as "meant to move"

  // While our own glide runs, the settle stands down (slow frames can leave
  // gaps between scroll events that look like "stopped"). Any new wheel,
  // touch or key input hands control straight back to the reader.
  //
  // The glide is our own eased animation (the browser's built-in smooth
  // scroll is short and abrupt): a slow ease-in-out, scaled a little with
  // distance, so boards are set down gently.
  var gliding = false;
  var glideRaf = 0;

  function endGlide() {
    gliding = false;
    cancelAnimationFrame(glideRaf);
  }

  function easeInOutSine(t) {
    return -(Math.cos(Math.PI * t) - 1) / 2;
  }

  function goTo(i) {
    settledIndex = clamp(i, 0, count - 1);
    var to = restY(settledIndex);
    var from = scrollY();
    endGlide();
    if (reduceMotion || Math.abs(to - from) < 1) {
      window.scrollTo(0, to);
      return;
    }
    var t = track();
    var steps = Math.abs(to - from) / (t.distance / (count - 1));
    var duration = 1100 + 450 * Math.min(steps, 2);
    var start = performance.now();
    gliding = true;
    (function step(now) {
      var p = clamp((now - start) / duration, 0, 1);
      window.scrollTo(0, from + (to - from) * easeInOutSine(p));
      if (p < 1) glideRaf = requestAnimationFrame(step);
      else gliding = false;
    })(start);
  }

  window.addEventListener('wheel', endGlide, { passive: true });
  window.addEventListener('keydown', endGlide);

  function settle() {
    if (touching || gliding) return;
    var t = track();
    var y = scrollY();
    if (y < t.top - 2 || y > t.top + t.distance + 2) return;
    var q = clamp((y - t.top) / t.distance, 0, 1) * (count - 1);
    var dest = settledIndex;
    if (q > settledIndex + COMMIT) dest = Math.ceil(q - COMMIT);
    else if (q < settledIndex - COMMIT) dest = Math.floor(q + COMMIT);
    if (Math.abs(restY(dest) - y) < 1.5) { settledIndex = dest; return; }
    goTo(dest);
  }

  window.addEventListener('touchstart', function () { touching = true; endGlide(); }, { passive: true });
  window.addEventListener('touchend', function () {
    touching = false;
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settle, 140);
  }, { passive: true });

  // Keyboard: arrows / Page keys step one board at a time while the
  // showcase is on screen.
  var NEXT_KEYS = { ArrowRight: 1, ArrowDown: 1, PageDown: 1, ' ': 1 };
  var PREV_KEYS = { ArrowLeft: 1, ArrowUp: 1, PageUp: 1 };
  window.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented) return;
    if (e.target && /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(e.target.tagName) && e.key === ' ') return;
    var dir = NEXT_KEYS[e.key] ? 1 : PREV_KEYS[e.key] ? -1 : 0;
    if (!dir) return;
    var dest = settledIndex + dir;
    if (dest < 0 || dest > count - 1) return;
    e.preventDefault();
    goTo(dest);
  });

  function onScroll() {
    kick();
    // Settle once the scroll (including momentum) has stopped.
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settle, 130);
  }

  // ---------- Render ----------

  function poseFor(t) {
    // t = 0 at rest, +1 waiting on the left, -1 just passed (on the right).
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
      x = PREV_DX * near + 900 * far;
      y = PREV_DY * near;
      s = lerp(1, PREV_SCALE, near) - 0.1 * far;
      o = 1 - clamp(far * 1.6, 0, 1);
      dim = smoothstep(near);
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
      board.classList.toggle('is-peek', Math.abs(Math.abs(t) - 1) < 0.02);

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


    var nextActive = Math.round(p);
    if (nextActive !== activeIndex) {
      activeIndex = nextActive;
      cta.href = products[activeIndex].getAttribute('data-href');
      cta.setAttribute('aria-label', 'Shop ' + names[activeIndex] + ' on Meckeys');
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
      // A light, frame-rate independent follow, so the boards glide rather
      // than track the scroll position 1:1.
      current += (target - current) * (1 - Math.exp(-dt * 5.5));
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
  boards.forEach(function (board, i) {
    board.addEventListener('click', function () {
      if (board.classList.contains('is-peek')) goTo(i);
    });
  });

  window.addEventListener('scroll', onScroll, { passive: true });

  // Lock the stage height. Touch browsers change the viewport height as
  // their toolbars slide in and out while scrolling; following that would
  // re-frame the scene mid-scroll. So on touch devices the height is only
  // re-measured when the width changes (rotation); with a mouse it follows
  // the window.
  var lockedW = 0;
  var lockedH = 0;
  function lockStage() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    if (!lockedW || w !== lockedW || (finePointerDevice && h !== lockedH)) {
      lockedW = w;
      lockedH = h;
      root.style.setProperty('--stage-h', h + 'px');
      return true;
    }
    return false;
  }

  window.addEventListener('resize', function () {
    if (!lockStage()) return;
    layout();
    render(current);
    kick();
  });

  // ---------- Keyboard wiggle (mouse only) ----------

  // The frame stays still; only the centre board leans toward the cursor on
  // an under-damped spring, so it sways a little and settles.
  if (finePointer) {
    var aim = { x: 0, y: 0 };
    var lean = { a: 0, v: 0, y: 0, vy: 0 };
    var wiggleRunning = false;
    var lastWiggle = 0;

    var wiggleFrame = function (now) {
      var dt = lastWiggle ? Math.min((now - lastWiggle) / 1000, 0.05) : 1 / 60;
      lastWiggle = now;

      // Springs for the lean, driven by the raw pointer so a move gives a
      // soft overshoot and settle (stiffness 70, damping 7: ratio ~0.4).
      lean.v += (-70 * (lean.a - aim.x * 1.1) - 7 * lean.v) * dt;
      lean.a += lean.v * dt;
      lean.vy += (-70 * (lean.y - aim.y * 3) - 7 * lean.vy) * dt;
      lean.y += lean.vy * dt;

      for (var i = 0; i < count; i++) {
        var on = i === activeIndex;
        boards[i].style.setProperty('--wig', on ? lean.a.toFixed(3) + 'deg' : '0deg');
        boards[i].style.setProperty('--wy', on ? lean.y.toFixed(2) + 'px' : '0px');
      }

      var moving = Math.abs(lean.a - aim.x * 1.1) + Math.abs(lean.y - aim.y * 3) > 0.002 ||
        Math.abs(lean.v) + Math.abs(lean.vy) > 0.002;
      if (moving) requestAnimationFrame(wiggleFrame);
      else { wiggleRunning = false; lastWiggle = 0; }
    };

    var wake = function () {
      if (!wiggleRunning) {
        wiggleRunning = true;
        requestAnimationFrame(wiggleFrame);
      }
    };

    sticky.addEventListener('pointermove', function (e) {
      var r = sticky.getBoundingClientRect();
      aim.x = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
      aim.y = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
      wake();
    });
    sticky.addEventListener('pointerleave', function () {
      aim.x = 0;
      aim.y = 0;
      wake();
    });
  }

  lockStage();
  layout();
  current = target = readScroll();
  settledIndex = nearestIndex();
  render(current);

  // Reveal once the first environment + board are decoded.
  var first = [envLayers[0], boards[0].querySelector('img')];
  Promise.all(first.map(function (img) {
    return img.decode ? img.decode().catch(function () {}) : Promise.resolve();
  })).then(function () {
    document.body.classList.add('is-ready');
  });
})();
