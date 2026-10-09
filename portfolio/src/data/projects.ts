/** A short video or GIF of the work, shown beside the text on the card.
 *  Put the file in public/work/ and point `src` at it, e.g.
 *  { type: "video", src: "/work/earthlink-checkout.mp4", poster: "/work/earthlink-checkout.jpg" }
 *  or { type: "image", src: "/work/earthlink-checkout.gif" }. */
export type ProjectMedia = {
  type: "video" | "image";
  src: string;
  poster?: string;
  alt?: string;
};

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
  /** Optional video/GIF for the card (a placeholder shows until it's set). */
  media?: ProjectMedia;
};

export const projects: Project[] = [
  {
    slug: "earthlink-checkout",
    client: "EarthLink",
    topic: "Checkout",
    title: "Making checkout feel like one clear journey.",
    oneLiner: "I merged plan choice, install booking, payment and confirmation into one guided flow, so customers finish checkout in fewer steps.",
    description:
      "Simplifying plan selection, installation, payment and confirmation into a faster, clearer checkout experience.",
  },
  {
    slug: "earthlink-promise-to-pay",
    client: "EarthLink",
    topic: "Promise to Pay",
    title: "More flexibility around payment dates.",
    oneLiner: "I designed a self-serve way to pick a later payment date, so customers get more time without calling support.",
    description:
      "Designing a clearer Promise to Pay experience for customers who need more time before their next payment.",
  },
  {
    slug: "de-medic-swap-duty",
    client: "DE Medic",
    topic: "Swap Duty",
    title: "Making shift changes easier for doctors.",
    oneLiner: "I designed an in-app shift swap for doctors in Germany, replacing back-and-forth calls with a request and approve flow.",
    description: "A duty-swap experience designed for doctors in the German market.",
  },
  {
    slug: "de-safe-lone-worker",
    client: "DE-Safe",
    topic: "Lone Worker",
    title: "Designing safety into the working day.",
    oneLiner: "I designed quick check-ins, one-tap alerts and clear escalation steps, so people working alone can get help fast.",
    description:
      "A lone-worker protection experience focused on quick check-ins, alerts and clear actions.",
  },
];

/** Whose portfolio this is (wordmark on the video card, page title). */
export const owner = {
  name: "Mayank Chauhan",
  role: "UI/UX Designer",
};

/** Intro over the video, in two parts. Part one shows on load; as you
 *  scroll it melts away and a short "about me" paragraph appears. The
 *  paragraph quietly echoes the video: on the move, looking out, music on,
 *  a mind on the problem. */
export const intro = {
  eyebrow: "UI/UX Designer",
  title: "I design clear products for complicated problems.",
  subtext: "Checkout, payments, healthcare and safety.",
  hint: "Scroll to explore",
  about: {
    label: "About me",
    text: "I grew up moving from city to city. It taught me to observe closely and adapt fast. I design the same way: I watch how people use things, learn new problems quickly, and keep going until they're solved. Usually with music on.",
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
