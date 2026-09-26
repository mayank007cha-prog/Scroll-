export type Project = {
  id: string;
  category: string;
  title: string;
  description: string;
  /** Optional cover image (lazy loaded). */
  image?: { src: string; alt: string };
  href?: string;
};

export const projects: Project[] = [
  {
    id: "earthlink-checkout",
    category: "EarthLink / Checkout",
    title: "Making checkout feel like one clear journey.",
    description:
      "Simplifying plan selection, installation, payment and confirmation into a faster, clearer checkout experience.",
  },
  {
    id: "earthlink-promise-to-pay",
    category: "EarthLink / Promise to Pay",
    title: "More flexibility around payment dates.",
    description:
      "Designing a clearer Promise to Pay experience for customers who need more time before their next payment.",
  },
  {
    id: "de-medic-swap-duty",
    category: "DE Medic / Swap Duty",
    title: "Making shift changes easier for doctors.",
    description: "A duty-swap experience designed for doctors in the German market.",
  },
  {
    id: "de-safe-lone-worker",
    category: "DE-Safe / Lone Worker",
    title: "Designing safety into the working day.",
    description:
      "A lone-worker protection experience focused on quick check-ins, alerts and clear actions.",
  },
  {
    id: "fleet-design-system",
    category: "Fleet / Design System",
    title: "Building consistency across a growing product.",
    description:
      "A scalable system for components, typography, colour, spacing and responsive layouts.",
  },
];

// TODO: replace the placeholder email / LinkedIn / resume links.
export const contact = {
  headline: "Let's build something useful.",
  supporting: ["Functional by default.", "Creative when needed."],
  cta: { label: "Let's talk →", href: "mailto:hello@example.com" },
  links: [
    { label: "Email", href: "mailto:hello@example.com" },
    { label: "LinkedIn", href: "https://www.linkedin.com/" },
    { label: "Resume", href: "#" },
  ],
};
