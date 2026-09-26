import Link from "next/link";
import type { Project } from "@/data/projects";

type ProjectCardProps = {
  project: Project;
  index: number;
};

/** One floating case study: a slim label bar above a big text-only card. */
export function ProjectCard({ project, index }: ProjectCardProps) {
  return (
    <Link href={`/work/${project.slug}`} className="work-item project-card" data-plane="project">
      <div className="project-card__bar">
        <span className="project-card__client">
          {project.client}
          <span className="project-card__topic">{project.topic}</span>
        </span>
        <span className="project-card__index">Case study {String(index + 1).padStart(2, "0")}</span>
      </div>
      <article className="project-card__body">
        <h2 className="project-card__title">{project.title}</h2>
        <p className="project-card__line">{project.oneLiner}</p>
        <span className="project-card__cta">View case study →</span>
      </article>
    </Link>
  );
}
