import { capitalize, slugify, truncate, stripHtml, countWords, countSentences, normalizeWhitespace } from '../../../src/utilities/text-utils';

describe('text-utils', () => {
  describe('capitalize', () => {
    it('should capitalize first letter', () => {
      expect(capitalize('hello')).toBe('Hello');
    });
  });

  describe('slugify', () => {
    it('should convert to URL-friendly slug', () => {
      expect(slugify('Hello World')).toBe('hello-world');
      expect(slugify('Casuya AI Lesson')).toBe('casuya-ai-lesson');
    });
  });

  describe('truncate', () => {
    it('should truncate long strings', () => {
      expect(truncate('Hello World', 5)).toBe('He...');
    });

    it('should not truncate short strings', () => {
      expect(truncate('Hello', 10)).toBe('Hello');
    });
  });

  describe('stripHtml', () => {
    it('should remove HTML tags', () => {
      expect(stripHtml('<p>Hello</p>')).toBe('Hello');
    });
  });

  describe('countWords', () => {
    it('should count words correctly', () => {
      expect(countWords('Hello world from Casuya')).toBe(4);
    });
  });

  describe('countSentences', () => {
    it('should count sentences correctly', () => {
      expect(countSentences('Hello. World. Casuya!')).toBe(3);
    });
  });

  describe('normalizeWhitespace', () => {
    it('should normalize whitespace', () => {
      expect(normalizeWhitespace('Hello   World')).toBe('Hello World');
    });
  });
});
