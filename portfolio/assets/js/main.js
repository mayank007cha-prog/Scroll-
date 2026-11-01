/* Mayank Chauhan portfolio: intro, theme, routing, reveals, phones. No build step. */
(function () {
  "use strict";

  var root = document.documentElement;
  var body = document.body;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var caseViews = ["demedic", "earthlink", "desafe", "design-system"];
  var caseTitles = { demedic: "DE Medic", earthlink: "EarthLink", desafe: "DeSafe", "design-system": "Design System" };
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

  /* ---------------- intro ----------------
     0s  the ball bounces on its own
     1s  "From making things move" fades in, and holds
     3s    the phone starts forming around the ball; the first line fades out,
           so only the ball, phone and Loading are on screen; Loading starts at 0%
     5.8s  the phone has settled; "to making things work." fades in (in by ~7.6s)
     9.6s  held for 2s, then Loading hits 100% and the home page opens       */
  var intro = document.getElementById("intro");
  var countEl = document.getElementById("introCount");
  var timers = [];
  var rafId = 0;
  var introDone = false;

  function endIntro() {
    if (introDone) return;
    introDone = true;
    timers.forEach(clearTimeout);
    cancelAnimationFrame(rafId);
    countEl.textContent = "100";              // always land on 100% as the page opens
    intro.classList.add("done");
    body.classList.remove("intro-on");
    body.classList.add("ready");
    setTimeout(function () { intro.remove(); }, 1200);
    observeReveals();
  }

  function runCounter(duration) {
    var start = performance.now();
    function tick(now) {
      var t = Math.min(1, (now - start) / duration);
      var n = Math.floor(t * 100);          // linear: the number tracks real time
      countEl.textContent = String(n);
      if (t < 1) rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
  }

  function startIntro() {
    body.classList.add("intro-on");
    var at = function (ms, fn) { timers.push(setTimeout(fn, ms)); };
    at(1000, function () { intro.classList.add("p1"); });
    at(3000, function () { intro.classList.add("p2"); runCounter(6600); });  // 0% at 3s → 100% at 9.6s
    at(5800, function () { intro.classList.add("p3"); });
    at(9600, endIntro);
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

  /* ---------------- design system: button playground + matrix ---------------- */
  var pg = document.getElementById("dsPlayground");
  if (pg) {
    var preview = document.getElementById("dsPreview");
    var tokensEl = document.getElementById("dsTokens");
    var SIZE = { s: { h: 32, px: 12, r: 8, n: "sm" }, m: { h: 40, px: 16, r: 10, n: "md" }, l: { h: 48, px: 20, r: 12, n: "lg" } };
    var BG = { primary: "action/primary", secondary: "surface/default", ghost: "action/ghost", danger: "action/destructive" };
    var FG = { primary: "text/on-action", secondary: "text/primary", ghost: "action/primary", danger: "text/on-action" };
    var STATE_SUFFIX = { hover: "/hover", pressed: "/pressed" };

    var hex = function (rgb) {
      var m = rgb.match(/[\d.]+/g);
      if (!m) return rgb;
      if (m.length > 3 && parseFloat(m[3]) === 0) return "transparent";
      return "#" + m.slice(0, 3).map(function (x) { return ("0" + Math.round(+x).toString(16)).slice(-2); }).join("");
    };
    var val = function (name) { var el = pg.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : ""; };

    var classes = function (v, sz, st, icon) {
      return "ds-btn v-" + v + " s-" + sz + " st-" + st + (icon ? "" : " no-icon");
    };

    var update = function () {
      var v = val("ds-v"), sz = val("ds-s"), st = val("ds-st"), icon = document.getElementById("ds-icon").checked;
      preview.className = classes(v, sz, st, icon);
      preview.disabled = st === "disabled";
      preview.setAttribute("aria-busy", String(st === "loading"));
      // read the real computed colours once the 0.2s colour transition has settled
      clearTimeout(update.t);
      update.t = setTimeout(function () {
        var cs = getComputedStyle(preview);
        var size = SIZE[sz];
        var rows = [
          ["Background", "color/" + BG[v] + (STATE_SUFFIX[st] || ""), hex(cs.backgroundColor)],
          ["Text", "color/" + FG[v], hex(cs.color)],
          ["Border", v === "secondary" ? "color/border/strong" : "none", v === "secondary" ? hex(cs.borderTopColor) : ""],
          ["Radius", "radius/" + size.n, size.r + "px"],
          ["Height", "size/control-" + size.n, size.h + "px"],
          ["Padding", "space/x-" + size.n, size.px + "px"]
        ];
        tokensEl.innerHTML = rows.map(function (r) {
          return "<dt>" + r[0] + "</dt><dd>" + r[1] + (r[2] ? " <span>· " + r[2] + "</span>" : "") + "</dd>";
        }).join("");
      }, 260);
    };
    pg.addEventListener("change", update);
    window.addEventListener("themechange", update);
    update();

    // static matrix: every variant in every state
    var matrix = document.getElementById("dsMatrix");
    var variants = [["primary", "Primary"], ["secondary", "Secondary"], ["ghost", "Ghost"], ["danger", "Destructive"]];
    var states = [["default", "Default"], ["hover", "Hover"], ["pressed", "Pressed"], ["focus", "Focus"], ["disabled", "Disabled"], ["loading", "Loading"]];
    var html = "<thead><tr><th scope=\"col\">Variant</th>" + states.map(function (s2) { return "<th scope=\"col\">" + s2[1] + "</th>"; }).join("") + "</tr></thead><tbody>";
    variants.forEach(function (v2) {
      html += "<tr><th scope=\"row\">" + v2[1] + "</th>";
      states.forEach(function (s2) {
        html += "<td><span class=\"" + classes(v2[0], "s", s2[0], false) + "\" role=\"img\" aria-label=\"" + v2[1] + " button, " + s2[1] + "\"><span class=\"ds-label\">Button</span><span class=\"ds-spin\"></span></span></td>";
      });
      html += "</tr>";
    });
    matrix.insertAdjacentHTML("beforeend", html + "</tbody>");
  }
})();
