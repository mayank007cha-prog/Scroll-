import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CaseToc } from "@/components/CaseToc";
import { initials } from "@/components/ProjectCard";
import { accentStyle, getProject, projects } from "@/data/projects";
import "./case-study.css";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return projects.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const project = getProject((await params).slug);
  return { title: project ? `${project.client} ${project.topic}` : "Case study" };
}

// ---- Dummy content (same for every case study until the real copy lands) ----

const facts = [
  { label: "Role", value: "Lead Product Designer" },
  { label: "Timeline", value: "12 weeks" },
  { label: "Team", value: "PM, 4 engineers, researcher" },
  { label: "Platform", value: "Web and mobile" },
];

const contents = [
  { id: "overview", label: "Overview" },
  { id: "problem", label: "The problem" },
  { id: "research", label: "Research" },
  { id: "approach", label: "Approach" },
  { id: "solution", label: "Solution" },
  { id: "impact", label: "What changed" },
  { id: "learnings", label: "Learnings" },
];

const copy =
  "Placeholder copy. Describe the context, the people involved and what was at stake. Keep paragraphs short and specific, and lead with what changed for the user.";

function Media({ label, ratio = "16 / 10" }: { label: string; ratio?: string }) {
  return (
    <figure className="cs-media" style={{ aspectRatio: ratio }}>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

export default async function CaseStudyPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  const index = projects.indexOf(project);
  const next = projects[(index + 1) % projects.length];

  return (
    <div className="cs-page" style={accentStyle(project.accent)}>
      <header className="cs-top">
        <Link href="/" className="cs-back">
          ← All work
        </Link>
      </header>

      <div className="cs-layout">
        <aside className="cs-aside">
          <CaseToc items={contents} />
        </aside>

        <main className="cs-main">
          <header className="cs-head">
            <p className="cs-client">
              <span className="logo-tile" aria-hidden="true">
                {initials(project.client)}
              </span>
              {project.client} · {project.topic}
            </p>
            <h1 className="cs-title">{project.title}</h1>
            <p className="cs-lead">{project.description}</p>
            <dl className="cs-facts">
              {facts.map((f) => (
                <div key={f.label}>
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
          </header>

          <Media label="Cover visual" />

          <section id="overview" className="cs-section">
            <h2>Overview</h2>
            <p>{copy}</p>
            <p>{copy}</p>
          </section>

          <section id="problem" className="cs-section">
            <h2>The problem</h2>
            <p>{copy}</p>
            <ul>
              <li>Placeholder pain point one</li>
              <li>Placeholder pain point two</li>
              <li>Placeholder pain point three</li>
            </ul>
          </section>

          <section id="research" className="cs-section">
            <h2>Research</h2>
            <p>{copy}</p>
            <Media label="Journey map" ratio="21 / 9" />
          </section>

          <section id="approach" className="cs-section">
            <h2>Approach</h2>
            <p>{copy}</p>
            <div className="cs-pair">
              <Media label="Wireframes" ratio="4 / 3" />
              <Media label="Flow exploration" ratio="4 / 3" />
            </div>
          </section>

          <section id="solution" className="cs-section">
            <h2>Solution</h2>
            <p>{copy}</p>
            <Media label="Final screens" />
          </section>

          <section id="impact" className="cs-section">
            <h2>What changed</h2>
            <p>{copy}</p>
            <div className="cs-stats">
              <div>
                <strong>+00%</strong>
                <span>Placeholder metric</span>
              </div>
              <div>
                <strong>−00%</strong>
                <span>Placeholder metric</span>
              </div>
              <div>
                <strong>0.0×</strong>
                <span>Placeholder metric</span>
              </div>
            </div>
          </section>

          <section id="learnings" className="cs-section">
            <h2>Learnings</h2>
            <blockquote>“Placeholder pull quote: the one sentence you want someone to remember from this project.”</blockquote>
            <p>{copy}</p>
          </section>

          <Link href={`/work/${next.slug}`} className="cs-next">
            <span className="cs-next__label">Next case study</span>
            <span className="cs-next__title">{next.title}</span>
            <span className="cs-next__meta">
              {next.client} · {next.topic} →
            </span>
          </Link>
        </main>
      </div>
    </div>
  );
}
