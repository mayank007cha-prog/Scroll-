import type { ReactNode } from "react";
import type { Project } from "@/data/projects";
import { ProjectCard } from "./ProjectCard";

/**
 * The horizontal row of floating case studies. ScrollStage moves the whole
 * track right → left and bends each item into a gentle curve by its
 * distance from the centre. `children` (the footer) is the last item.
 */
export function ProjectStack({ projects, children }: { projects: Project[]; children?: ReactNode }) {
  return (
    <div className="work-track" data-track id="work">
      {projects.map((project, i) => (
        <ProjectCard key={project.slug} project={project} index={i} />
      ))}
      {children}
    </div>
  );
}
