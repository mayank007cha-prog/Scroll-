# Portfolio — cinematic scroll narrative

A single-page product/UI design portfolio built around one continuous,
scroll-driven story: a hero, then three case studies, each recede-and-enter
transitioning into the next as you scroll. No scroll-jacking — scroll
position drives a GSAP ScrollTrigger timeline directly, so the animation is
always exactly where your scroll position says it should be, in both
directions.

## Stack

- React + TypeScript + Vite
- GSAP + ScrollTrigger (`scrub`-driven timeline, `ScrollTrigger.matchMedia`
  for responsive tiers)
- Lenis (smooths native wheel/touch input; never intercepts or blocks it)

## Run it

```bash
npm install
npm run dev
```

## Where things live

- `src/data/motion.ts` — every tunable number (scale, translate distance,
  timing, easing, responsive scaling). Change the feel of the whole site
  here.
- `src/data/projects.ts` — case study content. Swap in real copy/images.
- `src/components/narrative.ts` — the pure function that builds the GSAP
  timeline from the hero + project refs. One system, shared by every
  project.
- `src/components/ProjectTransition.tsx` — orchestrator: owns the pinned
  stage, wires up `ScrollTrigger.matchMedia` per breakpoint, calls
  `buildNarrativeTimeline`.
- `src/components/HeroScroll.tsx` / `ScrollProject.tsx` — presentational
  only; animation is driven externally via refs.
- `src/hooks/useScrollAnimation.ts` — scopes GSAP context/cleanup to a
  component's lifetime.

## Content is placeholder

`data/projects.ts` has stand-in copy and flat-color visuals for EarthLink,
DE Medic and YouX Manage. Swap `visualLabel` for a real `<img>`/`<video>` in
`ScrollProject.tsx` and replace the copy once real case study content is
ready.
