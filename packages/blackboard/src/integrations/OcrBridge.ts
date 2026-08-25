export interface OcrConfig {
  provider: 'mathpix' | 'tesseract' | 'mock';
  apiKey?: string;
  apiId?: string;
  endpoint?: string;
}

export interface OcrResult {
  latex: string;
  confidence: number;
  symbols: Array<{ latex: string; bbox: { x: number; y: number; w: number; h: number } }>;
}

export class OcrBridge {
  private config: OcrConfig;
  private tesseract: any = null;

  constructor(config: OcrConfig) {
    this.config = config;
    if (config.provider === 'mock') {
      console.warn('[OcrBridge] Mock OCR provider is active — not suitable for production use');
    }
  }

  async recognize(imageData: string | HTMLCanvasElement | Blob): Promise<OcrResult> {
    switch (this.config.provider) {
      case 'mathpix':
        return this.recognizeMathpix(imageData);
      case 'tesseract':
        return this.recognizeTesseract(imageData);
      case 'mock':
      default:
        return this.mockRecognize(imageData);
    }
  }

  private async recognizeMathpix(imageData: string | HTMLCanvasElement | Blob): Promise<OcrResult> {
    const { apiKey, apiId } = this.config;
    if (!apiKey || !apiId) throw new Error('Mathpix credentials not configured');

    const base64 = await this.toBase64(imageData);
    const resp = await fetch('https://api.mathpix.com/v3/text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'app_id': apiId,
        'app_key': apiKey,
      },
      body: JSON.stringify({
        src: `data:image/png;base64,${base64}`,
        formats: ['latex', 'latex_styled'],
        data_options: { include_asciimath: true, include_latex: true },
      }),
    });

    if (!resp.ok) throw new Error(`Mathpix error: ${resp.status}`);
    const data = await resp.json();

    return {
      latex: data.latex || data.latex_styled || '',
      confidence: data.confidence || 0,
      symbols: (data.symbols || []).map((s: any) => ({
        latex: s.latex || '',
        bbox: s.bbox || { x: 0, y: 0, w: 0, h: 0 },
      })),
    };
  }

  private async recognizeTesseract(imageData: string | HTMLCanvasElement | Blob): Promise<OcrResult> {
    if (!this.tesseract) {
      const { createWorker } = await import('tesseract.js');
      this.tesseract = await createWorker('eng');
    }

    const { data } = await this.tesseract.recognize(imageData);
    return {
      latex: data.text,
      confidence: data.confidence / 100,
      symbols: [],
    };
  }

  private mockRecognize(_imageData: string | HTMLCanvasElement | Blob): Promise<OcrResult> {
    const mockLatex = ['x = 5', 'y = 2x + 3', 'x^2 + y^2 = r^2', '\\int x dx = x^2/2 + C', '\\frac{dy}{dx} = 2x'];
    const random = mockLatex[Math.floor(Math.random() * mockLatex.length)];
    return Promise.resolve({
      latex: random,
      confidence: 0.95,
      symbols: [],
    });
  }

  private async toBase64(data: string | HTMLCanvasElement | Blob): Promise<string> {
    if (typeof data === 'string') return data.replace(/^data:image\/[^;]+;base64,/, '');
    if (data instanceof HTMLCanvasElement) return data.toDataURL('image/png').replace(/^data:image\/[^;]+;base64,/, '');
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).replace(/^data:image\/[^;]+;base64,/, ''));
      reader.readAsDataURL(data);
    });
  }

  async dispose(): Promise<void> {
    if (this.tesseract) {
      await this.tesseract.terminate();
      this.tesseract = null;
    }
  }
}