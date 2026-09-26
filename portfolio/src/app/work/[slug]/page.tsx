import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { initials } from "@/components/ProjectCard";
import { getProject, projects } from "@/data/projects";
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

const meta = [
  { label: "Role", value: "Lead Product Designer" },
  { label: "Timeline", value: "12 weeks" },
  { label: "Team", value: "1 PM · 4 engineers · 1 researcher" },
  { label: "Platform", value: "Web and mobile" },
];

const metrics = [
  { value: "+00%", label: "Placeholder metric, e.g. completion rate" },
  { value: "−00%", label: "Placeholder metric, e.g. support tickets" },
  { value: "0.0×", label: "Placeholder metric, e.g. speed to task" },
];

const lorem =
  "Placeholder copy. Describe the context, the people involved and what was at stake. Keep paragraphs short and specific, and lead with what changed for the user.";

export default async function CaseStudyPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  const index = projects.indexOf(project);
  const next = projects[(index + 1) % projects.length];
  const number = (i: number) => String(i + 1).padStart(2, "0");

  return (
    <div className="cs-page">
      <div className="cs-backdrop" aria-hidden="true" />

      <nav className="cs-nav glass">
        <Link href="/" className="cs-nav__link">
          ← All work
        </Link>
        <span className="cs-nav__count">
          {number(index)} / {number(projects.length - 1)}
        </span>
        <Link href={`/work/${next.slug}`} className="cs-nav__link">
          Next →
        </Link>
      </nav>

      <main className="cs">
        {/* Header */}
        <header className="cs-hero">
          <div className="cs-bar glass">
            <span className="cs-bar__who">
              <span className="logo-tile" aria-hidden="true">
                {initials(project.client)}
              </span>
              <span className="cs-bar__text">
                <strong>{project.client}</strong>
                <span>{project.topic}</span>
              </span>
            </span>
            <span className="cs-bar__meta">
              <strong>Case study {number(index)}</strong>
              <span>{project.oneLiner}</span>
            </span>
          </div>
          <h1 className="cs-title">{project.title}</h1>
          <p className="cs-lead">{project.description}</p>
        </header>

        {/* Cover */}
        <figure className="cs-media cs-media--cover glass">
          <span>Cover visual · 16:9</span>
        </figure>

        {/* Meta */}
        <dl className="cs-meta">
          {meta.map((m) => (
            <div key={m.label} className="cs-meta__item glass">
              <dt>{m.label}</dt>
              <dd>{m.value}</dd>
            </div>
          ))}
        </dl>

        {/* Overview */}
        <section className="cs-section">
          <p className="cs-section__label">01 · Overview</p>
          <div className="cs-section__body">
            <h2>What we set out to do.</h2>
            <p>{lorem}</p>
            <p>{lorem}</p>
          </div>
        </section>

        {/* Problem */}
        <section className="cs-section">
          <p className="cs-section__label">02 · The problem</p>
          <div className="cs-section__body">
            <h2>Where people were getting stuck.</h2>
            <p>{lorem}</p>
            <ul className="cs-list">
              <li>Placeholder pain point one</li>
              <li>Placeholder pain point two</li>
              <li>Placeholder pain point three</li>
            </ul>
          </div>
        </section>

        <figure className="cs-media cs-media--wide glass">
          <span>Research artefact · journey map</span>
        </figure>

        {/* Process */}
        <section className="cs-section">
          <p className="cs-section__label">03 · Process</p>
          <div className="cs-section__body">
            <h2>From research to a clear direction.</h2>
            <p>{lorem}</p>
          </div>
        </section>

        <div className="cs-grid">
          <figure className="cs-media glass">
            <span>Wireframes</span>
          </figure>
          <figure className="cs-media glass">
            <span>Flow exploration</span>
          </figure>
        </div>

        {/* Solution */}
        <section className="cs-section">
          <p className="cs-section__label">04 · Solution</p>
          <div className="cs-section__body">
            <h2>The design, in three moves.</h2>
            <p>{lorem}</p>
          </div>
        </section>

        <div className="cs-features">
          {["Placeholder feature one", "Placeholder feature two", "Placeholder feature three"].map((f, i) => (
            <div key={f} className="cs-feature glass">
              <span className="cs-feature__num">{number(i)}</span>
              <h3>{f}</h3>
              <p>One or two lines on what it does and why it matters.</p>
            </div>
          ))}
        </div>

        <figure className="cs-media cs-media--cover glass">
          <span>Final screens</span>
        </figure>

        {/* Impact */}
        <section className="cs-section">
          <p className="cs-section__label">05 · Impact</p>
          <div className="cs-section__body">
            <h2>What changed.</h2>
            <p>{lorem}</p>
          </div>
        </section>

        <div className="cs-metrics">
          {metrics.map((m) => (
            <div key={m.label} className="cs-metric glass">
              <strong>{m.value}</strong>
              <span>{m.label}</span>
            </div>
          ))}
        </div>

        {/* Learnings */}
        <section className="cs-section">
          <p className="cs-section__label">06 · Learnings</p>
          <div className="cs-section__body">
            <blockquote className="cs-quote">
              “Placeholder pull quote: the one sentence you want a hiring manager to remember from this
              project.”
            </blockquote>
            <p>{lorem}</p>
          </div>
        </section>

        {/* Next */}
        <Link href={`/work/${next.slug}`} className="cs-next glass">
          <span className="cs-next__label">Next case study</span>
          <span className="cs-next__row">
            <span className="logo-tile" aria-hidden="true">
              {initials(next.client)}
            </span>
            <span>
              {next.client} · {next.topic}
            </span>
          </span>
          <strong className="cs-next__title">{next.title}</strong>
          <span className="cs-next__cta">View case study →</span>
        </Link>
      </main>
    </div>
  );
}
