'use client';

/**
 * The on-screen twin of `packages/pdf/src/question-figure.ts`.
 *
 * A teacher reviews and approves the paper on this screen, then prints it. If the diagram only
 * existed in the PDF, they would be approving something they had never seen - which is exactly the
 * situation where a wrong figure gets printed for thirty children.
 *
 * The two renderers are deliberately separate implementations (SVG here, pdf-lib there) because the
 * output targets are different, but they read the SAME `FigureSpec` and apply the SAME
 * `isDrawableFigure` rule, so neither can draw a figure the other would refuse.
 */

export type FigureShape =
    | { shape: 'cone'; radius: number; height: number; slant?: number }
    | { shape: 'cylinder'; radius: number; height: number }
    | { shape: 'sphere'; radius: number }
    | { shape: 'hemisphere'; radius: number }
    | { shape: 'triangle'; base: number; height: number; rightAngle?: boolean }
    | { shape: 'circle'; radius: number }
    | { shape: 'rectangle'; width: number; height: number }
    | { shape: 'square'; side: number };

export interface FigureSpec {
    parts: FigureShape[];
    unit?: string;
    caption?: string;
}

const REQUIRED: Record<string, string[]> = {
    cone: ['radius', 'height'], cylinder: ['radius', 'height'], sphere: ['radius'],
    hemisphere: ['radius'], triangle: ['base', 'height'], circle: ['radius'],
    rectangle: ['width', 'height'], square: ['side'],
};

/** Same rule as the PDF renderer: unknown shape or a non-positive dimension means no figure. */
export function isDrawableFigure(value: unknown): value is FigureSpec {
    if (!value || typeof value !== 'object') return false;
    const spec = value as Partial<FigureSpec>;
    if (!Array.isArray(spec.parts) || spec.parts.length === 0 || spec.parts.length > 2) return false;
    return spec.parts.every((part) => {
        if (!part || typeof part !== 'object') return false;
        const p = part as Record<string, unknown>;
        const required = REQUIRED[String(p.shape)];
        if (!required) return false;
        return required.every((k) => typeof p[k] === 'number' && Number.isFinite(p[k]) && (p[k] as number) > 0);
    });
}

const S = { stroke: 'currentColor', fill: 'none', strokeWidth: 1 } as const;
const DASH = { ...S, strokeDasharray: '3 3' } as const;

function Shape({ part, unit, cx, footY }: { part: FigureShape; unit: string; cx: number; footY: number }) {
    switch (part.shape) {
        case 'cone': {
            const r = 44, h = 96;
            return (<>
                <ellipse cx={cx} cy={footY} rx={r} ry={8} {...S} />
                <line x1={cx - r} y1={footY} x2={cx} y2={footY - h} {...S} />
                <line x1={cx + r} y1={footY} x2={cx} y2={footY - h} {...S} />
                <line x1={cx} y1={footY} x2={cx} y2={footY - h} {...DASH} />
                <line x1={cx} y1={footY} x2={cx + r} y2={footY} {...DASH} />
                <text x={cx + 5} y={footY - h / 2} fontSize="11" fill="currentColor">{part.height}{unit}</text>
                <text x={cx + r / 2 - 6} y={footY + 16} fontSize="11" fill="currentColor">{part.radius}{unit}</text>
            </>);
        }
        case 'cylinder': {
            const r = 40, h = 88;
            return (<>
                <ellipse cx={cx} cy={footY - h} rx={r} ry={7} {...S} />
                <ellipse cx={cx} cy={footY} rx={r} ry={7} {...S} />
                <line x1={cx - r} y1={footY} x2={cx - r} y2={footY - h} {...S} />
                <line x1={cx + r} y1={footY} x2={cx + r} y2={footY - h} {...S} />
                <line x1={cx} y1={footY} x2={cx + r} y2={footY} {...DASH} />
                <text x={cx + r + 5} y={footY - h / 2} fontSize="11" fill="currentColor">{part.height}{unit}</text>
                <text x={cx + r / 2 - 6} y={footY + 17} fontSize="11" fill="currentColor">{part.radius}{unit}</text>
            </>);
        }
        case 'sphere':
        case 'circle': {
            const r = 46;
            return (<>
                <circle cx={cx} cy={footY - r} r={r} {...S} />
                <line x1={cx} y1={footY - r} x2={cx + r} y2={footY - r} {...DASH} />
                <text x={cx + r / 2 - 6} y={footY - r - 4} fontSize="11" fill="currentColor">{part.radius}{unit}</text>
            </>);
        }
        case 'hemisphere': {
            const r = 44;
            return (<>
                <path d={`M ${cx - r} ${footY} A ${r} ${r} 0 0 0 ${cx + r} ${footY}`} {...S} />
                <ellipse cx={cx} cy={footY} rx={r} ry={8} {...S} />
                <text x={cx + r / 2 - 6} y={footY + 17} fontSize="11" fill="currentColor">{part.radius}{unit}</text>
            </>);
        }
        case 'rectangle':
        case 'square': {
            const w = part.shape === 'square' ? 88 : 116;
            const h = part.shape === 'square' ? 88 : 70;
            const aLabel = part.shape === 'square' ? `${part.side}${unit}` : `${part.width}${unit}`;
            const bLabel = part.shape === 'square' ? `${part.side}${unit}` : `${part.height}${unit}`;
            return (<>
                <rect x={cx - w / 2} y={footY - h} width={w} height={h} {...S} />
                <text x={cx - 8} y={footY + 16} fontSize="11" fill="currentColor">{aLabel}</text>
                <text x={cx + w / 2 + 5} y={footY - h / 2} fontSize="11" fill="currentColor">{bLabel}</text>
            </>);
        }
        case 'triangle': {
            const w = 100, h = 84;
            return (<>
                <line x1={cx - w / 2} y1={footY} x2={cx + w / 2} y2={footY} {...S} />
                <line x1={cx - w / 2} y1={footY} x2={cx - w / 2} y2={footY - h} {...S} />
                <line x1={cx - w / 2} y1={footY - h} x2={cx + w / 2} y2={footY} {...S} />
                {part.rightAngle && (
                    <path d={`M ${cx - w / 2 + 8} ${footY} L ${cx - w / 2 + 8} ${footY - 8} L ${cx - w / 2} ${footY - 8}`} {...S} />
                )}
                <text x={cx - 8} y={footY + 16} fontSize="11" fill="currentColor">{part.base}{unit}</text>
                <text x={cx - w / 2 - 26} y={footY - h / 2} fontSize="11" fill="currentColor">{part.height}{unit}</text>
            </>);
        }
    }
}

export function QuestionFigure({ figure }: { figure: unknown }) {
    if (!isDrawableFigure(figure)) return null;
    const unit = figure.unit ?? 'cm';
    const [top, bottom] = figure.parts;
    if (!top) return null;

    // Sized to read at a glance beside the question text, not as a thumbnail the teacher has to
    // lean into. The shapes inside scale with the box.
    // A single solid is at most ~100px tall plus its labels; only a stacked pair needs the extra
    // room. A fixed 210px box left a band of empty space above every lone shape.
    const W = 280, H = figure.parts.length > 1 ? 210 : 160, cx = W / 2;
    // A hemisphere hangs BELOW its flat face, so the joint is that face - both parts share it.
    const depth = bottom?.shape === 'hemisphere' ? 44 : 0;
    const footY = H - 26 - depth;

    return (
        <figure className="mt-3 flex flex-col items-center">
            <svg
                width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img"
                aria-label={`Diagram: ${figure.parts.map((p) => p.shape).join(' on ')}`}
                className="text-neutral-800 dark:text-neutral-200"
            >
                {bottom && <Shape part={bottom} unit={unit} cx={cx} footY={footY} />}
                <Shape part={top} unit={unit} cx={cx} footY={footY} />
            </svg>
            {figure.caption && (
                <figcaption className="text-xs text-neutral-600 dark:text-neutral-400">{figure.caption}</figcaption>
            )}
        </figure>
    );
}
