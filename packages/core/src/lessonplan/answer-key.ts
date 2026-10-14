/**
 * The answer key of a generated question, and the code that marks an answer against it.
 *
 * Shared between the staff app (which writes keys in Pass 3 and re-solves them) and the student
 * app (which marks an app submission the moment it is handed in). ONE marker, because the mark a
 * student sees in the app and the mark the teacher sees on the Homework tab must be the same
 * number computed the same way; a second copy is the copy that quietly disagrees.
 *
 * Shapes, stored in `homework_questions.answerJson` and validated here rather than trusted:
 *
 *   MCQ         { correctIndex: number }              the index into optionsJson.choices
 *   TRUE_FALSE  { value: boolean }
 *   NUMERICAL   { value: number, unit?, tolerance?, expression? }
 *   SHORT_TEXT  { model: string }                     a model answer for a person or the AI grader
 *
 * `expression` is how a numeric key is checked in CODE (`srs/lessonplan/05`, Rule 2: arithmetic is
 * code). The model is asked for the arithmetic that produces the answer - "1*8+0*4+1*2+1*1" - and
 * `evaluateExpression` computes it with a parser that accepts digits, + - * / ^, parentheses and
 * nothing else. A stated value that disagrees with its own expression is REPLACED by the computed
 * one before the key is stored.
 */

export type QuestionKind = 'MCQ' | 'TRUE_FALSE' | 'NUMERICAL' | 'SHORT_TEXT' | 'LONG_TEXT';

export type McqKey = { correctIndex: number };
export type TrueFalseKey = { value: boolean };
export type NumericKey = { value: number; unit?: string; tolerance?: number; expression?: string };
export type TextKey = { model: string };
export type AnswerKey = McqKey | TrueFalseKey | NumericKey | TextKey;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** The key for a question, read out of jsonb with no trust. `null` when it is not one we can mark. */
export function parseAnswerKey(type: string, raw: unknown): AnswerKey | null {
    if (!isObj(raw)) return null;
    switch (type) {
        case 'MCQ':
            return typeof raw.correctIndex === 'number' && Number.isInteger(raw.correctIndex) && raw.correctIndex >= 0
                ? { correctIndex: raw.correctIndex } : null;
        case 'TRUE_FALSE':
            return typeof raw.value === 'boolean' ? { value: raw.value } : null;
        case 'NUMERICAL': {
            if (typeof raw.value !== 'number' || !Number.isFinite(raw.value)) return null;
            const key: NumericKey = { value: raw.value };
            if (typeof raw.unit === 'string' && raw.unit.trim()) key.unit = raw.unit.trim();
            if (typeof raw.tolerance === 'number' && raw.tolerance >= 0) key.tolerance = raw.tolerance;
            if (typeof raw.expression === 'string' && raw.expression.trim()) key.expression = raw.expression.trim();
            return key;
        }
        case 'SHORT_TEXT':
        case 'LONG_TEXT':
            return typeof raw.model === 'string' && raw.model.trim() ? { model: raw.model.trim() } : null;
        default:
            return null;
    }
}

/** MCQ choices live in `optionsJson.choices`; the legacy shape also carried `correctIndex` there. */
export function parseChoices(raw: unknown): { choices: string[]; legacyCorrectIndex: number | null } {
    if (!isObj(raw)) return { choices: [], legacyCorrectIndex: null };
    const choices = Array.isArray(raw.choices) ? raw.choices.filter((c): c is string => typeof c === 'string') : [];
    const legacyCorrectIndex = typeof raw.correctIndex === 'number' ? raw.correctIndex : null;
    return { choices, legacyCorrectIndex };
}

// ─── A tiny arithmetic evaluator ─────────────────────────────────────────────

/**
 * Evaluate `+ - * / ^ ( )` over decimal numbers. Returns null for anything else - a letter, a
 * function call, a bare `=`. No `eval`, no `Function`: the input is model output.
 */
export function evaluateExpression(expression: string): number | null {
    const src = expression.replace(/\s+/g, '').replace(/×/g, '*').replace(/÷/g, '/');
    if (!src || !/^[0-9+\-*/^().]+$/.test(src)) return null;
    let i = 0;

    const peek = () => src[i];
    const number = (): number | null => {
        const m = /^(\d+\.?\d*|\.\d+)/.exec(src.slice(i));
        if (!m) return null;
        i += m[0].length;
        return Number(m[0]);
    };
    const factor = (): number | null => {
        if (peek() === '-') { i += 1; const v = factor(); return v === null ? null : -v; }
        if (peek() === '+') { i += 1; return factor(); }
        if (peek() === '(') {
            i += 1;
            const v = expr();
            if (v === null || peek() !== ')') return null;
            i += 1;
            return v;
        }
        return number();
    };
    const power = (): number | null => {
        const base = factor();
        if (base === null) return null;
        if (peek() === '^') {
            i += 1;
            const exp = power();
            if (exp === null) return null;
            return Math.pow(base, exp);
        }
        return base;
    };
    const term = (): number | null => {
        let v = power();
        if (v === null) return null;
        while (peek() === '*' || peek() === '/') {
            const op = src[i]; i += 1;
            const r = power();
            if (r === null) return null;
            if (op === '/' && r === 0) return null;
            v = op === '*' ? v * r : v / r;
        }
        return v;
    };
    const expr = (): number | null => {
        let v = term();
        if (v === null) return null;
        while (peek() === '+' || peek() === '-') {
            const op = src[i]; i += 1;
            const r = term();
            if (r === null) return null;
            v = op === '+' ? v + r : v - r;
        }
        return v;
    };

    const out = expr();
    if (out === null || i !== src.length || !Number.isFinite(out)) return null;
    return out;
}

// ─── Marking ─────────────────────────────────────────────────────────────────

/** What a student handed in for one question, in whichever field the app stores it. */
export type GivenAnswer = {
    /** MCQ: the chosen index. */
    mcqIndex?: number | null;
    /** Text and numbers, as typed. */
    text?: string | null;
};

/** Numbers as a student types them: "13", "13.0", "13 cm", "1,300". */
export function parseNumericAnswer(text: string | null | undefined): number | null {
    if (!text) return null;
    const cleaned = text.replace(/,/g, '').trim();
    const m = /^[-+]?(\d+\.?\d*|\.\d+)/.exec(cleaned);
    if (!m) return null;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : null;
}

/**
 * Marks in code, or null when only a person (or the AI grader) can.
 *
 * MCQ and true/false: all or nothing. Numeric: full marks within `tolerance` (default: exact to
 * six decimals). Text: null - a model answer is for a reader, not a string comparison.
 */
export function markAnswer(
    question: { type: string; points: number; answerJson: unknown; optionsJson?: unknown },
    given: GivenAnswer,
): number | null {
    const points = Number.isFinite(question.points) ? question.points : 0;
    const key = parseAnswerKey(question.type, question.answerJson)
        ?? legacyKey(question.type, question.optionsJson);
    if (!key) return null;

    switch (question.type) {
        case 'MCQ': {
            if (typeof given.mcqIndex !== 'number') return 0;
            return given.mcqIndex === (key as McqKey).correctIndex ? points : 0;
        }
        case 'TRUE_FALSE': {
            const said = parseTrueFalse(given.text);
            if (said === null) return 0;
            return said === (key as TrueFalseKey).value ? points : 0;
        }
        case 'NUMERICAL': {
            const n = parseNumericAnswer(given.text);
            if (n === null) return 0;
            const k = key as NumericKey;
            const tol = k.tolerance ?? 1e-6;
            return Math.abs(n - k.value) <= tol ? points : 0;
        }
        default:
            return null;
    }
}

/** MCQ rows written before `answerJson` existed carried the key inside `optionsJson`. */
function legacyKey(type: string, optionsJson: unknown): AnswerKey | null {
    if (type !== 'MCQ') return null;
    const { legacyCorrectIndex } = parseChoices(optionsJson);
    return legacyCorrectIndex === null ? null : { correctIndex: legacyCorrectIndex };
}

export function parseTrueFalse(text: string | null | undefined): boolean | null {
    const t = (text ?? '').trim().toLowerCase();
    if (['true', 't', 'yes', 'सही', 'ठीक'].includes(t)) return true;
    if (['false', 'f', 'no', 'गलत', 'बेठीक'].includes(t)) return false;
    return null;
}
