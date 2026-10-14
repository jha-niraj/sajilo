import {
	isPuzzleSpec, MAX_MATCH,
	type PuzzleSpec, type LatinSquareSpec, type SequenceLadderSpec, type MatchGridSpec, type BalanceEquationSpec,
} from './spec';

/**
 * Proving a puzzle has exactly ONE answer, before a class of thirty is handed it.
 *
 * ## Why this is the whole point of the module
 *
 * A model writes a plausible grid. Plausible is not solvable. The two ways a generated puzzle fails
 * are both invisible to a person glancing at it:
 *
 *   - **No solution.** The student works for ten minutes and hits a contradiction. They conclude
 *     they are bad at it.
 *   - **Two solutions.** Half the class is marked wrong for an answer that is correct. That is
 *     worse, because the teacher defends the mark.
 *
 * Neither the model nor the teacher can see either by looking, so it has to be proved. Every solver
 * here COUNTS solutions and stops at two - the question is never "find the answer", it is "is there
 * more than one", and stopping early is what keeps it fast enough to run inside a request.
 *
 * ## Every search is bounded
 *
 * The producer is a language model, so a pathological input is a matter of when. Sizes are capped
 * in the spec, and the searches here are additionally capped by node count. A validator that can
 * hang is a validator that gets removed the first time it hangs.
 */

/** Hard ceiling on search nodes. Generous for a 6x6, nowhere near enough to hang a request. */
const MAX_NODES = 200_000;

export interface PuzzleVerdict {
	ok: boolean;
	/** Written for a log line and for a teacher-facing message. Empty when ok. */
	reason: string;
	/** How many solutions were found, capped at 2. Useful in the log. */
	solutions: number;
}

const OK: PuzzleVerdict = { ok: true, reason: '', solutions: 1 };
const bad = (reason: string, solutions = 0): PuzzleVerdict => ({ ok: false, reason, solutions });

// ─── Latin square ───────────────────────────────────────────────────────────────

/**
 * Count solutions to the givens, stopping at 2.
 *
 * Plain backtracking with a most-constrained-cell heuristic. On a 6x6 with a reasonable number of
 * givens that is instant; the node cap is there for the unreasonable ones.
 */
function countLatin(spec: LatinSquareSpec): number {
	const n = spec.size;
	const grid = spec.given.slice();
	let found = 0;
	let nodes = 0;

	const candidates = (i: number): string[] => {
		const r = Math.floor(i / n);
		const c = i % n;
		const used = new Set<string>();
		for (let k = 0; k < n; k += 1) {
			const rowV = grid[r * n + k];
			const colV = grid[k * n + c];
			if (rowV) used.add(rowV);
			if (colV) used.add(colV);
		}
		return spec.symbols.filter((s) => !used.has(s));
	};

	const step = (): void => {
		if (found >= 2) return;
		if ((nodes += 1) > MAX_NODES) { found = 2; return; } // treat a runaway as "not proven unique"

		// Most-constrained empty cell first. Without this a 6x6 with few givens is slow enough to
		// notice inside a server action.
		let best = -1;
		let bestOpts: string[] = [];
		for (let i = 0; i < n * n; i += 1) {
			if (grid[i] !== null) continue;
			const opts = candidates(i);
			if (opts.length === 0) return;              // dead end
			if (best === -1 || opts.length < bestOpts.length) { best = i; bestOpts = opts; }
			if (opts.length === 1) break;
		}
		if (best === -1) { found += 1; return; }        // complete grid

		for (const s of bestOpts) {
			grid[best] = s;
			step();
			grid[best] = null;
			if (found >= 2) return;
		}
	};

	step();
	return found;
}

// ─── Match grid ─────────────────────────────────────────────────────────────────

/** Every permutation of 0..n-1, n capped at MAX_MATCH so this is at most 720. */
function permutations(n: number): number[][] {
	const out: number[][] = [];
	const cur: number[] = [];
	const used = new Array<boolean>(n).fill(false);
	const walk = (): void => {
		if (cur.length === n) { out.push(cur.slice()); return; }
		for (let i = 0; i < n; i += 1) {
			if (used[i]) continue;
			used[i] = true; cur.push(i);
			walk();
			cur.pop(); used[i] = false;
		}
	};
	walk();
	return out;
}

function countMatch(spec: MatchGridSpec): number {
	const n = spec.left.length;
	if (n > MAX_MATCH) return 0;
	let found = 0;
	for (const perm of permutations(n)) {
		const consistent = spec.clues.every((c) => (c.type === 'is'
			? perm[c.left] === c.right
			: perm[c.left] !== c.right));
		if (consistent) { found += 1; if (found >= 2) return 2; }
	}
	return found;
}

// ─── Balance an equation ────────────────────────────────────────────────────────

function elementTotals(terms: BalanceEquationSpec['reactants']): Map<string, number> {
	const totals = new Map<string, number>();
	for (const t of terms) {
		for (const [el, n] of Object.entries(t.atoms)) {
			totals.set(el, (totals.get(el) ?? 0) + n * t.coefficient);
		}
	}
	return totals;
}

function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b); }

// ─── The gate ───────────────────────────────────────────────────────────────────

/**
 * The ONLY way a puzzle enters a lesson plan.
 *
 * Shape first, then the uniqueness proof for the kind. A refusal carries a reason written to be
 * read by a person, because it goes into a log line that somebody will one day be debugging from.
 */
export function validatePuzzle(value: unknown): PuzzleVerdict {
	if (!isPuzzleSpec(value)) return bad('The puzzle is malformed or uses a kind we do not draw');
	const spec: PuzzleSpec = value;

	switch (spec.kind) {
		case 'latinSquare': {
			const n = spec.size;
			// The stored solution must itself be a valid latin square. A model gets this wrong
			// often enough that checking it first turns a confusing "two solutions" into a clear
			// "your answer key is not even legal".
			for (let r = 0; r < n; r += 1) {
				const row = new Set<string>();
				const col = new Set<string>();
				for (let k = 0; k < n; k += 1) {
					row.add(spec.solution[r * n + k] as string);
					col.add(spec.solution[k * n + r] as string);
				}
				if (row.size !== n) return bad(`The answer key repeats a symbol in row ${r + 1}`);
				if (col.size !== n) return bad(`The answer key repeats a symbol in column ${r + 1}`);
			}
			const blanks = spec.given.filter((g) => g === null).length;
			if (blanks === 0) return bad('Every cell is already filled in, so there is nothing to solve');
			// A grid with almost everything blank is technically solvable and is not a puzzle a
			// student can start.
			if (blanks > n * n - n) return bad('Too few starting cells for the puzzle to be startable');

			const count = countLatin(spec);
			if (count === 0) return bad('The grid has no solution', 0);
			if (count > 1) return bad('The grid has more than one solution, so a correct answer could be marked wrong', 2);
			return OK;
		}

		case 'sequenceLadder': {
			const s = spec as SequenceLadderSpec;
			// Ordering is unique exactly when the sort keys are distinct. When the model supplied
			// keys we can check that directly; without them the permutation itself is the answer
			// key and the shape check already proved it is a permutation of distinct items.
			if (s.keys) {
				const seen = new Set(s.keys.map((k) => k.trim().toLowerCase()));
				if (seen.size !== s.keys.length) {
					return bad('Two items share the same value, so more than one order is correct', 2);
				}
			}
			return OK;
		}

		case 'matchGrid': {
			const count = countMatch(spec);
			if (count === 0) return bad('The clues contradict each other, so nothing can be matched', 0);
			if (count > 1) return bad('The clues allow more than one matching, so a correct answer could be marked wrong', 2);
			// The stored answer must be the one the clues actually force.
			const consistent = spec.clues.every((c) => (c.type === 'is'
				? spec.solution[c.left] === c.right
				: spec.solution[c.left] !== c.right));
			if (!consistent) return bad('The answer key contradicts the clues');
			return OK;
		}

		case 'balanceEquation': {
			const lhs = elementTotals(spec.reactants);
			const rhs = elementTotals(spec.products);
			const elements = new Set([...lhs.keys(), ...rhs.keys()]);
			for (const el of elements) {
				const a = lhs.get(el) ?? 0;
				const b = rhs.get(el) ?? 0;
				if (a !== b) return bad(`${el} does not balance: ${a} on the left, ${b} on the right`);
			}
			// Coefficients must be in lowest terms, or "2H2 + O2 -> 2H2O" doubled is also "correct"
			// and a student who writes the simplest form gets marked wrong.
			const coeffs = [...spec.reactants, ...spec.products].map((t) => t.coefficient);
			const g = coeffs.reduce((acc, c) => gcd(acc, c));
			if (g > 1) return bad('The coefficients share a common factor, so this is not the simplest balanced form', 2);
			return OK;
		}

		default:
			return bad('Unknown puzzle kind');
	}
}

/** Convenience for a renderer: refuse rather than half-draw, same rule as `isDrawableDiagram`. */
export function isDrawablePuzzle(value: unknown): value is PuzzleSpec {
	return validatePuzzle(value).ok;
}
