import {
  compareNectaFormat,
  postProcessTutoringResponse,
  scoreNectaFormatCompliance,
} from '../../../src/tutoring/post-process';

describe('postProcessTutoringResponse', () => {
  it('wraps bare context lines in blockquotes', () => {
    const input = '🌍 Context: Form II Chemistry\n\nAnswer body';
    const out = postProcessTutoringResponse(input);
    expect(out).toContain('> 🌍 Context');
  });

  it('scores complete NECTA tutor answers', () => {
    const text = [
      '> 🌍 Context: Form II',
      '### Step 1',
      '💡 **NECTA Examination Tip**',
      '**Review Question (Form II CSEE):** Sample?',
    ].join('\n');
    expect(scoreNectaFormatCompliance(text)).toBe('complete');
  });

  it('ranks format levels for retry decisions', () => {
    expect(compareNectaFormat('partial', 'none')).toBeGreaterThan(0);
    expect(compareNectaFormat('complete', 'partial')).toBeGreaterThan(0);
  });
});
