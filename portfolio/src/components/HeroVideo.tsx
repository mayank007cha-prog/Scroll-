import { intro } from "@/data/projects";

type HeroVideoProps = {
  /** H.264 MP4 (primary). */
  src: string;
  /** Optional VP9 WebM fallback for browsers without H.264. */
  webmSrc?: string;
  poster?: string;
  label?: string;
};

/**
 * The single intro video. Playback is driven by ScrollStage (scroll scrubs
 * currentTime), so there is no loop and no native autoplay attribute here.
 * Layers, bottom to top: video → white fog (fades in as it zooms out) →
 * theme gradient on the window side → film grain → intro text.
 */
export function HeroVideo({ src, webmSrc, poster, label = "Intro video" }: HeroVideoProps) {
  return (
    <div className="plane hero-plane" data-plane="hero">
      <video
        className="hero-video"
        data-hero-video
        poster={poster}
        muted
        playsInline
        preload="auto"
        aria-label={label}
      >
        <source src={src} type="video/mp4" />
        {webmSrc && <source src={webmSrc} type="video/webm" />}
      </video>
      <div className="hero-fog" aria-hidden="true" />
      <div className="hero-shade" aria-hidden="true" />
      <div className="hero-grain" aria-hidden="true" />
      <div className="hero-border" aria-hidden="true" />
      <div className="hero-intro">
        <p className="hero-intro__eyebrow glass">
          <span>{intro.eyebrow}</span>
        </p>
        <h1 className="hero-intro__title">{intro.title}</h1>
        <ul className="hero-intro__lines">
          {intro.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <span className="hero-intro__hint">{intro.hint} ↓</span>
      </div>
    </div>
  );
}
