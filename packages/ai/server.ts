/**
 * Minimal HTTP server for the casuya-ai library.
 *
 * Exposes the endpoints the casuya-platform calls (see backend/services/ai_service.py)
 * over HTTP so the AI package can run as a standalone microservice. Uses the LOCAL
 * provider by default (no API keys required) and degrades to simple local responses
 * if a model-backed call is unavailable, so the platform always receives a 200.
 *
 * Dependency-free: uses Node's built-in http module.
 *
 * Shared constants and pure helpers live in server-utils.ts and are re-exported
 * below so the route handlers can keep importing from '../server'.
 */

import * as http from 'http';
import * as path from 'path';
import dotenv from 'dotenv';
import { CasuyaAI } from './src/casuya-ai';
import { buildFreeProviderSpecs, specsToConfigMap } from './src/providers/free-chain';
import { getKnowledgeBase } from './src/kb';
import { handleQuestionGenerate, handleTutoringQuiz } from './routes/questions';
import { handleTutoringExplain, handlePlanLesson, handlePlanScheme } from './routes/tutoring';
import {
  handleContentAnalyze,
  handleContentModerate,
  handleContentTranslate,
  handleMathSolve,
  handleMathSteps,
  handleMathConvert,
  handleMathPhysics,
  handleExamGenerate,
} from './routes/content';

export {
  SUBJECT_NAME,
  resolveSubject,
  formToKbForm,
  formLabel,
  buildGroundedMessage,
  buildGroundedFallback,
  cleanThink,
  ExamSectionSpec,
  EXAM_KIND_LABEL,
  numToWords,
  countLabel,
  markLabel,
  sectionInstruction,
  buildExamPrompt,
  parseExamJson,
  normalizeExamPaper,
  parseJsonObject,
} from './server-utils';

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
    req.on('error', () => {
      resolve({});
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
        case '/api/questions/generate':
          return safeAsync(() => handleQuestionGenerate(ai, body), { questions: [] });
        case '/api/tutoring/explain':
          return handleTutoringExplain(ai, body);
        case '/api/plans/lesson-plan':
          return safeAsync(() => handlePlanLesson(ai, body), { header: {} });
        case '/api/plans/scheme-of-work':
          return safeAsync(() => handlePlanScheme(ai, body), { header: {} });
        case '/api/exams/generate':
          return safeAsync(() => handleExamGenerate(ai, body), { paper: null });
        case '/api/tutoring/quiz':
          return handleTutoringQuiz(ai, body);
        case '/api/content/analyze':
          return handleContentAnalyze(body);
        case '/api/content/moderate':
          return safeAsync(() => handleContentModerate(ai, body), { flagged: false, flags: [], score: 0 });
        case '/api/content/translate':
          return safeAsync(() => handleContentTranslate(ai, body), { translatedText: '', sourceLanguage: 'en', targetLanguage: 'sw', confidence: 0, latency: 0 });
        case '/api/math/solve':
          return handleMathSolve(body);
        case '/api/math/steps':
          return handleMathSteps(body);
        case '/api/math/convert':
          return handleMathConvert(body);
        case '/api/math/physics-problem':
          return handleMathPhysics(body);
        default:
          return null;
      }
    }

    const result = await dispatch();
    if (result === null) {
      return send(res, 404, { error: 'not_found', path: url });
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