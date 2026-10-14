import { rgb, type PDFPage, type PDFFont } from 'pdf-lib';
import { isDrawablePuzzle, type PuzzleSpec, type LatinSquareSpec, type SequenceLadderSpec, type MatchGridSpec, type BalanceEquationSpec } from '@repo/core/lessonplan/puzzle';
import { INK, safeText, wrap } from './layout';

/**
 * Drawing a puzzle onto a page, in the surface it was designed for.
 *
 * Paper is the PRIMARY target for a puzzle, not a degraded copy of the screen: more students than
 * devices is the normal case in a Nepali school. So this file is not a port of the React renderer,
 * the React renderer is a port of this - black rules, real boxes, and blanks sized for a pencil.
 *
 * `drawPuzzle` returns the height it consumed so a caller can lay out what follows, the same
 * contract `drawDiagram` uses.
 */

const RULE = rgb(0.35, 0.35, 0.35);
const CELL = 26;
const BOX = 20;

export interface PuzzleCtx {
	page: PDFPage;
	font: PDFFont;
	bold: PDFFont;
	x: number;
	/** TOP of the block. Drawing runs downwards from here, as everything else in this package does. */
	y: number;
	width: number;
	/** Teacher's copy. Never true on a class set. */
	showSolution?: boolean;
}

/** How tall this puzzle will be, so a caller can decide whether it fits before drawing it. */
export function puzzleHeightFor(spec: unknown, width: number, font: PDFFont): number {
	if (!isDrawablePuzzle(spec)) return 0;
	const head = wrap(font, safeText(spec.instructions), 10, width).length * 14 + 8;
	switch (spec.kind) {
		case 'latinSquare': return head + spec.size * CELL + 8;
		case 'sequenceLadder': return head + 16 + spec.items.length * (BOX + 6) + 8;
		case 'matchGrid': return head + (spec.left.length + 1) * CELL + 12 + spec.clues.length * 12 + 8;
		case 'balanceEquation': return head + BOX + 20;
		default: return 0;
	}
}

export function drawPuzzle(ctx: PuzzleCtx, spec: unknown): number {
	if (!isDrawablePuzzle(spec)) return 0;
	const p: PuzzleSpec = spec;
	let y = ctx.y;

	for (const line of wrap(ctx.font, safeText(p.instructions), 10, ctx.width)) {
		ctx.page.drawText(line, { x: ctx.x, y, size: 10, font: ctx.font, color: INK.body });
		y -= 14;
	}
	y -= 8;

	switch (p.kind) {
		case 'latinSquare': y = drawLatin(ctx, p, y); break;
		case 'sequenceLadder': y = drawLadder(ctx, p, y); break;
		case 'matchGrid': y = drawMatch(ctx, p, y); break;
		case 'balanceEquation': y = drawBalance(ctx, p, y); break;
	}
	return ctx.y - y;
}

function box(ctx: PuzzleCtx, x: number, y: number, w: number, h: number): void {
	ctx.page.drawRectangle({ x, y: y - h, width: w, height: h, borderColor: RULE, borderWidth: 0.75 });
}

/** Centre a short string inside a box. */
function centred(ctx: PuzzleCtx, text: string, x: number, y: number, w: number, h: number, size: number, font: PDFFont, colour = INK.body): void {
	const t = safeText(text);
	if (!t) return;
	const tw = font.widthOfTextAtSize(t, size);
	ctx.page.drawText(t, { x: x + (w - tw) / 2, y: y - h + (h - size) / 2 + 1, size, font, color: colour });
}

function drawLatin(ctx: PuzzleCtx, spec: LatinSquareSpec, top: number): number {
	const n = spec.size;
	for (let r = 0; r < n; r += 1) {
		for (let c = 0; c < n; c += 1) {
			const x = ctx.x + c * CELL;
			const y = top - r * CELL;
			box(ctx, x, y, CELL, CELL);
			const given = spec.given[r * n + c];
			if (given) centred(ctx, given, x, y, CELL, CELL, 12, ctx.bold);
			else if (ctx.showSolution) centred(ctx, spec.solution[r * n + c] ?? '', x, y, CELL, CELL, 12, ctx.font, INK.muted);
		}
	}
	return top - n * CELL - 8;
}

function drawLadder(ctx: PuzzleCtx, spec: SequenceLadderSpec, top: number): number {
	let y = top;
	ctx.page.drawText(safeText(`In order by ${spec.orderBy}.`), { x: ctx.x, y, size: 9, font: ctx.font, color: INK.muted });
	y -= 16;
	for (const [i, item] of spec.items.entries()) {
		box(ctx, ctx.x, y, BOX, BOX);
		if (ctx.showSolution) centred(ctx, String(spec.solution.indexOf(i) + 1), ctx.x, y, BOX, BOX, 10, ctx.bold);
		ctx.page.drawText(safeText(item), { x: ctx.x + BOX + 8, y: y - BOX + 6, size: 10, font: ctx.font, color: INK.body });
		y -= BOX + 6;
	}
	return y - 8;
}

function drawMatch(ctx: PuzzleCtx, spec: MatchGridSpec, top: number): number {
	const n = spec.left.length;
	// The row-header column is wide enough for a term; the answer cells stay square.
	const headW = Math.min(120, Math.max(60, ctx.width - n * CELL));
	let y = top;

	for (let c = 0; c < n; c += 1) {
		const x = ctx.x + headW + c * CELL;
		box(ctx, x, y, CELL, CELL);
		centred(ctx, String(c + 1), x, y, CELL, CELL, 8, ctx.bold, INK.muted);
	}
	box(ctx, ctx.x, y, headW, CELL);
	y -= CELL;

	for (let r = 0; r < n; r += 1) {
		box(ctx, ctx.x, y, headW, CELL);
		ctx.page.drawText(safeText(spec.left[r] ?? '').slice(0, 22), { x: ctx.x + 4, y: y - CELL + 9, size: 8, font: ctx.font, color: INK.body });
		for (let c = 0; c < n; c += 1) {
			const x = ctx.x + headW + c * CELL;
			box(ctx, x, y, CELL, CELL);
			if (ctx.showSolution && spec.solution[r] === c) centred(ctx, 'X', x, y, CELL, CELL, 11, ctx.bold);
		}
		y -= CELL;
	}

	y -= 10;
	// The numbered key for the columns, then the clues. Columns are numbered rather than labelled
	// so a long right-hand term does not force the grid off the page.
	for (const [i, r] of spec.right.entries()) {
		ctx.page.drawText(safeText(`${i + 1}. ${r}`), { x: ctx.x, y, size: 8, font: ctx.font, color: INK.muted });
		y -= 11;
	}
	y -= 4;
	for (const c of spec.clues) {
		const text = c.type === 'is'
			? `${spec.left[c.left]} goes with ${spec.right[c.right]}.`
			: `${spec.left[c.left]} does not go with ${spec.right[c.right]}.`;
		ctx.page.drawText(safeText(text), { x: ctx.x, y, size: 8, font: ctx.font, color: INK.body });
		y -= 11;
	}
	return y - 8;
}

function drawBalance(ctx: PuzzleCtx, spec: BalanceEquationSpec, top: number): number {
	let x = ctx.x;
	const y = top;
	const side = (terms: BalanceEquationSpec['reactants']) => {
		for (const [i, t] of terms.entries()) {
			if (i > 0) {
				ctx.page.drawText('+', { x: x + 3, y: y - BOX + 6, size: 11, font: ctx.font, color: INK.body });
				x += 14;
			}
			box(ctx, x, y, BOX, BOX);
			// A coefficient of 1 stays an empty box: that is the convention a chemistry teacher
			// marks against, and printing "1" teaches the wrong habit.
			if (ctx.showSolution && t.coefficient !== 1) centred(ctx, String(t.coefficient), x, y, BOX, BOX, 10, ctx.bold);
			x += BOX + 3;
			const f = safeText(t.formula);
			ctx.page.drawText(f, { x, y: y - BOX + 6, size: 11, font: ctx.font, color: INK.body });
			x += ctx.font.widthOfTextAtSize(f, 11) + 8;
		}
	};
	side(spec.reactants);
	ctx.page.drawText('->', { x: x + 4, y: y - BOX + 6, size: 11, font: ctx.font, color: INK.body });
	x += 22;
	side(spec.products);
	return y - BOX - 12;
}
