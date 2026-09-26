"use client";

import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { SceneFrame } from "./SceneFrame";
import { MOBILE_QUERY, mobileOverrides, sceneConfig, type SceneConfig } from "@/lib/sceneConfig";

gsap.registerPlugin(ScrollTrigger);

/**
 * One pinned 3D scene. Everything (video scrub, hero depth, every card
 * transition, footer) is a segment of a single scrubbed timeline, so
 * scrolling up simply plays it backwards.
 *
 *   video 0→100% → hero moves back in Z → card 1 enters from right → hold
 *   → card 1 recedes + card 2 enters → … → card 5 recedes + footer enters
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
  const cards = gsap.utils.toArray<HTMLElement>('[data-plane="project"]', stage);
  const footer = stage.querySelector<HTMLElement>('[data-plane="footer"]');
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

  // ---- Initial states -----------------------------------------------------
  const vw = () => window.innerWidth / 100;
  const entryX = () => config.entryDistance * vw();

  gsap.set(frame, { perspective: config.perspective });
  gsap.set(hero, { z: 0, scale: 1, opacity: 1, force3D: true });
  gsap.set(cards, {
    x: entryX,
    z: config.projectDepth,
    scale: config.cardScale,
    opacity: 0,
    force3D: true,
  });
  if (footer) {
    gsap.set(footer, { yPercent: 100, z: config.projectDepth, scale: config.cardScale, opacity: 0 });
  }

  // ---- Timeline -----------------------------------------------------------
  const T = config.transitionDistance;
  const tl = gsap.timeline({ paused: true, defaults: { ease: "none", immediateRender: false } });

  // 1. Scroll scrubs the video 0 → 100%.
  const playhead = { p: 0 };
  tl.addLabel("video").to(playhead, {
    p: 1,
    duration: config.videoDistance,
    onUpdate: () => {
      // Only a real scroll hands playback to the timeline (the scrub can
      // render tiny values on load/refresh without the user moving).
      if (window.scrollY > trigger.start + 2) takeOverVideo();
      if (scrollOwnsVideo) seekVideo(playhead.p * videoDuration());
    },
  });

  // 2. The finished video moves back in Z, like the camera pulling away.
  tl.addLabel("heroBack").fromTo(
    hero,
    { z: 0, scale: 1 },
    { z: config.heroDepth, scale: config.heroScale, duration: config.heroDistance, ease: "power1.inOut" },
  );

  // 3. Cards: previous plane recedes while the next enters from the right.
  const planes: HTMLElement[] = [hero, ...cards];
  const transition = (incoming: HTMLElement, index: number, from: gsap.TweenVars) => {
    const label = `plane-${index}`;
    const previous = planes[index]; // the plane currently in front
    const older = planes[index - 1]; // the one already receded behind it
    tl.addLabel(label);

    if (previous) {
      const isHero = previous === hero;
      tl.to(
        previous,
        {
          z: isHero ? config.heroDepth : config.projectDepth,
          scale: isHero ? config.heroScale : config.cardScale,
          opacity: config.recededOpacity,
          duration: T,
          ease: "power1.inOut",
        },
        label,
      );
    }

    if (older) {
      // Push it further back and fade it out so only one card sits behind.
      tl.to(older, { z: `-=${Math.abs(config.projectDepth)}`, opacity: 0, duration: T }, label);
    }

    const enterAt = `${label}+=${T * 0.2}`;
    tl.fromTo(
      incoming,
      { ...from, z: config.projectDepth, scale: config.cardScale },
      { x: 0, yPercent: 0, z: 0, scale: 1, duration: T, ease: "power2.out" },
      enterAt,
    );
    // Opacity lands early so the card reads as solid while still sliding in.
    tl.fromTo(incoming, { opacity: 0 }, { opacity: 1, duration: T * 0.35 }, enterAt);

    tl.to({}, { duration: config.holdDistance });
  };

  cards.forEach((card, i) => transition(card, i, { x: entryX }));
  if (footer) transition(footer, cards.length, { yPercent: 100 });

  // ---- Pin + scrub --------------------------------------------------------
  const trigger = ScrollTrigger.create({
    trigger: stage,
    start: "top top",
    end: () => `+=${tl.duration() * window.innerHeight * config.scrollPerUnit}`,
    pin: true,
    scrub: config.scrub,
    animation: tl,
    invalidateOnRefresh: true,
    anticipatePin: 1,
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
