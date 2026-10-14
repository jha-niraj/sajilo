/**
 * Generating a picture, and knowing what it cost before you press the button.
 *
 * ## Pinned, not `auto`
 *
 * The seven-prompt evaluation on 2026-09-08 was run in the OpenAI playground with `quality: auto`
 * and `size: auto`. That is a fine way to explore and a bad way to ship: `auto` means the provider
 * picks, so the same prompt can cost different amounts on different days and a cost shown to a
 * teacher before they press would be a guess. Both are pinned here, in one place, and the price is
 * derived from the pinned pair.
 *
 * ## Why the price is a constant and not a response field
 *
 * The image endpoint bills per image by size and quality, and the numbers below are what the user
 * MEASURED across those seven generations: roughly NPR 4, about ₹2.50 to ₹3, per image at this
 * setting. They will go stale exactly like the token rates in `./models.ts`, and the same rule
 * applies: re-check them when a provider reprices, and never let a caller invent its own figure.
 */

export const IMAGE_MODEL = 'gpt-image-1';

/** Pinned. A square is what both a slide and a printed plan can hold without cropping. */
export const IMAGE_SIZE = '1024x1024';
export const IMAGE_QUALITY = 'medium';

/**
 * What one generation costs, in the smallest unit of the currency, at the pinned settings.
 *
 * Stored in paisa so no float ever touches a stored cost. NPR 4 = 400 paisa.
 */
export const IMAGE_COST_MINOR = 400;
export const IMAGE_COST_CURRENCY = 'NPR';

export interface GenerateImageOptions {
	apiKey: string;
	prompt: string;
	/** Overrides only for a deliberate experiment. Shipping code leaves these alone. */
	size?: string;
	quality?: string;
	signal?: AbortSignal;
}

export interface GeneratedImage {
	bytes: Uint8Array;
	mimeType: string;
	width: number;
	height: number;
	model: string;
	/** What this call cost, at the pinned settings. */
	costMinor: number;
	currency: string;
}

function decodeBase64(b64: string): Uint8Array {
	const bin = atob(b64.replace(/\s+/g, ''));
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
	return out;
}

/**
 * One image. Bytes out, never a URL.
 *
 * A hosted URL expires, and a lesson plan is read months after it was written, so the bytes are
 * pulled here and the caller writes them to R2. `response_format` is not sent because gpt-image-1
 * always returns base64 and rejects the parameter.
 */
export async function generateImage(options: GenerateImageOptions): Promise<GeneratedImage> {
	const size = options.size ?? IMAGE_SIZE;
	const quality = options.quality ?? IMAGE_QUALITY;

	const res = await fetch('https://api.openai.com/v1/images/generations', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${options.apiKey}` },
		body: JSON.stringify({ model: IMAGE_MODEL, prompt: options.prompt, size, quality, n: 1 }),
		signal: options.signal,
	});
	if (!res.ok) {
		const detail = await res.text().catch(() => '');
		throw new Error(`Image generation failed: HTTP ${res.status} ${detail.slice(0, 400)}`);
	}
	const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
	const b64 = json.data?.[0]?.b64_json;
	if (!b64) throw new Error('Image generation returned no image');

	const [w, h] = size.split('x').map((n) => Number(n) || 1024);
	return {
		bytes: decodeBase64(b64),
		mimeType: 'image/png',
		width: w ?? 1024,
		height: h ?? 1024,
		model: IMAGE_MODEL,
		costMinor: IMAGE_COST_MINOR,
		currency: IMAGE_COST_CURRENCY,
	};
}

/** "NPR 4.00". Used wherever a cost is shown BEFORE a press, so the wording is identical. */
export function formatImageCost(minor: number = IMAGE_COST_MINOR, currency: string = IMAGE_COST_CURRENCY): string {
	return `${currency} ${(minor / 100).toFixed(2)}`;
}
