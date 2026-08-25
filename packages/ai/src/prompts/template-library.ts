import { PromptCategory, PromptTemplate, ModelCapability } from '../types';

export const DEFAULT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'tutoring-explain',
    name: 'Tutoring Explanation',
    description: 'Explain a concept to a student at their level',
    category: PromptCategory.TUTORING,
    template: `You are a patient and knowledgeable tutor.

Subject: {{subject}}
Topic: {{topic}}
Student Level: {{difficulty}}
Language: {{language}}

Explain the following concept to the student:

{{question}}

Teaching Guidelines:
- Start with the fundamentals
- Use simple analogies relevant to the student's experience
- Break complex ideas into small steps
- Check for understanding regularly
- Be encouraging and supportive
- Adapt to the student's pace

Format your response with:
1. A clear, simple explanation
2. A concrete example
3. A practice question for the student`,
    variables: [
      { name: 'subject', type: 'string', required: true, description: 'Academic subject' },
      { name: 'topic', type: 'string', required: true, description: 'Specific topic' },
      { name: 'difficulty', type: 'string', required: true, description: 'Student level', validValues: ['beginner', 'elementary', 'intermediate', 'advanced', 'expert'] },
      { name: 'language', type: 'string', required: true, description: 'Response language' },
      { name: 'question', type: 'string', required: true, description: 'The student question' },
    ],
    capability: ModelCapability.CHAT,
    version: '1.0.0',
    tags: ['tutoring', 'explanation', 'teaching'],
    metadata: {
      author: 'casuya-ai',
      created: new Date('2026-01-01'),
      updated: new Date('2026-01-01'),
      usageCount: 0,
      averageTokens: 500,
      successRate: 0.95,
      category: PromptCategory.TUTORING,
    },
  },
  {
    id: 'question-generation-mcq',
    name: 'Multiple Choice Question Generator',
    description: 'Generate multiple choice questions for assessment',
    category: PromptCategory.QUESTION_GENERATION,
    template: `Generate {{count}} multiple-choice question(s) about {{topic}} in {{subject}} at {{difficulty}} level.

Context (if any):
{{context}}

For each question, provide:
1. The question text
2. {{numOptions}} answer options labeled A, B, C, D
3. The correct answer
4. A brief explanation of why it is correct
5. The Bloom's taxonomy level (Recall, Comprehension, Application, Analysis, Evaluation, Creation)

Format as JSON array.`,
    variables: [
      { name: 'subject', type: 'string', required: true },
      { name: 'topic', type: 'string', required: true },
      { name: 'difficulty', type: 'string', required: true },
      { name: 'count', type: 'number', required: true },
      { name: 'numOptions', type: 'number', required: false, defaultValue: 4 },
      { name: 'context', type: 'string', required: false },
    ],
    capability: ModelCapability.QUESTION_GENERATION,
    version: '1.0.0',
    tags: ['questions', 'assessment', 'mcq'],
    metadata: {
      author: 'casuya-ai',
      created: new Date('2026-01-01'),
      updated: new Date('2026-01-01'),
      usageCount: 0,
      averageTokens: 400,
      successRate: 0.92,
      category: PromptCategory.QUESTION_GENERATION,
    },
  },
  {
    id: 'summarization-educational',
    name: 'Educational Summarizer',
    description: 'Summarize educational content for students',
    category: PromptCategory.SUMMARIZATION,
    template: `Summarize the following educational content for a {{difficulty}} level student.

Content:
{{content}}

Requirements:
- Length: {{length}}
- Language: {{language}}
- Focus on key concepts
- Use simple language appropriate for the level
- Include {{numKeyPoints}} key takeaways

Provide the summary and then list the key points separately.`,
    variables: [
      { name: 'content', type: 'string', required: true },
      { name: 'difficulty', type: 'string', required: true },
      { name: 'length', type: 'string', required: true, validValues: ['tiny', 'short', 'medium', 'long'] },
      { name: 'language', type: 'string', required: true },
      { name: 'numKeyPoints', type: 'number', required: false, defaultValue: 3 },
    ],
    capability: ModelCapability.SUMMARIZATION,
    version: '1.0.0',
    tags: ['summarization', 'study'],
    metadata: {
      author: 'casuya-ai',
      created: new Date('2026-01-01'),
      updated: new Date('2026-01-01'),
      usageCount: 0,
      averageTokens: 300,
      successRate: 0.94,
      category: PromptCategory.SUMMARIZATION,
    },
  },
  {
    id: 'translation-educational',
    name: 'Educational Translator',
    description: 'Translate educational content preserving meaning',
    category: PromptCategory.TRANSLATION,
    template: `Translate the following educational content from {{sourceLanguage}} to {{targetLanguage}}.

Domain: {{domain}}
Content:
{{content}}

Requirements:
- Preserve educational meaning and accuracy
- Adapt examples to be culturally appropriate
- Keep technical terms where appropriate, with explanation
- Maintain the original formatting structure

Provide only the translation.`,
    variables: [
      { name: 'content', type: 'string', required: true },
      { name: 'sourceLanguage', type: 'string', required: true },
      { name: 'targetLanguage', type: 'string', required: true },
      { name: 'domain', type: 'string', required: false, defaultValue: 'education' },
    ],
    capability: ModelCapability.TRANSLATION,
    version: '1.0.0',
    tags: ['translation', 'language'],
    metadata: {
      author: 'casuya-ai',
      created: new Date('2026-01-01'),
      updated: new Date('2026-01-01'),
      usageCount: 0,
      averageTokens: 250,
      successRate: 0.90,
      category: PromptCategory.TRANSLATION,
    },
  },
  {
    id: 'moderation-content',
    name: 'Content Moderator',
    description: 'Check educational content for appropriateness',
    category: PromptCategory.MODERATION,
    template: `Review the following content for educational appropriateness:

Content:
{{content}}

Content Type: {{contentType}}
Student Age: {{studentAge}}

Check for:
1. Toxicity or harmful language
2. Inappropriate content for the age group
3. Hate speech or discrimination
4. Violence or self-harm references
5. Spam or promotional content
6. Personal information leakage

Rate each category from 0.0 (safe) to 1.0 (severe) and provide an overall assessment.
Respond with JSON.`,
    variables: [
      { name: 'content', type: 'string', required: true },
      { name: 'contentType', type: 'string', required: true },
      { name: 'studentAge', type: 'number', required: false },
    ],
    capability: ModelCapability.MODERATION,
    version: '1.0.0',
    tags: ['moderation', 'safety'],
    metadata: {
      author: 'casuya-ai',
      created: new Date('2026-01-01'),
      updated: new Date('2026-01-01'),
      usageCount: 0,
      averageTokens: 200,
      successRate: 0.88,
      category: PromptCategory.MODERATION,
    },
  },
];

export function getTemplateById(id: string): PromptTemplate | undefined {
  return DEFAULT_TEMPLATES.find((t) => t.id === id);
}

export function getTemplatesByCategory(category: PromptCategory): PromptTemplate[] {
  return DEFAULT_TEMPLATES.filter((t) => t.category === category);
}

export function getTemplatesByCapability(capability: ModelCapability): PromptTemplate[] {
  return DEFAULT_TEMPLATES.filter((t) => t.capability === capability);
}
