/* Mayank Chauhan portfolio: intro, theme, routing, reveals, phones. No build step. */
(function () {
  "use strict";

  var root = document.documentElement;
  var body = document.body;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var caseViews = ["demedic", "earthlink", "desafe", "design-system"];
  var caseTitles = { demedic: "DE Medic", earthlink: "EarthLink", desafe: "DeSafe", "design-system": "Table System" };
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

  /* ---------------- intro (about 8s in total) ----------------
     0s     the ball bounces on its own
     0.8s   "From making things move" fades in under the ball
     2.4s   the phone starts forming around the ball; the line slips away and
            Loading takes its place at 0%
     4.64s  the phone has settled; "to making things work." fades in
     7.2s   held, then Loading hits 100% and the page fades in (done by ~8s)
     Every step and transition keeps the same proportions as before.      */
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
    setTimeout(function () { intro.remove(); }, 1000);
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
    at(800, function () { intro.classList.add("p1"); });
    at(2400, function () { intro.classList.add("p2"); runCounter(4800); });  // 0% at 2.4s → 100% at 7.2s
    at(4640, function () { intro.classList.add("p3"); });
    at(7200, endIntro);
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

  /* ---------------- table system: live demo built to the component spec ---------------- */
  var demo = document.getElementById("tableDemo");
  if (demo) {
    var rows = [
      { id: 202401, status: "New application", tag: "ok", sla: "2h 5m", slaMin: 125, who: "Alisha Morgan", borrower: "Jordan Rivers", product: "Chattel mortgage", amt: 128400 },
      { id: 202402, status: "In review", tag: "warn", sla: "45m", slaMin: 45, who: "Alex Morgan", borrower: "Priya Shah", product: "Car loan", amt: 46250 },
      { id: 202403, status: "Docs pending", tag: "warn", sla: "5h 30m", slaMin: 330, who: "Liam Thompson", borrower: "Noah Chen", product: "Equipment finance", amt: 212900 },
      { id: 202404, status: "Approved", tag: "ok", sla: "1d 2h", slaMin: 1560, who: "Mia Patel", borrower: "Ella Brooks", product: "Chattel mortgage", amt: 89000 },
      { id: 202405, status: "New application", tag: "ok", sla: "3h 10m", slaMin: 190, who: "Alex Morgan", borrower: "Oliver Grant", product: "Personal loan", amt: 18500 },
      { id: 202406, status: "Declined", tag: "bad", sla: "20m", slaMin: 20, who: "Alisha Morgan", borrower: "Ava Wilson", product: "Car loan", amt: 33700 }
    ];
    var tbody = document.getElementById("tBody"), all = document.getElementById("tAll");
    var bar = document.getElementById("tBar"), count = document.getElementById("tCount");
    var selected = {}, sortKey = null, sortDir = 1;
    var money = function (n) { return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2 }); };
    var initials = function (n) { return n.split(" ").map(function (p) { return p[0]; }).join(""); };
    var ICONS = '<button type="button" aria-label="View"><svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg></button>' +
      '<button type="button" aria-label="Edit"><svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg></button>' +
      '<button type="button" aria-label="Archive"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10h14V9M10 13h4"/></svg></button>' +
      '<button type="button" aria-label="More"><svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg></button>';
    var render = function () {
      var list = rows.slice();
      if (sortKey) list.sort(function (a, b) {
        var x = sortKey === "sla" ? a.slaMin : a[sortKey], y = sortKey === "sla" ? b.slaMin : b[sortKey];
        return (x > y ? 1 : x < y ? -1 : 0) * sortDir;
      });
      tbody.innerHTML = list.map(function (r) {
        var on = !!selected[r.id];
        return '<tr class="' + (on ? "is-sel" : "") + '" data-id="' + r.id + '">' +
          '<td class="c-check"><label class="cbx"><input type="checkbox" aria-label="Select application #' + r.id + '"' + (on ? " checked" : "") + '><i></i></label></td>' +
          '<td class="b">#' + r.id + '</td>' +
          '<td><span class="ttag ' + r.tag + '">' + r.status + '</span></td>' +
          '<td>' + r.sla + '</td>' +
          '<td><span class="av">' + initials(r.who) + '</span>' + r.who + '</td>' +
          '<td>' + r.borrower + '</td>' +
          '<td>' + r.product + '</td>' +
          '<td class="num">' + money(r.amt) + '</td>' +
          '<td class="c-act"><span class="acts">' + ICONS + '</span></td></tr>';
      }).join("");
      var n = Object.keys(selected).length;
      bar.hidden = n === 0;
      count.textContent = n + " selected";
      all.checked = n === rows.length;
      all.indeterminate = n > 0 && n < rows.length;
      demo.querySelectorAll(".sort").forEach(function (b) {
        b.classList.toggle("active", b.getAttribute("data-key") === sortKey);
        b.setAttribute("aria-sort", b.getAttribute("data-key") === sortKey ? (sortDir > 0 ? "ascending" : "descending") : "none");
      });
    };
    tbody.addEventListener("change", function (e) {
      var tr = e.target.closest("tr"); if (!tr) return;
      var id = tr.getAttribute("data-id");
      if (e.target.checked) selected[id] = true; else delete selected[id];
      render();
    });
    all.addEventListener("change", function () {
      selected = {};
      if (all.checked) rows.forEach(function (r) { selected[r.id] = true; });
      render();
    });
    document.getElementById("tClear").addEventListener("click", function () { selected = {}; render(); });
    demo.querySelectorAll(".sort").forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-key");
        if (sortKey === k) sortDir = -sortDir; else { sortKey = k; sortDir = 1; }
        render();
      });
    });
    demo.querySelectorAll(".seg button").forEach(function (b) {
      b.addEventListener("click", function () {
        demo.querySelectorAll(".seg button").forEach(function (x) { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", String(x === b)); });
        demo.classList.toggle("is-small", b.getAttribute("data-size") === "small");
      });
    });
    render();
  }
})();
