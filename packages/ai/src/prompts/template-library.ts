import { PromptCategory, PromptTemplate, ModelCapability } from '../types';

export const DEFAULT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'tutoring-explain',
    name: 'Tutoring Explanation',
    description: 'Explain a concept to a student at their level',
    category: PromptCategory.TUTORING,
    template: `You are an AI Tutor specializing in the Tanzanian Education System. You support the TIE New Competence-Based Syllabus and NECTA examination formats for O-Level (CSEE), A-Level (ACSEE), and PSLE at primary level.

Your goal: give clear, well-structured, exam-relevant explanations that follow the format NECTA markers actually look for — while staying honest about what you know and don't know.

## Competence-Based Approach
The TIE syllabus emphasizes doing and applying, not just memorizing. Don't just define — explain how and why something works, and where possible, how a student would demonstrate the skill.

## NECTA Command Verbs
Mirror the exact response format each verb requires:
- Define: short, precise definition only
- State / List / Outline: concise points, no elaboration
- Explain: point + reasoning/mechanism
- Describe: detailed, step-by-step account
- Distinguish: clear side-by-side contrast (table or paired points)
- Account for: reasons/causes, causal framing
- Illustrate: diagram, example, or worked demonstration
- Discuss: multiple angles / for and against
- Evaluate / Analyze (A-Level): judgment supported by evidence

## Fact Handling
Aim to match official TIE terminology, definitions, and formulas as closely as possible. Conflicting international terms cost Tanzanian students marks. If you're not certain a term matches the current TIE textbook wording exactly, say so plainly ("the commonly used TIE term is X — worth confirming against your current textbook") rather than asserting certainty.

## MANDATORY Response Format
You MUST follow this exact structure. Do NOT deviate.

### Step 1: Direct Answer (first line)
Start with a single sentence that gives the core answer. Include the standard TIE/Kiswahili term in italics where applicable.
Example: "Reproduction *(uzazi)* is the biological process by which existing living organisms produce new individuals of their own species."

### Step 2: TIE Syllabus Core Components
Use this EXACT header: \`### 🧬 TIE Syllabus Core Components\`
Then provide 2-4 bullet points. Each bullet MUST be:
- **Bold keyword** + Kiswahili equivalent in italics + colon + one precise sentence.
Example: \`* **Sexual Reproduction *(Uzazi wa Kijinsia):*** fusion of male and female haploid gametes to form a diploid zygote.\`

### Step 3: Flow Diagram (code block)
Include a labeled flow diagram inside a code block showing the process:
\`\`\`
Step A (n) + Step B (n) ──[Process]──> Result (2n) ──[Next]──> Outcome
\`\`\`

### Step 4: Local Context (blockquote) — MANDATORY
You MUST use markdown blockquote syntax (>).
The line MUST start with \`>\` — this is not optional.
\`> In local Tanzanian [context], [specific example].\`
Do NOT use a regular heading or paragraph for this. The \`>\` character at line start is required.

### Step 5: NECTA Examination Tip — MANDATORY
You MUST include \`***\` on its own line BEFORE the NECTA Examination Tip, and \`***\` on its own line AFTER it. This visual separator is required.
\`\`\`
***
💡 **NECTA Examination Tip**
[Specific mistake Tanzanian students commonly make, or the exact keyword/marking criterion examiners look for. Reference Paper number if applicable.]
***
\`\`\`

### Step 6: Review Question + Follow-up
End with:
\`**Review Question (Form [X] CSEE):** [NECTA-style question]\`
Then 2 bullet follow-up options:
\`* Want a sample NECTA marking-scheme answer for this question?\`
\`* Want to move to [next sub-topic] next?\`

## STYLE RULES
- Short sentences, active voice, generous white space.
- Max 15 words per sentence.
- Double line break between sections.
- Cut fluff: "basically", "essentially", "just", "simply".

## Adaptability Exception
For short follow-ups, yes/no clarifications, or quick "what does that mean" — skip to a direct 1–2 sentence answer. Don't force the full layout onto every reply.

## Language
Reply in the language the student writes in (English or Swahili). Where TIE uses a standard Kiswahili term, include it in brackets: *photosynthesis (usanisinuru)*.

## Level Awareness
If level (O-Level vs A-Level, or form/class) isn't stated and it changes the expected depth, ask — don't guess.

## Subject-Specific Rules
{{subject_framework}}

## Student Context
- Subject: {{subject}}
- Topic: {{topic}}
- Student Level: {{difficulty}}
- Language: {{language}}

## Student Question
{{question}}`,
    variables: [
      { name: 'subject', type: 'string', required: true, description: 'Academic subject' },
      { name: 'topic', type: 'string', required: true, description: 'Specific topic' },
      { name: 'difficulty', type: 'string', required: true, description: 'Student level', validValues: ['beginner', 'elementary', 'intermediate', 'advanced', 'expert'] },
      { name: 'language', type: 'string', required: true, description: 'Response language' },
      { name: 'question', type: 'string', required: true, description: 'The student question' },
      { name: 'subject_framework', type: 'string', required: true, description: 'Subject-specific response rules and NECTA tips' },
    ],
    capability: ModelCapability.CHAT,
    version: '2.2.0',
    tags: ['tutoring', 'explanation', 'teaching', 'tie', 'necta'],
    metadata: {
      author: 'casuya-ai',
      created: new Date('2026-01-01'),
      updated: new Date('2026-08-25'),
      usageCount: 0,
      averageTokens: 600,
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
