/**
 * NECTA/TIE-specific prompt templates for the Casuya AI agent.
 *
 * These templates inject the exact Tanzania national curriculum context
 * into AI prompts so that tutoring, question generation, and assessments
 * align with the official TIE syllabus and NECTA examination formats.
 */

import { PromptCategory, PromptTemplate, ModelCapability } from '../types';

/**
 * Tutoring prompt — NECTA-aligned.
 * Injects the full curriculum context for the subject and form level
 * so the AI explains concepts at the correct level using TIE terminology.
 */
export const NECTA_TUTORING_TEMPLATE: PromptTemplate = {
  id: 'necta-tutoring',
  name: 'NECTA-Aligned Tutoring',
  description: 'Explain concepts following the exact TIE syllabus for Tanzania secondary education',
  category: PromptCategory.TUTORING,
  template: `You are a patient and knowledgeable tutor for Tanzanian secondary school students.

OFFICIAL TIE SYLLABUS CURRICULUM CONTEXT:
{{curriculum_context}}

STUDENT INFORMATION:
- Subject: {{subject}}
- Form Level: {{form_level}}
- NECTA Subject Code: {{necta_code}}
- Topic: {{topic}}
- Current Level: {{difficulty}}
- Language: {{language}}

STUDENT QUESTION:
{{question}}

INSTRUCTIONS:
1. Your explanation MUST align with the TIE syllabus topic and subtopic above.
2. Use the exact terminology from the Tanzania curriculum.
3. Reference the specific learning outcomes listed above — ensure the student understands each relevant outcome.
4. Match the cognitive level of your explanation to the student's level:
   - "knowledge" level: Use simple recall and identification
   - "comprehension" level: Explain and summarize
   - "application" level: Show worked examples relevant to Tanzania
   - "analysis" level: Compare, contrast, and break down
   - "evaluation" level: Judge and assess
   - "synthesis" level: Create and combine
5. Use examples from everyday Tanzanian life when possible.
6. If the student is in Form I-II, explain using Kiswahili-influenced English where helpful.
7. End with practice questions that match NECTA examination format.

Format your response with:
1. A clear explanation aligned to the syllabus
2. A worked example relevant to Tanzanian context
3. Practice questions (mix of MCQ and short answer, like NECTA Section A and B)`,
  variables: [
    { name: 'curriculum_context', type: 'string', required: true, description: 'Full TIE syllabus context from SyllabusAdapter' },
    { name: 'subject', type: 'string', required: true, description: 'Subject name' },
    { name: 'form_level', type: 'number', required: true, description: 'Form level 1-4' },
    { name: 'necta_code', type: 'string', required: false, description: 'NECTA subject code' },
    { name: 'topic', type: 'string', required: true, description: 'Specific topic' },
    { name: 'difficulty', type: 'string', required: true, description: 'Student level' },
    { name: 'language', type: 'string', required: true, description: 'Response language' },
    { name: 'question', type: 'string', required: true, description: 'Student question' },
  ],
  capability: ModelCapability.CHAT,
  version: '1.0.0',
  tags: ['tutoring', 'necta', 'tie', 'tanzania', 'curriculum-aligned'],
  metadata: {
    author: 'casuya-ai',
    created: new Date('2026-08-24'),
    updated: new Date('2026-08-24'),
    usageCount: 0,
    averageTokens: 800,
    successRate: 0.95,
    category: PromptCategory.TUTORING,
  },
};

/**
 * Question generation prompt — NECTA exam format.
 * Generates questions matching NECTA CSEE exam structure:
 * Section A (MCQ), Section B (Short answer), Section C (Essay).
 */
export const NECTA_QUESTION_TEMPLATE: PromptTemplate = {
  id: 'necta-question-generation',
  name: 'NECTA Exam Question Generator',
  description: 'Generate questions matching the NECTA CSEE examination format',
  category: PromptCategory.QUESTION_GENERATION,
  template: `Generate {{count}} examination question(s) for the Tanzania NECTA CSEE format.

OFFICIAL TIE SYLLABUS CURRICULUM:
{{curriculum_context}}

TOPIC: {{topic}} (Subtopic: {{subtopic}})
SUBJECT: {{subject}} (NECTA Code: {{necta_code}})
FORM LEVEL: {{form_level}}
DESIRED SECTION: {{exam_section}}
DIFFICULTY: {{difficulty}}

NECTA CSEE EXAMINATION FORMAT:
- Section A: Multiple choice (A, B, C, D) — tests knowledge and comprehension
- Section B: Short answer / structured questions — tests application and analysis
- Section C: Essay questions — tests evaluation and synthesis

For each question, provide:
1. The question text (clear, unambiguous, matching NECTA style)
2. The NECTA section it belongs to (A, B, or C)
3. The specific learning outcome being tested (from the curriculum above)
4. The Bloom's cognitive level
5. For MCQ: 4 options (A-D) with the correct answer marked
6. For short answer: model answer and marking points
7. For essay: marking rubric with content marks and language marks
8. An explanation of the answer

Also provide a Table of Specifications:
- Topic coverage vs marks allocation
- Cognitive level distribution (knowledge/comprehension/application/analysis/evaluation/synthesis)

Format as JSON.`,
  variables: [
    { name: 'curriculum_context', type: 'string', required: true, description: 'TIE syllabus context' },
    { name: 'subject', type: 'string', required: true },
    { name: 'form_level', type: 'number', required: true },
    { name: 'necta_code', type: 'string', required: false },
    { name: 'topic', type: 'string', required: true },
    { name: 'subtopic', type: 'string', required: false },
    { name: 'difficulty', type: 'string', required: true },
    { name: 'count', type: 'number', required: true },
    { name: 'exam_section', type: 'string', required: false, defaultValue: 'A', validValues: ['A', 'B', 'C', 'mixed'] },
  ],
  capability: ModelCapability.QUESTION_GENERATION,
  version: '1.0.0',
  tags: ['questions', 'necta', 'exam', 'csee', 'tanzania'],
  metadata: {
    author: 'casuya-ai',
    created: new Date('2026-08-24'),
    updated: new Date('2026-08-24'),
    usageCount: 0,
    averageTokens: 600,
    successRate: 0.92,
    category: PromptCategory.QUESTION_GENERATION,
  },
};

/**
 * Kiswahili tutoring prompt for Forms I-II.
 * Used when the student's form level indicates Kiswahili-medium instruction.
 */
export const NECTA_KISWAHILI_TUTORING_TEMPLATE: PromptTemplate = {
  id: 'necta-tutoring-kiswahili',
  name: 'NECTA Kiswahili Medium Tutoring',
  description: 'Tutor in Kiswahili following the TIE syllabus for Forms I-II',
  category: PromptCategory.TUTORING,
  template: `Wewe ni mwalimu mwenye uvumilivu na elimu kwa wanafunzi wa sekondari Tanzania.

MIKUTA YA MAALUM YA TIE (TAARIFA ZA MWALIMU):
{{curriculum_context}}

TAARIFA ZA MWANAFUNZI:
- Somo: {{subject}}
- Kidato: {{form_level}}
- Mada: {{topic}}
- Kiwango: {{difficulty}}

SWALI LA MWANAFUNZI:
{{question}}

MAELEKEZO:
1. Jibu linalingana na mpango wa masomo wa TIE.
2. Tumia istilahi sahihi ya somo kama inavyopatikana katika mwongozo wa TIE.
3. Toa mfano wa maisha ya kila siku Tanzania.
4. Lengo la ubunifu: kuhakikisha mwanafunzi anafikia matokeo ya elimu yaliyoainishwa.
5. Mwishoni, toa maswali ya ziada ya mtihani wa NECTA.
6. Jibu kwa Kiswahili fasaha.`,
  variables: [
    { name: 'curriculum_context', type: 'string', required: true, description: 'TIE syllabus context' },
    { name: 'subject', type: 'string', required: true },
    { name: 'form_level', type: 'number', required: true },
    { name: 'topic', type: 'string', required: true },
    { name: 'difficulty', type: 'string', required: true },
    { name: 'question', type: 'string', required: true },
  ],
  capability: ModelCapability.CHAT,
  version: '1.0.0',
  tags: ['tutoring', 'kiswahili', 'necta', 'tie', 'tanzania', 'forms-i-ii'],
  metadata: {
    author: 'casuya-ai',
    created: new Date('2026-08-24'),
    updated: new Date('2026-08-24'),
    usageCount: 0,
    averageTokens: 700,
    successRate: 0.90,
    category: PromptCategory.TUTORING,
  },
};

export const NECTA_TEMPLATES: PromptTemplate[] = [
  NECTA_TUTORING_TEMPLATE,
  NECTA_QUESTION_TEMPLATE,
  NECTA_KISWAHILI_TUTORING_TEMPLATE,
];
