// Every tunable number the scroll narrative uses lives here. Nothing in the
// components should hardcode a duration, distance, scale or easing curve —
// change the feel of the whole site by editing this file.

export const EASE = {
  // Used for transform/opacity tweens inside the scrubbed timeline itself.
  // Scrubbed tweens are driven by scroll position, so the "ease" mostly
  // shapes acceleration *within* a scroll range rather than over time.
  standard: 'power2.inOut',
  enter: 'power3.out',
  exit: 'power2.in',
} as const

// How much of the viewport height of scrollable track each scene consumes.
// Bigger = more scroll distance = slower-feeling per pixel of transform.
export const SCENE_VH = {
  hero: 140,
  project: 160,
} as const

// Fraction of a project's own pinned duration spent entering / holding /
// exiting. Must sum to 1. The entrance overlaps the previous scene's exit
// (see ProjectTransition), which is what produces the crossfade.
export const PHASE = {
  enter: 0.25,
  hold: 0.5,
  exit: 0.25,
} as const

// Depth choreography, desktop values. Tablet/mobile scale these down via
// the `depthScale` factor in RESPONSIVE below rather than redefining them.
export const DEPTH = {
  incoming: {
    scale: 1.06,
    y: 8, // vh, travels downward → 0 as the scene settles in
    opacity: 0,
  },
  resting: {
    scale: 1,
    y: 0,
    opacity: 1,
  },
  outgoing: {
    scale: 0.94,
    y: -5, // vh, continues drifting upward as it recedes
    opacity: 0.35,
  },
} as const

// Text elements inside a project settle in slightly staggered, each with
// its own small vertical travel — kept subtle on purpose.
export const TEXT_STAGGER = {
  eyebrow: { delay: 0, y: 14, duration: 0.4 },
  title: { delay: 0.03, y: 22, duration: 0.5 },
  description: { delay: 0.09, y: 16, duration: 0.45 },
  meta: { delay: 0.13, y: 10, duration: 0.4 },
  cta: { delay: 0.18, y: 8, duration: 0.35, scaleFrom: 0.96 },
} as const

// Hero's own scroll-linked "camera forward" push, independent of the
// project crossfade system.
export const HERO = {
  visualScaleTo: 1.12,
  visualYTo: -6, // vh
  labelYTo: -18, // vh — moves out faster than the visual (parallax)
  labelOpacityTo: 0,
} as const

// matchMedia breakpoints + how much to shrink the depth/translate values at
// each tier. 1 = full desktop motion, 0 = no motion (native scroll only).
export const RESPONSIVE = {
  desktop: { query: '(min-width: 1000px)', depthScale: 1, vhScale: 1, perspective: true },
  tablet: { query: '(min-width: 600px) and (max-width: 999px)', depthScale: 0.55, vhScale: 0.8, perspective: false },
  mobile: { query: '(max-width: 599px)', depthScale: 0.3, vhScale: 0.6, perspective: false },
} as const

export const STAGE_PERSPECTIVE = 1400 // px, desktop only
