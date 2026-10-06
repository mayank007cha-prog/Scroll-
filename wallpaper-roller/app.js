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
    coverOnEnter: 0.2,             // part of the screen the stuck paper covers after entering
    landSpeed: 420,                // px/s while the paper lands on the roller (never zero → no hitch)
    // 2. roll – the roller carries on smoothly up and off the top
    rollDuration: 760,             // ms
    rollPeakAt: 0.45,              // where in the roll it reaches top speed
    exitSpeed: 600,                // px/s as it leaves the top
    // (start and top speeds are solved so the distances fit the durations;
    //  speeds are per 852px of screen height)

    // Roller image geometry (Figma asset 205 × 236; roller head centre ≈ 33px from the top)
    rollerHeight: 236,
    rollerHeadCenter: 33,

    // Loose paper flap
    flapLength: 190,               // px of loose paper above the roller
    flapBaseAngle: 20,             // deg it leans forward at the roller
    flapTipAngle: 80,              // deg at the tip when resting on the roller
    flapCurl: 2.1,                 // how much the bend concentrates towards the tip
    perspective: 820,              // px camera distance
    droopPerSpeed: 0.013,          // deg of extra droop per px/s of roller speed
    droopMax: 46,
    flapStiffness: 130,            // spring (soft paper wobble)
    flapDamping: 9.5,
    flutter: 2.2,                  // deg of idle flutter
    cornerSag: 26,                 // deg extra curl at the corners (arched top edge)
    twist: 5,                      // deg of slow left/right wobble
    paperBack: [246, 244, 240],    // colour of the back of the paper

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

    // Sound (synthesised with Web Audio; add ?sound=0 to the URL to mute)
    soundVolume: 0.8,

    // 4. return — starts while the roller is still finishing near the top
    returnAtRoll: 0.45,            // roll progress at which the chat starts coming back
    returnStagger: 18,             // ms between bubbles, newest (bottom) first
    returnRise: 0.1,               // × screen height each bubble rises from
    returnFade: 160,               // ms fade-in while rising
    returnSpring: { omega: 14, zeta: 1 }, // critically damped: glides in, no bounce
    flyFadeOut: 200,               // ms: leftover falling bubbles fade once the chat returns
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

  // ---------------------------------------------------------------- sound
  // Small, soft, tonal interaction sounds (synthesised live with Web Audio),
  // all from one C-major pentatonic scale so they always sound gentle together.
  //   start()    – a soft rising "whoop" as the paper appears
  //   flop()     – a low, round "boop" when the paper lands on the roller
  //   progress() – a quiet rising arpeggio as the roller paints upward,
  //                then a little chime when the wallpaper is done
  //   bloop()    – a cute falling "bloop" for each chat that falls off
  const sfx = (() => {
    const enabled = new URLSearchParams(location.search).get('sound') !== '0';
    const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760]; // C5–A6
    const ARP_AT = [0.08, 0.28, 0.48, 0.68];
    const ARP = [523.25, 659.25, 783.99, 1046.5];
    let ac = null, out = null;
    let step = 0, chimed = false, nextBloop = 0;

    function unlock() {
      if (!enabled) return;
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ac = new AC();
        // warm bus: soft top end, a touch of room, gentle compression
        out = ac.createGain();
        out.gain.value = CONFIG.soundVolume;
        const tone = ac.createBiquadFilter();
        tone.type = 'lowpass'; tone.frequency.value = 5000; tone.Q.value = 0.3;
        const comp = ac.createDynamicsCompressor();
        comp.threshold.value = -20; comp.knee.value = 18; comp.ratio.value = 2.5;
        const room = ac.createConvolver();
        room.buffer = roomImpulse(1.2);
        const wet = ac.createGain(); wet.gain.value = 0.2;
        out.connect(tone).connect(comp);
        tone.connect(room).connect(wet).connect(comp);
        comp.connect(ac.destination);
      }
      if (ac.state === 'suspended') ac.resume();
    }

    function roomImpulse(sec) {
      const len = Math.floor(ac.sampleRate * sec);
      const buf = ac.createBuffer(2, len, ac.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = buf.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      }
      return buf;
    }

    const ok = () => ac && ac.state !== 'closed';
    const panTo = (x) => {
      const p = ac.createStereoPanner ? ac.createStereoPanner() : ac.createGain();
      if (p.pan) p.pan.value = x;
      p.connect(out);
      return p;
    };

    // soft bell: sine with faint upper partials, quick attack, gentle decay
    function bell(f, t, gain, decay, pan = 0) {
      const dest = panTo(pan);
      for (const [mult, level] of [[1, 1], [2, 0.16], [3, 0.04]]) {
        const o = ac.createOscillator();
        o.type = 'sine';
        o.frequency.value = f * mult;
        const e = ac.createGain();
        const d = decay / mult;
        e.gain.setValueAtTime(0.0001, t);
        e.gain.exponentialRampToValueAtTime(gain * level, t + 0.006);
        e.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(e).connect(dest);
        o.start(t);
        o.stop(t + d + 0.05);
      }
    }

    // pitch-glide blip: rising = "whoop", falling = "bloop"
    function glide(f0, f1, t, gain, dur, pan = 0) {
      const o = ac.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const e = ac.createGain();
      e.gain.setValueAtTime(0.0001, t);
      e.gain.exponentialRampToValueAtTime(gain, t + 0.008);
      e.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.06);
      o.connect(e).connect(panTo(pan));
      o.start(t);
      o.stop(t + dur + 0.1);
    }

    function start() {
      step = 0; chimed = false; nextBloop = 0;
      if (!ok()) return;
      glide(392, 784, ac.currentTime + 0.01, 0.09, 0.16);
    }

    function flop() {
      if (!ok()) return;
      const t = ac.currentTime;
      glide(330, 196, t, 0.16, 0.12);
      bell(392, t + 0.01, 0.04, 0.5);
    }

    function progress(roll) {
      if (!ok()) return;
      while (step < ARP_AT.length && roll >= ARP_AT[step]) {
        bell(ARP[step], ac.currentTime, 0.06, 0.9);
        step++;
      }
      if (!chimed && roll >= 0.86) {
        chimed = true;
        const t = ac.currentTime;
        bell(1046.5, t, 0.08, 1.4, -0.15);
        bell(1318.51, t + 0.07, 0.065, 1.4, 0.15);
        bell(1567.98, t + 0.14, 0.05, 1.6);
      }
    }

    function bloop(side, r) {
      if (!ok()) return;
      const now = ac.currentTime;
      if (nextBloop - now > 0.25) return; // never lag far behind the motion
      const t = Math.max(now, nextBloop);
      nextBloop = t + 0.045;              // little gaps make the cascade sound tidy
      const f = PENTA[5 + Math.floor(r * 5)];
      glide(f, f * 0.62, t, 0.08, 0.09, side * 0.5);
    }

    function reset() { step = 0; chimed = false; nextBloop = 0; }

    return { unlock, start, flop, progress, bloop, reset };
  })();

  // ---------------------------------------------------------------- DOM
  const stage = document.getElementById('stage');
  const wpBase = document.getElementById('wpBase');
  const sheet = document.getElementById('sheet');
  const sheetImage = document.getElementById('sheetImage');
  const flapCanvas = document.getElementById('flap');
  const roller = document.getElementById('roller');
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
  let sweepDone = false, returnStart = -1;
  let flopped = false;
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

  function measure() {
    const s = stage.getBoundingClientRect();
    W = s.width;
    H = s.height;
    sheet.style.setProperty('--sheet-h', H + 'px');

    // background-size: cover, centred — same mapping for the DOM layer and the canvas
    const iw = paperImg.naturalWidth || 1601, ih = paperImg.naturalHeight || 2400;
    const sc = Math.max(W / iw, H / ih);
    cover = { sc, bx: (W - iw * sc) / 2, by: (H - ih * sc) / 2 };

    // Flap canvas: tall enough for the flap plus a little overhang below the roller line
    canvasH = Math.ceil(CONFIG.flapLength * 1.9 + 90);
    canvasHinge = canvasH - 70;
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
    const enterFrom = H + CONFIG.flapLength + 70;  // everything starts below the screen
    const rollTo = -(CONFIG.rollerHeight - CONFIG.rollerHeadCenter + 30); // roller fully past the top
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
  const NU = 22, NS = 44;                 // mesh resolution (across × along)
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
      precision mediump float;
      uniform sampler2D uTex;
      uniform vec3 uBack;
      uniform float uShadow;    // 1 = drawing the cast shadow
      varying vec2 vUV; varying vec2 vLight; varying float vSpec; varying float vAlpha;
      void main() {
        if (uShadow > 0.5) { gl_FragColor = vec4(0.0, 0.0, 0.0, vAlpha); return; }
        vec3 c;
        if (gl_FrontFacing) {
          c = texture2D(uTex, vUV).rgb * vLight.x + vec3(vSpec);
        } else {
          c = uBack * vLight.y;
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
    const L = (() => { const v = [0, -0.32, 0.95]; const n = Math.hypot(...v); return v.map((c) => c / n); })();
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
      draw(lineY, paperRow, tSec) {
        if (!texReady) upload();
        const len = CONFIG.flapLength;
        const persp = CONFIG.perspective;
        const cx = W / 2, cy = H * 0.45;
        const base = CONFIG.flapBaseAngle;
        const tip = CONFIG.flapTipAngle + droop + Math.sin(tSec * 7.3) * CONFIG.flutter;
        const sag = CONFIG.cornerSag + droop * 0.25;
        const twist = Math.sin(tSec * 3.7 + 0.8) * CONFIG.twist;
        const sway = Math.sin(tSec * 4.1 + 0.6) * 5;
        const OVERLAP = 6;                         // px of mesh tucked under the stuck paper
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
              const f = Math.pow(sm / len, CONFIG.flapCurl);
              const lean = base * smoothstep(sm / (len * 0.16)); // soft crease at the roller, not a hard fold
              const phi = rad(lean + (tip - base) * f + sag * xn * xn * f + twist * xn * f);
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
            const Y = cy + (y - cy) * kk;
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
            const front = clamp(1 - 0.62 * (FLAT_LIT - lit), 0.4, 1.04); // flat paper = exactly 1
            const back = clamp(0.62 + 0.42 * -lit, 0.5, 1.0);
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
            verts[o + 8] = 1;

            // cast shadow on the old wallpaper: the lifted paper throws a soft
            // shadow slightly above itself
            const shY = cy + (y - z * 0.42 - cy) * 1;
            const edgeFade = 1 - Math.pow(Math.abs(j / NU * 2 - 1), 6);
            shadowVerts[o] = (X / W) * 2 - 1;
            shadowVerts[o + 1] = 1 - ((shY - offY) / canvasH) * 2;
            shadowVerts[o + 2] = 0.999;
            shadowVerts[o + 8] = 0.3 * Math.pow(clamp(z / (maxZ * 0.5)), 0.8) * edgeFade * (1 - smoothstep((s / len - 0.82) / 0.18));
          }
        }

        gl.clearColor(0, 0, 0, 0);
        gl.clearDepth(1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        const count = NS * NU * 6;

        // shadow (no depth write, blended)
        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.uniform1f(uShadow, 1);
        gl.bufferData(gl.ARRAY_BUFFER, shadowVerts, gl.DYNAMIC_DRAW);
        gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);

        // paper (depth tested so the curl overlaps itself correctly)
        gl.disable(gl.BLEND);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.uniform1f(uShadow, 0);
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
    const target = clamp(v * CONFIG.droopPerSpeed, -12, CONFIG.droopMax);
    const acc = CONFIG.flapStiffness * (target - droop) - CONFIG.flapDamping * droopVel;
    droopVel += acc * dt;
    droop += droopVel * dt;
    const edgeSpeed = Math.max(0, v);
    sfx.progress(line.roll);
    if (!flopped && t >= CONFIG.enterDuration) { flopped = true; sfx.flop(); }
    last = { now, y: line.y };

    // Stuck paper: clipped at the roller line, image fixed to the paper
    const lineY = snap(line.y);
    sheet.style.transform = `translate3d(0, ${lineY}px, 0)`;
    sheetImage.style.transform = `translate3d(0, ${snap(-line.paperRow)}px, 0)`;

    // Loose flap
    flapCanvas.style.transform = `translate3d(0, ${snap(line.y - canvasHinge)}px, 0)`;
    const edge = (flapGL ? flapGL.draw(line.y, line.paperRow, tSec) : line.y) - 2;

    // Roller: head on the roller line, tiny hand sway, lifts off at the very end
    const sway = Math.sin(tSec * 6.5) * 1.4;
    const tilt = Math.sin(tSec * 5.1 + 0.4) * 0.8;
    const lift = smoothstep((line.roll - 0.84) / 0.16);
    roller.style.transform =
      `translate3d(${sway.toFixed(2)}px, ${snap(line.y - CONFIG.rollerHeadCenter)}px, 0) rotate(${tilt.toFixed(2)}deg) scale(${(1 + lift * 0.05).toFixed(4)})`;
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
          sfx.bloop(b.side, b.pitch);
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
      if (returnStart >= 0) b.el.style.opacity = (1 - clamp((t - returnStart) / CONFIG.flyFadeOut)).toFixed(3);

      // Off-screen, or fallen under the stuck paper
      const under = b.top + y > line.y + 20;
      const offscreen = b.left + x > W + 40 || b.right + x < -40 || b.top + y > H + 40;
      if (offscreen || under) {
        b.gone = true;
        b.goneAt = t;
        b.el.style.visibility = 'hidden';
      }
    }

    if (returnStart < 0 && line.roll >= CONFIG.returnAtRoll) startReturn(t);
    if (returnStart >= 0) flyLayer.style.opacity = (1 - clamp((t - returnStart - CONFIG.flyFadeOut) / 120)).toFixed(3);

    if (line.roll >= 1) {
      wpBase.classList.add('is-new');
      sheet.classList.remove('is-active');
      flapCanvas.classList.remove('is-active');
      roller.classList.remove('is-active');
      sweepDone = true;
    }
  }

  // ---------------------------------------------------------------- return
  // The real chat comes back while a copy of it is still falling away, so the
  // return never waits on a flying bubble. Newest message first: each bubble
  // rises a short way into its slot while fading in, cascading up the column.
  // The chat sits above the new paper (still under the flap and roller) so it
  // can come in while the roller is finishing at the top.
  // The real chat is already parked (lowered, nearly transparent) from the tap
  // on, so starting the return only changes transforms and opacity.
  function parkChat() {
    chat.classList.add('is-over');
    const rise = H * CONFIG.returnRise;
    const order = bubbles.filter((b) => b.bottom > 0).sort((a, b) => b.bottom - a.bottom);
    bubbles.forEach((b) => { b.delay = -1; b.home.style.transform = ''; b.home.style.opacity = HIDDEN; });
    order.forEach((b, i) => {
      b.delay = i * CONFIG.returnStagger;
      b.home.style.transform = `translate3d(0, ${rise}px, 0)`;
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
      const k = spring(local / 1000, CONFIG.returnSpring);
      const y = rise * (1 - k);
      if (local < CONFIG.returnFade || Math.abs(y) > 0.3) settled = false;
      b.home.style.transform = `translate3d(0, ${snap(y).toFixed(2)}px, 0)`;
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
      const settled = returnStart >= 0 && updateReturn(t);
      if (sweepDone && settled && t - returnStart > CONFIG.flyFadeOut + 120) {
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
    sfx.reset();
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
    sfx.unlock(); // must happen inside the tap for mobile browsers
    starting = true;
    await paperReady;
    starting = false;
    resetToInitial();

    measure();
    // The copy does the falling; the real chat is parked and comes back later.
    flyLayer.classList.remove('is-idle');
    parkChat();
    hint.classList.add('is-hidden');
    last = null; droop = 0; droopVel = 0;
    sweepDone = false; returnStart = -1;

    sheet.classList.add('is-active');
    flapCanvas.classList.add('is-active');
    roller.classList.add('is-active');
    roller.style.opacity = '1';
    flopped = false;
    sfx.start();

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
