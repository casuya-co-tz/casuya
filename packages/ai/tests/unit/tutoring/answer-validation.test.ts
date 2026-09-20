import {
  applyValidationFooter,
  validateTutorAnswer,
} from '../../../src/tutoring/answer-validation';

describe('validateTutorAnswer', () => {
  it('flags low syllabus overlap answers', () => {
    const curriculum = 'linear equations variables coefficients substitution algebra form one mathematics tie syllabus';
    const response = 'Quantum chromodynamics explains hadronization through gluon confinement mechanisms extensively.';
    const result = validateTutorAnswer(response, { curriculumContext: curriculum });
    expect(result.flaggedTerms.length).toBeGreaterThan(0);
  });

  it('adds uncertainty footer when review needed', () => {
    const result = {
      needsReview: true,
      flaggedTerms: ['quantum'],
      uncertaintyNote: '\n\n> ⚠️ *Thibitisha na kitabu chako*',
    };
    const out = applyValidationFooter('Answer body', result);
    expect(out).toContain('Thibitisha na kitabu chako');
  });
});
