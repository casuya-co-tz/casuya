declare module 'mathjs' {
  interface MathNode {
    type: string;
    isNode: true;
    toString(): string;
    toTex(): string;
    compile(): { evaluate: (scope?: Record<string, unknown>) => number };
  }

  interface MathType {
    parse(expr: string): MathNode;
    simplify(expr: MathNode | string, rules?: unknown[]): MathNode;
    evaluate(expr: MathNode | string | number, scope?: Record<string, unknown>): number;
    subtract(a: MathNode | number, b: MathNode | number): MathNode;
    add(a: MathNode | number, b: MathNode | number): MathNode;
    multiply(a: MathNode | number, b: MathNode | number): MathNode;
    divide(a: MathNode | number, b: MathNode | number): MathNode;
    pow(a: MathNode | number, b: MathNode | number): MathNode;
    equal(a: MathNode | number, b: MathNode | number): boolean;
    smaller(a: MathNode | number, b: MathNode | number): boolean;
    larger(a: MathNode | number, b: MathNode | number): boolean;
  }

  const math: MathType;
  export default math;
  export function parse(expr: string): MathNode;
  export function simplify(expr: MathNode | string, rules?: unknown[]): MathNode;
  export function evaluate(expr: MathNode | string | number, scope?: Record<string, unknown>): number;
  export function subtract(a: MathNode | number, b: MathNode | number): MathNode;
}
