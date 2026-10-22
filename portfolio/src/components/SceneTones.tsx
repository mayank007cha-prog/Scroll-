/**
 * Background colour layers, one per item in the row (video card, each case
 * study, the footer). ScrollStage cross-fades them with opacity (cheap, on
 * the GPU) so the background takes on the colour of the centred card.
 */
export function SceneTones({ tones }: { tones: string[] }) {
  return (
    <div className="scene-tones" aria-hidden="true">
      {tones.map((tone, i) => (
        <div key={i} className={`scene-tone scene-tone--${tone}`} data-tone />
      ))}
    </div>
  );
}

/**
 * Soft fades at the left and right edges, above the cards, in the same
 * background colour (cross-faded with the tones), so cards fade out where
 * they leave the frame instead of being cut off.
 */
export function SceneEdges({ tones }: { tones: string[] }) {
  return (
    <div className="scene-edges" aria-hidden="true">
      {tones.map((tone, i) => (
        <div key={i} className={`scene-edge scene-tone--${tone}`} data-edge />
      ))}
    </div>
  );
}
