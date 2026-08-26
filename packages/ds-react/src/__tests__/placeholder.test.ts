import { describe, it, expect } from 'vitest';
import { cx } from '../utils/cx';
import { variantClasses } from '../utils/variants';

describe('cx utility', () => {
  it('joins class names', () => {
    expect(cx('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cx('base', false && 'hidden', 'end')).toBe('base end');
  });

  it('handles undefined and null gracefully', () => {
    expect(cx('base', undefined, null, 'end')).toBe('base end');
  });

  it('returns empty string for no arguments', () => {
    expect(cx()).toBe('');
  });
});

describe('variantClasses utility', () => {
  const variants = {
    color: {
      primary: 'text-blue-500',
      danger: 'text-red-500',
    },
    size: {
      sm: 'text-sm',
      lg: 'text-lg',
    },
  };

  it('returns base class when no props match', () => {
    expect(variantClasses('base', variants, {})).toBe('base');
  });

  it('resolves a single variant', () => {
    expect(variantClasses('base', variants, { color: 'primary' })).toBe('base text-blue-500');
  });

  it('resolves multiple variants', () => {
    expect(variantClasses('base', variants, { color: 'danger', size: 'lg' })).toBe(
      'base text-red-500 text-lg',
    );
  });

  it('ignores unknown variant values', () => {
    expect(variantClasses('base', variants, { color: 'unknown' })).toBe('base');
  });

  it('ignores missing variant keys', () => {
    expect(variantClasses('base', variants, { missing: 'value' })).toBe('base');
  });
});
