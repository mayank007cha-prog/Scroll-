# Assets checklist

Everything the site still needs, with the size to export at. Sizes are 2× the
largest size each slot shows on screen, so they stay sharp on retina displays.

**Figma:** every slot below has a matching frame on the "Assets for portfolio"
page of the Interactions-motion file
(https://www.figma.com/design/drf0JtS2gg4BL55VLqCkHP/Interactions-motion?node-id=324-1039).
Frames are named with their path (e.g. `demedic/duty-tab`) and export at 2×, so
an export lands each file in the right folder. Logos export to
`assets/media/logos/`, favicon, photo and share image to `assets/media/brand/`.

Send PNG or JPG for images and MP4 or MOV for video. I'll compress, convert and
wire them in, so you don't need to optimise anything yourself.

## Export sizes by slot shape

| Shape | Export at | Used for |
| --- | --- | --- |
| 16:8 (wide) | 2400 × 1200 | Case study hero (top of each case study) |
| 16:9 | 2400 × 1350 | Full-width screens, flows, Figma screenshots |
| 4:3 | 1600 × 1200 | Side-by-side pairs (EarthLink autofill, date cards) |
| 4:5 (portrait) | 1200 × 1500 | Single app screens, phases, iteration before/after |

For mobile app screens in a 4:5 slot, send the raw screen (for example
1170 × 2532). I'll place it on the site background at 4:5.

Hero videos: 10–20 seconds, 1920 × 960 or larger, no sound. Under 8 MB after I
compress them.

## Case studies (35 slots)

Name the files exactly like this and put them in `portfolio/assets/media/<case>/`.

### DE Medic (`demedic/`)
| File | Shape | What to show |
| --- | --- | --- |
| hero.mp4 | 16:8 video | The full offer → bid → swap journey |
| duty-tab.png | 4:5 | Duty tab: two weeks of duties with Offer buttons |
| marketplace.png | 4:5 | Marketplace tab with a private offer pinned on top |
| phase-1.mp4 | 4:5 video | Offer flow: credits choice, then public or private |
| phase-2.mp4 | 4:5 video | Notification → Marketplace → choose duties to bid |
| phase-3.png | 4:5 | Offered card with bid count, then the list of bids |
| phase-4.png | 4:5 | Swapped duty with the "under admin approval" note |
| iteration-1-before.png / -after.png | 4:5 | Duty status: earlier version → colour + icon + label |
| iteration-2-before.png / -after.png | 4:5 | Where bids appear: earlier version → on the duty card |
| final.png | 16:9 | Key screens side by side |

### EarthLink (`earthlink/`)
| File | Shape | What to show |
| --- | --- | --- |
| hero.mp4 | 16:8 video | Plan → date → details → Review & Pay |
| before.png | 16:9 | The old six-step checkout |
| autofill.mp4 | 4:3 video | Google or Apple login filling the details |
| dates.png | 4:3 | Date cards with the first date pre-selected |
| review-pay.png | 16:9 | Review & Pay with "Due today" above the pay buttons |
| iteration-1-before.png / -after.png | 4:5 | Date picker → open date cards |
| iteration-2-before.png / -after.png | 4:5 | Separate steps → one Review & Pay |

### DeSafe (`desafe/`)
| File | Shape | What to show |
| --- | --- | --- |
| hero.mp4 | 16:8 video | Home screen to "Alert sent" |
| home.png | 4:5 | Home / SOS screen |
| alert-sent.png | 4:5 | Who was notified and what happens next |
| flow.mp4 | 16:9 video | The alert flow |
| iteration-1-before.png / -after.png | 4:5 | The alert button |
| iteration-2-before.png / -after.png | 4:5 | Confirming an alert was sent |

### Design System (`design-system/`)
| File | Shape | What to show |
| --- | --- | --- |
| audit.png | 16:8 | Inconsistent buttons found before |
| figma.png | 16:9 | Your Figma component: properties panel and variants |
| iteration-1-before.png / -after.png | 4:5 | Colour-named tokens → purpose-named tokens |
| iteration-2-before.png / -after.png | 4:5 | Separate drawings → one component with properties |

Don't have a "before" for an iteration? Tell me and I'll switch that block to a
single image, or drop it.

## Concept videos (5)

Put the raw screen recordings in `portfolio/assets/media/concepts/`:
`spotify-mini-player`, `netflix-quick-view`, `google-incognito`,
`app-icons-play`, `wallpaper-change` (any of .mp4, .mov, .webm).

- **Length:** 6–10 seconds of the interaction (8 is the sweet spot). Long
  enough to see it twice in a row, short enough that people don't wait.
- **Loop:** start and end on the same screen so the loop is seamless. If they
  don't match, I'll add a short crossfade.
- **Recording:** portrait, straight from a phone or a Figma/ProtoPie prototype,
  no device frame, no sound. Any resolution from 720 px wide up.
- **What I do:** trim, crop to the phone screen, compress to roughly
  720 × 1560 at 30 fps (about 1–2.5 MB each), and place them in the 3D phones.

## Logos, photos and links

| Item | Format | Notes |
| --- | --- | --- |
| DE Medic, EarthLink, DeSafe logos | SVG, or PNG 128 × 128 with transparency | Shown at 22 px on the cards. Only if the client allows it; otherwise the initials stay. |
| DigiMantra logo (optional) | SVG | For the "Now" stop in the timeline |
| Your photo (optional) | 1200 × 1500 (4:5) | For the About section, if you'd like one |
| Favicon | SVG, or PNG 512 × 512 | The tab icon. I can make one from your star mark if you like. |
| Share image | 1200 × 630 | Shown when the link is shared on LinkedIn or WhatsApp. I can design this. |
| Resume | PDF | For the Resume and Download resume buttons |
| Links | URLs | LinkedIn, Behance, GitHub (or drop it), email |

All other icons on the site are drawn in code and don't need files.
