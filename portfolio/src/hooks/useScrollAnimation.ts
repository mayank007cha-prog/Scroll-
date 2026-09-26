import { useLayoutEffect, useRef, type RefObject } from 'react'
import gsap from 'gsap'

/**
 * Scopes a block of GSAP setup (tweens, ScrollTriggers, matchMedia) to a
 * container's lifetime. Runs the callback inside `gsap.context()` on mount
 * and reverts everything it created — tweens, ScrollTriggers, event
 * listeners — on unmount or when `deps` change. This is the one place
 * components reach for GSAP so cleanup can never be forgotten.
 *
 * Pass an existing ref to scope selector text (`gsap.utils.selector`-style
 * queries) inside the callback to that subtree; omit it to get one back.
 */
export function useScrollAnimation<T extends HTMLElement = HTMLDivElement>(
  callback: (scope: RefObject<T | null>) => void,
  deps: React.DependencyList = [],
  scopeRef?: RefObject<T | null>,
) {
  const fallbackRef = useRef<T | null>(null)
  const scope = scopeRef ?? fallbackRef

  useLayoutEffect(() => {
    const ctx = gsap.context(() => callback(scope), scope)
    return () => ctx.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return scope
}
