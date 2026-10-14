import type { CSSProperties } from 'react'

/**
 * VIDYA AND FRIENDS - SVG stand-ins. SHARED: the public site (apps/shishya) and the portal
 * (apps/shishya-main) both import this file, so a change to Vidya lands on both at once. The keyframes
 * it needs are `@repo/ui/styles/characters.css`; import that once per app.
 *
 * The five characters of the playful surface, drawn as inline SVG so the layout can be reviewed
 * before any final art exists. The plan (playful-redesign-03.md, task 1.2) generates them as 3D
 * renders and drops the WebPs into these same slots; each component keeps its size props, so the
 * swap is a change inside this file and nowhere else.
 *
 * One `<CharacterDefs />` renders the gradients and the bodies once per page. Every character is
 * then a `<use href="#...">`, which keeps a page with fifteen characters on it small.
 *
 * All five share ONE face - two tall oval eyes set wide apart, one highlight each, a small smile,
 * pink blush - because a shared face is what makes five objects read as one cast.
 *
 * The cast, and who owns what:
 *   Vidya  - the tutor. An open book resting on two closed ones. The guide on every page.
 *   Kapi   - the exercise copy (notebook). Reading Coach, notes.
 *   Sisa   - the pencil. School online exams.
 *   Rabar  - the eraser. Practice quizzes: get it wrong, rub it out, go again.
 *   Jahaj  - the paper plane. Exam planner: the route to the date.
 *   Student - the kid the page is for. Flat vector, cream shirt and amber vest, same face.
 *
 * Colour: the characters are illustrations, not UI, so Vidya runs butter -> amber with brass feet
 * and her books are butter and peach. Nothing here is blue or purple.
 */

export type Mood = 'smile' | 'happy' | 'think'
export type Motion = 'float' | 'wiggle' | 'drift' | 'none'

const FACE: Record<Mood, string> = { smile: '#pl-fSmile', happy: '#pl-fHappy', think: '#pl-fThink' }
const MOTION: Record<Motion, string> = { float: 'pl-float', wiggle: 'pl-wiggle', drift: 'pl-drift', none: '' }

function Stop({ offset, color }: { offset: number; color: string }) {
    return <stop offset={offset} stopColor={color} />
}

const EYE = { fill: '#2A1A12' }
const HIGHLIGHT = { fill: '#ffffff' }
const BLUSH = { fill: '#FF6F86', opacity: 0.42 }
const LIMB = { fill: 'none', stroke: '#2A1A12', strokeWidth: 5, strokeLinecap: 'round' as const }

/** Render ONCE per page, anywhere in the tree, before or after the characters. */
export function CharacterDefs() {
    return (
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
            <defs>
                <radialGradient id="pl-gCore" cx="50%" cy="70%" r="70%">
                    <Stop offset={0} color="#FFFDF0" /><Stop offset={1} color="#FFE28A" />
                </radialGradient>
                <linearGradient id="pl-gBrass" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset={0} color="#E8C878" /><Stop offset={0.55} color="#C9A961" /><Stop offset={1} color="#A87F1F" />
                </linearGradient>
                <linearGradient id="pl-gButter" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset={0} color="#FFF3C4" /><Stop offset={1} color="#FFD45C" />
                </linearGradient>
                <linearGradient id="pl-gRose" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset={0} color="#FFC2CF" /><Stop offset={1} color="#FF7F9C" />
                </linearGradient>
                <linearGradient id="pl-gAmber" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset={0} color="#FFDD8C" /><Stop offset={0.5} color="#FFC24D" /><Stop offset={1} color="#F2A531" />
                </linearGradient>
                <linearGradient id="pl-gPaper" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset={0} color="#FFFFFF" /><Stop offset={1} color="#F3E8D4" />
                </linearGradient>
                <radialGradient id="pl-gGlow" cx="50%" cy="55%" r="50%">
                    <stop offset={0} stopColor="#FFE28A" stopOpacity={0.7} /><stop offset={0.6} stopColor="#FFD25E" stopOpacity={0.18} /><stop offset={1} stopColor="#FFD25E" stopOpacity={0} />
                </radialGradient>

                {/* The one face, three moods. Origin is between the eyes. */}
                <g id="pl-fSmile">
                    <ellipse cx="-22" cy="0" rx="7.5" ry="10.5" {...EYE} /><circle cx="-24.5" cy="-4" r="2.8" {...HIGHLIGHT} />
                    <ellipse cx="22" cy="0" rx="7.5" ry="10.5" {...EYE} /><circle cx="19.5" cy="-4" r="2.8" {...HIGHLIGHT} />
                    <path d="M-10 15 Q0 25 10 15" fill="none" stroke="#2A1A12" strokeWidth="3.6" strokeLinecap="round" />
                    <ellipse cx="-41" cy="15" rx="10" ry="6.5" {...BLUSH} /><ellipse cx="41" cy="15" rx="10" ry="6.5" {...BLUSH} />
                </g>
                <g id="pl-fHappy">
                    <path d="M-31 3 Q-22 -11 -13 3" fill="none" stroke="#2A1A12" strokeWidth="4" strokeLinecap="round" />
                    <path d="M13 3 Q22 -11 31 3" fill="none" stroke="#2A1A12" strokeWidth="4" strokeLinecap="round" />
                    <path d="M-11 13 Q0 33 11 13 Z" fill="#2A1A12" /><path d="M-5 22 Q0 27 5 22 Q0 19 -5 22 Z" fill="#FF6F86" />
                    <ellipse cx="-41" cy="15" rx="10" ry="6.5" fill="#FF6F86" opacity={0.5} /><ellipse cx="41" cy="15" rx="10" ry="6.5" fill="#FF6F86" opacity={0.5} />
                </g>
                <g id="pl-fThink">
                    <ellipse cx="-22" cy="0" rx="7.5" ry="10.5" {...EYE} /><circle cx="-19" cy="-5" r="2.8" {...HIGHLIGHT} />
                    <ellipse cx="22" cy="0" rx="7.5" ry="10.5" {...EYE} /><circle cx="25" cy="-5" r="2.8" {...HIGHLIGHT} />
                    <ellipse cx="6" cy="19" rx="4.5" ry="5" {...EYE} />
                    <ellipse cx="-41" cy="15" rx="10" ry="6.5" {...BLUSH} /><ellipse cx="41" cy="15" rx="10" ry="6.5" {...BLUSH} />
                </g>
                <g id="pl-spark">
                    <path d="M0 -10 C1 -3 3 -1 10 0 C3 1 1 3 0 10 C-1 3 -3 1 -10 0 C-3 -1 -1 -3 0 -10 Z" fill="#E8B948" />
                </g>

                {/*
                  * Vidya: an OPEN BOOK, resting on her two closed ones. 200 wide, book 96-232.
                  *
                  * ## Her third shape, and why this one is right
                  *
                  * She was a flame until 2026-09-29, then an owl until 2026-10-12. The flame was
                  * rejected because every other character is a thing from a school and she was an
                  * abstraction among them; the owl fixed that by being ALIVE among objects, which
                  * sounded right and was not - it made her a mascot standing beside the cast rather
                  * than a member of it. Niraj, looking at the group render: *"I want something like
                  * this"*, pointing at the copy, the eraser and the pencil.
                  *
                  * So she is an object with a job, like the rest. An open book is the most direct
                  * reading of her name - vidya IS knowledge - and it pairs with Kapi rather than
                  * competing: Kapi is the copy you WRITE in, Vidya is the book you LEARN from.
                  *
                  * ## What makes it read at 18px, which is the real constraint
                  *
                  * `VidyaMark` is the chat avatar and the wordmark at 18 to 26px - about 15px of
                  * drawing. The silhouette is TWO SPLAYED LEAVES over ONE WIDE COVER: wide-and-low,
                  * which nothing else in the cast is (Kapi is a tall slab, Sisa a thin stick). The
                  * two leaf tips breaking the top outline do the job the owl's ear tufts did, and
                  * for the same reason. The ribbon and the page lines are detail for 100px+ and
                  * vanish politely below that.
                  *
                  * The id is unchanged so nothing referencing it breaks - the same way the books
                  * kept `pl-vDiyo` after the diyo went.
                  */}
                <g id="pl-vBody">
                    {/* ONE outline, and its top edge is the whole idea: it rises at the outer
                        corners and dips to a valley at the spine. Wide, low, notched - a profile
                        nothing else in the cast has, and the part that survives at 15px. */}
                    <path d="M18 146 C18 128 31 117 48 119 C70 122 89 132 100 148 C111 132 130 122 152 119 C169 117 182 128 182 146 L182 206 C182 222 169 234 153 234 L47 234 C31 234 18 222 18 206 Z" fill="url(#pl-gButter)" />

                    {/* The two leaves. Pale, inset, meeting at a narrow gutter - this is what makes
                        it a book being READ rather than a bowl. The face sits across them. */}
                    <path d="M31 150 C31 141 37 137 45 138 C63 141 79 148 93 159 L93 209 C79 199 61 194 44 194 C36 194 31 190 31 183 Z" fill="#FFFDF6" />
                    <path d="M169 150 C169 141 163 137 155 138 C137 141 121 148 107 159 L107 209 C121 199 139 194 156 194 C164 194 169 190 169 183 Z" fill="url(#pl-gPaper)" />

                    {/* NO page lines across the leaves. They were drawn once and removed the same
                        hour: a curved rule above each eye reads as an EYEBROW, and two of them
                        angled inward made her look cross. The leaves are legible as paper from
                        their shape and their paleness alone. */}

                    {/* The ribbon, hanging past the cover's lower edge. Rose - the same one her two
                        closed books carry, which is what ties the three objects into one set. */}
                    <path d="M120 234 v20 l8 -7 l8 7 v-20 Z" fill="#FF7F9C" />
                    <ellipse cx="46" cy="208" rx="10" ry="6" transform="rotate(-10 46 208)" fill="#ffffff" opacity={0.35} />
                </g>
                {/* The books Vidya sits on: two stacked, butter over peach, a rose bookmark. The diyo
                    she used to sit in was swapped for these on 2026-09-21 - a stack of books is what
                    every student knows, and it reads at 16px where a lamp turned to mush. The old
                    id is kept so nothing that references it breaks. */}
                <g id="pl-vDiyo">
                    <g transform="rotate(-2 100 250)">
                        <rect x="30" y="238" width="140" height="26" rx="6" fill="#FFB899" />
                        <rect x="30" y="238" width="14" height="26" rx="4" fill="#F29A78" />
                        <rect x="158" y="241" width="10" height="20" rx="2" fill="#FFFDF6" opacity={0.85} />
                        <path d="M48 251 H150" stroke="#F29A78" strokeWidth="2" strokeLinecap="round" opacity={0.7} />
                    </g>
                    <g transform="rotate(2 100 226)">
                        <rect x="40" y="214" width="124" height="26" rx="6" fill="url(#pl-gButter)" />
                        <rect x="40" y="214" width="14" height="26" rx="4" fill="#F2B631" />
                        <rect x="152" y="217" width="10" height="20" rx="2" fill="#FFFDF6" opacity={0.85} />
                        <path d="M58 227 H144" stroke="#E9B93F" strokeWidth="2" strokeLinecap="round" opacity={0.7} />
                        <path d="M118 214 v18 l6 -5 l6 5 v-18 Z" fill="#FF7F9C" />
                    </g>
                </g>

                {/* Kapi, the exercise copy. 200 x 228. */}
                <g id="pl-cKapi">
                    <path d="M78 196 V216 M126 196 V216 M24 120 H8 M170 120 H188" {...LIMB} />
                    <ellipse cx="72" cy="218" rx="11" ry="5" {...EYE} /><ellipse cx="132" cy="218" rx="11" ry="5" {...EYE} />
                    <rect x="36" y="26" width="140" height="176" rx="16" fill="#E9B93F" />
                    <rect x="28" y="18" width="140" height="176" rx="16" fill="url(#pl-gButter)" />
                    <rect x="28" y="18" width="22" height="176" rx="10" fill="#F2B631" opacity={0.6} />
                    <rect x="66" y="38" width="84" height="40" rx="8" fill="#FFFDF6" />
                    <path d="M76 52 H140 M76 64 H120" fill="none" stroke="#D9CBB0" strokeWidth="4" strokeLinecap="round" />
                    <ellipse cx="150" cy="40" rx="6" ry="14" transform="rotate(-30 150 40)" fill="#ffffff" opacity={0.6} />
                    <use href="#pl-fSmile" transform="translate(108 132)" />
                </g>
                {/* Rabar, the eraser. 200 x 214. */}
                <g id="pl-cRabar">
                    <path d="M76 176 V200 M124 176 V200 M30 112 H12 M170 112 H188" {...LIMB} />
                    <ellipse cx="70" cy="202" rx="11" ry="5" {...EYE} /><ellipse cx="130" cy="202" rx="11" ry="5" {...EYE} />
                    <rect x="30" y="36" width="140" height="146" rx="30" fill="url(#pl-gRose)" />
                    <path d="M30 138 H170 V152 Q170 182 140 182 H60 Q30 182 30 152 Z" fill="#FFFDF6" />
                    <path d="M58 150 V170 M82 150 V170 M106 150 V170 M130 150 V170" fill="none" stroke="#FFC24D" strokeWidth="6" strokeLinecap="round" />
                    <ellipse cx="58" cy="62" rx="7" ry="16" transform="rotate(32 58 62)" fill="#ffffff" opacity={0.6} />
                    <use href="#pl-fHappy" transform="translate(100 98)" />
                </g>
                {/* Sisa, the pencil. 200 x 244. */}
                <g id="pl-cSisa">
                    <path d="M84 214 V232 M116 214 V232 M62 128 H44 M138 128 H156" {...LIMB} />
                    <ellipse cx="78" cy="234" rx="11" ry="5" {...EYE} /><ellipse cx="122" cy="234" rx="11" ry="5" {...EYE} />
                    <path d="M62 70 L100 8 L138 70 Z" fill="#FFF3DC" /><path d="M88 28 L100 8 L112 28 Z" fill="#2A1A12" />
                    <rect x="62" y="68" width="76" height="120" fill="url(#pl-gAmber)" />
                    <rect x="62" y="186" width="76" height="14" fill="url(#pl-gBrass)" />
                    <rect x="62" y="198" width="76" height="22" rx="10" fill="url(#pl-gRose)" />
                    <rect x="70" y="76" width="8" height="100" rx="4" fill="#ffffff" opacity={0.5} />
                    <use href="#pl-fSmile" transform="translate(100 128) scale(0.74)" />
                </g>
                {/* The student. A flat-vector kid in a cream shirt and amber vest, with the cast's face.
                    200 x 300. The body is shared; the two poses add their own arms. */}
                <g id="pl-cStudentBody">
                    <path d="M84 234 V280 M116 234 V280" fill="none" stroke="#3A2E2A" strokeWidth="18" strokeLinecap="round" />
                    <ellipse cx="80" cy="288" rx="17" ry="7" fill="#2A1A12" /><ellipse cx="120" cy="288" rx="17" ry="7" fill="#2A1A12" />
                    <path d="M62 128 C62 110 138 110 138 128 L142 238 H58 Z" fill="#FFFDF6" />
                    <path d="M68 130 L100 152 L132 130 L138 238 H62 Z" fill="url(#pl-gAmber)" />
                    <path d="M62 128 L100 152 L138 128 L138 140 L100 166 L62 140 Z" fill="#FFFDF6" />
                    <path d="M96 150 L104 150 L107 192 L100 202 L93 192 Z" fill="#FF7F9C" />
                    <path d="M76 134 V196 M124 134 V196" fill="none" stroke="#FF9DB0" strokeWidth="8" strokeLinecap="round" opacity={0.9} />
                    <rect x="90" y="102" width="20" height="20" fill="#E9B893" />
                    <circle cx="100" cy="72" r="42" fill="#F2C9A8" />
                    <circle cx="57" cy="76" r="7" fill="#E9B893" /><circle cx="143" cy="76" r="7" fill="#E9B893" />
                    <path d="M58 68 C58 30 142 30 142 68 C136 52 122 44 100 46 C78 44 64 52 58 68 Z" fill="#2A1A12" />
                    <path d="M62 58 C74 40 90 36 100 40 C112 36 128 42 138 58 C126 50 112 48 100 50 C88 48 74 50 62 58 Z" fill="#3B2A22" />
                    <use href="#pl-fSmile" transform="translate(100 80) scale(0.78)" />
                </g>
                <g id="pl-cStudent">
                    <path d="M64 152 C48 182 52 204 62 218" fill="none" stroke="#F2C9A8" strokeWidth="16" strokeLinecap="round" />
                    <path d="M136 150 C156 132 166 110 176 86" fill="none" stroke="#F2C9A8" strokeWidth="16" strokeLinecap="round" />
                    <circle cx="178" cy="80" r="12" fill="#F2C9A8" />
                    <use href="#pl-cStudentBody" />
                </g>
                <g id="pl-cStudentRead">
                    <use href="#pl-cStudentBody" />
                    <path d="M64 152 C52 176 60 190 74 196" fill="none" stroke="#F2C9A8" strokeWidth="16" strokeLinecap="round" />
                    <path d="M136 152 C148 176 140 190 126 196" fill="none" stroke="#F2C9A8" strokeWidth="16" strokeLinecap="round" />
                    <path d="M52 176 L100 186 L148 176 L148 214 L100 226 L52 214 Z" fill="#FFFDF6" stroke="#E4D6BE" strokeWidth="2" strokeLinejoin="round" />
                    <path d="M100 186 V226" stroke="#E4D6BE" strokeWidth="2" />
                    <path d="M62 190 L90 196 M62 200 L90 206 M110 196 L138 190 M110 206 L138 200" fill="none" stroke="#D9CBB0" strokeWidth="3" strokeLinecap="round" />
                    <circle cx="72" cy="198" r="11" fill="#F2C9A8" /><circle cx="128" cy="198" r="11" fill="#F2C9A8" />
                </g>
                {/* Jahaj, the paper plane. 200 x 200. */}
                <g id="pl-cJahaj">
                    <path d="M8 196 Q40 170 66 150" fill="none" stroke="#D9CBB0" strokeWidth="4" strokeLinecap="round" strokeDasharray="2 12" />
                    <path d="M14 104 L192 22 L128 186 L98 130 Z" fill="url(#pl-gPaper)" stroke="#E4D6BE" strokeWidth="2" strokeLinejoin="round" />
                    <path d="M98 130 L192 22 L112 162 Z" fill="#EADCC2" />
                    <path d="M98 130 L192 22" fill="none" stroke="#D9CBB0" strokeWidth="2" />
                    <use href="#pl-fSmile" transform="translate(92 96) rotate(-24) scale(0.6)" />
                    <use href="#pl-spark" transform="translate(150 150) scale(1.1)" />
                </g>
            </defs>
        </svg>
    )
}

interface CharacterProps {
    /** Rendered width in px. Height follows the character's own aspect. */
    size?: number
    motion?: Motion
    /** Seconds; negative values start mid-cycle so a group does not bob in unison. */
    delay?: number
    className?: string
    style?: CSSProperties
}

function Wrap({
    size, motion = 'float', delay = 0, className = '', style, vb, children,
}: CharacterProps & { size: number; vb: readonly [number, number]; children: React.ReactNode }) {
    const [vw, vh] = vb
    const h = Math.round((size * vh) / vw)
    return (
        <div
            aria-hidden="true"
            className={`${MOTION[motion]} ${className}`.trim()}
            style={{ width: size, height: h, animationDelay: `${delay}s`, ...style }}
        >
            <svg viewBox={`0 0 ${vw} ${vh}`} width={size} height={h} focusable="false">
                {children}
            </svg>
        </div>
    )
}

/** The guide. `lamp` draws the stack of books under her (the prop name predates the books); the small in-line guide omits it. */
export function Vidya({ size = 160, mood = 'smile', lamp = true, ...rest }: CharacterProps & { mood?: Mood; lamp?: boolean }) {
    const vb = [200, lamp ? 280 : 250] as const
    return (
        <Wrap size={size} vb={vb} {...rest}>
            <ellipse cx="100" cy={lamp ? 272 : 242} rx={lamp ? 74 : 44} ry="7" fill="#1F1A14" opacity={0.1} />
            {lamp ? <ellipse cx="100" cy="130" rx="96" ry="110" fill="url(#pl-gGlow)" /> : null}
            {lamp ? <use href="#pl-vDiyo" /> : null}
            <use href="#pl-vBody" />
            <use href={FACE[mood]} transform="translate(100 116)" />
        </Wrap>
    )
}

/** The student. `pose` is waving (default) or reading an open book. */
export function Student({ size = 180, pose = 'wave', ...rest }: CharacterProps & { pose?: 'wave' | 'read' }) {
    return (
        <Wrap size={size} vb={[200, 300] as const} {...rest}>
            <ellipse cx="100" cy="292" rx="52" ry="6" fill="#1F1A14" opacity={0.1} />
            <use href={pose === 'read' ? '#pl-cStudentRead' : '#pl-cStudent'} />
        </Wrap>
    )
}

export function Kapi({ size = 160, ...rest }: CharacterProps) {
    return <Wrap size={size} vb={[200, 228] as const} {...rest}><use href="#pl-cKapi" /></Wrap>
}
export function Rabar({ size = 160, ...rest }: CharacterProps) {
    return <Wrap size={size} vb={[200, 214] as const} {...rest}><use href="#pl-cRabar" /></Wrap>
}
export function Sisa({ size = 140, ...rest }: CharacterProps) {
    return <Wrap size={size} vb={[200, 244] as const} {...rest}><use href="#pl-cSisa" /></Wrap>
}
export function Jahaj({ size = 180, motion = 'drift', ...rest }: CharacterProps) {
    return <Wrap size={size} vb={[200, 200] as const} motion={motion} {...rest}><use href="#pl-cJahaj" /></Wrap>
}

/** A four-point gold spark. Absolutely positioned by the caller. */
export function Spark({ size = 24, delay = 0, className = '', style }: { size?: number; delay?: number; className?: string; style?: CSSProperties }) {
    return (
        <svg
            aria-hidden="true"
            focusable="false"
            className={`pl-twinkle ${className}`.trim()}
            width={size}
            height={size}
            viewBox="-12 -12 24 24"
            style={{ animationDelay: `${delay}s`, ...style }}
        >
            <use href="#pl-spark" />
        </svg>
    )
}

/**
 * The open book alone at icon size - the wordmark's mark, the chat avatar, the navbar.
 *
 * ## The viewBox is TIGHT to the drawing, and that is the whole point
 *
 * This shipped briefly as `viewBox="0 0 200 240"` with the face at `translate(100 116)`, both
 * inherited from the owl, and both wrong the moment Vidya became a book: `pl-vBody` now occupies
 * y 118-254, so the top **49%** of that box was empty, the ribbon was clipped off the bottom, and
 * the face was drawn ABOVE the cover - every mark on both apps was a faceless book at half size.
 * Niraj: *"this logo is cool but too small"*. It was not too small; it was half padding.
 *
 * So the box is the drawing's real bounds (x 18-182, y 118-254) plus an even 8px, and the face
 * sits at the same `translate(100 176)` the full `Vidya` uses. Those two numbers are tied to the
 * paths in `pl-vBody` - if the book is ever redrawn, re-measure, do not nudge.
 *
 * `size` is the HEIGHT, which is what all twelve call sites already assumed; the width follows the
 * book's wide-and-low ratio rather than being squeezed into a square.
 */
const MARK_VB = { x: 10, y: 110, w: 180, h: 152 } as const

export function VidyaMark({ size = 22, className = '' }: { size?: number; className?: string }) {
    return (
        <svg
            aria-hidden="true"
            focusable="false"
            className={className}
            viewBox={`${MARK_VB.x} ${MARK_VB.y} ${MARK_VB.w} ${MARK_VB.h}`}
            width={Math.round(size * (MARK_VB.w / MARK_VB.h))}
            height={size}
        >
            <use href="#pl-vBody" />
            <use href="#pl-fSmile" transform="translate(100 176)" />
        </svg>
    )
}
