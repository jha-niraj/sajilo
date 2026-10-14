'use client';

import { Info } from 'lucide-react';
import { Label } from './ui/label';
import { Input } from './ui/input';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
import { cn } from '../lib/utils';
import {
    AGGREGATION_MODES, AGGREGATION_LABELS,
    type AssessmentRules, type AggregationMode,
} from '@repo/core/assessment';

/**
 * # The rules playground
 *
 * One component, used by BOTH the admin app (authoring a country's default rules) and the school app
 * (a school overriding them). It lives in `@repo/ui` for the same reason the rule schema lives in
 * `@repo/core`: two copies of "how a child is graded" disagree eventually, and here the disagreement
 * would be two screens telling a principal different things about the same setting.
 *
 * ## Every control carries its own sentence
 *
 * The explanations are not decoration. The test each of these primitives had to pass to exist at all
 * was "can it be explained to a parent in one sentence", so the sentence belongs on the control - a
 * principal setting `minObservations` to 8 should be able to see, without leaving the screen, that
 * they have just made most skills unjudgeable.
 *
 * There is deliberately **no formula box**. A typed expression cannot be tested, cannot be explained
 * to an inspector, and cannot be reproduced a year later when a report is questioned.
 */

export type RulesEditorProps = {
    rules: AssessmentRules;
    onChange: (next: AssessmentRules) => void;
    /** Strand codes and labels, so per-strand overrides can be offered by name rather than by code. */
    strands?: { code: string; label: string }[];
    /** Rendered under the roll-up block. The school app passes its live preview here. */
    preview?: React.ReactNode;
    disabled?: boolean;
};

function Field({
    label, hint, children, warning,
}: {
    label: string; hint: string; children: React.ReactNode; warning?: string | null;
}) {
    return (
        <div className="space-y-1.5">
            <Label className="text-sm font-medium">{label}</Label>
            {children}
            <p className="text-xs leading-snug text-neutral-500 dark:text-neutral-400">{hint}</p>
            {warning && (
                <p className="flex items-start gap-1.5 text-xs leading-snug text-orange-700 dark:text-orange-300">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {warning}
                </p>
            )}
        </div>
    );
}

/** A 0-1 weight shown as a percentage, because "50%" is readable and "0.5" is a decision to decode. */
function WeightField({
    label, hint, value, onChange, disabled, warning,
}: {
    label: string; hint: string; value: number;
    onChange: (v: number) => void; disabled?: boolean; warning?: string | null;
}) {
    return (
        <Field label={label} hint={hint} warning={warning}>
            <div className="flex items-center gap-3">
                <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={Math.round(value * 100)}
                    disabled={disabled}
                    onChange={e => onChange(Number(e.target.value) / 100)}
                    className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-neutral-200 accent-emerald-600 disabled:cursor-not-allowed dark:bg-neutral-700"
                    aria-label={label}
                />
                <span className="w-12 shrink-0 text-right text-sm font-medium tabular-nums text-neutral-900 dark:text-white">
                    {Math.round(value * 100)}%
                </span>
            </div>
        </Field>
    );
}

export function AssessmentRulesEditor({
    rules, onChange, strands = [], preview, disabled,
}: RulesEditorProps) {
    const r = rules.rollup;

    function setRollup(patch: Partial<AssessmentRules['rollup']>) {
        onChange({ ...rules, rollup: { ...r, ...patch } });
    }

    function setStrandOverride(code: string, patch: Partial<AssessmentRules['rollup']> | null) {
        const next = { ...rules.strandOverrides };
        if (patch === null) delete next[code];
        else next[code] = { ...next[code], ...patch };
        onChange({ ...rules, strandOverrides: next });
    }

    return (
        <div className="space-y-6">
            <section className="space-y-4">
                <div>
                    <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                        How a level is proposed
                    </h3>
                    <p className="mt-1 text-sm leading-snug text-neutral-600 dark:text-neutral-400">
                        These decide what the system suggests at term end. A teacher always confirms or
                        overrides it, so nothing here grades a child on its own.
                    </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                        label="Observations needed"
                        hint="Below this, the skill reports 'not enough evidence' rather than a level. It is never widened to find an answer."
                        warning={r.minObservations > 6
                            ? 'That is a lot for one term. Most skills will report no evidence and teachers will have nothing to confirm.'
                            : null}
                    >
                        <Input
                            type="number"
                            min={2}
                            max={50}
                            value={r.minObservations}
                            disabled={disabled}
                            onChange={e => setRollup({ minObservations: Math.max(2, Number(e.target.value) || 2) })}
                        />
                    </Field>

                    <Field
                        label="Spread over at least this many days"
                        hint="Five observations in one afternoon is one afternoon. A skill shown repeatedly across days is the thing worth recording."
                    >
                        <Input
                            type="number"
                            min={1}
                            max={30}
                            value={r.minDistinctDays}
                            disabled={disabled}
                            onChange={e => setRollup({ minDistinctDays: Math.max(1, Number(e.target.value) || 1) })}
                        />
                    </Field>
                </div>

                <Field
                    label="Which level to propose"
                    hint={AGGREGATION_LABELS[r.aggregation].hint}
                >
                    <Select
                        value={r.aggregation}
                        disabled={disabled}
                        onValueChange={v => setRollup({ aggregation: v as AggregationMode })}
                    >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {AGGREGATION_MODES.map(m => (
                                <SelectItem key={m} value={m}>{AGGREGATION_LABELS[m].label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>

                {r.aggregation === 'RECENT_WEIGHTED' && (
                    <Field
                        label="Recent means the last"
                        hint="Observations inside this window count double those before it."
                    >
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                min={1}
                                max={365}
                                value={r.recentWindowDays}
                                disabled={disabled}
                                onChange={e => setRollup({ recentWindowDays: Math.max(1, Number(e.target.value) || 1) })}
                                className="max-w-[8rem]"
                            />
                            <span className="text-sm text-neutral-600 dark:text-neutral-400">days</span>
                        </div>
                    </Field>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                    <WeightField
                        label="A pre-set default is worth"
                        hint="The marking screen sets every child to 'as expected' and the teacher taps the exceptions. A default says the skill was taught and most met it - not that this child was watched."
                        value={r.bulkDefaultWeight}
                        disabled={disabled}
                        onChange={v => setRollup({ bulkDefaultWeight: v })}
                        warning={r.bulkDefaultWeight >= 1
                            ? 'At 100% a whole term of untouched defaults reads exactly like a term of real observation. The coverage screen still reports it either way.'
                            : null}
                    />
                    <WeightField
                        label="App evidence is worth"
                        hint="Evidence recorded by an app rather than a person. It can never be the only basis for a confirmed judgement, whatever this is set to."
                        value={r.machineEvidenceWeight}
                        disabled={disabled}
                        onChange={v => setRollup({ machineEvidenceWeight: v })}
                    />
                </div>

                {preview}
            </section>

            <section className="space-y-4 border-t border-neutral-200 pt-6 dark:border-neutral-800">
                <div>
                    <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                        Thin evidence
                    </h3>
                    <p className="mt-1 text-sm leading-snug text-neutral-600 dark:text-neutral-400">
                        The quiet child who never volunteers generates no observations. This is what
                        surfaces them in week three instead of the last week of the year.
                    </p>
                </div>
                <Field
                    label="Flag a child with fewer than this many observations in a term"
                    hint="They appear on the coverage screen so someone goes and looks at them on purpose."
                >
                    <Input
                        type="number"
                        min={1}
                        max={100}
                        value={rules.coverage.thinEvidenceThreshold}
                        disabled={disabled}
                        onChange={e => onChange({
                            ...rules,
                            coverage: { thinEvidenceThreshold: Math.max(1, Number(e.target.value) || 1) },
                        })}
                        className="max-w-[10rem]"
                    />
                </Field>
            </section>

            {strands.length > 0 && (
                <section className="space-y-3 border-t border-neutral-200 pt-6 dark:border-neutral-800">
                    <div>
                        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                            Different rules per strand
                        </h3>
                        <p className="mt-1 text-sm leading-snug text-neutral-600 dark:text-neutral-400">
                            Optional. Writing arrives as one page every week or two; talk in a classroom
                            arrives every day. Holding both to the same number of observations makes one
                            of them impossible to judge.
                        </p>
                    </div>

                    <div className="space-y-2">
                        {strands.map(s => {
                            const override = rules.strandOverrides[s.code];
                            return (
                                <div
                                    key={s.code}
                                    className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-neutral-900 dark:text-white">
                                                {s.label}
                                            </p>
                                            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                                {override
                                                    ? `${override.minObservations ?? r.minObservations} observations, ${override.minDistinctDays ?? r.minDistinctDays} days`
                                                    : 'Uses the rules above'}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            disabled={disabled}
                                            onClick={() => {
                                                if (override) setStrandOverride(s.code, null);
                                                else setStrandOverride(s.code, { minObservations: r.minObservations });
                                            }}
                                            className={cn(
                                                'shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                                                override
                                                    ? 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300'
                                                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300',
                                            )}
                                        >
                                            {override ? 'Use the defaults' : 'Set its own'}
                                        </button>
                                    </div>

                                    {override && (
                                        <div className="mt-3 grid gap-3 border-t border-neutral-100 pt-3 sm:grid-cols-2 dark:border-neutral-800">
                                            <div className="space-y-1">
                                                <Label className="text-xs">Observations needed</Label>
                                                <Input
                                                    type="number"
                                                    min={2}
                                                    max={50}
                                                    disabled={disabled}
                                                    value={override.minObservations ?? r.minObservations}
                                                    onChange={e => setStrandOverride(s.code, {
                                                        minObservations: Math.max(2, Number(e.target.value) || 2),
                                                    })}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Spread over days</Label>
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    max={30}
                                                    disabled={disabled}
                                                    value={override.minDistinctDays ?? r.minDistinctDays}
                                                    onChange={e => setStrandOverride(s.code, {
                                                        minDistinctDays: Math.max(1, Number(e.target.value) || 1),
                                                    })}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}
        </div>
    );
}
