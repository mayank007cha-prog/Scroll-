/**
 * The room behind the cards (CSS 3D, no WebGL): a dashed back wall and a
 * floor built on one grid, so every wall line runs straight into a floor
 * line. ScrollStage shifts the room within one grid cell, so it looks
 * endless, and drives the interactive floor cubes at the end of the row.
 */
export function DepthField() {
  return (
    <div className="depth-field" data-depth-field aria-hidden="true">
      <div className="depth-room" data-room>
        <div className="depth-wall" />
        <div className="depth-floor" />
        {/* Interactive cubes that rise out of the floor's cells at the end of
            the row (driven by ScrollStage). Same plane as the floor, but
            without its mask, so the cubes keep their 3D. */}
        <div className="depth-cubes" data-cubes>
          <div className="floor-cube" data-cube>
            <span className="floor-cube__face floor-cube__face--back" />
            <span className="floor-cube__face floor-cube__face--left" />
            <span className="floor-cube__face floor-cube__face--right" />
            <span className="floor-cube__face floor-cube__face--top" />
            <span className="floor-cube__face floor-cube__face--front" />
          </div>
          <span className="floor-cube__probe" data-cube-probe />
        </div>
      </div>
    </div>
  );
}
