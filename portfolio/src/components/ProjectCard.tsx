import Link from "next/link";
import { accentStyle, type Project } from "@/data/projects";

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

/** One floating case study: a glass label bar above a big glass card. */
export function ProjectCard({ project, index }: ProjectCardProps) {
  return (
    <Link
      href={`/work/${project.slug}`}
      className="work-item project-card"
      data-plane="project"
      style={accentStyle(project.accent)}
    >
      <div className="project-card__bar glass">
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
      </div>
      <article className="project-card__body glass">
        <h2 className="project-card__title">{project.title}</h2>
        <p className="project-card__line">{project.oneLiner}</p>
        <span className="project-card__cta">View case study →</span>
      </article>
    </Link>
  );
}
