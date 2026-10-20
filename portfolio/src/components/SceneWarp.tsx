import type { ReactNode } from "react";

/**
 * Wraps the video card and the card row in a screen-space warp: near the left
 * and right edges of the frame, whatever passes through curls towards the
 * viewer like a sheet of paper (taller and slightly squeezed at the very
 * edge), while the middle stays flat. ScrollStage draws the warp map
 * (a displacement image) and sets how strong it is.
 */
export function SceneWarp({ children }: { children: ReactNode }) {
  return (
    <div className="scene-warp" data-warp>
      {children}
      <svg className="scene-warp__defs" aria-hidden="true" focusable="false">
        {/* sRGB, so the map's mid-grey means "no shift" exactly. */}
        <filter id="edge-bend" data-warp-filter filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB" x="0" y="0" width="1" height="1">
          <feImage data-warp-map preserveAspectRatio="none" x="0" y="0" width="1" height="1" result="map" />
          <feDisplacementMap in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G" data-warp-disp />
        </filter>
      </svg>
    </div>
  );
}
