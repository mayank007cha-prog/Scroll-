import { DEPTH, EASE, PHASE, TEXT_STAGGER, HERO } from '../data/motion'
import type { HeroScrollHandle } from './HeroScroll'
import type { ScrollProjectHandle } from './ScrollProject'

export const HERO_WEIGHT = 1
export const PROJECT_WEIGHT = 1

/** Total timeline "duration" (abstract units, not seconds — scrub maps this 1:1 to scroll distance). */
export function narrativeDuration(projectCount: number) {
  return HERO_WEIGHT + PROJECT_WEIGHT * projectCount
}

type TextKey = keyof typeof TEXT_STAGGER

const TEXT_ELEMENT: Record<TextKey, keyof ScrollProjectHandle> = {
  eyebrow: 'eyebrow',
  title: 'title',
  description: 'description',
  meta: 'meta',
  cta: 'cta',
}

/**
 * Builds the entire scroll narrative — hero's camera push, then each
 * project's overlapping enter/hold/exit and staggered text reveal — onto a
 * single GSAP timeline. Called once per matchMedia breakpoint with a
 * `depthScale` that shrinks (or removes) the 3D travel for smaller screens
 * without touching this logic at all.
 */
export function buildNarrativeTimeline(
  tl: gsap.core.Timeline,
  hero: HeroScrollHandle,
  projects: ScrollProjectHandle[],
  depthScale: number,
) {
  const d = (value: number) => value * depthScale
  const scaleTowards = (target: number, base = 1) => base - (base - target) * depthScale

  // Every project starts in its "incoming" pose (invisible, slightly
  // scaled/offset) until its own enter tween runs.
  projects.forEach((project) => {
    tl.set(project.visual, {
      scale: scaleTowards(DEPTH.incoming.scale, 1),
      yPercent: d(DEPTH.incoming.y),
      opacity: DEPTH.incoming.opacity,
    }, 0)
    ;(Object.keys(TEXT_STAGGER) as TextKey[]).forEach((key) => {
      const el = project[TEXT_ELEMENT[key]]
      if (!el) return
      const cfg = TEXT_STAGGER[key]
      tl.set(el, {
        yPercent: d(cfg.y),
        opacity: 0,
        scale: 'scaleFrom' in cfg ? cfg.scaleFrom : 1,
      }, 0)
    })
  })

  // --- Hero: camera pushes forward as its own window plays out ---------
  tl.to(hero.visual, {
    scale: scaleTowards(HERO.visualScaleTo, 1),
    yPercent: d(HERO.visualYTo),
    ease: EASE.standard,
    duration: HERO_WEIGHT,
  }, 0)
  tl.to(hero.label, {
    yPercent: d(HERO.labelYTo),
    opacity: depthScale === 0 ? 1 : HERO.labelOpacityTo,
    ease: EASE.standard,
    duration: HERO_WEIGHT,
  }, 0)

  const allScenes: (HeroScrollHandle | ScrollProjectHandle)[] = [hero, ...projects]

  projects.forEach((project, i) => {
    const sceneStart = HERO_WEIGHT + PROJECT_WEIGHT * i
    const exitStart = sceneStart + PHASE.enter + PHASE.hold

    const previous = allScenes[i] // hero when i === 0, else projects[i - 1]
    const twoBack = i >= 2 ? allScenes[i - 1] : i === 1 ? hero : null

    // Outgoing: whatever scene was current recedes to a dimmed, scaled
    // "still visible behind" resting state over this project's enter window.
    tl.to(previous.visual, {
      scale: scaleTowards(DEPTH.outgoing.scale, 1),
      yPercent: d(DEPTH.outgoing.y),
      opacity: scaleTowards(DEPTH.outgoing.opacity, 1),
      ease: EASE.exit,
      duration: PHASE.enter,
    }, sceneStart)

    // Two-back cleanup: the scene before the one that's now receding fully
    // disappears here, so only one dimmed layer is ever stacked behind.
    if (twoBack) {
      tl.to(twoBack.root, { opacity: 0, ease: EASE.exit, duration: PHASE.enter }, sceneStart)
    }

    // Incoming: this project settles from its incoming pose to resting.
    tl.to(project.visual, {
      scale: 1,
      yPercent: 0,
      opacity: 1,
      ease: EASE.enter,
      duration: PHASE.enter,
    }, sceneStart)

    // Staggered text reveal, anchored to the same enter window.
    ;(Object.keys(TEXT_STAGGER) as TextKey[]).forEach((key) => {
      const el = project[TEXT_ELEMENT[key]]
      if (!el) return
      const cfg = TEXT_STAGGER[key]
      tl.to(el, {
        yPercent: 0,
        opacity: 1,
        scale: 1,
        ease: EASE.enter,
        duration: cfg.duration,
      }, sceneStart + cfg.delay)
    })

    // Exit: only when there's a next project to crossfade into. The last
    // project simply holds at "resting" — it's the story's resting end.
    const isLast = i === projects.length - 1
    if (!isLast) {
      tl.to(project.visual, {
        scale: scaleTowards(DEPTH.outgoing.scale, 1),
        yPercent: d(DEPTH.outgoing.y),
        opacity: scaleTowards(DEPTH.outgoing.opacity, 1),
        ease: EASE.exit,
        duration: PHASE.exit,
      }, exitStart)
    }
  })
}
