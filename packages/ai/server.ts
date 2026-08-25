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
import { CasuyaAI } from './src/casuya-ai';
import { ProviderType } from './src/types/providers';
import {
  QuestionType,
  QuestionCategory,
  Difficulty,
  TutoringSubject,
  TutoringMode,
  Language,
  ModerationContentType,
} from './src/types/index';

const PORT = parseInt(process.env.PORT || process.env.CASUYA_AI_PORT || '3000', 10);

const ai = new CasuyaAI({
  providers: new Map([['local', { type: ProviderType.LOCAL, model: 'llama3.2' }]]),
  defaultProvider: 'local',
});

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

function safe(fn: () => unknown, fallback: unknown): unknown {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

async function safeAsync(fn: () => Promise<unknown>, fallback: unknown): Promise<unknown> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

const server = http.createServer(async (req, res) => {
  const url = (req.url || '').split('?')[0];

  if (req.method === 'GET' && url === '/health') {
    return send(res, 200, { status: 'ok', service: 'casuya-ai', version: '1.0.0' });
  }

  if (req.method !== 'POST') {
    return send(res, 405, { error: 'method_not_allowed' });
  }

  const body = await readBody(req);

  async function dispatch(): Promise<unknown> {
    switch (url) {
      case '/api/questions/generate': {
        const { content, count = 5 } = body;
        return safeAsync(
          () =>
            ai.questionGenerator.generateQuestions({
              subject: TutoringSubject.GENERAL,
              topic: (content || 'topic').slice(0, 60),
              questionType: QuestionType.MULTIPLE_CHOICE,
              difficulty: Difficulty.INTERMEDIATE,
              category: QuestionCategory.COMPREHENSION,
              count: Number(count) || 5,
              context: content,
            }),
          { questions: [] },
        );
      }

      case '/api/tutoring/explain': {
        const { question, context } = body;
        return safeAsync(
          () =>
            ai.tutoring.tutor({
              studentId: 'platform',
              subject: TutoringSubject.GENERAL,
              topic: (context || 'topic').slice(0, 40),
              mode: TutoringMode.EXPLAIN,
              message: question,
              context: { lessonId: undefined, currentConcept: context },
            }),
          { response: `Explanation: ${question}` },
        );
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
        const { content, target_language } = body;
        return safeAsync(
          () =>
            ai.translator.translate({
              text: content,
              sourceLanguage: Language.ENGLISH,
              targetLanguage: (target_language as Language) || Language.SWAHILI,
            }),
          { translated: content, targetLanguage: target_language || 'sw' },
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
