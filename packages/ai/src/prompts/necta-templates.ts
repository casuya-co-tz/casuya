/**
 * NECTA/TIE-specific prompt templates for the Casuya AI agent.
 *
 * These templates inject the exact Tanzania national curriculum context
 * into AI prompts so that tutoring, question generation, and assessments
 * align with the official TIE syllabus and NECTA examination formats.
 */

import type { PromptTemplate } from '../types';
import { NECTA_TUTORING_TEMPLATE } from './necta/tutoring';
import { NECTA_QUESTION_TEMPLATE } from './necta/question';

export { NECTA_TUTORING_TEMPLATE, NECTA_QUESTION_TEMPLATE };

export const NECTA_TEMPLATES: PromptTemplate[] = [
  NECTA_TUTORING_TEMPLATE,
  NECTA_QUESTION_TEMPLATE,
];