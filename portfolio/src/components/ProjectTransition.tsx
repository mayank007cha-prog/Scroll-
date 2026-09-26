import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import HeroScroll, { type HeroScrollHandle } from './HeroScroll'
import ScrollProject, { type ScrollProjectHandle } from './ScrollProject'
import { useScrollAnimation } from '../hooks/useScrollAnimation'
import { buildNarrativeTimeline } from './narrative'
import { projects } from '../data/projects'
import { RESPONSIVE, SCENE_VH, STAGE_PERSPECTIVE } from '../data/motion'

/**
 * Orchestrates the whole scroll narrative: one tall track that provides
 * scroll distance, one pinned stage holding the hero + every project as
 * stacked absolutely-positioned layers, and a single scrubbed GSAP timeline
 * (built by buildNarrativeTimeline) whose progress is a direct, reversible
 * function of native scroll position. Nothing here hijacks the wheel —
 * ScrollTrigger's pin only fixes the *visual* stage in place while the
 * page's real scroll position keeps advancing underneath it. The track's
 * height IS the timeline's duration: scrub maps the trigger's start→end
 * range onto the timeline's 0→1 progress automatically.
 */
export default function ProjectTransition() {
  const trackRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HeroScrollHandle | null>(null)
  const projectRefs = useRef<(ScrollProjectHandle | null)[]>([])

  useScrollAnimation(() => {
    const track = trackRef.current
    const stage = stageRef.current
    const hero = heroRef.current
    const projectHandles = projectRefs.current.filter((p): p is ScrollProjectHandle => p !== null)

    if (!track || !stage || !hero || projectHandles.length !== projects.length) return

    Object.values(RESPONSIVE).forEach(({ query, depthScale, vhScale, perspective }) => {
      ScrollTrigger.matchMedia({
        [query]: () => {
          const trackVh = (SCENE_VH.hero + SCENE_VH.project * projects.length) * vhScale
          track.style.height = `${trackVh}vh`
          stage.style.perspective = perspective ? `${STAGE_PERSPECTIVE}px` : 'none'

          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: track,
              start: 'top top',
              end: 'bottom bottom',
              scrub: true,
              pin: stage,
              anticipatePin: 1,
            },
          })

          buildNarrativeTimeline(tl, hero, projectHandles, depthScale)

          // matchMedia calls this to tear the query's setup down when the
          // viewport crosses a breakpoint or the component unmounts.
          return () => {
            tl.scrollTrigger?.kill()
            tl.kill()
          }
        },
      })
    })
  }, [])

  return (
    <div ref={trackRef} className="scroll-track">
      <div ref={stageRef} className="stage">
        <HeroScroll ref={heroRef} />
        {projects.map((project, i) => (
          <ScrollProject
            key={project.id}
            project={project}
            ref={(el) => {
              projectRefs.current[i] = el
            }}
          />
        ))}
      </div>
    </div>
  )
}
