import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProject, projects } from "@/data/projects";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return projects.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const project = getProject((await params).slug);
  return { title: project ? `${project.client} ${project.topic}` : "Case study" };
}

// Placeholder sections until the real case study content is written.
const sections = [
  { heading: "The problem", body: "Placeholder: what wasn't working, for whom, and how we knew." },
  { heading: "My role", body: "Placeholder: team, timeline and what I owned." },
  { heading: "Approach", body: "Placeholder: research, key decisions and the trade-offs behind them." },
  { heading: "Outcome", body: "Placeholder: what shipped and what changed as a result." },
];

export default async function CaseStudyPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  const index = projects.indexOf(project);
  const next = projects[(index + 1) % projects.length];

  return (
    <main className="case">
      <Link href="/" className="case__back">
        ← All work
      </Link>

      <header className="case__header">
        <p className="case__eyebrow">
          {project.client} · {project.topic}
        </p>
        <h1 className="case__title">{project.title}</h1>
        <p className="case__lead">{project.description}</p>
      </header>

      <div className="case__cover" aria-hidden="true">
        Cover visual
      </div>

      <div className="case__sections">
        {sections.map((s) => (
          <section key={s.heading} className="case__section">
            <h2>{s.heading}</h2>
            <p>{s.body}</p>
          </section>
        ))}
      </div>

      <Link href={`/work/${next.slug}`} className="case__next">
        <span>Next case study</span>
        <strong>{next.title}</strong>
      </Link>
    </main>
  );
}
