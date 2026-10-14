// BEFORE fontkit, and it must stay before it: this defines the `regeneratorRuntime` global that
// `@pdf-lib/fontkit` references but never bundles. Without it every Devanagari `drawText`
// throws `ReferenceError: regeneratorRuntime is not defined` from inside the Indic syllable
// state machine, so no Unicode font can ever draw Nepali however correctly it is configured.
// See regenerator-shim.ts for the whole story.
import './regenerator-shim';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, type RGB } from 'pdf-lib';
import { getSignedDownloadUrl } from '@repo/storage';

/**
 * A tiny top-down layout engine for pdf-lib.
 *
 * ## Why this file exists
 *
 * `@react-pdf/renderer` cannot run on Cloudflare Workers. Its layout engine, `yoga-layout`, is
 * WebAssembly delivered as a base64 string inside the JS bundle, and it calls
 * `WebAssembly.instantiate()` on those bytes when you render. Workers only accept WASM as a module
 * declared at deploy time and refuse to compile code at runtime, so every server-rendered PDF threw
 * `Wasm code generation disallowed by embedder` in production - while working perfectly under
 * `next dev`, which is plain Node. See docs/worker-bundle-size.md section 10.
 *
 * pdf-lib is pure JavaScript with no WASM, so it runs on Workers. The trade is that it has **no
 * layout engine at all**: you draw at absolute coordinates. This module is the missing piece - just
 * enough flow layout to express the documents we actually have (a header, label/value tables, some
 * justified prose, a signature block) without hand-computing a single y value at a call site.
 *
 * It is deliberately NOT a general layout engine. There are no columns, no floats and no flexbox.
 * If a document needs something this cannot express, add the one primitive it needs here rather
 * than scattering raw `drawText` coordinates through document files.
 *
 * ## The model
 *
 * A `Cursor` walks DOWN the page from the top margin. Every primitive draws at the cursor and then
 * advances it. When the cursor would cross the bottom margin, `ensure()` starts a new page - which
 * is the part that is easy to forget and produces text drawn off the bottom edge, invisible and
 * silent.
 */

/** A page size in PDF points. */
export interface PageSize { readonly width: number; readonly height: number }

/** A4 in PDF points. */
export const A4: PageSize = { width: 595.28, height: 841.89 };

/**
 * A4 turned on its side.
 *
 * For documents whose columns, not their rows, are the thing that runs long - a tabulation sheet,
 * a delivery register. Portrait squeezes a six-column table until every free-text cell wraps onto
 * three lines, which doubles the page count and makes the sheet harder to read, not easier.
 */
export const A4_LANDSCAPE: PageSize = { width: 841.89, height: 595.28 };

export interface Margins { top: number; right: number; bottom: number; left: number }

export const INK = {
    body: rgb(0.094, 0.094, 0.106),   // #18181b
    muted: rgb(0.322, 0.322, 0.357),  // #52525b
    faint: rgb(0.443, 0.443, 0.478),  // #71717a
    rule: rgb(0.894, 0.894, 0.906),   // #e4e4e7
    white: rgb(1, 1, 1),
} as const;

export interface Fonts { regular: PDFFont; bold: PDFFont; /** True when a Unicode face is embedded, so Devanagari draws instead of "???". */ unicode?: boolean }

/**
 * The document face, in ONE place.
 *
 * These are base-14 fonts: every PDF reader already has them, so nothing is embedded and a
 * certificate is ~4 KB rather than ~4 KB plus a font. Helvetica rather than Times because Times'
 * thin serifs render poorly at 10-11pt in browser PDF viewers, which is where these documents are
 * actually read.
 *
 * ## If you want a real brand face instead
 *
 * pdf-lib can embed any TTF/OTF via `@pdf-lib/fontkit` (no WASM, so it runs on Workers - checked).
 * The cost is not the dependency, it is the FONT BYTES: they have to reach the renderer, and
 * `process.cwd()` does not exist inside a Worker, so the file has to be bundled into the worker or
 * fetched at render time. A single weight is roughly 150-300 KB, against a 10 MiB limit this
 * document layer exists to get back under. Two weights doubles it.
 *
 * So it is a deliberate trade, not an oversight. Change these two lines and everything follows.
 */
const FACE = { regular: StandardFonts.Helvetica, bold: StandardFonts.HelveticaBold } as const;

/**
 * Make a string safe for a WinAnsi standard font.
 *
 * ## Why this exists
 *
 * The standard-14 fonts are WinAnsi-encoded, and pdf-lib THROWS on any character outside it:
 * `WinAnsi cannot encode "श" (0x0936)`. Not a missing glyph - a failed document. On a platform for
 * schools in Nepal that is a live crash: a school named in Nepali, a student whose name is written
 * in Devanagari, a subject called नेपाली, or a Nepali remark on a payslip takes the whole render
 * down, and with it the other 43 cards in the batch.
 *
 * Two steps, in order:
 *
 *  1. **NFKD + strip combining marks.** This is the one that recovers real text rather than losing
 *     it: "José" becomes "Jose", "Ưu" becomes "Uu". Accented Latin is common in transliterated
 *     names and is fully recoverable.
 *  2. **Anything still unencodable becomes `?`.** Devanagari has no Latin decomposition, so this is
 *     where it lands.
 *
 * ## This is a STOPGAP, and it is deliberately visible
 *
 * `?` is chosen over dropping the character precisely because it is ugly. A silently shortened name
 * looks like a correct document; "???" tells the office the PDF is not usable for that student.
 * The real fix is embedding a Unicode font (Noto Sans Devanagari via `@pdf-lib/fontkit`) - see
 * docs/print-to-pdf-migration.md. Until then, no render crashes.
 */
/**
 * The characters WinAnsi (CP1252) carries ABOVE Latin-1, at 0x80-0x9F.
 *
 * Without this the guard would mangle text that already worked: a curly apostrophe, an en dash and
 * a euro sign are all encodable, and testing `code <= 0xFF` alone turns "Ram's report - final" into
 * "Ram?s report ? final". These are common in real names and typed remarks, so the naive bound is a
 * quality regression dressed as a safety fix.
 */
const WINANSI_EXTRAS = new Set([
    0x20AC, 0x201A, 0x0192, 0x201E, 0x2026, 0x2020, 0x2021, 0x02C6,
    0x2030, 0x0160, 0x2039, 0x0152, 0x017D, 0x2018, 0x2019, 0x201C,
    0x201D, 0x2022, 0x2013, 0x2014, 0x02DC, 0x2122, 0x0161, 0x203A,
    0x0153, 0x017E, 0x0178,
]);

/**
 * Symbols a question paper actually uses that WinAnsi cannot encode, and what to print instead.
 *
 * A maths paper is full of these - "the value of π", "63π cm³", "∠ABC", "√2" - and every one of them
 * came out as "?" in the standard face, which turns a correct question into a wrong one ("the value
 * of ?"). The stand-ins are what a teacher would type on a keyboard without the symbol: readable,
 * unambiguous, and honest about being a substitute. Superscripts, ×, ÷ and ° are IN WinAnsi and
 * never reach this table. A Unicode font, when configured, bypasses `safeText` entirely.
 */
const SYMBOL_FALLBACK: Record<string, string> = {
    '\u03C0': 'pi', '\u03B8': 'theta', '\u03B1': 'alpha', '\u03B2': 'beta', '\u03B3': 'gamma',
    '\u03B4': 'delta', '\u03BB': 'lambda', '\u03BC': 'mu', '\u03C3': 'sigma', '\u03C9': 'omega',
    '\u03C6': 'phi', '\u03C1': 'rho', '\u03C4': 'tau', '\u0394': 'Delta', '\u03A3': 'Sigma',
    '\u03A9': 'Omega', '\u221A': 'sqrt', '\u221E': 'infinity', '\u2264': '<=', '\u2265': '>=',
    '\u2260': '!=', '\u2248': '~=', '\u2245': '~=', '\u2192': '->', '\u2220': 'angle ',
    '\u25B3': 'triangle ', '\u2234': 'therefore ', '\u2235': 'because ', '\u2212': '-',
    '\u2225': '||', '\u22A5': '_|_', '\u2208': ' in ', '\u222B': 'integral ', '\u2211': 'sum ',
};

export function safeText(text: string): string {
    // Fast path - the overwhelming majority of strings are plain ASCII.
    // eslint-disable-next-line no-control-regex
    if (/^[\x00-\x7F]*$/.test(text)) return text;

    const folded = text.normalize('NFKD').replace(/\p{M}/gu, '');
    let out = '';
    for (const ch of folded) {
        const code = ch.codePointAt(0) ?? 0;
        out += (code <= 0xFF || WINANSI_EXTRAS.has(code)) ? ch : (SYMBOL_FALLBACK[ch] ?? '?');
    }
    return out;
}

/** The Devanagari block. A string containing one of these is a string `safeText` will turn into "?". */
const DEVANAGARI = /[\u0900-\u097F]/;

/** True when `text` carries Devanagari, i.e. the standard face cannot draw it. */
export function hasDevanagari(text: string): boolean {
    return DEVANAGARI.test(text);
}

/**
 * What a caller got when it asked for a Nepali string, and whether it actually got the Nepali.
 *
 * `usedNepali: false` is a DEBT, not a detail: the caller now owes the reader a line saying the
 * document is not in the language it was asked for. See `NO_DEVANAGARI_NOTICE`.
 */
export interface NepaliChoice { text: string; usedNepali: boolean }

/**
 * The line a Nepali document prints on its face when no Devanagari font is configured.
 *
 * It names the two variables on purpose. The person holding the paper cannot fix this, but the
 * person they forward it to can, and a notice that says only "something went wrong" gets thrown
 * away rather than acted on.
 */
export const NO_DEVANAGARI_NOTICE =
    'Printed with English headings. This server has no Nepali font configured, so the Devanagari '
    + 'section names could not be drawn. An administrator fixes this by setting PDF_FONT_REGULAR_URL '
    + 'and PDF_FONT_BOLD_URL on gurukul-services.';

/**
 * Ask for a Nepali string and be told honestly what you are getting.
 *
 * ## Why this exists, and why it returns a flag rather than just a string
 *
 * `packages/pdf/src/lesson-plan-form.ts` used to write `fonts.unicode ? sec.ne : sec.en` inline at
 * every heading. That is a SILENT downgrade, and it shipped: `PDF_FONT_REGULAR_URL` and
 * `PDF_FONT_BOLD_URL` are read by `configurePdfFonts` in `apps/services` and were set nowhere in
 * the repo - not in `wrangler.jsonc`, not in any `.dev.vars` - so in production the पाठ योजना has
 * been coming out entirely in English and looking exactly like a form somebody chose to print in
 * English. The one document a school inspector reads was wrong, and nothing on it said so.
 *
 * ## Why a notice and not a refusal
 *
 * The alternative was to fail the render so the caller could surface an error. Rejected: the
 * teacher cannot fix a server font URL, and refusing means they cannot hand in a lesson plan at
 * all because of somebody else's configuration. An English form is a usable document. A form of
 * "??? ??????" is not, and neither is an English one that pretends to be deliberate. So it prints,
 * in English, and says why on its face.
 *
 * Passing the Devanagari through `safeText` is never an option here: "पाठ योजना" becomes "??? ?????",
 * which is question marks passed off as a heading.
 */
export function nepaliOrEnglish(fonts: Pick<Fonts, 'unicode'>, nepali: string, english: string): NepaliChoice {
    if (fonts.unicode) return { text: nepali, usedNepali: true };
    return { text: english, usedNepali: false };
}

/**
 * Standard fonts, wrapped so every string is sanitised on its way to the encoder.
 *
 * Wrapping the FONT rather than each draw call is the whole point: `layout.ts` alone has 26
 * `drawText` sites and the renderers add more with their own direct draws. Patching each is a list
 * somebody will fall off. There is exactly one path from a string to a glyph - `encodeText` - so
 * that is where the guard belongs.
 *
 * `widthOfTextAtSize` is wrapped with the IDENTICAL transform, and that pairing is load-bearing:
 * measurement drives every centring, right-alignment, wrap and truncation in the toolkit. Measuring
 * the original while drawing the sanitised string would put text in the wrong place on the page.
 */
/**
 * Where the Unicode font is fetched from, and the cached bytes once it has been.
 *
 * ## Why a runtime fetch rather than a bundled font
 *
 * A Devanagari face is 300KB-1MB. `gurukul-services` is a Cloudflare Worker against a 10 MiB
 * gzipped script limit that has already been fought down twice (see docs/worker-bundle-size.md),
 * and a font is the worst kind of thing to spend that budget on: it is inert bytes that most
 * documents never touch. Fetching from R2 keeps the script unchanged.
 *
 * The cost is one fetch per isolate, not per render - the PROMISE is cached at module scope, so
 * concurrent renders on a cold isolate share a single request rather than starting one each.
 */
/**
 * A Devanagari string with a conjunct and a matra - the constructs that break naive shaping.
 * Used to prove a font can actually draw before any renderer depends on it.
 */
const SHAPE_PROBE = 'श्री क';

interface UnicodeFontSource { regular: string; bold: string }

let unicodeFontSource: UnicodeFontSource | null = null;
/**
 * Set once the configured font has been found unusable, so the failure is logged ONCE per isolate.
 *
 * Without it every render logs a full fontkit stack trace - and a misconfigured font URL would
 * bury real errors under thousands of identical traces, which is how a noisy log stops being read.
 */
let unicodeFontBroken = false;
let unicodeFontBytes: Promise<{ regular: Uint8Array; bold: Uint8Array } | null> | null = null;

/**
 * Point the renderer at a Unicode font. Call once at startup.
 *
 * Passing `null` (or never calling this) is a supported state, not a failure: every renderer falls
 * back to the standard fonts plus `safeText`, which is exactly the behaviour before this existed.
 * That fallback is the reason a missing font cannot take document generation down.
 */
export function setUnicodeFontSource(source: UnicodeFontSource | null): void {
    const same = source?.regular === unicodeFontSource?.regular
        && source?.bold === unicodeFontSource?.bold;
    if (same) return;
    unicodeFontSource = source;
    unicodeFontBytes = null;   // a changed source invalidates the cache
    unicodeFontBroken = false; // ...and deserves a fresh attempt
}

/**
 * BOTH faces, or neither.
 *
 * Regular and bold are separate files because they have to be: pdf-lib cannot synthesise a bold
 * weight, so embedding one file for both would make every `bold: true` in this toolkit - every
 * heading, label, total and student name - render at regular weight. A document with no emphasis
 * anywhere reads as broken, so a half-available font falls back entirely rather than shipping that.
 */
async function loadUnicodeFontBytes(): Promise<{ regular: Uint8Array; bold: Uint8Array } | null> {
    if (!unicodeFontSource) return null;
    if (!unicodeFontBytes) {
        const src = unicodeFontSource;
        unicodeFontBytes = (async () => {
            try {
                const [r, b] = await Promise.all([fetch(src.regular), fetch(src.bold)]);
                if (!r.ok || !b.ok) {
                    console.error(`[pdf] unicode font fetch failed: regular ${r.status}, bold ${b.status}`);
                    return null;
                }
                const [rb, bb] = await Promise.all([r.arrayBuffer(), b.arrayBuffer()]);
                return { regular: new Uint8Array(rb), bold: new Uint8Array(bb) };
            } catch (err) {
                // A font that will not load must never fail a document. Falling back to the
                // standard face means a Nepali name prints as "???" - degraded, but the payslip
                // still pays and the other 43 admit cards still print.
                console.error('[pdf] unicode font fetch threw', err);
                return null;
            }
        })();
    }
    return unicodeFontBytes;
}

export async function loadFonts(doc: PDFDocument): Promise<Fonts> {
    // ── Unicode face, when one is configured and reachable ───────────────────
    //
    // The guard below is NOT applied to it, and that is the whole point: `safeText` turns Devanagari
    // into "???" so the standard face cannot throw, and running it over a font that CAN render
    // Devanagari would destroy the text this exists to save.
    const bytes = unicodeFontBroken ? null : await loadUnicodeFontBytes();
    if (bytes) {
        try {
            doc.registerFontkit(fontkit);
            // `subset: true` embeds only the glyphs actually drawn. A full Devanagari face is
            // ~1MB in every document; a school's names and headings are a few hundred glyphs.
            const [regular, bold] = await Promise.all([
                doc.embedFont(bytes.regular, { subset: true }),
                doc.embedFont(bytes.bold, { subset: true }),
            ]);

            // SHAPE-TEST BEFORE TRUSTING IT.
            //
            // Embedding succeeding does not mean the font can draw. fontkit shapes text lazily, at
            // `encodeText` - so a variable font, or one whose GSUB tables it cannot process, embeds
            // cleanly and then throws on the FIRST drawText, inside every renderer, with the
            // document half-built. That is strictly worse than not having the font: a try/catch
            // around embedding alone would have shipped exactly that.
            //
            // Encoding a Devanagari sample here forces the shaping path while there is still
            // somewhere safe to fall back to.
            regular.encodeText(SHAPE_PROBE);
            bold.encodeText(SHAPE_PROBE);

            return { regular, bold, unicode: true };
        } catch (err) {
            // A corrupt or unsupported font file falls through to the standard face rather than
            // failing the document.
            // Covers both a corrupt file and a font that cannot shape - see the probe above.
            // Latched so this logs once, not on every document for the life of the isolate.
            unicodeFontBroken = true;
            console.error('[pdf] unicode font unusable, falling back to Helvetica', err);
        }
    }

    const guard = (font: PDFFont): PDFFont => new Proxy(font, {
        get(target, prop, receiver) {
            if (prop === 'encodeText') {
                return (text: string) => target.encodeText(safeText(text));
            }
            if (prop === 'widthOfTextAtSize') {
                return (text: string, size: number) => target.widthOfTextAtSize(safeText(text), size);
            }
            const value = Reflect.get(target, prop, receiver);
            // Methods must keep their original `this`; a bound proxy would recurse through the trap.
            return typeof value === 'function' ? value.bind(target) : value;
        },
    });

    return {
        regular: guard(await doc.embedFont(FACE.regular)),
        bold: guard(await doc.embedFont(FACE.bold)),
        unicode: false,
    };
}

/** @deprecated Use `loadFonts`. Kept so an in-flight document port does not break. */
export const loadTimes = loadFonts;

export class Cursor {
    page: PDFPage;
    y: number;

    constructor(
        readonly doc: PDFDocument,
        readonly fonts: Fonts,
        readonly margins: Margins = { top: 56, right: 60, bottom: 56, left: 60 },
        readonly size: PageSize = A4,
    ) {
        this.page = doc.addPage([size.width, size.height]);
        this.y = size.height - margins.top;
    }

    /** Usable width between the margins. */
    get contentWidth(): number {
        return this.size.width - this.margins.left - this.margins.right;
    }

    get left(): number { return this.margins.left }
    get right(): number { return this.size.width - this.margins.right }

    /**
     * Guarantee `needed` points of vertical room, starting a new page if not.
     * Every primitive calls this BEFORE drawing - pdf-lib will happily draw at a negative y,
     * producing a file that looks fine to the writer and is blank to the reader.
     */
    ensure(needed: number): void {
        if (this.y - needed >= this.margins.bottom) return;
        this.page = this.doc.addPage([this.size.width, this.size.height]);
        this.y = this.size.height - this.margins.top;
    }

    /**
     * Start a fresh page unconditionally.
     *
     * Distinct from `ensure`, which only breaks when the content will not fit. A banded table
     * needs a hard break: a second band continuing halfway down the page puts two grids with the
     * same student names one above the other, which reads as duplicated rows.
     */
    newPage(): void {
        this.page = this.doc.addPage([this.size.width, this.size.height]);
        this.y = this.size.height - this.margins.top;
    }

    /** Move down without drawing. */
    gap(points: number): void {
        this.y -= points;
    }
}

export interface TextOpts {
    size?: number;
    bold?: boolean;
    color?: RGB;
    /** Extra space added after the line(s). */
    after?: number;
    /** Letter spacing, for the tracked-out titles the certificates use. */
    tracking?: number;
}

function pick(c: Cursor, bold?: boolean): PDFFont {
    return bold ? c.fonts.bold : c.fonts.regular;
}

/**
 * Draw a run of text with manual letter spacing.
 *
 * pdf-lib has no `letterSpacing`, and the certificate titles are tracked out by 2pt. Drawing glyph
 * by glyph is the only way, so it is confined here.
 */
function drawTracked(c: Cursor, text: string, x: number, y: number, font: PDFFont, size: number, color: RGB, tracking: number): number {
    let cx = x;
    for (const ch of text) {
        c.page.drawText(ch, { x: cx, y, size, font, color });
        cx += font.widthOfTextAtSize(ch, size) + tracking;
    }
    return cx - x - tracking;
}

export function measure(c: Cursor, text: string, opts: TextOpts = {}): number {
    const size = opts.size ?? 11;
    const font = pick(c, opts.bold);
    const base = font.widthOfTextAtSize(text, size);
    return opts.tracking ? base + opts.tracking * Math.max(0, text.length - 1) : base;
}

/**
 * Split `text` into lines that each fit within `maxWidth`. Long single words are left intact.
 *
 * An explicit `\n` is an explicit break and is honoured. It has to be: table cells use it to put a
 * muted detail line under a title ("Credit Top-up" over its description), and collapsing it into
 * surrounding whitespace ran the two together into one sentence that read as a single label.
 */
export function wrap(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
    const lines: string[] = [];
    for (const segment of text.split('\n')) {
        const words = segment.split(/\s+/).filter(Boolean);
        if (words.length === 0) {
            lines.push('');
            continue;
        }
        let line = words[0]!;
        for (const word of words.slice(1)) {
            const candidate = `${line} ${word}`;
            if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
                line = candidate;
            } else {
                lines.push(line);
                line = word;
            }
        }
        lines.push(line);
    }
    return lines;
}

/** A left-aligned paragraph, wrapped to the content width. */
export function paragraph(c: Cursor, text: string, opts: TextOpts = {}): void {
    const size = opts.size ?? 11;
    const font = pick(c, opts.bold);
    const leading = size * 1.6;
    for (const line of wrap(font, text, size, c.contentWidth)) {
        c.ensure(leading);
        c.page.drawText(line, { x: c.left, y: c.y - size, size, font, color: opts.color ?? INK.body });
        c.y -= leading;
    }
    if (opts.after) c.gap(opts.after);
}

/** A single centred line. */
export function centered(c: Cursor, text: string, opts: TextOpts = {}): void {
    const size = opts.size ?? 11;
    const font = pick(c, opts.bold);
    const leading = size * 1.5;
    c.ensure(leading);
    const width = measure(c, text, opts);
    const x = c.left + (c.contentWidth - width) / 2;
    if (opts.tracking) {
        drawTracked(c, text, x, c.y - size, font, size, opts.color ?? INK.body, opts.tracking);
    } else {
        c.page.drawText(text, { x, y: c.y - size, size, font, color: opts.color ?? INK.body });
    }
    c.y -= leading;
    if (opts.after) c.gap(opts.after);
}

/** A horizontal rule across the content width. */
export function rule(c: Cursor, thickness = 0.5, color: RGB = INK.rule, after = 0): void {
    c.ensure(thickness + after);
    c.page.drawLine({
        start: { x: c.left, y: c.y },
        end: { x: c.right, y: c.y },
        thickness,
        color,
    });
    c.y -= thickness + after;
}

/** Underline a centred title - pdf-lib has no text-decoration. */
export function underlineCentered(c: Cursor, text: string, opts: TextOpts = {}): void {
    const size = opts.size ?? 11;
    const width = measure(c, text, opts);
    const x = c.left + (c.contentWidth - width) / 2;
    centered(c, text, { ...opts, after: 0 });
    // `centered` already moved the cursor past the line; sit the rule just under the baseline.
    c.page.drawLine({
        start: { x, y: c.y + size * 0.5 - 2 },
        end: { x: x + width, y: c.y + size * 0.5 - 2 },
        thickness: 0.8,
        color: opts.color ?? INK.body,
    });
    if (opts.after) c.gap(opts.after);
}

/** Two texts on one line, pushed to the outer margins. */
/**
 * A bold label and its value on the left, another pair right-aligned on the right.
 *
 * ## The gap is load-bearing
 *
 * This drew the value at exactly `label width`, with nothing between them, so every caller rendered
 * "TeacherRam Bahadur" and "Published15 Poush 2082" - the label and the value run together as one
 * word. It reads as a typo on a document a parent or an inspector is holding.
 *
 * Callers cannot fix it by padding their own strings: a trailing space is trimmed by some font
 * metrics paths and, more to the point, every one of the twenty-odd renderers would have to
 * remember. The separator belongs here, once.
 *
 * Sized from the font rather than hardcoded so it stays proportional at any `size`.
 */
export function spread(c: Cursor, leftText: { label: string; value: string }, rightText: { label: string; value: string }, size = 10.5): void {
    const leading = size * 1.5;
    c.ensure(leading);
    const y = c.y - size;
    const gap = c.fonts.regular.widthOfTextAtSize('  ', size);

    const lw = c.fonts.bold.widthOfTextAtSize(leftText.label, size);
    c.page.drawText(leftText.label, { x: c.left, y, size, font: c.fonts.bold, color: INK.body });
    c.page.drawText(leftText.value, { x: c.left + lw + gap, y, size, font: c.fonts.regular, color: INK.body });

    const rlw = c.fonts.bold.widthOfTextAtSize(rightText.label, size);
    const rvw = c.fonts.regular.widthOfTextAtSize(rightText.value, size);
    // The right pair stays flush to the right margin, so the gap comes out of its start position
    // rather than pushing the value off the page.
    const startX = c.right - (rlw + gap + rvw);
    c.page.drawText(rightText.label, { x: startX, y, size, font: c.fonts.bold, color: INK.body });
    c.page.drawText(rightText.value, { x: startX + rlw + gap, y, size, font: c.fonts.regular, color: INK.body });
    c.y -= leading;
}

export interface FieldRow { label: string; value: string }

/**
 * The label/value table every certificate uses: muted label on the left, bold value on the right,
 * hairline rule under each row.
 *
 * A long value WRAPS rather than overflowing into the margin, and the row grows to fit - which is
 * what the react-pdf version did via flexbox and is the one behaviour worth preserving exactly,
 * since addresses and reasons-for-leaving are free text.
 */
export function fieldTable(c: Cursor, rows: FieldRow[], opts: { size?: number; labelWidth?: number } = {}): void {
    const size = opts.size ?? 10.5;
    const labelWidth = opts.labelWidth ?? c.contentWidth * 0.42;
    const valueWidth = c.contentWidth - labelWidth;
    const padY = 5;

    for (const row of rows) {
        const valueLines = wrap(c.fonts.bold, row.value, size, valueWidth);
        const labelLines = wrap(c.fonts.regular, row.label, size, labelWidth);
        const lineCount = Math.max(valueLines.length, labelLines.length, 1);
        const leading = size * 1.35;
        const rowHeight = lineCount * leading + padY * 2;

        c.ensure(rowHeight);
        let y = c.y - padY - size;
        for (let i = 0; i < lineCount; i++) {
            if (labelLines[i]) {
                c.page.drawText(labelLines[i]!, { x: c.left, y, size, font: c.fonts.regular, color: INK.muted });
            }
            if (valueLines[i]) {
                c.page.drawText(valueLines[i]!, { x: c.left + labelWidth, y, size, font: c.fonts.bold, color: INK.body });
            }
            y -= leading;
        }
        c.y -= rowHeight;
        c.page.drawLine({
            start: { x: c.left, y: c.y },
            end: { x: c.right, y: c.y },
            thickness: 0.5,
            color: INK.rule,
        });
    }
}

/**
 * A stack of lines at an arbitrary x, optionally right-aligned to it.
 *
 * This is the "block" the invoices and receipts are built from - a small uppercase label with a
 * bold value and some muted detail under it, appearing top-left and top-right of a header. It does
 * NOT move the shared cursor, because two of these sit side by side; the caller advances past the
 * taller one using the returned height.
 */
export function block(
    c: Cursor,
    x: number,
    lines: { text: string; size?: number; bold?: boolean; color?: RGB; gapAfter?: number }[],
    align: 'left' | 'right' = 'left',
): number {
    let y = c.y;
    for (const line of lines) {
        const size = line.size ?? 9;
        const font = line.bold ? c.fonts.bold : c.fonts.regular;
        const w = font.widthOfTextAtSize(line.text, size);
        c.page.drawText(line.text, {
            x: align === 'right' ? x - w : x,
            y: y - size,
            size,
            font,
            color: line.color ?? INK.body,
        });
        y -= size * 1.45 + (line.gapAfter ?? 0);
    }
    return c.y - y;
}

/** A small tinted pill - the PAID / OVERDUE status chips. */
export function pill(c: Cursor, text: string, x: number, y: number, fill: RGB, textColor: RGB, size = 8): void {
    const w = c.fonts.bold.widthOfTextAtSize(text, size) + 16;
    const h = size + 8;
    c.page.drawRectangle({ x: x - w, y: y - h, width: w, height: h, color: fill, borderWidth: 0 });
    c.page.drawText(text, { x: x - w + 8, y: y - h + 5, size, font: c.fonts.bold, color: textColor });
}

// ─── Column tables ──────────────────────────────────────────────────────────────────────────────

export interface Column {
    header: string;
    /** Share of the content width, 0-1. Must sum to 1 across the table. */
    width: number;
    align?: 'left' | 'right' | 'center';
    /**
     * Points to hold back from this column's right edge, for a right-aligned column that is NOT
     * the last one.
     *
     * A right-aligned cell ends exactly where the next column begins, so with no gutter the two
     * touch: the lesson-plan sheet printed its header as "TimeActivity" and its rows as
     * "10 minHop along the line". Opt-in rather than a default, because for a trailing money
     * column - which is most right-aligned columns in this package - flush against the margin is
     * correct and a gutter would visibly shift every invoice.
     */
    gutterRight?: number;
}

/**
 * Extra content that belongs to a row and is drawn underneath its text.
 *
 * The height is declared BEFORE anything is drawn, so the row and its extra are measured as one
 * block and break onto a new page together. That pairing is the whole point: a lesson plan's
 * diagram left to be drawn after the row would sit at the foot of a page and spill over the
 * bottom margin, invisible, which is exactly the split `repeatHeader` and `ensure` exist to stop.
 */
export interface RowExtra {
    /** Points of vertical room to reserve. The table advances the cursor by exactly this. */
    height: number;
    /**
     * Draw into the box whose top-left is `(c.left, top)` and which is `height` tall.
     * Must not move the cursor - the table owns it.
     */
    draw: (page: PDFPage, top: number) => void;
}

export interface TableOpts {
    size?: number;
    /** Tint behind the header row. */
    headerFill?: RGB;
    /** Repeat the header when the table breaks onto a new page. */
    repeatHeader?: boolean;
    /** Drawn in bold with a rule above - totals rows. */
    emphasiseLast?: boolean;
    /**
     * Content drawn under row `rowIndex`, inside that row's band and above its bottom rule.
     * Return `null` for a row that has none, which is the normal case.
     */
    rowExtra?: (rowIndex: number) => RowExtra | null;
}

function alignedX(
    c: Cursor, text: string, font: PDFFont, size: number, x: number, w: number,
    align: Column['align'], gutterRight = 0,
): number {
    if (align === 'right') return x + w - gutterRight - font.widthOfTextAtSize(text, size);
    if (align === 'center') return x + (w - font.widthOfTextAtSize(text, size)) / 2;
    return x;
}

/**
 * A multi-column table: the shape every receipt, invoice, statement and mark sheet needs.
 *
 * Right alignment matters more than it looks - these are money and marks columns, and a ragged
 * right edge on a column of figures is the difference between a document a parent can check and
 * one they cannot. `align: 'right'` measures each cell and positions it against the column's right
 * edge, which is the thing flexbox was doing for us before.
 *
 * Rows break across pages, and with `repeatHeader` the header is redrawn on each - a fee statement
 * running to two pages is otherwise a wall of unlabelled numbers on page two.
 */
export function table(c: Cursor, columns: Column[], rows: string[][], opts: TableOpts = {}): void {
    const size = opts.size ?? 9.5;
    const padY = 5;
    const leading = size * 1.35;
    const widths = columns.map((col) => col.width * c.contentWidth);
    // Left edge of each column: the running sum of the widths before it. Written as a plain loop
    // because the reduce this replaced was off by one column - it produced [left, left, left+w0],
    // so column 2 started at column 1's origin and the money column overlapped the description.
    const xs: number[] = [];
    let runningX = c.left;
    for (const w of widths) {
        xs.push(runningX);
        runningX += w;
    }

    const drawHeader = () => {
        const h = leading + padY * 2;
        c.ensure(h);
        if (opts.headerFill) {
            c.page.drawRectangle({ x: c.left, y: c.y - h, width: c.contentWidth, height: h, color: opts.headerFill });
        }
        const y = c.y - padY - size;
        columns.forEach((col, i) => {
            c.page.drawText(col.header, {
                x: alignedX(c, col.header, c.fonts.bold, size, xs[i]!, widths[i]!, col.align, col.gutterRight),
                y, size, font: c.fonts.bold, color: INK.body,
            });
        });
        c.y -= h;
        c.page.drawLine({ start: { x: c.left, y: c.y }, end: { x: c.right, y: c.y }, thickness: 0.8, color: INK.body });
    };

    drawHeader();

    rows.forEach((row, rowIndex) => {
        const isLast = opts.emphasiseLast && rowIndex === rows.length - 1;
        const font = isLast ? c.fonts.bold : c.fonts.regular;
        // Wrap every cell first so the row is as tall as its tallest cell, rather than clipping.
        const wrapped = row.map((cell, i) => wrap(font, cell ?? '', size, widths[i]! - 6));
        const lineCount = Math.max(1, ...wrapped.map((w) => w.length));
        const h = lineCount * leading + padY * 2;
        const extra = opts.rowExtra?.(rowIndex) ?? null;

        // The row and its extra are measured together, then broken before either is drawn. Clamped
        // to one page's content height so a block taller than any page costs one break rather than
        // a blank page followed by the same overflow.
        const contentH = c.size.height - c.margins.top - c.margins.bottom;
        if (c.y - (h + (extra?.height ?? 0)) < c.margins.bottom) {
            c.ensure(Math.min(h + (extra?.height ?? 0), contentH));
            if (opts.repeatHeader) drawHeader();
        }

        if (isLast) {
            c.page.drawLine({ start: { x: c.left, y: c.y }, end: { x: c.right, y: c.y }, thickness: 0.8, color: INK.body });
        }

        let y = c.y - padY - size;
        for (let line = 0; line < lineCount; line++) {
            columns.forEach((col, i) => {
                const text = wrapped[i]?.[line];
                if (!text) return;
                c.page.drawText(text, {
                    x: alignedX(c, text, font, size, xs[i]!, widths[i]!, col.align, col.gutterRight),
                    y, size, font, color: INK.body,
                });
            });
            y -= leading;
        }
        c.y -= h;

        // Inside the row's band, so the bottom rule closes under the extra rather than cutting
        // between a row and the thing that belongs to it.
        if (extra) {
            extra.draw(c.page, c.y);
            c.y -= extra.height;
        }

        if (!isLast) {
            c.page.drawLine({ start: { x: c.left, y: c.y }, end: { x: c.right, y: c.y }, thickness: 0.4, color: INK.rule });
        }
    });
}

/** A tinted panel with a label and a value - the "Total Due" style callout boxes. */
export function calloutBox(c: Cursor, label: string, value: string, opts: { fill?: RGB; size?: number; after?: number } = {}): void {
    const size = opts.size ?? 11;
    const h = size * 2.8;
    c.ensure(h + (opts.after ?? 0));
    c.page.drawRectangle({
        x: c.left, y: c.y - h, width: c.contentWidth, height: h,
        color: opts.fill ?? INK.rule,
    });
    const y = c.y - h / 2 - size * 0.35;
    c.page.drawText(label, { x: c.left + 12, y, size, font: c.fonts.bold, color: INK.body });
    const vw = c.fonts.bold.widthOfTextAtSize(value, size);
    c.page.drawText(value, { x: c.right - 12 - vw, y, size, font: c.fonts.bold, color: INK.body });
    c.y -= h;
    if (opts.after) c.gap(opts.after);
}

/** A label/value pair placed side by side, for the two-column header blocks. */
export function twoColumnFields(c: Cursor, left: FieldRow[], right: FieldRow[], size = 9.5): void {
    const rows = Math.max(left.length, right.length);
    const half = c.contentWidth / 2;
    const leading = size * 1.5;
    for (let i = 0; i < rows; i++) {
        c.ensure(leading);
        const y = c.y - size;
        const l = left[i];
        const r = right[i];
        if (l) {
            c.page.drawText(l.label, { x: c.left, y, size, font: c.fonts.regular, color: INK.muted });
            c.page.drawText(l.value, { x: c.left + half * 0.45, y, size, font: c.fonts.bold, color: INK.body });
        }
        if (r) {
            c.page.drawText(r.label, { x: c.left + half, y, size, font: c.fonts.regular, color: INK.muted });
            c.page.drawText(r.value, { x: c.left + half * 1.45, y, size, font: c.fonts.bold, color: INK.body });
        }
        c.y -= leading;
    }
}

/** Right-aligned text at the current cursor - totals lines that sit under a table. */
export function rightText(c: Cursor, text: string, opts: TextOpts = {}): void {
    const size = opts.size ?? 11;
    const font = pick(c, opts.bold);
    const leading = size * 1.5;
    c.ensure(leading);
    c.page.drawText(text, {
        x: c.right - font.widthOfTextAtSize(text, size),
        y: c.y - size, size, font, color: opts.color ?? INK.body,
    });
    c.y -= leading;
    if (opts.after) c.gap(opts.after);
}

/**
 * A horizontal bar with a label, a value and an optional trailing note - the subject-performance
 * chart. pdf-lib has no charting, and it does not need any: a bar is a filled rectangle whose
 * width is a fraction of the track.
 */
export function hbar(
    c: Cursor,
    opts: {
        label: string;
        sub?: string;
        /** 0-100. */
        percent: number;
        value: string;
        note?: string;
        fill: RGB;
        track?: RGB;
    },
): void {
    const rowH = 18;
    c.ensure(rowH);
    const labelW = 118;
    const valueW = 34;
    const noteW = opts.note ? 118 : 0;
    const trackX = c.left + labelW + 6;
    const trackW = c.contentWidth - labelW - valueW - noteW - 18;
    const y = c.y - 12;

    c.page.drawText(opts.label, { x: c.left, y, size: 8.5, font: c.fonts.bold, color: INK.body });
    if (opts.sub) {
        c.page.drawText(opts.sub, { x: c.left, y: y - 8, size: 7, font: c.fonts.regular, color: INK.faint });
    }

    c.page.drawRectangle({ x: trackX, y: y - 1, width: trackW, height: 8, color: opts.track ?? INK.rule });
    // Clamped: a percentage above 100 would otherwise draw past the track and look like a
    // rendering fault rather than an outlier.
    const w = Math.max(0, Math.min(100, opts.percent)) / 100 * trackW;
    if (w > 0) c.page.drawRectangle({ x: trackX, y: y - 1, width: w, height: 8, color: opts.fill });

    const vw = c.fonts.bold.widthOfTextAtSize(opts.value, 8.5);
    c.page.drawText(opts.value, { x: trackX + trackW + 6 + valueW - vw, y, size: 8.5, font: c.fonts.bold, color: INK.body });

    if (opts.note) {
        const nw = c.fonts.regular.widthOfTextAtSize(opts.note, 7.5);
        c.page.drawText(opts.note, { x: c.right - nw, y, size: 7.5, font: c.fonts.regular, color: INK.muted });
    }
    c.y -= rowH;
}

/** The brand gold, the only non-neutral accent these documents are allowed. */
export const GOLD = rgb(0.659, 0.498, 0.122);        // #a87f1f
export const GOLD_LIGHT = rgb(0.788, 0.663, 0.380);  // #c9a961

/** A tinted full-width band with a label - the "Income" / "Expenditure" section rows. */
export function sectionBar(c: Cursor, label: string, fill: RGB, size = 9.5): void {
    const h = size + 10;
    c.ensure(h);
    c.page.drawRectangle({ x: c.left, y: c.y - h, width: c.contentWidth, height: h, color: fill });
    c.page.drawText(label, { x: c.left + 8, y: c.y - h + 6, size, font: c.fonts.bold, color: INK.body });
    c.y -= h;
}

export interface DocumentHeaderOpts {
    school: { name: string; logo: string | null; address: string | null; phone: string | null; email: string | null };
    /** Right-hand stack: a label, then any number of detail lines. */
    badge: { label: string; ref?: string; lines?: string[] };
    /** Optional status chip under the badge. */
    chip?: { text: string; fill: RGB; color: RGB };
    /** A gold hairline under the header - the finance statements use it, invoices do not. */
    goldRule?: boolean;
}

/**
 * The masthead every finance document shares: school identity on the left, document reference on
 * the right, optional status chip and rule underneath.
 *
 * The two sides are naturally different heights, so this advances the cursor past the TALLER of
 * them. Getting that wrong is how a header silently overlaps the block below it on the one invoice
 * where the school has a long address.
 */
export async function documentHeader(c: Cursor, doc: PDFDocument, opts: DocumentHeaderOpts): Promise<void> {
    const logo = await embedLogo(doc, opts.school.logo);
    if (logo) {
        const scale = Math.min(38 / logo.width, 38 / logo.height);
        c.page.drawImage(logo.image, {
            x: c.left, y: c.y - logo.height * scale,
            width: logo.width * scale, height: logo.height * scale,
        });
        c.gap(logo.height * scale + 5);
    }

    const contact = [opts.school.phone, opts.school.email].filter(Boolean).join('  ·  ');
    const leftH = block(c, c.left, [
        { text: opts.school.name, size: 16, bold: true },
        ...(opts.school.address ? [{ text: opts.school.address, size: 8.5, color: INK.faint }] : []),
        ...(contact ? [{ text: contact, size: 8.5, color: INK.faint }] : []),
    ]);

    const rightH = block(c, c.right, [
        { text: opts.badge.label.toUpperCase(), size: 9, color: INK.faint },
        ...(opts.badge.ref ? [{ text: opts.badge.ref, size: 12, bold: true }] : []),
        ...(opts.badge.lines ?? []).map((t) => ({ text: t, size: 8.5, color: INK.faint })),
    ], 'right');

    let extra = 0;
    if (opts.chip) {
        pill(c, opts.chip.text, c.right, c.y - rightH - 2, opts.chip.fill, opts.chip.color);
        extra = 20;
    }

    c.gap(Math.max(leftH, rightH + extra) + 14);
    rule(c, opts.goldRule ? 1.5 : 1, opts.goldRule ? GOLD : INK.rule, 16);
}

/**
 * Stamp a footer on EVERY page, with page numbers.
 *
 * react-pdf did this with `fixed` and a `render={({pageNumber, totalPages}) => ...}` callback.
 * pdf-lib has no such concept - a page is drawn once and never revisited - so this runs as a pass
 * over the finished document, when the page count is finally known. Call it last.
 */
export function stampFooter(doc: PDFDocument, fonts: Fonts, text: string, margins: Margins = { top: 56, right: 50, bottom: 44, left: 50 }): void {
    const pages = doc.getPages();
    pages.forEach((page, i) => {
        const size = 7.5;
        const y = margins.bottom - 16;
        page.drawText(text, { x: margins.left, y, size, font: fonts.regular, color: INK.faint });
        const num = `Page ${i + 1} of ${pages.length}`;
        const w = fonts.regular.widthOfTextAtSize(num, size);
        page.drawText(num, { x: page.getWidth() - margins.right - w, y, size, font: fonts.regular, color: INK.faint });
    });
}

/**
 * Embed a logo from a URL.
 *
 * Returns null rather than throwing on anything that goes wrong - a school with a broken logo URL
 * must still be able to issue a transfer certificate. react-pdf behaved the same way, and a
 * certificate that fails to generate is far worse than one missing a crest.
 *
 * Only PNG and JPEG are attempted: those are the two formats pdf-lib can embed, and sniffing the
 * magic bytes is more reliable than trusting a Content-Type or a file extension.
 */
export async function embedLogo(doc: PDFDocument, url: string | null): Promise<{ image: Awaited<ReturnType<PDFDocument['embedPng']>>; width: number; height: number } | null> {
    if (!url) return null;
    try {
        // Logos, signatures and stamps are stored as R2 KEYS since every upload moved to R2
        // (plan/repo/compliance/launch-readiness.md B1); legacy rows may still hold a full URL.
        // A key is signed for a few minutes here, which is all one render needs.
        const href = /^(https?:|data:)/i.test(url) ? url : await getSignedDownloadUrl(url, 300);
        const res = await fetch(href);
        if (!res.ok) return null;
        const bytes = new Uint8Array(await res.arrayBuffer());
        const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
        const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
        if (!isPng && !isJpg) return null;
        const image = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
        return { image, width: image.width, height: image.height };
    } catch {
        return null;
    }
}

/** What `embedRaster` hands back: the pdf-lib image plus the pixel dimensions to scale from. */
export interface EmbeddedRaster { image: Awaited<ReturnType<PDFDocument['embedPng']>>; width: number; height: number }

/**
 * Embed a raster image the caller already holds, as base64.
 *
 * ## Why base64 and not a URL
 *
 * `embedLogo` above fetches, and that is right for a school crest: one small file, one document,
 * and a broken URL should cost a crest and nothing else. A generated lesson figure is a different
 * shape of problem. It lives in a private R2 bucket, so the renderer would need a signed URL that
 * expires; the same figure can appear on two pages, so the renderer would fetch it twice; and the
 * fetch failing inside `embedLogo` is swallowed with no log, so a batch of plans could quietly
 * print without their pictures and nobody would know. Fetching in `apps/main`, where the
 * `lesson_figures` row already is, fixes all three: one fetch per distinct figure, a logged
 * failure, and a renderer that does no I/O at all.
 *
 * The cost is real and worth stating: the bytes cross the worker-to-worker JSON boundary base64'd,
 * about 4/3 their size. Measured on plan `cmtuapfoentzgl6ict65tv6`, the five printable figures are
 * 1.1-1.2 MB each, so roughly 6 MB of base64 on a request that would otherwise be a few hundred KB.
 * If that ever becomes the binding constraint, the answer is to pass signed URLs again and fetch
 * here - not to drop pictures silently.
 *
 * Returns null rather than throwing, on the same principle as `embedLogo`: a plan missing one
 * picture is a document; a plan that failed to render is not.
 */
export async function embedRaster(doc: PDFDocument, base64: string, mime: string): Promise<EmbeddedRaster | null> {
    try {
        // `atob` rather than `Buffer`: this runs in a Worker as well as in Node, and the Worker
        // build must not depend on a node polyfill for something this small.
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        // The magic bytes decide, not the declared mime: `mimeType` on the row is whatever the
        // generator claimed, and pdf-lib throws rather than guessing if it is told the wrong one.
        const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
        const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
        if (!isPng && !isJpg) {
            console.error(`[pdf] raster figure is neither PNG nor JPEG (declared ${mime}); not drawn`);
            return null;
        }
        const image = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
        return { image, width: image.width, height: image.height };
    } catch (err) {
        console.error('[pdf] raster figure could not be embedded', err);
        return null;
    }
}

/**
 * Draw an embedded image centred, scaled to fit inside `box` while keeping its aspect ratio.
 *
 * `maxHeight` defaults to `box`, i.e. a square bound, which is what every caller before the lesson
 * figures wanted. A generated figure passes the two separately: it may use the full content width,
 * but a 1024x1024 picture scaled to a 475pt column is 475pt tall and eats two thirds of an A4 page
 * on its own, which pushes the page's own text onto the next sheet.
 */
export function centeredImage(
    c: Cursor,
    embedded: { image: Parameters<PDFPage['drawImage']>[0]; width: number; height: number },
    box: number,
    after = 8,
    maxHeight = box,
): void {
    const scale = Math.min(box / embedded.width, maxHeight / embedded.height);
    const w = embedded.width * scale;
    const h = embedded.height * scale;
    c.ensure(h + after);
    c.page.drawImage(embedded.image, {
        x: c.left + (c.contentWidth - w) / 2,
        y: c.y - h,
        width: w,
        height: h,
    });
    c.y -= h + after;
}
