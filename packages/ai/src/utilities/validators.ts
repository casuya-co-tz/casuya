import { CasuyaAIError, ErrorCode } from './errors';

export function validateNonEmpty(value: string, fieldName: string): void {
  if (!value || value.trim().length === 0) {
    throw new CasuyaAIError(
      `${fieldName} must not be empty`,
      ErrorCode.VALIDATION_ERROR,
    );
  }
}

export function validatePositiveNumber(value: number, fieldName: string): void {
  if (typeof value !== 'number' || value <= 0) {
    throw new CasuyaAIError(
      `${fieldName} must be a positive number`,
      ErrorCode.VALIDATION_ERROR,
    );
  }
}

export function validateInRange(value: number, min: number, max: number, fieldName: string): void {
  if (value < min || value > max) {
    throw new CasuyaAIError(
      `${fieldName} must be between ${min} and ${max}`,
      ErrorCode.VALIDATION_ERROR,
    );
  }
}

export function validateMaxLength(value: string, max: number, fieldName: string): void {
  if (value.length > max) {
    throw new CasuyaAIError(
      `${fieldName} must not exceed ${max} characters`,
      ErrorCode.VALIDATION_ERROR,
    );
  }
}

export function validateObject(value: unknown, fieldName: string): void {
  if (value === null || value === undefined || typeof value !== 'object') {
    throw new CasuyaAIError(
      `${fieldName} must be an object`,
      ErrorCode.VALIDATION_ERROR,
    );
  }
}

export function validateLanguage(language: string): void {
  const supportedLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko', 'ar', 'hi', 'ru', 'sw', 'zu', 'af'];
  if (!supportedLanguages.includes(language)) {
    throw new CasuyaAIError(
      `Unsupported language: ${language}`,
      ErrorCode.CONTENT_UNSUPPORTED_LANGUAGE,
    );
  }
}

export function validateContentLength(content: string): void {
  if (content.length < 1) {
    throw new CasuyaAIError(
      'Content must not be empty',
      ErrorCode.CONTENT_TOO_SHORT,
    );
  }
  if (content.length > 100000) {
    throw new CasuyaAIError(
      'Content exceeds maximum length of 100000 characters',
      ErrorCode.CONTENT_TOO_LONG,
    );
  }
}
