/*
 * Chat wallpaper change — "stick the new wallpaper on with a roller".
 *
 * The new wallpaper behaves like a sheet of paper laid OVER the old one:
 *
 *   1. enter   – the sheet slides in from the bottom with the roller on it,
 *                covering ~1/4 of the screen
 *   2. settle  – its loose upper part flops forward and falls onto the roller
 *   3. roll    – the roller rolls upward pressing the paper flat; everything
 *                below the roller is stuck, the loose flap rides above it and
 *                knocks the chat bubbles off as it reaches them
 *   4. hold    – clean new wallpaper for 2s
 *   5. return  – the chat rises back from the bottom
 *
 * Layers (bottom → top): old wallpaper · chat · paper (stuck part + flap) · roller
 *
 * The stuck part is a DOM layer clipped at the roller line. The loose flap is
 * drawn on a small canvas as a bending sheet in perspective (front = new
 * wallpaper, back = plain paper), driven by a soft spring that reacts to how
 * fast the roller moves.
 *
 * Tweak timing in CONFIG. Add ?speed=0.25 to the URL for slow motion.
 */
(() => {
  'use strict';

  const NEW_WALLPAPER = 'assets/wallpaper-new.jpg';
  const ROLLER_IMAGE = 'assets/roller.png';

  const CONFIG = {
    // One continuous roller path (no stop between entering and rolling):
    // 1. enter – the sheet slides in fast and slows right down as it lands
    enterDuration: 300,            // ms
    coverOnEnter: 0.24,            // part of the screen the stuck paper covers after entering
    landSpeed: 420,                // px/s while the paper lands on the roller (never zero → no hitch)
    // 2. roll – the roller carries on smoothly up and off the top
    rollDuration: 1260,            // ms
    rollPeakAt: 0.45,              // where in the roll it reaches top speed
    exitSpeed: 600,                // px/s as it leaves the top
    // (start and top speeds are solved so the distances fit the durations;
    //  speeds are per 852px of screen height)

    // Roller image geometry (Figma asset 205 × 236; roller head centre ≈ 33px from the top)
    rollerHeight: 236,
    rollerHeadCenter: 33,
    rollerScale: 1.15,             // drawn this much bigger than the Figma asset

    // Loose paper flap — handled like a heavy carpet.
    // It comes in curled over the roller, hiding the roller head. As the
    // roller climbs and the paper sticks, it opens into a carpet-style S wave:
    // it rises off the wall, rolls forward into a big rounded curl just above
    // the roller head (showing its underside), then the far end flips back up.
    // Each value is [covering the roller, carpet wave].
    // [covering: drapes over the roller and hangs down over its head and the top of the arm,
    //  open: a carpet roll resting on the roller head]
    flapLength: [270, 240],        // px of loose sheet above the roller line
    curlAngle: [181, 190],         // deg the sheet turns over in the main roll
    curlStart: [0.17, 0.12],       // where along the loose sheet the roll begins (0–1)
    curlWidth: [0.26, 0.60],       // how long the roll is (0–1) — longer = bigger, rounder roll
    flipAngle: [0, -60],           // deg the lip curls on (negative = tucks back down onto the wall)
    flipStart: [0.55, 0.75],       // so the open roll closes onto the wall right at the roller line,
    flipWidth: [0.30, 0.15],       // and the roller head props it up in the middle
    propSoftness: 32,              // px over which the sheet drops from the roller head onto the wall
    viewTilt: 0.32,                // seen slightly from below, so the roll's rounded underside shows
    // Where the roller line is (× screen height) for each stage of the climb
    revealTo: 0.22,                // drape slowly lifts off the roller until here (roller fully shown)
    flattenFrom: 0.0,              // the roll travels up and over the top edge of the screen intact,
    flattenTo: -0.15,              // and only unrolls once it is past it (out of view)
    accelSwing: 0.0028,            // deg the heavy sheet swings per px/s² of roller acceleration
    breathe: 4,                    // deg of slow "breathing" in the middle of the heavy sheet
    flapBaseAngle: 4,              // deg it leans forward where it rises behind the roller head
    ripple: 2,                     // deg of waviness across the width (low = heavy sheet)
    paperEdge: 0.45,               // how dark the sheet's cut edge is (shows its thickness)
    sideEdge: 0.35,                // how dark its side edges are
    rollerFrontZ: 12,              // paper further forward than this (px) is drawn over the roller
    perspective: 560,              // px camera distance (smaller = deeper perspective)
    // A small settle when the sheet first comes in
    fallFrom: 0.85,
    fallStiffness: 140,
    fallDamping: 11,
    droopPerSpeed: 0.01,           // deg the wave lags behind per px/s of roller speed (heavy = more lag)
    droopMax: 24,
    flapStiffness: 95,             // spring (heavy sheet: slow, weighty swing)
    flapDamping: 6.5,              // low = it swings a couple of times before settling
    flutter: 0.8,                  // deg of gentle flutter while rolling
    cornerSag: 6,                  // deg the corners fold over further than the middle
    twist: 2,                      // deg of slow left/right wobble
    paperBack: [92, 108, 128],     // colour of the back of the paper (slate, so it stands out from the beige chat)
    // Roller head: the sleeve visibly turns, and the roller bobs and tips a
    // little with each turn, like it is pushing something heavy
    sleeveLines: 14,               // nap ridges around the roller sleeve (they roll over as it turns)
    pushBob: 1.6,                  // px up/down per turn
    pushTilt: 0.7,                 // deg of tilt per turn

    // Bubbles (unchanged feel)
    nudgeRange: 120,
    nudgeLift: 10,
    nudgeTilt: 3,
    contactRange: [14, 34],
    sideSpeed: [320, 480],
    sideAccel: [1900, 2500],
    liftFactor: [0.5, 0.75],
    gravity: 2600,
    spin: [36, 70],
    spinAccel: [130, 220],
    fallScale: 0.1,


    // 4. return — starts while the roller is still finishing near the top
    holdNewWallpaper: 0,           // ms to show the clean new wallpaper before the chat comes back
    returnStagger: 40,             // ms between bubbles, newest (bottom) first — one after another
    returnRise: 0.12,              // × screen height each bubble comes up from
    returnSide: 0.45,              // × screen width it comes in from its own side (green: right, white: left)
    returnTilt: 7,                 // deg it starts tilted, straightening as it lands
    returnFade: 140,               // ms fade-in
    returnSpring: { omega: 15, zeta: 1 }, // critically damped: glides in, no bounce
  };

  const speed = Math.max(0.05, parseFloat(new URLSearchParams(location.search).get('speed')) || 1);

  // ---------------------------------------------------------------- helpers
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
  const range = ([a, b], r) => a + (b - a) * r;
  const rad = (d) => (d * Math.PI) / 180;

  // Damped spring, 0 → 1 (closed form)
  function spring(t, { omega, zeta }) {
    if (t <= 0) return 0;
    if (zeta >= 1) return 1 - Math.exp(-omega * t) * (1 + omega * t); // critically damped
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

  // Distance travelled while speed eases (smoothstep) from v0 to v1 over dur
  // seconds, at fraction u. Speed and acceleration stay continuous at every
  // join, so the roller never jolts.
  function easedTravel(v0, v1, dur, u) {
    return v0 * dur * u + (v1 - v0) * dur * (u * u * u - 0.5 * u * u * u * u);
  }
  const easeOutCubic = (x) => 1 - Math.pow(1 - clamp(x), 3);

  // ---------------------------------------------------------------- DOM
  const stage = document.getElementById('stage');
  const wpBase = document.getElementById('wpBase');
  const sheet = document.getElementById('sheet');
  const sheetImage = document.getElementById('sheetImage');
  const flapCanvas = document.getElementById('flap');
  const roller = document.getElementById('roller');
  const rollerNap = document.getElementById('rollerNap');
  const napCtx = rollerNap.getContext('2d');

  // The roller sleeve turning: nap ridges spaced around the cylinder. Seen from
  // the front, each one rolls over the top of the head as the roller climbs,
  // bunching up and fading near the top and bottom edges like on a real drum.
  let sleeveW = 0, sleeveH = 0;
  function sizeSleeve() {
    const k = Math.min(dpr, 2);
    sleeveW = 166 * CONFIG.rollerScale; sleeveH = 41 * CONFIG.rollerScale;
    rollerNap.width = Math.round(sleeveW * k); rollerNap.height = Math.round(sleeveH * k);
    napCtx.setTransform(k, 0, 0, k, 0, 0);
  }
  function drawSleeve(dist) {
    const r = sleeveH / 2;
    napCtx.clearRect(0, 0, sleeveW, sleeveH);
    const n = CONFIG.sleeveLines;
    const theta = dist / r;                     // rolls without slipping
    for (let i = 0; i < n; i++) {
      const p = theta + (i / n) * Math.PI * 2;
      const c = Math.cos(p);
      if (c <= 0.05) continue;                  // on the far side of the drum
      const y = r - r * 0.92 * Math.sin(p);     // front surface moves up as the roller climbs
      const inset = 4 + (1 - c) * 6;
      napCtx.lineCap = 'round';
      napCtx.lineWidth = 0.6 + 1.4 * c;
      napCtx.strokeStyle = `rgba(60, 66, 78, ${(0.2 * c).toFixed(3)})`;
      napCtx.beginPath(); napCtx.moveTo(inset, y); napCtx.lineTo(sleeveW - inset, y); napCtx.stroke();
      napCtx.lineWidth = 0.8 * c;
      napCtx.strokeStyle = `rgba(255, 255, 255, ${(0.35 * c).toFixed(3)})`;
      napCtx.beginPath(); napCtx.moveTo(inset, y + 1.2); napCtx.lineTo(sleeveW - inset, y + 1.2); napCtx.stroke();
    }
  }
  const hint = document.getElementById('hint');
  const chat = document.getElementById('chat');
  const units = Array.from(document.querySelectorAll('.unit'));

  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const dprGL = Math.min(dpr, 2.5);
  const snap = (v) => Math.round(v * dpr) / dpr;

  const paperImg = new Image();
  paperImg.src = NEW_WALLPAPER;
  const paperReady = (paperImg.decode ? paperImg.decode() : Promise.resolve()).catch(() => {});
  const rollerImg = new Image();
  rollerImg.src = ROLLER_IMAGE;
  if (rollerImg.decode) rollerImg.decode().catch(() => {});

  // ---------------------------------------------------------------- state
  let phase = 'idle'; // idle | run | done
  let sweepDone = false, returnStart = -1, paperDoneAt = 0, sweepDoneAt = 0;
  // Copy of the chat that falls away while the real chat comes back. Built once
  // and reused, so nothing new has to be laid out or painted mid-animation.
  const flyLayer = chat.cloneNode(true);
  flyLayer.removeAttribute('id');
  flyLayer.classList.add('chat--fly', 'is-idle');
  flyLayer.setAttribute('aria-hidden', 'true');
  chat.before(flyLayer);
  const flyUnits = Array.from(flyLayer.querySelectorAll('.unit'));
  const HIDDEN = '0.001'; // practically invisible, but still painted (no repaint when it fades in)
  let phaseStart = 0;
  let rafId = 0;
  let H = 0, W = 0;
  let bubbles = [];
  let cover = null;          // how the wallpaper image maps onto the screen
  let canvasH = 0, canvasHinge = 0;
  let last = null;           // previous frame (for velocities)
  let droop = 0, droopVel = 0;
  let travelled = 0;           // px the roller has rolled (turns the sleeve)
  let fall = 1, fallVel = 0;   // settle of the sheet when it first comes in
  let coverK = 1;               // 1 = paper drapes over the roller, 0 = roller fully shown
  let topK = 0;                 // 0 = rolled, 1 = unrolled flat over the top edge
  let lastV = 0;                // roller speed last frame (for its acceleration)

  function measure() {
    const s = stage.getBoundingClientRect();
    W = s.width;
    H = s.height;
    sheet.style.setProperty('--sheet-h', H + 'px');
    stage.style.setProperty('--roller-scale', CONFIG.rollerScale);

    // background-size: cover, centred — same mapping for the DOM layer and the canvas
    const iw = paperImg.naturalWidth || 1601, ih = paperImg.naturalHeight || 2400;
    const sc = Math.max(W / iw, H / ih);
    cover = { sc, bx: (W - iw * sc) / 2, by: (H - ih * sc) / 2 };

    // Flap canvas: tall enough for the flap plus a little overhang below the roller line
    canvasHinge = CONFIG.flapLength[1] + 40;      // room above the roller line (sheet unrolled flat)
    canvasH = canvasHinge + 320;                     // room below it (drape hanging over the roller)
    sizeSleeve();
    flapCanvas.style.width = W + 'px';
    flapCanvas.style.height = canvasH + 'px';
    if (flapGL) flapGL.resize();

    bubbles = flyUnits.map((el, i) => {
      const r = el.getBoundingClientRect();
      const rand = seeded(1013 + i * 7919);
      const side = el.closest('.me') ? 1 : -1;
      return {
        el, side, home: units[i],
        top: r.top - s.top,
        bottom: r.bottom - s.top,
        left: r.left - s.left,
        right: r.right - s.left,
        contact: range(CONFIG.contactRange, rand()),
        pitch: rand(),
        vx: side * range(CONFIG.sideSpeed, rand()),
        ax: side * range(CONFIG.sideAccel, rand()),
        lift: range(CONFIG.liftFactor, rand()),
        spin: side * range(CONFIG.spin, rand()),
        spinAccel: side * range(CONFIG.spinAccel, rand()),
        flung: false, t0: 0, vy: 0, gone: false, goneAt: 0, back: false, backAt: 0, delay: 0,
      };
    });
  }

  function setTransform(el, x, y, rot, scale) {
    el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${rot.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
  }

  // ---------------------------------------------------------------- timeline
  // Where the roller presses the paper (screen y) and which row of the paper
  // is under it, at time t (ms).
  function rollerLine(t) {
    const tIn = CONFIG.enterDuration / 1000, tRoll = CONFIG.rollDuration / 1000;
    const tA = tRoll * CONFIG.rollPeakAt, tB = tRoll - tA;
    const k = H / 852;
    const enterTo = H * (1 - CONFIG.coverOnEnter);
    const enterFrom = H + 110;  // everything starts below the screen
    const rollTo = -((CONFIG.rollerHeight - CONFIG.rollerHeadCenter) * CONFIG.rollerScale + 30); // roller fully past the top
    const vLand = CONFIG.landSpeed * k, vExit = CONFIG.exitSpeed * k;
    // solve the start and top speeds so each segment covers exactly its distance
    const vIn = (2 * (enterFrom - enterTo)) / tIn - vLand;
    const vPeak = (2 * (enterTo - rollTo) - vLand * tA - vExit * tB) / (tA + tB);
    const sec = t / 1000;

    if (sec < tIn) {
      const u = sec / tIn;
      const y = enterFrom - easedTravel(vIn, vLand, tIn, u);
      // The paper itself eases to a stop as it lands, while the roller keeps
      // moving and starts rolling over it — no sudden stop in the image.
      const slide = (enterFrom - enterTo) * (1 - easeOutCubic(u));
      return { y, paperRow: y - slide, roll: 0 };
    }

    // Rolling: paper is stuck below the roller, so screen row = paper row.
    const r = sec - tIn;
    let y;
    if (r < tA) y = enterTo - easedTravel(vLand, vPeak, tA, r / tA);
    else y = enterTo - easedTravel(vLand, vPeak, tA, 1) - easedTravel(vPeak, vExit, tB, Math.min(1, (r - tA) / tB));
    return { y, paperRow: y, roll: clamp(r / tRoll) };
  }

  // ---------------------------------------------------------------- paper flap
  // The loose paper above the roller is a WebGL mesh. Each column of the mesh
  // is bent along its length (arc-length s from the roller line to the tip):
  // it leans forward at the roller and curls more towards the tip, and the
  // corners sag further than the middle, so the top edge arches like the
  // storyboard's sheet. Printed side = new wallpaper, back = plain paper.
  const NU = 26, NS = 96;                 // mesh resolution (across × along)
  const flapGL = createFlapRenderer(flapCanvas);

  function createFlapRenderer(canvas) {
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, antialias: true, alpha: true });
    if (!gl) return null;

    const vs = `
      attribute vec3 aPos;      // clip-space x, y, depth
      attribute vec2 aUV;
      attribute vec2 aLight;    // front, back brightness
      attribute float aSpec;
      attribute float aAlpha;
      varying vec2 vUV; varying vec2 vLight; varying float vSpec; varying float vAlpha;
      void main() {
        gl_Position = vec4(aPos, 1.0);
        vUV = aUV; vLight = aLight; vSpec = aSpec; vAlpha = aAlpha;
      }`;
    const fs = `
      #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      #else
      precision mediump float;
      #endif
      uniform sampler2D uTex;
      uniform vec3 uBack;
      uniform vec2 uGrain;      // texture px per uv, so the grain sticks to the paper
      uniform float uShadow;    // 1 = drawing a shadow
      varying vec2 vUV; varying vec2 vLight; varying float vSpec; varying float vAlpha;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        if (uShadow > 0.5) { gl_FragColor = vec4(0.0, 0.0, 0.0, vAlpha); return; }
        vec3 c;
        if (gl_FrontFacing) {
          c = texture2D(uTex, vUV).rgb * vLight.x + vec3(vSpec);
        } else {
          // plain back of the paper with a fine fibre grain
          vec2 g = floor(vUV * uGrain / 1.6);
          float grain = hash(g) * 0.6 + hash(g * 0.37 + 11.0) * 0.4;
          c = uBack * vLight.y * (0.955 + 0.07 * grain) + vec3(vAlpha); // vAlpha = sheen along the fold
        }
        gl_FragColor = vec4(c, 1.0);
      }`;
    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      return sh;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);

    // interleaved: x y z  u v  front back  spec  alpha  → 9 floats
    const STRIDE = 9;
    const verts = new Float32Array((NU + 1) * (NS + 1) * STRIDE);
    const shadowVerts = new Float32Array(verts.length);
    const maskVerts = new Float32Array(20 * 3 * STRIDE);
    const dropVerts = new Float32Array((NU + 1) * 2 * STRIDE); // shadow the hanging paper casts on the roller
    const idx = [];
    for (let i = 0; i < NS; i++) {
      for (let j = 0; j < NU; j++) {
        const a = i * (NU + 1) + j, b = a + 1, c = a + (NU + 1), d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
    }
    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);

    const attr = (name, size, offset) => {
      const loc = gl.getAttribLocation(prog, name);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, STRIDE * 4, offset * 4);
    };
    attr('aPos', 3, 0); attr('aUV', 2, 3); attr('aLight', 2, 5); attr('aSpec', 1, 7); attr('aAlpha', 1, 8);
    const uShadow = gl.getUniformLocation(prog, 'uShadow');
    const uGrain = gl.getUniformLocation(prog, 'uGrain');
    gl.uniform3fv(gl.getUniformLocation(prog, 'uBack'), CONFIG.paperBack.map((c) => c / 255));

    let texReady = false, texKey = '';
    const tex = gl.createTexture();
    function upload() {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      const tw = Math.min(paperImg.naturalWidth, Math.round(paperImg.naturalWidth * cover.sc * dprGL));
      const th = Math.min(paperImg.naturalHeight, Math.round(paperImg.naturalHeight * cover.sc * dprGL));
      const scaled = document.createElement('canvas');
      scaled.width = tw; scaled.height = th;
      const c2 = scaled.getContext('2d');
      c2.imageSmoothingQuality = 'high';
      c2.drawImage(paperImg, 0, 0, tw, th);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, scaled);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      texReady = true;
      texKey = `${W}x${H}`;
    }

    // scratch arrays for the 3D positions
    const P3 = new Float32Array((NU + 1) * (NS + 1) * 3);
    const L = (() => { const v = [-0.18, -0.62, 0.76]; const n = Math.hypot(...v); return v.map((c) => c / n); })();
    const FLAT_LIT = L[2];
    const Hv = (() => { const v = [L[0], L[1], L[2] + 1]; const n = Math.hypot(...v); return v.map((c) => c / n); })();
    const FLAT_NH = Hv[2];

    return {
      resize() {
        if (texKey !== `${W}x${H}`) texReady = false;
        canvas.width = Math.round(W * dprGL);
        canvas.height = Math.round(canvasH * dprGL);
        gl.viewport(0, 0, canvas.width, canvas.height);
      },

      // Returns the highest (smallest y) screen point of the paper.
      draw(lineY, paperRow, tSec, rollerX = 0, rollerY = 0) {
        if (!texReady) upload();
        const mix = (pair) => pair[1] + (pair[0] - pair[1]) * coverK;
        const len = mix(CONFIG.flapLength);
        const curlStart = mix(CONFIG.curlStart), curlWidth = mix(CONFIG.curlWidth);
        const flipStart = mix(CONFIG.flipStart), flipWidth = mix(CONFIG.flipWidth);
        const flip = mix(CONFIG.flipAngle);
        const tilt = CONFIG.viewTilt * (1 - 0.75 * coverK); // keep the roller covered at the start
        const persp = CONFIG.perspective;
        const rs = CONFIG.rollerScale;
        const hx0 = W / 2 + (14 - 102.5) * rs + rollerX, hx1 = W / 2 + (180 - 102.5) * rs + rollerX;
        const hy0 = lineY + rollerY + (13 - CONFIG.rollerHeadCenter) * rs, hy1 = lineY + rollerY + (54 - CONFIG.rollerHeadCenter) * rs;
        const headTop = hy0 + 1, PF = CONFIG.propSoftness;
        const prop = smoothstep((0.4 - coverK) / 0.4) * (1 - topK); // once the drape has mostly opened, it settles onto the head
        const cx = W / 2, cy = lineY; // perspective centred on the roller, so the fold drops onto it
        const base = CONFIG.flapBaseAngle;
        // moving fast makes the hanging paper swing out (smaller angle), then it settles back
        const flutter = Math.sin(tSec * 7.3) * CONFIG.flutter + Math.sin(tSec * 11.9 + 1.1) * CONFIG.flutter * 0.4;
        const open = 1 - topK;    // near the top the roll unrolls flat onto the wall
        const tip = base + (mix(CONFIG.curlAngle) - base) * fall - droop * 0.7 + flutter;
        const sag = CONFIG.cornerSag + CONFIG.breathe * Math.sin(tSec * 2.4);
        const ripplePhase = tSec * 4.2; // ripples travel across the width
        const twist = Math.sin(tSec * 3.7 + 0.8) * CONFIG.twist + clamp(droopVel * 0.04, -6, 6); // heavy sheet sloshes sideways as it swings
        const sway = Math.sin(tSec * 4.1 + 0.6) * 5;
        const OVERLAP = 2;                         // px of mesh tucked under the stuck paper
        const ds = (len + OVERLAP) / NS;
        const offY = lineY - canvasHinge;
        const { sc, bx, by } = cover;
        const iw = paperImg.naturalWidth, ih = paperImg.naturalHeight;
        let top = lineY;

        // 1. bend: integrate each column along its length
        for (let j = 0; j <= NU; j++) {
          const un = j / NU, xn = un * 2 - 1;
          let y = lineY + OVERLAP, z = 0;
          for (let i = 0; i <= NS; i++) {
            const s = i * ds - OVERLAP;
            if (i > 0) {
              const sm = Math.max(0, s - ds * 0.5);
              // rises behind the roller head, then folds over it and hangs down in front
              const f = smoothstep((sm / len - curlStart) / curlWidth);
              const f2 = smoothstep((sm / len - flipStart) / flipWidth);
              const lean = base * smoothstep(sm / (len * 0.16)); // soft crease at the roller, not a hard fold
              const wave = CONFIG.ripple * (0.65 * Math.sin(xn * 5.3 + ripplePhase) + 0.35 * Math.sin(xn * 11.7 - ripplePhase * 0.7 + 1.3));
              const phi = rad((lean + (tip - base + sag * xn * xn + twist * xn + wave) * f - flip * f2) * open);
              y -= Math.cos(phi) * ds;
              z += Math.sin(phi) * ds;
            }
            const f2 = Math.pow(Math.max(0, s) / len, 2);
            const k = (i * (NU + 1) + j) * 3;
            P3[k] = un * W + sway * f2;
            P3[k + 1] = y;
            P3[k + 2] = z;
          }
        }

        // 2. project, light, texture
        const maxZ = len;
        for (let i = 0; i <= NS; i++) {
          const s = i * ds - OVERLAP;
          const row = paperRow - s;                // paper row under this vertex row
          const v = (row - by) / sc / ih;
          for (let j = 0; j <= NU; j++) {
            const n = i * (NU + 1) + j, k = n * 3, o = n * STRIDE;
            const x = P3[k], y = P3[k + 1], z = P3[k + 2];
            const kk = persp / (persp - z);
            const X = cx + (x - cx) * kk;
            let Y = cy + (y - z * tilt - cy) * kk;
            // the roller head props the roll up: where the sheet's front face would
            // come down over the head it rests on top of it; either side of the head
            // it drops onto the wall
            if (prop > 0 && Y > headTop - 8) {
              const wx = smoothstep((X - hx0 + PF) / PF) * smoothstep((hx1 + PF - X) / PF);
              const wz = smoothstep((z - 6) / 10);
              const d = Y - headTop;
              const excess = (d + Math.sqrt(d * d + 16)) / 2; // smooth max(0, d)
              Y -= excess * wx * wz * prop;
            }
            if (Y < top) top = Y;

            // normal = cross(tangent along s, tangent along u)
            const ia = Math.min(i + 1, NS), ib = Math.max(i - 1, 0);
            const ja = Math.min(j + 1, NU), jb = Math.max(j - 1, 0);
            const ka = (ia * (NU + 1) + j) * 3, kb = (ib * (NU + 1) + j) * 3;
            const kc = (i * (NU + 1) + ja) * 3, kd = (i * (NU + 1) + jb) * 3;
            const tsx = P3[ka] - P3[kb], tsy = P3[ka + 1] - P3[kb + 1], tsz = P3[ka + 2] - P3[kb + 2];
            const tux = P3[kc] - P3[kd], tuy = P3[kc + 1] - P3[kd + 1], tuz = P3[kc + 2] - P3[kd + 2];
            let nx = tsy * tuz - tsz * tuy, ny = tsz * tux - tsx * tuz, nz = tsx * tuy - tsy * tux;
            const nl = Math.hypot(nx, ny, nz) || 1;
            nx /= nl; ny /= nl; nz /= nl;
            const lit = nx * L[0] + ny * L[1] + nz * L[2];
            const edge = (1 - CONFIG.paperEdge * smoothstep(i - (NS - 1)))      // dark cut edge = the sheet's thickness
              * (1 - CONFIG.sideEdge * smoothstep(Math.abs(j - NU / 2) - (NU / 2 - 1))); // and its side edges
            const lift = 1 - 0.32 * open * smoothstep(s / 6) * (1 - smoothstep((s - 8) / 22)); // crease shadow where it lifts off the wall
            // the roll overhangs the rising sheet below it and shades it
            const uu = s / len;
            const under = 1 - 0.4 * (1 - coverK) * open * smoothstep((uu - (curlStart - 0.24)) / 0.24) * (1 - smoothstep((uu - curlStart) / 0.12));
            const front = clamp(1 - 0.95 * (FLAT_LIT - lit), 0.32, 1.0) * edge * lift * under; // flat paper = exactly 1
            const hang = smoothstep((s / len - (curlStart + curlWidth * 0.5)) / 0.25); // 0 at the crest → 1 inside the curl
            // crest catches the light, the hanging face shades down towards the hem
            const back = clamp(0.42 + 0.8 * -lit, 0.32, 1.12) * (1 - 0.3 * Math.pow(hang, 1.3)) * edge; // round: lit on top, dark underneath
            const nh = nx * Hv[0] + ny * Hv[1] + nz * Hv[2];
            const spec = Math.pow(clamp((nh - FLAT_NH) / (1 - FLAT_NH)), 2) * 0.14; // glint only where it bends towards the light

            verts[o] = (X / W) * 2 - 1;
            verts[o + 1] = 1 - ((Y - offY) / canvasH) * 2;
            verts[o + 2] = -z / (maxZ * 2);
            verts[o + 3] = ((x - bx) / sc) / iw;
            verts[o + 4] = v;
            verts[o + 5] = front;
            verts[o + 6] = back;
            verts[o + 7] = spec;
            // soft sheen where the back of the fold curves towards the light
            const nhb = -nh;
            verts[o + 8] = Math.pow(clamp((nhb - 0.55) / 0.45), 3) * 0.16;

            // cast shadow on the old wallpaper: the lifted paper throws a soft
            // shadow slightly above itself
            const shY = cy + (y - z * (0.6 + tilt) - cy) * 1;
            const edgeFade = 1 - Math.pow(Math.abs(j / NU * 2 - 1), 6);
            shadowVerts[o] = (X / W) * 2 - 1;
            shadowVerts[o + 1] = 1 - ((shY - offY) / canvasH) * 2;
            shadowVerts[o + 2] = 0.999;
            shadowVerts[o + 8] = 0.62 * Math.pow(clamp(z / (maxZ * 0.5)), 0.8) * edgeFade * (1 - smoothstep((s / len - 0.82) / 0.18));
          }
        }

        gl.clearColor(0, 0, 0, 0);
        gl.clearDepth(1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        const count = NS * NU * 6;

        // roller head as a depth-only mask: this canvas sits above the roller,
        // so paper still behind the head (small z) is hidden by it, while the
        // part that folds over in front of the head is drawn on top of it
        const maskZ = -CONFIG.rollerFrontZ / (maxZ * 2);
        let m = 0;
        const ring = [];
        const rad0 = 7 * rs; // rounded ends of the roller sleeve
        for (const [cx0, cy0, a0] of [[hx1 - rad0, hy0 + rad0, -90], [hx1 - rad0, hy1 - rad0, 0], [hx0 + rad0, hy1 - rad0, 90], [hx0 + rad0, hy0 + rad0, 180]]) {
          for (let k = 0; k <= 4; k++) {
            const a = rad(a0 + k * 22.5);
            ring.push([cx0 + Math.cos(a) * rad0, cy0 + Math.sin(a) * rad0]);
          }
        }
        const cxm = (hx0 + hx1) / 2, cym = (hy0 + hy1) / 2;
        const put = (X, Y) => {
          maskVerts[m++] = (X / W) * 2 - 1;
          maskVerts[m++] = 1 - ((Y - offY) / canvasH) * 2;
          maskVerts[m++] = maskZ;
          m += STRIDE - 3;
        };
        for (let k = 0; k < ring.length; k++) {
          const a = ring[k], b = ring[(k + 1) % ring.length];
          put(cxm, cym); put(a[0], a[1]); put(b[0], b[1]);
        }
        gl.disable(gl.BLEND);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.depthMask(true);
        gl.colorMask(false, false, false, false);
        gl.bufferData(gl.ARRAY_BUFFER, maskVerts, gl.DYNAMIC_DRAW);
        gl.drawArrays(gl.TRIANGLES, 0, ring.length * 3);
        gl.colorMask(true, true, true, true);

        // shadow (blended, no depth write; hidden where the roller head is)
        gl.depthMask(false);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.uniform1f(uShadow, 1);
        gl.bufferData(gl.ARRAY_BUFFER, shadowVerts, gl.DYNAMIC_DRAW);
        gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);

        // soft shadow the hanging paper casts on the roller head, just below its edge
        // (drawn only where the head is: same depth as the mask)
        for (let j = 0; j <= NU; j++) {
          const t0 = (NS * (NU + 1) + j) * STRIDE;
          const X = Math.min(hx1, Math.max(hx0, ((verts[t0] + 1) / 2) * W));
          const Yc = verts[t0 + 1];
          const o0 = j * STRIDE, o1 = (NU + 1 + j) * STRIDE;
          dropVerts[o0] = (X / W) * 2 - 1;
          dropVerts[o0 + 1] = Yc;
          dropVerts[o0 + 2] = maskZ;
          dropVerts[o0 + 8] = 0.42;
          dropVerts[o1] = dropVerts[o0];
          dropVerts[o1 + 1] = Yc - (16 / canvasH) * 2;
          dropVerts[o1 + 2] = maskZ;
          dropVerts[o1 + 8] = 0;
        }
        gl.depthFunc(gl.EQUAL);
        gl.bufferData(gl.ARRAY_BUFFER, dropVerts, gl.DYNAMIC_DRAW);
        gl.drawElements(gl.TRIANGLES, NU * 6, gl.UNSIGNED_SHORT, 0);
        gl.depthFunc(gl.LEQUAL);

        // paper (depth tested so the curl overlaps itself and the roller correctly)
        gl.disable(gl.BLEND);
        gl.depthMask(true);
        gl.uniform1f(uShadow, 0);
        gl.uniform2f(uGrain, iw * sc * dprGL, ih * sc * dprGL);
        gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);
        gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);

        return top;
      },
    };
  }

  // ---------------------------------------------------------------- sweep
  function updateSweep(now) {
    const t = (now - phaseStart) * speed;
    const tSec = t / 1000;
    const line = rollerLine(t);

    // Velocity of the roller line (px/s, + = upward) drives the paper droop
    const dt = last ? clamp((now - last.now) * speed / 1000, 1 / 240, 1 / 20) : 1 / 60;
    const v = last ? (last.y - line.y) / dt : 0;
    // the heavy sheet lags with speed and swings with every change of speed
    const a = last ? (v - lastV) / dt : 0;
    lastV = v;
    const target = clamp(v * CONFIG.droopPerSpeed + a * CONFIG.accelSwing, -20, CONFIG.droopMax);
    const acc = CONFIG.flapStiffness * (target - droop) - CONFIG.flapDamping * droopVel;
    droopVel += acc * dt;
    droop += droopVel * dt;
    // the loose top flops over onto the roller (slight bounce when it lands)
    fallVel += (CONFIG.fallStiffness * (1 - fall) - CONFIG.fallDamping * fallVel) * dt;
    fall += fallVel * dt;
    // the fold rolls back off the roller head as the paper gets stuck down
    // the drape slowly lifts off the roller as the paper gets stuck down, and near
    // the top the roll unrolls flat and goes over the top edge
    const yCover = H * (1 - CONFIG.coverOnEnter), yOpen = H * CONFIG.revealTo;
    coverK = smoothstep((line.y - yOpen) / (yCover - yOpen));
    topK = 1 - smoothstep((line.y - H * CONFIG.flattenTo) / (H * (CONFIG.flattenFrom - CONFIG.flattenTo)));
    const edgeSpeed = Math.max(0, v);
    last = { now, y: line.y };

    // Stuck paper: clipped at the roller line, image fixed to the paper
    const lineY = snap(line.y);
    sheet.style.transform = `translate3d(0, ${lineY}px, 0)`;
    sheetImage.style.transform = `translate3d(0, ${snap(-line.paperRow)}px, 0)`;

    // Loose flap
    flapCanvas.style.transform = `translate3d(0, ${snap(line.y - canvasHinge)}px, 0)`;
    // Roller: the sleeve turns with the distance travelled, and the roller
    // bobs and tips a little with each turn, like pushing something heavy
    travelled += Math.abs(v) * dt;
    const turn = travelled / (Math.PI * 41 * CONFIG.rollerScale);   // sleeve turns
    const sway = Math.sin(tSec * 6.5) * 1.4;
    const bob = Math.sin(turn * Math.PI * 2) * CONFIG.pushBob * smoothstep(Math.abs(v) / 400);
    const tilt = Math.sin(turn * Math.PI * 2 + 1.2) * CONFIG.pushTilt * smoothstep(Math.abs(v) / 400);
    drawSleeve(travelled);
    const edge = (flapGL ? flapGL.draw(line.y, line.paperRow, tSec, sway, bob) : line.y) - 2;

    const lift = smoothstep((line.roll - 0.84) / 0.16);
    roller.style.transform =
      `translate3d(${sway.toFixed(2)}px, ${snap(line.y + bob - CONFIG.rollerHeadCenter * CONFIG.rollerScale)}px, 0) rotate(${tilt.toFixed(2)}deg) scale(${(1 + lift * 0.05).toFixed(4)})`;
    roller.style.opacity = (1 - lift).toFixed(3);

    // Bubbles get knocked off by the paper's top edge
    for (const b of bubbles) {
      if (b.gone || b.back) continue;
      const gap = edge - b.bottom; // > 0 while the paper is still below the bubble

      if (!b.flung) {
        if (gap <= b.contact) {
          b.flung = true;
          b.t0 = tSec;
          b.vy = -Math.max(300, edgeSpeed) * b.lift;
        } else {
          const k = smoothstep(1 - (gap - b.contact) / CONFIG.nudgeRange);
          if (k > 0) setTransform(b.el, b.side * 3 * k, -CONFIG.nudgeLift * k, b.side * CONFIG.nudgeTilt * k, 1);
          continue;
        }
      }

      const tau = tSec - b.t0;
      const x = b.side * 3 + b.vx * tau + 0.5 * b.ax * tau * tau;
      const y = -CONFIG.nudgeLift + b.vy * tau + 0.5 * CONFIG.gravity * tau * tau;
      const rot = b.side * CONFIG.nudgeTilt + b.spin * tau + 0.5 * b.spinAccel * tau * tau;
      const scale = 1 - CONFIG.fallScale * smoothstep(tau / 0.55);
      setTransform(b.el, x, y, rot, scale);

      // Off-screen, or fallen under the stuck paper
      const under = b.top + y > line.y + 20;
      const offscreen = b.left + x > W + 40 || b.right + x < -40 || b.top + y > H + 40;
      if (offscreen || under) {
        b.gone = true;
        b.goneAt = t;
        b.el.style.visibility = 'hidden';
      }
    }

    // Roller gone: the new wallpaper becomes the base. The sweep ends once the
    // last falling chat has left the screen too (with a safety cap).
    if (line.roll >= 1) {
      if (!wpBase.classList.contains('is-new')) {
        wpBase.classList.add('is-new');
        sheet.classList.remove('is-active');
        flapCanvas.classList.remove('is-active');
        roller.classList.remove('is-active');
        paperDoneAt = t;
      }
      const allGone = bubbles.every((b) => b.gone || b.bottom <= 0);
      if (allGone || t - paperDoneAt > 900) {
        flyLayer.classList.add('is-idle');
        sweepDone = true;
        sweepDoneAt = t;
      }
    }
  }

  // ---------------------------------------------------------------- return
  // After a short hold on the clean new wallpaper, the real chat comes back
  // (a copy of it did the falling). Newest message first, one after another:
  // each bubble comes up from the bottom corner on the side it fell towards
  // (green from the right, white from the left) and straightens into its slot.
  // The real chat is already parked (lowered, nearly transparent) from the tap
  // on, so starting the return only changes transforms and opacity.
  function parkChat() {
    chat.classList.add('is-over');
    const rise = H * CONFIG.returnRise;
    const order = bubbles.filter((b) => b.bottom > 0).sort((a, b) => b.bottom - a.bottom);
    bubbles.forEach((b) => { b.delay = -1; b.home.style.transform = ''; b.home.style.opacity = HIDDEN; });
    order.forEach((b, i) => {
      b.delay = i * CONFIG.returnStagger;
      setTransform(b.home, b.side * W * CONFIG.returnSide, rise, b.side * CONFIG.returnTilt, 1);
    });
  }

  function startReturn(t) {
    returnStart = t;
    bubbles.forEach((b) => { if (b.delay < 0) b.home.style.opacity = ''; });
  }

  function updateReturn(t) {
    const rise = H * CONFIG.returnRise;
    let settled = true;
    for (const b of bubbles) {
      if (b.delay < 0) continue; // above the screen: already in place
      const local = Math.max(0, t - returnStart - b.delay);
      const k = 1 - spring(local / 1000, CONFIG.returnSpring); // 1 → 0
      // comes up from the bottom corner on its own side, straightening as it lands
      const x = b.side * W * CONFIG.returnSide * k;
      const y = rise * k;
      if (local < CONFIG.returnFade || Math.abs(x) > 0.3 || Math.abs(y) > 0.3) settled = false;
      setTransform(b.home, snap(x), snap(y), b.side * CONFIG.returnTilt * k, 1);
      b.home.style.opacity = Math.max(0.001, clamp(local / CONFIG.returnFade)).toFixed(3);
    }
    return settled;
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
    if (phase === 'run') {
      const t = (now - phaseStart) * speed;
      if (!sweepDone) updateSweep(now);
      // hold on the clean new wallpaper, then bring the chat back
      if (sweepDone && returnStart < 0 && t - sweepDoneAt >= CONFIG.holdNewWallpaper) startReturn(t);
      const settled = returnStart >= 0 && updateReturn(t);
      if (sweepDone && settled) {
        units.forEach((el) => { el.style.transform = ''; el.style.opacity = ''; });
        flyLayer.classList.add('is-idle');
        setPhase('done', now);
      }
    }

    if (phase === 'done' || phase === 'idle') { rafId = 0; return; }
    rafId = requestAnimationFrame(tick);
  }

  // Back to the very first frame: old wallpaper, chat in place, no paper or roller.
  function resetToInitial() {
    wpBase.classList.remove('is-new');
    sheet.classList.remove('is-active');
    flapCanvas.classList.remove('is-active');
    roller.classList.remove('is-active');
    chat.classList.remove('is-over');
    flyLayer.classList.add('is-idle');
    flyLayer.style.opacity = '';
    for (const el of [...units, ...flyUnits]) {
      el.style.transform = '';
      el.style.visibility = '';
      el.style.opacity = '';
    }
    phase = 'idle';
  }

  // A tap plays the whole sequence once; taps while it is playing are ignored.
  // After the wallpaper has changed, the next tap replays it from the start.
  let starting = false;
  async function play() {
    if (starting || phase === 'run') return;
    starting = true;
    await paperReady;
    starting = false;
    resetToInitial();

    measure();
    // The copy does the falling; the real chat is parked and comes back later.
    flyLayer.classList.remove('is-idle');
    parkChat();
    hint.classList.add('is-hidden');
    last = null; droop = 0; droopVel = 0; fall = CONFIG.fallFrom; fallVel = 0; coverK = 1; topK = 0; lastV = 0; travelled = 0;
    sweepDone = false; returnStart = -1;

    sheet.classList.add('is-active');
    flapCanvas.classList.add('is-active');
    roller.classList.add('is-active');
    roller.style.opacity = '1';

    phase = 'run';
    phaseStart = performance.now();
    updateSweep(phaseStart); // position everything before the first paint
    if (!rafId) rafId = requestAnimationFrame(tick);
  }

  stage.addEventListener('click', play);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); play(); }
  });

  // Prepare everything up front (layout, texture upload, shader compile) so the
  // first frames after a tap are as light as the rest.
  Promise.all([paperReady, document.fonts ? document.fonts.ready : null]).then(() => {
    measure();
    if (flapGL) flapGL.draw(H + 2000, H, 0);
  });
  window.addEventListener('resize', () => { if (phase !== 'run') measure(); });

  // Expose for tweaking from the console
  window.wallpaperRoller = { CONFIG, play };
})();
