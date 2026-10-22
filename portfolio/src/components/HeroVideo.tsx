import { intro, owner } from "@/data/projects";

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
 * Layers, bottom to top: video → matte fog (fades in as it zooms out) →
 * gradient on the window side → film grain → intro text (two parts).
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
      <div className="hero-border" aria-hidden="true" />
      {/* Name, top left of the video card. */}
      <div className="hero-mark">
        <span className="hero-mark__name">{owner.name}</span>
      </div>
      <div className="hero-intro">
        {/* Part one: on load. ScrollStage fades it away as you scroll. */}
        <div className="hero-intro__stage" data-intro-one>
          <h1 className="hero-intro__title">{intro.title}</h1>
          <span className="hero-intro__hint">{intro.hint} ↓</span>
        </div>
        {/* Part two: two short paragraphs about me that rise in as the video plays. */}
        <div className="hero-intro__stage" data-intro-two>
          {intro.about.map((text, i) => (
            <p key={i} className={`hero-intro__about${i === 0 ? " hero-intro__about--lead" : ""}`} data-intro-point>
              {text}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
