import { Severity } from '../types';

export class CasuyaAIError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly severity: Severity = Severity.ERROR,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'CasuyaAIError';
  }
}

export enum ErrorCode {
  // Provider errors (1000-1999)
  PROVIDER_NOT_FOUND = 1000,
  PROVIDER_UNAVAILABLE = 1001,
  PROVIDER_RATE_LIMITED = 1002,
  PROVIDER_AUTH_FAILED = 1003,
  PROVIDER_TIMEOUT = 1004,
  PROVIDER_INVALID_RESPONSE = 1005,
  PROVIDER_QUOTA_EXCEEDED = 1006,

  // Model errors (2000-2999)
  MODEL_NOT_FOUND = 2000,
  MODEL_CAPABILITY_MISSING = 2001,
  MODEL_CONTEXT_EXCEEDED = 2002,

  // Tutoring errors (3000-3999)
  TUTORING_SESSION_NOT_FOUND = 3000,
  TUTORING_INVALID_MODE = 3001,
  TUTORING_SUBJECT_UNSUPPORTED = 3002,

  // Content errors (4000-4999)
  CONTENT_TOO_LONG = 4000,
  CONTENT_TOO_SHORT = 4001,
  CONTENT_UNSUPPORTED_LANGUAGE = 4002,
  CONTENT_MODERATION_FAILED = 4003,

  // Cache errors (5000-5999)
  CACHE_MISS = 5000,
  CACHE_FULL = 5001,
  CACHE_CORRUPTED = 5002,

  // Prompt errors (6000-6999)
  PROMPT_TEMPLATE_NOT_FOUND = 6000,
  PROMPT_VARIABLE_MISSING = 6001,
  PROMPT_INVALID_TEMPLATE = 6002,

  // General errors (9000-9999)
  VALIDATION_ERROR = 9000,
  CONFIGURATION_ERROR = 9001,
  NOT_IMPLEMENTED = 9002,
  INTERNAL_ERROR = 9003,
  UNSUPPORTED_OPERATION = 9004,
}

export function isCasuyaAIError(error: unknown): error is CasuyaAIError {
  return error instanceof CasuyaAIError;
}
