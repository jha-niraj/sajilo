/**
 * Statutory student-return formats, one per country.
 *
 * ## Why this is a catalogue and not an `if (country === 'NP')`
 *
 * Every country a school operates in has its own government student return, and they are not
 * variations of one another - they ask for different identifiers, different social categories and
 * different disability taxonomies. Nepal's IEMIS wants ethnicity group and citizenship number;
 * India's UDISE+ wants Aadhaar, APAAR ID and SC/ST/OBC/General/EWS. Encoding that as branches
 * inside the export builder is how you end up shipping Nepali ethnicity categories to an Indian
 * district officer.
 *
 * So: one entry per country, listing the columns that country's return actually asks for. The
 * export builder walks the entry; it never knows a country name.
 *
 * This module is deliberately PURE data - no database, no I/O - because `@repo/core` has no
 * dependencies and both `apps/main` (to draw the field picker) and `apps/services` (to build the
 * workbook) import it. One catalogue means the checkbox list and the spreadsheet columns cannot
 * disagree, which they would within a release if each side kept its own list.
 *
 * ## `source: 'school'` is the important part
 *
 * A column we do not store is still a column the return requires. Aadhaar, APAAR ID and social
 * category have no home in our schema, and inventing one by mapping (say) Nepali `caste` onto
 * Indian `Category` would put wrong data in a statutory filing - worse than no data at all.
 *
 * Those columns are emitted with the correct heading and left EMPTY for the school to complete
 * before upload. The UI says so plainly. An empty cell in a sheet a human is about to fill in is
 * honest; a guessed one is not.
 */

export type StatutoryFormatId = 'IEMIS' | 'UDISE';

export interface StatutoryField {
    /** Matches a key the export builder knows how to read off a student row. */
    key: string;
    /** The column heading in the generated workbook. */
    label: string;
    /**
     * `db` - we hold this and will fill it.
     * `school` - the return requires it, we do not store it, so the column ships empty.
     */
    source: 'db' | 'school';
    /** Shown under the checkbox when the column needs explanation. */
    hint?: string;
}

export interface StatutoryFormat {
    id: StatutoryFormatId;
    /** What the school calls it. Used in headings, buttons and filenames. */
    label: string;
    /** The authority that consumes the return. */
    authority: string;
    /** One line under the sheet title. */
    description: string;
    /** Filename stem, e.g. `iemis-export-<school>-<date>.xlsx`. */
    filePrefix: string;
    /** Columns beyond the common roster fields. */
    fields: StatutoryField[];
}

/** Columns every country's return wants, under whatever name - emitted for all formats. */
export const COMMON_STUDENT_FIELDS: StatutoryField[] = [
    { key: 'studentId', label: 'Student ID', source: 'db' },
    { key: 'admissionNumber', label: 'Admission No.', source: 'db' },
    { key: 'firstName', label: 'First Name', source: 'db' },
    { key: 'lastName', label: 'Last Name', source: 'db' },
    { key: 'gender', label: 'Gender', source: 'db' },
    { key: 'dateOfBirth', label: 'Date of Birth', source: 'db' },
    { key: 'class', label: 'Class', source: 'db' },
    { key: 'section', label: 'Section', source: 'db' },
    { key: 'rollNumber', label: 'Roll Number', source: 'db' },
    { key: 'academicYear', label: 'Academic Year', source: 'db' },
    { key: 'fatherName', label: "Father's Name", source: 'db' },
    { key: 'motherName', label: "Mother's Name", source: 'db' },
    { key: 'address', label: 'Current/Temporary Address', source: 'db' },
    { key: 'permanentAddress', label: 'Permanent Address', source: 'db' },
    { key: 'motherTongue', label: 'Mother Tongue', source: 'db' },
    { key: 'admissionDate', label: 'Admission Date', source: 'db' },
];

const IEMIS: StatutoryFormat = {
    id: 'IEMIS',
    label: 'IEMIS',
    authority: 'Ministry of Education / CEHRD, Nepal',
    description: 'The Nepal government student return. Columns match the IEMIS disaggregation requirements - gender, caste and ethnicity, disability and scholarship.',
    filePrefix: 'iemis-export',
    fields: [
        { key: 'ethnicityGroup', label: 'Ethnicity Group', source: 'db', hint: 'Brahmin-Chhetri, Janajati, Dalit, Madhesi, Muslim, Tharu or Other' },
        { key: 'caste', label: 'Caste / Sub-group', source: 'db' },
        { key: 'religion', label: 'Religion', source: 'db' },
        { key: 'nationality', label: 'Nationality', source: 'db' },
        { key: 'disabilityType', label: 'Disability Type', source: 'db', hint: 'Nepal MoE disability categories' },
        { key: 'scholarshipType', label: 'Scholarship Type', source: 'db' },
        { key: 'citizenshipNo', label: 'Citizenship No.', source: 'db' },
        { key: 'birthCertificateNo', label: 'Birth Certificate No.', source: 'db' },
        { key: 'specialNeeds', label: 'Special Needs', source: 'db' },
        { key: 'boardExamRollNumber', label: 'Board Exam Roll No.', source: 'db' },
        { key: 'boardRegistrationNumber', label: 'Board Registration No.', source: 'db' },
    ],
};

/**
 * India's UDISE+ Student Data Management System return.
 *
 * Aadhaar, APAAR ID, social category and the CWSN severity/certificate columns are `source:
 * 'school'` - the return demands them and we do not hold them. In particular **`caste` is NOT
 * mapped onto `Category`**: UDISE+ wants SC/ST/OBC/General/EWS as certified, which is a legal
 * classification, not the free-text caste field a Nepali school fills in.
 */
const UDISE: StatutoryFormat = {
    id: 'UDISE',
    label: 'UDISE+',
    authority: 'Ministry of Education, Government of India',
    description: 'The India government student return (UDISE+ SDMS). Columns the school must complete are included empty - we never guess a statutory classification.',
    filePrefix: 'udise-export',
    fields: [
        { key: 'aadhaarNumber', label: 'Aadhaar Number', source: 'school', hint: 'Enter 999999999999 where a student has none' },
        { key: 'apaarId', label: 'APAAR ID', source: 'school', hint: 'Required for Classes 1-12 under NEP 2020' },
        { key: 'socialCategory', label: 'Category', source: 'school', hint: 'SC / ST / OBC / General / EWS, as per caste certificate' },
        { key: 'minorityGroup', label: 'Minority Group', source: 'school' },
        { key: 'religion', label: 'Religion', source: 'db' },
        { key: 'disabilityType', label: 'Type of Disability (CWSN)', source: 'db', hint: 'Blank for a student who is not CWSN' },
        { key: 'disabilitySeverity', label: 'Disability Severity', source: 'school', hint: 'Mild / Moderate / Severe' },
        { key: 'disabilityCertificate', label: 'Disability Certificate No.', source: 'school' },
        { key: 'bplStatus', label: 'BPL', source: 'school' },
        { key: 'firstGenerationLearner', label: 'First Generation Learner', source: 'school' },
        { key: 'specialNeeds', label: 'Special Needs', source: 'db' },
    ],
};

const BY_COUNTRY: Record<string, StatutoryFormat> = {
    NP: IEMIS,
    IN: UDISE,
};

/**
 * The statutory format for a school's country.
 *
 * `schools.country` is an ISO code and defaults to 'NP'. An unrecognised code falls back to IEMIS
 * rather than throwing, because a school with a bad country code still needs to export - but the
 * caller should surface which format it got so the user is never guessing.
 */
export function statutoryFormatForCountry(country: string | null | undefined): StatutoryFormat {
    return BY_COUNTRY[(country ?? 'NP').toUpperCase()] ?? IEMIS;
}

/** Every column in a format, common fields first, in workbook order. */
export function statutoryColumns(format: StatutoryFormat): StatutoryField[] {
    return [...COMMON_STUDENT_FIELDS, ...format.fields];
}

/** True when the format asks for anything the school has to fill in by hand. */
export function hasSchoolSuppliedFields(format: StatutoryFormat): boolean {
    return format.fields.some((f) => f.source === 'school');
}

export const STATUTORY_FORMATS = [IEMIS, UDISE] as const;
