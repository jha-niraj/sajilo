import { PDFDocument } from 'pdf-lib';
import {
    INK, Cursor, loadFonts, paragraph, rule, spread, table, documentHeader, stampFooter,
} from './layout';
import type { AssessmentReportData, AssessmentReportSkill } from './types';

/**
 * The descriptive continuous-assessment report for one child, one term.
 *
 * ## What this document is for
 *
 * Two readers, and they want different things from the same page. A **parent** reads the sentences
 * and wants to know what changed. An **inspector** wants to see that a judgement exists for each
 * skill and that somebody stood behind it. So the narrative comes first and the skill table second,
 * rather than the other way round.
 *
 * ## Why there is no score anywhere on it
 *
 * Doc 05's whole premise is that these children are not examined. There is no percentage, no total,
 * no rank and no comparison with another child - a number attached to a six-year-old and delivered
 * to a parent becomes pressure on the child that same evening. What the report carries is a level
 * per skill, in words, and the teacher's own sentences.
 *
 * ## Grouped by strand, and never split mid-strand
 *
 * `table` handles its own page breaks, but a strand heading orphaned at the foot of a page reads as
 * an empty category. `ensure` before each group keeps the heading with at least its first rows.
 */

const COLUMNS = [
    { header: 'What they can do', width: 0.46 },
    { header: 'Where they are', width: 0.20 },
    { header: 'Note', width: 0.34 },
];

function groupByStrand(skills: AssessmentReportSkill[]): { strand: string; rows: AssessmentReportSkill[] }[] {
    const groups = new Map<string, AssessmentReportSkill[]>();
    for (const s of skills) {
        const list = groups.get(s.strand) ?? [];
        list.push(s);
        groups.set(s.strand, list);
    }
    return [...groups.entries()].map(([strand, rows]) => ({ strand, rows }));
}

export async function renderAssessmentReport(data: AssessmentReportData): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const fonts = await loadFonts(doc);
    const margins = { top: 46, right: 48, bottom: 52, left: 48 };
    const c = new Cursor(doc, fonts, margins);

    const classLine = [
        data.className ? `Class ${data.className}` : null,
        data.section,
    ].filter(Boolean).join(' ');

    await documentHeader(c, doc, {
        school: { ...data.school, email: null },
        badge: {
            label: 'PROGRESS REPORT',
            ref: data.termName,
            lines: [data.studentName],
        },
    });

    c.gap(4);
    spread(c,
        { label: 'Student', value: data.studentName },
        { label: 'Class', value: classLine || '-' });
    spread(c,
        { label: 'Term', value: data.termName },
        { label: 'Roll number', value: data.rollNumber ?? '-' });
    c.gap(8);

    if (data.overallLabel) {
        rule(c, 0.5, INK.rule, 8);
        paragraph(c, 'Overall', { size: 9, bold: true, color: INK.faint });
        paragraph(c, data.overallLabel, { size: 13, bold: true });
        c.gap(8);
    }

    // The teacher's words come FIRST. It is the part of this page a parent actually reads, and the
    // part only a person can write - doc 05 §10 holds automatic wording out of v1 on purpose.
    if (data.narrative) {
        rule(c, 0.5, INK.rule, 8);
        paragraph(c, 'From the teacher', { size: 9, bold: true, color: INK.faint });
        c.gap(2);
        paragraph(c, data.narrative, { size: 10.5 });
        c.gap(10);
    }

    rule(c, 0.5, INK.rule, 8);
    paragraph(c, 'What we have seen this term', { size: 9, bold: true, color: INK.faint });
    c.gap(4);

    if (data.skills.length === 0) {
        // An honest empty state on a real document. "Absence of evidence is an output" holds here
        // exactly as it does on screen - a report that silently showed nothing would read as a
        // child with nothing to say about them.
        paragraph(c, 'No skills have been confirmed for this term yet.', { size: 10.5, color: INK.faint });
    } else {
        for (const group of groupByStrand(data.skills)) {
            // Keep the heading with at least a couple of rows; a lone heading at the foot of a page
            // reads as an empty category.
            c.ensure(64);
            paragraph(c, group.strand, { size: 11, bold: true });
            c.gap(2);
            table(
                c,
                COLUMNS,
                group.rows.map(r => [r.label, r.levelLabel, r.comment ?? '']),
            );
            c.gap(8);
        }
    }

    c.gap(6);
    rule(c, 0.5, INK.rule, 8);
    paragraph(
        c,
        'This report describes what this child has been observed doing across the term. It carries no '
        + 'marks and no ranking, because children of this age are assessed through their work rather '
        + 'than by examination.',
        { size: 8.5, color: INK.faint },
    );

    if (data.isProvisional) {
        c.gap(4);
        paragraph(
            c,
            'The skill list used for this report is a working draft and may be revised.',
            { size: 8.5, color: INK.faint },
        );
    }

    c.gap(14);
    spread(c,
        { label: 'Published', value: data.publishedOn },
        { label: 'Class teacher', value: '' });

    stampFooter(
        doc, fonts,
        `${data.school.name}  ·  ${data.studentName}  ·  ${data.termName}  ·  Generated ${data.generatedOn}`,
        margins,
    );

    return doc.save();
}
