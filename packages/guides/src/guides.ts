/**
 * THE GUIDES.
 *
 * A guide is not a feature page. A feature page answers "what is this and why would I want it";
 * a guide answers "I have decided - now what do I actually do on Monday". That difference drives
 * the whole data model below: guides are ordered by TASK, carry a real time estimate, name what
 * must already be true before you start, and end with what you will have.
 *
 * ── GROUNDING: every step here exists in apps/main ───────────────────────────────────────────────
 *
 * This is not a wish list. The sequence, the wording and the time estimates are read from the
 * product itself:
 *
 *  - The onboarding questions come from `apps/main/app/(auth)/onboarding/page.tsx` - the nine-step
 *    flow (welcome, name, location, level, board, phone, teachers, staff, documents), including
 *    which are optional and what the app itself says about them.
 *  - The post-onboarding sequence comes from `apps/main/lib/readiness/gates/`, which is the gate
 *    registry the in-app setup checklist and Saathi both read. The guide MIRRORS those gates rather
 *    than inventing a parallel sequence - a guide that disagrees with the in-app checklist is worse
 *    than no guide.
 *  - Destinations (`/configure/classes`, `/administration/invite`, ...) are the real routes those
 *    items link to.
 *
 * If the gate registry changes, this file is wrong until someone updates it. That is the
 * maintenance cost the plan flagged, and it is why every guide carries a `reviewedOn`.
 *
 * ── WHAT NEVER GOES IN A GUIDE ──────────────────────────────────────────────────────────────────
 *
 * What a user clicks and sees: yes. Endpoints, table names, queue or cron behaviour, rate limits,
 * quotas, abuse controls, or how permissions are enforced: never. Sample data is fictional.
 */

/**
 * WHO A GUIDE IS WRITTEN FOR - a reader label, NOT a product role.
 *
 * Worth being precise, because the two were conflated once already and it put wrong copy on the
 * page. The platform has exactly two staff-side ACCOUNT roles (Principal and Staff); every job
 * title beyond that is a role the school defines for itself. This union is the plain-English
 * answer to "is this guide for me", which is a different question and can safely use the words
 * people actually use about their jobs.
 */
export type GuideAudience = 'Principal' | 'Admin' | 'Teacher' | 'Accountant' | 'Staff' | 'Anyone'

/**
 * "Principal" -> "Principals", but "Staff" -> "Staff" and "Anyone" -> "Anyone".
 *
 * The pages render this as "For {audience}s", which is fine for the four job titles in use today
 * and produces "For Anyones" and "For Staffs" for the two that are not. Fixing it here rather than
 * at each call site means the next guide that picks one of them cannot reintroduce it.
 */
export function audienceLabel(audience: GuideAudience): string {
    if (audience === 'Anyone') return 'Anyone'
    if (audience === 'Staff') return 'Staff'
    return `${audience}s`
}

export interface GuideStep {
    /** Short imperative - "Create your first class". */
    title: string
    /** What you actually do. Two or three sentences, concrete. */
    body: string
    /** Honest duration for THIS step. Omit where it genuinely varies. */
    time?: string
    /** What the screen shows once it worked - the confirmation a reader checks against. */
    outcome?: string
    /** Which illustration to draw beside it. */
    art?: GuideArtKey
}

/** Keys into the animated SVG set in components/guides/guide-art.tsx. */
export type GuideArtKey =
    | 'signup' | 'schoolProfile' | 'classes' | 'students' | 'fees' | 'invite'
    | 'gradeBoard' | 'academicYear' | 'importStudents'
    | 'attendance' | 'exam' | 'timetable' | 'report' | 'leave' | 'ai' | 'website' | 'notice'

export interface GuideSection {
    kind: 'walkthrough' | 'prerequisites' | 'roles' | 'pitfalls' | 'prose'
    eyebrow?: string
    title: string
    body?: string
    steps?: GuideStep[]
    items?: string[]
    /**
     * Rows for a `roles` section. `role` is a FREE STRING, deliberately: school roles are
     * whatever the school names them ("Math Teacher", "Front Desk"), so a union here would be the
     * same fixed-role mistake the copy had. It is also used for the two account types and for
     * explanatory rows, which are not roles at all.
     */
    roles?: { role: string; can: string }[]
    pitfalls?: { mistake: string; fix: string }[]
    paragraphs?: string[]
}

/**
 * EVERY guide slug, and the ONLY place new ones are declared.
 *
 * This exists so that `apps/main`'s route -> guide map is checked by the compiler rather than
 * discovered by a reader who clicked Help and got a 404. `Guide['slug']` is this union, and
 * `BY_SLUG` at the bottom is a `Record<GuideSlug, Guide>`, so the two directions are both closed:
 * a guide whose slug is not listed here fails to compile, and a slug listed here with no guide
 * behind it fails to compile too.
 */
export const GUIDE_SLUGS = [
    'getting-started',
    'enrolling-students',
    'daily-attendance',
    'building-the-timetable',
    'collecting-fees',
    'running-an-exam',
    'reports-and-records',
    'managing-staff',
    'using-the-ai',
    'publishing-your-website',
    'roles-and-access',
] as const

export type GuideSlug = (typeof GUIDE_SLUGS)[number]

export interface Guide {
    slug: GuideSlug
    title: string
    /** One line, on the hub card and under the H1. */
    summary: string
    /** Who this is written for. */
    audience: GuideAudience
    /** Total, honest. Sum of the steps, rounded up, not a marketing number. */
    time: string
    /** What must already be true. Empty means "nothing - start here". */
    before: string[]
    /** What you have when you finish. */
    after: string[]
    /** Literal date string - never computed, so builds stay deterministic. */
    reviewedOn: string
    sections: GuideSection[]
    /** Feature pages this guide explains the operation of. */
    related?: { label: string; href: string }[]
    metaTitle: string
    metaDescription: string
    keywords: string
}

// ────────────────────────────────────────────────────────────────────────────────────────────────

const GETTING_STARTED: Guide = {
    slug: 'getting-started',
    title: 'From signing up to a school that runs itself',
    summary:
        'The whole first day, in order: create your account, answer nine questions about your school, then work through the setup that turns an empty account into one your teachers can use on Monday.',
    audience: 'Principal',
    time: 'About 90 minutes, spread over a day',
    before: [
        'An email address you check - it becomes your login',
        'Your school name, address and contact number',
        'A rough headcount of teachers and support staff',
        'Optional: your school logo, registration certificate and head authorization letter',
    ],
    after: [
        'A school with its academic year, terms and grading scheme set',
        'Your classes and sections created, each with a class teacher',
        'Your first students enrolled and linked to guardians',
        'A fee structure that can generate bills',
        'Teachers invited, with their own logins and only their own classes',
    ],
    reviewedOn: '2026-08-21',
    metaTitle: 'Getting Started with Gurukul - Setup Guide for Schools',
    metaDescription:
        'A step-by-step setup guide for Nepali schools: account creation, onboarding, classes, students, fee structure and inviting teachers - with honest time estimates.',
    keywords: 'school management software setup, Gurukul getting started, school onboarding Nepal, add students to school software',
    related: [
        { label: 'Student management', href: '/features/students' },
        { label: 'Fee billing', href: '/features/billing' },
        { label: 'Staff & HR', href: '/features/staff' },
    ],
    sections: [
        {
            kind: 'prerequisites',
            eyebrow: 'Before you start',
            title: 'What to have on the desk',
            body: 'None of this is blocking - every answer can be changed later in Settings - but having it to hand turns a stop-start afternoon into one sitting.',
            items: [
                'An email address you check - it becomes your login, and invitations to staff come from it',
                'Your school name exactly as you want it printed on report cards and receipts',
                'Your address, and the contact number parents should see on SMS',
                'A rough count of teachers and support staff - an estimate is fine',
                'Optional: logo, registration certificate, head authorization letter',
            ],
        },
        {
            kind: 'walkthrough',
            eyebrow: 'Stage one',
            title: 'Create the account and answer nine questions',
            body: 'This is the only part that is genuinely a form. The app says it takes about a minute, and that is accurate - the questions are short and everything is editable afterwards.',
            steps: [
                {
                    title: 'Sign up as the principal',
                    body: 'The first account for a school is always the principal. Everyone else - admins, teachers, accountants - is invited later from inside the app, which is what keeps each person tied to a named login rather than a shared password.',
                    time: '1 min',
                    outcome: 'You land straight on the onboarding flow.',
                    art: 'signup',
                },
                {
                    title: 'Name and locate your school',
                    body: 'The name you enter here is the one that appears on report cards, fee receipts and the parent app, so type it the way you want it printed. Location asks for country first, then narrows to the address.',
                    time: '1 min',
                    outcome: 'The board list on the next question changes to match your country.',
                    art: 'schoolProfile',
                },
                {
                    title: 'Pick your grade level and board',
                    body: 'Grade level is up to Grade 5 (Primary), 8 (Lower Secondary), 10 (SEE) or 12 (+2 / Higher Secondary). For Nepal the board options are NEB, CTEVT, Cambridge (CAIE) or Other. There is no separate SEE board in the list because SEE sits under the NEB.',
                    time: '30 sec',
                    outcome: 'Grading and report-card formats default to your board.',
                },
                {
                    title: 'Add a contact number and your headcounts',
                    body: 'The contact number is used for parent SMS and account contact, and you can skip it and add it later. Teacher and support-staff counts are rough numbers - they size your account, not a commitment.',
                    time: '1 min',
                    outcome: 'You reach the final, optional question.',
                },
                {
                    title: 'Upload documents, or skip',
                    body: 'Logo, registration certificate and head authorization letter, up to 5MB each, images or PDF. This step is optional. The logo becomes your branding; the two certificates go into your school Vault privately, and can be added later in Settings instead.',
                    time: '2 min',
                    outcome: 'Your school is created and you arrive in the app.',
                },
            ],
        },
        {
            kind: 'walkthrough',
            eyebrow: 'Stage two',
            title: 'Set up the school before anyone else logs in',
            body: 'The app shows you a setup checklist with these as items. Doing them in this order matters: classes need an academic year to belong to, students need a class to go into, and bills need a fee structure to bill against.',
            steps: [
                {
                    title: 'Complete the school profile',
                    body: 'Settings > General. Confirm the name and address you entered, and add anything you skipped. This is what prints on every document the school issues.',
                    time: '2 min',
                    outcome: 'The profile item marks itself complete.',
                },
                {
                    title: 'Upload your logo and pick brand colours',
                    body: 'These carry through to report cards, receipts, ID cards and your public school website if you turn it on. Doing it now means you never regenerate a batch of documents to add a logo.',
                    time: '2 min',
                    outcome: 'The logo appears straight away, with a note that you still have to press Save. Uploading is not saving - leave the page without it and the logo is gone.',
                },
                {
                    title: 'Set the academic year and terms',
                    body: 'Configure > Academic. Define the session and its terms. Everything dated hangs off this - attendance percentages, term results, fee cycles - so it is the one thing worth getting right before data exists.',
                    time: '3 min',
                    outcome: 'Terms appear in exam and fee screens.',
                    art: 'academicYear',
                },
                {
                    title: 'Choose a grading scheme',
                    body: 'How marks convert to grades and GPA. NEB schools get the 9-point A+ to NG scale with the standard grade points; you can define an internal scheme for terminal exams alongside it.',
                    time: '2 min',
                    outcome: 'The scheme is listed with a Default star, its type, its pass mark and how many grades it holds. If you added a second scheme, only one carries the star.',
                    art: 'gradeBoard',
                },
                {
                    title: 'Create your first class',
                    body: 'Configure > Classes. A class holds its sections and a class teacher. Create one properly first and check it looks right - the remaining grades go much faster once the shape is settled.',
                    time: '2 min',
                    outcome: 'The class appears in attendance and student screens.',
                    art: 'classes',
                },
            ],
        },
        {
            kind: 'walkthrough',
            eyebrow: 'Stage three',
            title: 'Put real people in it',
            body: 'This is the stage that takes the longest and the one worth not rushing. Everything after it - attendance, bills, marks, report cards - reads the records you create here.',
            steps: [
                {
                    title: 'Add your first student by hand',
                    body: 'Enrol one student manually before importing hundreds: name, class and section, guardian and their contact. Doing one by hand shows you exactly which fields matter, which makes the bulk import obvious rather than a guess.',
                    time: '3 min',
                    outcome: 'Teachers can mark attendance for this student, and absence alerts start working.',
                    art: 'students',
                },
                {
                    title: 'Import the rest from the Excel you already keep',
                    body: 'Guided import reads your existing sheet, validates every row and shows you the problems before anything saves. The first task is checking a list, not retyping three hundred students.',
                    time: '20-40 min for a whole school',
                    outcome: 'Your roll appears class by class.',
                    art: 'importStudents',
                },
                {
                    title: 'Set up a fee structure',
                    body: 'Define your fee heads - tuition, admission, transport, exam - per class and term. Set this up once and it applies every year, which is why it is worth doing before the first bill rather than after.',
                    time: '10 min',
                    outcome: 'Bills can now be generated for any class.',
                    art: 'fees',
                },
                {
                    title: 'Invite your first teacher',
                    body: 'Administration > Invite Member. Send a login invite by email and assign their class. They set their own password, and they see only the classes and sections assigned to them - not the whole school.',
                    time: '2 min',
                    outcome: 'They appear in your staff list as soon as they accept.',
                    art: 'invite',
                },
            ],
        },
        {
            /**
             * REWRITTEN 2026-08-21. The first version listed Principal / Admin / Teacher /
             * Accountant / Staff as if they were fixed product roles. They are not, and the root
             * CLAUDE.md is explicit that presenting them that way is always wrong.
             *
             * The real model, verified in packages/core/src/permissions: there are only two
             * staff-side ACCOUNT roles - PRINCIPAL and STAFF. Everything a school actually means by
             * "teacher" or "accountant" is a role the SCHOOL defines itself, with its own name and
             * its own selection from the 87 permissions across 18 modules. A principal bypasses
             * checks entirely; an assigned school role is authoritative even when empty; only a
             * member with NO school role at all inherits the STAFF baseline.
             */
            kind: 'roles',
            eyebrow: 'Who sees what',
            title: 'You define the roles - we do not',
            body: 'There is no fixed list of job titles to squeeze your staff into. You create the roles your school actually has, name them whatever you already call them, and tick exactly what each one can reach.',
            roles: [
                {
                    role: 'The two account types',
                    can: 'Every staff login is either Principal or Staff. That is the whole list, and it is deliberately not a job title - on its own it decides almost nothing.',
                },
                {
                    role: 'Principal',
                    can: 'The first account, and the one that bypasses permission checks entirely. You cannot lock a principal out of a module - which is why the account that sets everything up is the one that can always get back in.',
                },
                {
                    role: 'Your own roles',
                    can: 'Everything else is a role you create: "Math Teacher", "Accounts", "Front Desk", "Vice Principal" - your names, not ours. For each one you tick which of the 87 permissions it gets, across students, attendance, exams, billing, staff, reports, timetable, vault and the rest.',
                },
                {
                    role: 'Per-person exceptions',
                    can: 'One teacher who also handles admissions does not need a whole new role. Grant or restrict individual permissions on top of the role they already have.',
                },
                {
                    role: 'Someone with no role yet',
                    can: 'A member you have invited but not yet given a role falls back to a minimal baseline. Assign them a role - even one with nothing ticked - and that role is what applies from then on.',
                },
            ],
        },
        {
            kind: 'pitfalls',
            eyebrow: 'Learned the hard way',
            title: 'The four things schools redo',
            body: 'None of these break anything permanently. They all cost an afternoon.',
            pitfalls: [
                {
                    mistake: 'Importing students before the academic year and classes exist',
                    fix: 'Set the year, terms and at least your class list first. Students need somewhere to go, and an import into a school with no classes gives you a list you then have to sort by hand.',
                },
                {
                    mistake: 'Adding the logo after generating the first batch of report cards',
                    fix: 'Upload branding during setup. Documents are generated with the branding that existed at the time, so a late logo means regenerating them.',
                },
                {
                    mistake: 'Creating one shared login for the whole office',
                    fix: 'Invite each person separately. It costs two minutes each and it is the only way the audit trail can tell you who changed a mark or waived a fee.',
                },
                {
                    mistake: 'Building the fee structure per student rather than per class',
                    fix: 'Define fee heads at class and term level. Per-student amounts are for the exceptions - scholarships, sibling discounts - not the baseline.',
                },
            ],
        },
        {
            kind: 'prose',
            eyebrow: 'After the first day',
            title: 'What to do in week one',
            paragraphs: [
                'Once your classes, students and staff exist, the fastest way to make the system real is to run one full loop of something small rather than to configure everything. Pick attendance: have every class teacher mark their roll for a week. It takes them under two minutes a day, it produces the first thing parents actually notice, and it surfaces any wrong class assignment immediately - because a teacher will tell you the moment a student is missing from their list.',
                'The second loop worth running early is a single fee cycle for one class. Generate the bills, let a few parents pay online, and reconcile it. A small cycle teaches your accountant the screens with low stakes, and it is far easier to correct a fee structure after ten bills than after four hundred.',
                'Exams can wait until your first terminal. The exam cycle is the most involved part of the platform and there is no benefit to configuring it in week one - by the time you need it, your staff will already be comfortable with the screens they use daily.',
            ],
        },
    ],
}


// ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Grounded in `apps/main`: routes `/attendance` (daily marking), `/attendance/class`,
 * `/attendance/monthly`, `/attendance/student/[id]`; the five states are the real enum -
 * PRESENT, ABSENT, LATE, HALF_DAY, EXCUSED.
 */
const DAILY_ATTENDANCE: Guide = {
    slug: 'daily-attendance',
    title: 'Getting every class marked before first period ends',
    summary:
        'Roll call is the one thing every teacher does every day, so it is the habit worth getting right first. What to set up, what a teacher actually taps, and how to read the month without compiling anything.',
    audience: 'Principal',
    time: 'About 20 minutes to set up, then 2 minutes a class per day',
    before: [
        'Your classes and sections created, each with a class teacher',
        'Students enrolled and assigned to a class',
        'Teachers invited, so they can mark their own roll',
        'Guardian phone numbers on student records, if you want absence alerts',
    ],
    after: [
        'Every class teacher marking their roll from a phone in about two minutes',
        'Guardians notified the same morning a student is absent',
        'A monthly report that assembles itself, with holidays already excluded',
        'Chronic absentees surfaced weekly instead of discovered at exam time',
    ],
    reviewedOn: '2026-08-21',
    metaTitle: 'Daily Attendance Guide - Marking a Class in Gurukul',
    metaDescription:
        'How to run daily attendance in a Nepali school: setting up marking, the five attendance states, parent SMS alerts, monthly reports and chronic-absentee flags.',
    keywords: 'school attendance guide, daily attendance marking, attendance software Nepal, parent absence SMS',
    related: [
        { label: 'Attendance', href: '/features/attendance' },
        { label: 'Student management', href: '/features/students' },
    ],
    sections: [
        {
            kind: 'prerequisites',
            eyebrow: 'Before you start',
            title: 'Four things that must already be true',
            body: 'Attendance reads from records other modules own, so it is the module most likely to look broken when something upstream is missing.',
            items: [
                'Classes and sections created, each with a class teacher assigned',
                'Students enrolled and sitting in the right class - a student in the wrong section will be missing from the roll a teacher expects',
                'Teachers invited and able to log in, if they are marking rather than the office',
                'Guardian phone numbers on student records - without one, there is nobody to alert',
                'Your holiday calendar filled in, so percentages count only real school days',
            ],
        },
        {
            kind: 'walkthrough',
            eyebrow: 'The daily loop',
            title: 'What a teacher actually does',
            body: 'This is the part that has to be faster than the paper register, or nobody switches. It is designed around correcting exceptions rather than entering data.',
            steps: [
                {
                    title: 'Open the class for today',
                    body: 'A teacher opens Attendance and their assigned class is already there - they do not pick from a list of the whole school. The roster loads with every student already marked Present.',
                    time: '10 sec',
                    outcome: 'The full roster, pre-marked, with today already selected.',
                    art: 'students',
                },
                {
                    title: 'Tap only the exceptions',
                    body: 'Five states exist: Present, Absent, Late, Half-day and Excused. In a normal class you touch three or four students. Bulk actions cover a holiday or a period nobody attended without going row by row.',
                    time: '1 min',
                    outcome: 'A running count of present against total at the top of the list.',
                    art: 'attendance',
                },
                {
                    title: 'Save, and the alerts go out',
                    body: 'Saving is the moment guardians of absent students are notified. Nobody looks up a number and nobody decides who to call - which is why the alert actually happens on a busy morning.',
                    time: '5 sec',
                    outcome: 'A confirmation naming how many guardians were notified.',
                },
            ],
        },
        {
            kind: 'walkthrough',
            eyebrow: 'What the office does',
            title: 'Reading the month without compiling it',
            body: 'The office side is mostly reading rather than doing. Everything below is built from marks teachers have already saved.',
            steps: [
                {
                    title: 'Check the day school-wide',
                    body: 'The attendance overview shows every class and whether it has been marked yet. This is the screen that replaces walking round collecting registers - and it tells you at 8:15, not at lunch.',
                    time: '30 sec',
                    outcome: 'Classes not yet marked are visible, so you can chase one teacher rather than eleven.',
                    art: 'report',
                },
                {
                    title: 'Pull the monthly report',
                    body: 'Per class and per student, for any month, with Saturdays, Dashain, Tihar and any closure you have added already excluded. There is no compilation step because the report is the marks.',
                    time: '1 min',
                    outcome: 'A month you can export to PDF or Excel without editing it first.',
                },
                {
                    title: 'Look at one student properly',
                    body: 'A single student view shows their whole record across the year rather than one month. This is the screen to open before a parent meeting, not the class report.',
                    time: '1 min',
                    outcome: 'The pattern - which days, how often, since when.',
                },
            ],
        },
        {
            kind: 'roles',
            eyebrow: 'Who can mark what',
            title: 'Marking is scoped, reading is granted',
            body: 'Attendance is the clearest example of why permissions are per-role rather than fixed - most schools want teachers marking but not reading school-wide.',
            roles: [
                { role: 'A class teacher', can: 'Marks their own assigned classes. They do not see, and cannot mark, anybody else\'s roll.' },
                { role: 'A subject teacher', can: 'If you take attendance per period rather than once a day, each subject teacher marks their own period. Reports roll up cleanly either way - decide which model you want before teachers start.' },
                { role: 'The office', can: 'A role you create with the school-wide attendance permission sees every class and every report. Most schools give this to whoever chases absences.' },
                { role: 'The principal', can: 'Everything, always - a principal cannot be locked out of a module.' },
            ],
        },
        {
            kind: 'pitfalls',
            eyebrow: 'Learned the hard way',
            title: 'What goes wrong in week one',
            body: 'All four are recoverable. All four waste a morning.',
            pitfalls: [
                {
                    mistake: 'Starting attendance before the holiday calendar is filled in',
                    fix: 'Percentages count actual school days. Mark Saturdays and festival closures first, or the first monthly report reads low and nobody trusts the number after that.',
                },
                {
                    mistake: 'Letting the office mark on behalf of teachers "just for now"',
                    fix: 'It never stops being just for now, and it puts the office back in the register-collecting business. Have teachers mark from day one - it is under two minutes and it is the whole point.',
                },
                {
                    mistake: 'Not deciding daily versus per-period before teachers start',
                    fix: 'Both work, but switching mid-term makes two halves of a term that do not compare. Pick one in the first week.',
                },
                {
                    mistake: 'Guardian numbers missing or wrong on student records',
                    fix: 'Alerts go to the registered guardian number. Spot-check a class before you tell parents to expect messages - a silent alert is worse than none, because everyone assumes it works.',
                },
            ],
        },
        {
            kind: 'prose',
            eyebrow: 'Making it stick',
            title: 'Why this is the module to start with',
            paragraphs: [
                'Attendance is the fastest way to make a new system real, and that is not because it is the most valuable module - fees probably are. It is because it is the only one every member of staff touches every single day. A habit that happens eleven times each morning establishes itself in about a week; one that happens twice a term never quite does.',
                'It is also the module that surfaces your setup mistakes for free. A student in the wrong section, a class with no teacher assigned, a guardian number that was never entered - none of these announce themselves in a settings screen. They announce themselves the first morning a teacher opens their roll and someone is missing from it, and a teacher will tell you immediately.',
                'The thing worth protecting is the two minutes. If marking a class ever takes longer than the paper register did, staff quietly go back to paper and you find out at the end of the term. That is why the roster loads pre-marked and why a teacher sees only their own classes - every extra tap is a reason to stop.',
            ],
        },
    ],
}


// ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Grounded in `apps/main`: `/billing` (overview), `/billing/new` (create bill),
 * `/billing/bulkbill`, `/billing/student` (ledger), `/billing/defaulters`, `/billing/summary`,
 * `/billing/late-fees`. Bill statuses are the real enum - PENDING, UNPAID, PARTIAL, PAID, OVERDUE,
 * CANCELLED - and the payment methods are CASH, KHALTI, ESEWA, BANK_TRANSFER.
 */
const COLLECTING_FEES: Guide = {
    slug: 'collecting-fees',
    title: 'From a fee structure to money in the account',
    summary:
        'Set the structure once, generate a term of bills in one pass, and let parents pay from home. What to define before the first bill, how a cycle actually runs, and how to reconcile it at month end.',
    audience: 'Accountant',
    time: 'About an hour to set up, then one pass per term',
    before: [
        'Students enrolled and assigned to classes - bills are generated per class',
        'Your fee heads decided: what you charge, per class, per term',
        'Any sibling or scholarship rules you apply, so they can be set as discounts rather than manual edits',
        'A Khalti or eSewa account, if you want parents paying online',
    ],
    after: [
        'A fee structure that regenerates every term without being rebuilt',
        'Bills issued to a whole class in one pass, each with its own receipt number',
        'Parents paying from home through Khalti or eSewa, with automatic receipts',
        'A defaulters view and reminders that fire without a phone call',
        'A month-end reconciliation your auditor will accept',
    ],
    reviewedOn: '2026-08-21',
    metaTitle: 'Fee Collection Guide - Billing Students in Gurukul',
    metaDescription:
        'How to run school fee collection in Nepal: building a fee structure, bulk billing a class, Khalti and eSewa payments, reminders and month-end reconciliation.',
    keywords: 'school fee collection guide, Khalti school fees, eSewa school payment, bulk billing students Nepal',
    related: [
        { label: 'Fee billing', href: '/features/billing' },
        { label: 'Reports', href: '/features/reports' },
    ],
    sections: [
        {
            kind: 'walkthrough',
            eyebrow: 'Set it up once',
            title: 'Build the structure before the first bill',
            body: 'This is the part worth slowing down for. A structure defined properly applies every term for years; one improvised around the first bill gets corrected four hundred times.',
            steps: [
                {
                    title: 'Define your fee heads',
                    body: 'Tuition, admission, exam, transport, hostel - whatever your school actually charges, each as its own head. Keeping them separate is what lets a parent see a breakdown and lets your accountant report on transport without unpicking a single total.',
                    time: '15 min',
                    outcome: 'Each head listed with the class and term it applies to.',
                    art: 'fees',
                },
                {
                    title: 'Set amounts per class and term',
                    body: 'Amounts belong at class and term level, not per student. Per-student figures are for the exceptions - a scholarship, a sibling discount - and treating them as the baseline is the single most common setup mistake.',
                    time: '20 min',
                    outcome: 'A grid you can read down: every class, every term, every head.',
                },
                {
                    title: 'Add discounts as rules, not edits',
                    body: 'Sibling discounts apply automatically once students share a guardian. Scholarships and staff-ward concessions are set against the student. Both are logged, which is what makes a waiver defensible six months later.',
                    time: '10 min',
                    outcome: 'Discounts show as a line on the bill rather than a smaller total with no explanation.',
                },
                {
                    title: 'Connect Khalti and eSewa',
                    body: 'There is no setup fee to connect either. You pay the standard gateway charge per online payment, settled with the provider. Cash and bank transfers are recorded free and produce the same digital receipt.',
                    time: '10 min',
                    outcome: 'Payment options appear on the parent-facing bill.',
                    art: 'fees',
                },
            ],
        },
        {
            kind: 'walkthrough',
            eyebrow: 'Every term',
            title: 'Running one cycle',
            body: 'Once the structure exists this is the whole job, and it is one pass rather than one bill at a time.',
            steps: [
                {
                    title: 'Generate bills for a class',
                    body: 'Bulk billing takes a class and a term and issues a bill to every enrolled student, each with its own receipt number. Do one class first and read a few of the bills before running the rest.',
                    time: '2 min per class',
                    outcome: 'Bills listed as Pending, with the total for the class.',
                    art: 'report',
                },
                {
                    title: 'Let parents pay',
                    body: 'Parents pay in the Gurukul parent app through Khalti or eSewa; a bank transfer waits in Pending Transfers until your accountant confirms it. Cash at the office is recorded by your accountant and produces the same numbered receipt, so both routes end in the same place.',
                    outcome: 'Bills move from Pending to Paid, or Partial where somebody has paid some of it.',
                },
                {
                    title: 'Work the defaulters list',
                    body: 'Overdue bills collect on their own screen rather than needing to be found. Reminders fire automatically as bills age, so chasing is the exception rather than the monthly routine.',
                    time: '10 min a week',
                    outcome: 'A shrinking list, and a record of who was reminded and when.',
                },
                {
                    title: 'Reconcile at month end',
                    body: 'The collection summary covers cash, Khalti, eSewa and bank transfer in one report, with class-wise outstanding and the full receipt log. This is the export your auditor asks for.',
                    time: '5 min',
                    outcome: 'One report, not four exports stitched together.',
                },
            ],
        },
        {
            kind: 'roles',
            eyebrow: 'Who sees the money',
            title: 'Fee data is gated separately, on purpose',
            body: 'Almost every school wants exactly one thing here: the accountant sees the ledger and the class teacher does not.',
            roles: [
                { role: 'Whoever you call the accountant', can: 'A role you create with the billing permissions - creating bills, recording payments, reading the ledger and exporting the summary. Name it whatever your school already calls that job.' },
                { role: 'A class teacher', can: 'Nothing here by default. A teacher role does not carry billing permissions unless you tick them, which is what stops fee information travelling round the staff room.' },
                { role: 'Somebody who only needs to look', can: 'Give a role read access to the summary without the ability to create bills or record payments. Useful for a head who wants the number without the responsibility.' },
                { role: 'Every waiver and adjustment', can: 'Logged with who made it and what it was before. This is the part that matters at audit, and it happens whoever holds the permission.' },
            ],
        },
        {
            kind: 'pitfalls',
            eyebrow: 'Learned the hard way',
            title: 'Where fee setups go wrong',
            body: 'The first three cost an evening. The fourth costs trust with parents.',
            pitfalls: [
                {
                    mistake: 'Generating a whole school of bills before reading one',
                    fix: 'Run a single class, open three bills, check the heads and the discounts. Correcting a structure after ten bills is a minute; after four hundred it is an evening.',
                },
                {
                    mistake: 'Entering discounts by editing the amount',
                    fix: 'Set them as discounts so they appear as a line and stay logged. An edited total tells nobody why it is lower, including you, six months later.',
                },
                {
                    mistake: 'Treating cash as outside the system',
                    fix: 'Record it at the office as it comes in. A cash payment that never gets entered is the reason a reconciliation does not balance, and it is always found last.',
                },
                {
                    mistake: 'Turning on reminders before checking guardian contacts',
                    fix: 'A reminder to a wrong number is worse than no reminder - the parent hears nothing and you believe they were told. Spot-check a class first.',
                },
            ],
        },
        {
            kind: 'prose',
            eyebrow: 'The shape of it',
            title: 'Why the structure matters more than the bills',
            paragraphs: [
                'Fee collection looks like a monthly task and is really an annual one. Almost all of the work is deciding what you charge, to whom, and when - and that decision, once encoded properly, generates every subsequent term without being revisited. Schools that struggle with billing software are usually not struggling with the software; they are re-deciding the structure every term because it was never written down anywhere except in someone experience.',
                'The second thing worth understanding early is that a bill is a record, not a message. Generating one does not chase anybody. What chases people is the reminder schedule and the defaulters view, and those work on the ageing of bills you have already issued. Schools that issue late and chase early get the worst of both - so the cycle is worth starting on time even in a term where you expect slow payment.',
                'Finally: run a small cycle before a big one. One class, ten bills, a few online payments and a reconciliation. It teaches your accountant every screen with almost nothing at stake, and it surfaces a wrong fee head while it is still a two-minute fix.',
            ],
        },
    ],
}


// ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Grounded in `apps/main`: `/administration/(manage)/invite`, `/administration/team`
 * ("Roles & Access" in the sidebar), `/administration/members` ("All Members"),
 * `/administration/audit-logs`, `/administration/login-activity`. The permission model is the one
 * in `packages/core/src/permissions` - 87 permissions, 18 modules, two account roles.
 */
const ROLES_AND_ACCESS: Guide = {
    slug: 'roles-and-access',
    title: 'Giving your staff exactly the access they need',
    summary:
        'You define the roles your school actually has, tick what each one can reach, and invite people into them. How the two layers work, how to design a role set that survives, and what to do about the person who is an exception.',
    audience: 'Principal',
    time: 'About 40 minutes, once',
    before: [
        'A rough list of who works at your school and what each of them does',
        'A decision on who handles fees - it is the permission worth being deliberate about',
        'Email addresses for everyone you plan to invite',
    ],
    after: [
        'A set of roles named the way your school already talks about jobs',
        'Every staff member on their own login, with their own access',
        'Fee and salary data visible only to the people who need it',
        'An audit trail that can tell you who changed a mark or waived a fee',
    ],
    reviewedOn: '2026-08-21',
    metaTitle: 'Roles and Permissions Guide - Staff Access in Gurukul',
    metaDescription:
        'How school staff access works in Gurukul: the two account types, school-defined roles, 87 permissions across 18 modules, per-person exceptions and the audit trail.',
    keywords: 'school software user roles, staff permissions school management, role based access school Nepal',
    related: [
        { label: 'Staff & HR', href: '/features/staff' },
        { label: 'Getting started', href: '/guides/getting-started' },
    ],
    sections: [
        {
            kind: 'roles',
            eyebrow: 'The model',
            title: 'Two layers, and only one of them matters day to day',
            body: 'Most confusion about access comes from assuming there is a fixed list of job titles. There is not, and understanding why makes the rest straightforward.',
            roles: [
                { role: 'Layer one - the account type', can: 'Every staff login is Principal or Staff. That is the entire list. It is not a job title and on its own it decides almost nothing.' },
                { role: 'Principal', can: 'Bypasses permission checks completely. You cannot lock a principal out of a module - which is deliberate, because the account that configures everything must always be able to get back in.' },
                { role: 'Layer two - your roles', can: 'This is the layer that does the work. You create roles, name them what your school calls them, and tick which of the 87 permissions across 18 modules each one gets.' },
                { role: 'Per-person exceptions', can: 'Grant or restrict an individual permission on top of somebody role, for the teacher who also runs admissions. One person does not need a whole new role.' },
                { role: 'A member with no role yet', can: 'Falls back to a minimal baseline until you assign one. Assign a role - even an empty one - and that role applies from then on.' },
            ],
        },
        {
            kind: 'walkthrough',
            eyebrow: 'Setting it up',
            title: 'Design the roles before you invite anyone',
            body: 'Inviting first and sorting access later means doing the same job twice and having a week where everybody can see everything.',
            steps: [
                {
                    title: 'List the jobs, not the people',
                    body: 'Write down the four or five distinct jobs at your school - not the twenty people. Most schools land on something like teaching, accounts, front desk and leadership. Roles describe jobs; people get assigned to them.',
                    time: '10 min',
                    outcome: 'A short list. If it is longer than six, you are describing people rather than jobs.',
                },
                {
                    title: 'Create each role and tick its permissions',
                    body: 'Roles & Access is where roles live. For each one, work through the modules and grant what that job genuinely needs. Start narrow - it is far easier to add a permission somebody asks for than to explain why they could see salaries.',
                    time: '20 min',
                    outcome: 'Each role listed with a count of what it can reach.',
                    art: 'invite',
                },
                {
                    title: 'Invite people into a role',
                    body: 'Send an email invite and pick the role as you send it. They set their own password, so nobody ever knows anybody else login. Assign their classes at the same time if they are teaching.',
                    time: '2 min each',
                    outcome: 'They appear in All Members as soon as they accept.',
                    art: 'invite',
                },
                {
                    title: 'Handle the exceptions individually',
                    body: 'The teacher who also handles admissions gets the admissions permission added to their account - not a new "Teacher Plus Admissions" role. Roles multiply badly; exceptions do not.',
                    time: '1 min each',
                    outcome: 'Their access differs from their role, and the difference is visible.',
                },
            ],
        },
        {
            kind: 'walkthrough',
            eyebrow: 'Keeping it honest',
            title: 'What to check afterwards',
            body: 'Access drifts. These are the two screens worth opening occasionally rather than never.',
            steps: [
                {
                    title: 'Read the audit log after anything contested',
                    body: 'A changed mark, a waived fee, an edited record - the log says who and when. This is the screen that turns an argument into a two-second lookup, and it is the reason shared logins are worth refusing.',
                    outcome: 'The action, the person, the timestamp.',
                },
                {
                    title: 'Check login activity when somebody leaves',
                    body: 'When a staff member leaves, remove their access the same day. Login activity tells you whether an account is still being used, which is the thing people forget to check.',
                    outcome: 'A clear picture of who is actually still logging in.',
                },
            ],
        },
        {
            kind: 'pitfalls',
            eyebrow: 'Learned the hard way',
            title: 'The four access mistakes',
            body: 'The first is the one that causes the other three.',
            pitfalls: [
                {
                    mistake: 'One shared office login',
                    fix: 'It costs two minutes per person to avoid, and it is the only thing standing between you and an audit trail that says "the office" did everything. Invite each person separately from day one.',
                },
                {
                    mistake: 'Creating a role per person',
                    fix: 'Roles describe jobs. Twenty roles for twenty people is a permission matrix nobody will maintain - use four roles and per-person exceptions.',
                },
                {
                    mistake: 'Granting broadly to avoid support questions',
                    fix: 'Start narrow. Adding a permission when somebody asks takes seconds; explaining why a teacher could see payroll does not.',
                },
                {
                    mistake: 'Forgetting that an assigned role is authoritative even when empty',
                    fix: 'Assign somebody a role with nothing ticked and they get nothing - that is the intended behaviour, not a bug. If somebody has lost access unexpectedly, check whether they have been given an empty role rather than no role.',
                },
            ],
        },
        {
            kind: 'prose',
            eyebrow: 'Why it works this way',
            title: 'Why there is no Teacher role in the product',
            paragraphs: [
                'It would be simpler to ship a fixed list - Teacher, Accountant, Librarian - and many systems do. The reason this one does not is that no two schools mean the same thing by those words. In one school the accountant also handles admissions; in another the same person runs the front desk and nothing else. A fixed list forces every school into the shape of whichever school the software was designed around, and the usual result is that everybody gets granted more than they need because the intended role does not quite exist.',
                'Defining your own roles costs you about forty minutes once. What it buys is that the permission a person has matches the job they actually do, which is the only version of access control anybody maintains. Roles you recognise get kept up to date; roles you tolerate do not.',
                'The one thing to hold on to is that permissions are computed fresh on every request. Change a role and it applies immediately - there is no cache to wait out and nothing to remember to rebuild. So it is safe to start narrow and widen as people ask, which is the direction that ends up correct.',
            ],
        },
    ],
}


// ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Grounded in `apps/main`: the 29 `/examinations/*` routes - `/exams` and `/exams/[examId]` with
 * its `admit-cards`, `seating-plan` and `submission-status` sub-pages; `/evaluation` with
 * `grid`, `all-subjects`, `bulk-upload`, `internal-assessment` and `co-scholastic`;
 * `/questionpapers` with `create`, `bank` and `community`; `/results` with `marksheets`, `annual`
 * and `progress`; plus `/ai-grading` and `/analytics`. Statuses are the real enum - DRAFT,
 * SCHEDULED, ONGOING, COMPLETED, APPROVED, PUBLISHED.
 */
const RUNNING_AN_EXAM: Guide = {
    slug: 'running-an-exam',
    title: 'One exam, from the routine to the report cards',
    summary:
        'The longest cycle in the platform, in the order it actually happens: schedule it, generate the papers, sit it, enter the marks, approve, publish. What each stage needs from the one before it.',
    audience: 'Principal',
    time: 'A full cycle - about 3 hours of admin spread across the exam period',
    before: [
        'Your academic year and terms set, so the exam has a term to belong to',
        'A grading scheme chosen - marks cannot become grades without one',
        'Classes and subjects configured, with teachers assigned to them',
        'Students enrolled in the classes sitting the exam',
    ],
    after: [
        'An exam scheduled with rooms, dates and invigilators, and no clashes',
        'Question papers generated and printed in-house',
        'Marks entered once, with grades, GPA and ranks computed from them',
        'Report cards approved and delivered into each parent app',
    ],
    reviewedOn: '2026-08-21',
    metaTitle: 'Running an Exam - Scheduling, Marks and Results in Gurukul',
    metaDescription:
        'The full exam cycle for a Nepali school: scheduling, admit cards, AI question papers, mark entry, NEB grading, approval and publishing report cards.',
    keywords: 'school exam management guide, NEB result publishing, mark entry school software, question paper generation Nepal',
    related: [
        { label: 'Examinations', href: '/features/examinations' },
        { label: 'Reports', href: '/features/reports' },
    ],
    sections: [
        {
            kind: 'prerequisites',
            eyebrow: 'Before you start',
            title: 'Four things the exam cycle reads from elsewhere',
            body: 'More than any other module, examinations depends on configuration done earlier. Every one of these failing shows up as a confusing screen rather than a clear error.',
            items: [
                'The academic year and its terms - an exam belongs to a term, and term comparisons need more than one to exist',
                'A grading scheme - marks cannot become grades or GPA without the conversion defined',
                'Subjects configured per class, with theory and practical weightage where it applies',
                'Teachers assigned to the subjects they will be entering marks for',
                'Students enrolled in the classes sitting the exam - a student added later will not appear on a mark sheet already generated',
            ],
        },
        {
            kind: 'walkthrough',
            eyebrow: 'Stage one',
            title: 'Schedule it',
            body: 'Scheduling is where clashes get caught. Doing it properly here is what stops a teacher being invigilating in two rooms at once on the morning it matters.',
            steps: [
                {
                    title: 'Create the exam and its subjects',
                    body: 'Name the exam, pick the term and the classes sitting it, then set the subjects with their dates and durations. It starts as a draft, so nothing is visible to anyone until you are ready.',
                    time: '20 min',
                    outcome: 'The exam listed as Draft, with its full subject schedule.',
                    art: 'academicYear',
                },
                {
                    title: 'Assign rooms and invigilators',
                    body: 'Conflict detection runs as you assign - a teacher already invigilating in that slot, or a room already in use, is refused rather than warned about. That check is the whole reason to schedule inside the system rather than in a spreadsheet.',
                    time: '20 min',
                    outcome: 'Every slot filled with no conflicts flagged.',
                    art: 'exam',
                },
                {
                    title: 'Generate admit cards and the seating plan',
                    body: 'Both come from the schedule you just built - the admit card carries the student symbol number and their subject dates, the seating plan lays out rooms. Print them together.',
                    time: '5 min',
                    outcome: 'Print-ready PDFs for every student and every room.',
                },
            ],
        },
        {
            kind: 'walkthrough',
            eyebrow: 'Stage two',
            title: 'Get the papers written',
            body: 'This is the stage AI actually shortens. A teacher still decides what to test; the drafting is what stops taking three hours.',
            steps: [
                {
                    title: 'Generate a paper from the chapters covered',
                    body: 'Pick subject, class, chapters and difficulty, and a full CDC-aligned paper is drafted with a marking scheme. Generated on demand and printed in-house, so there is no pre-distribution and no leakage window.',
                    time: '30 sec per paper',
                    outcome: 'A print-ready PDF with the marking scheme included.',
                    art: 'gradeBoard',
                },
                {
                    title: 'Review and adjust before printing',
                    body: 'Every generated paper is a first draft. Open it, swap a question you do not like, rebalance a section. Teachers who skip this step are the ones who find a chapter they had not covered on the paper.',
                    time: '15 min per paper',
                    outcome: 'A paper the subject teacher has actually read.',
                },
                {
                    title: 'Save what worked to the bank',
                    body: 'Questions you keep are saved and reusable across years, tagged by chapter and difficulty. The bank is what makes the second year of this much faster than the first.',
                    outcome: 'The question available next term without regenerating.',
                },
            ],
        },
        {
            kind: 'walkthrough',
            eyebrow: 'Stage three',
            title: 'Marks, approval, publishing',
            body: 'The order here is deliberate and worth respecting: nothing reaches a parent until somebody has approved it.',
            steps: [
                {
                    title: 'Enter marks, or upload them',
                    body: 'Subject teachers enter marks from any device with validation catching impossible scores as they type. Where you collect on paper, bulk upload takes the spreadsheet instead - both land in the same place.',
                    time: '10 min per subject',
                    outcome: 'A completion view showing which subjects are still outstanding.',
                    art: 'exam',
                },
                {
                    title: 'Let the grades compute',
                    body: 'Subject grades, the credit-weighted GPA, class rank and section rank are all derived from the marks - there is no separate calculation step and no formula to maintain. Theory and practical weightage is applied per subject.',
                    outcome: 'Grades and ranks appear as soon as a subject is complete.',
                },
                {
                    title: 'Approve, then publish',
                    body: 'Results sit unpublished until approved. Publishing is one action for the whole class and it is what makes results visible to parents and generates the report card PDFs.',
                    time: '10 min',
                    outcome: 'Parents notified, report cards downloadable, status Published.',
                },
            ],
        },
        {
            kind: 'pitfalls',
            eyebrow: 'Learned the hard way',
            title: 'Where exam cycles go wrong',
            body: 'Three of these are recoverable. The fourth is the one that reaches parents.',
            pitfalls: [
                {
                    mistake: 'Scheduling before the grading scheme is set',
                    fix: 'Marks entered against no scheme cannot become grades, and you find out at the point you wanted to publish. Set the scheme in configuration first - it takes two minutes.',
                },
                {
                    mistake: 'Printing admit cards before the schedule is final',
                    fix: 'Admit cards carry the subject dates. Move a paper after printing and every card is wrong. Finalise the schedule, then print.',
                },
                {
                    mistake: 'Generating papers without reading them',
                    fix: 'They are drafts. The teacher who covered the chapters is the only person who can tell whether the paper matches what the class was taught.',
                },
                {
                    mistake: 'Publishing before checking one full mark sheet',
                    fix: 'Open a single student report card and read it end to end before publishing the class. A wrong weightage is invisible in a grid of numbers and obvious on a report card.',
                },
            ],
        },
        {
            kind: 'prose',
            eyebrow: 'Why the order matters',
            title: 'The cycle is a sequence, not a set of screens',
            paragraphs: [
                'Almost every problem schools have with exam software comes from treating the stages as independent. They are not: the seating plan is derived from the schedule, the admit card is derived from the schedule, the mark sheet is derived from the subjects, the report card is derived from the marks, and the rank is derived from all of it. Change something upstream after the downstream artefact exists and you regenerate the artefact - which is fine if you expected it and alarming if you did not.',
                'The practical consequence is that the slowest part of the cycle should be the earliest. Scheduling deserves an unhurried afternoon, because everything printed afterwards inherits it. Mark entry, by contrast, is genuinely fast and can be spread across whoever is free.',
                'The one stage that is worth doing at half speed the first time is publishing. Approve one class, read one report card properly, then publish the rest. It is the only stage where a mistake is seen by a parent before it is seen by you.',
            ],
        },
    ],
}


// ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Grounded in `apps/main`: `/students` (list), `/students/[id]` (profile), `/students/importcsv`,
 * `/students/promotions`, `/students/transfer-certificates`, `/students/transfer-in`.
 */
const ENROLLING_STUDENTS: Guide = {
    slug: 'enrolling-students',
    title: 'Getting your whole roll into the system, correctly',
    summary:
        'The record everything else reads from. How to import a school without inheriting a spreadsheet mess, what a complete profile needs, and how promotions and transfer certificates work at year end.',
    audience: 'Admin',
    time: 'An afternoon for a whole school, then minutes per new admission',
    before: [
        'Classes and sections created - students need somewhere to go',
        'Your existing student list, in whatever spreadsheet you already keep',
        'Guardian names and phone numbers, if you want alerts and the parent app to work',
    ],
    after: [
        'Every student on one searchable record with their full history',
        'Guardians linked, so attendance alerts and fee bills reach somebody',
        'A repeatable path for new admissions mid-year',
        'Year-end promotions and transfer certificates as one action rather than a fortnight',
    ],
    reviewedOn: '2026-08-21',
    metaTitle: 'Enrolling Students - Import, Profiles and Promotions',
    metaDescription:
        'How to enrol students in a Nepali school: bulk import from Excel, complete student profiles, guardian links, year-end promotions and transfer certificates.',
    keywords: 'student enrollment guide, bulk import students Excel, transfer certificate Nepal, student promotion school software',
    related: [
        { label: 'Student management', href: '/features/students' },
        { label: 'Daily attendance', href: '/guides/daily-attendance' },
    ],
    sections: [
        {
            kind: 'walkthrough',
            eyebrow: 'The first pass',
            title: 'Import the school you already have',
            body: 'The goal of the first pass is not a perfect record - it is a complete one. Missing students cause visible problems immediately; a missing middle name does not.',
            steps: [
                {
                    title: 'Enrol one student by hand first',
                    body: 'Before importing three hundred, add one manually. Ten minutes doing it by hand shows you which fields matter and what a finished profile looks like, which makes every decision in the import obvious instead of a guess.',
                    time: '5 min',
                    outcome: 'One complete profile you can use as the template for what "good" looks like.',
                    art: 'students',
                },
                {
                    title: 'Prepare the sheet you already keep',
                    body: 'You do not need a new spreadsheet. Take the one you have and make sure it has a column for class and section, and one for guardian contact. Those two are what turn a list of names into a working record.',
                    time: '20 min',
                    outcome: 'A sheet where every row knows which class it belongs to.',
                },
                {
                    title: 'Import, and read the errors',
                    body: 'Guided import validates every row and shows you the problems before anything saves. Rows that fail are usually a class name that does not match or a missing section - fix them in the sheet and re-run rather than editing after import.',
                    time: '20 min for a whole school',
                    outcome: 'A count of rows read, rows valid, and rows needing attention.',
                    art: 'importStudents',
                },
                {
                    title: 'Spot-check three classes',
                    body: 'Open a small class, a large one, and one with two sections. You are checking that students landed in the right section and guardians are attached - both are far cheaper to fix now than after attendance has been marked against them.',
                    time: '10 min',
                    outcome: 'Three class lists that match your paper register.',
                },
            ],
        },
        {
            kind: 'walkthrough',
            eyebrow: 'Ongoing',
            title: 'New admissions and students who leave',
            body: 'Once the bulk import is done, this is the routine - a few minutes each rather than a project.',
            steps: [
                {
                    title: 'Add a new admission',
                    body: 'One student, entered once, from the admission desk. Class and section, guardian and contact, and any documents you want on file. From that moment they appear in attendance, billing and exam screens automatically.',
                    time: '3 min',
                    outcome: 'The student appears on their class teacher roll the same day.',
                },
                {
                    title: 'Take in a student from another school',
                    body: 'A transfer in is its own path, because a mid-year arrival needs their previous school and joining date recorded rather than being treated as a fresh admission.',
                    time: '5 min',
                    outcome: 'A record that shows where they came from and when they joined.',
                    art: 'students',
                },
                {
                    title: 'Issue a transfer certificate when somebody leaves',
                    body: 'Generated from the record already on file - correct dates, correct class history, print-ready. Nothing is retyped from a register, which is where the errors on a hand-written TC come from.',
                    time: '2 min',
                    outcome: 'A PDF ready to stamp.',
                },
            ],
        },
        {
            kind: 'walkthrough',
            eyebrow: 'Year end',
            title: 'Promote the whole school in one pass',
            body: 'The job that used to take a fortnight of rewriting registers.',
            steps: [
                {
                    title: 'Run promotions class by class',
                    body: 'Promote a whole class to the next grade in one action, with eligibility rules applied. Every student keeps their complete multi-year history, so last year is still readable after the promotion.',
                    time: '5 min for a whole school',
                    outcome: 'Classes repopulated for the new year, with prior years intact.',
                    art: 'academicYear',
                },
                {
                    title: 'Handle the exceptions after, not during',
                    body: 'Repeats and withdrawals are individual decisions. Promote the class first, then adjust the handful who differ - it is far faster than trying to make the bulk action handle every case.',
                    outcome: 'A clean new-year roll with the exceptions correctly placed.',
                },
            ],
        },
        {
            kind: 'pitfalls',
            eyebrow: 'Learned the hard way',
            title: 'What makes an import go badly',
            body: 'All four are avoidable and all four are common.',
            pitfalls: [
                {
                    mistake: 'Importing before classes exist',
                    fix: 'Students need somewhere to go. An import into a school with no classes gives you a list you then sort by hand, which is the exact work the import was meant to save.',
                },
                {
                    mistake: 'Class names in the sheet that do not match the system',
                    fix: '"Grade 9" and "Class 9" and "IX" are three different strings. Pick the naming you used when creating classes and make the sheet match it before importing, not after.',
                },
                {
                    mistake: 'Skipping guardian contacts to save time',
                    fix: 'Every downstream feature that reaches a parent - absence alerts, fee reminders, result notifications - needs one. A roll with no guardians looks complete and silently does nothing.',
                },
                {
                    mistake: 'Fixing bad rows after the import rather than in the sheet',
                    fix: 'Correct the spreadsheet and re-run. Editing dozens of records one at a time in the interface is slower and you lose track of which you have done.',
                },
            ],
        },
        {
            kind: 'prose',
            eyebrow: 'Why this record matters most',
            title: 'Everything else is a view of this',
            paragraphs: [
                'The student record is the one piece of data every other module reads. Attendance is attendance against a student. A bill is against a student. A mark, a grade, a rank, a report card and a transfer certificate are all against a student. That is why a wrong section assignment does not stay a small problem - it shows up as a missing name on a roll, a bill sent to the wrong class total, and a student absent from a mark sheet, and each of those looks like a separate bug until somebody traces them back.',
                'It is also why the import is worth doing carefully once rather than quickly twice. The cost of a bad import is not the import - it is that you discover it three weeks later through its symptoms, by which point attendance and bills have been generated against the wrong data and unpicking it means touching all three.',
                'The pragmatic version: get every student in, in the right class, with a guardian attached. Photographs, addresses and custom fields can be filled in over the term by whoever has ten minutes. Nothing downstream breaks without them.',
            ],
        },
    ],
}


// ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Grounded in `apps/main`: `/configure/periods`, `/configure/rooms`,
 * `/configure/teacher-assignments`, `/configure/schedule-builder` and
 * `/(academics)/timetable-calendar`. The week runs on the real `DayOfWeek` enum, which starts
 * SUNDAY - correct for Nepal, and the reason the grid is not Monday-first.
 */
const BUILDING_THE_TIMETABLE: Guide = {
    slug: 'building-the-timetable',
    title: 'A clash-free week, built in about an hour',
    summary:
        'Four pieces of configuration, then a grid that refuses to let you double-book anyone. What to set up first, how to place periods without creating conflicts, and what to do when a teacher is away.',
    audience: 'Admin',
    time: 'About an hour for a whole school, once per term',
    before: [
        'Classes and sections created',
        'Subjects configured per class',
        'Staff invited, so teachers exist to assign',
        'Your weekly pattern decided - which days you teach and how many periods',
    ],
    after: [
        'A published timetable every teacher and class can see',
        'Zero double-bookings, because the grid refuses them rather than warning',
        'Teacher workload visible before you publish, not after complaints',
        'A same-day path for covering an absent teacher',
    ],
    reviewedOn: '2026-08-21',
    metaTitle: 'Building a School Timetable - Clash-Free Scheduling',
    metaDescription:
        'How to build a school timetable in Nepal: period structure, rooms, teacher assignments, clash detection, two-shift campuses and substitute cover.',
    keywords: 'school timetable software, clash free timetable, class routine Nepal, substitute teacher assignment',
    related: [
        { label: 'Timetables', href: '/features/timetables' },
        { label: 'Staff & HR', href: '/features/staff' },
    ],
    sections: [
        {
            kind: 'prerequisites',
            eyebrow: 'Before you start',
            title: 'Four pieces of configuration, in this order',
            body: 'The builder is quick. It is quick because everything it needs was decided beforehand - and doing them out of order is what turns an hour into an afternoon.',
            items: [
                'Your period structure - how many periods, how long, where breaks and assembly sit',
                'Rooms, if you want the grid to catch two classes booked into the same lab',
                'Teacher assignments - which teacher takes which subject in which class',
                'Your weekly pattern - the calendar runs Sunday to Saturday, so a Saturday holiday is a setting rather than a workaround',
                'Both shifts defined separately, if you run morning and day batches on one campus',
            ],
        },
        {
            kind: 'walkthrough',
            eyebrow: 'Build it',
            title: 'Placing the week',
            body: 'The grid checks the whole school on every placement, which is why it is worth building inside it rather than in a spreadsheet you then transcribe.',
            steps: [
                {
                    title: 'Set the period structure',
                    body: 'Period lengths, breaks, lunch and any assembly block. 35, 45 or 50 minute periods all work - configure what your school actually rings the bell for, once per academic year.',
                    time: '10 min',
                    outcome: 'An empty week with your real period boundaries on it.',
                    art: 'academicYear',
                },
                {
                    title: 'Map teachers to subjects',
                    body: 'Which teacher takes which subject in which class. This is what lets the builder know that placing Mr Sharma in two rooms at once is impossible - without it the grid has nothing to check against.',
                    time: '20 min',
                    outcome: 'A running total of periods per teacher, per week.',
                    art: 'timetable',
                },
                {
                    title: 'Place subjects into slots',
                    body: 'Drop a subject into a slot and the whole grid is verified in real time. A teacher already teaching that period, or a room already in use, is refused - not flagged for you to notice later.',
                    time: '20 min',
                    outcome: 'Slots filling with no conflict warnings.',
                    art: 'classes',
                },
                {
                    title: 'Check workload, then publish',
                    body: 'Before publishing, read the per-teacher period counts. An overloaded teacher is far easier to fix now than after the timetable is on every noticeboard.',
                    time: '10 min',
                    outcome: 'Every teacher and class sees their schedule the moment you publish.',
                    art: 'timetable',
                },
            ],
        },
        {
            kind: 'walkthrough',
            eyebrow: 'During the term',
            title: 'When somebody is away',
            body: 'This is the part that earns the hour you spent building it.',
            steps: [
                {
                    title: 'Mark the teacher unavailable',
                    body: 'Open the day and mark them away. The affected periods are immediately visible rather than being something the office reconstructs from the printed routine.',
                    time: '1 min',
                    outcome: 'Their periods for the day flagged as needing cover.',
                },
                {
                    title: 'Pick from the teachers who are genuinely free',
                    body: 'The substitution panel scans every other teacher schedule for that exact period and offers only staff who are free and qualified for the subject. It respects their existing load, so you do not fix one gap by overloading somebody else.',
                    time: '2 min',
                    outcome: 'Class and covering teacher both notified once you confirm.',
                },
            ],
        },
        {
            kind: 'pitfalls',
            eyebrow: 'Learned the hard way',
            title: 'What makes a timetable need rebuilding',
            body: 'All four are configuration mistakes rather than scheduling ones.',
            pitfalls: [
                {
                    mistake: 'Building before teacher assignments exist',
                    fix: 'With nothing mapping teachers to subjects, the grid has nothing to check and will happily accept a clash. Do assignments first - it is the step that makes clash detection work at all.',
                },
                {
                    mistake: 'Treating two shifts as one timetable',
                    fix: 'Morning and day batches are separate timetables. Teachers who work across both are still tracked together, so a cross-shift double-booking is still caught - but only if the shifts were defined as shifts.',
                },
                {
                    mistake: 'Rebuilding from scratch every term',
                    fix: 'Clone last term and adjust. Most schools reuse the large majority of the structure, and cloning keeps the room and period configuration you already validated.',
                },
                {
                    mistake: 'Publishing without reading the workload view',
                    fix: 'A legal timetable can still be an unfair one. The per-teacher counts take a minute to scan and are the difference between a routine staff accept and one they argue with.',
                },
            ],
        },
        {
            kind: 'prose',
            eyebrow: 'The point of it',
            title: 'Why the grid refuses rather than warns',
            paragraphs: [
                'A warning is something you can click past, and on the afternoon you are trying to finish a timetable you will click past it. That is why a double-booking is refused outright instead of flagged - the guarantee is not that the system tells you about clashes, it is that a published timetable cannot contain one. The check runs against the whole school on every placement, which is affordable precisely because it happens as you build rather than as a batch validation at the end.',
                'The knock-on is that the setup steps are not optional bureaucracy. Teacher assignments in particular feel like paperwork when you are keen to get to the grid, but they are the data the check runs against. A timetable built without them is a spreadsheet with nicer styling.',
                'Once it exists, the substitution flow is where the daily value sits. Covering an absent teacher used to mean somebody holding the printed routine and mentally cross-referencing who was free - which is why cover was so often given to whoever was nearest rather than whoever was appropriate.',
            ],
        },
    ],
}


// ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Grounded in `apps/main`: `/reports` (list), `/reports/new`, `/reports/[id]`,
 * `/reports/analytics`, plus the results surfaces the report cards come from -
 * `/examinations/results/marksheets`, `/results/annual`, `/results/progress`.
 */
const REPORTS_AND_RECORDS: Guide = {
    slug: 'reports-and-records',
    title: 'Getting a report out without compiling anything',
    summary:
        'Every report reads from records other people already entered. Which report answers which question, what has to be true for it to be right, and why the numbers cannot disagree with the system they came from.',
    audience: 'Principal',
    time: 'Minutes per report, once the data exists',
    before: [
        'Attendance being marked daily, if you want attendance reports to mean anything',
        'Marks entered and results published, for anything exam-related',
        'Bills issued and payments recorded, for fee reports',
        'Your school logo uploaded, so generated PDFs carry your branding',
    ],
    after: [
        'Report cards on your letterhead, delivered into each parent app',
        'Attendance and fee summaries you export rather than assemble',
        'Term-over-term comparisons that need no spreadsheet',
        'An audit-ready export for your accountant',
    ],
    reviewedOn: '2026-08-21',
    metaTitle: 'School Reports Guide - Report Cards and Summaries in Gurukul',
    metaDescription:
        'How to generate school reports in Nepal: report cards on the NEB scale, attendance summaries, fee collection reports, analytics and audit-ready exports.',
    keywords: 'school report card software, attendance report school, fee collection report, NEB report card Nepal',
    related: [
        { label: 'Reports', href: '/features/reports' },
        { label: 'Examinations', href: '/features/examinations' },
    ],
    sections: [
        {
            kind: 'walkthrough',
            eyebrow: 'The common ones',
            title: 'Four reports and when to reach for each',
            body: 'Most schools use four of the available reports the vast majority of the time. Knowing which answers which question saves more time than any feature here.',
            steps: [
                {
                    title: 'Report cards, at the end of a term',
                    body: 'Marks, grades, attendance percentage, rank and teacher remarks assembled onto your letterhead, with GPA on the scale you configured. Generated per class after results are approved, and delivered into the parent app rather than printed and handed out.',
                    time: '5 min per class',
                    outcome: 'A PDF per student, and parents notified.',
                    art: 'gradeBoard',
                },
                {
                    title: 'Attendance summaries, monthly',
                    body: 'Per student and per class, for any month, with holidays already excluded. This is the one to pull before a parent meeting or when somebody asks for the SEE paperwork.',
                    time: '2 min',
                    outcome: 'A month you export without editing first.',
                    art: 'attendance',
                },
                {
                    title: 'Fee collection, at month end',
                    body: 'Cash, Khalti, eSewa and bank transfer in one summary with class-wise outstanding and the receipt log. This is what your accountant hands to an auditor.',
                    time: '2 min',
                    outcome: 'One reconciliation report rather than four exports stitched together.',
                },
                {
                    title: 'Analytics, when you want the trend',
                    body: 'Subject averages, pass rates and term-over-term comparison. Use it to find the class slipping in one subject - not to check a single student, which the student view does better.',
                    time: '5 min',
                    outcome: 'A comparison across terms that needed no spreadsheet.',
                    art: 'report',
                },
            ],
        },
        {
            kind: 'roles',
            eyebrow: 'Who can pull what',
            title: 'Reporting access follows the data, not the report',
            body: 'A report is a view of underlying records, so access is granted per module rather than per report - which is what stops a fee summary being readable by someone who cannot see fees.',
            roles: [
                { role: 'Whoever runs results', can: 'Needs the exam and report permissions to generate and publish report cards. Usually the principal or an exam coordinator role you create.' },
                { role: 'Whoever runs fees', can: 'Needs billing permissions to pull the collection summary. A role with reports but not billing cannot produce a fee report - which is intended.' },
                { role: 'A class teacher', can: 'Typically given attendance reporting for their own classes and nothing school-wide. Enough to prepare for a parent meeting, not enough to browse the school.' },
                { role: 'Your accountant or auditor', can: 'A read-only role with the finance export permission lets somebody take what they need without the ability to change a bill.' },
            ],
        },
        {
            kind: 'walkthrough',
            eyebrow: 'Making them right',
            title: 'Three things to set before the first report',
            body: 'A report is only as correct as what it reads. These three are the ones that silently produce a wrong-looking number.',
            steps: [
                {
                    title: 'Upload branding first',
                    body: 'Logo, school name and address go onto every generated PDF. Documents carry the branding that existed when they were generated, so adding a logo later means regenerating the batch.',
                    time: '2 min',
                    outcome: 'Your letterhead on the next report you pull.',
                },
                {
                    title: 'Fill in the holiday calendar',
                    body: 'Attendance percentages count actual school days. Without Saturdays and festival closures marked, every attendance report reads low and nobody trusts the number afterwards.',
                    time: '10 min',
                    outcome: 'Percentages that match what a teacher would calculate by hand.',
                },
                {
                    title: 'Approve results before generating report cards',
                    body: 'Report cards are built from published results. Generating before approval either gives you nothing or gives you a card you then regenerate - the approval step exists so nothing reaches a parent unread.',
                    outcome: 'Report cards available for the class once results show Published.',
                },
            ],
        },
        {
            kind: 'pitfalls',
            eyebrow: 'Learned the hard way',
            title: 'Why a report looks wrong',
            body: 'Almost every "the report is wrong" turns out to be one of these four, and none of them is the report.',
            pitfalls: [
                {
                    mistake: 'Attendance percentages reading low',
                    fix: 'Holidays are not in the calendar, so non-teaching days are counting against every student. Fill in the calendar and the same report is suddenly right.',
                },
                {
                    mistake: 'A student missing from a mark sheet',
                    fix: 'They were enrolled after the sheet was generated, or they are in a different section than you expect. Check the student record before checking the report.',
                },
                {
                    mistake: 'Report cards without the logo',
                    fix: 'They were generated before branding was uploaded. Regenerate - the PDF is built at generation time and does not update retroactively.',
                },
                {
                    mistake: 'A fee total that does not match the ledger',
                    fix: 'Almost always a cash payment taken at the office and never entered. The report and the ledger read the same records, so a mismatch means something happened outside the system.',
                },
            ],
        },
        {
            kind: 'prose',
            eyebrow: 'The underlying idea',
            title: 'A report is not a document you write',
            paragraphs: [
                'The mental shift worth making is that nothing here is authored. A report card is not a document somebody produces at the end of term; it is a rendering of marks a teacher entered weeks earlier, an attendance percentage computed from roll calls, and a rank derived from the same marks as every other student. Nobody assembles it, which is why it takes minutes rather than a fortnight - and also why it cannot be corrected by editing the report.',
                'That has a useful consequence: the report and the system can never disagree. When a fee summary and the ledger show different totals in a spreadsheet-run school, somebody has to decide which is right. Here they are the same data read twice, so a mismatch is not an inconsistency to reconcile - it is a signal that something happened outside the system, which is a much more useful thing to learn.',
                'The practical habit that follows is to fix causes rather than outputs. A wrong attendance percentage is a holiday calendar problem. A missing student is an enrolment problem. Chasing the number in the report leaves the cause in place to produce the same wrong number next month.',
            ],
        },
    ],
}


// ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Grounded in `apps/main`: `/staff`, `/staff/leaves`, `/staff/leaves/calendar`,
 * `/staff/documents`, `/staff/documents/[userId]`, `/staff/appraisals`,
 * `/staff/appraisals/[userId]`, plus `/administration/(manage)/invite`. The eight leave types are
 * the real `LeaveType` enum - SICK, CASUAL, EARNED, MATERNITY, PATERNITY, UNPAID, EMERGENCY,
 * OTHER - and leave moves through PENDING, APPROVED, REJECTED, CANCELLED.
 */
const MANAGING_STAFF: Guide = {
    slug: 'managing-staff',
    title: 'Leave, payroll and staff records without the WhatsApp chain',
    summary:
        'What replaces handwritten leave slips and a salary register: digital requests approved from a phone, payslips that read from attendance, and documents that stop living on somebody personal drive.',
    audience: 'Principal',
    time: 'About 45 minutes to set up, then minutes a month',
    before: [
        'Staff invited and holding their own logins',
        'Your leave policy decided - how many days of each type, per role',
        'Salary structures agreed, if you are running payroll here',
    ],
    after: [
        'Leave requested and approved in the app, with balances updating themselves',
        'A leave calendar that shows who is away before you schedule cover',
        'Digital payslips with deductions computed from actual attendance',
        'Staff documents held against the person rather than in a drawer',
    ],
    reviewedOn: '2026-08-21',
    metaTitle: 'Staff Management - Leave, Payroll and Staff Records',
    metaDescription:
        'How to run school HR in Nepal: digital leave approval, the eight leave types, staff attendance, digital payslips, appraisals and document storage.',
    keywords: 'school staff management, teacher leave approval software, school payroll Nepal, staff records school',
    related: [
        { label: 'Staff & HR', href: '/features/staff' },
        { label: 'Roles and access', href: '/guides/roles-and-access' },
    ],
    sections: [
        {
            kind: 'walkthrough',
            eyebrow: 'Set the policy',
            title: 'Decide the rules once',
            body: 'Leave is the part staff notice first, so it is worth having the answer before the first request rather than deciding it under pressure.',
            steps: [
                {
                    title: 'Set annual balances per leave type',
                    body: 'Eight types come configured - sick, casual, earned, maternity, paternity, unpaid, emergency and other. Set how many days of each a role gets; you are adjusting balances, not creating the types.',
                    time: '20 min',
                    outcome: 'Every staff member sees their own balance when they open a request.',
                    art: 'leave',
                },
                {
                    title: 'Decide who approves',
                    body: 'A principal can approve from anywhere, but a school where only one person can approve stalls whenever that person travels. Give a deputy the approval permission so the school does not stop during Dashain.',
                    time: '5 min',
                    outcome: 'More than one person can clear a request.',
                    art: 'invite',
                },
                {
                    title: 'Set up salary structures',
                    body: 'Basic, grade allowance and any recurring components, per staff member. Deductions are computed from leave and attendance rather than entered, which is what makes the monthly run fast.',
                    time: '20 min',
                    outcome: 'A payslip can be generated for anyone on the list.',
                },
            ],
        },
        {
            kind: 'walkthrough',
            eyebrow: 'The monthly loop',
            title: 'What actually happens each month',
            body: 'Almost none of this is data entry. It is approving things other people submitted.',
            steps: [
                {
                    title: 'Staff request, you approve',
                    body: 'A teacher submits dates, a type and a note from their phone. It arrives as Pending; you approve or reject with one tap. The balance updates itself and payroll picks up the deduction - no separate register to annotate.',
                    time: '30 sec per request',
                    outcome: 'The request moves to Approved and their balance drops.',
                    art: 'leave',
                },
                {
                    title: 'Check the leave calendar before scheduling anything',
                    body: 'Approved leave shows on a calendar, so you can see three teachers away on the same Friday before you agree to the third. This is the screen that prevents the cover problem rather than solving it.',
                    time: '1 min',
                    outcome: 'A month view of who is out and when.',
                },
                {
                    title: 'Generate payslips',
                    body: 'Salary, allowances and leave deductions assembled per staff member, with the full history behind each one. Export for your accountant in one action.',
                    time: '10 min for the whole school',
                    outcome: 'A payslip per staff member and a history that stays audit-ready.',
                },
            ],
        },
        {
            kind: 'roles',
            eyebrow: 'The sensitive one',
            title: 'Payroll is the permission to be deliberate about',
            body: 'Most access decisions are about convenience. This one is about the staff room, so it is worth setting explicitly rather than inheriting.',
            roles: [
                { role: 'Salary visibility', can: 'A payslip is visible to the person it belongs to and to whoever holds the payroll permission. Not to other teachers, not to class teachers, and not to anyone holding a general admin role unless you ticked it.' },
                { role: 'Leave approval', can: 'Worth granting to more than one person. A school where only the principal can approve stalls the week they travel, and staff go back to asking in the corridor.' },
                { role: 'Staff documents', can: 'Contracts and citizenship copies are gated separately from the rest of the staff record, so somebody can manage leave without being able to open personal documents.' },
                { role: 'Appraisals', can: 'Usually held by whoever conducts them. Keeping this narrow is what makes staff willing to have the review recorded at all.' },
            ],
        },
        {
            kind: 'walkthrough',
            eyebrow: 'Records',
            title: 'Documents and appraisals',
            body: 'The two things schools keep in a filing cabinet and cannot find when they need them.',
            steps: [
                {
                    title: 'Attach documents to the person',
                    body: 'Contracts, citizenship copies, certificates - held against the staff profile they belong to, reachable only by the roles you grant. They stop living on one person laptop, which is where they are when that person is the one on leave.',
                    time: '2 min each',
                    outcome: 'Any staff document findable in seconds.',
                },
                {
                    title: 'Record appraisals as they happen',
                    body: 'Structured reviews with your own criteria, kept as a history rather than a conversation nobody wrote down. The value is at the second review, when you can see what was said at the first.',
                    outcome: 'An appraisal history per staff member.',
                },
            ],
        },
        {
            kind: 'pitfalls',
            eyebrow: 'Learned the hard way',
            title: 'Where HR setups stall',
            body: 'The first two are about adoption; the last two are about trust.',
            pitfalls: [
                {
                    mistake: 'Only the principal can approve leave',
                    fix: 'Requests pile up the week the principal travels and staff go back to asking in person. Give a deputy the permission on day one.',
                },
                {
                    mistake: 'Accepting leave requests verbally "just this once"',
                    fix: 'A verbal approval never reaches the balance or payroll, so the register and the system diverge from that day. If it is approved, it goes through the app.',
                },
                {
                    mistake: 'Putting salary data in a role more people hold than you think',
                    fix: 'Payroll is the most sensitive permission in the platform. Check who currently holds it before running the first payslip, not after somebody mentions seeing a colleague salary.',
                },
                {
                    mistake: 'Uploading documents without checking who can read them',
                    fix: 'Citizenship copies and contracts are gated by role. Confirm the gate before you upload a hundred of them.',
                },
            ],
        },
        {
            kind: 'prose',
            eyebrow: 'Why it is worth the setup',
            title: 'The register that answers questions',
            paragraphs: [
                'A paper leave register records decisions. It does not answer questions - not "how many casual days does she have left", not "who is out next Tuesday", not "why is this month salary lower than last". Each of those is a person reading back through pages, which is why in practice nobody asks them and balances quietly drift out of accuracy over a year.',
                'The whole gain here is that the same act of approving a request also updates a balance, feeds a calendar and reaches payroll. Nobody does three things; one thing has three consequences. That is also the reason a verbal approval is genuinely costly rather than merely informal - it produces the decision without any of the consequences, and the divergence starts that day.',
                'Set the balances properly at the start and this module needs almost no attention afterwards. It is one of the few parts of the platform where the setup is the work and the monthly running is a few taps.',
            ],
        },
    ],
}


// ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Grounded in `apps/main`: `/ai`, `/saathi` and `/saathi/[conversationId]` (the staff assistant),
 * `/curriculum`, `/curriculum/documents`, `/curriculum/global`, `/curriculum/toc` (the documents
 * the assistant reads), plus `/papers/create` and
 * `/examinations/ai-grading`.
 */
const USING_THE_AI: Guide = {
    slug: 'using-the-ai',
    title: 'Getting useful work out of the AI tools',
    summary:
        'What the AI drafts, what it will not do, and what you have to give it first. Uploading your own documents is the step that separates a useful assistant from a generic chatbot.',
    audience: 'Teacher',
    time: 'About 30 minutes to set up, then seconds per use',
    before: [
        'Your circulars, exam routines and syllabus documents, ready to upload',
        'Subjects and chapters configured, so generated papers can be aligned to them',
        'Marks and attendance being recorded, if you want at-risk detection to have anything to read',
    ],
    after: [
        'Question papers drafted from the chapters you actually covered',
        'An assistant that answers from your school documents and cites which one',
        'Descriptive answers scored against your marking scheme, for a teacher to review',
        'A weekly flag on students whose attendance or marks are slipping',
    ],
    reviewedOn: '2026-08-21',
    metaTitle: 'Using AI in School - Question Papers and Assistant',
    metaDescription:
        'How to use AI in a Nepali school: CDC-aligned question papers, school documents as grounded answers, AI-assisted grading and at-risk student detection.',
    keywords: 'AI question paper generator Nepal, school AI assistant, NEB question paper AI, AI grading school',
    related: [
        { label: 'AI Tools', href: '/features/ai' },
        { label: 'Examinations', href: '/features/examinations' },
    ],
    sections: [
        {
            kind: 'prerequisites',
            eyebrow: 'Before you start',
            title: 'The AI is only as good as what you give it',
            body: 'This is the module where setup makes the largest difference to output quality. An assistant with no documents is a generic chatbot with your logo on it.',
            items: [
                'Your circulars, exam routines, fee structures and calendar uploaded - these are what the assistant answers from',
                'Syllabus or curriculum documents, so generated papers match what you actually teach',
                'Subjects and chapters configured per class',
                'Marks and attendance being recorded, or at-risk detection has nothing to read',
            ],
        },
        {
            kind: 'walkthrough',
            eyebrow: 'The three jobs it does well',
            title: 'What to actually use it for',
            body: 'Each of these replaces drafting, not judgement. The teacher stays the one who decides.',
            steps: [
                {
                    title: 'Draft a question paper',
                    body: 'Pick subject, class, the chapters you covered and a difficulty balance. A full CDC-aligned paper is drafted with a marking scheme in about thirty seconds. Print in-house on the day, so there is no pre-distribution and no leakage window.',
                    time: '30 sec, then 15 min reviewing',
                    outcome: 'A print-ready PDF you then read and adjust.',
                    art: 'ai',
                },
                {
                    title: 'Ask your own documents a question',
                    body: 'Upload circulars and routines, then ask in plain language - English or Nepali. Answers come from your files and cite which one they came from. If the answer is not in your documents it says so rather than inventing one.',
                    time: 'Seconds',
                    outcome: 'An answer with the source document named.',
                    art: 'ai',
                },
                {
                    title: 'Score descriptive answers',
                    body: 'AI reads each answer against your marking scheme, suggests a score and flags what was missed. It is consistent on the hundredth script in a way a tired human is not. Every score is a suggestion until a teacher accepts it.',
                    time: '10 min per class',
                    outcome: 'Suggested scores side by side, awaiting review.',
                    art: 'report',
                },
            ],
        },
        {
            kind: 'roles',
            eyebrow: 'The boundaries',
            title: 'What it will not do, on purpose',
            body: 'Worth knowing before you rely on it, and worth telling your staff so nobody discovers a limit at the wrong moment.',
            roles: [
                { role: 'It does not publish anything', can: 'Every paper, score and comment is a first draft. Nothing reaches a student or parent until a teacher has read it and approved it. The AI writes; the teacher decides.' },
                { role: 'It does not answer from the internet', can: 'Document questions are answered from the files you uploaded, with the source cited. Where your documents do not cover something, it says so instead of guessing.' },
                { role: 'It does not replace your marking scheme', can: 'Grading suggestions are scored against the scheme you provide. Without one, there is nothing for it to be consistent with.' },
                { role: 'Your data stays yours', can: 'At-risk detection reads the attendance, marks and homework already in your account. The weekly flag is visible only to the staff you grant it to.' },
            ],
        },
        {
            kind: 'pitfalls',
            eyebrow: 'Learned the hard way',
            title: 'Why the AI seems unhelpful',
            body: 'Three of the four are setup, not the model.',
            pitfalls: [
                {
                    mistake: 'Asking the assistant questions before uploading anything',
                    fix: 'With no documents it has nothing to ground an answer in, so it correctly tells you it does not know - which reads as broken. Upload your circulars and routines first; that is the step that makes it useful.',
                },
                {
                    mistake: 'Generating a paper for chapters the class has not covered',
                    fix: 'It generates exactly what you select. Selecting the whole syllabus out of habit gives you a paper on material nobody taught.',
                },
                {
                    mistake: 'Accepting grading suggestions without reading them',
                    fix: 'Consistency is not correctness. The AI applies your scheme uniformly, which is valuable precisely because a teacher then checks the handful it read too generously.',
                },
                {
                    mistake: 'Expecting at-risk flags in the first week',
                    fix: 'It reads trends - attendance dropping, marks falling, homework missed. With two weeks of data there is no trend to read. It becomes useful around the second month.',
                },
            ],
        },
        {
            kind: 'prose',
            eyebrow: 'The honest framing',
            title: 'What twelve hours a week actually means',
            paragraphs: [
                'The time saved is not teaching time - it is typing time. Writing a question paper from the syllabus, scoring a hundred descriptive answers, and drafting forty report-card comments are the three jobs that eat a teaching week, and all three are drafting tasks with a judgement step at the end. The AI does the drafting and leaves the judgement, which is the only division of labour that is both useful and safe.',
                'That is also why the review step is not a formality to click through. A paper the subject teacher has not read is the one with a question on a chapter the class skipped; a score accepted unread is the one that was too generous on question four for every student in the class. The value is in the draft arriving in thirty seconds rather than three hours, not in nobody having to look at it.',
                'The single highest-leverage setup step is uploading your own documents. A school that does this gets an assistant that knows when its own second-term exams start and which circular said so. A school that does not gets a general-purpose chatbot, and concludes the feature is not very good - when what is missing is the thing that would have made it specific.',
            ],
        },
    ],
}


// ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Grounded in `apps/main`: `/school-website/settings`, `/school-website/gallery`,
 * `/school-website/admissions`, `/school-website/alumni`, `/school-website/contact`,
 * `/school-website/conversations`. The public API those pages read is documented separately at
 * DOCS_SITE - this guide covers the hosted site only.
 */
const PUBLISHING_THE_WEBSITE: Guide = {
    slug: 'publishing-your-website',
    title: 'A public school website that updates itself',
    summary:
        'Turn it on, keep working inside Gurukul, and the site stays current. What publishes automatically, what you still write, and where the enquiries land.',
    audience: 'Admin',
    time: 'About 90 minutes to launch, then nothing',
    before: [
        'Your school logo, colours, address and contact details set',
        'Staff profiles complete, since the faculty page publishes from them',
        'A few photos for the gallery, if you want one',
        'Your own domain, if you plan to use it - optional at launch',
    ],
    after: [
        'A public website live on your own domain',
        'Notices, events, exam routines and results appearing without being re-entered',
        'Admission enquiries arriving in your Gurukul inbox rather than an email nobody checks',
        'A faculty page that stays correct as staff change',
    ],
    reviewedOn: '2026-08-21',
    metaTitle: 'Publishing Your School Website - Setup Guide',
    metaDescription:
        'How to launch a school website from Gurukul: enabling the site, what publishes automatically, admissions enquiries, alumni, gallery and using your own domain.',
    keywords: 'school website Nepal, school website builder, admission enquiry form school, school notices website',
    related: [
        { label: 'School website', href: '/features/school-website' },
        { label: 'Getting started', href: '/guides/getting-started' },
    ],
    sections: [
        {
            kind: 'walkthrough',
            eyebrow: 'Launch',
            title: 'From off to live',
            body: 'Most of the site is already written - it reads from data you keep anyway. Launching is mostly checking that what it will publish is what you want published.',
            steps: [
                {
                    title: 'Turn the module on and check the basics',
                    body: 'Your school name, logo, colours, address and contact pull straight through from settings. Read them as a stranger would - this is the version the public sees, and an old phone number here is one somebody will actually ring.',
                    time: '10 min',
                    outcome: 'A site preview carrying your branding.',
                    art: 'schoolProfile',
                },
                {
                    title: 'Check what will publish before it does',
                    body: 'Notices, events, holidays, exam routines, published results and your staff directory all flow through automatically. Go and look at each: a draft notice you never meant to publish is easier to fix now than after a parent reads it.',
                    time: '20 min',
                    outcome: 'A clear picture of what is public and what is internal.',
                    art: 'website',
                },
                {
                    title: 'Fill the pages that need writing',
                    body: 'About, academics and admissions are the pages nobody can generate for you. Photos for the gallery are worth twenty minutes - a school site with no pictures of the school reads as unfinished.',
                    time: '45 min',
                    outcome: 'Every page with real content rather than placeholder text.',
                    art: 'notice',
                },
                {
                    title: 'Point your domain, or launch on ours',
                    body: 'You can run on your own domain, or launch on the Gurukul address and move later. Launching first and moving the domain afterwards is fine and often faster than waiting on a domain transfer.',
                    time: '15 min',
                    outcome: 'A live site people can reach.',
                },
            ],
        },
        {
            kind: 'walkthrough',
            eyebrow: 'After launch',
            title: 'Where the site sends things',
            body: 'The site is not a brochure. These three arrive in Gurukul, not in an inbox somebody has to remember to check.',
            steps: [
                {
                    title: 'Admission enquiries',
                    body: 'A prospective parent submits the form and it lands in your admissions inbox inside the platform, where whoever handles admissions already works.',
                    outcome: 'New enquiries visible without leaving Gurukul.',
                },
                {
                    title: 'Contact messages and alumni sign-ups',
                    body: 'Both route the same way. The alumni directory builds itself from the registrations rather than needing a spreadsheet somebody maintains.',
                    outcome: 'One place to follow up from.',
                },
                {
                    title: 'Results lookup by symbol number',
                    body: 'Once results are published, students and parents look them up on the public site by symbol number - no login. This is usually the single most-visited page on a school site in Nepal on results day.',
                    outcome: 'Published results reachable publicly, unpublished ones not.',
                },
            ],
        },
        {
            kind: 'pitfalls',
            eyebrow: 'Learned the hard way',
            title: 'What makes a school site go stale',
            body: 'The first is the reason most school websites are out of date, and this module exists to remove it.',
            pitfalls: [
                {
                    mistake: 'Treating the website as a second place to post things',
                    fix: 'It is not. Post the notice in Gurukul as you always would; the site mirrors it. A team that posts twice will stop posting in one of the two places within a month, and it will be the website.',
                },
                {
                    mistake: 'Launching before checking what publishes automatically',
                    fix: 'Internal notices and staff records go public. Read the preview end to end once - it takes twenty minutes and it is the only chance to be surprised privately.',
                },
                {
                    mistake: 'Incomplete staff profiles on the faculty page',
                    fix: 'The faculty page publishes what is on the profiles. Half-filled profiles look worse in public than they do internally, so complete them before launch rather than after somebody mentions it.',
                },
                {
                    mistake: 'Waiting on a domain transfer to launch',
                    fix: 'Launch on the Gurukul address and move the domain when it is ready. A site nobody can see is not more polished than one on a temporary URL.',
                },
            ],
        },
        {
            kind: 'prose',
            eyebrow: 'The idea',
            title: 'Why most school websites are out of date',
            paragraphs: [
                'Almost every school website in Nepal is a snapshot of the year it was built. Last year notices, an exam routine from a term that has finished, a faculty list with three teachers who left. This is never because nobody cares - it is because updating it is a separate job, done in a separate system, usually by a person who is not the person who knows the information changed.',
                'The only durable fix is to remove the second job entirely. Here the public site reads the same records the platform does, so a notice posted for parents is on the website because it is the same notice, not because somebody copied it across. There is no version to keep in sync because there is only one version.',
                'What that leaves you to write is the part that genuinely is writing: who your school is, what you teach, and why somebody should admit their child. That content changes once a year rather than once a week, which is exactly the shape of work a school can sustain.',
            ],
        },
    ],
}

/**
 * The index, in hub order: setup, then the daily jobs, then the year-end and admin work.
 *
 * Typed as an exhaustive `Record`, so adding a slug to `GUIDE_SLUGS` without writing the guide is
 * a compile error rather than a gap somebody finds in production.
 */
const BY_SLUG: Record<GuideSlug, Guide> = {
    'getting-started': GETTING_STARTED,
    'enrolling-students': ENROLLING_STUDENTS,
    'daily-attendance': DAILY_ATTENDANCE,
    'building-the-timetable': BUILDING_THE_TIMETABLE,
    'collecting-fees': COLLECTING_FEES,
    'running-an-exam': RUNNING_AN_EXAM,
    'reports-and-records': REPORTS_AND_RECORDS,
    'managing-staff': MANAGING_STAFF,
    'using-the-ai': USING_THE_AI,
    'publishing-your-website': PUBLISHING_THE_WEBSITE,
    'roles-and-access': ROLES_AND_ACCESS,
}

/**
 * The key and the guide's own `slug` are two separate declarations, and the type system cannot see
 * that they must agree - `{ 'getting-started': DAILY_ATTENDANCE }` would compile perfectly. This
 * throws at import time instead, so a mismatch surfaces the first time anything touches a guide
 * rather than as a wrong page under a right-looking URL.
 */
export const GUIDES: Guide[] = Object.entries(BY_SLUG).map(([slug, guide]) => {
    if (guide.slug !== slug) {
        throw new Error(`Guide index key "${slug}" holds the guide "${guide.slug}".`)
    }
    return guide
})

/**
 * The guides that appear in the navbar dropdown, in order.
 *
 * Declared HERE rather than as a list of slugs in the navbar, so the nav can never point at a guide
 * that was renamed or removed - `getGuide` resolves them and a bad slug is caught by the filter
 * rather than shipping a dead link. Order is by how often somebody needs it, not alphabetically:
 * setup first, then the daily jobs, then the thing every school asks about before rollout.
 */
export const FEATURED_GUIDE_SLUGS: readonly GuideSlug[] = [
    'getting-started',
    'enrolling-students',
    'daily-attendance',
    'collecting-fees',
    'running-an-exam',
    'roles-and-access',
]

export function featuredGuides(): Guide[] {
    return FEATURED_GUIDE_SLUGS.map((slug) => getGuide(slug)).filter((g): g is Guide => Boolean(g))
}

/**
 * `slug` is a plain string on purpose: callers hand this a URL segment, which is untrusted until
 * it resolves. Narrowing the parameter to `GuideSlug` would just push a cast to every call site.
 */
export function getGuide(slug: string): Guide | undefined {
    return GUIDES.find((g) => g.slug === slug)
}
