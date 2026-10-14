/**
 * Splitting Sarvam Doc AI's HTML into the three things it actually contains.
 *
 * ## Why this is a parser and not a regex at the call site
 *
 * A real two-page run on the Class 10 Science and Technology scan (2026-09-08) measured:
 *
 * | Part of the response                  | Size    |
 * |---------------------------------------|---------|
 * | base64 image data                     | 246 KB  |
 * | all markup and CSS                    | 20 KB   |
 * | body prose, the only embeddable part  | 2.9 KB  |
 *
 * So 92.4% of the payload by weight is pictures. On a 430-page book that is hundreds of megabytes,
 * and ONE of those data URIs dropped into an embedding call exceeds the input limit on its own. The
 * separation therefore has to happen before anything downstream sees the string, which makes it a
 * parsing step with its own tests rather than a `.replace()` somebody remembers to write.
 *
 * ## The three streams, and why they are not equally trusted
 *
 * 1. `prose` - the paragraphs and the section titles. THIS is what gets embedded.
 * 2. `figures[].caption` - the caption PRINTED IN THE BOOK (`figcaption.image-caption`). Ground
 *    truth, short, and it names the figure, so it is embedded with the prose where it sits.
 * 3. `figures[].description` - the description the vision model WROTE into `alt`. Never embedded.
 *    Of the four in the test run, one was excellent, one looped the same sentence three times and
 *    hedged with "probably", one came back in English with Nepali requested and called Devanagari
 *    "Hindi script", and one invented a binary string that is not a binary number. One in four
 *    correct and four in four fluent is the ratio that puts confident fiction into a vector index,
 *    so these go to a human review queue instead.
 *
 * ## Page furniture is dropped by class, and then again by string
 *
 * Sarvam labels `p.page-number` and `footer.footer`, which is enough on most pages. On page one of
 * the test the running footer "विज्ञान तथा प्रविधि: कक्षा १०" was swallowed INTO a figcaption
 * instead, so class alone is not enough and `runningFooter` exists to strip it from caption text.
 */

/** One figure lifted off a page: the bytes, what the book called it, what the model said about it. */
export interface SarvamFigure {
	/** 1-based position of this figure within its page, in document order. */
	positionOnPage: number;
	/** Decoded image bytes, ready for R2. Never re-encoded as text. */
	bytes: Uint8Array;
	mimeType: string;
	/** The caption printed in the book. Ground truth. Null when the figure had none. */
	caption: string | null;
	/** What the vision model wrote. Fluent, sometimes wrong. Never embedded. */
	description: string | null;
	/**
	 * Which language the description actually came back in, NOT the one we asked for. One of the
	 * four in the test run ignored the requested Nepali and answered in English, so anything that
	 * assumes the requested language is wrong on real data.
	 */
	descriptionLang: 'ne' | 'en' | 'unknown';
}

export interface SarvamPage {
	/** Embeddable text: paragraphs and section titles, in reading order, one block per line. */
	prose: string;
	/** Section titles found on this page, in order. Chunk boundaries the raw scan never had. */
	headings: string[];
	figures: SarvamFigure[];
	/** The page number printed on the page, when one was found. Devanagari digits are converted. */
	printedPageNumber: number | null;
}

export interface ParseSarvamOptions {
	/**
	 * The book's running footer, if known, so it can be removed where it leaks into a caption
	 * rather than into `footer.footer`.
	 */
	runningFooter?: string;
}

const DEVANAGARI_DIGITS = '०१२३४५६७८९';

/** "३१५" -> 315. Returns null for anything that is not entirely digits. */
export function parseDevanagariInt(raw: string): number | null {
	const t = raw.trim();
	if (!t) return null;
	let out = '';
	for (const ch of t) {
		const d = DEVANAGARI_DIGITS.indexOf(ch);
		if (d >= 0) { out += String(d); continue; }
		if (ch >= '0' && ch <= '9') { out += ch; continue; }
		return null;
	}
	return out ? Number(out) : null;
}

const ENTITIES: Record<string, string> = {
	'&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#34;': '"', '&#39;': "'", '&apos;': "'",
};

export function decodeEntities(s: string): string {
	return s
		.replace(/&(?:nbsp|amp|lt|gt|quot|apos|#34|#39);/g, (m) => ENTITIES[m] ?? m)
		.replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
		.replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)));
}

/**
 * Inside a paragraph a `<br/>` is where the SCAN LINE wrapped, not a real break. Joining with a
 * space is right for Devanagari, which does not hyphenate. Turning them into newlines instead - as
 * the older `sarvamHtmlToText` does - chops every sentence into 60-character fragments and the
 * chunker then embeds the fragments.
 */
function inlineText(html: string): string {
	return decodeEntities(
		html
			.replace(/<br\s*\/?>/gi, ' ')
			.replace(/<[^>]*>/g, ''),
	).replace(/\s+/g, ' ').trim();
}

/**
 * Attribute reader that tolerates a `>` inside the value.
 *
 * `<[^>]+>` is the obvious way to strip a tag and it is wrong here: an `alt` reading "5 > 3" ends
 * the match early and leaves the rest of the base64 in the output. Sarvam escapes entities today,
 * so this has not bitten yet, and a maths caption is exactly where it would.
 */
function readAttr(tag: string, name: string): string | null {
	const re = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i');
	const m = re.exec(tag);
	if (!m) return null;
	return decodeEntities(m[2] ?? m[3] ?? '');
}

/** Matches a whole `<img ...>` tag, quote-aware so a `>` inside an attribute cannot end it early. */
const IMG_TAG = /<img\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi;

const DATA_URI = /^data:([\w.+-]+\/[\w.+-]+);base64,([A-Za-z0-9+/=\s]+)$/;

function decodeBase64(b64: string): Uint8Array {
	const clean = b64.replace(/\s+/g, '');
	// atob exists in workers, browsers and node >= 16. Buffer does not exist in workers.
	const bin = atob(clean);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
	return out;
}

/** Devanagari present and no long run of ASCII words -> Nepali. Cheap, and only used as a label. */
function detectLang(text: string): 'ne' | 'en' | 'unknown' {
	if (!text) return 'unknown';
	const devanagari = (text.match(/[ऀ-ॿ]/g) ?? []).length;
	const latin = (text.match(/[A-Za-z]/g) ?? []).length;
	if (devanagari === 0 && latin === 0) return 'unknown';
	return devanagari >= latin ? 'ne' : 'en';
}

/** Split the document into its `page-body-container` blocks - one per source page, in order. */
export function splitPageContainers(html: string): string[] {
	const body = html.slice(Math.max(0, html.indexOf('</style>')));
	const out: string[] = [];
	const open = /<div\b[^>]*class="[^"]*\bpage-body-container\b[^"]*"[^>]*>/gi;
	let m: RegExpExecArray | null;
	const starts: number[] = [];
	while ((m = open.exec(body)) !== null) starts.push(m.index + m[0].length);
	for (let i = 0; i < starts.length; i += 1) {
		const from = starts[i] ?? 0;
		const nextStart = starts[i + 1];
		const end = nextStart === undefined ? body.length : body.lastIndexOf('<div', nextStart);
		out.push(body.slice(from, Math.max(from, end)));
	}
	return out;
}

/** Blocks whose text is page furniture and must never reach a chunk. */
const DROP_CLASS = /\b(page-number|footer|header)\b/;

/**
 * One page container in, three streams out.
 *
 * Order is preserved: prose blocks and captions come out in the order they appear, so a caption
 * embeds next to the paragraph that refers to it rather than at the end of the page.
 */
export function parseSarvamPage(container: string, options: ParseSarvamOptions = {}): SarvamPage {
	const figures: SarvamFigure[] = [];
	const headings: string[] = [];
	const proseParts: string[] = [];
	let printedPageNumber: number | null = null;

	// ONE ordered walk over images and block elements together.
	//
	// Doing images first and blocks second looks simpler and gets captions wrong. On page two of
	// the test run the FIRST figure has no caption of its own - its caption is drawn inside the
	// image - so assigning captions to figures in list order handed figure one the caption that
	// belongs to figure two. Attaching a caption to the wrong figure is the exact mislabelling this
	// pipeline exists to avoid, so position has to be respected.
	const EVENT = new RegExp(
		`(${IMG_TAG.source})|<(p|h[1-6]|figcaption|footer)\\b([^>]*)>([\\s\\S]*?)<\\/\\2>`,
		'gi',
	);

	/** The figure a caption would attach to: the most recent one that has not been captioned. */
	let lastFigure = -1;
	let m: RegExpExecArray | null;
	while ((m = EVENT.exec(container)) !== null) {
		const imgTag = m[1];
		if (imgTag) {
			const src = readAttr(imgTag, 'src') ?? '';
			const d = DATA_URI.exec(src);
			if (!d) continue; // a URL rather than a data URI - nothing of ours to store
			let bytes: Uint8Array;
			try { bytes = decodeBase64(d[2] ?? ''); } catch { continue; }
			if (bytes.length === 0) continue;
			const description = readAttr(imgTag, 'alt') || readAttr(imgTag, 'title') || null;
			figures.push({
				positionOnPage: figures.length + 1,
				bytes,
				mimeType: d[1] ?? 'image/jpeg',
				caption: null,
				description,
				descriptionLang: detectLang(description ?? ''),
			});
			lastFigure = figures.length - 1;
			continue;
		}

		const tag = m[2] ?? '';
		const cls = readAttr(`<x ${m[3] ?? ''}>`, 'class') ?? '';
		const text = inlineText(m[4] ?? '');
		if (!text) continue;

		if (DROP_CLASS.test(cls)) {
			if (/\bpage-number\b/.test(cls)) printedPageNumber ??= parseDevanagariInt(text);
			continue;
		}

		if (tag.toLowerCase() === 'figcaption') {
			let caption = text;
			// The running footer leaked INTO a figcaption on page one of the test run, so the
			// class-based drop above never saw it.
			if (options.runningFooter) caption = caption.split(options.runningFooter).join(' ');
			caption = caption.replace(/\s+/g, ' ').trim();
			if (!caption) continue;
			// Attach to the most recent uncaptioned figure. A caption printed ABOVE its figure (page
			// one of the test book does this for the pair) has no figure behind it yet and stays
			// prose-only, which is right: it describes the pair, not one image.
			const target = lastFigure >= 0 ? figures[lastFigure] : undefined;
			if (target && target.caption === null) target.caption = caption;
			proseParts.push(caption);
			continue;
		}

		if (/^h[1-6]$/i.test(tag)) { headings.push(text); proseParts.push(text); continue; }
		proseParts.push(text);
	}

	return { prose: proseParts.join('\n'), headings, figures, printedPageNumber };
}

/** Every page of a whole Sarvam output document, in order. */
export function parseSarvamDocument(html: string, options: ParseSarvamOptions = {}): SarvamPage[] {
	return splitPageContainers(html).map((c) => parseSarvamPage(c, options));
}
