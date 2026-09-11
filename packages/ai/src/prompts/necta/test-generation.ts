import { PromptCategory, PromptTemplate, ModelCapability } from '../../types';

/**
 * Grounded test/exam generator — used by the Test Generator feature.
 *
 * The model generates style-faithful practice questions grounded in genuine
 * NECTA/internal exam papers retrieved from the knowledge base (RAG). It is
 * instructed to ALWAYS write fresh questions in its own words and never copy
 * a question verbatim, and it runs at a low temperature so output stays
 * close to the retrieved material without duplicating it.
 */
export const TEST_GENERATION_TEMPLATE: PromptTemplate = {
  id: 'test-generation-grounded',
  name: 'Grounded Test Generator',
  description: 'Generate exam-style practice questions grounded in the NECTA/TIE knowledge base',
  category: PromptCategory.QUESTION_GENERATION,
  template: `Generate {{count}} multiple-choice examination practice question(s) for the Tanzania school system.

EXAMINATION TYPE: {{test_type_label}}
SUBJECT: {{subject}}
FORM LEVEL: Form {{form_level}}
TOPICS IN THIS TEST:
{{topics_covered}}
SUBTTOPICS IN THIS TEST:
{{subtopics_covered}}
DIFFICULTY: {{difficulty}}
SCOPE: {{scope}}

REFERENCE EXAMINATION MATERIAL (retrieved from the NECTA/TIE knowledge base):
{{reference_context}}

DIRECTIONS:
- Spread the {{count}} questions across ALL the topics (and subtopics) listed above, approximately equally.
- Base every question on a concept found in the reference material, exactly within the SCOPE above.
- DO NOT copy any question from the reference material verbatim. Rewrite each in your own words, and change numbers, names, and contexts.
- Every question must genuinely test the selected SUBJECT at the selected FORM LEVEL and belong to one of the listed topics/subtopics.
- Match the style, wording, and difficulty of NECTA examination questions.
- Ignore any reference material that is outside the SCOPE above.

For each question provide a JSON object with exactly these keys:
1. "text" — the question text
2. "options" — an array of 4 answer options (distractors must be plausible)
3. "correctAnswer" — the letter of the correct option: "A", "B", "C", or "D"
4. "explanation" — a brief explanation of why the answer is correct

Respond with ONLY a JSON array of {{count}} such objects, with no extra text.`,
  variables: [
    { name: 'count', type: 'number', required: true },
    { name: 'test_type_label', type: 'string', required: true },
    { name: 'subject', type: 'string', required: true },
    { name: 'form_level', type: 'number', required: true },
    { name: 'topics_covered', type: 'string', required: true },
    { name: 'subtopics_covered', type: 'string', required: true },
    { name: 'difficulty', type: 'string', required: true },
    { name: 'scope', type: 'string', required: true },
    { name: 'reference_context', type: 'string', required: true },
  ],
  capability: ModelCapability.QUESTION_GENERATION,
  version: '1.0.0',
  tags: ['questions', 'necta', 'exam', 'test', 'tanzania', 'rag', 'grounded'],
  metadata: {
    author: 'casuya-ai',
    created: new Date('2026-09-11'),
    updated: new Date('2026-09-11'),
    usageCount: 0,
    averageTokens: 800,
    successRate: 0.9,
    category: PromptCategory.QUESTION_GENERATION,
  },
};