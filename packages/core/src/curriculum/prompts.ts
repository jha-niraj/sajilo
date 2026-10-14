// Shared LLM prompts for TOC parsing / generation. The apps own the actual model
// call (each has its own OpenAI client + usage logging); only the prompt text and
// limits live here so admin and school flows stay identical.

export const TOC_AI_SYSTEM_PROMPT = `You convert a pasted textbook / curriculum Table of Contents into clean structured JSON.

Return ONLY a JSON object of this exact shape (no commentary):
{"units":[{"unitNumber":"1","title":"FORCE & MOTION","startPage":1,"endPage":28,"lessons":[{"lessonNumber":"1.1","title":"What is Force?","startPage":2,"endPage":8}]}]}

Rules:
- A UNIT (a.k.a. Chapter / Lesson / Section heading) may appear in ANY format: "Unit - 1 : FORCE & MOTION", "UNIT II : WORK", "Unit 3  LIGHT", "UNIT-IV ...", "UNIT No. 6 ...", "UNIT VII ...", "5. ELECTRICITY", or a heading split across two lines. Treat each as one unit.
- unitNumber: the unit's own number as an Arabic numeral STRING ("1","2","3"...). Convert roman numerals (II -> "2", IV -> "4", VII -> "7"). If a unit truly has no number, use its sequential position.
- title: the FULL unit title with original wording and casing, e.g. "FORCE & MOTION". Never merge the number into the title (no "5.ELECTRICITY" - that is unitNumber "5", title "ELECTRICITY").
- startPage / endPage: the unit's page range as integers. Parse EVERY style: "Pg. 1 - 28", "(Pages 29-56)", "Page No. 57 to 96", "(97-126)", "Pg : 127 - 172", "(Page 173 - 208)", "209-234", trailing dotted leaders "....... 235-260". If a unit shows only a single start page, set endPage to null. If no page is shown, set both to null.
- lessons: the sub-topics under a unit. They may be numbered ("1.1 What is Force?"), or unnumbered prose lines ("Solved Exercise", "Numericals", "Exercise", "Summary"). Include ALL of them in order.
  - lessonNumber: the printed number ("1.1") as a string, or "" if the lesson is unnumbered.
  - title: the lesson title, with the trailing page number / dotted leaders removed.
  - startPage: the page the lesson starts on (the number printed at the end of the line, after the dotted leaders), as an integer, or null if none.
  - endPage: usually (next lesson's startPage - 1) within the same unit, capped at the unit's endPage; null if it cannot be inferred.
- Preserve the original ORDER of units and lessons. Do not invent units or lessons that are not in the text. Do not drop any.
- Output strictly valid JSON. No trailing commas, no markdown fences.`;

export const TOC_AI_GENERATE_SYSTEM_PROMPT = `You are an expert on national school curricula. Given a country, a subject and a class/grade, produce the STANDARD table of contents (units and the lessons inside each) that a typical school in that country teaches for that subject and grade.

Return ONLY a JSON object of this exact shape (no commentary):
{"units":[{"unitNumber":"1","title":"FORCE & MOTION","startPage":null,"endPage":null,"lessons":[{"lessonNumber":"1.1","title":"What is Force?","startPage":null,"endPage":null}]}]}

Rules:
- For Nepal use the NEB / CDC (Curriculum Development Centre) syllabus; for India use the relevant national board (default CBSE) unless told otherwise.
- unitNumber and lessonNumber are Arabic-numeral strings ("1", "1.1"). Give 5-12 units typical for the grade, each with 2-8 lessons.
- titles use clear, conventional chapter/lesson names for that subject and grade. Keep them realistic - do not invent fanciful topics.
- Set startPage and endPage to null (a generated TOC has no real page numbers). The school can fill pages later.
- Preserve a sensible teaching order. Output strictly valid JSON, no markdown fences.`;

/** ~10MB image encoded as a base64 data URL. */
export const MAX_TOC_IMAGE_CHARS = 14_000_000;
