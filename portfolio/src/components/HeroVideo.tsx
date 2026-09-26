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
    </div>
  );
}
