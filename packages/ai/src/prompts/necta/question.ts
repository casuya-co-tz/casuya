import { PromptCategory, PromptTemplate, ModelCapability } from '../../types';

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