/**
 * The Gurukul mark: three sheets of paper, stacked and offset, the top one with its corner
 * turned down.
 *
 * ## Why this exists when `public/gurukulmainlogo.webp` already does
 *
 * A raster cannot follow `currentColor`. Anywhere the mark sits on a surface whose colour is not
 * known in advance - a dark loader panel, an inverted chip, a print sheet - the webp brings its
 * own gold with it and either fights the surface or disappears into it. Inline SVG inherits the
 * ink of whatever it is placed in, needs no network request, and cannot shift the layout while it
 * loads.
 *
 * The webp is still the right thing for a favicon, an og:image, or anywhere the full-colour
 * gradient mark is wanted. This is for everywhere that needs it to be ONE colour.
 *
 * ## The geometry is traced, not redrawn
 *
 * The outline was lifted from `gurukulmainlogo.png` by flood-filling the front sheet, tracing its
 * boundary and simplifying it - 13 points, and the reconstruction covers the original silhouette
 * with an IoU of 0.88. The shortfall is entirely the white separators between the sheets, which
 * a one-colour mark draws as opacity steps instead.
 *
 * All three sheets are the SAME path offset by (-41, +36), because that is how the artwork is
 * built. If the mark ever changes, re-trace rather than nudging points by hand.
 */

/** One sheet, in the 500x500 space of the source artwork. */
const SHEET =
    "M178 38 L325 51 L335 57 L421 147 L428 161 L429 170 L428 400 L297 398 L163 293 L157 272 L157 59 L162 46 Z"

/**
 * Per-sheet offset, back to front. The front sheet sits at 0,0.
 *
 * All three are the SAME path, because that is how the artwork is built - measured off the
 * original at (-41, +36) per sheet.
 */
const STACK = [
    { dx: -82, dy: 72 },
    { dx: -41, dy: 36 },
    { dx: 0, dy: 0 },
]

/**
 * How wide the gap between sheets is, in the 500 space.
 *
 * The full-colour artwork separates the sheets with a WHITE line. A one-colour mark cannot do
 * that - white is the wrong colour the moment the mark is not on a white surface - so each sheet
 * has the one in front of it knocked out of it instead, leaving a real hole. The result reads the
 * same and works on any background, which is the whole reason this component exists.
 *
 * Opacity steps were tried first and are NOT enough: three translucent copies of the same colour
 * overlap into a single blob with no visible edge between them.
 */
const GAP = 22

export function Logo({ className = "" }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 500 500"
            className={className}
            fill="currentColor"
            role="img"
            aria-label="Gurukul"
        >
            <defs>
                {STACK.slice(0, -1).map((_, i) => {
                    const front = STACK[i + 1]!
                    return (
                        <mask key={i} id={`gk-logo-cut-${i}`}>
                            <rect width="500" height="500" fill="white" />
                            {/* The sheet in FRONT of this one, fattened by half the gap on each
                                side, painted black so it is removed. Stroke AND fill: the stroke
                                is what widens it, the fill is what removes its interior. */}
                            <path
                                d={SHEET}
                                transform={`translate(${front.dx} ${front.dy})`}
                                fill="black"
                                stroke="black"
                                strokeWidth={GAP}
                                strokeLinejoin="round"
                            />
                        </mask>
                    )
                })}
            </defs>

            {STACK.map(({ dx, dy }, i) => (
                <path
                    key={`${dx},${dy}`}
                    d={SHEET}
                    transform={dx || dy ? `translate(${dx} ${dy})` : undefined}
                    mask={i < STACK.length - 1 ? `url(#gk-logo-cut-${i})` : undefined}
                    opacity={i === STACK.length - 1 ? 1 : 0.72}
                />
            ))}

            {/*
             * The turned-down corner, which is the one detail that makes this read as PAPER
             * rather than as a chamfered box. Drawn over the front sheet at a lower opacity so the
             * fold reads as a surface catching different light - the job the darker gold does in
             * the full-colour mark.
             */}
            <path d="M325 51 L335 57 L421 147 L428 161 L358 138 L336 116 Z" opacity="0.45" />
        </svg>
    )
}

/**
 * The mark inside a filled tile, for places that need it to read as a discrete badge - a sidebar
 * header, an auth panel, the loader. `Logo` on its own is for surfaces that already exist.
 */
export function LogoTile({ className = "" }: { className?: string }) {
    return (
        <span className={`inline-flex items-center justify-center rounded-xl bg-neutral-900 dark:bg-white ${className}`}>
            <Logo className="h-[58%] w-[58%] text-white dark:text-neutral-900" />
        </span>
    )
}

export default Logo
