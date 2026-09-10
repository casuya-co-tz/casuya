import { QuestionGenerationRequest } from '../types';
import { CasuyaAIError, ErrorCode } from '../utilities';

export function validateRequest(request: QuestionGenerationRequest): void {
  if (!request.subject) {
    throw new CasuyaAIError('Subject is required', ErrorCode.VALIDATION_ERROR);
  }
  if (!request.topic) {
    throw new CasuyaAIError('Topic is required', ErrorCode.VALIDATION_ERROR);
  }
  if (request.count < 1 || request.count > 50) {
    throw new CasuyaAIError('Count must be between 1 and 50', ErrorCode.VALIDATION_ERROR);
  }
}