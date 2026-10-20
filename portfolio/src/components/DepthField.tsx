/**
 * The (otherwise empty, dark) 3D space behind the cards. It holds an
 * invisible floor plane for the interactive cubes that rise at the end of
 * the row (driven by ScrollStage).
 */
export function DepthField() {
  return (
    <div className="depth-field" data-depth-field aria-hidden="true">
      <div className="depth-room" data-room>
        {/* Interactive cubes that rise out of an invisible floor at the end
            of the row (driven by ScrollStage). */}
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
