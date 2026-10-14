/**
 * Is this PDF readable by a machine, or is it a photograph of a book?
 *
 * ## Why this is shared and not two copies
 *
 * The worker refuses a scan at EXTRACT, and the admin upload sheet now says the same thing at the
 * moment the file is chosen. Those two must give the SAME answer: an admin told "this is fine"
 * and then shown a red card ten seconds later has been lied to, and the fix would be to change one
 * threshold in two files and eventually change only one. So the thresholds and the verdict live
 * here, and both callers run the same extraction (`unpdf`) into the same function.
 *
 * ## Where the numbers come from
 *
 * Measured across the CDC textbooks: a book with a text layer puts 98-99% of its pages above 200
 * characters (median ~1000-1600 chars/page); a scan puts 0% above it, with 98-100% of pages under
 * 20. There is no middle ground in the sample, which is why a blunt threshold is safe.
 *
 *   Class 9 Computer Science   246 of 248 pages readable   99.19%   digital
 *   Class 10 Science           4 of 465                     0.86%   scan
 *   Class 10 English           ~0 of 200+                     ~0%   scan
 *
 * ## What it deliberately does NOT judge
 *
 * A text layer can be present and still be useless: the CDC Nepali-medium books are typeset in the
 * legacy Preeti encoding, so `pdftotext` yields `xfd|f] egfO` where the page shows "हाम्रो भनाइ".
 * That is a DIFFERENT defect - real text, wrong encoding - and `legacyEncodingShare` reports it
 * separately rather than folding it into the scan verdict, because the two need different fixes
 * (a scan needs OCR; a Preeti book needs transliteration).
 */

/** A page with this much text is carrying body copy rather than a header and a page number. */
export const MIN_PAGE_CHARS = 200;

/** Below this share of readable pages the PDF is a scan, not a document with a text layer. */
export const MIN_TEXT_PAGE_RATIO = 0.5;

export type TextLayerVerdict =
    /** Enough pages carry text. Chunking and embedding will work. */
    | 'digital'
    /** Text exists but is legacy-encoded (Preeti and friends): readable to a human, noise to a model. */
    | 'legacy-encoding'
    /** Some text, but too few pages of it - a scan with a typeset cover and contents page. */
    | 'scan'
    /** Nothing at all came out. */
    | 'empty';

export interface TextLayerReport {
    verdict: TextLayerVerdict;
    totalPages: number;
    readablePages: number;
    /** 0..1. `readablePages / totalPages`, or 0 when there are no pages. */
    ratio: number;
    /** 0..1 share of SAMPLED readable pages that look legacy-encoded. */
    legacyEncodingShare: number;
    /** True when this can be chunked and embedded as it stands. */
    usable: boolean;
    /** One sentence for a person, naming what is wrong and what to do about it. */
    message: string;
}

/**
 * Legacy Nepali encodings (Preeti, Kantipur, PCS Nepali) map Devanagari glyphs onto ASCII, so the
 * extracted text is high-entropy ASCII with almost no real words and no Devanagari at all.
 *
 * The test is deliberately conservative: a page counts as legacy ONLY if it has a decent amount of
 * letters, essentially no Devanagari, AND a very low share of common English words. An English
 * book trips none of it; a Preeti book trips all three.
 */
const COMMON_EN = ['the', 'and', 'of', 'to', 'in', 'is', 'a', 'for', 'that', 'with', 'are', 'this', 'be', 'on', 'as'];

function looksLegacyEncoded(page: string): boolean {
    const letters = page.replace(/[^ऀ-ॿA-Za-z]/g, '');
    if (letters.length < 100) return false;
    const devanagari = (page.match(/[ऀ-ॿ]/g) ?? []).length;
    if (devanagari / letters.length > 0.05) return false;   // real Devanagari: not legacy

    const words = page.toLowerCase().match(/[a-z]+/g) ?? [];
    if (words.length < 40) return false;
    const common = words.filter((w) => COMMON_EN.includes(w)).length;
    // Ordinary English prose runs 15-25% common words. Preeti output runs near zero.
    return common / words.length < 0.02;
}

/**
 * Judge an extracted document. `pages` is one string per page, exactly what `unpdf`'s
 * `extractText(bytes, { mergePages: false })` returns, so the admin's preview and the worker's
 * pipeline are looking at the same input.
 *
 * `isPdf` is false for pasted text, which has no pagination to reason about and is only checked
 * for being non-empty.
 */
export function assessTextLayer(pages: string[], isPdf = true): TextLayerReport {
    const totalPages = pages.length;
    const joined = pages.join('').trim();

    if (totalPages === 0 || joined.length === 0) {
        return {
            verdict: 'empty', totalPages, readablePages: 0, ratio: 0, legacyEncodingShare: 0, usable: false,
            message: isPdf
                ? 'No text could be read from this PDF. It is almost certainly a scan of a printed book, which needs OCR before it can be processed.'
                : 'This document has no text to process.',
        };
    }

    if (!isPdf) {
        return { verdict: 'digital', totalPages, readablePages: totalPages, ratio: 1, legacyEncodingShare: 0, usable: true, message: 'Text accepted.' };
    }

    const readable = pages.filter((p) => p.trim().length >= MIN_PAGE_CHARS);
    const readablePages = readable.length;
    const ratio = readablePages / totalPages;

    if (ratio < MIN_TEXT_PAGE_RATIO) {
        return {
            verdict: 'scan', totalPages, readablePages, ratio, legacyEncodingShare: 0, usable: false,
            message: `Only ${readablePages} of ${totalPages} pages contain readable text, so this PDF is a scan rather than a digital document. `
                + 'Chunking it would index those few pages and silently miss the rest. It needs OCR first.',
        };
    }

    // Sample rather than scan every page: the answer does not change and a 500-page book should
    // not cost 500 regex passes in a browser while an admin waits.
    const sample = readable.filter((_, i) => i % Math.max(1, Math.floor(readablePages / 40)) === 0).slice(0, 40);
    const legacy = sample.filter(looksLegacyEncoded).length;
    const legacyEncodingShare = sample.length === 0 ? 0 : legacy / sample.length;

    if (legacyEncodingShare > 0.5) {
        return {
            verdict: 'legacy-encoding', totalPages, readablePages, ratio, legacyEncodingShare, usable: false,
            message: `This PDF has a text layer, but it is written in a legacy Nepali font encoding (Preeti or similar) rather than Unicode - `
                + `the words come out as "xfd|f] egfO" instead of "हाम्रो भनाइ". Indexing it would fill the library with noise. `
                + 'It needs converting to Unicode, or reading with OCR.',
        };
    }

    return {
        verdict: 'digital', totalPages, readablePages, ratio, legacyEncodingShare, usable: true,
        message: `${readablePages} of ${totalPages} pages carry readable text. This book can be chunked and searched.`,
    };
}
