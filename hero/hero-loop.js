/*
 * Hero loop — "From making things move to making things work."
 *
 * One continuous 15 s loop on a transparent canvas:
 *   1. a ball bounces in place
 *   2. it condenses into a dot and three more slide out (a dot loader)
 *   3. the dots become fingernails; the loader wave turns into drumming fingers
 *   4. the camera pulls back, orbits, and settles over the shoulder
 *   5. it pushes into the laptop screen, where the same ball is bouncing
 *
 * The screen is a stencil "portal" onto a second copy of shot 1, placed so that the
 * final camera pose sees exactly what the first frame sees. The loop therefore has
 * no cut and no fade at the seam.
 *
 * Needs three.js r160 (global THREE). Usage:
 *   const loop = HeroLoop.init(canvas, { theme: 'dark' });
 *   loop.setTheme('light'); loop.pause(); loop.play(); loop.seek(seconds);
 */
(function () {
  'use strict';
  var T3 = window.THREE;
  if (!T3) { console.error('HeroLoop: three.js is not loaded'); return; }

  // ───────────────────────────── timing (seconds)
  var LOOP = 15, BOUNCE = 1.25;
  var TL = {
    land: 3.125,                 // third contact: the ball stops bouncing
    condEnd: 3.65,               // ball has become a dot
    emerge: 3.55,                // other three dots start sliding out
    wave: 4.25,                  // loader wave begins
    waveOut: [8.0, 8.6],         // drumming settles, hand rests
    grow: 5.75,                  // fingers start growing out of the dots
    reveal: [6.4, 7.7, 8.3],     // the world grows outward from the fingertips: hand and arm first, then the rest
    desk: [8.3, 10.0],            // the tabletop spreads out under the hand as the camera lifts away
    screenOn: [8.1, 8.7],
    pushEnd: 14.375              // camera has filled the frame with the screen
  };

  // ───────────────────────────── layout (metres, desk top is y = 0)
  var H = new T3.Vector3(-0.30, 0, 0.16);    // where the ball lands and the fingertips rest
  var BR = 0.026, BH = 0.13, DR = 0.0078, SP = 0.0218;
  var FOV0 = 30;
  var DEG = Math.PI / 180;
  var FINGERS = [                              // pinky → index (person's right hand, seen from the front)
    { L: 0.058, r: 0.0082, dz: -0.026 },
    { L: 0.074, r: 0.0092, dz: -0.008 },
    { L: 0.080, r: 0.0096, dz: 0.000 },
    { L: 0.072, r: 0.0094, dz: -0.010 }
  ];
  var PH = [9 * DEG, 24 * DEG, 24 * DEG];     // resting curl of the three finger joints
  var SEG = [0.45, 0.30, 0.25];
  var HINGE = new T3.Vector3(0.06, 0.012, 0.09), TILT = 18 * DEG;
  var SW = 0.288, SH = 0.180, SCY = 0.104;     // screen size and centre height on the lid

  // ───────────────────────────── helpers
  function clamp(v, a, b) { return Math.min(b === undefined ? 1 : b, Math.max(a === undefined ? 0 : a, v)); }
  function lerp(a, b, u) { return a + (b - a) * u; }
  function seg(t, a, b) { return clamp((t - a) / (b - a)); }
  function sstep(a, b, v) { var u = clamp((v - a) / (b - a)); return u * u * (3 - 2 * u); }
  function eIO(u, p) { p = p || 3; return u < 0.5 ? 0.5 * Math.pow(2 * u, p) : 1 - 0.5 * Math.pow(2 * (1 - u), p); }
  function eOut(u) { return 1 - Math.pow(1 - u, 3); }
  function eBack(u) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); }
  function v3(x, y, z) { return new T3.Vector3(x, y, z); }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function canvasTex(w, h, draw, srgb) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var t = new T3.CanvasTexture(c);
    if (srgb !== false) t.colorSpace = T3.SRGBColorSpace;
    return t;
  }

  // Bounce pose at global time t (phase-locked: apex at t = 0, 1.25, 2.5 …)
  function bouncePose(t) {
    var p = ((t / BOUNCE) + 0.5) % 1;                 // 0 = contact, 0.5 = apex
    var h = BH * 4 * p * (1 - p);                      // gravity arc: slow at the top, fast at the floor
    var d = Math.min(p, 1 - p);
    var sq = 0.20 * Math.exp(-Math.pow(d / 0.045, 2)); // squash on contact
    var st = 0.10 * Math.pow(Math.abs(1 - 2 * p), 4) * (1 - sq / 0.20); // stretch at speed
    var sy = (1 + st) * (1 - sq);
    return { h: h, sy: sy, sx: 1 / Math.sqrt(sy), hn: h / BH };
  }

  // Finger forward kinematics: tip offset from the knuckle for lift angle th
  function fk(def, th, out) {
    var a1 = PH[0] - th, a2 = a1 + PH[1] - 0.3 * th, a3 = a2 + PH[2];
    var l1 = def.L * SEG[0], l2 = def.L * SEG[1], l3 = def.L * SEG[2];
    out.y = -(l1 * Math.sin(a1) + l2 * Math.sin(a2) + l3 * Math.sin(a3));
    out.z = l1 * Math.cos(a1) + l2 * Math.cos(a2) + l3 * Math.cos(a3);
    return out;
  }

  function init(canvas, opts) {
    opts = opts || {};
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var renderer = new T3.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true, stencil: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = T3.SRGBColorSpace;
    renderer.toneMapping = T3.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T3.PCFSoftShadowMap;

    var scene = new T3.Scene();
    var camera = new T3.PerspectiveCamera(FOV0, 1, 0.02, 14);

    // ── environment + lights
    var envTex = canvasTex(256, 128, function (x, w, h) {
      var g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#e9ebff'); g.addColorStop(0.42, '#8a8db8'); g.addColorStop(0.55, '#3b3b55'); g.addColorStop(1, '#12121a');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      var s = x.createRadialGradient(70, 26, 0, 70, 26, 46); s.addColorStop(0, 'rgba(255,248,236,1)'); s.addColorStop(1, 'rgba(255,248,236,0)');
      x.fillStyle = s; x.fillRect(0, 0, w, h);
      s = x.createRadialGradient(200, 40, 0, 200, 40, 40); s.addColorStop(0, 'rgba(150,150,255,.9)'); s.addColorStop(1, 'rgba(150,150,255,0)');
      x.fillStyle = s; x.fillRect(0, 0, w, h);
    });
    envTex.mapping = T3.EquirectangularReflectionMapping;
    var pmrem = new T3.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(envTex).texture;
    envTex.dispose(); pmrem.dispose();

    scene.add(new T3.HemisphereLight(0xe6e8ff, 0x3a3450, 0.8));
    var key = new T3.DirectionalLight(0xfff0e2, 2.3);
    key.position.set(-0.9, 1.7, 1.3); key.target.position.set(0, 0.15, -0.15);
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -0.9; key.shadow.camera.right = 0.9; key.shadow.camera.top = 0.9; key.shadow.camera.bottom = -0.9;
    key.shadow.camera.near = 0.5; key.shadow.camera.far = 5; key.shadow.bias = -0.0006; key.shadow.normalBias = 0.012; key.shadow.radius = 5;
    scene.add(key, key.target);
    var rim = new T3.DirectionalLight(0x8f8dff, 1.9); rim.position.set(0.9, 0.9, -1.4); scene.add(rim);
    var fill = new T3.DirectionalLight(0xcfd4ff, 0.75); fill.position.set(1.0, 0.45, 1.2); scene.add(fill);

    // ── materials
    var fadeU = { uRevealR: { value: -1 }, uRevealW: { value: 0.09 }, uRevealC: { value: new T3.Vector2(H.x, H.z) } };
    var deskU = { uRevealR: { value: -1 }, uRevealW: { value: 0.22 }, uRevealC: fadeU.uRevealC };
    function injectFade(sh) { injectReveal(sh, fadeU); }
    function injectDesk(sh) { injectReveal(sh, deskU); }
    function injectReveal(sh, U) {
      sh.uniforms.uRevealR = U.uRevealR; sh.uniforms.uRevealW = U.uRevealW; sh.uniforms.uRevealC = U.uRevealC;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vFadeW;')
        .replace('#include <project_vertex>', '#include <project_vertex>\n{ vec4 fw = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n fw = instanceMatrix * fw;\n#endif\n vFadeW = (modelMatrix * fw).xyz; }');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vFadeW;\nuniform float uRevealR, uRevealW; uniform vec2 uRevealC;\nfloat fadeIgn(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }')
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n{ float fa = 1.0 - smoothstep(uRevealR - uRevealW, uRevealR, distance(vFadeW.xz, uRevealC));\n if (fa < fadeIgn(gl_FragCoord.xy) * 0.998 + 0.001) discard; }');
    }
    function fadeMat(p) { var m = new T3.MeshStandardMaterial(p); m.onBeforeCompile = injectFade; return m; }
    var fadeDepth = new T3.MeshDepthMaterial({ depthPacking: T3.RGBADepthPacking }); fadeDepth.onBeforeCompile = injectFade;

    var skinCol = 0xb87c55;
    var M = {
      skin: fadeMat({ color: skinCol, roughness: 0.52, envMapIntensity: 0.55 }),
      skinPlain: new T3.MeshStandardMaterial({ color: skinCol, roughness: 0.52, envMapIntensity: 0.55 }),
      nail: new T3.MeshStandardMaterial({ color: 0xf1cdbd, roughness: 0.22, envMapIntensity: 1.1 }),
      nailFade: fadeMat({ color: 0xf1cdbd, roughness: 0.22, envMapIntensity: 1.1 }),
      shirt: fadeMat({ color: 0x77714b, roughness: 0.92, envMapIntensity: 0.3 }),
      shirtDark: fadeMat({ color: 0x5e5a3b, roughness: 0.92, envMapIntensity: 0.3 }),
      hair: fadeMat({ color: 0x15100e, roughness: 0.55, envMapIntensity: 0.5 }),
      dark: fadeMat({ color: 0x1a1412, roughness: 0.6 }),
      chair: fadeMat({ color: 0x4c4d68, roughness: 0.85, envMapIntensity: 0.4 }),
      alu: fadeMat({ color: 0xc9ccd6, roughness: 0.34, metalness: 0.85, envMapIntensity: 1.0 }),
      bezel: fadeMat({ color: 0x08080b, roughness: 0.4, envMapIntensity: 0.4 }),
      desk: new T3.MeshStandardMaterial({ color: 0x1d1d2a, roughness: 0.8, envMapIntensity: 0.3 })
    };

    var matcap = canvasTex(512, 512, function (x) {
      x.fillStyle = '#5750b8'; x.fillRect(0, 0, 512, 512);
      var g = x.createRadialGradient(200, 172, 10, 256, 256, 262);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.22, '#f4f3fc'); g.addColorStop(0.5, '#d3d1ee'); g.addColorStop(0.78, '#9f9bdc'); g.addColorStop(1, '#6862c6');
      x.fillStyle = g; x.beginPath(); x.arc(256, 256, 256, 0, 7); x.fill();
      g = x.createRadialGradient(352, 404, 0, 352, 404, 170); g.addColorStop(0, 'rgba(230,226,255,.7)'); g.addColorStop(1, 'rgba(230,226,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 512, 512);
      g = x.createRadialGradient(176, 150, 0, 176, 150, 74); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 512, 512);
    });
    var pearl = new T3.MeshMatcapMaterial({ matcap: matcap, toneMapped: false });
    var stencilEq = { stencilWrite: true, stencilFunc: T3.EqualStencilFunc, stencilRef: 1, stencilFail: T3.KeepStencilOp, stencilZFail: T3.KeepStencilOp, stencilZPass: T3.KeepStencilOp, depthTest: false, depthWrite: false, transparent: true };
    var pearlMini = new T3.MeshMatcapMaterial(Object.assign({ matcap: matcap, toneMapped: false }, stencilEq));

    var blobTex = canvasTex(128, 128, function (x) {
      var g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    });
    function blobMat(extra) { return new T3.MeshBasicMaterial(Object.assign({ map: blobTex, transparent: true, depthWrite: false, toneMapped: false }, extra || {})); }

    var GEO = {
      sphere: new T3.SphereGeometry(1, 48, 32),
      sphereLo: new T3.SphereGeometry(1, 20, 14),
      plane: new T3.PlaneGeometry(1, 1)
    };
    var Y = v3(0, 1, 0);

    // tapered limb with rounded ends, from a (radius r1) to b (radius r2)
    function limb(parent, a, b, r1, r2, mat, fade) {
      var d = b.clone().sub(a), len = d.length();
      var cyl = new T3.Mesh(new T3.CylinderGeometry(r2, r1, len, 28, 1, true), mat);
      cyl.position.copy(a).addScaledVector(d, 0.5); cyl.quaternion.setFromUnitVectors(Y, d.clone().normalize());
      var s1 = new T3.Mesh(GEO.sphereLo, mat); s1.position.copy(a); s1.scale.setScalar(r1);
      var s2 = new T3.Mesh(GEO.sphereLo, mat); s2.position.copy(b); s2.scale.setScalar(r2);
      [cyl, s1, s2].forEach(function (m) { shadowed(m, fade); parent.add(m); });
    }
    function ball(parent, pos, scale, mat, fade, geo) {
      var m = new T3.Mesh(geo || GEO.sphereLo, mat); m.position.copy(pos);
      if (typeof scale === 'number') m.scale.setScalar(scale); else m.scale.copy(scale);
      shadowed(m, fade); parent.add(m); return m;
    }
    function shadowed(m, fade) { m.castShadow = true; m.receiveShadow = true; if (fade !== false) m.customDepthMaterial = fadeDepth; return m; }
    function roundedSlab(w, h, r, depth, bevel) {
      bevel = bevel === undefined ? 0.012 : bevel;
      var s = new T3.Shape(), x = -w / 2, y = -h / 2;
      s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
      s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
      s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
      return new T3.ExtrudeGeometry(s, { depth: depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 8, curveSegments: 12 });
    }

    // ───────────────────────────── hero: ball, dots, their ground glow
    var hero = new T3.Group(); scene.add(hero);
    var dots = [], dotBlobs = [];
    var blobBall = blobMat({ color: 0x8785ff, opacity: 0.4 });
    for (var i = 0; i < 4; i++) {
      var dm = new T3.Mesh(GEO.sphere, pearl); hero.add(dm); dots.push(dm);
      var db = new T3.Mesh(GEO.plane, blobBall); db.rotation.x = -Math.PI / 2; db.renderOrder = 1; hero.add(db); dotBlobs.push(db);
    }

    // ───────────────────────────── world: everything that dissolves in later
    var world = new T3.Group(); scene.add(world);

    // desk: a thin tabletop, plus a transparent plane just above it that carries all the shadows
    M.desk.onBeforeCompile = injectDesk;
    var desk = new T3.Mesh(roundedSlab(1.24, 0.78, 0.07, 0.016, 0.006), M.desk);
    desk.rotation.x = -Math.PI / 2; desk.position.set(0, -0.0222, 0.05); world.add(desk);
    var shadowMat = new T3.ShadowMaterial({ opacity: 0.4, depthWrite: false });
    var deskShadow = new T3.Mesh(GEO.plane, shadowMat); deskShadow.rotation.x = -Math.PI / 2; deskShadow.scale.set(1.25, 0.79, 1);
    deskShadow.position.set(0, 0.0004, 0.05); deskShadow.receiveShadow = true; scene.add(deskShadow);

    // right hand: four articulated fingers (plain material, they grow from the dots)
    var fingers = new T3.Group(); scene.add(fingers);
    var F = FINGERS.map(function (def, idx) {
      var l = [def.L * SEG[0], def.L * SEG[1], def.L * SEG[2]];
      var r = [def.r, def.r * 0.94, def.r * 0.88, def.r * 0.8];
      var root = new T3.Group(), j1 = new T3.Group(), j2 = new T3.Group(), j3 = new T3.Group();
      fingers.add(root); root.add(j1); j1.add(j2); j2.add(j3); j2.position.z = l[0]; j3.position.z = l[1];
      [j1, j2, j3].forEach(function (j, k) { limb(j, v3(0, 0, 0), v3(0, 0, l[k]), r[k], r[k + 1], M.skinPlain, false); });
      var nail = new T3.Mesh(GEO.sphereLo, M.nail); nail.position.set(0, r[3] * 0.62, l[2] * 0.62);
      nail.userData.s = v3(r[3] * 0.78, r[3] * 0.34, l[2] * 0.44); nail.rotation.x = -0.12; nail.castShadow = true; j3.add(nail);
      return { def: def, root: root, j1: j1, j2: j2, j3: j3, nail: nail, x: H.x + (idx - 1.5) * SP, K: v3(), tip: v3() };
    });

    // knuckle positions once the hand has settled (used to place palm, wrist, arm)
    var tmp = v3(), tmp2 = v3();
    var Kfinal = F.map(function (f) { fk(f.def, 0, tmp); return v3(f.x, f.def.r * 0.8 - tmp.y, H.z + f.def.dz - tmp.z); });
    var palmC = v3((Kfinal[0].x + Kfinal[3].x) / 2 + 0.002, 0.039, H.z - 0.112);
    var WRIST = v3(H.x + 0.006, 0.028, H.z - 0.180), ELBOW = v3(-0.345, 0.045, -0.26), SHO_R = v3(-0.20, 0.335, -0.475);

    var rhand = new T3.Group(); world.add(rhand);
    var palm = new T3.Mesh(roundedSlab(0.074, 0.100, 0.026, 0.008, 0.011), M.skin);
    palm.position.copy(palmC).add(v3(0, -0.013, 0)); palm.rotation.x = -Math.PI / 2 - 0.13; shadowed(palm); rhand.add(palm);
    Kfinal.forEach(function (k, n) { ball(rhand, k.clone().add(v3(0, -0.002, -0.004)), FINGERS[n].r * 1.16, M.skin); });
    var thA = v3(H.x + 0.040, 0.030, H.z - 0.135), thB = v3(H.x + 0.066, 0.024, H.z - 0.092), thC = v3(H.x + 0.074, 0.0095, H.z - 0.056);
    limb(rhand, thA, thB, 0.0135, 0.0115, M.skin); limb(rhand, thB, thC, 0.0115, 0.0096, M.skin);
    var thNail = ball(rhand, thC.clone().add(v3(0.001, 0.0068, -0.004)), v3(0.0074, 0.0032, 0.009), M.nailFade); thNail.rotation.x = 0.42;
    var cuff = WRIST.clone().lerp(ELBOW, 0.13);
    var wrist = new T3.Group(); wrist.position.copy(WRIST); wrist.scale.set(1.42, 0.82, 1); rhand.add(wrist);
    limb(wrist, palmC.clone().add(v3(0, -0.006, -0.036)).sub(WRIST), v3(0, 0, 0), 0.0215, 0.0205, M.skin);
    limb(wrist, v3(0, 0, 0), cuff.clone().sub(WRIST), 0.0205, 0.0225, M.skin);
    limb(rhand, cuff, cuff.clone().lerp(ELBOW, 0.07), 0.038, 0.038, M.shirtDark);
    limb(rhand, cuff, ELBOW, 0.035, 0.046, M.shirt);

    // body
    var body = new T3.Group(); world.add(body);
    limb(body, ELBOW, SHO_R, 0.047, 0.056, M.shirt);
    var SHO_L = v3(0.20, 0.335, -0.475), ELBOW_L = v3(0.36, 0.045, -0.25), WRIST_L = v3(0.315, 0.030, -0.03);
    limb(body, ELBOW_L, SHO_L, 0.047, 0.056, M.shirt);
    limb(body, WRIST_L.clone().lerp(ELBOW_L, 0.12), ELBOW_L, 0.035, 0.046, M.shirt);
    limb(body, WRIST_L, WRIST_L.clone().lerp(ELBOW_L, 0.14), 0.0255, 0.027, M.skin);
    var lh = v3(0.300, 0.022, 0.035);
    ball(body, lh, v3(0.043, 0.016, 0.052), M.skin, true, GEO.sphere).rotation.x = -0.1;
    [-0.030, -0.011, 0.008, 0.027].forEach(function (dx, n) {
      var len = [0.050, 0.062, 0.066, 0.058][n], a = lh.clone().add(v3(dx, 0.004, 0.040)), b = a.clone().add(v3(dx * 0.12, -0.006, len * 0.62)), c = b.clone().add(v3(dx * 0.05, -0.012, len * 0.36));
      limb(body, a, b, 0.0088, 0.0082, M.skin); limb(body, b, c, 0.0082, 0.0072, M.skin);
    });
    limb(body, lh.clone().add(v3(-0.036, 0, 0.0)), lh.clone().add(v3(-0.058, -0.008, 0.045)), 0.0115, 0.0095, M.skin);

    var torso = new T3.Mesh(roundedSlab(0.30, 0.42, 0.11, 0.03, 0.082), M.shirt);
    torso.position.set(0, 0.105, -0.50); torso.rotation.x = 0.10; shadowed(torso); body.add(torso);
    ball(body, SHO_R, 0.06, M.shirt); ball(body, SHO_L, 0.06, M.shirt);
    limb(body, v3(0, 0.385, -0.47), v3(0, 0.50, -0.452), 0.054, 0.05, M.skin);

    var head = new T3.Group(); head.position.set(0, 0.578, -0.437); head.rotation.set(0.34, 0.06, 0); head.scale.setScalar(1.13); body.add(head);
    ball(head, v3(0, -0.014, 0.004), v3(0.087, 0.119, 0.096), M.skin, true, GEO.sphere);
    ball(head, v3(-0.087, -0.012, -0.006), v3(0.012, 0.024, 0.018), M.skin); ball(head, v3(0.087, -0.012, -0.006), v3(0.012, 0.024, 0.018), M.skin);
    ball(head, v3(0, -0.022, 0.094), v3(0.013, 0.02, 0.016), M.skin);
    ball(head, v3(-0.033, 0.003, 0.085), v3(0.0062, 0.0064, 0.0045), M.dark); ball(head, v3(0.033, 0.003, 0.085), v3(0.0062, 0.0064, 0.0045), M.dark);
    [[-1, 0.12], [1, -0.12]].forEach(function (s) {
      var b = new T3.Mesh(new T3.CapsuleGeometry(0.0028, 0.019, 4, 10), M.hair); b.position.set(s[0] * 0.034, 0.026, 0.088); b.rotation.z = Math.PI / 2 + s[1]; shadowed(b); head.add(b);
      var m = new T3.Mesh(new T3.CapsuleGeometry(0.0058, 0.02, 4, 10), M.hair); m.position.set(s[0] * 0.015, -0.049, 0.086); m.rotation.z = Math.PI / 2 - s[1] * 2.2; shadowed(m); head.add(m);
    });
    // hair: a cap that sits higher at the forehead than at the nape, covered in small curls
    (function () {
      var TILT_H = 0.74, cap = new T3.Mesh(new T3.SphereGeometry(1, 36, 20, 0, Math.PI * 2, 0, Math.PI * 0.5), M.hair);
      cap.scale.set(0.0915, 0.111, 0.0995); cap.rotation.x = -TILT_H; cap.position.set(0, 0.003, -0.004); shadowed(cap); head.add(cap);
      var R = rng(11), list = [], d = v3(), dl = v3(), ax = v3(1, 0, 0);
      for (var n = 0; n < 1400 && list.length < 230; n++) {
        d.set(R() * 2 - 1, R() * 2 - 1, R() * 2 - 1); if (d.lengthSq() < 0.05 || d.lengthSq() > 1) continue; d.normalize();
        dl.copy(d).applyAxisAngle(ax, TILT_H);                     // direction in the cap's own frame
        if (dl.y < -0.06) continue;
        if (d.z > 0.35 && dl.y < 0.48) continue;                      // keep the forehead clean
        var top = clamp((dl.y + 0.06) / 1.06), edge = 1 - sstep(0.0, 0.35, dl.y + 0.06);
        var lift = 1.01 + 0.13 * top * top;
        list.push({ p: v3(d.x * 0.0915 * lift, d.y * 0.111 * lift + 0.003, d.z * 0.0995 * lift - 0.004), s: lerp(0.0125, 0.0235, top) * (0.78 + 0.44 * R()) * (1 - 0.3 * edge) });
      }
      var hair = new T3.InstancedMesh(GEO.sphereLo, M.hair, list.length), mt = new T3.Matrix4(), q = new T3.Quaternion(), sc = v3();
      list.forEach(function (o, k) { sc.set(o.s, o.s * (0.85 + 0.3 * R()), o.s); mt.compose(o.p, q, sc); hair.setMatrixAt(k, mt); });
      shadowed(hair); head.add(hair);
    })();

    var chair = new T3.Mesh(roundedSlab(0.52, 0.60, 0.11, 0.045), M.chair);
    chair.position.set(0, 0.03, -0.70); chair.rotation.x = -0.08; shadowed(chair); body.add(chair);

    // laptop
    var laptop = new T3.Group(); laptop.position.copy(HINGE); world.add(laptop);
    var base = new T3.Mesh(roundedSlab(0.308, 0.212, 0.012, 0.008, 0.002), M.alu); base.rotation.x = -Math.PI / 2; base.position.set(0, -0.010, -0.108); shadowed(base); laptop.add(base);
    var keysTex = canvasTex(1024, 704, function (x, w, h) {
      x.fillStyle = '#c9ccd6'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#0f0f14'; x.beginPath(); x.roundRect(48, 300, w - 96, 356, 16); x.fill();   // key well (hinge side is the bottom of this canvas)
      x.fillStyle = '#22222b';
      for (var r = 0; r < 5; r++) for (var c = 0; c < 14; c++) { x.beginPath(); x.roundRect(60 + c * 64.6, 312 + r * 68, 56, 58, 8); x.fill(); }
      x.fillStyle = '#b9bcc7'; x.beginPath(); x.roundRect(w / 2 - 190, 36, 380, 232, 18); x.fill();                 // trackpad
    });
    keysTex.anisotropy = 8;
    var deck = new T3.Mesh(GEO.plane, fadeMat({ map: keysTex, roughness: 0.5, metalness: 0.5, envMapIntensity: 0.8 }));
    deck.scale.set(0.298, 0.204, 1); deck.rotation.x = -Math.PI / 2; deck.position.set(0, 0.0006, -0.108); deck.receiveShadow = true; laptop.add(deck);
    var lid = new T3.Group(); lid.rotation.x = TILT; laptop.add(lid);
    var lidBack = new T3.Mesh(roundedSlab(0.308, 0.200, 0.012, 0.002, 0.002), M.alu); lidBack.position.set(0, 0.104, 0.003); shadowed(lidBack); lid.add(lidBack);
    var lidFace = new T3.Mesh(GEO.plane, M.bezel); lidFace.scale.set(0.304, 0.197, 1); lidFace.rotation.y = Math.PI; lidFace.position.set(0, SCY, 0.0007); lid.add(lidFace);

    // the screen: a stencil window. Its content lives in `mini`, a copy of shot 1.
    // It sits in its own group so it can outlive the laptop at the end of the loop.
    var screen = new T3.Group(); screen.position.copy(HINGE); screen.rotation.x = TILT; scene.add(screen);
    var mask = new T3.Mesh(GEO.plane, new T3.MeshBasicMaterial({ colorWrite: false, depthWrite: false, stencilWrite: true, stencilRef: 1, stencilFunc: T3.AlwaysStencilFunc, stencilZPass: T3.ReplaceStencilOp }));
    mask.scale.set(SW, SH, 1); mask.rotation.y = Math.PI; mask.position.set(0, SCY, 0.0003); mask.renderOrder = 5; screen.add(mask);
    var glassTex = canvasTex(8, 128, function () {}), glassMat = new T3.MeshBasicMaterial(Object.assign({ map: glassTex, toneMapped: false }, stencilEq));
    var glass = new T3.Mesh(GEO.plane, glassMat); glass.scale.set(SW * 1.02, SH * 1.02, 1); glass.rotation.y = Math.PI; glass.position.set(0, SCY, 0.0002); glass.renderOrder = 20; screen.add(glass);
    var screenGlow = new T3.PointLight(0xaab0ff, 0, 1.3, 2); screen.add(screenGlow); screenGlow.position.set(0, SCY, -0.12);

    var mini = new T3.Group(); scene.add(mini);
    var miniBlobMat = blobMat(Object.assign({ color: 0x8785ff, opacity: 0.4 }, stencilEq));
    var miniBlob = new T3.Mesh(GEO.plane, miniBlobMat); miniBlob.rotation.x = -Math.PI / 2; miniBlob.renderOrder = 21; mini.add(miniBlob);
    var miniBall = new T3.Mesh(GEO.sphere, pearlMini); miniBall.renderOrder = 22; mini.add(miniBall);

    // ───────────────────────────── camera
    var P0 = H.clone().add(v3(0, 0.098, 0.445)), T0 = H.clone().add(v3(0, 0.085, 0));
    var cam0 = new T3.PerspectiveCamera(), camF = new T3.PerspectiveCamera(), screenC = v3(), screenN = v3(), moves = [];
    cam0.position.copy(P0); cam0.up.set(0, 1, 0); cam0.lookAt(T0); cam0.updateMatrix();

    function K(p, t, f) { return { p: p, t: t, f: f }; }
    function move(t0, t1, pow, keys) {
      var pc = new T3.CatmullRomCurve3(keys.map(function (k) { return k.p; }), false, 'centripetal');
      var tc = new T3.CatmullRomCurve3(keys.map(function (k) { return k.t; }), false, 'centripetal');
      var n = keys.length - 1, knots = [0], total = 0, prev = pc.getPoint(0), acc = [0];
      for (var s = 1; s <= n * 60; s++) { var p = pc.getPoint(s / (n * 60)); total += p.distanceTo(prev); prev = p; if (s % 60 === 0) acc.push(total); }
      for (var j = 1; j <= n; j++) knots.push(total > 0 ? acc[j] / total : j / n);
      return { t0: t0, t1: t1, pow: pow, keys: keys, pc: pc, tc: tc, knots: knots, n: n };
    }
    function buildCamera(aspect) {
      screen.updateWorldMatrix(true, false);
      screenC.set(0, SCY, 0.0002).applyMatrix4(screen.matrixWorld);
      screenN.set(0, 0, -1).transformDirection(screen.matrixWorld);
      // distance at which the frame sits just inside the screen
      var d = 0.985 * Math.min(SH, SW / aspect) / (2 * Math.tan(FOV0 * DEG / 2));
      camF.position.copy(screenC).addScaledVector(screenN, d); camF.up.set(0, 1, 0); camF.lookAt(screenC); camF.updateMatrix();
      // similarity transform that maps the first camera onto the last one
      var k = d / P0.distanceTo(T0), Rm = camF.quaternion.clone().multiply(cam0.quaternion.clone().invert());
      mini.quaternion.copy(Rm); mini.scale.setScalar(k);
      mini.position.copy(camF.position).sub(P0.clone().applyQuaternion(Rm).multiplyScalar(k));

      var wide = clamp((1.15 - aspect) / 0.45, 0, 1);        // narrower canvas → step back a little
      var KA = K(P0, T0, FOV0);
      var KB = K(H.clone().add(v3(0.03, 0.102, 0.405)), H.clone().add(v3(0, 0.078, 0)), FOV0);
      var KC = K(H.clone().add(v3(0.115, 0.175, 0.300)), H.clone().add(v3(0, 0.012, -0.004)), 26);
      var KD = K(H.clone().add(v3(0.085, 0.385, 0.215)), H.clone().add(v3(0.012, 0.020, -0.062)), 30);
      var KE = K(v3(-0.98, 0.80, 1.28).multiplyScalar(1 + 0.16 * wide), v3(-0.02, 0.30, -0.24), 34);
      var KG = K(v3(-1.55, 0.88, -0.38).multiplyScalar(1 + 0.12 * wide), v3(0.00, 0.30, -0.22), 34);
      var KH = K(v3(-0.84, 1.02, -1.30).multiplyScalar(1 + 0.08 * wide), v3(-0.10, 0.31, -0.12), 37);
      var KI = K(v3(-0.40, 0.60, -0.62), screenC.clone().add(v3(-0.012, 0.012, 0)), 33);
      var KJ = K(camF.position.clone().add(v3(-0.11, 0.10, -0.03)), screenC.clone(), FOV0);
      var KF = K(camF.position.clone(), screenC.clone(), FOV0);
      moves = [
        move(0, 4.6, 2.2, [KA, KB, KC]),
        move(5.4, 7.8, 2.6, [KC, KD]),
        move(8.25, 11.75, 2.5, [KD, KE, KG, KH]),
        move(12.05, TL.pushEnd, 2.8, [KH, KI, KJ, KF])
      ];
    }
    var cp = v3(), ct = v3();
    function placeCamera(t) {
      var m = moves[0], s = 0;
      for (var i = 0; i < moves.length; i++) { if (t >= moves[i].t0) m = moves[i]; }
      s = eIO(seg(t, m.t0, m.t1), m.pow);
      var j = 0; while (j < m.n - 1 && s > m.knots[j + 1]) j++;
      var f = clamp((s - m.knots[j]) / Math.max(1e-6, m.knots[j + 1] - m.knots[j]));
      m.pc.getPointAt(s, cp); m.tc.getPoint((j + f) / m.n, ct);
      camera.position.copy(cp); camera.up.set(0, 1, 0); camera.lookAt(ct);
      camera.fov = lerp(m.keys[j].f, m.keys[j + 1].f, f * f * (3 - 2 * f));
      if (t >= TL.pushEnd) { camera.position.copy(camF.position); camera.quaternion.copy(camF.quaternion); camera.fov = FOV0; }
      camera.updateProjectionMatrix();
    }

    // ───────────────────────────── per-frame scene state
    var tipV = v3(), nailW = v3();
    function waveLift(t, idx) {
      var env = sstep(TL.wave, TL.wave + 0.3, t) * (1 - sstep(TL.waveOut[0], TL.waveOut[1], t));
      if (env <= 0) return 0;
      var l = t - TL.wave - idx * 0.13; if (l < 0) return 0;
      var ph = (l % 1.1) / 1.1;
      return ph < 0.44 ? 0.34 * env * Math.pow(Math.sin(Math.PI * ph / 0.44), 2) : 0;
    }
    function update(t) {
      var done = t >= TL.pushEnd;

      // ── reveal sweep + things that only exist after it
      fadeU.uRevealR.value = t < TL.reveal[0] ? -1 : (t < TL.reveal[1]
        ? lerp(0, 0.52, eIO(seg(t, TL.reveal[0], TL.reveal[1]), 2))
        : lerp(0.52, 2.6, eIO(seg(t, TL.reveal[1], TL.reveal[2]), 2)));
      deskU.uRevealR.value = t < TL.desk[0] ? -1 : lerp(0, 1.8, eIO(seg(t, TL.desk[0], TL.desk[1]), 3.2));
      world.visible = t >= TL.reveal[0] && !done;
      deskShadow.visible = t >= TL.grow && !done;

      // ── screen
      var on = sstep(TL.screenOn[0], TL.screenOn[1], t);
      var glassA = done ? 1 - sstep(TL.pushEnd + 0.02, LOOP - 0.06, t) : on;
      mask.visible = on > 0; glass.visible = on > 0; glassMat.opacity = glassA;
      mini.visible = on > 0; pearlMini.opacity = on; miniBlobMat.opacity = theme.blobA * on;
      screenGlow.intensity = 0.2 * on * (done ? 0 : 1);
      var bp = bouncePose(t);
      miniBall.position.set(H.x, bp.h + BR * bp.sy, H.z); miniBall.scale.set(BR * bp.sx, BR * bp.sy, BR * bp.sx);
      var bw = BR * 4.2 * (1 - 0.42 * bp.hn);
      miniBlob.position.set(H.x, 0.0004, H.z); miniBlob.scale.set(bw, bw * 0.8, 1);
      miniBlobMat.opacity *= (1 - 0.62 * bp.hn);

      // ── fingers
      var g2 = eIO(seg(t, TL.grow, TL.grow + 1.2), 2.4);      // row of dots → natural fingertip stagger
      fingers.visible = t >= TL.grow && !done;
      for (var i = 0; i < 4; i++) {
        var f = F[i], def = f.def, th = waveLift(t, i);
        var tipY0 = lerp(DR, def.r * 0.8, g2);
        fk(def, 0, tmp); f.K.set(f.x, tipY0 - tmp.y, H.z + def.dz * g2 - tmp.z);
        fk(def, th, tmp2); f.tip.set(f.x, f.K.y + tmp2.y, f.K.z + tmp2.z);
        var s = eIO(seg(t, TL.grow + i * 0.07, TL.grow + i * 0.07 + 1.0), 2.6);
        f.root.position.lerpVectors(f.tip, f.K, s); f.root.scale.setScalar(Math.max(s, 1e-4));
        f.j1.rotation.x = PH[0] - th; f.j2.rotation.x = PH[1] - 0.3 * th; f.j3.rotation.x = PH[2];
        var ns = eIO(seg(t, TL.grow + i * 0.07 + 0.45, TL.grow + i * 0.07 + 1.05), 2);
        f.nail.scale.copy(f.nail.userData.s).multiplyScalar(Math.max(ns, 1e-4));
      }

      // ── ball → dots → nails
      var heroOn = t < TL.grow + 1.6;
      hero.visible = heroOn;
      if (heroOn) {
        var cu = seg(t, TL.land, TL.condEnd), mainX = lerp(H.x, F[1].x, eIO(seg(t, TL.emerge, TL.emerge + 0.6), 3));
        var starts = [TL.emerge + 0.07, 0, TL.emerge, TL.emerge + 0.14];
        if (t >= TL.grow) fingers.updateWorldMatrix(true, true);
        for (var d = 0; d < 4; d++) {
          var dot = dots[d], blob = dotBlobs[d], fd = F[d], x, r, sy = 1, sx = 1, y, hn = 0;
          if (t < TL.land) {
            if (d !== 1) { dot.visible = blob.visible = false; continue; }
            x = H.x; r = BR; sy = bp.sy; sx = bp.sx; y = bp.h + BR * bp.sy; hn = bp.hn;
          } else if (d === 1) {
            x = mainX; r = lerp(BR, DR, eIO(cu, 2.6));
            sy = 1 - 0.20 * Math.exp(-Math.pow(cu / 0.1, 2)); sx = 1 / Math.sqrt(sy);
            var hop = 0.032 * Math.sin(Math.PI * cu); y = r * sy + hop; hn = hop / 0.06;
          } else {
            var u = seg(t, starts[d], starts[d] + 0.55); if (u <= 0) { dot.visible = blob.visible = false; continue; }
            var e = eBack(u); x = lerp(mainX, fd.x, e); r = DR * clamp(e); y = r;
          }
          dot.visible = blob.visible = true;
          var lift = fd.tip.y - (fd.K.y + fk(fd.def, 0, tmp).y), z = H.z;
          if (t >= TL.wave) { y += lift; z = fd.tip.z; hn = Math.max(hn, lift / 0.05); }
          dot.position.set(x, y, z); dot.scale.set(r * sx, r * sy, r * sx);
          if (t >= TL.grow) {                       // dot settles onto the fingertip as its nail
            var m = eIO(seg(t, TL.grow + d * 0.07 + 0.15, TL.grow + d * 0.07 + 0.95), 2.4);
            fd.nail.getWorldPosition(nailW); dot.position.lerp(nailW, m);
            var out = 1 - sstep(0.72, 1, m);
            dot.scale.set(r * (1 - 0.15 * m) * out, r * (1 - 0.6 * m) * out, r * (1 + 0.1 * m) * out);
            if (out <= 0.001) { dot.visible = false; }
            blob.visible = m < 0.5;
          }
          var w = r * 4.2 * (1 - 0.42 * clamp(hn));
          blob.position.set(x, 0.0004, z); blob.scale.set(w, w * 0.8, 1);
          blob.userData.a = (1 - 0.62 * clamp(hn)) * (t >= TL.grow ? 1 - seg(t, TL.grow, TL.grow + 0.5) : 1);
        }
        // one shared glow material: fade by scaling, so all four stay the same colour
        for (var b = 0; b < 4; b++) if (dotBlobs[b].visible) { var a = dotBlobs[b].userData.a; dotBlobs[b].scale.multiplyScalar(0.55 + 0.45 * a); if (a <= 0.01) dotBlobs[b].visible = false; }
      }
      placeCamera(t);
    }

    // ───────────────────────────── theme
    var THEMES = {
      dark: { blob: 0x8785ff, blobA: 0.42, desk: 0x0f0f14, shadow: 0.55, glass: ['#1b1b28', '#0d0d15'] },
      light: { blob: 0x33316b, blobA: 0.26, desk: 0xf3f3f8, shadow: 0.2, glass: ['#fbfbfe', '#ececf4'] }
    };
    var theme = THEMES.dark;
    function setTheme(name) {
      theme = THEMES[name] || THEMES.dark;
      blobBall.color.setHex(theme.blob); blobBall.opacity = theme.blobA; miniBlobMat.color.setHex(theme.blob);
      M.desk.color.setHex(theme.desk); shadowMat.opacity = theme.shadow;
      var x = glassTex.image.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 128);
      g.addColorStop(0, theme.glass[0]); g.addColorStop(1, theme.glass[1]); x.fillStyle = g; x.fillRect(0, 0, 8, 128); glassTex.needsUpdate = true;
      dirty = true;
    }

    // ───────────────────────────── run loop
    var t = 0, last = null, playing = !reduced, visible = true, dirty = true, raf = 0, speed = 1;
    function resize() {
      var w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
        camera.aspect = w / h; buildCamera(camera.aspect); dirty = true;
      }
    }
    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (playing && visible) {
        if (last != null) t = (t + Math.min(0.1, (now - last) / 1000) * speed) % LOOP;
        last = now; dirty = true;
      } else last = null;
      if (dirty) { update(t); renderer.render(scene, camera); dirty = false; }
    }
    if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas); else window.addEventListener('resize', resize);
    if (window.IntersectionObserver) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(canvas);
    document.addEventListener('visibilitychange', function () { last = null; });

    setTheme(opts.theme || 'dark');
    resize();
    if (reduced) t = 11.9;                        // a still of the over-the-shoulder frame
    if (opts.time != null) t = opts.time;
    raf = requestAnimationFrame(frame);

    return {
      duration: LOOP,
      play: function () { playing = true; last = null; },
      pause: function () { playing = false; },
      seek: function (s) { t = ((s % LOOP) + LOOP) % LOOP; dirty = true; },
      setSpeed: function (s) { speed = s; },
      setTheme: setTheme,
      get time() { return t; },
      get playing() { return playing; },
      renderNow: function () { resize(); update(t); renderer.render(scene, camera); dirty = false; },
      dispose: function () { cancelAnimationFrame(raf); renderer.dispose(); }
    };
  }

  window.HeroLoop = { init: init, duration: LOOP };
})();
