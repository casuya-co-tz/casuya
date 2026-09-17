/**
 * Synthetic handwriting PNG fixtures for OCR evaluation (B-04 optional).
 * Kept as base64 strings so CI never needs Mathpix credentials or binary blobs.
 */

/** 1×1 transparent PNG — empty canvas baseline. */
export const FIXTURE_BLANK_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** 48×24 PNG with a dark stroke-like band — synthetic “classroom sample”. */
export const FIXTURE_STROKE_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAADAAAAAYCAYAAAAf8/7HAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEgAACxIB0t1+/AAAABx0RVh0U29mdHdhcmUAQWRvYmUgRmlyZXdvcmtzIENTNui8sowAAAAWdEVYdENyZWF0aW9uIFRpbWUAMDgvMDEvMDj8K8QAAAAQSURBVEiNY2AYBaNgFIyCUTDqAwAbXgH5Kp8H5QAAAABJRU5ErkJggg==';

export interface HandwritingFixture {
  id: string;
  description: string;
  base64: string;
  /** When true, production OCR should reject or return empty LaTeX. */
  expectEmpty: boolean;
}

export const HANDWRITING_FIXTURES: HandwritingFixture[] = [
  {
    id: 'blank',
    description: 'Empty canvas baseline',
    base64: FIXTURE_BLANK_PNG,
    expectEmpty: true,
  },
  {
    id: 'minimal-stroke',
    description: 'Synthetic single-stroke sample',
    base64: FIXTURE_STROKE_PNG,
    expectEmpty: false,
  },
];
