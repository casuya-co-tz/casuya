export interface MathConfig {
  apiBase?: string;
  katexOptions?: Record<string, unknown>;
}

export interface SolveResult {
  steps: string[];
  solution: string;
  latex: string;
}

export class MathBridge {
  private config: MathConfig;
  private katex: any = null;
  private mathjs: any = null;

  constructor(config: MathConfig = {}) {
    this.config = config;
  }

  async loadKatex(): Promise<void> {
    if (this.katex) return;
    try {
      this.katex = await import('katex');
    } catch {
      throw new Error('KaTeX not available. Install katex package.');
    }
  }

  private async loadMathjs(): Promise<any> {
    if (this.mathjs) return this.mathjs;
    try {
      this.mathjs = await import('mathjs');
      return this.mathjs;
    } catch {
      return null;
    }
  }

  async renderToHtml(latex: string): Promise<string> {
    await this.loadKatex();
    return this.katex.renderToString(latex, {
      throwOnError: false,
      displayMode: true,
      ...this.config.katexOptions,
    });
  }

  async renderToDom(latex: string, element: HTMLElement): Promise<void> {
    await this.loadKatex();
    this.katex.render(latex, element, {
      throwOnError: false,
      displayMode: true,
      ...this.config.katexOptions,
    });
  }

  async getDimensions(latex: string): Promise<{ width: number; height: number }> {
    await this.loadKatex();
    const html = this.katex.renderToString(latex, { throwOnError: false, displayMode: true });
    const div = document.createElement('div');
    div.style.cssText = 'position:absolute;left:-9999px;visibility:hidden;';
    div.innerHTML = html;
    document.body.appendChild(div);
    const rect = div.firstElementChild?.getBoundingClientRect() ?? { width: 0, height: 0 };
    document.body.removeChild(div);
    return { width: rect.width, height: rect.height };
  }

  async solveEquation(equation: string): Promise<SolveResult> {
    if (this.config.apiBase) {
      try {
        const resp = await fetch(`${this.config.apiBase}/math/solve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ equation }),
        });
        if (resp.ok) return await resp.json();
      } catch { /* fall back */ }
    }
    return this.localSolve(equation);
  }

  async checkEquivalence(expr1: string, expr2: string): Promise<{ equivalent: boolean; confidence: number }> {
    if (this.config.apiBase) {
      try {
        const resp = await fetch(`${this.config.apiBase}/math/equivalence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expr1, expr2 }),
        });
        if (resp.ok) return await resp.json();
      } catch { /* fall back */ }
    }
    return this.localEquivalence(expr1, expr2);
  }

  private async localSolve(equation: string): Promise<SolveResult> {
    const math = await this.loadMathjs();
    if (!math) {
      return { steps: [equation], solution: this.fallbackSolve(equation), latex: equation };
    }
    try {
      const cleaned = equation.replace(/\s+/g, '');
      const eqParts = cleaned.split('=');
      if (eqParts.length === 2) {
        const [lhs, rhs] = eqParts;
        const expr = math.parse(`${lhs} - (${rhs})`);
        const simplified = math.simplify(expr);
        const node = simplified.isNode ? simplified : math.node(simplified);
        if (node.isConstantNode) {
          const val = node.evaluate();
          return {
            steps: [equation, `Evaluate: ${val}`],
            solution: String(val),
            latex: String(val),
          };
        }
        return {
          steps: [equation, `Simplified: ${simplified.toString()} = 0`],
          solution: simplified.toString(),
          latex: simplified.toTex(),
        };
      }
      const parsed = math.parse(equation);
      const simplified = math.simplify(parsed);
      return {
        steps: [equation, simplified.toString()],
        solution: simplified.toString(),
        latex: simplified.toTex(),
      };
    } catch {
      return { steps: [equation], solution: this.fallbackSolve(equation), latex: equation };
    }
  }

  private async localEquivalence(expr1: string, expr2: string): Promise<{ equivalent: boolean; confidence: number }> {
    const math = await this.loadMathjs();
    if (!math) {
      const norm1 = expr1.replace(/\s+/g, '').toLowerCase();
      const norm2 = expr2.replace(/\s+/g, '').toLowerCase();
      return { equivalent: norm1 === norm2, confidence: norm1 === norm2 ? 0.8 : 0.2 };
    }
    try {
      const norm1 = expr1.replace(/\s+/g, '').toLowerCase();
      const norm2 = expr2.replace(/\s+/g, '').toLowerCase();
      if (norm1 === norm2) return { equivalent: true, confidence: 1.0 };
      const e1 = math.parse(expr1);
      const e2 = math.parse(expr2);
      const s1 = math.simplify(e1).toString();
      const s2 = math.simplify(e2).toString();
      if (s1 === s2) return { equivalent: true, confidence: 0.95 };
      return { equivalent: false, confidence: 0.3 };
    } catch {
      const norm1 = expr1.replace(/\s+/g, '').toLowerCase();
      const norm2 = expr2.replace(/\s+/g, '').toLowerCase();
      return { equivalent: norm1 === norm2, confidence: norm1 === norm2 ? 0.8 : 0.2 };
    }
  }

  private fallbackSolve(equation: string): string {
    const cleaned = equation.replace(/\s+/g, '');
    const parts = cleaned.split('=');
    if (parts.length === 2) {
      try {
        const a = parseFloat(parts[0]);
        const b = parseFloat(parts[1]);
        if (!isNaN(a) && !isNaN(b)) return String(a - b);
      } catch { /* ignore */ }
    }
    return 'Unable to solve';
  }

  latexToText(latex: string): string {
    return latex
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
      .replace(/\\sqrt\{([^}]+)\}/g, 'sqrt($1)')
      .replace(/\\cdot/g, '\u00b7')
      .replace(/\\times/g, '\u00d7')
      .replace(/\\div/g, '\u00f7')
      .replace(/\\leq/g, '\u2264')
      .replace(/\\geq/g, '\u2265')
      .replace(/\\neq/g, '\u2260')
      .replace(/\\pm/g, '\u00b1')
      .replace(/\\infty/g, '\u221e')
      .replace(/\^\{([^}]+)\}/g, '^($1)')
      .replace(/_\{([^}]+)\}/g, '_($1)')
      .replace(/\{|\}/g, '');
  }
}
