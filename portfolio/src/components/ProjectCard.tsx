import Link from "next/link";
import type { Project } from "@/data/projects";

type ProjectCardProps = {
  project: Project;
  index: number;
};

/** First letters of the client name, for the logo tile. */
export const initials = (name: string) =>
  name
    .split(/[\s-]+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** One floating case study: a single glass card with a label row, the
 *  title and one-liner, and a slot for a video or GIF of the work. */
export function ProjectCard({ project, index }: ProjectCardProps) {
  const { media } = project;
  return (
    <Link href={`/work/${project.slug}`} className="work-item project-card" data-plane="project">
      <article className="project-card__body glass">
        <header className="project-card__meta">
          <span className="project-card__client">
            <span className="logo-tile" aria-hidden="true">
              {initials(project.client)}
            </span>
            <span className="project-card__client-text">
              {project.client}
              <span className="project-card__topic">{project.topic}</span>
            </span>
          </span>
          <span className="project-card__index">Case study {String(index + 1).padStart(2, "0")}</span>
        </header>
        <div className="project-card__main">
          <div className="project-card__text">
            <h2 className="project-card__title">{project.title}</h2>
            <p className="project-card__line">{project.oneLiner}</p>
            <span className="project-card__cta">View case study →</span>
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
    </Link>
  );
}
