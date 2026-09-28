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
};

export const projects: Project[] = [
  {
    slug: "earthlink-checkout",
    client: "EarthLink",
    topic: "Checkout",
    title: "Making checkout feel like one clear journey.",
    oneLiner: "Plan, installation, payment and confirmation in one faster flow.",
    description:
      "Simplifying plan selection, installation, payment and confirmation into a faster, clearer checkout experience.",
  },
  {
    slug: "earthlink-promise-to-pay",
    client: "EarthLink",
    topic: "Promise to Pay",
    title: "More flexibility around payment dates.",
    oneLiner: "A clearer way for customers to ask for more time to pay.",
    description:
      "Designing a clearer Promise to Pay experience for customers who need more time before their next payment.",
  },
  {
    slug: "de-medic-swap-duty",
    client: "DE Medic",
    topic: "Swap Duty",
    title: "Making shift changes easier for doctors.",
    oneLiner: "Duty swaps designed for doctors in the German market.",
    description: "A duty-swap experience designed for doctors in the German market.",
  },
  {
    slug: "de-safe-lone-worker",
    client: "DE-Safe",
    topic: "Lone Worker",
    title: "Designing safety into the working day.",
    oneLiner: "Quick check-ins, alerts and clear actions for people working alone.",
    description:
      "A lone-worker protection experience focused on quick check-ins, alerts and clear actions.",
  },
  {
    slug: "fleet-design-system",
    client: "Fleet",
    topic: "Design System",
    title: "Building consistency across a growing product.",
    oneLiner: "One system for components, type, colour, spacing and layout.",
    description:
      "A scalable system for components, typography, colour, spacing and responsive layouts.",
  },
];

/** Intro over the video, in two parts. Part one shows on load; as you
 *  scroll it melts away and a short "about me" paragraph appears. The
 *  paragraph quietly echoes the video: on the move, looking out, music on,
 *  a mind on the problem. */
export const intro = {
  eyebrow: "Product Designer",
  title: "I design clear products for complicated problems.",
  subtext: "Checkout, payments, healthcare, safety and design systems.",
  hint: "Scroll to explore",
  about: {
    label: "About me",
    text: "I grew up moving between cities, so I learned early to watch closely and adapt quickly. That's still how I work: I notice how people really use things, settle into new problems fast, and stay with them until they're solved. Usually with music on.",
  },
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
