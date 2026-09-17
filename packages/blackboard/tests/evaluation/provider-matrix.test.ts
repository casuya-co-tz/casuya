import { describe, expect, it } from 'vitest';
import {
  OCR_PROVIDER_SPECS,
  RECOMMENDED_OFFLINE_FALLBACK,
  RECOMMENDED_PRODUCTION_PROVIDER,
} from '../../src/integrations/ocr-providers';

describe('OCR provider evaluation matrix (B-04)', () => {
  it('documents Mathpix as the production math provider', () => {
    const mathpix = OCR_PROVIDER_SPECS.mathpix;
    expect(mathpix.mathLatex).toBe(true);
    expect(mathpix.productionReady).toBe(true);
    expect(mathpix.requiresBackendProxy).toBe(true);
    expect(RECOMMENDED_PRODUCTION_PROVIDER).toBe('mathpix');
  });

  it('documents Tesseract as the offline plain-text fallback', () => {
    const tesseract = OCR_PROVIDER_SPECS.tesseract;
    expect(tesseract.offlineCapable).toBe(true);
    expect(tesseract.mathLatex).toBe(false);
    expect(RECOMMENDED_OFFLINE_FALLBACK).toBe('tesseract');
  });

  it('blocks mock from production sign-off', () => {
    expect(OCR_PROVIDER_SPECS.mock.productionReady).toBe(false);
  });

  it('documents the platform proxy as the client production path', () => {
    expect(OCR_PROVIDER_SPECS.proxy.productionReady).toBe(true);
    expect(OCR_PROVIDER_SPECS.proxy.requiresBackendProxy).toBe(true);
  });
});
