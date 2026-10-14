import * as React from 'react';

/**
 * The motifs - the drawing that makes a cover recognisably ITS subject.
 *
 * Each one draws inside a 320x180 viewBox and is handed the three palette stops plus a stable `uid`
 * for any gradient or clip id it needs. **Ids must be namespaced with `uid`**: two covers on the
 * same page with the same gradient id means the second one silently adopts the first one's colours,
 * which is how a grid of subjects ends up all the same shade.
 *
 * A motif draws LINE WORK, not filled illustration. At 320x180 on a card, filled shapes turn into
 * mud and stop reading as anything; a stroke at 1.5-2px stays a diagram. Everything here should
 * survive being 260px wide on a phone.
 *
 * Motion is opt-in per motif through the `anim` class names defined in `subject-art.tsx`, and every
 * one of them is switched off under `prefers-reduced-motion`.
 */

export interface MotifProps {
    uid: string;
    deep: string;
    mid: string;
    glow: string;
}

type Motif = (p: MotifProps) => React.ReactElement;

/** Shared stroke defaults. Consistency across twenty drawings is what makes them read as one set. */
const S = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

// ─── Mathematics: axes, a parabola, plotted points ──────────────────────────────
const mathematics: Motif = ({ deep, mid, glow }) => (
    <g>
        <g stroke={glow} strokeOpacity={0.35} strokeWidth={1}>
            {[60, 100, 140, 180, 220, 260].map((x) => <line key={x} x1={x} y1={28} x2={x} y2={152} />)}
            {[52, 90, 128].map((y) => <line key={y} x1={44} y1={y} x2={276} y2={y} />)}
        </g>
        <path {...S} d="M44 128 H276" stroke={mid} strokeWidth={1.75} />
        <path {...S} d="M100 28 V152" stroke={mid} strokeWidth={1.75} />
        <path {...S} d="M56 46 Q100 168 168 96 T268 44" stroke={deep} strokeWidth={2.5} className="sa-draw" />
        {([[76, 92], [124, 122], [172, 92], [220, 62]] as const).map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r={4} fill={glow} stroke={deep} strokeWidth={1.5} />
        ))}
    </g>
);

// ─── Optional Mathematics: unit circle driving a sine wave ──────────────────────
const optionalMathematics: Motif = ({ deep, mid, glow }) => (
    <g>
        <circle cx={92} cy={90} r={44} {...S} stroke={mid} strokeWidth={1.75} />
        <circle cx={92} cy={90} r={44} {...S} stroke={glow} strokeWidth={1} strokeDasharray="3 6" />
        <path {...S} d="M92 90 L127 62" stroke={deep} strokeWidth={2.5} />
        <path {...S} d="M48 90 H136" stroke={glow} strokeWidth={1} />
        <circle cx={127} cy={62} r={4.5} fill={deep} />
        <path {...S} d="M148 90 q18 -46 36 0 t36 0 t36 0" stroke={deep} strokeWidth={2.5} className="sa-draw" />
        <path {...S} d="M144 90 H284" stroke={mid} strokeWidth={1.25} />
    </g>
);

// ─── Science: an atom, three orbitals ───────────────────────────────────────────
const science: Motif = ({ deep, mid, glow }) => (
    <g transform="translate(160 90)">
        <g className="sa-spin-slow">
            {[0, 60, 120].map((deg) => (
                <ellipse key={deg} rx={68} ry={26} {...S} stroke={mid} strokeWidth={1.75}
                    transform={`rotate(${deg})`} />
            ))}
        </g>
        <circle r={12} fill={glow} fillOpacity={0.55} />
        <circle r={7} fill={deep} />
        <circle cx={68} cy={0} r={5} fill={glow} stroke={deep} strokeWidth={1.25} className="sa-orbit" />
    </g>
);

// ─── Physics: a pendulum over a wave ────────────────────────────────────────────
const physics: Motif = ({ deep, mid, glow }) => (
    <g>
        <path {...S} d="M60 34 H260" stroke={mid} strokeWidth={2} />
        <g className="sa-swing" style={{ transformOrigin: '160px 34px' }}>
            <path {...S} d="M160 34 V104" stroke={deep} strokeWidth={2} />
            <circle cx={160} cy={112} r={11} fill={glow} stroke={deep} strokeWidth={2} />
        </g>
        <path {...S} d="M44 150 q20 -22 40 0 t40 0 t40 0 t40 0 t40 0" stroke={glow} strokeWidth={2} strokeOpacity={0.8} />
    </g>
);

// ─── Chemistry: a benzene ring and a flask ──────────────────────────────────────
const chemistry: Motif = ({ deep, mid, glow }) => (
    <g>
        <g transform="translate(108 90)">
            <polygon points="0,-42 36,-21 36,21 0,42 -36,21 -36,-21" {...S} stroke={deep} strokeWidth={2.5} />
            <polygon points="0,-28 24,-14 24,14 0,28 -24,14 -24,-14" {...S} stroke={mid} strokeWidth={1.5} strokeDasharray="5 5" />
        </g>
        <g transform="translate(214 88)">
            <path {...S} d="M-13 -34 h26 M-9 -34 v22 L-26 26 a8 8 0 0 0 7 12 h38 a8 8 0 0 0 7 -12 L9 -12 v-22"
                stroke={deep} strokeWidth={2.25} />
            <path d="M-21 12 h42 a8 8 0 0 1 -3 26 h-36 a8 8 0 0 1 -3 -26 z" fill={glow} fillOpacity={0.55} />
            <circle cx={-6} cy={24} r={3} fill={mid} className="sa-rise" />
            <circle cx={8} cy={30} r={2.5} fill={mid} className="sa-rise sa-delay" />
        </g>
    </g>
);

// ─── Biology: a double helix ────────────────────────────────────────────────────
const biology: Motif = ({ deep, mid, glow }) => (
    <g transform="translate(160 90)">
        <path {...S} d="M-70 -56 q46 28 0 56 t0 56" stroke={deep} strokeWidth={2.5} transform="rotate(-90)" />
        <path {...S} d="M-70 56 q46 -28 0 -56 t0 -56" stroke={mid} strokeWidth={2.5} transform="rotate(-90)" />
        {[-56, -34, -12, 10, 32, 54].map((x, i) => {
            const spread = Math.abs(Math.cos((x / 56) * Math.PI)) * 24 + 6;
            return <line key={i} x1={x} y1={-spread} x2={x} y2={spread} stroke={glow} strokeWidth={2} strokeLinecap="round" />;
        })}
    </g>
);

// ─── Computer Science: a chip on a board, traces running out to its pads ────────
/*
 * This was a rounded window with a title bar and a `>` prompt, and it did not read: a rounded
 * rectangle drawn inside a rounded card is a card inside a card, and at 260px on a phone the
 * chevron and the two stray traces beside it were three unrelated marks rather than one drawing.
 *
 * A chip reads instantly and cannot be mistaken for the card, because its legs break the outline.
 * Traces run out to pads so it is a BOARD rather than a floating square, and one trace blinks,
 * which is the only motion - a board where everything blinks reads as a warning light.
 */
const computerScience: Motif = ({ deep, mid, glow }) => (
    <g>
        {/* Traces first, so the chip and its legs sit on top of them. */}
        <g {...S} stroke={mid} strokeWidth={1.5} strokeOpacity={0.85}>
            <path d="M108 64 H76 V40 H46" />
            <path d="M108 80 H62" />
            <path d="M108 96 H88" />
            <path d="M108 112 H76 V140 H42" />
            <path d="M212 64 H250 V40 H278" />
            <path d="M212 96 H274" />
            <path d="M212 112 H248 V142 H282" />
        </g>
        <path {...S} d="M212 80 H258" stroke={deep} strokeWidth={2} className="sa-blink" />
        <g fill={glow} stroke={mid} strokeWidth={1.25}>
            {([[46, 40], [62, 80], [42, 140], [278, 40], [274, 96], [282, 142], [258, 80]] as const).map(([cx, cy], i) => (
                <circle key={i} cx={cx} cy={cy} r={3.5} />
            ))}
        </g>
        {/* Legs - four a side, three top and bottom. */}
        <g {...S} stroke={deep} strokeWidth={2}>
            {[64, 80, 96, 112].map((y) => <path key={`l${y}`} d={`M126 ${y} H108`} />)}
            {[64, 80, 96, 112].map((y) => <path key={`r${y}`} d={`M194 ${y} H212`} />)}
            {[142, 160, 178].map((x) => <path key={`t${x}`} d={`M${x} 56 V44`} />)}
            {[142, 160, 178].map((x) => <path key={`b${x}`} d={`M${x} 124 V136`} />)}
        </g>
        {/* The chip, and the die inside it. The notch dot is the orientation mark a real package
            carries, and it is what stops the square reading as a plain box. */}
        <rect x={126} y={56} width={68} height={68} rx={8} {...S} fill={glow} fillOpacity={0.2} stroke={deep} strokeWidth={2.5} />
        <rect x={142} y={72} width={36} height={36} rx={4} {...S} stroke={mid} strokeWidth={1.5} />
        <circle cx={134} cy={64} r={2.5} fill={deep} />
    </g>
);

// ─── English: an open book with a quotation mark ────────────────────────────────
const english: Motif = ({ deep, mid, glow }) => (
    <g>
        <path {...S} d="M160 52 q-40 -18 -76 -10 v88 q36 -8 76 10 q40 -18 76 -10 V42 q-36 -8 -76 10 z"
            stroke={deep} strokeWidth={2.5} />
        <path {...S} d="M160 52 V140" stroke={mid} strokeWidth={1.75} />
        {[72, 88, 104].map((y) => (
            <g key={y}>
                <path {...S} d="M98 0 h44" transform={`translate(0 ${y})`} stroke={glow} strokeWidth={2} />
                <path {...S} d="M178 0 h44" transform={`translate(0 ${y})`} stroke={glow} strokeWidth={2} />
            </g>
        ))}
        <text x={196} y={62} fontSize={44} fontFamily="Georgia, serif" fill={mid} fillOpacity={0.55}>&#8220;</text>
    </g>
);

// ─── Nepali: the word itself, outlined, sitting on ruled paper ──────────────────
/*
 * This used to draw a shirorekha with four shapes hung off it, on the argument that a bar is a
 * motif where a word would be a spelling. The shapes were not Devanagari - they were invented, and
 * a Nepali reader sees that in the first half second, which is worse than having no letters at all.
 *
 * The word is the motif. It is outlined rather than filled so it stays LINE WORK like the other
 * nineteen drawings, and the shirorekha comes free because it is part of the letters.
 *
 * The font stack names the Devanagari faces that actually ship on each platform - Noto on Android
 * and Linux, Kohinoor / Devanagari Sangam on Apple, Nirmala / Mangal on Windows - because the
 * generic `serif` fallback has no Devanagari coverage on some desktops and would render boxes.
 */
const DEVANAGARI = "'Noto Sans Devanagari','Kohinoor Devanagari','Devanagari Sangam MN','Nirmala UI','Mangal',sans-serif";

const nepali: Motif = ({ deep, mid, glow }) => (
    <g>
        {/* Ruled paper, so the word sits ON a line rather than floating in the middle of the card. */}
        <g {...S} stroke={glow} strokeWidth={1.5}>
            <line x1={44} y1={46} x2={276} y2={46} strokeOpacity={0.5} />
            <line x1={44} y1={132} x2={276} y2={132} strokeOpacity={0.7} />
            <line x1={44} y1={150} x2={214} y2={150} strokeOpacity={0.35} />
        </g>
        <text
            x={160}
            y={124}
            textAnchor="middle"
            fontSize={60}
            fontFamily={DEVANAGARI}
            fill={glow}
            fillOpacity={0.22}
            stroke={deep}
            strokeWidth={2}
        >
            नेपाली
        </text>
        <circle cx={266} cy={132} r={3} fill={mid} />
    </g>
);

// ─── Social Studies: a globe with a meridian grid ───────────────────────────────
const socialStudies: Motif = ({ deep, mid, glow }) => (
    <g transform="translate(160 90)">
        <circle r={54} {...S} stroke={deep} strokeWidth={2.5} />
        <ellipse rx={54} ry={20} {...S} stroke={mid} strokeWidth={1.5} />
        <ellipse rx={54} ry={40} {...S} stroke={mid} strokeWidth={1.25} strokeOpacity={0.7} />
        <ellipse rx={20} ry={54} {...S} stroke={mid} strokeWidth={1.5} />
        <ellipse rx={40} ry={54} {...S} stroke={mid} strokeWidth={1.25} strokeOpacity={0.7} />
        <path d="M-30 -18 q16 -10 30 2 t26 -4 q6 18 -10 26 t-34 6 q-16 -14 -12 -30 z"
            fill={glow} fillOpacity={0.5} stroke={deep} strokeWidth={1.5} />
        <circle cx={14} cy={22} r={3.5} fill={deep} />
    </g>
);

// ─── Health and Physical Education: a runner, with the pulse she is running at ──
/*
 * This was a pulse trace across the middle and a heart squeezed in on top of it by a three-step
 * transform chain (`translate scale translate`), which landed the heart ON the trace - so the two
 * drawings cancelled each other and the card read as a scribble. It was also only ever HEALTH: a
 * heart and an ECG say clinic, and this subject is half physical education.
 *
 * Now the two ideas are side by side and each has its own space: the pulse on the left, the runner
 * on the right, both on one ground line. Strokes only, so it survives 260px on a phone.
 */
const health: Motif = ({ deep, mid, glow }) => (
    <g>
        {/* The pulse. It starts and ends at the same y so it reads as a trace rather than a slope. */}
        <path {...S} d="M30 92 H64 l9 -28 13 58 11 -42 9 12 H132"
            stroke={deep} strokeWidth={2.75} className="sa-draw" />
        <circle cx={73} cy={64} r={4} fill={mid} className="sa-pulse" />

        {/* The runner, mid-stride, facing the way the trace is going. */}
        <circle cx={206} cy={46} r={12} {...S} fill={glow} fillOpacity={0.3} stroke={deep} strokeWidth={2.5} />
        <g {...S} stroke={deep} strokeWidth={3}>
            <path d="M200 60 L186 104" />
            <path d="M202 68 L232 72 L244 58" />
            <path d="M198 70 L170 82 L160 68" />
            <path d="M186 104 L220 116 L230 146" />
            <path d="M186 104 L162 132 L138 142" />
        </g>
        <path {...S} d="M40 158 H292" stroke={mid} strokeWidth={1.5} strokeOpacity={0.6} />
    </g>
);

// ─── Accountancy and Economics: a ledger with a rising trend ────────────────────
const accounts: Motif = ({ deep, mid, glow }) => (
    <g>
        {([[92, 118, 30], [124, 100, 48], [156, 82, 66], [188, 62, 86], [220, 46, 102]] as const).map(([x, y, h], i) => (
            <rect key={i} x={x} y={y} width={22} height={h} rx={4} fill={glow} fillOpacity={0.35}
                stroke={mid} strokeWidth={1.5} />
        ))}
        <path {...S} d="M56 148 H272" stroke={deep} strokeWidth={2.5} />
        <path {...S} d="M56 148 V38" stroke={deep} strokeWidth={2.5} />
        <path {...S} d="M92 122 L124 104 L156 86 L188 66 L220 50" stroke={deep} strokeWidth={2.5} className="sa-draw" />
        <path {...S} d="M212 42 l16 4 -4 16" stroke={deep} strokeWidth={2.5} />
    </g>
);

// ─── Business Studies: a flow of decisions ──────────────────────────────────────
const business: Motif = ({ deep, mid, glow }) => (
    <g>
        <rect x={44} y={72} width={58} height={36} rx={8} {...S} stroke={deep} strokeWidth={2.25} />
        <path d="M160 60 l26 30 -26 30 -26 -30 z" fill={glow} fillOpacity={0.35} stroke={deep} strokeWidth={2.25} />
        <rect x={218} y={44} width={58} height={32} rx={8} {...S} stroke={mid} strokeWidth={2} />
        <rect x={218} y={104} width={58} height={32} rx={8} {...S} stroke={mid} strokeWidth={2} />
        <path {...S} d="M102 90 H130" stroke={mid} strokeWidth={2} />
        <path {...S} d="M186 82 q18 -22 32 -22" stroke={mid} strokeWidth={2} />
        <path {...S} d="M186 98 q18 22 32 22" stroke={mid} strokeWidth={2} />
    </g>
);

// ─── Moral education: a lamp ────────────────────────────────────────────────────
const moral: Motif = ({ deep, mid, glow }) => (
    <g transform="translate(160 96)">
        <path d="M-52 12 q52 26 104 0 q-14 22 -52 22 t-52 -22 z" fill={glow} fillOpacity={0.4}
            stroke={deep} strokeWidth={2.5} strokeLinejoin="round" />
        <path {...S} d="M-52 12 h104" stroke={deep} strokeWidth={2.5} />
        <path d="M0 -44 q16 20 0 34 q-16 -14 0 -34 z" fill={mid} className="sa-flicker" />
        <circle r={26} cy={-30} fill={glow} fillOpacity={0.18} className="sa-flicker" />
        <path {...S} d="M-70 34 h140" stroke={mid} strokeWidth={1.5} strokeOpacity={0.6} />
    </g>
);

// ─── Environment: a leaf over water ─────────────────────────────────────────────
const environment: Motif = ({ deep, mid, glow }) => (
    <g>
        <path d="M112 118 q0 -66 76 -76 q10 62 -76 76 z" fill={glow} fillOpacity={0.35}
            stroke={deep} strokeWidth={2.5} strokeLinejoin="round" />
        <path {...S} d="M112 118 q40 -30 76 -76" stroke={deep} strokeWidth={2} />
        {([[132, 96], [148, 80], [164, 64]] as const).map(([x, y], i) => (
            <path key={i} {...S} d={`M${x} ${y} l14 -6`} stroke={mid} strokeWidth={1.5} />
        ))}
        <path {...S} d="M52 140 q22 -12 44 0 t44 0 t44 0 t44 0" stroke={mid} strokeWidth={2} strokeOpacity={0.7} />
        <path {...S} d="M52 152 q22 -12 44 0 t44 0 t44 0 t44 0" stroke={mid} strokeWidth={2} strokeOpacity={0.4} />
    </g>
);

// ─── Arts: a brush and a palette ────────────────────────────────────────────────
const arts: Motif = ({ deep, mid, glow }) => (
    <g>
        <path d="M108 130 a48 44 0 1 1 52 -8 a12 12 0 0 0 -14 16 a10 10 0 0 1 -12 12 a48 48 0 0 1 -26 -20 z"
            fill={glow} fillOpacity={0.28} stroke={deep} strokeWidth={2.5} strokeLinejoin="round" />
        {([[96, 76], [118, 62], [142, 68]] as const).map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r={6} fill={mid} fillOpacity={0.85} />
        ))}
        <g transform="rotate(-32 214 96)">
            <path {...S} d="M214 46 v56" stroke={deep} strokeWidth={3} />
            <path d="M206 102 h16 l-4 26 h-8 z" fill={mid} stroke={deep} strokeWidth={2} strokeLinejoin="round" />
            <path {...S} d="M210 128 q4 14 8 0" stroke={glow} strokeWidth={3} />
        </g>
    </g>
);

// ─── Music: a stave with notes ──────────────────────────────────────────────────
const music: Motif = ({ deep, mid, glow }) => (
    <g>
        {[62, 78, 94, 110, 126].map((y) => (
            <line key={y} x1={44} y1={y} x2={276} y2={y} stroke={mid} strokeWidth={1.5} strokeOpacity={0.75} />
        ))}
        {([[96, 110], [140, 94], [188, 78], [232, 102]] as const).map(([cx, cy], i) => (
            <g key={i} className={i % 2 ? 'sa-bob sa-delay' : 'sa-bob'}>
                <ellipse cx={cx} cy={cy} rx={9} ry={7} fill={glow} stroke={deep} strokeWidth={2}
                    transform={`rotate(-18 ${cx} ${cy})`} />
                <path {...S} d={`M${cx + 8} ${cy - 3} V${cy - 42}`} stroke={deep} strokeWidth={2.5} />
            </g>
        ))}
        <path {...S} d="M196 36 q22 6 22 22" stroke={deep} strokeWidth={2.5} />
    </g>
);

// ─── Geography: contour lines ───────────────────────────────────────────────────
const geography: Motif = ({ deep, mid, glow }) => (
    <g>
        {[0, 1, 2, 3].map((i) => (
            <path key={i} {...S}
                d={`M${40 + i * 10} ${142 - i * 16} q${44 - i * 4} -${44 - i * 6} ${96 - i * 8} -${8 - i * 2} t${100 - i * 10} -${28 - i * 4}`}
                stroke={i === 0 ? deep : mid} strokeWidth={i === 0 ? 2.5 : 1.75} strokeOpacity={1 - i * 0.18} />
        ))}
        <path d="M148 62 l20 -26 20 26 z" fill={glow} fillOpacity={0.5} stroke={deep} strokeWidth={2} strokeLinejoin="round" />
        <circle cx={96} cy={112} r={4} fill={deep} />
    </g>
);

// ─── History: a column and an hourglass ─────────────────────────────────────────
const history: Motif = ({ deep, mid, glow }) => (
    <g>
        <path {...S} d="M62 142 h84 M70 48 h68" stroke={deep} strokeWidth={3} />
        <path d="M56 48 h96 l-12 -14 h-72 z" fill={glow} fillOpacity={0.4} stroke={deep} strokeWidth={2.25} strokeLinejoin="round" />
        {[80, 104, 128].map((x) => <line key={x} x1={x} y1={48} x2={x} y2={142} stroke={mid} strokeWidth={2.5} strokeLinecap="round" />)}
        <g transform="translate(216 94)">
            <path {...S} d="M-26 -46 h52 M-26 46 h52" stroke={deep} strokeWidth={2.5} />
            <path {...S} d="M-22 -46 q0 30 22 46 q-22 16 -22 46 M22 -46 q0 30 -22 46 q22 16 22 46" stroke={deep} strokeWidth={2.25} />
            <path d="M-16 -40 h32 q-2 22 -16 34 q-14 -12 -16 -34 z" fill={glow} fillOpacity={0.6} />
            <path d="M-13 40 h26 q-3 -16 -13 -22 q-10 6 -13 22 z" fill={mid} fillOpacity={0.75} />
        </g>
    </g>
);

// ─── The fallback. A subject we have no drawing for yet still gets a real cover. ─
const generic: Motif = ({ deep, mid, glow }) => (
    <g transform="translate(160 90)">
        <g className="sa-spin-slow">
            <polygon points="0,-52 45,-26 45,26 0,52 -45,26 -45,-26" {...S} stroke={mid} strokeWidth={1.75} />
            <polygon points="0,-34 29,-17 29,17 0,34 -29,17 -29,-17" {...S} stroke={glow} strokeWidth={1.5} />
        </g>
        <circle r={12} fill={glow} fillOpacity={0.45} />
        <circle r={6} fill={deep} />
        {[0, 60, 120, 180, 240, 300].map((deg) => (
            <circle key={deg} r={3.5} fill={mid}
                cx={Math.cos((deg * Math.PI) / 180) * 52} cy={Math.sin((deg * Math.PI) / 180) * 52} />
        ))}
    </g>
);

// ─── Everyday tools, not subjects ───────────────────────────────────────────────

const typing: Motif = ({ deep, mid, glow }) => (
    <g>
        <rect x={44} y={54} width={232} height={82} rx={12} {...S} stroke={deep} strokeWidth={2.5} />
        {[0, 1, 2].map((row) => (
            <g key={row}>
                {Array.from({ length: row === 2 ? 1 : 8 }).map((_, i) => (
                    <rect key={i}
                        x={row === 2 ? 104 : 56 + i * 27 + row * 8}
                        y={66 + row * 22}
                        width={row === 2 ? 112 : 21} height={16} rx={4}
                        fill={glow} fillOpacity={row === 1 && i === 3 ? 0.75 : 0.22}
                        stroke={mid} strokeWidth={1.25} />
                ))}
            </g>
        ))}
        <path {...S} d="M232 110 h30 v18" stroke={mid} strokeWidth={2} />
    </g>
);

const reading: Motif = ({ deep, mid, glow }) => (
    <g>
        <path {...S} d="M64 122 q34 -14 62 0 V56 q-28 -14 -62 0 z" stroke={deep} strokeWidth={2.5} />
        <path {...S} d="M126 122 q34 -14 62 0 V56 q-28 -14 -62 0 z" stroke={deep} strokeWidth={2.5} />
        <path {...S} d="M126 56 V122" stroke={mid} strokeWidth={1.5} />
        {[0, 1, 2].map((i) => (
            <path key={i} {...S} d={`M${212 + i * 18} ${74 - i * 8} a${16 + i * 12} ${16 + i * 12} 0 0 1 0 ${32 + i * 24}`}
                stroke={mid} strokeWidth={2.25} strokeOpacity={0.85 - i * 0.2} className="sa-pulse" />
        ))}
        <circle cx={204} cy={90} r={5} fill={glow} stroke={deep} strokeWidth={1.5} />
    </g>
);

const words: Motif = ({ deep, mid, glow }) => (
    <g>
        <rect x={72} y={62} width={128} height={80} rx={12} fill={glow} fillOpacity={0.18} stroke={mid} strokeWidth={1.75} transform="rotate(-8 136 102)" />
        <rect x={92} y={52} width={128} height={80} rx={12} fill={glow} fillOpacity={0.28} stroke={mid} strokeWidth={1.75} transform="rotate(4 156 92)" />
        <rect x={108} y={44} width={128} height={80} rx={12} {...S} stroke={deep} strokeWidth={2.5} />
        <path {...S} d="M128 72 h64 M128 90 h84 M128 106 h48" stroke={deep} strokeWidth={2.25} />
    </g>
);

const daily: Motif = ({ deep, mid, glow }) => (
    <g>
        <circle cx={160} cy={118} r={38} fill={glow} fillOpacity={0.4} stroke={deep} strokeWidth={2.5} />
        <path {...S} d="M44 118 H272" stroke={deep} strokeWidth={2.5} />
        {[-70, -46, -22, 2, 26, 50, 74].map((d, i) => (
            <line key={i} x1={160 + d * 1.32} y1={118 - Math.max(0, 62 - Math.abs(d) * 0.72)}
                x2={160 + d * 1.62} y2={118 - Math.max(0, 82 - Math.abs(d) * 0.9)}
                stroke={mid} strokeWidth={2.25} strokeLinecap="round" className="sa-pulse" />
        ))}
    </g>
);

const practice: Motif = ({ deep, mid, glow }) => (
    <g transform="translate(160 90)">
        {[52, 36, 20].map((r, i) => (
            <circle key={r} r={r} fill={i === 2 ? glow : 'none'} fillOpacity={0.45}
                stroke={i === 0 ? deep : mid} strokeWidth={i === 0 ? 2.5 : 1.75} />
        ))}
        <circle r={6} fill={deep} />
        <path {...S} d="M-72 -56 L-14 -8" stroke={deep} strokeWidth={2.5} />
        <path {...S} d="M-72 -56 l4 18 l18 4" stroke={mid} strokeWidth={2} />
    </g>
);

const doubt: Motif = ({ deep, mid, glow }) => (
    <g>
        {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={56 + i * 54} y={128 - i * 26} width={40} height={16} rx={5}
                fill={glow} fillOpacity={0.2 + i * 0.16} stroke={mid} strokeWidth={1.5} />
        ))}
        <path {...S} d="M76 122 L130 96 L184 70 L238 44" stroke={deep} strokeWidth={2.5} strokeDasharray="6 6" />
        <path {...S} d="M244 52 q0 -18 -14 -18 t-14 14" stroke={deep} strokeWidth={2.5} transform="translate(24 -6)" />
        <circle cx={254} cy={44} r={3.5} fill={deep} />
    </g>
);

const library: Motif = ({ deep, mid, glow }) => (
    <g>
        <path {...S} d="M52 140 H268" stroke={deep} strokeWidth={2.5} />
        {([[64, 58], [82, 74], [100, 48], [118, 66], [136, 56]] as const).map(([x, h], i) => (
            <rect key={i} x={x} y={140 - h} width={14} height={h} rx={3}
                fill={glow} fillOpacity={0.2 + (i % 3) * 0.14} stroke={mid} strokeWidth={1.5} />
        ))}
        <g transform="rotate(-12 210 100)">
            <path {...S} d="M170 130 q34 -14 62 0 V64 q-28 -14 -62 0 z" stroke={deep} strokeWidth={2.5} />
            <path {...S} d="M186 84 h30 M186 100 h30" stroke={mid} strokeWidth={2} />
        </g>
    </g>
);

const leaderboard: Motif = ({ deep, mid, glow }) => (
    <g>
        <path {...S} d="M52 144 H268" stroke={deep} strokeWidth={2.5} />
        <rect x={72} y={94} width={56} height={50} rx={6} fill={glow} fillOpacity={0.22} stroke={mid} strokeWidth={1.75} />
        <rect x={132} y={62} width={56} height={82} rx={6} fill={glow} fillOpacity={0.42} stroke={deep} strokeWidth={2.25} />
        <rect x={192} y={112} width={56} height={32} rx={6} fill={glow} fillOpacity={0.16} stroke={mid} strokeWidth={1.75} />
        <path d="M160 30 l7 15 16 2 -12 12 3 16 -14 -8 -14 8 3 -16 -12 -12 16 -2 z"
            fill={mid} stroke={deep} strokeWidth={1.75} strokeLinejoin="round" className="sa-bob" />
    </g>
);

/**
 * Every drawing, by key. `resolveArtKey()` in `registry.ts` maps a real subject name onto one of
 * these; nothing else should index this map directly.
 */
export const MOTIFS = {
    mathematics, optionalMathematics, science, physics, chemistry, biology,
    computerScience, english, nepali, socialStudies, health, accounts, business,
    moral, environment, arts, music, geography, history, generic,
    typing, reading, words, daily, practice, doubt, library, leaderboard,
} as const satisfies Record<string, Motif>;

export type ArtKey = keyof typeof MOTIFS;
