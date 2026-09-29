import { intro, owner } from "@/data/projects";
import { WaveLines } from "./WaveLines";

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
      <WaveLines className="wave-lines--hero" />
      <div className="hero-grain" aria-hidden="true" />
      <div className="hero-border" aria-hidden="true" />
      {/* Name, top left of the video card. */}
      <div className="hero-mark">
        <span className="hero-mark__name">{owner.name}</span>
      </div>
      <div className="hero-intro">
        {/* Part one: on load. ScrollStage melts it away with the liquid filter. */}
        <div className="hero-intro__stage" data-intro-one>
          <p className="hero-intro__eyebrow glass">
            <span>{intro.eyebrow}</span>
          </p>
          <h1 className="hero-intro__title">{intro.title}</h1>
          <p className="hero-intro__subtext">{intro.subtext}</p>
          <span className="hero-intro__hint">{intro.hint} ↓</span>
        </div>
        {/* Part two: a short paragraph that rises in as the video plays. */}
        <div className="hero-intro__stage" data-intro-two>
          <p className="hero-intro__eyebrow glass" data-intro-point>
            <span>{intro.about.label}</span>
          </p>
          <p className="hero-intro__about" data-intro-point>
            {intro.about.text}
          </p>
        </div>
      </div>
      {/* Liquid dissolve: turbulence-driven displacement plus blur. ScrollStage
          scrubs the displacement and blur amounts. */}
      <svg className="hero-liquid-defs" aria-hidden="true" focusable="false">
        <filter id="hero-liquid" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.045" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G" data-liquid-disp />
          <feGaussianBlur stdDeviation="0" data-liquid-blur />
        </filter>
      </svg>
    </div>
  );
}
