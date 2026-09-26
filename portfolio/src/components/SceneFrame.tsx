import type { ReactNode } from "react";

/**
 * The rounded "window" everything happens inside. It clips (overflow: hidden)
 * so planes appear to slide in from behind the edge of the frame, and it
 * provides the CSS perspective for translateZ.
 */
export function SceneFrame({ children }: { children: ReactNode }) {
  return <div className="scene-frame">{children}</div>;
}
