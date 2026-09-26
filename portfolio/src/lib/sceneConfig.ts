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
  /** Z depth a card starts at when entering, and recedes to when leaving. */
  projectDepth: number;
  /** Card scale while entering / receded. */
  cardScale: number;
  /** Opacity of the card directly behind the active one. */
  recededOpacity: number;
  /** ScrollTrigger scrub: `true` or seconds of smoothing. */
  scrub: boolean | number;
  /** How far off-screen (in vw) cards start on the right. */
  entryDistance: number;
  /** Timeline units for one card-to-card transition. */
  transitionDistance: number;
  /** Timeline units of scrolling spent scrubbing the video 0 → 100%. */
  videoDistance: number;
  /** Timeline units the hero spends moving back in Z. */
  heroDistance: number;
  /** Timeline units each card rests fully in view before the next one. */
  holdDistance: number;
  /** Viewport heights of scroll per timeline unit. */
  scrollPerUnit: number;
  /** Autoplay the intro once on load; scrolling takes over playback. */
  autoplayOnLoad: boolean;
};

export const sceneConfig: SceneConfig = {
  perspective: 1200,
  heroDepth: -700,
  heroScale: 0.82,
  projectDepth: -500,
  cardScale: 0.85,
  recededOpacity: 0.7,
  scrub: 1,
  entryDistance: 110,
  transitionDistance: 1,
  videoDistance: 1.5,
  heroDistance: 0.8,
  holdDistance: 0.4,
  scrollPerUnit: 1,
  autoplayOnLoad: true,
};

/** Softer movement on small screens so text stays readable. */
export const mobileOverrides: Partial<SceneConfig> = {
  perspective: 900,
  heroDepth: -350,
  heroScale: 0.88,
  projectDepth: -250,
  cardScale: 0.92,
  entryDistance: 105,
};

export const MOBILE_QUERY = "(max-width: 767px)";
