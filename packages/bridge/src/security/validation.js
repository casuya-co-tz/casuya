/** Structural validation of a decoded lesson package before rendering. */

import { ValidationError } from '../core/errors.js';

const REQUIRED_FILES = ['body.html', 'manifest.json'];

export function validatePackageShape(files) {
  const errors = [];
  for (const required of REQUIRED_FILES) {
    if (!(required in files)) errors.push(`Missing required file: ${required}`);
  }
  if (files['manifest.json']) {
    try {
      JSON.parse(files['manifest.json']);
    } catch {
      errors.push('manifest.json is not valid JSON');
    }
  }
  return { isValid: errors.length === 0, errors };
}

export function validatePackageShapeOrThrow(files) {
  const result = validatePackageShape(files);
  if (!result.isValid) {
    throw new ValidationError(`Invalid package: ${result.errors.join('; ')}`);
  }
  return result;
}
