import type {
  Lesson,
  Slide,
  ComponentData,
  ValidationResult,
  ValidationError,
} from '../types.js';

export function validateLesson(lesson: Lesson): ValidationResult {
  const errors: ValidationError[] = [];

  if (!lesson.id) {
    errors.push({ path: 'lesson.id', message: 'Lesson ID is required', severity: 'error' });
  }
  if (!lesson.title || lesson.title.trim().length === 0) {
    errors.push({ path: 'lesson.title', message: 'Lesson title is required', severity: 'error' });
  }
  if (lesson.title && lesson.title.length > 200) {
    errors.push({ path: 'lesson.title', message: 'Lesson title must be 200 characters or less', severity: 'error' });
  }
  if (!lesson.version) {
    errors.push({ path: 'lesson.version', message: 'Lesson version is required', severity: 'error' });
  }
  if (!lesson.slides || lesson.slides.length === 0) {
    errors.push({ path: 'lesson.slides', message: 'Lesson must have at least one slide', severity: 'warning' });
  }

  if (lesson.slides) {
    lesson.slides.forEach((slide, index) => {
      const slideResult = validateSlide(slide, `slides[${index}]`);
      errors.push(...slideResult.errors);
    });
  }

  return {
    valid: errors.filter((e) => e.severity === 'error').length === 0,
    errors,
  };
}

export function validateSlide(slide: Slide, basePath = 'slide'): ValidationResult {
  const errors: ValidationError[] = [];

  if (!slide.id) {
    errors.push({ path: `${basePath}.id`, message: 'Slide ID is required', severity: 'error' });
  }
  if (!slide.title || slide.title.trim().length === 0) {
    errors.push({ path: `${basePath}.title`, message: 'Slide title is required', severity: 'warning' });
  }
  if (slide.duration < 0) {
    errors.push({ path: `${basePath}.duration`, message: 'Duration must be non-negative', severity: 'error' });
  }

  if (slide.components) {
    slide.components.forEach((component, index) => {
      const componentResult = validateComponent(component, `${basePath}.components[${index}]`);
      errors.push(...componentResult.errors);
    });
  }

  return {
    valid: errors.filter((e) => e.severity === 'error').length === 0,
    errors,
  };
}

export function validateComponent(
  component: ComponentData,
  basePath = 'component'
): ValidationResult {
  const errors: ValidationError[] = [];

  if (!component.id) {
    errors.push({ path: `${basePath}.id`, message: 'Component ID is required', severity: 'error' });
  }
  if (!component.type) {
    errors.push({ path: `${basePath}.type`, message: 'Component type is required', severity: 'error' });
  }
  if (component.size.width < 0 || component.size.height < 0) {
    errors.push({ path: `${basePath}.size`, message: 'Component dimensions must be non-negative', severity: 'error' });
  }
  if (component.position.x < 0 || component.position.y < 0) {
    errors.push({ path: `${basePath}.position`, message: 'Component position must be non-negative', severity: 'warning' });
  }

  return {
    valid: errors.filter((e) => e.severity === 'error').length === 0,
    errors,
  };
}

export function isValidColor(value: string): boolean {
  if (/^#[0-9a-fA-F]{3,8}$/.test(value)) return true;
  if (/^rgb\(/.test(value) || /^rgba\(/.test(value)) return true;
  if (/^hsl\(/.test(value) || /^hsla\(/.test(value)) return true;
  return CSS_COLOR_NAMES.has(value.toLowerCase());
}

const CSS_COLOR_NAMES = new Set([
  'black', 'white', 'red', 'green', 'blue', 'yellow', 'cyan', 'magenta',
  'orange', 'purple', 'pink', 'brown', 'gray', 'grey', 'transparent',
  'currentcolor', 'inherit', 'initial', 'unset',
]);

export function isValidJsonString(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

export function sanitizeString(value: string): string {
  return value
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && value > 0;
}

export function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && value >= 0;
}
