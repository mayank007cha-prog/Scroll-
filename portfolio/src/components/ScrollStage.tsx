"use client";

import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { SceneFrame } from "./SceneFrame";
import { MOBILE_QUERY, mobileOverrides, sceneConfig, type SceneConfig } from "@/lib/sceneConfig";

gsap.registerPlugin(ScrollTrigger);

/**
 * One pinned 3D scene. Everything (video scrub, hero depth, the
 * horizontal glide) is a segment of a single scrubbed timeline, so
 * scrolling up simply plays it backwards.
 *
 *   video 0→100% → video moves back to card size as case study 01 slides
 *   in beside it → the whole row (video first) glides right → left on a
 *   gentle curve → footer settles in the centre
 */
export function ScrollStage({ children }: { children: ReactNode }) {
  const stageRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const mm = gsap.matchMedia();

    mm.add(
      {
        desktop: "(min-width: 768px)",
        mobile: MOBILE_QUERY,
        reduceMotion: "(prefers-reduced-motion: reduce)",
      },
      (context) => {
        const { mobile, reduceMotion } = context.conditions ?? {};
        const video = stage.querySelector<HTMLVideoElement>("[data-hero-video]");

        if (reduceMotion) {
          // Static, stacked layout comes from CSS; let people play the video themselves.
          if (video) video.controls = true;
          return () => {
            if (video) video.controls = false;
          };
        }

        const config: SceneConfig = { ...sceneConfig, ...(mobile ? mobileOverrides : {}) };
        return buildScene(stage, video, config);
      },
    );

    return () => mm.revert();
  }, []);

  return (
    <section ref={stageRef} className="scroll-stage">
      <SceneFrame>{children}</SceneFrame>
    </section>
  );
}

/** Grid cell (px) shared by the back wall and the floor (see globals.css). */
const GRID = 240;

function buildScene(stage: HTMLElement, video: HTMLVideoElement | null, config: SceneConfig) {
  const frame = stage.querySelector<HTMLElement>(".scene-frame");
  const hero = stage.querySelector<HTMLElement>('[data-plane="hero"]');
  if (!frame || !hero) return;

  // ---- Smooth scrolling (Lenis) wired into GSAP's ticker ------------------
  const lenis = new Lenis({ lerp: config.smoothness, wheelMultiplier: 0.9 });
  lenis.on("scroll", ScrollTrigger.update);
  const raf = (time: number) => lenis.raf(time * 1000);
  gsap.ticker.add(raf);
  gsap.ticker.lagSmoothing(0);

  // ---- Video: autoplay once, then scroll owns playback --------------------
  let scrollOwnsVideo = !config.autoplayOnLoad;
  const videoTime = { t: 0 };
  // Small easing on seeks so taking over from autoplay rewinds smoothly
  // instead of jumping.
  const seekVideo = gsap.quickTo(videoTime, "t", {
    duration: 0.25,
    ease: "power2.out",
    onUpdate: () => {
      if (video && video.readyState >= 1) video.currentTime = videoTime.t;
    },
  });
  const videoDuration = () =>
    video && Number.isFinite(video.duration) ? Math.max(video.duration - 0.05, 0) : 0;

  const takeOverVideo = () => {
    if (scrollOwnsVideo || !video) return;
    scrollOwnsVideo = true;
    video.pause();
    videoTime.t = video.currentTime;
  };

  // ---- Elements -----------------------------------------------------------
  const track = stage.querySelector<HTMLElement>("[data-track]");
  const items = track ? gsap.utils.toArray<HTMLElement>(".work-item", track) : [];
  const fog = hero.querySelector<HTMLElement>(".hero-fog");
  const depthField = stage.querySelector<HTMLElement>("[data-depth-field]");
  const room = depthField?.querySelector<HTMLElement>("[data-room]");
  const spinners = depthField ? gsap.utils.toArray<HTMLElement>("[data-spin]", depthField) : [];
  const depthFaders = depthField ? gsap.utils.toArray<HTMLElement>(".depth-obj, .depth-floor, .depth-wall", depthField) : [];
  const cubesPlane = depthField?.querySelector<HTMLElement>("[data-cubes]");

  // Cubes on the floor: only with the horizontal row (desktop).
  const cubes = cubesPlane && config.axis === "x" ? floorCubes(cubesPlane, frame) : null;

  gsap.set(frame, { perspective: config.perspective });
  gsap.set(hero, { transformOrigin: "50% 50%", force3D: true });

  // ---- Axis ---------------------------------------------------------------
  // The row travels along x on desktop and y on phones. Everything below is
  // written along "the axis"; only the transform names differ. (The curve's
  // projection maths is identical for both: rotateY(a) and rotateX(-a) move
  // an edge at local offset l to depth -l·sin(a).)
  const vertical = config.axis === "y";
  const AX = vertical ? "y" : "x";
  const ROT = vertical ? "rotateX" : "rotateY";
  const turn = (deg: number) => (vertical ? -deg : deg);

  // ---- Geometry (re-measured on every refresh) ----------------------------
  // Transforms don't affect layout, so offsetLeft/Top/Width/Height stay stable.
  let frameWidth = 0; // frame size along the axis
  let centers: number[] = [];
  let halfWidths: number[] = [];
  let radius = 0;
  let gapPx = 0;
  const measure = () => {
    frameWidth = vertical ? frame.clientHeight : frame.clientWidth;
    const trackStyle = getComputedStyle(track ?? frame);
    gapPx = parseFloat(vertical ? trackStyle.rowGap : trackStyle.columnGap) || 0;
    radius = parseFloat(getComputedStyle(frame).borderTopLeftRadius) || 0; // same --radius as the cards
    centers = items.map((el) => (vertical ? el.offsetTop + el.offsetHeight / 2 : el.offsetLeft + el.offsetWidth / 2));
    halfWidths = items.map((el) => (vertical ? el.offsetHeight : el.offsetWidth) / 2);
  };
  measure();

  // How much an element at depth z appears scaled on screen.
  const P = config.perspective;
  const depthFactor = (z: number) => P / (P - z);
  const trackFactor = depthFactor(config.trackDepth);

  // Track x values: off-screen right → first card parked beside the shrunken
  // video → each item centred in turn (see the timeline).
  const offscreenX = () =>
    (config.entryDistance / 100) * frameWidth - ((vertical ? items[0]?.offsetTop : items[0]?.offsetLeft) ?? 0);
  const rowStartX = () => {
    const heroHalf = (frameWidth / 2) * config.heroScale * depthFactor(config.heroDepth);
    const firstLeft = heroHalf / trackFactor + gapPx; // distance from centre, in track space
    return frameWidth / 2 + firstLeft + (halfWidths[0] ?? 0) - (centers[0] ?? 0);
  };

  // ---- Render state -------------------------------------------------------
  // Tweens animate these plain objects; `render` turns them into transforms
  // so the video can share the row's movement and curve.
  const trackState = { x: 0 };
  const heroState = { z: 0, scale: 1 };
  let parkedX = 0; // trackState.x at the moment the row starts moving the video

  const bend = (d: number) => gsap.utils.clamp(-1.5, 1.5, d);
  const toRad = Math.PI / 180;
  // On-screen x (from the frame centre) of a point at local x `lx` on a plane
  // centred at `cx`, depth `cz`, turned by `deg` around Y.
  const project = (cx: number, cz: number, lx: number, deg: number) => {
    const X = cx + lx * Math.cos(deg * toRad);
    const Z = cz - lx * Math.sin(deg * toRad);
    return (X * P) / (P - Z);
  };

  const render = () => {
    const half = frameWidth / 2 || 1;

    // The video rides with the row once the row passes its parked position,
    // scaled so it moves at the same on-screen speed as the cards.
    const heroFactor = depthFactor(heroState.z);
    const shift = Math.min(0, trackState.x - parkedX);
    const heroX = (shift * trackFactor) / heroFactor;
    const dh = bend((heroX * heroFactor) / half);
    // Counter-scale the corner radius so the shrunken video's corners look
    // the same as the cards' (which sit at trackDepth) instead of shrinking.
    const shrink = gsap.utils.clamp(0, 1, (1 - heroState.scale) / (1 - config.heroScale || 1));
    const onScreen = heroState.scale * heroFactor;
    const cornerRadius = (radius * gsap.utils.interpolate(1, trackFactor, shrink)) / onScreen;
    const heroZ = heroState.z - Math.abs(dh) * config.curveDepth;
    const heroDeg = dh * config.curveRotate;
    gsap.set(hero, {
      [AX]: heroX,
      z: heroZ,
      scale: heroState.scale,
      [ROT]: turn(heroDeg),
      borderRadius: cornerRadius,
    });
    // The fog on the video's sides and the background objects fade in as the
    // video turns into a card.
    if (fog) gsap.set(fog, { opacity: shrink });

    // Background objects: the layer drifts with the row (deeper objects move
    // slower on screen thanks to perspective) and some objects slowly turn.
    if (depthField) {
      // The room and objects drift sideways with a horizontal row; with a
      // vertical row (phones) they stay put.
      const layerX = vertical ? 0 : (trackState.x - offscreenX()) * config.depthParallax;
      gsap.set(depthField, { x: layerX });
      // Cancel the layer's drift on the floor except for the part within one
      // 200px grid cell: the pattern repeats, so it looks continuous.
      if (room) gsap.set(room, { x: -layerX + (layerX % GRID) });
      // Appear only once the video is card-sized, so nothing sits behind it
      // while it is still large.
      gsap.set(depthFaders, { opacity: gsap.utils.clamp(0, 1, (shrink - 0.7) / 0.3) });
      spinners.forEach((el) => {
        gsap.set(el, { rotateY: layerX * config.depthSpin * Number(el.dataset.spin || 1) });
      });
    }

    if (!track) return;

    // Keep the first card at least one gap clear of the video's trailing
    // edge (right, or bottom on phones)
    // at every moment and viewport size (both edges measured on screen,
    // including their curve), so they never overlap.
    const heroRight = project(heroX, heroZ, half * heroState.scale, heroDeg);
    const minLeft = heroRight + gapPx * trackFactor;
    const cardLeft = (x: number) => {
      const c = centers[0] + x - half;
      const d = bend(c / half);
      return project(c, config.trackDepth - Math.abs(d) * config.curveDepth, -(halfWidths[0] ?? 0), d * config.curveRotate);
    };
    let x = trackState.x;
    for (let k = 0; k < 4 && items.length; k++) {
      const left = cardLeft(x);
      if (left >= minLeft - 0.5) break;
      x += (minLeft - left) / trackFactor;
    }

    // The floor cubes come out once the footer is (nearly) centred.
    if (cubes && items.length) {
      const endX = half - centers[items.length - 1];
      cubes.setActive(Math.abs(x - endX) < frameWidth * 0.06);
    }

    gsap.set(track, { [AX]: x, z: config.trackDepth });
    items.forEach((el, i) => {
      const d = bend((centers[i] + x - half) / half);
      gsap.set(el, { [ROT]: turn(d * config.curveRotate), z: -Math.abs(d) * config.curveDepth, transformOrigin: "50% 50%" });
    });
  };
  const refreshPositions = () => {
    parkedX = rowStartX();
    if (tl.progress() === 0) trackState.x = offscreenX();
    render();
  };

  // ---- Timeline -----------------------------------------------------------
  const tl = gsap.timeline({ paused: true, defaults: { ease: "none", immediateRender: false } });
  let trigger: ScrollTrigger | undefined;
  trackState.x = offscreenX();
  parkedX = rowStartX();
  render();

  // 1. Scroll scrubs the video 0 → 100%.
  const playhead = { p: 0 };
  tl.addLabel("video").to(playhead, {
    p: 1,
    duration: config.videoDistance,
    onUpdate: () => {
      // Only a real scroll hands playback to the timeline (the scrub can
      // render tiny values on load/refresh without the user moving).
      if (trigger && window.scrollY > trigger.start + 2) takeOverVideo();
      if (scrollOwnsVideo) seekVideo(playhead.p * videoDuration());
    },
  });

  // 1b. The intro text changes while the video plays: part one melts away
  //     (liquid ripple + blur, lines lifting off one after another), then the
  //     "about me" label and paragraph rise in. Scrubbed, so it reverses.
  const V = config.videoDistance;
  const introOne = hero.querySelector<HTMLElement>("[data-intro-one]");
  const introOneParts = introOne ? Array.from(introOne.children) : [];
  const introPoints = gsap.utils.toArray<HTMLElement>("[data-intro-point]", hero);
  const disp = hero.querySelector<SVGElement>("[data-liquid-disp]");
  const blur = hero.querySelector<SVGElement>("[data-liquid-blur]");
  const liquid = { amount: 0 };
  tl.to(
    liquid,
    {
      amount: 1,
      duration: V * 0.34,
      ease: "power1.in",
      onUpdate: () => {
        disp?.setAttribute("scale", (liquid.amount * 90).toFixed(1));
        blur?.setAttribute("stdDeviation", (liquid.amount * 5).toFixed(2));
      },
    },
    `video+=${V * 0.1}`,
  );
  tl.to(introOneParts, { opacity: 0, y: -18, duration: V * 0.28, stagger: V * 0.04, ease: "power1.in" }, `video+=${V * 0.14}`);
  tl.fromTo(
    introPoints,
    { opacity: 0, y: 26, filter: "blur(10px)" },
    { opacity: 1, y: 0, filter: "blur(0px)", duration: V * 0.2, stagger: V * 0.12, ease: "power2.out" },
    `video+=${V * 0.5}`,
  );

  // 2. The finished video moves back and shrinks to card size while the
  //    first case study slides in beside it.
  tl.addLabel("heroBack")
    .fromTo(
      heroState,
      { z: 0, scale: 1 },
      { z: config.heroDepth, scale: config.heroScale, duration: config.heroDistance, ease: "power1.inOut", onUpdate: render },
      "heroBack",
    )
    .fromTo(
      trackState,
      { x: offscreenX },
      { x: rowStartX, duration: config.heroDistance, ease: "power2.out", onUpdate: render },
      "heroBack",
    );

  // 3. The whole row (video first) glides right → left on a gentle curve,
  //    one card at a time: each move eases in and out, then rests with the
  //    card centred. `restTimes` are the timeline times of those rests.
  const restTimes: number[] = [];
  const hold = () => {
    restTimes.push(tl.duration() + config.holdDistance / 2);
    tl.to({}, { duration: config.holdDistance });
  };
  const centreOn = (i: number) => () => frameWidth / 2 - (centers[i] ?? 0);
  hold(); // resting on the video card
  items.forEach((_, i) => {
    tl.fromTo(
      trackState,
      { x: i === 0 ? rowStartX : centreOn(i - 1) },
      { x: centreOn(i), duration: config.cardDistance, ease: "sine.inOut", onUpdate: render },
    );
    hold();
  });

  // ---- Pin + scrub --------------------------------------------------------
  trigger = ScrollTrigger.create({
    trigger: stage,
    start: "top top",
    end: () => `+=${tl.duration() * window.innerHeight * config.scrollPerUnit}`,
    pin: true,
    scrub: config.scrub,
    animation: tl,
    invalidateOnRefresh: true,
    anticipatePin: 1,
    onRefreshInit: measure,
    onRefresh: refreshPositions,
  });

  // ---- Gentle settle: after scrolling stops, glide to the nearest rest -----
  let settleTimer = 0;
  const settle = () => {
    if (!config.settle || !trigger || !restTimes.length) return;
    // Never pull against a scroll in progress: wait until the smooth scroll
    // (the visitor's, or a previous settle) has fully come to rest.
    if (lenis.isScrolling) {
      settleTimer = window.setTimeout(settle, 120);
      return;
    }
    const span = trigger.end - trigger.start;
    const y = window.scrollY;
    if (y > trigger.end + 1) return;
    const t = ((y - trigger.start) / span) * tl.duration();
    // Leave the video scrub alone; only settle once the row is on screen.
    if (t < restTimes[0] - config.heroDistance / 2) return;
    const nearest = restTimes.reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) ? b : a));
    const target = trigger.start + (nearest / tl.duration()) * span;
    if (Math.abs(target - y) < 2) return;
    lenis.scrollTo(target, { duration: 1.1, easing: (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2) });
  };
  lenis.on("scroll", () => {
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(settle, 180);
  });

  // Autoplay the intro once, but only if the visitor is at the very top.
  if (video && config.autoplayOnLoad && trigger.progress === 0) {
    video.play().catch(() => {
      // Autoplay blocked: scroll simply drives the video from frame 0.
      scrollOwnsVideo = true;
    });
  } else {
    scrollOwnsVideo = true;
  }

  return () => {
    cubes?.destroy();
    window.clearTimeout(settleTimer);
    gsap.ticker.remove(raf);
    lenis.destroy();
    video?.pause();
  };
}

/**
 * A small game on the floor at the end of the row: one cube rises out of a
 * floor cell; click it and it sinks back while another rises in a different
 * cell, at a different height. Cells are picked from those visible in the
 * lower right of the frame, so they work at any viewport size.
 */
function floorCubes(plane: HTMLElement, frame: HTMLElement) {
  const cube = plane.querySelector<HTMLElement>("[data-cube]");
  const probe = plane.querySelector<HTMLElement>("[data-cube-probe]");
  const cell = GRID;
  const inset = 36; // gap between the cube and its cell's lines
  const heights = [90, 130, 170, 210, 250, 290];
  let active = false;
  let busy = false;
  let up = false;
  let lastCell = "";
  let lastHeight = 0;
  let popTimer = 0;
  if (!cube || !probe) return { setActive() {}, destroy() {} };

  gsap.set(cube, { opacity: 0, "--s": `${cell - inset * 2}px`, "--h": "0px" });

  // Floor cells whose footprint sits fully in the lower right of the frame.
  const visibleCells = () => {
    const f = frame.getBoundingClientRect();
    const cols = Math.floor(plane.offsetWidth / cell);
    const rows = Math.floor(plane.offsetHeight / cell);
    const found = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        probe.style.left = `${c * cell + inset}px`;
        probe.style.top = `${r * cell + inset}px`;
        const b = probe.getBoundingClientRect();
        const inside =
          b.left > f.left + f.width * 0.6 && b.right < f.right - 16 && b.bottom < f.bottom - 12 && b.top > f.top + f.height * 0.55;
        if (inside) found.push({ key: `${c}:${r}`, c, r, size: b.width * b.height });
      }
    }
    // The six largest on screen (nearest the viewer).
    return found.sort((a, b) => b.size - a.size).slice(0, 6);
  };

  const pop = () => {
    const cells = visibleCells().filter((k) => k.key !== lastCell);
    if (!cells.length) return;
    const pick = cells[Math.floor(Math.random() * cells.length)];
    const options = heights.filter((h) => h !== lastHeight);
    const h = options[Math.floor(Math.random() * options.length)];
    lastCell = pick.key;
    lastHeight = h;
    busy = true;
    gsap.set(cube, { left: pick.c * cell + inset, top: pick.r * cell + inset, "--h": "0px" });
    gsap.to(cube, { opacity: 1, duration: 0.35, ease: "power1.out" });
    gsap.to(cube, {
      "--h": `${h}px`,
      duration: 1.2,
      ease: "expo.out",
      onComplete: () => {
        busy = false;
        up = true;
        cube.classList.add("is-up");
      },
    });
  };

  const sink = (then?: () => void) => {
    busy = true;
    up = false;
    cube.classList.remove("is-up");
    gsap.killTweensOf(cube);
    gsap.to(cube, {
      "--h": "0px",
      duration: 0.7,
      ease: "power2.inOut",
      onComplete: () => {
        gsap.to(cube, { opacity: 0, duration: 0.2 });
        busy = false;
        then?.();
      },
    });
  };

  const onClick = () => {
    if (busy || !up) return;
    sink(() => {
      popTimer = window.setTimeout(() => active && pop(), 180);
    });
  };
  cube.addEventListener("click", onClick);

  return {
    setActive(next: boolean) {
      if (next === active) return;
      active = next;
      window.clearTimeout(popTimer);
      if (active) popTimer = window.setTimeout(() => active && !up && !busy && pop(), 450);
      else if (up || busy) sink();
    },
    destroy() {
      window.clearTimeout(popTimer);
      cube.removeEventListener("click", onClick);
      gsap.killTweensOf(cube);
    },
  };
}
