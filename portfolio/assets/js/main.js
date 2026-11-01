/* Mayank Chauhan portfolio: intro, theme, routing, reveals, phones. No build step. */
(function () {
  "use strict";

  var root = document.documentElement;
  var body = document.body;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var caseViews = ["demedic", "earthlink", "desafe"];
  var caseTitles = { demedic: "DE Medic", earthlink: "EarthLink", desafe: "DeSafe" };
  var homeSections = ["work", "concepts", "about", "contact"];

  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) { return null; }
  }

  /* ---------------- reveal on scroll ---------------- */
  var revealIO = "IntersectionObserver" in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add("in"); revealIO.unobserve(en.target); }
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }) : null;

  function observeReveals() {
    if (!revealIO) {
      document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("in"); });
      return;
    }
    document.querySelectorAll(".reveal:not(.in)").forEach(function (el) { revealIO.observe(el); });
  }
  // safety net: never leave content hidden if something above failed
  setTimeout(function () {
    document.querySelectorAll(".reveal:not(.in)").forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight) el.classList.add("in");
    });
  }, 6000);

  /* ---------------- theme ---------------- */
  var themeBtn = document.getElementById("themeToggle");
  function currentTheme() { return root.getAttribute("data-theme") === "dark" ? "dark" : "light"; }
  function syncThemeLabel() {
    themeBtn.setAttribute("aria-label", currentTheme() === "dark" ? "Switch to light mode" : "Switch to dark mode");
  }
  themeBtn.addEventListener("click", function () {
    var next = currentTheme() === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    store("mc-theme", next);
    syncThemeLabel();
    window.dispatchEvent(new CustomEvent("themechange", { detail: next }));
  });
  syncThemeLabel();

  /* ---------------- mobile menu ---------------- */
  var nav = document.getElementById("nav");
  var menuBtn = document.getElementById("menuBtn");
  menuBtn.addEventListener("click", function () {
    var open = !nav.classList.contains("open");
    nav.classList.toggle("open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
  });
  document.getElementById("navLinks").addEventListener("click", function (e) {
    if (e.target.closest("a")) { nav.classList.remove("open"); menuBtn.setAttribute("aria-expanded", "false"); }
  });
  window.addEventListener("scroll", function () {
    nav.classList.toggle("scrolled", window.scrollY > 8);
  }, { passive: true });

  /* ---------------- intro (gone by ~6.9s) ----------------
     One bouncing ball (animation) becomes the first dot of a four-dot app
     loader (UI/UX). Motion is driven frame by frame so speed and height
     change continuously, with no jumps between animations.
     0s     the ball bounces tall, with real gravity
     0.3s   p1  "From making things move" fades in under it
     2.0s   p2  the ball glides into the first loader slot while its bounce
                shrinks to the loader's hop; text swaps to "to making things work."
     3.0s   p3  three dots join, one after another, a beat apart; the
                loading number appears under them (0 → 100% by 5.6s)
     5.6s       the dots settle onto the line; the page fades in            */
  var intro = document.getElementById("intro");
  var countEl = document.getElementById("introCount");
  var timers = [];
  var rafId = 0, loopId = 0;
  var introDone = false;

  var T1 = 2.0, T2 = 3.0, LOAD0 = 3.0, LOAD1 = 5.6, SETTLE = 0.45;

  function endIntro() {
    if (introDone) return;
    introDone = true;
    timers.forEach(clearTimeout);
    cancelAnimationFrame(rafId);
    countEl.textContent = "100";              // always land on 100% as the page opens
    intro.classList.add("done");
    body.classList.remove("intro-on");
    body.classList.add("ready");
    setTimeout(function () { cancelAnimationFrame(loopId); intro.remove(); }, 850);
    observeReveals();
  }

  function runCounter(duration) {
    var start = performance.now();
    function tick(now) {
      var t = Math.min(1, (now - start) / duration);
      countEl.textContent = String(Math.floor(t * 100));   // linear: tracks real time
      if (t < 1) rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
  }

  function runDots() {
    var stage = intro.querySelector(".intro-stage");
    var dots = intro.querySelectorAll(".dl-dot");
    var shadow = intro.querySelector(".dl-shadow");
    var cs = getComputedStyle(stage);
    var G = parseFloat(cs.getPropertyValue("--g")) || 34;
    var H = parseFloat(cs.getPropertyValue("--h")) || 84;    // first, tall bounce
    var h = H * 0.3;                                           // loader hop
    var clamp = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
    var ease = function (v) { v = clamp(v); return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2; };
    var lerp = function (a, b, k) { return a + (b - a) * k; };
    var hop = function (f) { f -= Math.floor(f); return 4 * f * (1 - f); };   // gravity parabola, 0 on the ground
    var t0 = performance.now(), last = t0, phase = 0;

    function frame(now) {
      var t = (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      var k = ease((t - T1) / (T2 - T1));                      // ball → loader blend
      var settle = 1 - ease((t - LOAD1) / SETTLE);              // hop dies down at the end
      var period = lerp(0.82, 0.6, k);
      phase += dt / period;
      var amp = lerp(H, h, k) * settle;

      // dot 0: the original ball, gliding into the first slot
      var y0 = hop(phase), x0 = lerp(0, -1.5 * G, k);
      var squash = Math.pow(1 - y0, 10) * 0.16 * (amp / H);    // a touch of squash at each landing
      dots[0].style.opacity = String(clamp(t / 0.35));
      dots[0].style.transform = "translate(" + x0.toFixed(2) + "px," + (-amp * y0).toFixed(2) + "px) scale(" + (1 + squash).toFixed(3) + "," + (1 - squash).toFixed(3) + ")";
      shadow.style.opacity = String((0.14 * (1 - 0.7 * y0) * clamp(t / 0.35) * (1 - k)).toFixed(3));
      shadow.style.transform = "translateX(" + x0.toFixed(2) + "px) scale(" + (0.55 + 0.45 * (1 - y0)).toFixed(3) + ")";

      // dots 1–3 fade into their own slots, a beat apart, and take up the wave
      for (var i = 1; i < 4; i++) {
        var r = ease((t - (T2 - 0.05 + (i - 1) * 0.16)) / 0.5);
        var yi = hop(phase - i * 0.16);
        dots[i].style.opacity = String(r.toFixed(3));
        dots[i].style.transform = "translate(" + ((i - 1.5) * G).toFixed(2) + "px," + (-h * r * settle * yi).toFixed(2) + "px) scale(" + (0.6 + 0.4 * r).toFixed(3) + ")";
      }
      if (!introDone || t < LOAD1 + 1.5) loopId = requestAnimationFrame(frame);
    }
    loopId = requestAnimationFrame(frame);
  }

  function startIntro() {
    body.classList.add("intro-on");
    var at = function (ms, fn) { timers.push(setTimeout(fn, ms)); };
    runDots();
    at(300, function () { intro.classList.add("p1"); });
    at(T1 * 1000, function () { intro.classList.add("p2"); });
    at(LOAD0 * 1000, function () { intro.classList.add("p3"); runCounter((LOAD1 - LOAD0) * 1000); });
    at((LOAD1 + 0.5) * 1000, endIntro);
  }

  document.getElementById("introSkip").addEventListener("click", endIntro);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") endIntro(); });

  var startView = viewFromHash();
  if (reduceMotion || (startView !== "home")) {
    // straight to content: no intro when landing on a case study or with reduced motion
    endIntro();
  } else {
    startIntro();
  }

  /* ---------------- routing (hash views) ---------------- */
  var views = Array.prototype.slice.call(document.querySelectorAll("[data-view]"));

  function viewFromHash() {
    var h = (location.hash || "").replace("#", "");
    return caseViews.indexOf(h) > -1 ? h : "home";
  }

  function show(viewName) {
    views.forEach(function (v) { v.hidden = v.getAttribute("data-view") !== viewName; });
  }

  function route(initial) {
    var h = (location.hash || "").replace("#", "");
    var v = viewFromHash();
    var wasHidden = document.querySelector('[data-view="' + v + '"]').hidden;
    show(v);
    document.querySelectorAll(".nav-links a").forEach(function (a) {
      a.setAttribute("aria-current", String(v === "home" ? a.getAttribute("data-nav") === h : a.getAttribute("data-nav") === "work"));
    });
    if (v !== "home") {
      window.scrollTo({ top: 0, behavior: "auto" });
      document.title = caseTitles[v] + " Case Study · Mayank Chauhan";
    } else {
      document.title = "Mayank Chauhan Portfolio";
      if (homeSections.indexOf(h) > -1) {
        var target = document.getElementById(h);
        // wait a frame when we just un-hid the home view so layout exists
        requestAnimationFrame(function () {
          target.scrollIntoView({ behavior: wasHidden || initial ? "auto" : "smooth", block: "start" });
        });
      } else if (wasHidden || h === "top") {
        window.scrollTo({ top: 0, behavior: initial ? "auto" : "smooth" });
      }
    }
    observeReveals();
    window.dispatchEvent(new CustomEvent("viewchange", { detail: v }));
  }

  window.addEventListener("hashchange", function () { route(false); });
  route(true);

  /* ---------------- hero parallax ---------------- */
  var art = document.getElementById("heroArt");
  if (art && !reduceMotion && window.matchMedia("(pointer: fine)").matches) {
    var tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    window.addEventListener("pointermove", function (e) {
      tx = (e.clientX / window.innerWidth - 0.5) * 2;
      ty = (e.clientY / window.innerHeight - 0.5) * 2;
      if (!raf) raf = requestAnimationFrame(loop);
    });
    function loop() {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      art.style.setProperty("--mx", cx.toFixed(3));
      art.style.setProperty("--my", cy.toFixed(3));
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.002 ? requestAnimationFrame(loop) : 0;
    }
  }

  /* ---------------- hero ID card: tilts toward the cursor while hovered ---------------- */
  var idCard = document.getElementById("idCard");
  if (idCard && !reduceMotion && window.matchMedia("(hover: hover)").matches) {
    idCard.addEventListener("pointermove", function (e) {
      var r = idCard.getBoundingClientRect();
      idCard.style.setProperty("--ix", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
      idCard.style.setProperty("--iy", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
      idCard.classList.add("tracking");
    });
    idCard.addEventListener("pointerleave", function () {
      idCard.classList.remove("tracking");
      idCard.style.setProperty("--ix", "0");
      idCard.style.setProperty("--iy", "0");
    });
  }

  /* ---------------- concept phones ---------------- */
  var phoneCards = document.querySelectorAll(".phone-card");
  phoneCards.forEach(function (card) {
    // optional real screen recording
    var src = card.getAttribute("data-video");
    if (src) {
      var screen = card.querySelector(".phone-screen");
      var v = document.createElement("video");
      v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true;
      v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
      v.preload = "metadata";
      v.style.opacity = "0";
      v.addEventListener("loadeddata", function () { v.style.opacity = "1"; });
      v.addEventListener("error", function () { v.remove(); });
      v.src = src;
      screen.appendChild(v);
    }
    // tap to bring forward on touch screens
    card.addEventListener("click", function () {
      var on = !card.classList.contains("active");
      phoneCards.forEach(function (c) { c.classList.remove("active"); });
      card.classList.toggle("active", on);
    });
  });

  // pause the CSS previews and videos while the concepts row is off screen
  var stage = document.getElementById("phoneStage");
  if (stage && "IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      var visible = entries[0].isIntersecting;
      stage.classList.toggle("paused", !visible);
      stage.querySelectorAll("video").forEach(function (v) { visible ? v.play().catch(function () {}) : v.pause(); });
    }, { threshold: 0.05 }).observe(stage);
  }

  /* ---------------- case study section nav ---------------- */
  document.querySelectorAll(".toc").forEach(function (toc) {
    var buttons = toc.querySelectorAll("button");
    var map = {};
    buttons.forEach(function (b) {
      var sec = document.querySelector('[data-sec="' + b.getAttribute("data-target") + '"]');
      map[b.getAttribute("data-target")] = b;
      b.addEventListener("click", function () { sec.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }); });
    });
    if (!("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          buttons.forEach(function (b) { b.classList.remove("on"); });
          var b = map[en.target.getAttribute("data-sec")];
          if (b) b.classList.add("on");
        }
      });
    }, { rootMargin: "-35% 0px -55% 0px" });
    Object.keys(map).forEach(function (k) { io.observe(document.querySelector('[data-sec="' + k + '"]')); });
  });

  /* ---------------- tilt: about-me cards follow the cursor ---------------- */
  if (!reduceMotion && window.matchMedia("(hover: hover)").matches) {
    document.querySelectorAll("[data-tilt]").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty("--tx", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
        el.style.setProperty("--ty", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
        el.classList.add("tilting");
      });
      el.addEventListener("pointerleave", function () {
        el.classList.remove("tilting");
        el.style.setProperty("--tx", "0");
        el.style.setProperty("--ty", "0");
      });
    });
  }
  // touch screens have no hover: a tap plays the card's interaction
  document.querySelectorAll(".trait").forEach(function (el) {
    el.addEventListener("click", function () { el.classList.toggle("active"); });
  });

  /* ---------------- timeline toggle (a real micro-interaction) ---------------- */
  var bigToggle = document.querySelector(".big-toggle");
  if (bigToggle) {
    var flip = function () { bigToggle.setAttribute("aria-pressed", String(bigToggle.getAttribute("aria-pressed") !== "true")); };
    // it flips itself until someone tries it
    var demo = reduceMotion ? 0 : setInterval(flip, 2600);
    bigToggle.addEventListener("click", function () {
      if (demo) { clearInterval(demo); demo = 0; }
      flip();
      var hint = bigToggle.parentElement.querySelector(".tap-hint");
      if (hint) hint.textContent = bigToggle.getAttribute("aria-pressed") === "true" ? "on" : "off";
    });
  }

})();
