/**
 * Every value that shapes the scroll scene lives here.
 *
 * Timeline "units" are abstract durations inside the single GSAP timeline.
 * They're converted to scroll distance with `scrollPerUnit` (viewport heights
 * per unit), so doubling a duration doubles how long you scroll through it.
 */
export type SceneConfig = {
  /** CSS perspective on the scene frame, in px. */
  perspective: number;
  /** Where the hero video ends up in Z once it has "moved away". */
  heroDepth: number;
  /** Hero scale once it has moved back. */
  heroScale: number;
  /** Z of the floating card row (negative = further back in space). */
  trackDepth: number;
  /** Max rotateY (deg) for cards at the edges, which bends the row into a curve. */
  curveRotate: number;
  /** Extra Z depth (px) for cards at the edges of the curve. */
  curveDepth: number;
  /** How much the background objects drift relative to the row (0–1). */
  depthParallax: number;
  /** Degrees per px of drift that the spinning background objects turn. */
  depthSpin: number;
  /** ScrollTrigger scrub: `true` or seconds of smoothing. */
  scrub: boolean | number;
  /** Where the row starts, in vw from the left edge of the frame (100 = just off-screen right). */
  entryDistance: number;
  /** Timeline units of scrolling spent scrubbing the video 0 → 100%. */
  videoDistance: number;
  /** Timeline units the hero spends moving back to card size (the first card slides in meanwhile). */
  heroDistance: number;
  /** Timeline units of horizontal scrolling per card. */
  cardDistance: number;
  /** Viewport heights of scroll per timeline unit. */
  scrollPerUnit: number;
  /** Autoplay the intro once on load; scrolling takes over playback. */
  autoplayOnLoad: boolean;
};

export const sceneConfig: SceneConfig = {
  perspective: 1400,
  heroDepth: -400,
  heroScale: 0.85,
  trackDepth: -80,
  curveRotate: 24,
  curveDepth: 260,
  depthParallax: 0.7,
  depthSpin: -0.02,
  scrub: 1.2,
  entryDistance: 110,
  videoDistance: 1.5,
  heroDistance: 0.8,
  cardDistance: 1,
  scrollPerUnit: 1,
  autoplayOnLoad: true,
};

/** Softer movement on small screens so text stays readable. */
export const mobileOverrides: Partial<SceneConfig> = {
  perspective: 1000,
  heroDepth: -200,
  heroScale: 0.9,
  trackDepth: -40,
  curveRotate: 9,
  curveDepth: 80,
};

export const MOBILE_QUERY = "(max-width: 767px)";
