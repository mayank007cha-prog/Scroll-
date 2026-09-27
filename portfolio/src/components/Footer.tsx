import type { contact as Contact } from "@/data/projects";

type FooterProps = typeof Contact;

export function Footer({ headline, supporting, cta, links }: FooterProps) {
  return (
    <footer className="work-item footer-card" data-plane="footer">
      <h2 className="footer-card__headline">{headline}</h2>
      <p className="footer-card__supporting">
        {supporting.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </p>
      <a className="footer-card__cta" href={cta.href}>
        {cta.label}
      </a>
      <ul className="footer-card__links">
        {links.map((link) => (
          <li key={link.label}>
            <a href={link.href}>{link.label}</a>
          </li>
        ))}
      </ul>
    </footer>
  );
}
