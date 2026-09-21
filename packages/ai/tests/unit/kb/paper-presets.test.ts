import {
  formFamily,
  listAvailablePapers,
  resolvePaperPreset,
} from '../../../src/kb/paper-presets';

describe('paper presets', () => {
  it('maps form levels to exam families', () => {
    expect(formFamily(1)).toBe('ftna');
    expect(formFamily(2)).toBe('ftna');
    expect(formFamily(3)).toBe('csee');
    expect(formFamily(4)).toBe('csee');
    expect(formFamily(5)).toBe('acsee');
    expect(formFamily(6)).toBe('acsee');
  });

  it('resolves CSEE Physics theory with 11 question slots', () => {
    const preset = resolvePaperPreset({
      subject_slug: 'physics',
      form_level: 4,
      test_type: 'necta_iv',
      paper: 'theory',
    });
    expect(preset).not.toBeNull();
    expect(preset!.subject_code).toBe('031');
    expect(preset!.paper_code).toBe('031/1');
    expect(preset!.total_marks).toBe(100);
    const slots = preset!.sections!.flatMap((s) => s.questions);
    expect(slots).toHaveLength(11);
    expect(slots[0].type).toBe('mcq_bundle');
    expect(slots[0].item_count).toBe(10);
    expect(slots[1].type).toBe('matching');
    expect(slots[1].item_count).toBe(6);
    const secC = preset!.sections!.find((s) => s.id === 'C');
    expect(secC?.choice).toEqual({ mode: 'n_of_m', n: 2, m: 3 });
  });

  it('uses 5 matching items for FTNA science', () => {
    const preset = resolvePaperPreset({
      subject_slug: 'chemistry',
      form_level: 2,
      test_type: 'necta_ii',
      paper: 'theory',
    });
    expect(preset).not.toBeNull();
    const matching = preset!.sections![0].questions.find((q) => q.type === 'matching');
    expect(matching?.item_count).toBe(5);
  });

  it('scales topical papers to shorter booklets', () => {
    const full = resolvePaperPreset({
      subject_slug: 'physics',
      form_level: 4,
      test_type: 'midterm',
      paper: 'theory',
    });
    const topical = resolvePaperPreset({
      subject_slug: 'physics',
      form_level: 4,
      test_type: 'topical',
      paper: 'theory',
    });
    expect(full!.total_marks).toBe(100);
    expect(topical!.total_marks).toBeLessThan(full!.total_marks);
    expect(topical!.total_marks).toBe(45);
  });

  it('lists practical for sciences but not mathematics', () => {
    const phys = listAvailablePapers({ subject_slug: 'physics', form_level: 4, test_type: 'midterm' });
    expect(phys.some((p) => p.paper === 'practical')).toBe(true);
    const math = listAvailablePapers({ subject_slug: 'mathematics', form_level: 4, test_type: 'midterm' });
    expect(math.some((p) => p.paper === 'practical')).toBe(false);
  });

  it('Basic Mathematics CSEE has no MCQ bundle', () => {
    const preset = resolvePaperPreset({
      subject_slug: 'mathematics',
      form_level: 4,
      test_type: 'necta_iv',
      paper: 'theory',
    });
    expect(preset!.subject_code).toBe('041');
    const types = preset!.sections!.flatMap((s) => s.questions.map((q) => q.type));
    expect(types).not.toContain('mcq_bundle');
    expect(types).not.toContain('matching');
  });

  it('ACSEE advanced math has paper 2', () => {
    const papers = listAvailablePapers({ subject_slug: 'mathematics', form_level: 6, test_type: 'necta_vi' });
    expect(papers.some((p) => p.paper === 'theory_2')).toBe(true);
  });
});
