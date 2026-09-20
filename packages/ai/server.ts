/**
 * Minimal HTTP server for the casuya-ai library.
 *
 * Exposes the endpoints the casuya-platform calls (see backend/services/ai_service.py)
 * over HTTP so the AI package can run as a standalone microservice. Uses a free
 * provider failover chain when API keys are configured. Failures return honest
 * HTTP error codes; the platform decides whether to use offline fallbacks.
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
import { RateLimiter } from './src/utilities/rate-limiter';
import { HttpError, clientIp, readApiKey, requireAuthorized } from './server-security';
import { buildFreeProviderSpecs, specsToConfigMap } from './src/providers/free-chain';
import { buildQualityProviderSpec } from './src/providers/quality-provider';
import { getKnowledgeBase } from './src/kb';
import { handleQuestionGenerate, handleTutoringQuiz } from './routes/questions';
import { handleTutoringExplain, handleTutoringStream, handlePlanLesson, handlePlanScheme } from './routes/tutoring';
import { handleTestGenerate } from './routes/tests';
import {
  handleContentAnalyze,
  handleContentModerate,
  handleContentTranslate,
  handleContentTranslateStream,
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

async function safeAsync(
  fn: () => Promise<unknown>,
  fallback: unknown,
  options: { soft?: boolean } = {},
): Promise<unknown> {
  try {
    return await fn();
  } catch (err) {
    console.error('[safeAsync] Error:', err);
    if (err instanceof HttpError) throw err;
    if (options.soft === false) {
      throw new HttpError(503, 'AI provider temporarily unavailable');
    }
    return fallback;
  }
}

async function start() {
  const { specs, chain } = buildFreeProviderSpecs();
  const providers = specsToConfigMap(specs);
  const qualitySpec = buildQualityProviderSpec();
  if (qualitySpec) {
    providers.set(qualitySpec.name, qualitySpec.config);
    console.log('[casuya-ai] Quality tier provider registered (deep mode)');
  }
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

  const platformUrl = (process.env.CASUYA_PLATFORM_URL || process.env.PLATFORM_URL || '').trim();
  const platformApiKey = (process.env.CASUYA_PLATFORM_API_KEY || '').trim() || undefined;
  const ai = new CasuyaAI({
    providers,
    defaultProvider,
    ...(platformUrl
      ? {
          syllabus: {
            platformUrl,
            apiKey: platformApiKey,
            timeoutMs: 10_000,
          },
        }
      : {}),
  });
  if (platformUrl) {
    console.log(`[casuya-ai] SyllabusAdapter → ${platformUrl}`);
  } else {
    console.warn('[casuya-ai] CASUYA_PLATFORM_URL unset — inbound curriculum_context only');
  }
  await ai.initializeProviders(providers, defaultProvider, chain);
  const apiKey = readApiKey();
  const rateLimiter = new RateLimiter({ maxRequests: 60, windowMs: 60_000 });

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

    if (req.method === 'GET' && url === '/readyz') {
      const ready = kb.ready && chain.length > 0;
      return send(res, 200, {
        status: ready ? 'ok' : 'degraded',
        kb_ready: kb.ready,
        providers_ready: chain.length > 0,
        provider_chain: chain,
      });
    }

    if (req.method !== 'POST') {
      return send(res, 405, { error: 'method_not_allowed' });
    }

    try {
      requireAuthorized(req, apiKey);
    } catch (err) {
      if (err instanceof HttpError) {
        return send(res, err.statusCode, { error: err.message });
      }
      return send(res, 401, { error: 'Unauthorized' });
    }

    const ip = clientIp(req);
    if (!(await rateLimiter.acquire(ip))) {
      return send(res, 429, { error: 'Rate limit exceeded' });
    }

    const body = await readBody(req);
    const requestIdHeader = req.headers['x-request-id'];
    const requestId = Array.isArray(requestIdHeader)
      ? requestIdHeader[0]
      : requestIdHeader || 'unknown';

    if (url === '/api/tutoring/stream' || url === '/api/content/translate/stream') {
      const started = Date.now();
      try {
        if (url === '/api/content/translate/stream') {
          await handleContentTranslateStream(ai, body, res);
        } else {
          await handleTutoringStream(ai, body, res);
        }
        console.log(
          `[casuya-ai] ok path=${url} request_id=${requestId} latency_ms=${Date.now() - started}`,
        );
      } catch (err) {
        console.error('[casuya-ai] stream error:', err);
        if (!res.headersSent) {
          send(res, 503, { error: 'stream_unavailable' });
        } else {
          res.end();
        }
      }
      return;
    }

    async function dispatch(): Promise<unknown> {
      switch (url) {
        case '/api/questions/generate':
          return safeAsync(() => handleQuestionGenerate(ai, body), { questions: [] }, { soft: false });
        case '/api/tutoring/explain':
          return handleTutoringExplain(ai, body);
        case '/api/plans/lesson-plan':
          return safeAsync(() => handlePlanLesson(ai, body), { header: {} }, { soft: false });
        case '/api/plans/scheme-of-work':
          return safeAsync(() => handlePlanScheme(ai, body), { header: {} }, { soft: false });
        case '/api/exams/generate':
          return safeAsync(() => handleExamGenerate(ai, body), { paper: null }, { soft: false });
        case '/api/tutoring/quiz':
          return handleTutoringQuiz(ai, body);
        case '/api/tests/generate':
          return safeAsync(() => handleTestGenerate(ai, body), {
            questions: [],
            count: 0,
            testType: 'topical',
            testTypeLabel: 'Practice Test',
            grounded: false,
            subject: '',
            formLevel: null,
            kbHits: [],
          }, { soft: false });
        case '/api/content/analyze':
          return handleContentAnalyze(body);
        case '/api/content/moderate':
          return safeAsync(() => handleContentModerate(ai, body), { flagged: false, flags: [], score: 0 }, { soft: false });
        case '/api/content/translate':
          return safeAsync(() => handleContentTranslate(ai, body), {
            translatedText: '',
            sourceLanguage: 'en',
            targetLanguage: 'sw',
            confidence: 0,
            latency: 0,
          }, { soft: false });
        default:
          return null;
      }
    }

    const started = Date.now();
    try {
      const result = await dispatch();
      if (result === null) {
        return send(res, 404, { error: 'not_found', path: url });
      }
      console.log(
        `[casuya-ai] ok path=${url} request_id=${requestId} latency_ms=${Date.now() - started}`,
      );
      return send(res, 200, result);
    } catch (err) {
      if (err instanceof HttpError) {
        console.warn(
          `[casuya-ai] error path=${url} request_id=${requestId} status=${err.statusCode} latency_ms=${Date.now() - started}`,
        );
        return send(res, err.statusCode, { error: err.message });
      }
      console.error('[casuya-ai] Unhandled route error:', err);
      return send(res, 500, { error: 'internal_error' });
    }
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