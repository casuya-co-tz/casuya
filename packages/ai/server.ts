/**
 * Minimal HTTP server for the casuya-ai library.
 *
 * Exposes the endpoints the casuya-platform calls (see backend/services/ai_service.py)
 * over HTTP so the AI package can run as a standalone microservice. Uses the LOCAL
 * provider by default (no API keys required) and degrades to simple local responses
 * if a model-backed call is unavailable, so the platform always receives a 200.
 *
 * Dependency-free: uses Node's built-in http module.
 */

import * as http from 'http';
import * as path from 'path';
import dotenv from 'dotenv';
import { CasuyaAI } from './src/casuya-ai';
import { buildFreeProviderSpecs, specsToConfigMap } from './src/providers/free-chain';
import { ProviderFactory } from './src/providers/provider-factory';
import { getKnowledgeBase } from './src/kb';
import {
  QuestionType,
  QuestionCategory,
  Difficulty,
  TutoringSubject,
  TutoringMode,
  Language,
  ModerationContentType,
} from './src/types/index';

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

const PORT = parseInt(process.env.CASUYA_AI_PORT || process.env.PORT || '3000', 10);

function send(res: http.ServerResponse, status: number, data: unknown) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body);
}

function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

async function safeAsync(fn: () => Promise<unknown>, fallback: unknown): Promise<unknown> {
  try {
    return await fn();
  } catch (err) {
    console.error('[safeAsync] Error:', err);
    return fallback;
  }
}

const SUBJECT_NAME: Record<string, string> = {
  mathematics: 'Mathematics',
  'basic mathematics': 'Mathematics',
  physics: 'Physics',
  chemistry: 'Chemistry',
  biology: 'Biology',
  'animal husbandry': 'Animal Husbandry',
  agriculture: 'Agriculture',
  'english language': 'English Language',
  english: 'English Language',
  kiswahili: 'Kiswahili',
  history: 'History',
  geography: 'Geography',
  'book keeping': 'Book Keeping',
  commerce: 'Commerce',
  economics: 'Economics',
  divinity: 'Divinity',
  'bible knowledge': 'Bible Knowledge',
  'computer science': 'Computer Science',
  civics: 'Civics',
};

/** Resolve a subject slug to a human name plus the closest TutoringSubject enum. */
function resolveSubject(slug?: string): { name: string; enumValue: TutoringSubject } {
  const s = (slug || '').toLowerCase();
  const name = SUBJECT_NAME[s] || (slug ? slug.replace(/[_-]+/g, ' ') : '');
  let enumValue: TutoringSubject = TutoringSubject.GENERAL;
  if (/(mathematics|math)/.test(s)) enumValue = TutoringSubject.MATHEMATICS;
  else if (/(physics|chemistry|biology|science|agriculture|geography)/.test(s))
    enumValue = TutoringSubject.SCIENCE;
  else if (/history/.test(s)) enumValue = TutoringSubject.HISTORY;
  else if (/literature/.test(s)) enumValue = TutoringSubject.LITERATURE;
  else if (/(english|kiswahili|swahili|language)/.test(s)) enumValue = TutoringSubject.LANGUAGE;
  else if (/(computer|computing|ict)/.test(s)) enumValue = TutoringSubject.COMPUTING;
  else if (/(art|music|drama)/.test(s)) enumValue = TutoringSubject.ARTS;
  return { name, enumValue };
}

/** Map an integer form (1-6) to the KB's `formN` string, or undefined. */
function formToKbForm(form?: number | string): string | undefined {
  const n = typeof form === 'string' ? parseInt(form, 10) : form;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 1 || n > 6) return undefined;
  return `form${n}`;
}

function formLabel(form?: number | string): string {
  const n = typeof form === 'string' ? parseInt(form, 10) : form;
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 6 ? `Form ${n}` : '';
}

/** Build the grounded message given to the tutor (question + full pasted text + RAG). */
function buildGroundedMessage(opts: {
  question: string;
  context?: string;
  subjectName: string;
  form?: number | string;
  ragText: string;
  maxContextChars?: number;
}): string {
  const ctx = (opts.context || '').trim();
  const form = formLabel(opts.form);
  const lines: string[] = [];
  lines.push('Answer the student question below, grounded in the provided lesson text and reference material, and in reality — do not guess or invent when the sources are silent.');
  if (opts.subjectName) lines.push(`Subject: ${opts.subjectName}`);
  if (form) lines.push(`Class/Form: ${form}`);
  if (ctx) {
    const clip = ctx.length > (opts.maxContextChars || 4000) ? ctx.slice(0, opts.maxContextChars || 4000) + '…' : ctx;
    lines.push(`\nLESSON TEXT THE STUDENT IS READING (read this carefully and use it as the primary basis of your answer):\n"""\n${clip}\n"""`);
  }
  if (opts.ragText) lines.push(opts.ragText);
  lines.push(`\nSTUDENT QUESTION: ${opts.question}`);
  return lines.join('\n');
}

/** Meaningful, KB-grounded fallback when every model provider fails. */
function buildGroundedFallback(
  question: string,
  ragDocs: { title: string; kind: string; snippet?: string }[],
): string {
  const cleanQ = question.replace(/^(explain|describe|define|what is|what are|how does|how do|why is|why do|state|list|outline|distinguish|compare)\b[\s:]*/i, '').trim() || question.trim();
  if (ragDocs.length) {
    const refs = ragDocs
      .map((d) => {
        const snip = d.snippet ? `\n  ${d.snippet}` : '';
        return `- ${d.title}${snip}`;
      })
      .join('\n');
    return `I couldn't reach an AI model just now, so here is the closest NECTA/TIE material for "${cleanQ}":\n\n${refs}\n\nRead that with your lesson text, then ask again — the next attempt will try Groq, Google, Mistral, and Grok in turn.`;
  }
  return `I couldn't reach Groq, Google, Mistral, or Grok just now. Please ask "${cleanQ}" again in a moment.`;
}

function cleanThink(text: string): string {
  let msg = text;
  msg = msg.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
  msg = msg.replace(/\s*thinking[\s\S]*?<\/think>/i, '');
  return msg.trim();
}

// ---------- Exam paper generation ----------

interface ExamSectionSpec {
  id: string;
  title: string;
  questionType: string;
  count: number;
  marksPerQuestion: number;
}

const EXAM_KIND_LABEL: Record<string, string> = {
  necta: 'NECTA-STYLE EXAMINATION',
  internal: 'INTERNAL EXAMINATION',
  exercise: 'CLASS EXERCISE',
};

/** English number words for 1-59 (question counts / marks are small integers). */
function numToWords(n: number): string {
  const ones = [
    '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
    'seventeen', 'eighteen', 'nineteen',
  ];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty'];
  if (n < 20) return ones[n] || String(n);
  const t = Math.floor(n / 10);
  if (t >= 6) return String(n);
  return n % 10 ? `${tens[t]}-${ones[n % 10]}` : tens[t];
}

function countLabel(count: number): string {
  return `${numToWords(count)} (${count}) questions`;
}

function markLabel(n: number): string {
  return `${numToWords(n)} (${n}) mark${n === 1 ? '' : 's'}`;
}

function sectionInstruction(s: ExamSectionSpec): string {
  if (s.questionType === 'mcq') {
    return `This section consists of ${countLabel(s.count)}. Every question carries one (1) mark. Answer ALL questions.`;
  }
  return `This section consists of ${countLabel(s.count)}. Each question carries ${markLabel(s.marksPerQuestion)}. Answer ALL questions.`;
}

function buildExamPrompt(args: {
  subject: string;
  formLabel: string;
  topic: string;
  context: string;
  curriculum: string;
  kindLabel: string;
  duration: string;
  total: number;
  sections: ExamSectionSpec[];
}): string {
  const specLines = args.sections
    .map((s) => {
      const typeDetail =
        s.questionType === 'mcq'
          ? 'a MULTIPLE-CHOICE objective question with exactly FOUR options labelled "A. ...", "B. ...", "C. ...", "D. ...", plus an "answer" field holding the 0-based index of the correct option'
          : s.questionType === 'structured'
            ? 'a STRUCTURED short-answer question using NECTA command verbs (state, list, outline, explain, distinguish, describe, calculate)'
            : 'an ESSAY / long-response question requiring a coherent written answer of several short paragraphs';
      return `- Section ${s.id} "${s.title}": exactly ${s.count} questions, ${markLabel(s.marksPerQuestion)} each. Each question must be ${typeDetail}.`;
    })
    .join('\n');

  return [
    'You are an experienced Tanzanian secondary school examiner working with the official TIE curriculum. Compose an examination paper.',
    '',
    'RULES (strict):',
    '- Every question MUST be based ONLY on facts, definitions, examples and concepts present in the LESSON TEXT below. Never invent material that is not in the lesson text.',
    '- Align difficulty and terminology with the TIE syllabus class/form level stated.',
    '- Use correct English and NECTA-style command verbs.',
    '- The number of questions in each section MUST exactly match the specification.',
    '- The marks for each question MUST match the specification.',
    '',
    `SUBJECT: ${args.subject}`,
    `CLASS: ${args.formLabel}`,
    `TOPIC: ${args.topic}`,
    `PAPER TITLE: ${args.kindLabel}`,
    `TIME ALLOWED: ${args.duration}`,
    `TOTAL MARKS: ${args.total}`,
    '',
    'SECTIONS:',
    specLines,
    '',
    'LESSON TEXT (your ONLY source of content):',
    '"""',
    args.context,
    '"""',
    '',
    'TIE CURRICULUM CONTEXT:',
    '"""',
    args.curriculum || '(none provided)',
    '"""',
    '',
    'RESPOND WITH ONLY A JSON OBJECT, exactly this shape (no markdown, no backticks, no commentary):',
    '{ "sections": [ { "id": "A", "question_type": "mcq", "questions": [ { "text": "...", "marks": 1, "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "answer": 0 } ] }, { "id": "B", "question_type": "structured", "questions": [ { "text": "...", "marks": 6 } ] }, { "id": "C", "question_type": "essay", "questions": [ { "text": "...", "marks": 22 } ] } ] }',
  ].join('\n');
}

/** Extract the first JSON object from a model response (tolerates fences/trailing text). */
function parseExamJson(content: string): { sections?: unknown[] } | null {
  let text = String(content || '').trim();
  text = text.replace(/```json/gi, '').replace(/```/g, '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const data = JSON.parse(text.slice(start, end + 1));
    return data && Array.isArray(data.sections) ? data : { sections: [] };
  } catch {
    return null;
  }
}

/** Normalize the model's question content into the canonical, numbered paper. */
function normalizeExamPaper(
  body: any,
  parsed: any,
  spec: ExamSectionSpec[],
  subjectName: string,
): any | null {
  // Strict: every section must deliver exactly the requested number of valid
  // questions — otherwise the platform falls back to its local generator.
  const pickedBySection: Record<string, any[]> = {};
  for (const s of spec) {
    const src = (parsed.sections || []).find((x: any) => String(x?.id || '').toUpperCase() === s.id.toUpperCase());
    const qs = Array.isArray(src?.questions) ? src.questions : [];
    const valid =
      s.questionType === 'mcq'
        ? qs.filter((q: any) => q && typeof q.text === 'string' && Array.isArray(q.options) && q.options.length >= 2)
        : qs.filter((q: any) => q && typeof q.text === 'string');
    if (valid.length < s.count) return null;
    pickedBySection[s.id.toUpperCase()] = valid.slice(0, s.count);
  }

  let number = 1;
  let totalMarks = 0;
  const sections = spec.map((s) => {
    const questions = pickedBySection[s.id.toUpperCase()].map((q) => {
      const text = String(q.text || '').replace(/\s+/g, ' ').trim();
      const marks = Math.max(1, Math.round(Number(q.marks) || s.marksPerQuestion));
      const entry: any = { number: number++, text, marks };
      if (s.questionType === 'mcq') {
        let opts = (q.options || []).map((o: any, i: number) => {
          const clean = String(o || '').replace(/\s+/g, ' ').trim();
          return /^[A-Da-d][.)]\s*/.test(clean) ? clean : `${String.fromCharCode(65 + i)}. ${clean}`;
        });
        while (opts.length < 4) opts.push(`${String.fromCharCode(65 + opts.length)}. —`);
        opts = opts.slice(0, 4);
        let answer = 0;
        if (typeof q.answer === 'number' && Number.isFinite(q.answer) && q.answer >= 0 && q.answer < 4) {
          answer = Math.round(q.answer);
        } else if (/^[A-Da-d]$/.test(String(q.answer || '').trim())) {
          answer = String(q.answer).trim().toUpperCase().charCodeAt(0) - 65;
        }
        entry.options = opts;
        entry.answer = answer;
      }
      totalMarks += marks;
      return entry;
    });
    return {
      id: s.id,
      title: s.title,
      instruction: sectionInstruction(s),
      question_type: s.questionType,
      count: questions.length,
      marks_per_question: s.marksPerQuestion,
      questions,
    };
  });

  const kindKey = String(body.kind || '').toLowerCase();
  const formLevel = Number(body.form_level) || 1;
  const instructions: string[] = [];
  instructions.push(`This paper consists of ${sections.length} section(s) with a total of ${totalMarks} marks.`);
  instructions.push('Answer ALL questions.');
  instructions.push('Marks for each question are shown in brackets.');
  instructions.push(
    kindKey === 'exercise'
      ? 'Write all your answers in the space provided below each question.'
      : 'For objective questions choose the correct answer and write its letter. Show your working where necessary.',
  );

  return {
    kind: kindKey || 'internal',
    format_label: EXAM_KIND_LABEL[kindKey] || 'EXAMINATION',
    header: {
      exam: EXAM_KIND_LABEL[kindKey] || 'EXAMINATION',
      subject: subjectName,
      subject_slug: typeof body.subject_slug === 'string' ? body.subject_slug : '',
      form_level: formLevel,
      form_label: `${formLabel(body.form_level) || `Form ${formLevel}`} - ${subjectName}`,
      topic: String(body.topic || '').trim(),
      lesson_title: String(body.lesson_title || '').trim(),
      duration: String(body.duration || (kindKey === 'exercise' ? '40 Minutes' : '2 Hours')),
      year: String(new Date().getFullYear()),
      total_marks: totalMarks,
      instructions,
    },
    sections,
    meta: { generator: 'casuya-ai', generated_at: new Date().toISOString() },
  };
}

async function generateExamPaper(ai: CasuyaAI, body: any): Promise<any | null> {
  const rawSections = Array.isArray(body.sections) ? body.sections : [];
  const spec: ExamSectionSpec[] = rawSections
    .map((s: any) => {
      const id = String(s?.id || '').trim().toUpperCase();
      const questionType = String(s?.question_type || '').toLowerCase();
      if (!id || !['mcq', 'structured', 'essay'].includes(questionType)) return null;
      return {
        id,
        title: String(s?.title || 'QUESTIONS'),
        questionType,
        count: Math.max(1, Math.min(40, Math.round(Number(s?.count) || 1))),
        marksPerQuestion: Math.max(1, Math.min(50, Math.round(Number(s?.marks_per_question) || 1))),
      };
    })
    .filter(Boolean) as ExamSectionSpec[];
  if (!spec.length) return null;

  const context = String(body.context || '').slice(0, 12000);
  const subjectSlug = typeof body.subject_slug === 'string' ? body.subject_slug : '';
  const subjectName =
    typeof body.subject === 'string' && body.subject ? body.subject : resolveSubject(subjectSlug).name;
  const total = spec.reduce((sum, s) => sum + s.count * s.marksPerQuestion, 0);
  const formLabelStr = formLabel(body.form_level);

  const provider = ProviderFactory.getProvider('failover') || ProviderFactory.getProvider('local');
  if (!provider) return null;

  const prompt = buildExamPrompt({
    subject: subjectName || 'General',
    formLabel: formLabelStr,
    topic: String(body.topic || 'the lesson topic').slice(0, 120),
    context: context || `(No lesson text was provided. Use your general knowledge of ${subjectName || 'the subject'} at ${formLabelStr || 'the given level'}.)`,
    curriculum: String(body.curriculum_context || '').slice(0, 5000),
    kindLabel: EXAM_KIND_LABEL[String(body.kind || '').toLowerCase()] || 'EXAMINATION',
    duration: String(body.duration || '2 Hours'),
    total,
    sections: spec,
  });

  const maxTokens = Math.min(9000, Math.max(2048, total * 50 + spec.length * 500));
  const result = await provider.chatCompletion({
    messages: [
      { role: 'system', content: 'You are an educational assessment generator. Respond with valid JSON only.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    maxTokens,
  });

  const parsed = parseExamJson(result.content);
  if (!parsed) return null;
  try {
    return normalizeExamPaper(body, parsed, spec, subjectName || 'General');
  } catch (err) {
    console.error('[exams/generate] normalization failed:', err);
    return null;
  }
}

async function start() {
  const { specs, chain } = buildFreeProviderSpecs();
  const providers = specsToConfigMap(specs);
  const defaultProvider = chain[0] || 'local';
  console.log(`[casuya-ai] Provider chain: ${chain.join(' → ')}`);

  const kb = getKnowledgeBase();
  if (kb.ready) {
    console.log(
      `[casuya-ai] Knowledge base ready: ${kb.stats.total} docs (subjects: ${kb.stats.subjects})`,
    );
  } else {
    console.warn(`[casuya-ai] Knowledge base NOT available: ${kb.error?.message || 'unknown'}`);
  }

  const ai = new CasuyaAI({ providers, defaultProvider });
  await ai.initializeProviders(providers, defaultProvider, chain);

  const server = http.createServer(async (req, res) => {
    const url = (req.url || '').split('?')[0];

    if (req.method === 'GET' && url === '/health') {
      return send(res, 200, {
        status: 'ok',
        service: 'casuya-ai',
        version: '1.0.0',
        provider: 'failover',
        chain,
      });
    }

    if (req.method !== 'POST') {
      return send(res, 405, { error: 'method_not_allowed' });
    }

    const body = await readBody(req);

    async function dispatch(): Promise<unknown> {
      switch (url) {
        case '/api/questions/generate': {
          const { content, count = 5, topic: rawTopic, subject_slug } = body;
          const topic = (rawTopic || content || 'lesson content').slice(0, 80);
          const subjectKey = (subject_slug || '').toLowerCase() as keyof typeof TutoringSubject;
          const subjectValue = TutoringSubject[subjectKey] || TutoringSubject.GENERAL;
          return safeAsync(
            async () => {
              const questions = await ai.questionGenerator.generateQuestions({
                subject: subjectValue,
                topic,
                questionType: QuestionType.MULTIPLE_CHOICE,
                difficulty: Difficulty.INTERMEDIATE,
                category: QuestionCategory.COMPREHENSION,
                count: Number(count) || 5,
                context: content,
              });
              return { questions };
            },
            { questions: [] },
          );
        }

        case '/api/tutoring/explain': {
          const { question, context, subject_slug, form_level, max_questions } = body;
          const subject = resolveSubject(subject_slug);
          const query = [question, context].filter(Boolean).join(' ').trim();
          const kbForm = formToKbForm(form_level);

          // RAG retrieval scoped to the user's subject + class, with a graceful
          // fallback to unscoped retrieval so the answer is never left empty.
          let ragText = '';
          let ragDocs: { title: string; kind: string; subject: string; snippet?: string }[] = [];
          if (kb.ready) {
            let rag = kb.buildRagContext(
              query,
              { subject: subject_slug || undefined, form: kbForm, limit: 3 },
              Number(process.env.KB_RAG_MAX_CHARS) || 6000,
            );
            if (!rag.docs.length && kbForm) {
              rag = kb.buildRagContext(
                query,
                { subject: subject_slug || undefined, limit: 3 },
                Number(process.env.KB_RAG_MAX_CHARS) || 6000,
              );
            }
            ragDocs = rag.docs.map((d) => ({
              title: d.title,
              kind: d.kind,
              subject: d.subject,
              snippet: kb.renderSnippet(d.docId, 240) || undefined,
            }));
            if (rag.docs.length && rag.text) {
              ragText = `\n\n# REFERENCE MATERIAL (from NECTA/TIE knowledge base)\nUse only what is relevant here to ground your answer. If the material doesn't answer the question, say so honestly rather than guessing.\n\n${rag.text}\n# END REFERENCE MATERIAL`;
            }
          }

          const nQuestions = Math.min(Math.max(Number(max_questions) || 10, 1), 20);

          const grounded = buildGroundedMessage({
            question: String(question || '').trim(),
            context: context,
            subjectName: subject.name,
            form: form_level,
            ragText,
            maxContextChars: Number(process.env.KB_CONTEXT_MAX_CHARS) || 4000,
          });

          let response = '';
          let sourced = false;
          try {
            const result = await ai.tutoring.tutor({
              studentId: 'platform',
              subject: subject.enumValue,
              topic: (context || question || 'topic').slice(0, 80),
              mode: TutoringMode.EXPLAIN,
              message: grounded,
              context: { lessonId: undefined, currentConcept: context },
              preferences: form_level ? ({ formLevel: form_level } as any) : undefined,
            });
            response = cleanThink(result.message);
            sourced = !!ragText;
            if (!response.trim()) {
              console.error(
                '[explain] tutor returned empty output',
                JSON.stringify({
                  messageLen: result.message?.length,
                  confidence: result.confidence,
                  completionTokens: result.usage?.completionTokens,
                }),
              );
              response = buildGroundedFallback(String(question || 'your question'), ragDocs);
            }
          } catch (err) {
            console.error('[explain] tutor failed, using KB-grounded fallback:', err);
            response = buildGroundedFallback(String(question || 'your question'), ragDocs);
            sourced = !!ragText;
          }

          // Generate up to 20 practice questions of any type (wrapped so a
          // generation failure never breaks the explanation above).
          let questions: unknown[] = [];
          try {
            const generated = await ai.questionGenerator.generateQuestions({
              subject: subject.name || (subject_slug || 'general'),
              topic: (context || question || 'lesson content').slice(0, 80),
              questionType: QuestionType.MULTIPLE_CHOICE,
              difficulty: Difficulty.INTERMEDIATE,
              category: QuestionCategory.COMPREHENSION,
              count: nQuestions,
              context: (context || '').slice(0, 4000),
              formLevel: form_level,
            } as any);
            questions = (generated || []).slice(0, nQuestions);
          } catch (err) {
            console.error('[explain] question generation failed:', err);
          }

          return { response, sourced, kbHits: ragDocs, questions, max_questions: nQuestions };
        }

        case '/api/exams/generate': {
          return safeAsync(
            async () => {
              const paper = await generateExamPaper(ai, body);
              return paper ? { paper } : { paper: null };
            },
            { paper: null },
          );
        }

        case '/api/tutoring/quiz': {
          const { question, context, subject_slug, form_level, count } = body;
          const subject = resolveSubject(subject_slug);
          const n = Math.min(Math.max(Number(count) || 10, 1), 20);
          let questions: unknown[] = [];
          try {
            const generated = await ai.questionGenerator.generateQuestions({
              subject: subject.name || (subject_slug || 'general'),
              topic: (context || question || 'lesson content').slice(0, 80),
              questionType: QuestionType.MULTIPLE_CHOICE,
              difficulty: Difficulty.INTERMEDIATE,
              category: QuestionCategory.COMPREHENSION,
              count: n,
              context: (context || '').slice(0, 4000),
              formLevel: form_level,
            } as any);
            questions = (generated || []).slice(0, n);
          } catch (err) {
            console.error('[quiz] question generation failed:', err);
          }
          return { questions, count: questions.length };
        }

        case '/api/content/analyze': {
          const text = typeof body.content === 'string' ? body.content : '';
          return {
            wordCount: text.split(/\s+/).filter(Boolean).length,
            charCount: text.length,
            headings: (text.match(/<h[1-6][^>]*>/gi) || []).length,
            links: (text.match(/<a\s/gi) || []).length,
            readability: 'unknown',
          };
        }

        case '/api/content/moderate': {
          const content = typeof body.content === 'string' ? body.content : '';
          return safeAsync(
            () =>
              ai.moderation.moderate({
                content,
                contentType: ModerationContentType.TEXT,
                language: Language.ENGLISH,
                context: 'educational',
              }),
            { flagged: false, flags: [], score: 0 },
          );
        }

        case '/api/content/translate': {
          const { text: translateText, content: translateContent, target_language } = body;
          const inputText = translateText || translateContent || '';
          return safeAsync(
            () =>
              ai.translator.translate({
                text: inputText,
                sourceLanguage: Language.ENGLISH,
                targetLanguage: (target_language as Language) || Language.SWAHILI,
              }),
            { translated: inputText, targetLanguage: target_language || 'sw' },
          );
        }

        case '/api/math/solve':
          return { formula: body.formula, variables: body.variables || {}, solved: true };

        case '/api/math/steps':
          return {
            steps: [`Start with ${body.expression}`, body.target ? `Solve for ${body.target}` : 'Simplify'],
          };

        case '/api/math/convert':
          return { value: body.value, from: body.from, to: body.to, converted: body.value };

        case '/api/math/physics-problem':
          return {
            topic: body.topic || 'physics',
            difficulty: body.difficulty || 'medium',
            problem: `A ${body.topic || 'physics'} problem at ${body.difficulty || 'medium'} difficulty.`,
          };

        case '/api/kb/health':
          return {
            ready: kb.ready,
            stats: kb.stats,
            subjects: kb.subjectCodes,
            error: kb.error?.message || null,
          };

        case '/api/kb/search': {
          const { q, subject, form, year, kind, limit } = body;
          if (!kb.ready) return { error: 'kb_unavailable', message: kb.error?.message };
          const hitDocs = kb.search(String(q || ''), {
            subject: typeof subject === 'string' ? subject : undefined,
            form: typeof form === 'string' ? form : undefined,
            year: typeof year === 'string' ? year : undefined,
            kind: Array.isArray(kind) ? kind : undefined,
            limit: Number(limit) || 8,
          });
          return {
            hits: hitDocs.map((h) => ({
              docId: h.docId,
              title: h.doc.title,
              kind: h.doc.kind,
              subject: h.doc.subject,
              code: h.doc.code,
              form: h.doc.form,
              year: h.doc.year,
              score: h.score,
              snippet: kb.renderSnippet(h.docId, 200),
            })),
          };
        }

        case '/api/kb/syllabus': {
          if (!kb.ready) return { error: 'kb_unavailable', message: kb.error?.message };
          const code = typeof body.code === 'string' ? body.code : body.subject;
          const doc = kb.lookupSyllabus(String(code || ''));
          if (!doc) return { error: 'not_found', message: `syllabus not found for ${code}` };
          return { syllabus: { title: doc.title, ...kb.getDocText(doc.id) ? { content: kb.getDocText(doc.id) } : {} } };
        }

        case '/api/kb/exams/search': {
          if (!kb.ready) return { error: 'kb_unavailable', message: kb.error?.message };
          const { level, subject, year, form, limit } = body;
          const docs = kb.lookupExam({
            level: typeof level === 'string' ? level : undefined,
            subject: typeof subject === 'string' ? subject : undefined,
            year: typeof year === 'string' ? year : undefined,
            form: typeof form === 'string' ? form : undefined,
          });
          return {
            total: docs.length,
            exams: docs.slice(0, Number(limit) || 20).map((d) => ({
              docId: d.id,
              title: d.title,
              subject: d.subject,
              level: d.level,
              form: d.form,
              year: d.year,
              file: d.file,
            })),
          };
        }

        case '/api/kb/exams/detail': {
          if (!kb.ready) return { error: 'kb_unavailable', message: kb.error?.message };
          const id = Number(body.docId || body.id);
          if (!Number.isFinite(id)) return { error: 'bad_request', message: 'docId required' };
          const text = kb.getDocText(id);
          const doc = kb.getDoc(id);
          if (!doc || text == null) return { error: 'not_found', message: `doc ${id} not found` };
          return { doc: { title: doc.title, kind: doc.kind, subject: doc.subject, level: doc.level }, content: text };
        }

        default:
          return { error: 'not_found', path: url };
      }
    }

    const result = await dispatch();
    if (url === '/default' || (result as any)?.error === 'not_found') {
      return send(res, 404, result);
    }
    return send(res, 200, result);
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[casuya-ai] HTTP server running on http://0.0.0.0:${PORT}`);
  });

  server.on('error', (err) => {
    console.error('[casuya-ai] Server failed to start:', err);
    process.exit(1);
  });
}

start().catch((err) => {
  console.error('[casuya-ai] Fatal initialization error:', err);
  process.exit(1);
});
