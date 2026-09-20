import type { ServerResponse } from 'node:http';
import { CasuyaAI } from '../src/casuya-ai';
import { getKnowledgeBase } from '../src/kb';
import {
  QuestionType,
  QuestionCategory,
  Difficulty,
  TutoringMode,
} from '../src/types/index';
import { ProviderFactory } from '../src/providers/provider-factory';
import {
  NECTA_FORMAT_RETRY_HINT,
  compareNectaFormat,
  postProcessTutoringResponse,
  scoreNectaFormatCompliance,
} from '../src/tutoring/post-process';
import {
  resolveSubject,
  formToKbForm,
  formLabel,
  buildGroundedMessage,
  buildGroundedFallback,
  cleanThink,
  parseJsonObject,
} from '../server';

function syllabusBlock(curriculumContext: string): string {
  const text = curriculumContext.trim().slice(0, 8000);
  if (!text) return '';
  return (
    '\n\n# TIE SYLLABUS CONTEXT (official curriculum)\n' +
    'Ground your answer in this syllabus. If it does not cover the question, say so honestly.\n\n' +
    `${text}\n# END SYLLABUS CONTEXT`
  );
}

function buildTutoringRag(body: any) {
  const { question, context, subject_slug, form_level, curriculum_context, language } = body;
  const langPref = language === 'sw' ? 'sw' : language === 'en' ? 'en' : 'both';
  const subject = resolveSubject(subject_slug);
  const query = [question, context].filter(Boolean).join(' ').trim();
  const kbForm = formToKbForm(form_level);
  const kb = getKnowledgeBase();

  let ragText = syllabusBlock(typeof curriculum_context === 'string' ? curriculum_context : '');
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
      ragText += `\n\n# REFERENCE MATERIAL (from NECTA/TIE knowledge base)\nUse only what is relevant here to ground your answer. If the material doesn't answer the question, say so honestly rather than guessing.\n\n${rag.text}\n# END REFERENCE MATERIAL`;
    }
  }

  const grounded = buildGroundedMessage({
    question: String(question || '').trim(),
    context: context,
    subjectName: subject.name,
    form: form_level,
    ragText,
    maxContextChars: Number(process.env.KB_CONTEXT_MAX_CHARS) || 4000,
  });

  return { langPref, subject, grounded, ragText, ragDocs, kbForm };
}

function sseWrite(res: ServerResponse, data: Record<string, unknown>) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export async function handleTutoringStream(ai: CasuyaAI, body: any, res: ServerResponse): Promise<void> {
  const { question, context, form_level } = body;
  const { langPref, subject, grounded, ragDocs, ragText } = buildTutoringRag(body);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  let raw = '';
  try {
    const tutorOpts = {
      studentId: 'platform',
      subject: subject.enumValue,
      topic: (context || question || 'topic').slice(0, 80),
      mode: TutoringMode.EXPLAIN,
      message: grounded,
      context: { lessonId: undefined, currentConcept: context },
      preferences: {
        ...(form_level ? { formLevel: form_level } : {}),
        language: langPref,
      } as any,
    };

    for await (const chunk of ai.tutoring.tutorStream(tutorOpts)) {
      if (chunk.content) {
        raw += chunk.content;
        sseWrite(res, { chunk: chunk.content, done: false });
      }
      if (chunk.done) break;
    }
  } catch (err) {
    console.error('[stream] tutor stream failed:', err);
    const fallback = buildGroundedFallback(String(question || 'your question'), ragDocs);
    raw = fallback;
    sseWrite(res, { chunk: fallback, done: false });
  }

  let response = postProcessTutoringResponse(cleanThink(raw));
  let formatLevel = scoreNectaFormatCompliance(response);
  if (!response.trim()) {
    response = buildGroundedFallback(String(question || 'your question'), ragDocs);
    formatLevel = 'none';
  }

  sseWrite(res, {
    chunk: '',
    done: true,
    source: response.trim() ? 'casuya-ai' : 'offline',
    kbHits: ragDocs,
    formatComplete: formatLevel === 'complete',
    formatLevel,
    sourced: !!ragText,
  });
  res.end();
}

export async function handleTutoringExplain(
  ai: CasuyaAI,
  body: any,
): Promise<unknown> {
  const { question, context, form_level, max_questions } = body;
  const { langPref, subject, grounded, ragText, ragDocs } = buildTutoringRag(body);

  const nQuestions = Math.min(Math.max(Number(max_questions) || 10, 1), 20);

  let response = '';
  let sourced = false;
  let formatComplete = false;
  try {
    const tutorOpts = {
      studentId: 'platform',
      subject: subject.enumValue,
      topic: (context || question || 'topic').slice(0, 80),
      mode: TutoringMode.EXPLAIN,
      message: grounded,
      context: { lessonId: undefined, currentConcept: context },
      preferences: {
        ...(form_level ? { formLevel: form_level } : {}),
        language: langPref,
      } as any,
    };
    const result = await ai.tutoring.tutor(tutorOpts);
    response = postProcessTutoringResponse(cleanThink(result.message));
    sourced = !!ragText;
    let formatLevel = scoreNectaFormatCompliance(response);
    if (formatLevel !== 'complete') {
      try {
        const retry = await ai.tutoring.tutor({
          ...tutorOpts,
          message: grounded + NECTA_FORMAT_RETRY_HINT,
        });
        const retryResponse = postProcessTutoringResponse(cleanThink(retry.message));
        const retryLevel = scoreNectaFormatCompliance(retryResponse);
        if (retryResponse.trim() && compareNectaFormat(retryLevel, formatLevel) > 0) {
          response = retryResponse;
          formatLevel = retryLevel;
        }
      } catch (retryErr) {
        console.error('[explain] format retry failed:', retryErr);
      }
    }
    formatComplete = formatLevel === 'complete';
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
      formatComplete = false;
    }
  } catch (err) {
    console.error('[explain] tutor failed, using KB-grounded fallback:', err);
    response = buildGroundedFallback(String(question || 'your question'), ragDocs);
    sourced = !!ragText;
    formatComplete = false;
  }

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

  return {
    response,
    sourced,
    kbHits: ragDocs,
    questions,
    max_questions: nQuestions,
    formatComplete,
    formatLevel: scoreNectaFormatCompliance(response),
  };
}

async function generatePlanJson(ai: CasuyaAI, body: any, kind: 'lesson' | 'scheme'): Promise<any> {
  const sentPrompt = String(body?.prompt || body?.question || '').trim();
  const userPrompt =
    sentPrompt ||
    `Generate an official TIE ${kind === 'lesson' ? 'Lesson Plan' : 'Scheme of Work'} as valid JSON only, ` +
      `with a "header" object ${
        kind === 'lesson'
          ? 'and "competence_architecture", "progression_matrix", "resources_strategies"'
          : 'and a non-empty "weeks" array'
      }. Subject: ${String(body?.subject_slug || '')} Form ${body?.form_level || 1}.`;

  const provider = ProviderFactory.getProvider('failover') || ProviderFactory.getProvider('local');
  if (!provider) return { header: {} };

  try {
    const result = await provider.chatCompletion({
      messages: [
        {
          role: 'system',
          content:
            'You are a Tanzanian TIE curriculum expert. Respond with valid JSON only, matching the exact schema in the prompt.',
        },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.6,
      maxTokens: Math.min(9000, 4000),
    });
    const parsed = parseJsonObject(result.content);
    if (parsed && typeof parsed === 'object' && parsed.header) return parsed;
  } catch (err) {
    console.error(`[plans/${kind}] generation failed:`, err);
  }
  return { header: {} };
}

export async function handlePlanLesson(ai: CasuyaAI, body: any): Promise<unknown> {
  return generatePlanJson(ai, body, 'lesson');
}

export async function handlePlanScheme(ai: CasuyaAI, body: any): Promise<unknown> {
  return generatePlanJson(ai, body, 'scheme');
}
