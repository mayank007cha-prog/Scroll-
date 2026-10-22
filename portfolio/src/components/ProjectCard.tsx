import Link from "next/link";
import type { CSSProperties } from "react";
import type { Project } from "@/data/projects";

type ProjectCardProps = {
  project: Project;
  index?: number;
};

/** Thin vertical slices each card is drawn as, so ScrollStage can bend it
 *  smoothly at the edges of the frame (each slice is a plain 3D transform). */
const STRIPS = 24;

/** First letters of the client name, for the logo tile. */
export const initials = (name: string) =>
  name
    .split(/[\s-]+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** The card itself: a plain, solid panel in the project's colour. Left:
 *  client, title, one-liner and a glass button; right: a slot for a video
 *  or GIF of the work. */
function CardFace({ project }: { project: Project }) {
  const { media } = project;
  return (
    <article className={`project-card__body tone-${project.tone}`}>
      <div className="project-card__main">
        <div className="project-card__text">
          <header className="project-card__client">
            <span className="logo-tile" aria-hidden="true">
              {initials(project.client)}
            </span>
            <span className="project-card__client-text">
              {project.client}
              <span className="project-card__topic">{project.topic}</span>
            </span>
          </header>
          <h2 className="project-card__title">{project.title}</h2>
          <p className="project-card__line">{project.oneLiner}</p>
          <span className="btn-glass project-card__cta">View case study →</span>
        </div>
        <div className="project-card__media">
          {media?.type === "video" ? (
            <video src={media.src} poster={media.poster} muted loop autoPlay playsInline preload="metadata" aria-hidden="true" />
          ) : media?.type === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element -- GIFs must stay animated
            <img src={media.src} alt={media.alt ?? ""} loading="lazy" />
          ) : (
            <span className="project-card__media-hint" aria-hidden="true">
              <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.2">
                <circle cx="20" cy="20" r="18.5" />
                <path d="M16.5 13.5v13l10-6.5z" fill="currentColor" stroke="none" />
              </svg>
              Video / GIF
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

/** One floating case study. Drawn as thin slices (visual only; a hidden
 *  text copy keeps it readable for screen readers) so it can bend like paper
 *  at the frame edges. A card with a video keeps a single face, since every
 *  slice would otherwise play its own copy; it gets a gentle tilt instead. */
export function ProjectCard({ project }: ProjectCardProps) {
  const sliced = project.media?.type !== "video";
  return (
    <Link href={`/work/${project.slug}`} className={`work-item project-card${sliced ? " project-card--sliced" : ""}`} data-plane="project">
      {sliced ? (
        <>
          <div className="card-strips" aria-hidden="true" style={{ "--n": STRIPS } as CSSProperties}>
            {Array.from({ length: STRIPS }, (_, i) => (
              <div key={i} className="card-strip" data-strip style={{ "--i": i } as CSSProperties}>
                <div className="card-strip__face">
                  <CardFace project={project} />
                </div>
              </div>
            ))}
          </div>
          <span className="sr-only">
            {project.client}, {project.topic}. {project.title} {project.oneLiner} View case study.
          </span>
        </>
      ) : (
        <CardFace project={project} />
      )}
    </Link>
  );
}
