import type { contact as Contact } from "@/data/projects";

type FooterProps = typeof Contact;

export function Footer({ headline, supporting, cta, links }: FooterProps) {
  return (
    <footer className="plane footer-plane" data-plane="footer">
      <h2 className="footer-plane__headline">{headline}</h2>
      <p className="footer-plane__supporting">
        {supporting.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </p>
      <a className="footer-plane__cta" href={cta.href}>
        {cta.label}
      </a>
      <ul className="footer-plane__links">
        {links.map((link) => (
          <li key={link.label}>
            <a href={link.href}>{link.label}</a>
          </li>
        ))}
      </ul>
    </footer>
  );
}
