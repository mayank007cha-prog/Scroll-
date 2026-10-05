(function () {
  'use strict';

  // Photo pixel space (all three environment shots share it).
  var IMG_W = 2048;
  var IMG_H = 1144;

  // Where a board rests on the mat, between the hands (from the Figma frames).
  var REST_X = 1061;
  var REST_Y = 934;

  // Off-centre poses, in photo px. "Waiting" boards peek in from the left at
  // 75% size (as in the Figma frames); finished boards slide out to the right,
  // under the right hand and off the frame.
  var SIDE_DX = 1054;
  var EXIT_DX = 1560;
  var SIDE_DY = 8;
  var SIDE_SCALE = 0.75;
  var LIFT = 22; // how far a board rises while it travels

  var ACCENTS = [
    [255, 122, 56],  // ember
    [70, 182, 255],  // frost
    [176, 112, 255]  // prism
  ];

  var section = document.getElementById('showcase');
  var sticky = section.querySelector('.kb-sticky');
  var scene = document.getElementById('scene');
  var boards = [].slice.call(scene.querySelectorAll('.kb-board'));
  var envLayers = [].slice.call(scene.querySelectorAll('.kb-env .kb-bg'));
  var handLayers = [].slice.call(scene.querySelectorAll('.kb-hands .kb-bg'));
  var products = [].slice.call(document.querySelectorAll('.kb-product'));
  var steps = [].slice.call(document.querySelectorAll('.kb-progress button'));
  var root = document.documentElement;
  var count = boards.length;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  var k = 1;           // photo px → CSS px
  var current = 0;     // smoothed position (0 … count-1)
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

  function lerp(a, b, t) {
    return a + (b - a) * t;
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
      // leaving room for the headline above and product details below.
      k = (vw * 2.05) / IMG_W;
      sx = vw / 2 - REST_X * k;
      sy = vh * 0.54 - REST_Y * k;
    }

    scene.style.setProperty('--sw', IMG_W * k + 'px');
    scene.style.setProperty('--sh', IMG_H * k + 'px');
    scene.style.setProperty('--sx', sx + 'px');
    scene.style.setProperty('--sy', sy + 'px');
    // Size-relative units for glow/blur inside the scene.
    scene.style.fontSize = 40 * k + 'px';
  }

  // ---------- Scroll → position ----------

  // Each board change gets an equal slice of the scroll. Inside a slice the
  // first and last ~18% are "holds", so a board settles and stays put a
  // moment before the next one starts moving.
  function readScroll() {
    var rect = section.getBoundingClientRect();
    var distance = section.offsetHeight - sticky.clientHeight;
    var u = distance > 0 ? clamp(-rect.top / distance, 0, 1) : 0;
    var q = u * (count - 1);
    var i = Math.min(Math.floor(q), count - 2);
    var f = q - i;
    return i + smoothstep((f - 0.18) / 0.64);
  }

  function scrollToIndex(i) {
    var distance = section.offsetHeight - sticky.clientHeight;
    var top = section.getBoundingClientRect().top + window.pageYOffset;
    window.scrollTo({
      top: top + (distance * i) / (count - 1),
      behavior: reduceMotion.matches ? 'auto' : 'smooth'
    });
  }

  // ---------- Render ----------

  function poseFor(t) {
    // t = 0 at rest, +1 waiting on the left, -1 gone to the right.
    var a = Math.abs(t);
    var dir = t > 0 ? -1 : 1;
    var near = clamp(a, 0, 1);
    var far = clamp(a - 1, 0, 1.5);

    var x = dir * ((t > 0 ? SIDE_DX : EXIT_DX) * near + 760 * far);
    var y = SIDE_DY * near + 30 * far - Math.sin(Math.PI * near) * LIFT;
    var s = lerp(1, SIDE_SCALE, near) - 0.12 * far;
    var o = t > 0 ? 1 - clamp(far * 1.4, 0, 1) : 1 - smoothstep((near - 0.55) / 0.45);
    return { x: x, y: y, s: s, o: o, lift: Math.sin(Math.PI * near) };
  }

  function render(p) {
    var i, t, pose, board, d, w;

    // Boards.
    for (i = 0; i < count; i++) {
      board = boards[i];
      t = i - p;
      pose = poseFor(t);
      board.style.transform =
        'translate3d(' + (pose.x * k).toFixed(2) + 'px,' + (pose.y * k).toFixed(2) + 'px,0) scale(' + pose.s.toFixed(4) + ')';
      board.style.opacity = pose.o.toFixed(3);
      board.style.visibility = pose.o < 0.01 ? 'hidden' : 'visible';
      board.style.setProperty('--lift', pose.lift.toFixed(3));
      board.style.setProperty('--lift-shadow', (1 + pose.lift * 0.35).toFixed(3));

      // Highlight: rim glow in the scene's accent while in focus, plus a
      // specular sweep across the keys as the board glides into place.
      var focus = 1 - smoothstep(Math.abs(t) * 1.6);
      board.style.setProperty('--glow', (0.55 * focus).toFixed(3));
      var sweep = clamp(1 - Math.abs(t) * 1.4, 0, 1);
      board.style.setProperty('--sheen', (Math.sin(Math.PI * sweep) * 0.9).toFixed(3));
      board.style.setProperty('--sheen-x', (t > 0 ? lerp(150, -50, sweep) : lerp(-50, 150, sweep)).toFixed(1) + '%');
    }

    // Environment: each photo dissolves in across the middle of its change.
    for (i = 1; i < count; i++) {
      w = smoothstep((p - (i - 1) - 0.3) / 0.4);
      envLayers[i].style.opacity = w.toFixed(3);
      handLayers[i].style.opacity = w.toFixed(3);
    }

    // Accent colour follows the same dissolve.
    var base = Math.min(Math.floor(p), count - 2);
    var mix = smoothstep((p - base - 0.3) / 0.4);
    var a = ACCENTS[base];
    var b = ACCENTS[base + 1];
    root.style.setProperty('--accent-rgb',
      Math.round(lerp(a[0], b[0], mix)) + ' ' +
      Math.round(lerp(a[1], b[1], mix)) + ' ' +
      Math.round(lerp(a[2], b[2], mix)));

    // The key-light dims a little while boards are in motion.
    var travel = Math.sin(Math.PI * (p - Math.floor(p)));
    scene.style.setProperty('--spot', (1 - travel * 0.45).toFixed(3));

    // Product copy: cross-fade with a soft drift + blur.
    for (i = 0; i < count; i++) {
      d = p - i;
      var o = 1 - smoothstep(Math.abs(d) / 0.42);
      var el = products[i];
      el.style.opacity = o.toFixed(3);
      el.style.transform = 'translate3d(0,' + (-d * 26).toFixed(2) + 'px,0)';
      el.style.filter = o > 0.98 ? 'none' : 'blur(' + ((1 - o) * 8).toFixed(2) + 'px)';
      el.style.visibility = o < 0.01 ? 'hidden' : 'visible';
    }

    // Progress bars fill as you travel towards each board.
    for (i = 0; i < count; i++) {
      steps[i].querySelector('.kb-progress-bar span').style.setProperty('--fill', clamp(p - i + 1, 0, 1).toFixed(3));
    }

    sticky.style.setProperty('--hint', (1 - clamp(p * 3, 0, 1)).toFixed(3));

    var nextActive = Math.round(p);
    if (nextActive !== activeIndex) {
      activeIndex = nextActive;
      for (i = 0; i < count; i++) {
        var on = i === activeIndex;
        boards[i].classList.toggle('is-active', on);
        products[i].classList.toggle('is-active', on);
        products[i].setAttribute('aria-hidden', on ? 'false' : 'true');
        steps[i].classList.toggle('is-active', on);
        if (on) steps[i].setAttribute('aria-current', 'true');
        else steps[i].removeAttribute('aria-current');
      }
    }
  }

  // ---------- Loop: ease towards the scroll position ----------

  function frame(now) {
    var dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 1 / 60;
    lastTime = now;

    if (reduceMotion.matches) {
      current = target;
    } else {
      // Critically-damped-feeling exponential approach: gentle, frame-rate
      // independent, and never overshoots.
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

  steps.forEach(function (btn, i) {
    btn.addEventListener('click', function () { scrollToIndex(i); });
  });

  window.addEventListener('scroll', kick, { passive: true });
  window.addEventListener('resize', function () {
    layout();
    render(current);
    kick();
  });

  layout();
  current = target = readScroll();
  render(current);

  // Reveal once the first environment + board are decoded.
  var first = [envLayers[0], boards[0].querySelector('img')];
  Promise.all(first.map(function (img) {
    return img.decode ? img.decode().catch(function () {}) : Promise.resolve();
  })).then(function () {
    document.body.classList.add('is-ready');
  });
})();
