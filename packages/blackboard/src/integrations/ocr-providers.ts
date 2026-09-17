/** Provider capability matrix used for production OCR selection (B-04). */

export type OcrProviderId = 'mathpix' | 'tesseract' | 'mock' | 'proxy';

export interface OcrProviderSpec {
  id: OcrProviderId;
  label: string;
  mathLatex: boolean;
  offlineCapable: boolean;
  productionReady: boolean;
  requiresBackendProxy: boolean;
  notes: string;
}

export const OCR_PROVIDER_SPECS: Record<OcrProviderId, OcrProviderSpec> = {
  mathpix: {
    id: 'mathpix',
    label: 'Mathpix',
    mathLatex: true,
    offlineCapable: false,
    productionReady: true,
    requiresBackendProxy: true,
    notes: 'Best for handwritten equations; credentials must stay server-side.',
  },
  tesseract: {
    id: 'tesseract',
    label: 'Tesseract.js',
    mathLatex: false,
    offlineCapable: true,
    productionReady: true,
    requiresBackendProxy: false,
    notes: 'Plain text only; large WASM bundle; acceptable for labels and short answers.',
  },
  mock: {
    id: 'mock',
    label: 'Mock',
    mathLatex: true,
    offlineCapable: true,
    productionReady: false,
    requiresBackendProxy: false,
    notes: 'Development and unit tests only.',
  },
  proxy: {
    id: 'proxy',
    label: 'Platform proxy',
    mathLatex: true,
    offlineCapable: false,
    productionReady: true,
    requiresBackendProxy: true,
    notes: 'Client calls POST /v1/ocr/handwriting; Mathpix credentials stay on the platform.',
  },
};

export const RECOMMENDED_PRODUCTION_PROVIDER: OcrProviderId = 'mathpix';
export const RECOMMENDED_OFFLINE_FALLBACK: OcrProviderId = 'tesseract';
