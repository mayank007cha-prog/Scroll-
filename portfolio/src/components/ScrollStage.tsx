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
 *   video 0→100% → hero moves back in Z → floating case-study cards glide
 *   right → left on a gentle curve → footer settles in the centre
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

function buildScene(stage: HTMLElement, video: HTMLVideoElement | null, config: SceneConfig) {
  const frame = stage.querySelector<HTMLElement>(".scene-frame");
  const hero = stage.querySelector<HTMLElement>('[data-plane="hero"]');
  if (!frame || !hero) return;

  // ---- Smooth scrolling (Lenis) wired into GSAP's ticker ------------------
  const lenis = new Lenis();
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

  gsap.set(frame, { perspective: config.perspective });
  gsap.set(hero, { z: 0, scale: 1, opacity: 1, force3D: true });

  // ---- Horizontal track geometry (re-measured on every refresh) -----------
  // Transforms don't affect layout, so offsetLeft/Width stay stable.
  let frameWidth = 0;
  let centers: number[] = [];
  const measure = () => {
    frameWidth = frame.clientWidth;
    centers = items.map((el) => el.offsetLeft + el.offsetWidth / 2);
  };
  measure();
  const startX = () => (config.entryDistance / 100) * frameWidth - (items[0]?.offsetLeft ?? 0);
  // End with the last item (the footer) centred in the frame.
  const endX = () => frameWidth / 2 - (centers[centers.length - 1] ?? 0);

  // Bend the row: items further from the centre turn away and sink back.
  const trackState = { x: 0 };
  const curve = () => {
    if (!track) return;
    gsap.set(track, { x: trackState.x, z: config.trackDepth });
    const half = frameWidth / 2 || 1;
    items.forEach((el, i) => {
      const d = gsap.utils.clamp(-1.5, 1.5, (centers[i] + trackState.x - half) / half);
      gsap.set(el, {
        rotateY: d * config.curveRotate,
        z: -Math.abs(d) * config.curveDepth,
        transformOrigin: "50% 50%",
      });
    });
  };
  trackState.x = startX();
  curve();

  // ---- Timeline -----------------------------------------------------------
  const tl = gsap.timeline({ paused: true, defaults: { ease: "none", immediateRender: false } });
  let trigger: ScrollTrigger | undefined;

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

  // 2. The finished video moves back in Z, like the camera pulling away.
  tl.addLabel("heroBack").fromTo(
    hero,
    { z: 0, scale: 1 },
    { z: config.heroDepth, scale: config.heroScale, duration: config.heroDistance, ease: "power1.inOut" },
  );

  // 3. The floating cards glide right → left through the back space. The
  //    hero keeps drifting back and fades as the first card passes over it.
  const trackDuration = Math.max(items.length - 0.5, 1) * config.cardDistance;
  tl.addLabel("track", `heroBack+=${config.heroDistance * 0.55}`);
  tl.fromTo(
    trackState,
    { x: startX },
    { x: endX, duration: trackDuration, ease: "none", onUpdate: curve },
    "track",
  );
  tl.to(
    hero,
    { z: config.heroDepth * 1.4, opacity: 0, duration: config.cardDistance * 1.2, ease: "power1.in" },
    "track",
  );
  // A short rest on the footer before the pin releases.
  tl.to({}, { duration: 0.3 });

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
    onRefresh: curve,
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
    gsap.ticker.remove(raf);
    lenis.destroy();
    video?.pause();
  };
}
