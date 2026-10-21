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
  // `wheelIntent` (set up with the timeline below) can take a wheel gesture
  // over, to glide card by card; it returns false when it has.
  let wheelIntent = (_deltaY: number) => true;
  const lenis = new Lenis({
    lerp: config.smoothness,
    wheelMultiplier: 0.9,
    virtualScroll: ({ deltaY, event }) => {
      if (event.type !== "wheel" || wheelIntent(deltaY)) return true;
      event.preventDefault();
      return false;
    },
  });
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
  const shades = items.map((el) => el.querySelector<HTMLElement>(".paper-shade"));
  // Sliced cards (see ProjectCard): their slices and each slice's offset from
  // the card's middle (measured below).
  const strips = items.map((el) => gsap.utils.toArray<HTMLElement>("[data-strip]", el));
  let stripOffsets: number[][] = [];
  const stripCache = new Map<HTMLElement, string>();
  const warp = stage.querySelector<HTMLElement>("[data-warp]");
  const warpMap = warp?.querySelector<SVGElement>("[data-warp-map]");
  const warpDisp = warp?.querySelector<SVGElement>("[data-warp-disp]");
  const warpFilter = warp?.querySelector<SVGElement>("[data-warp-filter]");
  const bendOn = !!(warp && warpMap && warpDisp && warpFilter && config.edgeBend > 0);
  const heroShade = hero.querySelector<HTMLElement>(".paper-shade");
  const fog = hero.querySelector<HTMLElement>(".hero-fog");
  const border = hero.querySelector<HTMLElement>(".hero-border");
  const depthField = stage.querySelector<HTMLElement>("[data-depth-field]");
  const room = depthField?.querySelector<HTMLElement>("[data-room]");
  const spinners = depthField ? gsap.utils.toArray<HTMLElement>("[data-spin]", depthField) : [];
  const depthFaders = depthField ? gsap.utils.toArray<HTMLElement>(".depth-obj, .depth-floor, .depth-wall", depthField) : [];
  const cubesPlane = depthField?.querySelector<HTMLElement>("[data-cubes]");

  // Cubes on the floor: only with the horizontal row (desktop).
  const cubes = cubesPlane && config.axis === "x" ? floorCubes(cubesPlane, frame) : null;

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
  // Depths are tuned for a 1440px-wide frame. On desktop they scale with the
  // frame width (perspective too), so the curve and the background keep the
  // same proportions on any screen; only absolute distances change, and
  // every ratio below (P / (P - z)) stays the same.
  const cfg = { ...config };
  const depthScale = () => (vertical ? 1 : Math.max(0.5, frame.clientWidth / 1440));
  const scaleDepths = () => {
    const zs = depthScale();
    cfg.perspective = config.perspective * zs;
    cfg.heroDepth = config.heroDepth * zs;
    cfg.trackDepth = config.trackDepth * zs;
    cfg.curveDepth = config.curveDepth * zs;
    frame.style.setProperty("--zs", zs.toFixed(4));
    gsap.set(frame, { perspective: cfg.perspective });
    // The warp wrapper holds the video and the row, so it carries the same
    // perspective (same box, so the same vanishing point).
    if (warp) gsap.set(warp, { perspective: cfg.perspective });
  };
  // Case-study cards are sized so that, at their depth, they appear exactly
  // as large as the video card once it has moved back.
  const Pm = config.perspective;
  const cardScale = (config.heroScale * (Pm / (Pm - config.heroDepth))) / (Pm / (Pm - config.trackDepth));
  const measure = () => {
    scaleDepths();
    frame.style.setProperty("--card-w", `${(frame.clientWidth * cardScale).toFixed(1)}px`);
    frame.style.setProperty("--card-h", `${(frame.clientHeight * cardScale).toFixed(1)}px`);
    frameWidth = vertical ? frame.clientHeight : frame.clientWidth;
    const trackStyle = getComputedStyle(track ?? frame);
    gapPx = parseFloat(vertical ? trackStyle.rowGap : trackStyle.columnGap) || 0;
    radius = parseFloat(getComputedStyle(frame).getPropertyValue("--radius")) || 0; // the cards' corner radius
    centers = items.map((el) => (vertical ? el.offsetTop + el.offsetHeight / 2 : el.offsetLeft + el.offsetWidth / 2));
    halfWidths = items.map((el) => (vertical ? el.offsetHeight : el.offsetWidth) / 2);
    stripOffsets = strips.map((list, i) => {
      const w = (halfWidths[i] * 2) / (list.length || 1);
      return list.map((_, j) => (j + 0.5) * w - halfWidths[i]);
    });
    stripCache.clear();
    drawWarpMap();
  };

  // ---- Edge bend map -------------------------------------------------------
  // A displacement image the size of the frame: mid-grey (no shift) across
  // the flat middle; in each edge zone the content is stretched across the
  // row (taller, as if curling towards the viewer) and gently squeezed along
  // it, easing in from nothing at the zone's inner side.
  const warpPad = 0.15; // the filter also reaches this far past each side, so squeezed-in content is there
  function drawWarpMap() {
    if (!bendOn || !warpMap || !warpFilter || !frame) return;
    const W = frame.clientWidth;
    const H = frame.clientHeight;
    const N = 256;
    const canvas = document.createElement("canvas");
    canvas.width = N;
    canvas.height = N;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(N, N);
    const zone = config.edgeZone;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const along = vertical ? (j + 0.5) / N : (i + 0.5) / N;
        const across = vertical ? (i + 0.5) / N : (j + 0.5) / N;
        const tStart = gsap.utils.clamp(0, 1, (zone - along) / zone);
        const tEnd = gsap.utils.clamp(0, 1, (along - (1 - zone)) / zone);
        const t = Math.max(tStart, tEnd);
        const p = t * t; // eases in: flat → curling
        const sign = tEnd > tStart ? 1 : -1;
        const alongCh = 0.5 + sign * 0.3 * p; // squeeze towards the edge
        const acrossCh = 0.5 - (across - 0.5) * p; // stretch away from the middle line
        const k = (j * N + i) * 4;
        img.data[k] = Math.round((vertical ? acrossCh : alongCh) * 255);
        img.data[k + 1] = Math.round((vertical ? alongCh : acrossCh) * 255);
        img.data[k + 2] = 128;
        img.data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    warpMap.setAttribute("href", canvas.toDataURL("image/png"));
    warpMap.setAttribute("width", String(W));
    warpMap.setAttribute("height", String(H));
    const px = vertical ? 0 : W * warpPad;
    const py = vertical ? H * warpPad : 0;
    warpFilter.setAttribute("x", String(-px));
    warpFilter.setAttribute("y", String(-py));
    warpFilter.setAttribute("width", String(W + px * 2));
    warpFilter.setAttribute("height", String(H + py * 2));
    lastBend = -1; // force the strength to be re-applied
  }
  let lastBend = -1;
  const applyBend = (amount: number) => {
    if (!bendOn || !warp || !warpDisp || !frame) return;
    const a = Math.round(amount * 1000) / 1000;
    if (a === lastBend) return;
    lastBend = a;
    // Height at the very edge grows by `a`: scale so that H / (H - scale) = 1 + a.
    const size = vertical ? frame.clientWidth : frame.clientHeight;
    warpDisp.setAttribute("scale", (size * (1 - 1 / (1 + a))).toFixed(2));
    warp.style.filter = a > 0.002 ? "url(#edge-bend)" : "none";
  };

  measure();

  // How much an element at depth z appears scaled on screen.
  const depthFactor = (z: number) => cfg.perspective / (cfg.perspective - z);
  const trackFactor = depthFactor(cfg.trackDepth); // the same at every depth scale

  // Track x values: off-screen right → first card parked beside the shrunken
  // video → each item centred in turn (see the timeline).
  const offscreenX = () =>
    (config.entryDistance / 100) * frameWidth - ((vertical ? items[0]?.offsetTop : items[0]?.offsetLeft) ?? 0);
  const rowStartX = () => {
    const heroHalf = (frameWidth / 2) * config.heroScale * depthFactor(cfg.heroDepth);
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
  // The curve for a plane at bend `d` (0 = centred). Inward: like standing in
  // a ring of cards, the side ones come closer and turn to face the viewer;
  // outward: they recede and turn away.
  const inward = config.curveInward;
  // Flat in the middle, then a smooth (smoothstep) ease into the full curve
  // by the time a card reaches its resting spot beside the centre.
  const curveShape = (d: number) => {
    const k = gsap.utils.clamp(0, 1, (Math.abs(d) - config.curveFlat) / (1.4 - config.curveFlat));
    return Math.sign(d) * k * k * (3 - 2 * k);
  };
  const curveZ = (d: number) => (inward ? 1 : -1) * Math.abs(curveShape(d)) * cfg.curveDepth;
  const curveDeg = (d: number) => (inward ? -1 : 1) * curveShape(d) * config.curveRotate;
  const toRad = Math.PI / 180;
  // On-screen x (from the frame centre) of a point at local x `lx` on a plane
  // centred at `cx`, depth `cz`, turned by `deg` around Y about local x `h`
  // (0 = its middle; ± half its width = an edge, for the hinged curl).
  const project = (cx: number, cz: number, lx: number, deg: number, h = 0) => {
    const X = cx + h + (lx - h) * Math.cos(deg * toRad);
    const Z = cz - (lx - h) * Math.sin(deg * toRad);
    return (X * cfg.perspective) / (cfg.perspective - Z);
  };
  // ---- Paper curl for sliced cards ----------------------------------------
  // The row's path (in track px from the frame centre): straight across the
  // middle, then a circular arc that bends towards the viewer, so a card
  // laid along it curls like paper as it enters and leaves. The straight
  // part covers the centred card plus half the gap, so that card stays flat.
  const curlOn = config.curl && !vertical && strips.some((s) => s.length > 0);
  const curlPoint = (u: number) => {
    const start = (halfWidths[0] ?? 0) + gapPx / 2;
    const s = Math.abs(u) - start;
    if (!curlOn || s <= 0) return { X: u, Z: 0, phi: 0 };
    const R = Math.max(1, config.curlRadius * frameWidth);
    const phi = Math.min(Math.PI / 2, s / R);
    const sign = Math.sign(u);
    return {
      X: sign * (start + R * Math.sin(phi)),
      Z: (inward ? 1 : -1) * R * (1 - Math.cos(phi)),
      phi: sign * phi,
    };
  };

  // The hinge for a card at bend `d`: its inner edge (nearer the centre).
  const hingeOrigin = (d: number) =>
    !config.curveHinge || d === 0 ? "50% 50%" : vertical ? (d > 0 ? "50% 0%" : "50% 100%") : d > 0 ? "0% 50%" : "100% 50%";

  // ---- Paper feel --------------------------------------------------------
  // `paper.flex` follows the row's speed through a soft spring (see paperTick):
  // positive while the row moves towards the start (left / up). Cards lean
  // into the motion by it, and their shading follows lean and curve.
  const paper = { flex: 0, vel: 0, lastX: Number.NaN, shown: 0 };
  // How far a plane's start/end edges reach into the bending zones (0–1),
  // from its edges on screen (frame-centred px along the axis).
  let bendNow = 0;
  const zoneDepth = (startEdge: number, endEdge: number) => {
    const half = frameWidth / 2 || 1;
    const zonePx = config.edgeZone * frameWidth || 1;
    const k = config.edgeBend > 0 ? Math.min(1, bendNow / config.edgeBend) : 0;
    const a = gsap.utils.clamp(0, 1, (zonePx - (startEdge + half)) / zonePx);
    const b = gsap.utils.clamp(0, 1, (endEdge + half - (frameWidth - zonePx)) / zonePx);
    return { a: a * a * k, b: b * b * k };
  };
  const shadeSides = (d: number, lean: number, zone = { a: 0, b: 0 }) => {
    // Which edge recedes on the curve: for the inward ring it's the edge
    // nearer the centre; leaning towards the start sinks the far edge. In
    // the bending zones the curling edge darkens.
    const curve = config.curveRotate > 0 ? Math.abs(curveShape(d)) : 0;
    const startByCurve = (inward ? d > 0 : d < 0) ? curve : 0;
    const endByCurve = (inward ? d < 0 : d > 0) ? curve : 0;
    const k = config.paperShade;
    return {
      "--shade-a": (Math.min(1, startByCurve + Math.max(0, -lean) * 0.9 + zone.a) * k).toFixed(3),
      "--shade-b": (Math.min(1, endByCurve + Math.max(0, lean) * 0.9 + zone.b) * k).toFixed(3),
      "--sheen": (Math.min(0.12, Math.abs(lean) * 0.1 + curve * 0.04 + Math.max(zone.a, zone.b) * 0.06)).toFixed(3),
    };
  };

  const render = () => {
    const half = frameWidth / 2 || 1;
    const leanDeg = paper.flex * config.paperLean;

    // The video rides with the row once the row passes its parked position,
    // scaled so it moves at the same on-screen speed as the cards.
    const heroFactor = depthFactor(heroState.z);
    const shift = Math.min(0, trackState.x - parkedX);
    const heroRide = (shift * trackFactor) / heroFactor;
    // The video only leans once it rides with the row (eased in, see `wait`).
    let heroLean = 0;
    // Its place on the curve for a given x.
    const heroPose = (hx: number) => {
      const dh = bend((hx * heroFactor) / half);
      return { z: heroState.z + curveZ(dh), deg: curveDeg(dh) + heroLean, dh };
    };
    const heroRight = (hx: number) => {
      const pose = heroPose(hx);
      return project(hx, pose.z, half * heroState.scale, pose.deg);
    };
    // Square while it fills the screen, then rounding to the cards' radius as
    // it moves back (counter-scaled so it matches the cards at trackDepth).
    const shrink = gsap.utils.clamp(0, 1, (1 - heroState.scale) / (1 - config.heroScale || 1));
    const onScreen = heroState.scale * heroFactor;
    const cornerRadius = (radius * trackFactor * shrink) / onScreen;
    // The edge bend comes in as the video settles into a card.
    bendNow = config.edgeBend * gsap.utils.clamp(0, 1, (shrink - 0.5) / 0.5);
    applyBend(bendNow);

    // Keep the first card at least one gap clear of the video's trailing
    // edge (right, or bottom on phones) at every moment and viewport size,
    // with both edges measured on screen including their curve, so they never
    // overlap. While the video is still parked, the row waits for it; once
    // it rides along, the video gives way instead, so the row never stalls
    // (on the inward curve the first card's outer edge swings towards it).
    const gap = gapPx * trackFactor;
    const cardLeft = (x: number) => {
      const c = (centers[0] ?? 0) + x - half;
      if (curlOn && strips[0]?.length) {
        const p = curlPoint(c - (halfWidths[0] ?? 0));
        return project(p.X, cfg.trackDepth + p.Z, 0, 0);
      }
      const d = bend(c / half);
      const hw = halfWidths[0] ?? 0;
      const h = config.curveHinge && d !== 0 ? (d > 0 ? -hw : hw) : 0;
      return project(c, cfg.trackDepth + curveZ(d), -hw, curveDeg(d) + leanDeg, h);
    };
    let x = trackState.x;
    let heroX = heroRide;
    if (track && items.length) {
      let pushed = x;
      for (let k = 0; k < 4; k++) {
        const left = cardLeft(pushed);
        const minLeft = heroRight(heroRide) + gap;
        if (left >= minLeft - 0.5) break;
        pushed += (minLeft - left) / trackFactor;
      }
      // Hand over smoothly from "row waits" to "video gives way".
      const wait = gsap.utils.clamp(0, 1, 1 + shift / (frameWidth * 0.25));
      x += (pushed - x) * wait;
      heroLean = leanDeg * (1 - wait);
      if (shift < 0) {
        const maxRight = cardLeft(x) - gap;
        for (let k = 0; k < 6; k++) {
          const over = heroRight(heroX) - maxRight;
          if (over <= 0.5) break;
          heroX -= over / heroFactor;
        }
      }
    }

    const pose = heroPose(heroX);
    gsap.set(hero, {
      [AX]: heroX,
      z: pose.z,
      scale: heroState.scale,
      [ROT]: turn(pose.deg),
      borderRadius: cornerRadius,
    });
    // The fog on the video's sides and the background objects fade in as the
    // video turns into a card.
    if (fog) gsap.set(fog, { opacity: shrink });
    // Its hairline border only shows once it's a card, not at the screen edge.
    if (border) gsap.set(border, { opacity: shrink });
    if (heroShade) {
      const hc = heroX * heroFactor;
      const hw = half * heroState.scale * heroFactor;
      gsap.set(heroShade, shadeSides(pose.dh, heroLean / (config.paperLean || 1), zoneDepth(hc - hw, hc + hw)));
    }

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

    // The floor cubes come out once the footer is (nearly) centred.
    if (cubes && items.length) {
      const endX = half - centers[items.length - 1];
      cubes.setActive(Math.abs(x - endX) < frameWidth * 0.06);
    }

    gsap.set(track, { [AX]: x, z: cfg.trackDepth });
    items.forEach((el, i) => {
      const d = bend((centers[i] + x - half) / half);
      if (curlOn && strips[i].length) {
        // Sliced card: it stays flat itself; each slice sits on the curve.
        gsap.set(el, { [ROT]: 0, z: 0 });
        const c = centers[i] + x - half;
        strips[i].forEach((strip, j) => {
          const u = c + stripOffsets[i][j];
          const p = curlPoint(u);
          const deg = ((inward ? -1 : 1) * p.phi * 180) / Math.PI;
          const t = `translate3d(${(p.X - u).toFixed(2)}px,0,${p.Z.toFixed(2)}px) rotateY(${deg.toFixed(2)}deg)`;
          if (stripCache.get(strip) === t) return;
          stripCache.set(strip, t);
          strip.style.transform = t;
          // The curling part darkens a little, like light falling off paper.
          strip.style.setProperty("--sh", ((1 - Math.cos(p.phi)) * 0.9 * config.paperShade * 2).toFixed(3));
        });
        return;
      }
      gsap.set(el, { [ROT]: turn(curveDeg(d) + leanDeg), z: curveZ(d), transformOrigin: hingeOrigin(d) });
      const shade = shades[i];
      if (shade) {
        const c = (centers[i] + x - half) * trackFactor;
        const w = (halfWidths[i] ?? 0) * trackFactor;
        gsap.set(shade, shadeSides(d, paper.flex, zoneDepth(c - w, c + w)));
      }
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
      { z: () => cfg.heroDepth, scale: config.heroScale, duration: config.heroDistance, ease: "power1.inOut", onUpdate: render },
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
      // Linear here: the card-by-card glide (or the settle) supplies the ease.
      { x: centreOn(i), duration: config.cardDistance, ease: "none", onUpdate: render },
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

  // ---- Settle: after a touch swipe, key press or scrollbar drag stops, ----
  // carry on to the next card in the direction you moved (a small nudge is
  // enough), with the same gentle ease as the wheel glide.
  let settleTimer = 0;
  let settledT: number | null = null; // the rest we last arrived at
  // Soft sine ease-in-out: no sudden push in the middle.
  const glideEase = (k: number) => -(Math.cos(Math.PI * k) - 1) / 2;
  const settle = () => {
    if (!config.settle || !trigger || !restTimes.length) return;
    // Never pull against a scroll in progress: wait until the smooth scroll
    // (the visitor's, or a previous glide) has fully come to rest.
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
    const from = settledT ?? nearest;
    let target = from;
    if (t > from + 0.03) target = restTimes.find((r) => r >= t - 0.001) ?? restTimes[restTimes.length - 1];
    else if (t < from - 0.03) target = [...restTimes].reverse().find((r) => r <= t + 0.001) ?? restTimes[0];
    const targetY = trigger.start + (target / tl.duration()) * span;
    if (Math.abs(targetY - y) < 2) {
      settledT = target;
      return;
    }
    lenis.scrollTo(targetY, {
      duration: config.snapDuration,
      easing: glideEase,
      onComplete: () => {
        settledT = target;
      },
    });
  };
  const scheduleSettle = () => {
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(settle, 180);
  };
  lenis.on("scroll", scheduleSettle);
  // Also the browser's own scroll event: right after a programmatic glide,
  // Lenis can skip the next native scroll (a key press or small swipe).
  window.addEventListener("scroll", scheduleSettle, { passive: true });

  // ---- Card by card: a wheel gesture in the row glides to the next card ---
  let snapping = false;
  let gestureUsed = false;
  let lastWheelAt = 0;
  let lastWheelSize = 0;
  let gestureSize = 0; // strength of the push that started the last glide
  wheelIntent = (deltaY: number) => {
    if (!config.snap || !trigger || !restTimes.length || deltaY === 0) return true;
    const now = performance.now();
    const size = Math.abs(deltaY);
    // A new gesture: after a short pause, or a push clearly stronger than
    // the fading tail (trackpad inertia) of the last one. A wheel that keeps
    // spinning at full strength after a glide also counts, to keep going.
    const paused = now - lastWheelAt > 220;
    if (gestureUsed && !paused) gestureSize = Math.max(gestureSize, size); // track the push's peak
    const fresh = paused || size > lastWheelSize * 1.6 + 4 || (!snapping && size >= gestureSize * 0.8);
    lastWheelAt = now;
    lastWheelSize = size;
    const span = trigger.end - trigger.start;
    const t = ((window.scrollY - trigger.start) / span) * tl.duration();
    const eps = 0.02;
    const down = deltaY > 0;
    // Free scrolling while the video plays, and back up into it from the
    // first rest; card by card from the moment the video starts moving back.
    const rowStart = restTimes[0] - config.holdDistance / 2 - config.heroDistance;
    if (down ? t < rowStart - eps : t <= restTimes[0] + eps) {
      gestureUsed = false;
      settledT = null;
      return true;
    }
    if (snapping || (gestureUsed && !fresh)) return false;
    const target = down ? restTimes.find((r) => r > t + eps) : [...restTimes].reverse().find((r) => r < t - eps);
    if (target === undefined) return true;
    gestureUsed = true;
    gestureSize = size;
    snapping = true;
    window.clearTimeout(settleTimer);
    lenis.scrollTo(trigger.start + (target / tl.duration()) * span, {
      duration: config.snapDuration,
      easing: glideEase,
      lock: true,
      force: true,
      onComplete: () => {
        snapping = false;
        settledT = target;
      },
    });
    return false;
  };

  // ---- Paper spring: lean follows the row's speed, then settles softly ----
  const paperTick = () => {
    const dt = Math.min(0.05, gsap.ticker.deltaRatio(60) / 60);
    const x = trackState.x;
    const speed = Number.isNaN(paper.lastX) ? 0 : (x - paper.lastX) / dt;
    paper.lastX = x;
    // Full lean at about 1.6 frame widths per second, towards the start.
    const target = gsap.utils.clamp(-1, 1, -speed / ((frameWidth || 1) * 1.6));
    // Slightly under-damped: a tiny, paper-like overshoot as it settles.
    paper.vel += (90 * (target - paper.flex) - 15 * paper.vel) * dt;
    paper.flex += paper.vel * dt;
    const moving = Math.abs(paper.flex) > 0.0005 || Math.abs(paper.vel) > 0.0005;
    if (moving || paper.shown !== 0) {
      if (!moving) paper.flex = paper.vel = 0;
      paper.shown = paper.flex;
      render();
    }
  };
  // Only needed when cards lean with speed (paperLean); skip the per-frame work otherwise.
  if (config.paperLean) gsap.ticker.add(paperTick);

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
    window.removeEventListener("scroll", scheduleSettle);
    window.clearTimeout(settleTimer);
    gsap.ticker.remove(raf);
    gsap.ticker.remove(paperTick);
    if (warp) warp.style.filter = "";
    lenis.destroy();
    video?.pause();
    frame.style.removeProperty("--card-w");
    frame.style.removeProperty("--card-h");
    frame.style.removeProperty("--zs");
  };
}

/**
 * A small game on the floor at the end of the row: one cube rises out of a
 * floor cell, filling it exactly; click it and it settles back into the
 * floor while another rises in a different cell, at a different height.
 * Cells are picked from those visible in the lower right of the frame, so it
 * works at any viewport size. All motion is slow and eased for a calm feel.
 */
function floorCubes(plane: HTMLElement, frame: HTMLElement) {
  const cube = plane.querySelector<HTMLElement>("[data-cube]");
  const probe = plane.querySelector<HTMLElement>("[data-cube-probe]");
  const cell = GRID; // the cube's footprint is one whole grid cell
  const heights = [90, 130, 170, 210, 250, 290];
  let active = false;
  let busy = false;
  let up = false;
  let rising = false;
  let height = 0;
  let lastCell = "";
  let popTimer = 0;
  if (!cube || !probe) return { setActive() {}, destroy() {} };
  // Fade the faces, never the cube itself: opacity below 1 on a 3D parent
  // flattens it, so the cube would lie flat until the fade ended.
  const faces = gsap.utils.toArray<HTMLElement>(".floor-cube__face", cube);

  gsap.set(cube, { "--s": `${cell}px`, "--h": "0px" });
  gsap.set(faces, { opacity: 0 });
  gsap.set(probe, { width: cell, height: cell });

  // Floor cells that sit fully in the lower right of the frame.
  const visibleCells = () => {
    const f = frame.getBoundingClientRect();
    const cols = Math.floor(plane.offsetWidth / cell);
    const rows = Math.floor(plane.offsetHeight / cell);
    const found = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        probe.style.left = `${c * cell}px`;
        probe.style.top = `${r * cell}px`;
        const b = probe.getBoundingClientRect();
        const inside =
          b.left > f.left + f.width * 0.58 && b.right < f.right - 16 && b.bottom < f.bottom - 12 && b.top > f.top + f.height * 0.55;
        if (inside) found.push({ key: `${c}:${r}`, c, r, size: b.width * b.height });
      }
    }
    // The six largest on screen (nearest the viewer).
    return found.sort((a, b) => b.size - a.size).slice(0, 6);
  };

  const setHeight = (h: number, duration: number, ease: string, onComplete?: () => void) =>
    gsap.to(cube, { "--h": `${h}px`, duration, ease, overwrite: "auto", onComplete });

  const pop = () => {
    const cells = visibleCells().filter((k) => k.key !== lastCell);
    if (!cells.length) return;
    const pick = cells[Math.floor(Math.random() * cells.length)];
    const options = heights.filter((h) => h !== height);
    height = options[Math.floor(Math.random() * options.length)];
    lastCell = pick.key;
    // Clickable (top and sides) from the moment it starts to rise.
    up = true;
    rising = true;
    cube.classList.add("is-up");
    gsap.set(cube, { left: pick.c * cell, top: pick.r * cell, "--h": "0px" });
    gsap.to(faces, { opacity: 1, duration: 0.7, ease: "sine.out", overwrite: true });
    // A long, soft rise: eases in from the floor and glides to a stop.
    setHeight(height, 1.9, "power2.inOut", () => {
      rising = false;
      if (cube.matches(":hover")) onEnter();
    });
  };

  // Touch feedback: the cube lifts a little under the pointer.
  const onEnter = () => {
    if (!up || busy || rising) return;
    setHeight(height + 16, 0.6, "power2.out");
  };
  const onLeave = () => {
    if (!up || busy || rising) return;
    setHeight(height, 0.7, "power2.out");
  };

  const sink = (then?: () => void) => {
    busy = true;
    up = false;
    rising = false;
    cube.classList.remove("is-up");
    gsap.killTweensOf(cube);
    gsap.killTweensOf(faces);
    gsap.set(faces, { opacity: 1 });
    const now = parseFloat(cube.style.getPropertyValue("--h")) || 0; // may still be rising
    // A gentle press, then it settles back into the floor.
    gsap
      .timeline({ onComplete: () => { busy = false; then?.(); } })
      .to(cube, { "--h": `${Math.max(now * 0.9, now - 24)}px`, duration: 0.22, ease: "power2.out" })
      .to(cube, { "--h": "0px", duration: 1.2, ease: "power3.inOut" })
      .to(faces, { opacity: 0, duration: 0.4, ease: "sine.in" }, "-=0.35");
  };

  const onClick = () => {
    if (busy || !up) return;
    sink(() => {
      popTimer = window.setTimeout(() => active && pop(), 350);
    });
  };
  cube.addEventListener("click", onClick);
  cube.addEventListener("pointerenter", onEnter);
  cube.addEventListener("pointerleave", onLeave);

  return {
    setActive(next: boolean) {
      if (next === active) return;
      active = next;
      window.clearTimeout(popTimer);
      if (active) popTimer = window.setTimeout(() => active && !up && !busy && pop(), 500);
      else if (up || busy) sink();
    },
    destroy() {
      window.clearTimeout(popTimer);
      cube.removeEventListener("click", onClick);
      cube.removeEventListener("pointerenter", onEnter);
      cube.removeEventListener("pointerleave", onLeave);
      gsap.killTweensOf(cube);
      gsap.killTweensOf(faces);
    },
  };
}
