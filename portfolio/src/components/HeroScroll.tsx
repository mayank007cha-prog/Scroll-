import { forwardRef, useImperativeHandle, useRef } from 'react'

export interface HeroScrollHandle {
  root: HTMLDivElement | null
  visual: HTMLDivElement | null
  label: HTMLDivElement | null
}

/**
 * The opening scene. Purely presentational — ProjectTransition drives its
 * "camera forward" push (visual scales/lifts slightly, the label parallaxes
 * out faster and fades) via the refs exposed here. It has no ScrollTrigger
 * of its own; it's one scene inside the single narrative timeline.
 */
const HeroScroll = forwardRef<HeroScrollHandle>(function HeroScroll(_props, ref) {
  const rootRef = useRef<HTMLDivElement>(null)
  const visualRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(ref, () => ({
    root: rootRef.current,
    visual: visualRef.current,
    label: labelRef.current,
  }))

  return (
    <div ref={rootRef} className="scene scene--hero">
      <div ref={visualRef} className="hero-visual" aria-hidden="true">
        <div className="hero-visual__plane hero-visual__plane--back" />
        <div className="hero-visual__plane hero-visual__plane--mid" />
        <div className="hero-visual__plane hero-visual__plane--front" />
      </div>
      <div ref={labelRef} className="hero-label">
        <span className="hero-label__eyebrow">Product &amp; UI design</span>
        <h1 className="hero-label__title">Selected work</h1>
        <span className="hero-label__hint">Scroll</span>
      </div>
    </div>
  )
})

export default HeroScroll
