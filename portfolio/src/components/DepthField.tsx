import type { CSSProperties, ReactNode } from "react";
import { sceneConfig } from "@/lib/sceneConfig";

/**
 * Product-design objects floating deep behind the cards (CSS 3D, no WebGL).
 * Each is placed by where it should appear on screen at rest (`x`, `y` in %
 * of the frame, `size` in px); its CSS position is pushed outward and its
 * size enlarged to cancel the perspective shrink at depth `z`.
 * ScrollStage drifts the whole layer with the row and turns the `spin` ones.
 */
type DepthObject = {
  kind: "cube" | "layers" | "pen" | "cursor" | "selection" | "type" | "rings" | "cross" | "measure";
  x: number;
  y: number;
  z: number;
  size: number;
  /** Relative spin speed while scrolling (omit for static). */
  spin?: number;
};

// Cards cover roughly 20–80% of the frame height, so objects live in the
// top/bottom bands or far back where they show through the gaps. The layer
// drifts left by about two frame widths over the scroll, so x runs 0–260%.
const objects: DepthObject[] = [
  { kind: "cube", x: 14, y: 10, z: -800, size: 110, spin: 1 },
  { kind: "rings", x: 40, y: 90, z: -1200, size: 220 },
  { kind: "pen", x: 72, y: 9, z: -900, size: 240 },
  { kind: "layers", x: 98, y: 90, z: -1100, size: 190 },
  { kind: "cube", x: 128, y: 50, z: -1700, size: 300, spin: 0.5 },
  { kind: "cursor", x: 122, y: 12, z: -500, size: 90 },
  { kind: "cross", x: 60, y: 30, z: -1500, size: 60 },
  { kind: "measure", x: 150, y: 90, z: -900, size: 200 },
  { kind: "type", x: 172, y: 10, z: -1000, size: 150 },
  { kind: "cross", x: 180, y: 72, z: -1500, size: 60 },
  { kind: "selection", x: 196, y: 90, z: -1100, size: 230 },
  { kind: "cube", x: 222, y: 10, z: -700, size: 80, spin: -1.4 },
  { kind: "layers", x: 246, y: 89, z: -1200, size: 180 },
  { kind: "rings", x: 258, y: 12, z: -1300, size: 200 },
];

const P = sceneConfig.perspective;

function placement({ x, y, z, size }: DepthObject): CSSProperties {
  const f = P / (P - z); // on-screen scale at depth z
  return {
    left: `${50 + (x - 50) / f}%`,
    top: `${50 + (y - 50) / f}%`,
    fontSize: `calc(${(size / f).toFixed(1)}px * var(--depth-scale, 1))`,
    transform: `translate(-50%, -50%) translateZ(${z}px)`,
  };
}

const shapes: Record<DepthObject["kind"], ReactNode> = {
  cube: (
    <div className="d-cube">
      {["front", "back", "left", "right", "top", "bottom"].map((face) => (
        <span key={face} className={`d-cube__face d-cube__face--${face}`} />
      ))}
    </div>
  ),
  layers: (
    <div className="d-layers">
      <span className="d-layers__plane" />
      <span className="d-layers__plane" />
      <span className="d-layers__plane d-layers__plane--top">
        <i />
        <i />
        <i />
      </span>
    </div>
  ),
  pen: (
    <svg className="d-pen" viewBox="0 0 220 120" fill="none">
      <path d="M10 100 C 60 10, 150 10, 210 70" />
      <line x1="10" y1="100" x2="60" y2="10" className="d-pen__handle" />
      <line x1="210" y1="70" x2="150" y2="10" className="d-pen__handle" />
      <circle cx="60" cy="10" r="5" />
      <circle cx="150" cy="10" r="5" />
      <rect x="4" y="94" width="12" height="12" />
      <rect x="204" y="64" width="12" height="12" />
    </svg>
  ),
  cursor: (
    <div className="d-cursor">
      <svg viewBox="0 0 24 24">
        <path d="M3 2l17 8.5-7.2 1.8L9.6 20z" />
      </svg>
      <span>Product designer</span>
    </div>
  ),
  selection: (
    <div className="d-selection">
      <span className="d-selection__box">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span className="d-selection__label">Frame · 1440 × 900</span>
    </div>
  ),
  rings: (
    <svg className="d-rings" viewBox="0 0 200 200" fill="none">
      <circle cx="100" cy="100" r="96" />
      <circle cx="100" cy="100" r="66" />
      <circle cx="100" cy="100" r="36" />
      <circle cx="196" cy="100" r="3.5" className="d-rings__dot" />
    </svg>
  ),
  cross: (
    <svg className="d-cross" viewBox="0 0 40 40" fill="none">
      <path d="M20 4V36M4 20H36" />
    </svg>
  ),
  measure: (
    <div className="d-measure">
      <span className="d-measure__box" />
      <span className="d-measure__gap">
        <b>24</b>
      </span>
      <span className="d-measure__box" />
    </div>
  ),
  type: (
    <div className="d-type">
      <span className="d-type__glyph">Aa</span>
      <i className="d-type__line d-type__line--cap" />
      <i className="d-type__line d-type__line--x" />
      <i className="d-type__line d-type__line--base" />
      <span className="d-type__meta">Geist · 96 / 100</span>
    </div>
  ),
};

export function DepthField() {
  return (
    <div className="depth-field" data-depth-field aria-hidden="true">
      <div className="depth-wall" />
      <div className="depth-floor" />
      {objects.map((o, i) => (
        <div key={i} className="depth-obj" style={placement(o)}>
          {o.spin ? (
            <div className="depth-spin" data-spin={o.spin}>
              {shapes[o.kind]}
            </div>
          ) : (
            shapes[o.kind]
          )}
        </div>
      ))}
    </div>
  );
}
