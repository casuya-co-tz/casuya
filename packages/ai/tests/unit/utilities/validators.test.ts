import { validateNonEmpty, validatePositiveNumber, validateInRange, validateContentLength } from '../../../src/utilities/validators';

describe('validators', () => {
  describe('validateNonEmpty', () => {
    it('should pass for non-empty strings', () => {
      expect(() => validateNonEmpty('hello', 'field')).not.toThrow();
    });

    it('should throw for empty strings', () => {
      expect(() => validateNonEmpty('', 'field')).toThrow();
    });
  });

  describe('validatePositiveNumber', () => {
    it('should pass for positive numbers', () => {
      expect(() => validatePositiveNumber(5, 'field')).not.toThrow();
    });

    it('should throw for zero', () => {
      expect(() => validatePositiveNumber(0, 'field')).toThrow();
    });
  });

  describe('validateInRange', () => {
    it('should pass for in-range values', () => {
      expect(() => validateInRange(5, 0, 10, 'field')).not.toThrow();
    });

    it('should throw for out-of-range', () => {
      expect(() => validateInRange(15, 0, 10, 'field')).toThrow();
    });
  });

  describe('validateContentLength', () => {
    it('should pass for valid content', () => {
      expect(() => validateContentLength('hello')).not.toThrow();
    });

    it('should throw for empty content', () => {
      expect(() => validateContentLength('')).toThrow();
    });
  });
});
