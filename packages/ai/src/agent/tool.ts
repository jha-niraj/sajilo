/**
 * Tool factory - the Zod 4 <-> AI SDK v4 compatibility shim.
 *
 * AI SDK v4 (`ai@4.x`, peer range zod `^3`) ships a zod->json-schema converter that only
 * understands Zod 3's internal `._def` shape. This repo runs Zod 4, so the SDK silently
 * converts every tool's `parameters` to an EMPTY schema (`{"$schema":...}` with no
 * `type`/`properties`). OpenAI then rejects the malformed function definitions mid-stream
 * and the chat returns "No response generated" with no error anywhere in the logs.
 *
 * Fix: convert with Zod 4's own `z.toJSONSchema` and hand the SDK a ready-made JSON
 * Schema via `jsonSchema()`, bypassing the broken path. Full `z.infer` typing on
 * `execute` args is preserved.
 *
 * This lives in the package because all three apps hit the same trap. If you ever move
 * to AI SDK v5 (native zod 4), this file is the single thing to delete.
 */
import { tool, jsonSchema, type Schema } from 'ai';
import { z } from 'zod';

export interface ToolConfig<T extends z.ZodType, R> {
	description: string;
	parameters: T;
	execute: (args: z.infer<T>) => Promise<R>;
}

export function makeTool<T extends z.ZodType, R>(config: ToolConfig<T, R>) {
	const schema = z.toJSONSchema(config.parameters, {
		target: 'draft-7',
	}) as unknown as Parameters<typeof jsonSchema>[0];
	return tool<Schema<z.infer<T>>, R>({
		description: config.description,
		parameters: jsonSchema<z.infer<T>>(schema),
		execute: config.execute,
	});
}

/**
 * Reserved keys a tool may return to control how its result is presented.
 * The raw tool result is NEVER streamed to the client - only these are read - so a
 * tool can query sensitive rows without risking them reaching the browser.
 */
export interface ToolResultConventions {
	/** One-line label for the UI timeline, e.g. "Found 42 students in Class 10". */
	_summary?: string;
	/** Presence of a truthy `error` turns the step into a `tool-error` frame. */
	error?: string;
}

/**
 * A tool the MODEL calls but the SERVER does not run - it is handled by the client instead.
 *
 * Identical to `makeTool` except that it has no `execute`, and that omission is the entire
 * feature. `streamText` only runs another step when every tool call in the step produced a
 * result:
 *
 *     stepToolCalls.length > 0 && stepToolResults.length === stepToolCalls.length
 *
 * so a call with no result ends the run exactly where it was made. That is what lets the
 * assistant stop at a question instead of continuing and answering it itself - which is what
 * happens if you give the tool a placeholder result and try to hold the model back with
 * wording in the system prompt.
 *
 * Use this ONLY for tools whose whole purpose is to hand control to the user. Anything that
 * needs to come back and inform the rest of the reply must be a normal `makeTool`, or the
 * model will never see its output.
 */
export function makeClientTool<T extends z.ZodType>(config: { description: string; parameters: T }) {
	const schema = z.toJSONSchema(config.parameters, {
		target: 'draft-7',
	}) as unknown as Parameters<typeof jsonSchema>[0];
	// RESULT is `unknown`, not `never`, even though this tool never produces one. `Tool`'s
	// `experimental_toToolResultContent?: (result: RESULT) => ...` is CONTRAVARIANT in RESULT, so
	// `never` makes the whole tool unassignable to the SDK's own `Tool<any, any>` and the tool set
	// stops satisfying `ToolSet`. `unknown` accepts `any` and the tool set type-checks.
	return tool<Schema<z.infer<T>>, unknown>({
		description: config.description,
		parameters: jsonSchema<z.infer<T>>(schema),
	});
}
