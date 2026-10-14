'use client';

/**
 * Drawing a puzzle on screen, in the shape it will be PRINTED in.
 *
 * ## Paper is the primary surface, not the fallback
 *
 * A Nepali school has more students than devices, so a puzzle that only works in the app is a
 * feature for the schools that need us least. Everything here is therefore black on white with real
 * borders: no colour carries meaning, no hover carries meaning, no animation carries meaning, and
 * the blanks are boxes big enough to write a letter into with a pencil. What you see is what comes
 * out of the printer.
 *
 * The one screen-only affordance is `showSolution`, which is for the teacher and never rendered on
 * a student's copy.
 */

import type {
	PuzzleSpec, LatinSquareSpec, SequenceLadderSpec, MatchGridSpec, BalanceEquationSpec,
} from '@repo/core/lessonplan/puzzle';
import { isDrawablePuzzle } from '@repo/core/lessonplan/puzzle';

export interface PuzzleProps {
	spec: unknown;
	/** Teacher view. Never true on anything a student sees. */
	showSolution?: boolean;
	className?: string;
}

/**
 * Refuses rather than half-draws, the same rule `<Diagram>` follows.
 *
 * The check here is the FULL gate, not just a shape test: a grid with two answers renders as a
 * perfectly ordinary grid, and drawing it would put the exact defect the validator exists to catch
 * in front of a class.
 */
export function Puzzle({ spec, showSolution = false, className }: PuzzleProps) {
	if (!isDrawablePuzzle(spec)) return null;
	const p: PuzzleSpec = spec;

	return (
		<figure className={className}>
			<figcaption className="mb-2 text-sm text-neutral-800 dark:text-neutral-200">{p.instructions}</figcaption>
			{p.kind === 'latinSquare' && <LatinSquare spec={p} showSolution={showSolution} />}
			{p.kind === 'sequenceLadder' && <SequenceLadder spec={p} showSolution={showSolution} />}
			{p.kind === 'matchGrid' && <MatchGrid spec={p} showSolution={showSolution} />}
			{p.kind === 'balanceEquation' && <BalanceEquation spec={p} showSolution={showSolution} />}
		</figure>
	);
}

const CELL = 'h-11 w-11 border border-neutral-400 text-center align-middle text-base dark:border-neutral-500';

function LatinSquare({ spec, showSolution }: { spec: LatinSquareSpec; showSolution: boolean }) {
	const n = spec.size;
	return (
		<table className="border-collapse">
			<tbody>
				{Array.from({ length: n }).map((_, r) => (
					<tr key={r}>
						{Array.from({ length: n }).map((__, c) => {
							const i = r * n + c;
							const given = spec.given[i];
							const answer = spec.solution[i];
							return (
								<td key={c} className={CELL}>
									{given
										? <span className="font-semibold text-neutral-900 dark:text-white">{given}</span>
										: showSolution
											// The answer is shown lighter than the givens so a teacher can still
											// see at a glance which cells the student is meant to fill.
											? <span className="text-neutral-500 dark:text-neutral-400">{answer}</span>
											: null}
								</td>
							);
						})}
					</tr>
				))}
			</tbody>
		</table>
	);
}

function SequenceLadder({ spec, showSolution }: { spec: SequenceLadderSpec; showSolution: boolean }) {
	return (
		<div>
			<p className="mb-2 text-xs text-neutral-600 dark:text-neutral-300">In order by {spec.orderBy}.</p>
			<ol className="space-y-1.5">
				{spec.items.map((item, i) => (
					<li key={i} className="flex items-center gap-3">
						{/* An empty numbered box per item: the student writes the position in it. */}
						<span className="inline-flex h-8 w-8 shrink-0 items-center justify-center border border-neutral-400 text-sm dark:border-neutral-500">
							{showSolution ? spec.solution.indexOf(i) + 1 : ''}
						</span>
						<span className="text-sm text-neutral-900 dark:text-white">{item}</span>
						{showSolution && spec.keys?.[i] && (
							<span className="text-xs text-neutral-500 dark:text-neutral-400">{spec.keys[i]}</span>
						)}
					</li>
				))}
			</ol>
		</div>
	);
}

/**
 * A logic grid, plus its clues written back out as sentences.
 *
 * The clues are stored as CONSTRAINTS rather than prose precisely so they can be checked; turning
 * them back into English happens here, at the last moment, so what the student reads and what the
 * validator proved are guaranteed to be the same statements.
 */
function MatchGrid({ spec, showSolution }: { spec: MatchGridSpec; showSolution: boolean }) {
	const n = spec.left.length;
	return (
		<div className="space-y-3">
			<div className="overflow-x-auto">
				<table className="border-collapse text-sm">
					<thead>
						<tr>
							<th className="border border-neutral-400 px-2 py-1 text-left text-xs font-medium dark:border-neutral-500">
								{spec.leftLabel} \ {spec.rightLabel}
							</th>
							{spec.right.map((r, i) => (
								<th key={i} className="border border-neutral-400 px-2 py-1 text-xs font-medium dark:border-neutral-500">{r}</th>
							))}
						</tr>
					</thead>
					<tbody>
						{spec.left.map((l, r) => (
							<tr key={r}>
								<th className="border border-neutral-400 px-2 py-1 text-left text-xs font-medium dark:border-neutral-500">{l}</th>
								{Array.from({ length: n }).map((_, c) => (
									<td key={c} className="h-9 w-9 border border-neutral-400 text-center dark:border-neutral-500">
										{showSolution && spec.solution[r] === c ? '✓' : ''}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<ul className="space-y-1 text-xs text-neutral-700 dark:text-neutral-300">
				{spec.clues.map((c, i) => (
					<li key={i}>
						{c.type === 'is'
							? `${spec.left[c.left]} goes with ${spec.right[c.right]}.`
							: `${spec.left[c.left]} does not go with ${spec.right[c.right]}.`}
					</li>
				))}
			</ul>
		</div>
	);
}

function BalanceEquation({ spec, showSolution }: { spec: BalanceEquationSpec; showSolution: boolean }) {
	const side = (terms: BalanceEquationSpec['reactants']) => terms.map((t, i) => (
		<span key={i} className="inline-flex items-center gap-1">
			{i > 0 && <span className="mx-1 text-neutral-600 dark:text-neutral-300">+</span>}
			<span className="inline-flex h-8 w-8 items-center justify-center border border-neutral-400 text-sm dark:border-neutral-500">
				{/* A coefficient of 1 is written as an empty box, never as "1" - that is the
				    convention a chemistry teacher marks against. */}
				{showSolution ? (t.coefficient === 1 ? '' : t.coefficient) : ''}
			</span>
			<Formula formula={t.formula} />
		</span>
	));
	return (
		<div className="flex flex-wrap items-center gap-y-2 text-base text-neutral-900 dark:text-white">
			{side(spec.reactants)}
			<span className="mx-3 text-neutral-600 dark:text-neutral-300">&rarr;</span>
			{side(spec.products)}
		</div>
	);
}

/** "H2O" with the digits dropped to subscript, which is how it is written on a board. */
function Formula({ formula }: { formula: string }) {
	const parts = formula.split(/(\d+)/).filter(Boolean);
	return (
		<span>
			{parts.map((part, i) => (/^\d+$/.test(part)
				? <sub key={i}>{part}</sub>
				: <span key={i}>{part}</span>))}
		</span>
	);
}
