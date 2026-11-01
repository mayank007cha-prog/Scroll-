/* The hunt: a small spider walks on top of a turning cube whose four sides read
   WHO / WHAT / WHY / HOW. The spider never changes position; the cube turns
   underneath it, so its legs grip the moving surface like a treadmill.
   Scale is kept close to real life: think a 10 cm block and a house spider
   with roughly a 4 cm leg span. Hover (or tap) pauses the loop.            */
(function () {
  "use strict";

  var card = document.getElementById("cubeCard");
  var canvas = document.getElementById("cubeCanvas");
  if (!card || !canvas) return;

  var toggleBtn = document.getElementById("cubeToggle");
  var hint = document.getElementById("cubeHint");
  var rec = document.getElementById("cubeRec");

  function fail() { card.classList.add("no-webgl"); }
  if (!window.THREE) return fail();

  var THREE = window.THREE;
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  } catch (e) { return fail(); }
  if (!renderer.getContext()) return fail();

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  var LOOK = new THREE.Vector3(0, 0.25, 0);

  /* ---------- theme-aware colours ---------- */
  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function palette() {
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    return {
      dark: dark,
      face: dark ? "#1b1b28" : "#f8f7ff",
      faceEdge: dark ? "#13131d" : "#e9e7f8",
      line: css("--line-strong") || (dark ? "#34344c" : "#d2d1e4"),
      fg: css("--fg") || (dark ? "#f2f1f8" : "#14131c"),
      muted: css("--muted") || "#7d7c92",
      accent: css("--accent") || "#5a55f0",
      shadow: dark ? 0.45 : 0.09
    };
  }

  /* ---------- lights ---------- */
  var hemi = new THREE.HemisphereLight(0xffffff, 0xb8b4ff, 0.75);
  scene.add(hemi);
  var key = new THREE.DirectionalLight(0xffffff, 0.85);
  key.position.set(-1.6, 9, 3.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -3; key.shadow.camera.right = 3;
  key.shadow.camera.top = 3; key.shadow.camera.bottom = -3;
  key.shadow.camera.near = 1; key.shadow.camera.far = 16;
  key.shadow.bias = -0.0006;
  key.shadow.radius = 5;
  scene.add(key);
  var rim = new THREE.DirectionalLight(0xcfcaff, 0.35);
  rim.position.set(4, 2, -3);
  scene.add(rim);

  /* ---------- ground (shadow only, blends into the card) ---------- */
  var groundMat = new THREE.ShadowMaterial({ opacity: 0.16 });
  var ground = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1;
  ground.receiveShadow = true;
  scene.add(ground);

  var blobCanvas = document.createElement("canvas");
  blobCanvas.width = blobCanvas.height = 256;
  var bctx = blobCanvas.getContext("2d");
  var bg = bctx.createRadialGradient(128, 128, 20, 128, 128, 128);
  bg.addColorStop(0, "rgba(20,18,60,0.55)");
  bg.addColorStop(0.55, "rgba(20,18,60,0.18)");
  bg.addColorStop(1, "rgba(20,18,60,0)");
  bctx.fillStyle = bg;
  bctx.fillRect(0, 0, 256, 256);
  var blobMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(blobCanvas), transparent: true, depthWrite: false, opacity: 0.5 });
  var blob = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), blobMat);
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = -0.995;
  scene.add(blob);

  /* ---------- cube ---------- */
  var S = 2; // cube edge
  var cube = new THREE.Group();
  scene.add(cube);

  var faces = [
    // BoxGeometry material order: +X, -X, +Y, -Y, +Z, -Z
    // Turning anticlockwise (seen from above) brings -X to the front after +Z,
    // so the story reads WHO → WHAT → WHY → HOW.
    { word: "HOW", n: "04", sub: "do we get there?" },
    { word: "WHAT", n: "02", sub: "needs to change?" },
    { top: true },
    { bottom: true },
    { word: "WHO", n: "01", sub: "is it for?" },
    { word: "WHY", n: "03", sub: "does it matter?" }
  ];

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function faceTexture(f, p) {
    var size = 1024;
    var c = document.createElement("canvas");
    c.width = c.height = size;
    var ctx = c.getContext("2d");
    var g = ctx.createRadialGradient(size * 0.4, size * 0.35, size * 0.1, size * 0.5, size * 0.5, size * 0.75);
    g.addColorStop(0, p.face);
    g.addColorStop(1, p.faceEdge);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = p.line;
    ctx.lineWidth = 3;
    roundRect(ctx, 44, 44, size - 88, size - 88, 36);
    ctx.stroke();

    if (f.top || f.bottom) {
      // fine dot grid: the spider's walking surface
      ctx.fillStyle = p.line;
      for (var y = 112; y < size - 80; y += 64) {
        for (var x = 112; x < size - 80; x += 64) {
          ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill();
        }
      }
      if (f.top) {
        ctx.fillStyle = p.accent;
        ctx.globalAlpha = 0.85;
        ctx.font = "italic 400 120px 'Instrument Serif', Georgia, serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("?", size / 2, size / 2);
        ctx.globalAlpha = 1;
      }
    } else {
      ctx.fillStyle = p.muted;
      ctx.font = "500 46px 'Geist Mono', ui-monospace, monospace";
      ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.fillText(f.n, 110, 106);

      ctx.fillStyle = p.fg;
      ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
      var fontSize = f.word.length > 3 ? 250 : 290;
      ctx.font = "500 " + fontSize + "px 'Geist', ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(f.word, size / 2, size / 2 + fontSize * 0.28);

      ctx.fillStyle = p.accent;
      ctx.font = "italic 400 86px 'Instrument Serif', Georgia, serif";
      ctx.fillText(f.sub, size / 2, size / 2 + fontSize * 0.28 + 130);
    }

    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
  }

  var cubeMats = faces.map(function () {
    return new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0 });
  });
  var cubeMesh = new THREE.Mesh(new THREE.BoxGeometry(S, S, S), cubeMats);
  cubeMesh.castShadow = true;
  cubeMesh.receiveShadow = true;
  cube.add(cubeMesh);

  var edgeMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.5 });
  var edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(S * 1.001, S * 1.001, S * 1.001)), edgeMat);
  cube.add(edges);

  /* ---------- spider ---------- */
  var spider = new THREE.Group();
  var R_WALK = 0.5;                      // distance from the cube's axis
  spider.position.set(0, S / 2, R_WALK);   // on top, near the front edge
  spider.rotation.y = -Math.PI / 2;        // facing -X, against the surface's motion
  scene.add(spider);

  var chitin = new THREE.MeshStandardMaterial({ color: 0x2a211c, roughness: 0.42, metalness: 0.05 });
  var chitinDark = new THREE.MeshStandardMaterial({ color: 0x17120f, roughness: 0.38, metalness: 0.05 });
  var legMat = new THREE.MeshStandardMaterial({ color: 0x33281f, roughness: 0.5, metalness: 0.02 });
  var eyeMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.08, metalness: 0.4 });

  function mesh(geo, mat) {
    var m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    return m;
  }

  var BODY_H = 0.085;
  var body = new THREE.Group();
  body.position.y = BODY_H;
  spider.add(body);

  var sphereGeo = new THREE.SphereGeometry(1, 28, 18);
  var ceph = mesh(sphereGeo, chitin);
  ceph.scale.set(0.05, 0.036, 0.062);
  ceph.position.set(0, 0, 0.035);
  body.add(ceph);

  var abdomen = mesh(sphereGeo, chitinDark);
  abdomen.scale.set(0.066, 0.056, 0.092);
  abdomen.position.set(0, 0.022, -0.105);
  abdomen.rotation.x = -0.22;
  body.add(abdomen);

  // faint chevrons on the abdomen
  var stripeMat = new THREE.MeshStandardMaterial({ color: 0x5a4636, roughness: 0.6 });
  for (var k = 0; k < 3; k++) {
    var st = mesh(new THREE.TorusGeometry(1, 0.06, 6, 18, Math.PI * 0.55), stripeMat);
    st.scale.set(0.05 - k * 0.008, 0.05 - k * 0.008, 0.05);
    st.rotation.set(-Math.PI / 2 - 0.2, 0, Math.PI * 0.225 + Math.PI);
    st.position.set(0, 0.073 - k * 0.002, -0.08 - k * 0.035);
    body.add(st);
  }

  var eyeGeo = new THREE.SphereGeometry(1, 12, 10);
  [[-0.014, 0.022, 0.09, 0.0085], [0.014, 0.022, 0.09, 0.0085], [-0.03, 0.02, 0.078, 0.006], [0.03, 0.02, 0.078, 0.006],
   [-0.012, 0.03, 0.078, 0.005], [0.012, 0.03, 0.078, 0.005]].forEach(function (e) {
    var eye = mesh(eyeGeo, eyeMat);
    eye.scale.setScalar(e[3]);
    eye.position.set(e[0], e[1], e[2]);
    body.add(eye);
  });
  // chelicerae + pedipalps
  [-1, 1].forEach(function (s) {
    var ch = mesh(new THREE.ConeGeometry(0.011, 0.04, 8), chitinDark);
    ch.position.set(s * 0.012, -0.012, 0.1);
    ch.rotation.x = Math.PI * 0.62;
    body.add(ch);
    var palp = mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.07, 6), legMat);
    palp.position.set(s * 0.028, -0.01, 0.115);
    palp.rotation.set(Math.PI * 0.42, 0, s * 0.35);
    body.add(palp);
  });

  // legs: each has a femur and a tibia/tarsus, solved with 2-bone IK every frame
  var UP = new THREE.Vector3(0, 1, 0);
  var FEMUR = 0.17, TIBIA = 0.24, STRIDE = 0.1, LIFT = 0.055;
  var segGeo = new THREE.CylinderGeometry(1, 1, 1, 7, 1);
  segGeo.translate(0, 0.5, 0); // pivot at the base
  var jointGeo = new THREE.SphereGeometry(1, 8, 6);

  var legs = [];
  var legAngles = [38, 72, 108, 146];    // degrees from forward, front to back
  var legReach = [0.31, 0.27, 0.27, 0.33];
  [-1, 1].forEach(function (s) {
    for (var i = 0; i < 4; i++) {
      var hip = new THREE.Vector3(s * 0.034, BODY_H, 0.07 - i * 0.03);
      var a = legAngles[i] * Math.PI / 180;
      var rest = new THREE.Vector3(hip.x + s * Math.sin(a) * legReach[i], 0, hip.z + Math.cos(a) * legReach[i]);
      // alternating tetrapod gait (L1 R2 L3 R4 vs R1 L2 R3 L4) with a small wave
      var group = ((i % 2 === 0) === (s < 0)) ? 0 : 0.5;
      var femur = mesh(segGeo, legMat);
      var tibia = mesh(segGeo, legMat);
      var knee = mesh(jointGeo, legMat);
      knee.scale.setScalar(0.0105);
      spider.add(femur, tibia, knee);
      legs.push({ s: s, i: i, hip: hip, rest: rest, phase: group + i * 0.06, femur: femur, tibia: tibia, knee: knee,
        rFemur: 0.0105 - i * 0.0004, rTibia: 0.0075 });
    }
  });

  var tmpDir = new THREE.Vector3(), tmpQ = new THREE.Quaternion();
  function placeSegment(m, a, b, r0) {
    tmpDir.subVectors(b, a);
    var len = tmpDir.length();
    m.position.copy(a);
    m.quaternion.copy(tmpQ.setFromUnitVectors(UP, tmpDir.normalize()));
    m.scale.set(r0, len, r0);
  }

  var foot = new THREE.Vector3(), kneeP = new THREE.Vector3(), d = new THREE.Vector3(), bend = new THREE.Vector3();
  function solveLeg(L, gait) {
    var p = (gait + L.phase) % 1;
    var dz, lift = 0;
    if (p < 0.5) {                       // stance: foot grips the surface, slides back
      dz = STRIDE / 2 - (p / 0.5) * STRIDE;
    } else {                             // swing: foot lifts and reaches forward
      var u = (p - 0.5) / 0.5;
      var e = u * u * (3 - 2 * u);
      dz = -STRIDE / 2 + e * STRIDE;
      lift = Math.sin(u * Math.PI) * LIFT;
    }
    foot.set(L.rest.x, lift + 0.004, L.rest.z + dz);

    var hip = L.hip;
    d.subVectors(foot, hip);
    var D = Math.min(d.length(), FEMUR + TIBIA - 0.001);
    d.normalize();
    var cosA = (FEMUR * FEMUR + D * D - TIBIA * TIBIA) / (2 * FEMUR * D);
    var sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    bend.copy(UP).addScaledVector(d, -UP.dot(d)).normalize();   // knee bends up
    kneeP.copy(hip).addScaledVector(d, FEMUR * cosA).addScaledVector(bend, FEMUR * sinA);

    placeSegment(L.femur, hip, kneeP, L.rFemur);
    placeSegment(L.tibia, kneeP, foot, L.rTibia);
    L.knee.position.copy(kneeP);
  }

  /* ---------- theme application ---------- */
  function applyTheme() {
    var p = palette();
    faces.forEach(function (f, idx) {
      if (cubeMats[idx].map) cubeMats[idx].map.dispose();
      cubeMats[idx].map = faceTexture(f, p);
      cubeMats[idx].needsUpdate = true;
    });
    edgeMat.color.set(p.line);
    groundMat.opacity = p.shadow;
    blobMat.opacity = p.dark ? 0.9 : 0.45;
    hemi.intensity = p.dark ? 0.55 : 0.6;
    hemi.groundColor.set(p.dark ? 0x2a2850 : 0xb8b4ff);
    key.intensity = p.dark ? 0.95 : 0.8;
    needsRender = true;
  }

  /* ---------- sizing ---------- */
  function resize() {
    var w = card.clientWidth, h = card.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the cube comfortably framed on narrow cards
    var dist = camera.aspect < 0.95 ? 8.6 : 7.4;
    camera.position.set(0, dist * 0.42, dist);
    camera.lookAt(LOOK);
    camera.updateProjectionMatrix();
    needsRender = true;
  }
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(card);
  else window.addEventListener("resize", resize);

  /* ---------- play / pause ---------- */
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var pinned = reduce;   // paused by the button (or reduced motion)
  var hovering = false;
  var paused = pinned;
  function syncPaused() {
    paused = pinned || hovering;
    card.classList.toggle("is-paused", paused);
    toggleBtn.setAttribute("aria-label", pinned ? "Play animation" : "Pause animation");
    rec.textContent = paused ? "Paused" : "Hunting for answers";
    hint.textContent = pinned ? "Paused. Press play to resume" : (hovering ? "Move away to resume" : "Hover to pause");
  }
  var finePointer = window.matchMedia("(hover: hover)").matches;
  if (finePointer) {
    card.addEventListener("pointerenter", function () { hovering = true; syncPaused(); });
    card.addEventListener("pointerleave", function () { hovering = false; syncPaused(); });
  } else {
    card.addEventListener("click", function (e) {
      if (e.target.closest(".cube-toggle")) return;
      pinned = !pinned; syncPaused();
    });
    hint.textContent = "Tap to pause";
  }
  toggleBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    pinned = !pinned; syncPaused();
  });
  syncPaused();
  if (!finePointer && !pinned) hint.textContent = "Tap to pause";

  /* ---------- loop ---------- */
  var angle = -0.12;      // cube rotation
  var gait = 0;           // gait cycle position
  var BASE_SPEED = 0.72;  // rad/s at its fastest
  var last = performance.now();
  var visible = false;
  var needsRender = true;
  var running = false;

  function frame(now) {
    running = false;
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!paused) {
      // slow down as each word faces the camera, speed up between words
      var s2 = Math.sin(2 * angle);
      var omega = BASE_SPEED * (0.22 + 0.78 * s2 * s2);
      angle += omega * dt;
      // body moves L per half-cycle, so a full cycle covers 2 × stride
      gait = (gait + (omega * R_WALK * dt) / (2 * STRIDE)) % 1;
      needsRender = true;
    }
    if (needsRender) {
      cube.rotation.y = angle;
      legs.forEach(function (L) { solveLeg(L, gait); });
      var bob = Math.sin(gait * Math.PI * 4);
      body.position.y = BODY_H + bob * 0.004;
      body.rotation.z = Math.sin(gait * Math.PI * 2) * 0.03;
      body.rotation.x = -0.04 + bob * 0.01;
      renderer.render(scene, camera);
      needsRender = false;
    }
    if (visible) schedule();
  }
  function schedule() {
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) { last = performance.now(); schedule(); }
    }, { threshold: 0.01 }).observe(card);
  } else { visible = true; }

  window.addEventListener("themechange", applyTheme);
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  window.addEventListener("viewchange", function () { resize(); });

  applyTheme();
  resize();
  schedule();
  // redraw the face lettering once the web fonts have arrived
  if (document.fonts && document.fonts.load) {
    Promise.all([
      document.fonts.load("500 200px 'Geist'"),
      document.fonts.load("500 40px 'Geist Mono'"),
      document.fonts.load("italic 400 80px 'Instrument Serif'")
    ]).then(applyTheme, function () {});
  }
})();
