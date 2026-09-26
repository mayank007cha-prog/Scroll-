import type { Project } from "@/data/projects";
import { ProjectCard } from "./ProjectCard";

/** Renders every case study as a plane. DOM order = paint order, so each
 *  newer card sits on top of the ones that have receded behind it. */
export function ProjectStack({ projects }: { projects: Project[] }) {
  return (
    <>
      {projects.map((project, i) => (
        <ProjectCard key={project.id} project={project} index={i} total={projects.length} />
      ))}
    </>
  );
}
