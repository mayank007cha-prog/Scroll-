import Image from "next/image";
import type { Project } from "@/data/projects";

type ProjectCardProps = {
  project: Project;
  index: number;
  total: number;
};

export function ProjectCard({ project, index, total }: ProjectCardProps) {
  const number = String(index + 1).padStart(2, "0");

  return (
    <article className="plane project-card" data-plane="project" aria-label={project.title}>
      <div className="project-card__text">
        <p className="project-card__meta">
          <span>
            {number} / {String(total).padStart(2, "0")}
          </span>
          <span>{project.category}</span>
        </p>
        <h2 className="project-card__title">{project.title}</h2>
        <p className="project-card__description">{project.description}</p>
        {project.href && (
          <a className="project-card__link" href={project.href}>
            View case study →
          </a>
        )}
      </div>

      <div className="project-card__media">
        {project.image ? (
          // next/image lazy loads by default.
          <Image src={project.image.src} alt={project.image.alt} fill sizes="(max-width: 767px) 100vw, 50vw" />
        ) : (
          <span className="project-card__placeholder">Project {number} visual</span>
        )}
      </div>
    </article>
  );
}
