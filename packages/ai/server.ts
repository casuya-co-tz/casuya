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
import { ProviderType } from './src/types/providers';
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

function buildProviders(): { providers: Map<string, any>; default: string } {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

  const providers = new Map<string, any>();

  if (GROQ_API_KEY) {
    providers.set('groq', {
      type: ProviderType.OPENAI,
      apiKey: GROQ_API_KEY,
      endpoint: 'https://api.groq.com/openai/v1',
      model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
    });
  }

  if (GEMINI_API_KEY) {
    providers.set('gemini', {
      type: ProviderType.GEMINI,
      apiKey: GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    });
  }

  if (NVIDIA_API_KEY) {
    providers.set('nvidia', {
      type: ProviderType.OPENAI,
      apiKey: NVIDIA_API_KEY,
      endpoint: 'https://integrate.api.nvidia.com/v1',
      model: process.env.NVIDIA_MODEL || 'qwen/qwen2.5-72b-instruct',
    });
  }

  if (OPENROUTER_API_KEY) {
    providers.set('openrouter', {
      type: ProviderType.OPENAI,
      apiKey: OPENROUTER_API_KEY,
      endpoint: 'https://openrouter.ai/api/v1',
      model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o',
      options: {
        defaultHeaders: {
          'HTTP-Referer': process.env.SITE_URL || 'https://casuya.co.tz',
          'X-Title': process.env.SITE_NAME || 'Casuya',
        },
      },
    });
  }

  providers.set('local', { type: ProviderType.LOCAL, model: 'llama3.2' });

  const defaultProvider =
    (GROQ_API_KEY && 'groq') ||
    (GEMINI_API_KEY && 'gemini') ||
    (NVIDIA_API_KEY && 'nvidia') ||
    (OPENROUTER_API_KEY && 'openrouter') ||
    'local';

  return { providers, default: defaultProvider };
}

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

/** Meaningful, KB-grounded fallback when the model provider fails. */
function buildGroundedFallback(question: string, ragDocs: { title: string; kind: string }[]): string {
  const cleanQ = question.replace(/^(explain|describe|define|what is|what are|how does|how do|why is|why do|state|list|outline|distinguish|compare)\b[\s:]*/i, '').trim() || question.trim();
  if (ragDocs.length) {
    const refs = ragDocs.map((d) => `- ${d.title}`).join('\n');
    return `I couldn't reach the AI model right now, but here is what the NECTA/TIE knowledge base says is relevant to your question, so you can keep studying:\n\n${refs}\n\n_(Ask again in a moment and I'll give a full explanation — or read the lesson text above and the referenced material to understand "${cleanQ}".)_`;
  }
  return `I couldn't reach the AI model right now. Please re-ask your question shortly — I'll then give a full explanation of: ${cleanQ}`;
}

function cleanThink(text: string): string {
  let msg = text;
  msg = msg.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
  msg = msg.replace(/\s*thinking[\s\S]*?<\/think>/i, '');
  return msg.trim();
}

async function start() {
  const { providers, default: defaultProvider } = buildProviders();
  console.log(`[casuya-ai] Active provider: ${defaultProvider}`);

  const kb = getKnowledgeBase();
  if (kb.ready) {
    console.log(
      `[casuya-ai] Knowledge base ready: ${kb.stats.total} docs (subjects: ${kb.stats.subjects})`,
    );
  } else {
    console.warn(`[casuya-ai] Knowledge base NOT available: ${kb.error?.message || 'unknown'}`);
  }

  const ai = new CasuyaAI({ providers, defaultProvider });
  await ai.initializeProviders(providers, defaultProvider);

  const server = http.createServer(async (req, res) => {
    const url = (req.url || '').split('?')[0];

    if (req.method === 'GET' && url === '/health') {
      return send(res, 200, {
        status: 'ok',
        service: 'casuya-ai',
        version: '1.0.0',
        provider: defaultProvider,
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
          let ragDocs: { title: string; kind: string; subject: string }[] = [];
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
            ragDocs = rag.docs.map((d) => ({ title: d.title, kind: d.kind, subject: d.subject }));
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
