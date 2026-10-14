'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { featuredGuides, audienceLabel } from '@repo/guides';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { useAutoHideHeader } from '../../hooks/use-auto-hide-header';
import {
    GraduationCap, CreditCard, ClipboardList, BrainCircuit, ClipboardCheck, BarChart, Users, Calendar,
    Heart, Sparkles, BookOpen, ArrowLeftRight, Mail, Globe, Code2, Building2, Home, Calculator,
    Compass,
    BookMarked, Briefcase, Backpack, ChevronDown, ArrowRight, Menu, X,
} from 'lucide-react';

type NavItem = {
    title: string;
    href: string;
    description: string;
    icon: React.ElementType;
};

/**
 * ## Navigation structure - grounded in what competitors actually do
 *
 * Checked against three real navs rather than assumed (2026-08-08):
 *
 *  - **Veda** (Nepal market leader, ~800-1,300 schools): Company / Features / Products / Resources
 *    / Contact / Plans
 *  - **Fedena** (India, large installed base): Product / Partner / Pricing / Resources / About /
 *    Contact
 *  - **PowerSchool** (global): Connected OS / Products / Company / More
 *
 * Four patterns hold across all three, and this nav now follows each one:
 *
 *  1. **Products/Product is its own menu and comes first.** Every module lives there, nothing else
 *     does. Ours previously scattered them - `School Website` sat under Company between Contact and
 *     Privacy Policy, which files a product with the legal pages.
 *  2. **Pricing is always a top-level direct link.** Never buried.
 *  3. **Resources is always a distinct menu.** All three have one; we had none, despite 48 indexed
 *     blog URLs, a glossary and comparison pages with real traffic and no nav entry at all.
 *  4. **Company holds story/careers/contact - never products, never legal.** Privacy and Terms move
 *     to the footer: nobody has ever used a top nav to find a privacy policy, and it was spending
 *     prime space on compliance links.
 *
 * PowerSchool adds the one genuinely sophisticated move, which we copy: **group products by the
 * OUTCOME a buyer wants** ("Operational Excellence", "Student Achievement"), not by internal module
 * names. Ours reads "Run the office" / "Teaching & learning" for the same reason.
 *
 * `Solutions` has no direct analogue in the three above, and it is the one addition: it answers
 * "is this for a school like mine", which our nav could not answer at all. It is built only from
 * pages that EXIST (`/for/private-schools`, `/for/boarding-schools`, `/compare`,
 * `/roi-calculator`) - every href here was verified against the route tree, because a nav that
 * 404s is worse than one that is merely disorganised.
 */

const MODULE_LINKS: NavItem[] = [
    { title: 'Students', href: '/features/students', description: 'Student records, attendance, and promotions', icon: GraduationCap },
    { title: 'Billing & Fees', href: '/features/billing', description: 'Fee collection, invoices, and payments', icon: CreditCard },
    { title: 'Attendance', href: '/features/attendance', description: 'Daily attendance and reports', icon: ClipboardCheck },
    { title: 'Staff & HR', href: '/features/staff', description: 'Staff leaves, appraisals, and payroll', icon: Users },
    { title: 'Examinations', href: '/features/examinations', description: 'Exams, marks entry, and results', icon: ClipboardList },
    { title: 'Reports', href: '/features/reports', description: 'Progress reports and analytics', icon: BarChart },
    { title: 'Timetables', href: '/features/timetables', description: 'Automated scheduling and periods', icon: Calendar },
    { title: 'AI Tools', href: '/features/ai', description: 'Lesson plans, AI grading, and insights', icon: BrainCircuit },
];

// Grouped by the outcome a school wants, not by module name - the PowerSchool pattern.
const MODULE_GROUPS: { heading: string; hrefs: string[] }[] = [
    { heading: 'Run the office', hrefs: ['/features/students', '/features/billing', '/features/attendance', '/features/staff'] },
    { heading: 'Teaching & learning', hrefs: ['/features/examinations', '/features/reports', '/features/timetables', '/features/ai'] },
];
const MODULE_COLUMNS = MODULE_GROUPS.map((g) => ({
    heading: g.heading,
    items: g.hrefs.map((h) => MODULE_LINKS.find((m) => m.href === h)).filter((m): m is NavItem => !!m),
}));

// Promoted OUT of the old Company junk drawer. Both are products a school buys, not company info.
const REACH_LINKS: NavItem[] = [
    { title: 'School Website', href: '/features/school-website', icon: Globe, description: "Your school's public website, built in" },
    { title: 'Developer API', href: '/developers', icon: Code2, description: 'Public REST API and docs' },
];

// "Is this for a school like mine?" - the question the old nav had no entry point for.
// Ordered by buying intent: segment fit first, then the two tools people use to decide.
const SOLUTIONS_LINKS: NavItem[] = [
    { title: 'Private schools', href: '/for/private-schools', description: 'Built for how private schools in Nepal run', icon: Building2 },
    { title: 'Boarding schools', href: '/for/boarding-schools', description: 'Hostel, mess, and residential workflows', icon: Home },
    { title: 'Compare Gurukul', href: '/compare', description: 'Against Excel, WhatsApp, paper, and other software', icon: ArrowLeftRight },
    { title: 'ROI calculator', href: '/roi-calculator', description: 'What the switch saves your school', icon: Calculator },
];

// Every one of these had traffic and no nav entry before now.
const RESOURCE_LINKS: NavItem[] = [
    { title: 'Blog', href: '/blog', description: 'Guides, comparisons, and school management tips', icon: BookOpen },
    { title: 'Glossary', href: '/glossary', description: 'IEMIS, NEB, GPA, and the terms that go with them', icon: BookMarked },
    { title: 'Developer docs', href: '/developers', description: 'REST API reference for school websites', icon: Code2 },
];

// Story, people, contact. No products, no legal - those belong in the footer.
//
// Yatra sits HERE rather than at top level on purpose: it is the field programme, not something a
// school buys, and a top-level entry would put a free outreach initiative in the same rank as
// Pricing. It moves out to its own link when the programme launches formally.
const COMPANY_LINKS: NavItem[] = [
    { title: 'About Us', href: '/aboutus', description: 'Our story, mission, and team', icon: Heart },
    { title: 'Why Gurukul?', href: '/whygurukul', description: 'Why schools choose us', icon: Sparkles },
    { title: 'Gurukul Yatra', href: '/yatra', description: 'Free tech education, taught in rural districts', icon: Backpack },
    { title: 'Careers', href: '/careers', description: 'Build the platform Nepal schools run on', icon: Briefcase },
    { title: 'Contact', href: '/aboutus#contact', description: 'Talk to our team', icon: Mail },
];

/**
 * The featured guides in `NavItem` shape, for the mobile accordion - it takes `NavItem[]` and the
 * desktop panel renders guides its own way. Derived from `featuredGuides()`, never a second list of
 * slugs, so the two menus cannot drift apart.
 */
const GUIDE_LINKS: NavItem[] = featuredGuides().map((g) => ({
    title: g.title,
    href: `/guides/${g.slug}`,
    // Same as the desktop panel: audience only, and pluralised through `audienceLabel` so
    // "Anyone" and "Staff" do not become "Anyones" and "Staffs".
    description: `For ${audienceLabel(g.audience).toLowerCase()}`,
    icon: Compass,
}));

// Mobile: items with `links` render as an accordion in the sheet; items with `href` are plain links.
type MobileNavItem =
    | { name: string; href: string }
    | { name: string; links: NavItem[]; viewAll?: { name: string; href: string } };

const MOBILE_NAV: MobileNavItem[] = [
    { name: 'Product', links: [...MODULE_LINKS, ...REACH_LINKS], viewAll: { name: 'All features', href: '/features' } },
    { name: 'Solutions', links: SOLUTIONS_LINKS },
    { name: 'Pricing', href: '/pricing' },
    { name: 'Guides', links: GUIDE_LINKS, viewAll: { name: 'All guides', href: '/guides' } },
    { name: 'Resources', links: RESOURCE_LINKS },
    { name: 'Company', links: COMPANY_LINKS },
];

/**
 * ## The fused-tab navbar
 *
 * The one detail that makes this read as designed rather than assembled: when a menu opens, the
 * trigger stops looking like a button and becomes a TAB that is continuous with the panel below it.
 * Three things have to line up exactly or the illusion breaks and it just looks misaligned:
 *
 *  1. `PILL_PAD` is the pill's own padding, the tab's downward bleed, and the panel's top offset -
 *     ONE number, used three times. The tab bleeds exactly to the pill's bottom edge and the panel
 *     starts exactly there, so there is no seam and no overlap. Three hardcoded values drift; one
 *     constant cannot.
 *  2. **The button's z-index is set INLINE (`zIndex: 2`), not with a `z-*` class.** framer-motion
 *     writes its own inline z-index onto a `layoutId` element while it animates, and an inline
 *     style beats any class - so three rounds of `z-10`/`z-20`/`-z-10` all lost, the label kept
 *     disappearing, and `cursor-pointer` never fired because the tab was also eating the hover.
 *     Inline here makes it inline-vs-inline and 2 wins. The tab's own layer is pinned at
 *     `zIndex: 0`, carries `isolate` to trap whatever framer writes inside it, and is
 *     `pointer-events-none`. Do not convert any of those three back to classes.
 *  3. Tab and panel share ONE left edge, via a real `border` - never a `ring`. A ring is an outset
 *     box-shadow sitting 1px OUTSIDE the box, which put the panel's visible edge 1px left of the
 *     tab's and made the join read as a misaligned step. A border is inside the box, so both land
 *     on the same x. The panel's top-left is square (`rounded-tl-none`) so it continues that edge.
 *  4. The tab bleeds `PILL_PAD + 1`, not `PILL_PAD`. That extra pixel punches through the pill's
 *     own outset ring, which otherwise drew a line straight across the join. The navbar's outline
 *     being interrupted by the tab IS the effect.
 *  5. Pill, tab and panel all use `SURFACE` - one colour, three places. See the note on it.
 *
 * Motion: the tab carries a shared `layoutId`, so moving between menus SLIDES one tab rather than
 * cross-fading two. The panel animates its own size on a spring, so a 720px mega-menu and a 352px
 * list morph into one another instead of popping.
 */

/** Pill padding, tab bleed and panel offset are the same number. See the note above. */
const PILL_PAD = 8;

/**
 * The one surface colour, shared by the pill, the tab and the panel.
 *
 * This is a constant because the first build got it wrong in a way that looked like a rendering
 * bug: the pill was translucent (`dark:bg-neutral-900/60`) and the tab was solid
 * (`dark:bg-neutral-900`), so the tab read as a hole punched THROUGH the navbar rather than as part
 * of it. Two different values for one continuous surface can never be right, so there is now only
 * one value.
 *
 * It also means the navbar must go OPAQUE while a menu is open - a translucent pill sitting on top
 * of an opaque panel cannot look like a single sheet of paper. That is what the reference does: the
 * tab is exactly the navbar's colour, and it reads as a tab only because of the panel hanging below
 * it and the underline on the label.
 */
const SURFACE = 'bg-white dark:bg-neutral-900';

/**
 * The hairline that outlines the tab and the panel.
 *
 * Removing every outline earlier was an overcorrection. The reference does have a border - a light
 * one - and it is what makes the tab read as a TAB and the panel as a SHEET rather than two
 * shadows floating in space. What must NOT have a border is the pill, and only its bottom edge was
 * ever the problem: it drew a stripe straight across the open tab.
 *
 * So: hairline on the tab (left, top, right - never bottom, which is the seam) and around the
 * panel; nothing on the pill.
 */
const HAIRLINE = 'border-neutral-200 dark:border-neutral-700';

/**
 * Corner radius for the tab and panel - ONE value, because they are one shape.
 *
 * 10px, not the 16px (`rounded-2xl`) this started with. Two reasons, and the second is the one
 * that matters:
 *
 *  - The reference sits around 10px, and 16px reads soft and bubbly against it.
 *  - The tab's top corners and the panel's corners MUST match. They are the same sheet of paper,
 *    so a different radius on each end makes the join look like two objects that happen to touch.
 *    Deriving both from one constant is what keeps that true when someone retunes it.
 *
 * **The CARD uses it too, and that is the fix for the join Niraj flagged.** The card was
 * `rounded-xl` (12px) while the tab and panel were 10px, so the one rounded thing inside the card
 * had a slightly tighter curve than the card around it - close enough to look like a mistake
 * rather than a choice, and most visible exactly where the tab meets the panel.
 *
 * Three elements, one number. The note that used to sit here said the pill stayed `rounded-full`
 * to contrast with a squarer panel; that stopped being true when the navbar became a two-tier
 * card, and a stale reason is worse than none.
 */

/**
 * THE MARKETING NAVBAR, SHARED BY `apps/web` AND `apps/main`.
 *
 * ## Why it lives here
 *
 * It existed twice - once on the marketing site and once, forked, on the app's auth pages. The two
 * drifted: the web copy got a redesign (the serif panel heading removed, the dropdown widened to the
 * bar, the pill narrowed) and the app copy did not, so the same bar looked different depending on
 * which host you were on. Niraj: *"move the navbar that we have created on the web to the
 * packages/ui so that both the web and the main can use the same navbar."*
 *
 * A fork of a 900-line component is not a copy, it is a second component that happens to start the
 * same. This is the one component.
 *
 * ## What each app still owns
 *
 * Only the things that are genuinely different between a marketing site and an app:
 *
 *  - **`LinkComponent` + `resolveHref`** - on `apps/web` a product link is a same-origin `next/link`;
 *    on `apps/main` it has to leave the app for the marketing host, which is what `WebLink` and
 *    `webUrl()` do. The navbar does not need to know which it is.
 *  - **`actions` / `mobileActions`** - the right-hand CTA. These are deliberately NOT the same:
 *    marketing offers "Sign In" and "Book a demo"; the app's auth pages offer a theme toggle and a
 *    session-aware "Go to Dashboard", because on a sign-in page "Sign In" is advice you have already
 *    taken. Passing them in is what stops one host's copy leaking onto the other.
 *  - **`logoSrc`** - the two apps ship different-sized logo assets.
 *
 * Everything else - the menu contents, the panel, the animation, the mobile accordion - is one
 * implementation.
 */
export interface LandingNavLinkProps {
    href: string;
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    /** The top-level tabs open their panel on hover, so a host's link component must forward it. */
    onMouseEnter?: () => void;
    onFocus?: () => void;
    'aria-label'?: string;
}

export interface LandingNavbarProps {
    /** How a MARKETING destination is rendered. `next/link` on the site, `WebLink` in the app. */
    LinkComponent: React.ComponentType<LandingNavLinkProps>;
    /** Turns a marketing PATH into whatever this host needs. Defaults to leaving it alone. */
    resolveHref?: (path: string) => string;
    logoSrc: string;
    /** Desktop right-hand controls. */
    actions?: React.ReactNode;
    /** The same controls inside the mobile sheet. Falls back to `actions`. */
    mobileActions?: React.ReactNode;
}


/**
 * How a marketing link is rendered on THIS host, without threading two props through six levels.
 *
 * The default is a plain `next/link` at the path as written, which is exactly right for the
 * marketing site. `apps/main` overrides both: its links have to leave the app for the marketing
 * host, so `LinkComponent` is `WebLink` and `resolveHref` is `webUrl`.
 */
const NavLinkContext = React.createContext<{
    LinkComponent: React.ComponentType<LandingNavLinkProps>;
    resolveHref: (path: string) => string;
}>({ LinkComponent: Link as React.ComponentType<LandingNavLinkProps>, resolveHref: (p) => p });

function NavLink({ href, ...rest }: LandingNavLinkProps) {
    const { LinkComponent, resolveHref } = React.useContext(NavLinkContext);
    return <LinkComponent href={resolveHref(href)} {...rest} />;
}

const CORNER = 12;

// One row in a dropdown - minimal outline icon (no filled box), title + description.
function DropdownItem({ item, onSelect }: { item: NavItem; onSelect: () => void }) {
    const Icon = item.icon;
    return (
        <NavLink
            href={item.href}
            onClick={onSelect}
            className="group flex items-start gap-3.5 rounded-xl px-3 py-2.5 transition-colors duration-150 hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
        >
            <Icon
                className="mt-[3px] h-[18px] w-[18px] shrink-0 text-neutral-400 transition-colors duration-150 group-hover:text-neutral-900 dark:text-neutral-500 dark:group-hover:text-white"
                strokeWidth={1.75}
            />
            <div className="min-w-0">
                <p className="text-[14px] font-semibold text-neutral-900 dark:text-white">{item.title}</p>
                <p className="mt-0.5 text-[12.5px] leading-snug text-neutral-500 dark:text-neutral-400">{item.description}</p>
            </div>
        </NavLink>
    );
}

function ProductDropdown({ onSelect }: { onSelect: () => void }) {
    return (
        // The heading band is a SIBLING of the body, not padded inside it, so its rule spans the
        // full panel width including the side column - matching the reference.
        //
        // `wide` is the compact navbar's full-bleed mode: the panel IS the navbar, so it takes the
        // navbar's width instead of its own, and the italic heading band goes. That band existed to
        // name a floating panel; when the panel is attached to the bar the tab above it already says
        // which menu is open, and the column headings say the rest.
        <div className="w-full">
            <div className="flex">
                <div className="flex-1 p-3">
                    <div className="grid grid-cols-2 gap-x-2">
                        {MODULE_COLUMNS.map((col) => (
                            <div key={col.heading}>
                                <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400 dark:text-neutral-500">
                                    {col.heading}
                                </p>
                                <div className="flex flex-col">
                                    {col.items.map(item => <DropdownItem key={item.href} item={item} onSelect={onSelect} />)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className={cn('flex w-[236px] shrink-0 flex-col gap-3 border-l p-3', HAIRLINE)}>
                    <div>
                        <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400 dark:text-neutral-500">
                            Reach families
                        </p>
                        {REACH_LINKS.map(item => <DropdownItem key={item.href} item={item} onSelect={onSelect} />)}
                    </div>
                    <div className="mt-auto flex flex-col gap-2.5 px-1 pb-1">
                        <NavLink
                            href="/features"
                            onClick={onSelect}
                            className={cn(
                                'group flex items-center justify-between gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-medium text-neutral-700 transition-colors duration-150 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800',
                                HAIRLINE,
                            )}
                        >
                            View all features
                            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                        </NavLink>
                        <NavLink
                            href="/demo"
                            onClick={onSelect}
                            className="group flex items-center justify-between gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-[13px] font-semibold text-white transition-colors duration-150 hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
                        >
                            Book a free demo
                            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                        </NavLink>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * The picture beside a menu's links. Keyed by the menu's HEADING, not its tab name, because the
 * heading is what `SimplePanel` already receives.
 */
const PANEL_ART: Record<string, string> = {
    'Find your fit': '/images/hero/school-signboard-448.webp',
    Learn: '/images/hero/library-shelf-448.webp',
    Company: '/images/hero/team-desk-448.webp',
};

/**
 * Every non-mega menu, from one component.
 *
 * Solutions, Resources and Company were three near-identical functions that had already drifted
 * apart in padding and heading style. One component means a change to the panel is a change to all
 * of them, which is the only way three menus stay looking like one system.
 */
function SimplePanel({ heading, links, onSelect }: { heading: string; links: NavItem[]; onSelect: () => void }) {
    const art = PANEL_ART[heading];
    return (
        <div className="w-full">
            <p className="px-6 pt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400 dark:text-neutral-500">{heading}</p>
            <div className="flex">
                <div className="flex min-w-0 flex-1 flex-col p-3">
                    {links.map(item => <DropdownItem key={item.href} item={item} onSelect={onSelect} />)}
                </div>
                {art && (
                    /* `aria-hidden` and an empty alt: it illustrates the panel and names nothing
                       the links do not already say, so announcing it would only put noise between
                       a heading and the list it belongs to.

                       Bigger in `wide` mode - 228x172 was sized for a 620px floating card, and at
                       the full width of the navbar the same picture reads as a thumbnail someone
                       forgot to finish. 360x260 is roughly a third of the panel, which is the
                       proportion the reference gives its own art. */
                    <div className="w-[360px] shrink-0 p-3 pl-0">
                        <div className="relative h-full min-h-[260px] overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800">
                            <Image src={art} alt="" aria-hidden fill sizes="360px" className="object-cover" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Menus whose panel hangs from the tab's RIGHT edge instead of its left.
 *
 * The two-tier row spreads six items across the full `max-w-6xl` (1152px), which puts the last two
 * close enough to the page edge that a left-anchored panel runs off it. The arithmetic, at 192px
 * per item:
 *
 * ```
 *   Product    left    0 + 760 =  760   fits
 *   Solutions  left  192 + 620 =  812   fits
 *   Guides     left  576 + 420 =  996   fits
 *   Resources  left  768 + 620 = 1388   OVERFLOWS
 *   Company    left  960 + 620 = 1580   OVERFLOWS
 * ```
 *
 * The fix is not to abandon the fused tab, it is to MIRROR it. The effect is that the tab and its
 * panel share one continuous edge - WHICH edge is shared does not matter, only that one is. So a
 * right-aligned panel anchors `right-0` and squares its top-RIGHT corner, exactly as a left-aligned
 * one anchors `left-0` and squares its top-left.
 *
 * A constant rather than a measurement. A `ResizeObserver` feeding a layout decision is the pattern
 * the Deck panels explicitly avoid, for the same reason: the observed element's size becomes its
 * own input.
 */
// Product first, Pricing a direct link - both patterns hold across Veda, Fedena and PowerSchool.
/*
 * THE nav items. Five, and there is no second set.
 *
 * It was six with five dropdowns, then briefly two sets behind a `variant` prop while the shorter
 * bar was judged at /v2. That route is merged and gone, so the prop went with it - and it had
 * already caused exactly the bug it invites: `SiteChrome` defaulted to the OLD set, and only the
 * homepage passed the prop, so every other page on the site silently kept the six-item bar.
 *
 * One set, no prop, no default to forget. Guides live under Resources; nothing was lost, only
 * re-parented.
 */
const NAV_ITEMS: { name: string; href?: string }[] = [
    { name: 'Product' },
    { name: 'Solutions' },
    { name: 'Pricing', href: '/pricing' },
    { name: 'Resources' },
    { name: 'Company' },
];

export function LandingNavbar({
    LinkComponent,
    resolveHref = (path) => path,
    logoSrc,
    actions,
    mobileActions,
}: LandingNavbarProps) {
    const [scrolled, setScrolled] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    /*
     * Hide on scroll down, reveal on the smallest scroll up.
     *
     * `hold` is the important argument: an open dropdown or an open mobile sheet pins the header
     * visible. Without it the header can slide away while a panel is open, leaving the panel
     * floating over the page attached to nothing.
     *
     * The hook's ref lands on the same <header> the outside-click handler needs, so it is reused
     * rather than adding a second ref to one element.
     */
    const { ref: navRef, hidden: autoCollapsed } = useAutoHideHeader<HTMLElement>({
        hold: openMenu !== null || menuOpen,
    });

    /*
     * The LINKS ROW folds on scroll down; the top tier never leaves.
     *
     * This replaces hiding the whole navbar, and the difference is which half you give up. Hiding
     * everything put Book Free Demo off-screen for the entire time somebody was reading - the CTA
     * is the wrong half to lose. Now the brand and both actions stay reachable at every scroll
     * position and only the navigation folds away.
     *
     */
    /*
     * No chevron. It was a 20px band under the top tier at every scroll position, which is a lot
     * of permanent chrome to carry for an affordance most people never press - and on a bar this
     * quiet it read as an artefact rather than a control.
     *
     * The cost is real and accepted: the links now come back ONLY by scrolling up. That is the
     * same gesture the navbar used for reveal before this redesign, so it is a gesture people
     * already have, and a small scroll up is enough.
     */
    const collapsed = autoCollapsed;

    /*
     * CLIP ONLY WHILE THE ROW IS MOVING.
     *
     * Folding a row needs `overflow: hidden` or the links squash instead of sliding out of view.
     * But this file's oldest rule is that the open TAB bleeds `PILL_PAD + 1` past the card's bottom
     * edge to meet its panel, and a clip anywhere on that path severs the join - which is the whole
     * fused-tab effect, and the thing that took three attempts to get right.
     *
     * So the row clips while it animates and goes back to `visible` once it has settled open. A
     * menu cannot be open while collapsing anyway - `hold` pins the row - so the two states never
     * need to be true at once.
     */



    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // Close the mobile menu when clicking anywhere outside the navbar (the panel is a child of
    // the header, so clicks inside it don't count as "outside").
    useEffect(() => {
        if (!menuOpen) return;
        const onDown = (e: MouseEvent) => {
            if (navRef.current && !navRef.current.contains(e.target as Node)) setMenuOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
        // `navRef` is a stable ref object from useAutoHideHeader; listing it costs nothing.
    }, [menuOpen, navRef]);

    // Escape closes an open dropdown. A hover menu with no keyboard exit is a trap for anyone
    // navigating without a mouse.
    useEffect(() => {
        if (!openMenu) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenMenu(null); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [openMenu]);

    const handleEnter = (name: string) => {
        if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
        }
        setOpenMenu(name);
    };
    // A short grace period, so crossing the gap between the tab and the panel does not close it.
    const handleLeave = () => {
        closeTimeoutRef.current = setTimeout(() => setOpenMenu(null), 120);
    };
    const closeDropdown = () => setOpenMenu(null);

    // Drives the pill's opaque state - see the SURFACE note.
    const isAnyOpen = openMenu !== null && openMenu !== '';

    const renderDropdown = (name: string) => {
        if (name === 'Product') return <ProductDropdown onSelect={closeDropdown} />;
        if (name === 'Solutions') return <SimplePanel heading="Find your fit" links={SOLUTIONS_LINKS} onSelect={closeDropdown} />;
        if (name === 'Resources') {
            // The compact bar has no Guides tab, so Resources carries them. Capped at four: the full
            // list is six, and a column twice the height of the art beside it reads as a mistake.
            const links = [...RESOURCE_LINKS, ...GUIDE_LINKS.slice(0, 4)];
            return <SimplePanel heading="Learn" links={links} onSelect={closeDropdown} />;
        }
        if (name === 'Company') return <SimplePanel heading="Company" links={COMPANY_LINKS} onSelect={closeDropdown} />;
        return null;
    };

    /*
     * Built ONCE, here, rather than inside the JSX.
     *
     * The attached panel is needed twice down there - as the condition and as the child - and
     * calling `renderDropdown` in both places builds the whole element tree twice on every render
     * just to ask whether it would be null. `Pricing` is a plain link with no panel, so the null
     * case is real and has to be tested.
     */
    const attachedPanel = openMenu ? renderDropdown(openMenu) : null;

    // Memoised: the two values are stable for the life of the host, and a fresh object
    // on every render would re-render every consumer of the context for nothing.
    const linkCtx = React.useMemo(
        () => ({ LinkComponent, resolveHref }),
        [LinkComponent, resolveHref],
    );

    return (
        <NavLinkContext.Provider value={linkCtx}>
        <header
            ref={navRef}
            // z-40 keeps the navbar above page content but BELOW the modal layer (Sheet/Dialog
            // overlay + content are z-50), so sheets/dialogs render over the navbar. Do not raise
            // this to z-50+ or modals will open underneath it again.
            //
            // `will-change-transform` because this element translates on almost every scroll - it
            // asks the compositor for its own layer up front instead of promoting mid-gesture.
            className={cn(
                'fixed inset-x-0 top-3 z-40 px-3 will-change-transform',
                'motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]',
            )}
            style={{
                /*
                 * A TRANSFORM, never `top` or `height`. Translating is a compositor operation that
                 * touches nothing else on the page; animating `top` on a fixed element relayouts
                 * every frame of every scroll, which is the whole cost this was meant to avoid.
                 *
                 * `-100% - 16px` clears the element's own height AND the 12px `top-3` gap, with a
                 * little over, so no shadow edge stays visible along the top of the viewport.
                 *
                 * `--gk-announce-push` is what keeps this clear of the announcement bar. The bar is
                 * in normal FLOW so it scrolls away with the page, but this navbar is `fixed` and
                 * would otherwise paint straight over it at the top of the page. The variable holds
                 * `max(0, barHeight - scrollY)`, so the navbar starts pushed down by the full bar
                 * and settles back to its own `top-3` exactly as the bar leaves. It is unset when
                 * there is no bar, and the fallback makes that the no-op.
                 *
                 * Making the navbar `sticky` instead would be simpler and is WRONG here: sticky
                 * sits in flow, so it would push the hero down by the navbar's height on top of the
                 * `pt-[max(var(--gk-nav-h),8vh)]` the hero already pays to clear a floating navbar.
                 *
                 * Both offsets compose into ONE transform. Two transforms on one element means the
                 * second silently replaces the first.
                 */
                /*
                 * ONE transform, composing BOTH offsets - the comment above is not decorative.
                 * Writing a second `transform` on this element would silently replace the first,
                 * and the announcement-bar offset would stop working the moment the bar hid.
                 *
                 * `-100% - 16px` clears the bar's own height AND the 12px `top-3` gap, with a
                 * little over so no shadow edge stays visible along the top of the viewport.
                 */
                transform: collapsed
                    ? 'translateY(calc(var(--gk-announce-push, 0px) - 100% - 16px))'
                    : 'translateY(var(--gk-announce-push, 0px))',
            }}
        >
            <div className={cn(
                'relative mx-auto flex items-center justify-center',
                // This was `max-w-5xl`, on the reasoning that four items instead of six left the
                // room. It does not: the app's auth bar carries a 64px theme toggle and TWO
                // buttons beside the same six tabs, and at 1024px the CTA had so little left that
                // "Get Started" wrapped onto two lines inside its own pill. 1152px is what the
                // two-tier row already used. Since the panel now IS the navbar, this number also
                // sets the dropdown's width.
                'max-w-6xl',
            )}>
                {/* The pill. `overflow-visible` is load-bearing - the open tab bleeds past its
                    bottom edge to meet the panel, and a clip here severs the join. */}
                <div
                    className={cn(
                        // `w-full` at every size, bounded by the wrapper's `max-w-6xl`. It was
                        // `lg:w-auto`, which made the pill hug its content and ignore that bound
                        // entirely - so the max-width did nothing on desktop.
                        'relative flex w-full flex-col backdrop-blur-xl backdrop-saturate-150',
                        'transition-[background-color,box-shadow] duration-300',
                        // NO ring or border. Depth comes from the shadow alone - an outline here read
                        // as a hard line boxing the navbar in, and it was also the thing drawing a
                        // stripe across the open tab. The reference has no visible border either.
                        // Opaque whenever a menu is open, so pill, tab and panel are one continuous
                        // sheet. Translucent otherwise, so the navbar still floats over the hero.
                        // The RESTING state is nearly as light as the scrolled one, and that is a
                        // correction rather than a preference. It was `bg-white/70`, which over the
                        // dark hero on /blog composited to a flat mid-grey - the bar read as
                        // disabled, and the site is light-mode only, so there is no dark ground
                        // where 70% would have looked right. 92% keeps the glass (the hero's grain
                        // still shows through) while reading as white rather than grey.
                        //
                        // Scrolled goes to 97% rather than staying at 90%: the two states still have
                        // to be TELLABLE APART, and once resting is 92% the difference has to come
                        // from somewhere. Most of it is now the shadow, which is the honest signal
                        // anyway - lifting off the page, not changing colour.
                        isAnyOpen
                            ? cn(SURFACE, 'shadow-[0_12px_44px_-14px_rgba(0,0,0,0.26)]')
                            : scrolled
                                ? 'bg-white/97 shadow-[0_12px_44px_-12px_rgba(0,0,0,0.22)] dark:bg-neutral-900/95'
                                : 'bg-white/92 shadow-[0_6px_28px_-14px_rgba(0,0,0,0.14)] dark:bg-neutral-900/80',
                    )}
                    /*
                     * THE CLOSE HANDLER BELONGS HERE, ON THE WHOLE PILL.
                     *
                     * It used to live only on the <nav> that holds the tabs. In the full variant the
                     * panel is a CHILD of that nav, so leaving it fired the handler. In the compact
                     * variant the panel is a SIBLING of the row - so moving from a tab down into the
                     * panel left the nav (scheduling a close), the panel's own `onMouseEnter`
                     * cancelled it, and then leaving the panel downward fired NOTHING. The menu
                     * stayed open with the cursor off the screen entirely.
                     *
                     * On the pill it covers both: moving between the row and the panel never leaves
                     * this element, and leaving the navbar in any direction closes.
                     */
                    onMouseLeave={handleLeave}
                    // Radius from CORNER, the same number the tab and the panel use - see the note
                    // on it. A class here would be a fourth place to keep in step.
                    style={{ padding: PILL_PAD, borderRadius: CORNER }}
                >
                    {/* ── TIER 1: mark left, name centred, actions right.
                        The mark and the word are SEPARATED on purpose. That is the shape of the
                        reference, and the centred name is what makes the bar read as institutional
                        rather than as a toolbar; the mark is distinctive enough to hold the left on
                        its own. `relative` is what the absolutely-centred name centres against. */}
                    <div className="relative flex w-full items-center">
                    {/* THE LEFT TRACK. `flex-1 basis-0` here and the SAME on the actions track is
                        what centres the links - see the note on them. */}
                    <div className="flex flex-1 basis-0 items-center">
                    <NavLink href="/" aria-label="Gurukul - home" className="flex shrink-0 items-center gap-2.5 rounded-full px-2.5 py-1.5">
                        {/* rounded-md, NOT rounded-full. The logo artwork is a square tile whose mark fills
                            89.5% of its height, so a circular mask clips the top and bottom of the mark and
                            the 32px navbar badge turns into an unreadable smear. Matches the footer. */}
                        {/* Mark AND word, as one lockup on the left.
                            The word used to be a separate `absolute left-1/2` span centred on the
                            card. The LINKS hold that centre now, so the two would sit on top of
                            each other - and a logo reads as a logo beside its mark, where a
                            centred word read as a page title. */}
                        <Image src={logoSrc} alt="" aria-hidden width={30} height={30} className="rounded-md object-contain" priority />
                        <span className="hidden text-[17px] font-bold tracking-tight text-neutral-900 sm:inline dark:text-white">
                            Gurukul
                        </span>
                    </NavLink>
                    </div>

                        {/*
                          THE LINKS, centred in the same row - as a REAL flex child, not an overlay.
                          This used to be `absolute left-1/2 -translate-x-1/2`, on the reasoning that
                          the logo and the actions are different widths so a flex-centred group would
                          sit off-centre by half that difference. The reasoning was right; the fix
                          was not, because an absolutely-positioned element reserves NO space. With
                          the marketing site's narrow CTA nothing collided and it looked fine - but
                          the app's auth bar carries a 64px theme toggle plus two buttons, and the
                          theme toggle landed directly on top of the word "Company".

                          The three-track version gets the centring AND the safety. The left and
                          right tracks are both `flex-1 basis-0`, so they are handed EQUAL widths out
                          of whatever this middle group leaves - which puts the middle at the card's
                          true centre, exactly what the overlay was for. And because all three are
                          real flex children, a wide CTA can no longer be drawn over the links: once
                          the actions need more than their half, both tracks resolve to their content
                          and the links shift instead of being covered. Off-centre by a few pixels is
                          a compromise; a control sitting on a label is a bug.

                          `shrink-0` keeps the links at their natural width, so the pressure lands on
                          the tracks either side rather than squeezing six tabs into five.
                        */}
                        <div className="hidden shrink-0 lg:block">
                            <div>
                            <nav className="relative hidden items-stretch lg:flex" onMouseLeave={handleLeave}>
                            {NAV_ITEMS.map((item, i) => {
                                const isOpen = openMenu === item.name;
                                // No divider on the first item, on the open one, or on the one
                                // immediately after it - those last two are where it would collide
                                // with the tab's own border.
                                const prevOpen = i > 0 && openMenu === NAV_ITEMS[i - 1]?.name;
                                // No dividers in the one-row bar. They framed a FULL-WIDTH tier where
                                // each item owned an equal share; around a compact centred group the
                                // same lines read as clutter and fight the open tab's own border.
                                // `prevOpen` is kept because the tab-join logic below still reads it.
                                void prevOpen;
                                const divider = '';

                                if (item.href) {
                                    return (
                                        <NavLink
                                            key={item.name}
                                            href={item.href}
                                            onMouseEnter={() => handleEnter('')}
                                            className={cn(
                                                'relative z-30 inline-flex items-center justify-center px-3.5 py-2 text-[14px] font-medium text-neutral-600 transition-colors duration-150 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white',
                                                divider,
                                            )}
                                        >
                                            {item.name}
                                        </NavLink>
                                    );
                                }

                                return (
                                    <div key={item.name} className={cn('relative flex', divider)} onMouseEnter={() => handleEnter(item.name)}>
                                        {/*
                                          THE TAB LAYER - and the two properties on it are the whole fix.
                                          This went wrong three times, always the same way: the label
                                          disappeared and the button stopped showing a pointer cursor.

                                          Both symptoms had ONE cause - the tab was sitting on top of the
                                          button and swallowing it. Fighting that with z-index classes did
                                          not work, because framer-motion writes its OWN inline z-index onto
                                          a `layoutId` element while it animates, and an inline style beats
                                          every class.

                                          So this stops fighting and removes the possibility instead:

                                            - `isolate` makes this wrapper a stacking context, which TRAPS
                                              whatever z-index framer writes inside it. It can no longer
                                              promote the tab above the button, because it cannot escape.
                                            - The wrapper carries no z-index of its own, so the button -
                                              which comes LATER in the DOM - always paints above it.
                                            - `pointer-events-none` is what restores the pointer cursor.
                                              An overlay covering the button eats the hover, so the cursor
                                              never changed even though the button had `cursor-pointer` all
                                              along. The class was never the problem.
                                        */}
                                        <div className="pointer-events-none absolute inset-0 isolate" style={{ zIndex: 0 }}>
                                            <AnimatePresence>
                                                {isOpen && (
                                                    <motion.span
                                                        layoutId="nav-tab"
                                                        aria-hidden
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        exit={{ opacity: 0, transition: { duration: 0.12 } }}
                                                        transition={{ type: 'spring', stiffness: 480, damping: 40, mass: 0.7 }}
                                                        className={cn(
                                                            'absolute inset-x-0 top-0',
                                                            SURFACE,
                                                            // Colour only. The WIDTH is set inline below.
                                                            HAIRLINE,
                                                        )}
                                                        style={{
                                                            // Border width and style are INLINE, not
                                                            // `border-t`/`border-l` classes. Those classes
                                                            // survive `cn()` intact (verified) yet painted
                                                            // nothing, so something between the scanner and
                                                            // the stylesheet was eating them. An inline width
                                                            // cannot be dropped by a class pipeline at all.
                                                            // Colour stays a class so it still follows the
                                                            // light/dark theme.
                                                            borderStyle: 'solid',
                                                            borderTopWidth: 1,
                                                            borderLeftWidth: 1,
                                                            borderRightWidth: 1,
                                                            // Never a bottom border - that edge is the seam.
                                                            borderBottomWidth: 0,
                                                            // PILL_PAD + 1: the extra pixel punches through
                                                            // the pill's bottom edge so nothing draws a line
                                                            // across the join. The navbar's edge being
                                                            // interrupted by the tab IS the effect.
                                                            bottom: -(PILL_PAD + 1),
                                                            borderTopLeftRadius: CORNER,
                                                            borderTopRightRadius: CORNER,
                                                        }}
                                                    />
                                                )}
                                            </AnimatePresence>
                                        </div>

                                        <button
                                            type="button"
                                            aria-expanded={isOpen}
                                            aria-haspopup="true"
                                            onClick={() => setOpenMenu(isOpen ? null : item.name)}
                                            // INLINE z-index, deliberately, not a `z-*` class. framer-motion
                                            // writes its own inline z-index onto the `layoutId` tab while it
                                            // animates, and an inline style beats any class - which is why
                                            // three rounds of `z-10`/`z-20`/`-z-10` classes all lost and the
                                            // label kept disappearing. Inline here means the comparison is
                                            // inline-vs-inline, and 2 wins outright.
                                            style={{ zIndex: 2 }}
                                            className={cn(
                                                'relative inline-flex w-full cursor-pointer items-center justify-center gap-1.5 px-4 py-2.5 text-[15px] font-medium transition-colors duration-150',
                                                isOpen ? 'text-neutral-900 dark:text-white' : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white',
                                            )}
                                        >
                                            <span className="relative">
                                                {item.name}
                                                {/* The underline under an open label, drawn only as wide as the
                                                    word. Animated on scaleX so it wipes out from the centre. */}
                                                <motion.span
                                                    aria-hidden
                                                    className="absolute -bottom-1 left-0 h-[1.5px] w-full origin-center rounded-full bg-neutral-900 dark:bg-white"
                                                    initial={false}
                                                    animate={{ scaleX: isOpen ? 1 : 0, opacity: isOpen ? 1 : 0 }}
                                                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                                />
                                            </span>
                                            <ChevronDown
                                                className={cn('h-3.5 w-3.5 transition-transform duration-300', isOpen ? 'rotate-180 opacity-90' : 'rotate-0 opacity-50')}
                                            />
                                        </button>


                                    </div>
                                );
                            })}
                        </nav>
                            </div>
                        </div>

                        {/* THE RIGHT TRACK. `flex-1 basis-0` mirrors the left one - that pair is
                            what holds the links at the card's centre. `justify-end` replaces the
                            `ml-auto` this used to lean on, which only worked while the middle group
                            was an overlay taking up no space. */}
                        <div className="flex flex-1 basis-0 items-center justify-end gap-1.5">
                            {/* No ThemeToggle. The marketing site is forced light - a control that
                                cannot change anything is worse than no control, because it reads as
                                broken rather than absent. */}
                            {/* THE HOST'S CTA. Marketing offers "Sign In" and a demo; the app's auth
                                pages offer a theme toggle and a session-aware Dashboard button,
                                because on a sign-in page "Sign In" is advice already taken. */}
                            {actions}
                            <button
                                onClick={() => setMenuOpen(v => !v)}
                                aria-label="Toggle menu"
                                aria-expanded={menuOpen}
                                className="cursor-pointer rounded-full p-2 text-neutral-800 lg:hidden dark:text-neutral-200"
                            >
                                {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                            </button>
                        </div>
                    </div>

                    {/*
                        THE ATTACHED PANEL - the compact bar's whole dropdown, and the shape Niraj
                        asked for from speko.ai: *"it should open as the whole navbar itself, and the
                        curve design should be according to the navbar itself, matching both sides."*

                        It is a SIBLING of the nav row inside the pill, which is already `flex-col`,
                        so the pill simply grows downward and bar and panel are literally one surface
                        - no anchoring, no shared-corner arithmetic, no join to keep aligned. The
                        floating per-tab panel above is skipped entirely in this variant.

                        The negative margins cancel the pill's own `PILL_PAD` so the hairline runs
                        edge to edge rather than being inset by 8px on each side, and the bottom
                        corners repeat `CORNER` so the expanded card keeps the pill's radius on all
                        four corners.

                        Height animates rather than the panel fading in place: the bar is GROWING,
                        and a panel that appears at full height with the bar already expanded reads
                        as two separate things happening.
                    */}
                    {(
                        <AnimatePresence initial={false}>
                            {attachedPanel && openMenu && (
                                <motion.div
                                    key={openMenu}
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ type: 'spring', stiffness: 380, damping: 36, mass: 0.7, opacity: { duration: 0.16 } }}
                                    onMouseEnter={() => handleEnter(openMenu)}
                                    className={cn('overflow-hidden', HAIRLINE)}
                                    style={{
                                        marginLeft: -PILL_PAD,
                                        marginRight: -PILL_PAD,
                                        marginBottom: -PILL_PAD,
                                        marginTop: PILL_PAD,
                                        borderStyle: 'solid',
                                        borderTopWidth: 1,
                                        borderBottomLeftRadius: CORNER,
                                        borderBottomRightRadius: CORNER,
                                    }}
                                >
                                    {attachedPanel}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    )}


                </div>

                <AnimatePresence>
                    {menuOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.18, ease: 'easeOut' }}
                            className="absolute inset-x-0 top-[calc(100%+8px)] z-[90] overflow-hidden rounded-2xl bg-white shadow-[0_24px_64px_-16px_rgba(0,0,0,0.28)] ring-1 ring-neutral-200 lg:hidden dark:bg-neutral-950 dark:ring-neutral-800"
                        >
                            <div className="max-h-[calc(100dvh-5.5rem)] overflow-y-auto px-4 pt-3 pb-4">
                                {/* type="single" → only one section is open at a time. */}
                                <Accordion type="single" collapsible className="w-full">
                                    {MOBILE_NAV.map(item => (
                                        'links' in item ? (
                                            <AccordionItem key={item.name} value={item.name} className="rounded-none border-b border-neutral-200 bg-transparent dark:border-neutral-800">
                                                <AccordionTrigger className="py-3.5 text-[15px] font-medium text-neutral-900 hover:no-underline dark:text-white">
                                                    {item.name}
                                                </AccordionTrigger>
                                                <AccordionContent>
                                                    <div className="flex flex-col gap-0.5 pb-2">
                                                        {item.links.map(l => {
                                                            const Icon = l.icon;
                                                            return (
                                                                <NavLink
                                                                    key={l.href}
                                                                    href={l.href}
                                                                    onClick={() => setMenuOpen(false)}
                                                                    className="flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-[14px] text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800/60"
                                                                >
                                                                    <Icon className="h-[17px] w-[17px] shrink-0 text-neutral-500 dark:text-neutral-400" strokeWidth={1.75} />
                                                                    {l.title}
                                                                </NavLink>
                                                            );
                                                        })}
                                                        {item.viewAll && (
                                                            <NavLink
                                                                href={item.viewAll.href}
                                                                onClick={() => setMenuOpen(false)}
                                                                className="mt-0.5 flex items-center gap-2 rounded-lg px-2.5 py-2.5 text-[14px] font-medium text-neutral-900 hover:bg-neutral-100 dark:text-white dark:hover:bg-neutral-800/60"
                                                            >
                                                                {item.viewAll.name}
                                                                <ArrowRight className="h-3.5 w-3.5 text-neutral-400" />
                                                            </NavLink>
                                                        )}
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        ) : (
                                            <NavLink
                                                key={item.name}
                                                href={item.href}
                                                onClick={() => setMenuOpen(false)}
                                                className="flex items-center border-b border-neutral-200 py-3.5 text-[15px] font-medium text-neutral-900 dark:border-neutral-800 dark:text-white"
                                            >
                                                {item.name}
                                            </NavLink>
                                        )
                                    ))}
                                </Accordion>
                                <div className="mt-3 flex flex-col gap-2.5 border-t border-neutral-200 pt-4 dark:border-neutral-800">
                                    {/* The host's CTA again - see the desktop slot. Falls back to the
                                        same nodes when a host has nothing mobile-specific to say. */}
                                    {mobileActions ?? actions}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </header>
        </NavLinkContext.Provider>
    );
}

export { LandingNavbar as LandingPageNavbar };
