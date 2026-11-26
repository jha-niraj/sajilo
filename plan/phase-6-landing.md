# Phase 6 - Landing page and About

A public face for Sajilo inside `apps/main`: the story of a daily collector in Nepal (my father) and how Sajilo answers it. Not crowded, no pricing.

## Decisions (asked 2026-11-26)

| Topic | Decision |
|---|---|
| Routing | Landing at `/`, sign in moves to `/login`, `/about` public. Signed-in visitors to `/`, `/login`, `/signup` still go to `/munshi`. PWA start_url stays `/munshi` (signed out -> `/login?returnTo=`). |
| Home sections | Hero, Story (Gurukul section 2 pattern), What it does (trust grid), A day with Sajilo (expanding panels), Who it's for (pixel portraits between Dhaka strips). |
| Art | Pixel art drawn in code (Boli's Grid -> SVG paths, row-by-row reveal), Dhaka topi strips, the uncle illustration (`/images/auth/welcome.webp`), plus colourful flat vector / screen mocks where a story beat needs warmth. |
| Look | Sajilo's warm paper + ink + saffron, Bricolage + Mukta, with a light sky blue (hero sky, accents). Light only. |
| Father | "My father", no name. |
| About | Niraj's story: son of a collector, engineer (Creatr, Gurukul, Vidhica, SyncHQ, RakamHQ), why Sajilo, what it solves, what comes next. Ends with contact links (email, LinkedIn, GitHub), no form. |
| Hackathon | Not mentioned. |
| Language | en / ne / mai with a switch in the navbar (copy in `lib/landing/copy.ts`, typed per language). |
| Buttons | Navbar: Sign in. Hero: Sign in + Watch the story (scrolls to #story). |
| Nav | Story, What it does, A day with Sajilo, Who it's for (anchors on `/`), About (page). |
| Footer | Dhaka strip, one row of links, "Made in Nepal", big Sajilo wordmark with the pixel scene showing through. |

## Tasks

- [x] T1 Routing: `/` landing, `/login` real page, `/about`; middleware public routes + returnTo to `/login`; sign-out, session clear, signup links -> `/login`; robots allow `/` and `/about`; sign-in-destination tests.
- [x] T2 Art kit in `components/landing/art/`: Grid, PixelSvg/Pixels, Dhaka pattern + strip, reveal-on-view, art.css (reduced motion).
- [x] T3 Pixel scenes: hero street (sky, hills, shops, prayer flags), story beats (dawn walk, counter + notebook, night lamp + bag of cash, voice), portraits for Who.
- [x] T4 Copy in `lib/landing/copy.ts` (en, ne, mai).
- [x] T5 Shell: navbar (sticky, blur, anchors, language switch, mobile dropdown), footer (Dhaka strip, links, wordmark), reveal observer.
- [x] T6 Home sections: Hero, Story, What it does, A day with Sajilo, Who it's for, closing CTA.
- [x] T7 About page: hero, story chapters with scenes, what it solves, what next, contact.
- [x] T8 Check at 360px and desktop in Chrome, both languages, reduced motion; tsc, lint, tests.
- [x] T9 CLAUDE.md routes + this plan ticked.
