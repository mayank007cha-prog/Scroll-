export type Project = {
  slug: string;
  client: string;
  topic: string;
  /** Big headline on the card. */
  title: string;
  /** One line under the headline. */
  oneLiner: string;
  /** Longer summary, used on the case study page. */
  description: string;
  /** Accent colour (a palette name from globals.css). */
  accent: Accent;
};

export type Accent = "iris" | "aqua" | "coral" | "mint" | "amber";

/** Inline style that sets a project's accent on an element. */
export const accentStyle = (accent: Accent) => ({ "--accent": `var(--${accent})` }) as React.CSSProperties;

export const projects: Project[] = [
  {
    slug: "earthlink-checkout",
    client: "EarthLink",
    topic: "Checkout",
    title: "Making checkout feel like one clear journey.",
    oneLiner: "Plan, installation, payment and confirmation in one faster flow.",
    description:
      "Simplifying plan selection, installation, payment and confirmation into a faster, clearer checkout experience.",
    accent: "iris",
  },
  {
    slug: "earthlink-promise-to-pay",
    client: "EarthLink",
    topic: "Promise to Pay",
    title: "More flexibility around payment dates.",
    oneLiner: "A clearer way for customers to ask for more time to pay.",
    description:
      "Designing a clearer Promise to Pay experience for customers who need more time before their next payment.",
    accent: "aqua",
  },
  {
    slug: "de-medic-swap-duty",
    client: "DE Medic",
    topic: "Swap Duty",
    title: "Making shift changes easier for doctors.",
    oneLiner: "Duty swaps designed for doctors in the German market.",
    description: "A duty-swap experience designed for doctors in the German market.",
    accent: "coral",
  },
  {
    slug: "de-safe-lone-worker",
    client: "DE-Safe",
    topic: "Lone Worker",
    title: "Designing safety into the working day.",
    oneLiner: "Quick check-ins, alerts and clear actions for people working alone.",
    description:
      "A lone-worker protection experience focused on quick check-ins, alerts and clear actions.",
    accent: "mint",
  },
  {
    slug: "fleet-design-system",
    client: "Fleet",
    topic: "Design System",
    title: "Building consistency across a growing product.",
    oneLiner: "One system for components, type, colour, spacing and layout.",
    description:
      "A scalable system for components, typography, colour, spacing and responsive layouts.",
    accent: "amber",
  },
];

/** Intro shown on the left of the video, inside the bus window. */
export const intro = {
  eyebrow: "Product Designer",
  title: "Designing products that feel clear, calm and useful.",
  lines: [
    "I turn complex flows into journeys people actually finish.",
    "Checkout, payments, healthcare, safety and design systems.",
  ],
  hint: "Scroll to explore",
};

export const getProject = (slug: string) => projects.find((p) => p.slug === slug);

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
