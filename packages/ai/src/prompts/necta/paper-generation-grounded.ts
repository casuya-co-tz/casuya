import { PromptCategory, PromptTemplate, ModelCapability } from '../../types';

/**
 * Full NECTA-style examination paper generator for Test Generator.
 * Emits structured JSON: sections with mcq_bundle, matching, structured,
 * essay, and practical question types.
 */
export const PAPER_GENERATION_TEMPLATE: PromptTemplate = {
  id: 'paper-generation-grounded',
  name: 'Grounded NECTA Paper Generator',
  description: 'Generate a complete NECTA-style examination paper grounded in KB material',
  category: PromptCategory.QUESTION_GENERATION,
  template: `Generate a complete Tanzanian NECTA-style examination paper as JSON.

EXAM TYPE: {{test_type_label}}
SUBJECT: {{subject}}
PAPER: {{paper_code}} {{paper_title}}
TOTAL MARKS: {{total_marks}}

TOPICS TO COVER (spread questions across ALL):
{{topics_covered}}

SUBTOPICS:
{{subtopics_covered}}

REFERENCE MATERIAL (ground content here; NEVER copy verbatim):
{{reference_context}}

QUESTION SLOTS (exact structure required):
{{question_slots}}

RULES:
- Write fresh questions in your own words; change numbers and contexts.
- Match NECTA command verbs and difficulty for the form level.
- Spread content across ALL listed topics and subtopics.
- Practical papers: blank observation tables only; sample data belongs in marking_scheme only.
- For mcq_bundle use type "mcq_bundle" with items[{number,text,options:{A,B,C,D},answer,marks}].
- For matching use type "matching" with listA, listB, answers (letters).
- For structured/essay use stem + parts[{label,text,marks}].
- For practical use apparatus[], procedure[], tables[{title,columns,rows}], tasks[{label,text,marks}].
- You MUST fill EVERY question slot listed above. Never output an empty object, an empty stem, or empty parts for any slot.

Respond with ONLY JSON:
{ "sections": [{ "id": "A", "questions": [...] }], "marking_scheme": { "sections": [...] } }
Include ALL sections from the preset. Use continuous question numbers.`,
  variables: [
    { name: 'test_type_label', type: 'string', required: true },
    { name: 'subject', type: 'string', required: true },
    { name: 'paper_code', type: 'string', required: true },
    { name: 'paper_title', type: 'string', required: true },
    { name: 'total_marks', type: 'number', required: true },
    { name: 'topics_covered', type: 'string', required: true },
    { name: 'subtopics_covered', type: 'string', required: true },
    { name: 'reference_context', type: 'string', required: true },
    { name: 'question_slots', type: 'string', required: true },
  ],
  capability: ModelCapability.QUESTION_GENERATION,
  version: '1.0.0',
  tags: ['necta', 'exam', 'paper', 'tanzania', 'rag', 'grounded'],
  metadata: {
    author: 'casuya-ai',
    created: new Date('2026-09-21'),
    updated: new Date('2026-09-21'),
    usageCount: 0,
    averageTokens: 2000,
    successRate: 0.9,
    category: PromptCategory.QUESTION_GENERATION,
  },
};
