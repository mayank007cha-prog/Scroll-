export interface Project {
  id: string
  eyebrow: string
  title: string
  description: string
  year: string
  accent: string // hex, used for the scene's background wash + CTA
  ctaLabel: string
  ctaHref: string
  // Placeholder visual — swap for a real image/video src per project.
  // Kept as a flat color + label so the interaction is easy to judge
  // without production assets.
  visualLabel: string
}

// Placeholder copy — replace with real case study content. Names match
// the brief; everything else here is a stand-in.
export const projects: Project[] = [
  {
    id: 'earthlink',
    eyebrow: 'Case study 01',
    title: 'EarthLink',
    description:
      'A field-operations platform rebuilt around one map, redesigned so dispatchers can read the whole day at a glance instead of paging through tickets.',
    year: '2024',
    accent: '#3d5a3d',
    ctaLabel: 'View case study',
    ctaHref: '#',
    visualLabel: 'EarthLink',
  },
  {
    id: 'de-medic',
    eyebrow: 'Case study 02',
    title: 'DE Medic',
    description:
      'A clinical intake flow that cut average patient onboarding from nineteen minutes to under five, without cutting a single required field.',
    year: '2024',
    accent: '#3d4a5a',
    ctaLabel: 'View case study',
    ctaHref: '#',
    visualLabel: 'DE Medic',
  },
  {
    id: 'youx-manage',
    eyebrow: 'Case study 03',
    title: 'YouX Manage',
    description:
      'A workspace admin console for a product used by teams who never asked to be admins — designed so the default view is always the safe one.',
    year: '2025',
    accent: '#5a3d4a',
    ctaLabel: 'View case study',
    ctaHref: '#',
    visualLabel: 'YouX Manage',
  },
]
