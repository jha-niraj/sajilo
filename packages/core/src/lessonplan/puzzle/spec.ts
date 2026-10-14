/**
 * Puzzles a teacher can hand out - the SPEC, shared by the screen renderer and the printer.
 *
 * ## Why a spec, and why only four kinds
 *
 * Same argument as `../../diagram/spec.ts`, one step harder. A model cannot draw, so it specifies
 * and our code draws. A model also cannot SOLVE what it wrote - it will produce a grid that looks
 * like a puzzle and has two answers, or none, and neither the model nor the teacher can see that by
 * looking. So a puzzle is specified here, PROVEN unique by `./solve.ts`, and only then stored.
 *
 * The four kinds are not a starting set to be grown casually. Each one is a real reasoning
 * mechanic, prints in black and white, and has a uniqueness proof that runs in milliseconds. A kind
 * with no cheap uniqueness proof does not belong here at all, because "we could not check it" is
 * how a class of thirty gets handed an unsolvable worksheet.
 *
 * ## The test for adding a fifth
 *
 * Would five plain questions lose anything? If not, it is five plain questions. Dressing recall as
 * a game teaches a student to optimise for the game. Excluded on exactly that basis, and recorded
 * so it is not re-argued: odd-one-out (the unintended answer is often the more thoughtful one),
 * anagrams and word searches (the mechanic is letter-hunting, not the subject), and anything timed
 * for marks (cannot be done on paper, and rewards speed over reasoning).
 */

/** Anything a caller may attach to any puzzle. */
interface PuzzleBase {
	/** Shown above the grid. What the student is being asked to do. */
	instructions: string;
	/** Which objective of the lesson this exercises, 1-based. Null when it is general. */
	objectiveIndex?: number | null;
}

// ─── 1. Latin square ────────────────────────────────────────────────────────────
//
// An n x n grid, each symbol exactly once per row and column. The Mini Sudoku shape, minus the
// boxes, which is the part that generalises to a school subject: the symbols can be digits, place
// values, chemical symbols or unit names.

export const MAX_SQUARE = 6;

export interface LatinSquareSpec extends PuzzleBase {
	kind: 'latinSquare';
	/** 4 to MAX_SQUARE. */
	size: number;
	/** Exactly `size` distinct symbols. Short - they are printed inside a cell. */
	symbols: string[];
	/**
	 * Row-major, `size * size` entries. `null` is a blank the student fills. An entry must be one
	 * of `symbols`.
	 */
	given: (string | null)[];
	/** The full grid, row-major. Never sent to a student; used to mark and to prove uniqueness. */
	solution: string[];
}

// ─── 2. Sequence ladder ─────────────────────────────────────────────────────────
//
// Put items in order by a stated, measurable property. The Crossclimb shape. Works for chronology,
// magnitude, reactivity, process steps - anything with a strict total order.

export const MAX_LADDER = 8;

export interface SequenceLadderSpec extends PuzzleBase {
	kind: 'sequenceLadder';
	/** What the order is BY. "smallest to largest", "earliest to latest". */
	orderBy: string;
	/** Shuffled, as printed. 3 to MAX_LADDER. */
	items: string[];
	/**
	 * The correct order, as indices into `items`.
	 *
	 * Indices rather than repeated strings so a duplicated item is a validation failure instead of
	 * an ambiguity nobody notices.
	 */
	solution: number[];
	/** Optional per-item fact that makes the order checkable by the student afterwards. */
	keys?: string[];
}

// ─── 3. Match grid ──────────────────────────────────────────────────────────────
//
// Pair two sets using elimination clues. The logic-grid shape. Term to definition, organ to
// function, instrument to quantity.

export const MAX_MATCH = 6;

export interface MatchGridSpec extends PuzzleBase {
	kind: 'matchGrid';
	leftLabel: string;
	rightLabel: string;
	/** 3 to MAX_MATCH. */
	left: string[];
	/** Same length as `left`. */
	right: string[];
	/**
	 * Clues, as constraints a solver can actually check - NOT prose.
	 *
	 * Prose clues are what makes a generated logic puzzle unverifiable: the model writes a sentence,
	 * nothing can evaluate it, and the grid ships unsolvable. These are machine-checkable, and the
	 * renderer turns each one back into a sentence for the page.
	 */
	clues: MatchClue[];
	/** `solution[i]` is the index in `right` that `left[i]` pairs with. */
	solution: number[];
}

export type MatchClue =
	/** left[a] does NOT pair with right[b]. */
	| { type: 'not'; left: number; right: number }
	/** left[a] pairs with right[b]. A given, for a puzzle that needs a foothold. */
	| { type: 'is'; left: number; right: number };

// ─── 4. Balance an equation ─────────────────────────────────────────────────────
//
// Chemical balancing, which is a genuine constraint problem and is taught as one.

export const MAX_TERMS = 6;

export interface EquationTerm {
	/** As printed: "H2O", "Fe2O3". */
	formula: string;
	/** Element symbol to count in ONE unit of this formula: { H: 2, O: 1 }. */
	atoms: Record<string, number>;
	/** The correct coefficient. 1 is written as an empty box, not as "1". */
	coefficient: number;
}

export interface BalanceEquationSpec extends PuzzleBase {
	kind: 'balanceEquation';
	reactants: EquationTerm[];
	products: EquationTerm[];
}

export type PuzzleSpec =
	| LatinSquareSpec
	| SequenceLadderSpec
	| MatchGridSpec
	| BalanceEquationSpec;

export type PuzzleKind = PuzzleSpec['kind'];

export const PUZZLE_KINDS: PuzzleKind[] = ['latinSquare', 'sequenceLadder', 'matchGrid', 'balanceEquation'];

// ─── Shape validation ───────────────────────────────────────────────────────────
//
// Refuses rather than guesses, exactly like `isDrawableDiagram`. Every list is CAPPED and every
// number range-checked, because the producer is a language model: an uncapped 40x40 latin square
// renders as a smear and takes a solver a very long time to prove anything about.

function isStr(v: unknown): v is string { return typeof v === 'string' && v.trim().length > 0; }
function isStrArr(v: unknown, min: number, max: number): v is string[] {
	return Array.isArray(v) && v.length >= min && v.length <= max && v.every(isStr);
}
function isIntArr(v: unknown, len: number): v is number[] {
	return Array.isArray(v) && v.length === len && v.every((n) => Number.isInteger(n) && n >= 0 && n < len);
}
function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function hasBase(v: Record<string, unknown>): boolean {
	if (!isStr(v.instructions) || (v.instructions as string).length > 400) return false;
	const oi = v.objectiveIndex;
	return oi === undefined || oi === null || (Number.isInteger(oi) && (oi as number) >= 1 && (oi as number) <= 12);
}

export function isPuzzleSpec(value: unknown): value is PuzzleSpec {
	if (!isRecord(value) || !hasBase(value)) return false;

	switch (value.kind) {
		case 'latinSquare': {
			const { size, symbols, given, solution } = value;
			if (!Number.isInteger(size) || (size as number) < 4 || (size as number) > MAX_SQUARE) return false;
			const n = size as number;
			if (!isStrArr(symbols, n, n)) return false;
			if (new Set(symbols).size !== n) return false;
			if (!Array.isArray(given) || given.length !== n * n) return false;
			if (!given.every((g) => g === null || (isStr(g) && symbols.includes(g)))) return false;
			if (!isStrArr(solution, n * n, n * n)) return false;
			if (!solution.every((s) => symbols.includes(s))) return false;
			// A given that contradicts the stored solution is the single most common malformed
			// puzzle, and it produces a grid that cannot be finished.
			return given.every((g, i) => g === null || g === solution[i]);
		}

		case 'sequenceLadder': {
			const { items, solution, keys } = value;
			if (!isStrArr(items, 3, MAX_LADDER)) return false;
			if (!isStr(value.orderBy)) return false;
			if (!isIntArr(solution, items.length)) return false;
			// Must be a PERMUTATION. A repeated index means one item is unplaceable.
			if (new Set(solution).size !== items.length) return false;
			if (new Set(items).size !== items.length) return false;
			if (keys !== undefined && !isStrArr(keys, items.length, items.length)) return false;
			return true;
		}

		case 'matchGrid': {
			const { left, right, clues, solution } = value;
			if (!isStrArr(left, 3, MAX_MATCH)) return false;
			if (!isStrArr(right, left.length, left.length)) return false;
			if (!isStr(value.leftLabel) || !isStr(value.rightLabel)) return false;
			if (!isIntArr(solution, left.length)) return false;
			if (new Set(solution).size !== left.length) return false;
			if (!Array.isArray(clues) || clues.length === 0 || clues.length > 20) return false;
			return clues.every((c) => isRecord(c)
				&& (c.type === 'not' || c.type === 'is')
				&& Number.isInteger(c.left) && (c.left as number) >= 0 && (c.left as number) < left.length
				&& Number.isInteger(c.right) && (c.right as number) >= 0 && (c.right as number) < left.length);
		}

		case 'balanceEquation': {
			const ok = (side: unknown) => Array.isArray(side) && side.length >= 1 && side.length <= MAX_TERMS
				&& side.every((t) => isRecord(t)
					&& isStr(t.formula)
					&& Number.isInteger(t.coefficient) && (t.coefficient as number) >= 1 && (t.coefficient as number) <= 30
					&& isRecord(t.atoms)
					&& Object.keys(t.atoms).length > 0
					&& Object.entries(t.atoms).every(([el, n]) => /^[A-Z][a-z]?$/.test(el) && Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 30));
			return ok(value.reactants) && ok(value.products);
		}

		default:
			return false;
	}
}
