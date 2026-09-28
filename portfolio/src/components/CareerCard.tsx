import { career } from "@/data/projects";

/** Education and career, as a card in the row after the case studies. */
export function CareerCard() {
  return (
    <article className="work-item project-card career-card" data-plane="project" aria-label={career.label}>
      <div className="project-card__bar glass">
        <span className="project-card__client">
          <span className="project-card__client-text">{career.label}</span>
        </span>
        <span className="project-card__index">Profile</span>
      </div>
      <div className="project-card__body glass career-card__body">
        <h2 className="career-card__title">{career.title}</h2>
        <div className="career-card__cols">
          <section>
            <h3 className="career-card__heading">Experience</h3>
            <ol className="career-card__list">
              {career.experience.map((e, i) => (
                <li key={i}>
                  <strong>{e.role}</strong>
                  <span>{e.org}</span>
                  <time>{e.period}</time>
                </li>
              ))}
            </ol>
          </section>
          <section>
            <h3 className="career-card__heading">Education</h3>
            <ol className="career-card__list">
              {career.education.map((e, i) => (
                <li key={i}>
                  <strong>{e.degree}</strong>
                  <span>{e.school}</span>
                  <time>{e.period}</time>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </article>
  );
}
