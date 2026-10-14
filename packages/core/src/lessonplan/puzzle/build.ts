import { validatePuzzle } from './solve';
import {
	MAX_LADDER, MAX_MATCH, MAX_SQUARE, MAX_TERMS,
	type BalanceEquationSpec, type LatinSquareSpec, type MatchClue, type MatchGridSpec, type PuzzleSpec, type SequenceLadderSpec,
} from './spec';

/**
 * Building a puzzle from a PROPOSAL, in code.
 *
 * ## Why the model no longer writes the puzzle
 *
 * It was asked to write the whole spec - the grid, the givens, the clues, the coefficients - and
 * then `validatePuzzle` proved it wrong, twice per plan, every plan. gpt-4o-mini cannot balance a
 * chemical equation and cannot tell whether a logic grid has one answer; nothing that only predicts
 * text can, and the second attempt with the failure quoted back was no better than the first.
 *
 * So the model now proposes only what it is good at: the SUBJECT MATTER. Which symbols, which items
 * in which order and why, which pairs go together, which molecules react. This file does the rest -
 * lays out the square, blanks the cells, shuffles the ladder, chooses the clues, finds the
 * coefficients - and proves each step with the same solver that used to refuse the model's work.
 * A puzzle that comes out of here has passed `validatePuzzle` by construction.
 */

export type PuzzleProposal =
	| { kind: 'latinSquare'; instructions: string; symbols: string[] }
	| { kind: 'sequenceLadder'; instructions: string; orderBy: string; items: { text: string; key: string }[] }
	| { kind: 'matchGrid'; instructions: string; leftLabel: string; rightLabel: string; pairs: [string, string][] }
	| { kind: 'balanceEquation'; instructions: string; reactants: { formula: string; atoms: Record<string, number> }[]; products: { formula: string; atoms: Record<string, number> }[] };

const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Read a proposal out of model JSON with no trust. Null when it is not one of the four. */
export function parsePuzzleProposal(raw: unknown): PuzzleProposal | null {
	if (!isRecord(raw)) return null;
	const instructions = isStr(raw.instructions) ? raw.instructions.trim().slice(0, 400) : '';
	if (!instructions) return null;
	const dash = (s: string) => s.replace(/[\u2013\u2014]/g, '-').trim();
	switch (raw.kind) {
		case 'latinSquare': {
			const symbols = Array.isArray(raw.symbols) ? raw.symbols.filter(isStr).map((s) => dash(s).slice(0, 3)) : [];
			return symbols.length >= 4 && symbols.length <= MAX_SQUARE && new Set(symbols).size === symbols.length
				? { kind: 'latinSquare', instructions, symbols } : null;
		}
		case 'sequenceLadder': {
			const items = Array.isArray(raw.items)
				? raw.items.filter(isRecord).map((it) => ({ text: isStr(it.text) ? dash(it.text) : '', key: isStr(it.key) ? dash(it.key) : String(it.key ?? '') })).filter((it) => it.text && it.key)
				: [];
			return isStr(raw.orderBy) && items.length >= 3 && items.length <= MAX_LADDER
				? { kind: 'sequenceLadder', instructions, orderBy: dash(raw.orderBy), items } : null;
		}
		case 'matchGrid': {
			const pairs = Array.isArray(raw.pairs)
				? raw.pairs.filter(Array.isArray).map((p) => [isStr(p[0]) ? dash(p[0]) : '', isStr(p[1]) ? dash(p[1]) : ''] as [string, string]).filter((p) => p[0] && p[1])
				: [];
			return isStr(raw.leftLabel) && isStr(raw.rightLabel) && pairs.length >= 3 && pairs.length <= MAX_MATCH
				? { kind: 'matchGrid', instructions, leftLabel: dash(raw.leftLabel), rightLabel: dash(raw.rightLabel), pairs } : null;
		}
		case 'balanceEquation': {
			const side = (v: unknown) => Array.isArray(v)
				? v.filter(isRecord).map((t) => ({
					formula: isStr(t.formula) ? t.formula.trim() : '',
					atoms: isRecord(t.atoms) ? Object.fromEntries(Object.entries(t.atoms).filter(([el, n]) => /^[A-Z][a-z]?$/.test(el) && Number.isInteger(n) && (n as number) >= 1).map(([el, n]) => [el, n as number])) : {},
				})).filter((t) => t.formula && Object.keys(t.atoms).length > 0)
				: [];
			const reactants = side(raw.reactants);
			const products = side(raw.products);
			return reactants.length >= 1 && reactants.length <= MAX_TERMS && products.length >= 1 && products.length <= MAX_TERMS
				? { kind: 'balanceEquation', instructions, reactants, products } : null;
		}
		default:
			return null;
	}
}

/** A small seeded generator, so a build is repeatable from its seed and a retry is a different draw. */
function rng(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6D2B79F5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function shuffle<T>(items: T[], next: () => number): T[] {
	const out = items.slice();
	for (let i = out.length - 1; i > 0; i -= 1) {
		const j = Math.floor(next() * (i + 1));
		[out[i], out[j]] = [out[j]!, out[i]!];
	}
	return out;
}

export interface BuiltPuzzle { puzzle: PuzzleSpec | null; reason: string | null }

/**
 * Build and prove. Never throws: a proposal that cannot be made into a puzzle returns the reason,
 * which is fed back to the model for its next proposal.
 */
export function buildPuzzle(proposal: PuzzleProposal, seed = 1): BuiltPuzzle {
	try {
		const spec = build(proposal, seed);
		if (!spec) return { puzzle: null, reason: 'could not be laid out as a puzzle with one answer' };
		const verdict = validatePuzzle(spec);
		return verdict.ok ? { puzzle: spec, reason: null } : { puzzle: null, reason: verdict.reason };
	} catch (e) {
		return { puzzle: null, reason: e instanceof Error ? e.message : 'the builder threw' };
	}
}

function build(p: PuzzleProposal, seed: number): PuzzleSpec | null {
	const next = rng(seed);
	switch (p.kind) {
		case 'latinSquare': return latinSquare(p, next);
		case 'sequenceLadder': return ladder(p, next);
		case 'matchGrid': return matchGrid(p, next);
		case 'balanceEquation': return balance(p);
	}
}

// ─── Latin square: a random square, then blanks removed while the answer stays unique ────────────

function latinSquare(p: Extract<PuzzleProposal, { kind: 'latinSquare' }>, next: () => number): LatinSquareSpec | null {
	const n = p.symbols.length;
	// A cyclic square is a latin square; shuffling its rows, its columns and its symbols keeps it one.
	const rows = shuffle([...Array(n).keys()], next);
	const cols = shuffle([...Array(n).keys()], next);
	const syms = shuffle(p.symbols, next);
	const solution: string[] = [];
	for (let r = 0; r < n; r += 1) for (let c = 0; c < n; c += 1) solution.push(syms[(rows[r]! + cols[c]!) % n]!);

	// Remove cells one at a time, in a random order, keeping only removals that leave one answer.
	// Stop between a third and two thirds blank, as the prompt used to ask the model to.
	const target = Math.round(n * n * 0.55);
	const given: (string | null)[] = solution.slice();
	let blanks = 0;
	for (const i of shuffle([...Array(n * n).keys()], next)) {
		if (blanks >= target) break;
		const keep = given[i]!;
		given[i] = null;
		const trial: LatinSquareSpec = { kind: 'latinSquare', instructions: p.instructions, size: n, symbols: p.symbols, given: given.slice(), solution };
		if (validatePuzzle(trial).ok) blanks += 1; else given[i] = keep;
	}
	if (blanks < Math.ceil(n * n / 3)) return null;
	return { kind: 'latinSquare', instructions: p.instructions, size: n, symbols: p.symbols, given, solution };
}

// ─── Sequence ladder: the model's order is the answer; the print order is a shuffle ──────────────

function ladder(p: Extract<PuzzleProposal, { kind: 'sequenceLadder' }>, next: () => number): SequenceLadderSpec | null {
	const keys = p.items.map((it) => it.key.trim().toLowerCase());
	if (new Set(keys).size !== keys.length) return null;
	if (new Set(p.items.map((it) => it.text.trim().toLowerCase())).size !== p.items.length) return null;
	/*
	 * The model is asked for the items in the correct order and, on the first live run, gave them
	 * in no order at all with the right keys beside them. When every key is a number the keys
	 * decide: ascending, or descending when the property says largest or latest first. Keys that
	 * are not numbers (a date written out, a name) leave the model's order to stand.
	 */
	const numeric = p.items.map((it) => Number(it.key.replace(/[^0-9.eE+-]/g, '')));
	const desc = /\b(largest|biggest|highest|latest|newest|farthest|furthest|longest|heaviest|most|greatest|descending)\b/i.test(p.orderBy);
	const sorted = numeric.every((n) => Number.isFinite(n))
		? p.items.map((it, i) => ({ it, n: numeric[i]! })).sort((a, b) => (desc ? b.n - a.n : a.n - b.n)).map((x) => x.it)
		: p.items;
	const order = shuffle([...Array(sorted.length).keys()], next);
	// Make sure the printed order is not already the answer.
	if (order.every((v, i) => v === i) && order.length > 1) order.push(order.shift()!);
	const items = order.map((i) => sorted[i]!.text);
	const itemKeys = order.map((i) => sorted[i]!.key);
	// solution[k] = the index in `items` of the item that comes k-th.
	const solution = sorted.map((_, k) => order.indexOf(k));
	return { kind: 'sequenceLadder', instructions: p.instructions, orderBy: p.orderBy, items, solution, keys: itemKeys };
}

// ─── Match grid: shuffle the right column, then choose the fewest clues that force one answer ────

function matchGrid(p: Extract<PuzzleProposal, { kind: 'matchGrid' }>, next: () => number): MatchGridSpec | null {
	const n = p.pairs.length;
	if (new Set(p.pairs.map((x) => x[1].trim().toLowerCase())).size !== n) return null;
	if (new Set(p.pairs.map((x) => x[0].trim().toLowerCase())).size !== n) return null;
	const order = shuffle([...Array(n).keys()], next);
	if (order.every((v, i) => v === i) && n > 1) order.push(order.shift()!);
	const left = p.pairs.map((x) => x[0]);
	const right = order.map((i) => p.pairs[i]![1]);
	const solution = p.pairs.map((_, i) => order.indexOf(i));

	// Start from every true "not" plus one "is", which certainly forces the answer, then drop clues
	// one at a time while the grid still has exactly one solution. Fewer clues is a better puzzle.
	let clues: MatchClue[] = [];
	for (let l = 0; l < n; l += 1) for (let r = 0; r < n; r += 1) if (solution[l] !== r) clues.push({ type: 'not', left: l, right: r });
	clues.push({ type: 'is', left: 0, right: solution[0]! });
	clues = shuffle(clues, next);
	const ok = (cs: MatchClue[]) => validatePuzzle({ kind: 'matchGrid', instructions: p.instructions, leftLabel: p.leftLabel, rightLabel: p.rightLabel, left, right, clues: cs, solution } satisfies MatchGridSpec).ok;
	if (!ok(clues)) return null;
	for (let i = clues.length - 1; i >= 0; i -= 1) {
		const trial = clues.slice(0, i).concat(clues.slice(i + 1));
		if (trial.length > 0 && ok(trial)) clues = trial;
	}
	if (clues.length > 20) return null;
	return { kind: 'matchGrid', instructions: p.instructions, leftLabel: p.leftLabel, rightLabel: p.rightLabel, left, right, clues, solution };
}

// ─── Balance an equation: search the coefficients, smallest first ───────────────────────────────

function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b); }

function balance(p: Extract<PuzzleProposal, { kind: 'balanceEquation' }>): BalanceEquationSpec | null {
	const terms = [...p.reactants, ...p.products];
	const elements = [...new Set(terms.flatMap((t) => Object.keys(t.atoms)))];
	const nR = p.reactants.length;
	const cap = terms.length <= 4 ? 12 : 8;
	const coeffs = new Array<number>(terms.length).fill(1);
	let best: number[] | null = null;

	const balanced = (): boolean => elements.every((el) => {
		let lhs = 0; let rhs = 0;
		terms.forEach((t, i) => { const c = coeffs[i]! * (t.atoms[el] ?? 0); if (i < nR) lhs += c; else rhs += c; });
		return lhs === rhs;
	});
	// Iterative deepening on the largest coefficient, so the first hit is the smallest form.
	for (let max = 1; max <= cap && !best; max += 1) {
		const walk = (i: number, usesMax: boolean): boolean => {
			if (i === terms.length) {
				if (!usesMax || !balanced()) return false;
				if (coeffs.reduce((a, c) => gcd(a, c)) !== 1) return false;
				best = coeffs.slice();
				return true;
			}
			for (let c = 1; c <= max; c += 1) {
				coeffs[i] = c;
				if (walk(i + 1, usesMax || c === max)) return true;
			}
			return false;
		};
		walk(0, false);
	}
	if (!best) return null;
	const found: number[] = best;
	return {
		kind: 'balanceEquation',
		instructions: p.instructions,
		reactants: p.reactants.map((t, i) => ({ formula: t.formula, atoms: t.atoms, coefficient: found[i]! })),
		products: p.products.map((t, i) => ({ formula: t.formula, atoms: t.atoms, coefficient: found[nR + i]! })),
	};
}
