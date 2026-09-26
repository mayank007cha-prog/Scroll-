import { forwardRef, useImperativeHandle, useRef } from 'react'
import type { Project } from '../data/projects'

export interface ScrollProjectHandle {
  root: HTMLDivElement | null
  visual: HTMLDivElement | null
  eyebrow: HTMLSpanElement | null
  title: HTMLHeadingElement | null
  description: HTMLParagraphElement | null
  meta: HTMLDivElement | null
  cta: HTMLAnchorElement | null
}

interface ScrollProjectProps {
  project: Project
}

/**
 * One case study, laid out but not animated — ProjectTransition drives its
 * enter/hold/exit through the refs this exposes. The same component and
 * the same animation system serve every project; only `project` differs.
 */
const ScrollProject = forwardRef<ScrollProjectHandle, ScrollProjectProps>(function ScrollProject(
  { project },
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null)
  const visualRef = useRef<HTMLDivElement>(null)
  const eyebrowRef = useRef<HTMLSpanElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const descriptionRef = useRef<HTMLParagraphElement>(null)
  const metaRef = useRef<HTMLDivElement>(null)
  const ctaRef = useRef<HTMLAnchorElement>(null)

  useImperativeHandle(ref, () => ({
    root: rootRef.current,
    visual: visualRef.current,
    eyebrow: eyebrowRef.current,
    title: titleRef.current,
    description: descriptionRef.current,
    meta: metaRef.current,
    cta: ctaRef.current,
  }))

  return (
    <div
      ref={rootRef}
      className="scene scene--project"
      style={{ '--project-accent': project.accent } as React.CSSProperties}
    >
      <div className="project-layout">
        <div ref={visualRef} className="project-visual">
          <span className="project-visual__label">{project.visualLabel}</span>
        </div>

        <div className="project-copy">
          <span ref={eyebrowRef} className="project-copy__eyebrow">
            {project.eyebrow}
          </span>
          <h2 ref={titleRef} className="project-copy__title">
            {project.title}
          </h2>
          <p ref={descriptionRef} className="project-copy__description">
            {project.description}
          </p>
          <div ref={metaRef} className="project-copy__meta">
            <span>{project.year}</span>
          </div>
          <a ref={ctaRef} className="project-copy__cta" href={project.ctaHref}>
            {project.ctaLabel}
          </a>
        </div>
      </div>
    </div>
  )
})

export default ScrollProject
