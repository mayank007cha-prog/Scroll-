/*
 * Chat wallpaper change — paint roller transition.
 *
 * One requestAnimationFrame loop drives everything from a single source of
 * truth: the roller's position. The paint edge (new wallpaper reveal) is
 * derived from the roller, and every chat bubble reacts to the paint edge.
 *
 *   tap → roller enters → paints upward (bubbles get knocked off) →
 *   roller lifts off the top → clean wallpaper (2s) → chat rises back
 *
 * Tweak timing in CONFIG. Add ?speed=0.25 to the URL for slow motion.
 */
(() => {
  'use strict';

  const CONFIG = {
    // Roller sweep (bottom → off the top)
    sweepDuration: 1250,           // ms (edge crosses the screen in ≈0.7s)
    sweepEase: [0.35, 0.15, 0.6, 1],

    // Roller image geometry (Figma: 205 × 236, roller head ≈ 13–54px from the top)
    rollerHeight: 236,
    headCenter: 30,                // paint starts under the head while the roller enters…
    edgeLead: 63,                  // …then the rolled lip settles this far above the roller top
    leadBuildUp: 240,              // px of travel over which the lip builds up

    // Bubbles
    nudgeRange: 120,               // px: the edge starts nudging a bubble this far before contact
    nudgeLift: 10,                 // px lifted during the nudge
    nudgeTilt: 3,                  // deg of tilt during the nudge
    contactRange: [14, 34],        // px: distance edge→bubble bottom at which it gets knocked off
    sideSpeed: [260, 420],         // px/s initial sideways velocity
    sideAccel: [1500, 2100],       // px/s² sideways acceleration (sliding off)
    liftFactor: [0.5, 0.75],       // × edge speed → initial upward velocity
    gravity: 2600,                 // px/s²
    spin: [36, 70],                // deg/s initial angular velocity
    spinAccel: [130, 220],         // deg/s²
    fallScale: 0.1,                // shrinks up to 10% (falling away from the glass)

    // After the sweep
    holdDuration: 2000,            // ms of clean new wallpaper

    // Chat return
    returnStagger: 22,             // ms between bubbles (top of the column leads)
    returnSpring: { omega: 9, zeta: 0.88 },
    returnOffsetExtra: 40,         // px below the screen they start from
  };

  const speed = Math.max(0.05, parseFloat(new URLSearchParams(location.search).get('speed')) || 1);

  // ---------------------------------------------------------------- helpers
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
  const range = ([a, b], r) => a + (b - a) * r;

  // CSS-style cubic-bezier easing
  function cubicBezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = (t) => ((ax * t + bx) * t + cx) * t;
    const sy = (t) => ((ay * t + by) * t + cy) * t;
    const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (x) => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) {
        const err = sx(t) - x;
        const d = dx(t);
        if (Math.abs(err) < 1e-6 || Math.abs(d) < 1e-6) break;
        t -= err / d;
      }
      t = clamp(t);
      return sy(t);
    };
  }

  // Damped spring, 0 → 1 (closed form)
  function spring(t, { omega, zeta }) {
    if (t <= 0) return 0;
    const wd = omega * Math.sqrt(1 - zeta * zeta);
    const e = Math.exp(-zeta * omega * t);
    return 1 - e * (Math.cos(wd * t) + (zeta * omega / wd) * Math.sin(wd * t));
  }

  // Deterministic randomness so every replay looks the same
  function seeded(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const sweepEase = cubicBezier(...CONFIG.sweepEase);

  // ---------------------------------------------------------------- DOM
  const stage = document.getElementById('stage');
  const wpBase = document.getElementById('wpBase');
  const paint = document.getElementById('paint');
  const paintImage = document.getElementById('paintImage');
  const roller = document.getElementById('roller');
  const hint = document.getElementById('hint');
  const units = Array.from(document.querySelectorAll('.unit'));

  const dpr = window.devicePixelRatio || 1;
  const snap = (v) => Math.round(v * dpr) / dpr;

  // ---------------------------------------------------------------- state
  let phase = 'idle'; // idle | sweep | hold | return | done
  let phaseStart = 0;
  let rafId = 0;
  let H = 0, W = 0;
  let bubbles = [];
  let lastEdge = 0, lastTime = 0, edgeSpeed = 0;

  function measure() {
    const s = stage.getBoundingClientRect();
    W = s.width;
    H = s.height;
    paint.style.setProperty('--paint-h', H + 'px');
    bubbles = units.map((el, i) => {
      const r = el.getBoundingClientRect();
      const rand = seeded(1013 + i * 7919);
      const side = el.closest('.me') ? 1 : -1;
      return {
        el, side,
        top: r.top - s.top,
        bottom: r.bottom - s.top,
        left: r.left - s.left,
        right: r.right - s.left,
        contact: range(CONFIG.contactRange, rand()),
        vx: side * range(CONFIG.sideSpeed, rand()),
        ax: side * range(CONFIG.sideAccel, rand()),
        lift: range(CONFIG.liftFactor, rand()),
        spin: side * range(CONFIG.spin, rand()),
        spinAccel: side * range(CONFIG.spinAccel, rand()),
        // flight state
        flung: false, t0: 0, vy: 0, gone: false,
      };
    });
  }

  function setTransform(el, x, y, rot, scale) {
    el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${rot.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
  }

  // ---------------------------------------------------------------- sweep
  // Roller top position for a given sweep progress (0..1)
  function rollerY(p) {
    const start = H + 12;                              // just below the screen
    const end = -(CONFIG.rollerHeight + 36);           // fully past the top
    return lerp(start, end, sweepEase(p));
  }

  // Paint edge derived from the roller: begins under the roller head, then
  // the rolled lip builds up ahead of the roller as it pushes upward.
  function edgeFromRoller(rY) {
    const travelled = (H + 12) - rY;
    const build = smoothstep(travelled / CONFIG.leadBuildUp);
    return rY + CONFIG.headCenter - (CONFIG.headCenter + CONFIG.edgeLead) * build;
  }

  function updateSweep(now) {
    const t = (now - phaseStart) * speed;
    const p = clamp(t / CONFIG.sweepDuration);
    const rY = rollerY(p);
    const edge = edgeFromRoller(rY);

    // edge speed (px/s, positive = moving up), lightly smoothed
    const dt = Math.max(1, (now - lastTime) * speed) / 1000;
    const instant = (lastEdge - edge) / dt;
    edgeSpeed = lastTime ? lerp(edgeSpeed, instant, 0.5) : 0;
    lastEdge = edge;
    lastTime = now;

    // Roller: tiny hand sway + lift-off at the very end
    const sway = Math.sin(p * Math.PI * 2.2) * 1.6;
    const tilt = Math.sin(p * Math.PI * 1.6 + 0.4) * 0.9;
    const lift = smoothstep((p - 0.8) / 0.2);
    roller.style.transform =
      `translate3d(${sway.toFixed(2)}px, ${snap(rY).toFixed(2)}px, 0) rotate(${tilt.toFixed(2)}deg) scale(${(1 + lift * 0.05).toFixed(4)})`;
    roller.style.opacity = (1 - lift).toFixed(3);

    // New wallpaper: the sheet moves with the edge, the image stays put.
    const e = snap(edge);
    paint.style.transform = `translate3d(0, ${e}px, 0)`;
    paintImage.style.transform = `translate3d(0, ${-e}px, 0)`;

    // Bubbles react to the edge
    const tSec = t / 1000;
    for (const b of bubbles) {
      if (b.gone) continue;
      const gap = edge - b.bottom; // > 0 while the edge is still below the bubble

      if (!b.flung) {
        if (gap <= b.contact) {
          b.flung = true;
          b.t0 = tSec;
          b.vy = -Math.max(300, edgeSpeed) * b.lift;
          b.el.classList.add('is-flying');
        } else {
          // Nudge: the approaching lip lifts and tips the bubble slightly
          const k = smoothstep(1 - (gap - b.contact) / CONFIG.nudgeRange);
          if (k > 0) {
            setTransform(b.el, b.side * 3 * k, -CONFIG.nudgeLift * k, b.side * CONFIG.nudgeTilt * k, 1);
          }
          continue;
        }
      }

      // Knocked off: slides sideways, pops up a little, then falls away
      const tau = tSec - b.t0;
      const x = b.side * 3 + b.vx * tau + 0.5 * b.ax * tau * tau;
      const y = -CONFIG.nudgeLift + b.vy * tau + 0.5 * CONFIG.gravity * tau * tau;
      const rot = b.side * CONFIG.nudgeTilt + b.spin * tau + 0.5 * b.spinAccel * tau * tau;
      const scale = 1 - CONFIG.fallScale * smoothstep(tau / 0.55);
      setTransform(b.el, x, y, rot, scale);

      const offscreen = b.left + x > W + 40 || b.right + x < -40 || b.top + y > H + 40;
      if (offscreen) {
        b.gone = true;
        b.el.style.visibility = 'hidden';
      }
    }

    const allGone = bubbles.every((b) => b.gone || b.bottom < 0);
    if (p >= 1 && allGone) {
      // Clean state: commit the new wallpaper as the base layer
      wpBase.classList.add('is-new');
      paint.classList.remove('is-active');
      roller.classList.remove('is-active');
      bubbles.forEach((b) => { b.el.style.visibility = 'hidden'; b.el.classList.remove('is-flying'); });
      setPhase('hold', now);
    }
  }

  // ---------------------------------------------------------------- return
  function startReturn(now) {
    // The whole column starts just below the screen and rises with the top
    // bubble leading. A shared offset + top-first stagger means bubbles never
    // cross: the column fans out slightly while rising, then settles.
    const visible = bubbles.filter((b) => b.bottom > 0).sort((a, b) => a.top - b.top);
    const offset = H + CONFIG.returnOffsetExtra - Math.min(0, visible.length ? visible[0].top : 0);
    bubbles.forEach((b) => {
      b.delay = 0;
      b.offset = 0; // off-screen bubbles (above the top) simply sit in place
      b.el.style.transform = '';
      b.el.style.visibility = '';
    });
    visible.forEach((b, i) => {
      b.delay = i * CONFIG.returnStagger;
      b.offset = offset;
      b.el.style.transform = `translate3d(0, ${offset}px, 0)`;
    });
    setPhase('return', now);
  }

  function updateReturn(now) {
    const t = (now - phaseStart) * speed;
    let settled = true;
    for (const b of bubbles) {
      const local = (t - b.delay) / 1000;
      const k = spring(local, CONFIG.returnSpring);
      const y = b.offset * (1 - k);
      if (local < 1.1 || Math.abs(y) > 0.3) settled = false;
      b.el.style.transform = `translate3d(0, ${snap(y).toFixed(2)}px, 0)`;
    }
    if (settled) {
      bubbles.forEach((b) => { b.el.style.transform = ''; });
      setPhase('done', now);
    }
  }

  // ---------------------------------------------------------------- loop
  function setPhase(next, now) {
    phase = next;
    phaseStart = now;
    if (next === 'done') {
      hint.textContent = 'Tap to replay';
      hint.classList.remove('is-hidden');
    }
  }

  function tick() {
    const now = performance.now(); // one clock for phase starts and frames
    if (phase === 'sweep') updateSweep(now);
    else if (phase === 'hold' && (now - phaseStart) * speed >= CONFIG.holdDuration) startReturn(now);
    else if (phase === 'return') updateReturn(now);

    if (phase === 'done' || phase === 'idle') { rafId = 0; return; }
    rafId = requestAnimationFrame(tick);
  }

  function resetToInitial() {
    wpBase.classList.remove('is-new');
    units.forEach((el) => {
      el.style.transform = '';
      el.style.visibility = '';
      el.classList.remove('is-flying');
    });
  }

  function play() {
    if (phase === 'sweep' || phase === 'hold' || phase === 'return') return;
    if (phase === 'done') resetToInitial();

    measure();
    hint.classList.add('is-hidden');
    lastEdge = H; lastTime = 0; edgeSpeed = 0;

    paint.classList.add('is-active');
    roller.classList.add('is-active');
    roller.style.opacity = '1';

    phase = 'sweep';
    phaseStart = performance.now();
    if (!rafId) rafId = requestAnimationFrame(tick);
  }

  stage.addEventListener('click', play);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); play(); }
  });

  // Decode the new wallpaper + roller up-front so the first frame is never janky
  ['assets/wallpaper-new.jpg', 'assets/roller.png'].forEach((src) => {
    const img = new Image();
    img.src = src;
    if (img.decode) img.decode().catch(() => {});
  });

  // Expose for tweaking from the console
  window.wallpaperRoller = { CONFIG, play };
})();
