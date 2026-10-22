/**
 * Every value that shapes the scroll scene lives here.
 *
 * Timeline "units" are abstract durations inside the single GSAP timeline.
 * They're converted to scroll distance with `scrollPerUnit` (viewport heights
 * per unit), so doubling a duration doubles how long you scroll through it.
 */
export type SceneConfig = {
  /** Direction the card row travels: "x" (right → left) or "y" (bottom → top). */
  axis: "x" | "y";
  /** CSS perspective on the scene frame, in px. */
  perspective: number;
  /** Where the hero video ends up in Z once it has "moved away". */
  heroDepth: number;
  /** Hero scale once it has moved back. */
  heroScale: number;
  /** Z of the floating card row (negative = further back in space). */
  trackDepth: number;
  /** Max rotateY (deg) for cards towards the edges, which bends the row into a curve. */
  curveRotate: number;
  /** Max extra Z depth (px) for cards towards the edges of the curve. */
  curveDepth: number;
  /** Case-study cards bend like paper towards the frame edges: they are
   *  drawn as thin slices laid along a smooth curve (flat in the middle,
   *  then an arc). Plain 3D transforms, so it stays smooth. */
  curl: boolean;
  /** Radius of that arc, as a fraction of the frame width (smaller = a
   *  tighter, stronger curl). */
  curlRadius: number;
  /** Where cards curl: only as they enter (the end side: right, or bottom)
   *  or on both sides. */
  curlSides: "end" | "both";
  /** Turn each card about its inner edge (the one nearer the centre), like
   *  a page curling, instead of about its middle. */
  curveHinge: boolean;
  /** How much of the middle stays flat (0–1 of the distance to a card's
   *  resting spot beside the centre); the curve eases in smoothly beyond it. */
  curveFlat: number;
  /** true: the row curves around the viewer, like standing inside a ring
   *  (side cards come forward and turn to face the centre). false: it bends
   *  away like the outside of a drum. */
  curveInward: boolean;
  /** Edge bend: how much taller (0.16 = 16%) a card grows at the very edge of
   *  the frame as it curls towards the viewer. 0 turns the bend off. */
  edgeBend: number;
  /** Edge bend: width of the bending zone at each side, as a fraction of the
   *  frame (the middle stays flat). */
  edgeZone: number;
  /** Paper feel: how far (deg) a card leans into its motion at full speed;
   *  its trailing edge lags like a sheet pulled through air, then springs back. */
  paperLean: number;
  /** Paper feel: strength (0–1) of the shading that rolls across a card as it
   *  turns, so it reads as a softly curved sheet. */
  paperShade: number;
  /** How much the background objects drift relative to the row (0–1). */
  depthParallax: number;
  /** Degrees per px of drift that the spinning background objects turn. */
  depthSpin: number;
  /** ScrollTrigger scrub: `true` or seconds of smoothing. */
  scrub: boolean | number;
  /** Where the row starts, in % of the frame along the axis (100 = just off-screen right / below). */
  entryDistance: number;
  /** Timeline units of scrolling spent scrubbing the video 0 → 100%. */
  videoDistance: number;
  /** Timeline units the hero spends moving back to card size (the first card slides in meanwhile). */
  heroDistance: number;
  /** Timeline units of horizontal scrolling per card. */
  cardDistance: number;
  /** Timeline units each card rests centred before the next move. */
  holdDistance: number;
  /** After scrolling stops, glide to the nearest centred card. */
  settle: boolean;
  /** Card by card: in the row, one wheel gesture glides to the next (or
   *  previous) card instead of scrolling freely. */
  snap: boolean;
  /** Seconds each card-to-card glide takes (eased in and out). */
  snapDuration: number;
  /** Lenis smoothing (lower = smoother, heavier). */
  smoothness: number;
  /** Viewport heights of scroll per timeline unit. */
  scrollPerUnit: number;
  /** Autoplay the intro once on load; scrolling takes over playback. */
  autoplayOnLoad: boolean;
};

export const sceneConfig: SceneConfig = {
  axis: "x",
  perspective: 1400,
  heroDepth: -300,
  heroScale: 0.86,
  trackDepth: -80,
  // The centred card is flat and level. Case-study cards bend like paper as
  // they pass the frame edges (curl: thin slices laid on a curve, plain 3D
  // transforms on the GPU). The video card (and footer) instead ease into a
  // gentle hinge: they turn about their inner edge, outer side towards the
  // viewer. (edgeBend, a screen-space warp filter, looks similar but costs
  // a full-screen filter every frame, so it's off.)
  // Outward, like the outside of a drum: cards on both sides turn away from
  // the viewer (outer edge further back). Case-study cards bend as slices;
  // the video card and footer turn as whole planes.
  curl: true,
  curlRadius: 0.27,
  curlSides: "both",
  curveRotate: 38,
  curveDepth: 160,
  curveHinge: true,
  curveFlat: 0.3,
  curveInward: false,
  edgeBend: 0,
  edgeZone: 0.17,
  paperLean: 0,
  paperShade: 0.25,
  depthParallax: 0.7,
  depthSpin: -0.012,
  scrub: 0.25,
  entryDistance: 110,
  videoDistance: 2.2,
  heroDistance: 0.8,
  cardDistance: 0.6,
  holdDistance: 0.1,
  settle: true,
  snap: true,
  snapDuration: 1,
  smoothness: 0.075,
  scrollPerUnit: 1,
  autoplayOnLoad: true,
};

/** Softer movement on small screens so text stays readable. */
export const mobileOverrides: Partial<SceneConfig> = {
  // Phones: the row travels vertically (same easing, rests and settle).
  axis: "y",
  perspective: 1000,
  heroDepth: -200,
  heroScale: 0.9,
  trackDepth: -40,
  // Phones: flat cards travelling vertically (lightest).
  curveRotate: 0,
  curveDepth: 0,
  curl: false,
  curveHinge: false,
  curveInward: true,
  // Phones keep the gentle ring; the screen-space bend is desktop-only
  // (a full-screen filter every frame is too costly on phones).
  edgeBend: 0,
};

export const MOBILE_QUERY = "(max-width: 767px)";
