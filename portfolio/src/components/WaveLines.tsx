import { wavePaths } from "./waveLinesData";

/** Flowing wave-line texture. Sits behind a card's text; a CSS mask keeps it
 *  clear around the text and strongest at the edges. Static, so it costs
 *  nothing while the row moves. */
export function WaveLines({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`wave-lines ${className}`}
      viewBox="0 0 1200 800"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      {wavePaths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
