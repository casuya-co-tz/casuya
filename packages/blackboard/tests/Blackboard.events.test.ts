import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Blackboard } from '../src/Blackboard';

function makeEl(): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', { value: 800 });
  Object.defineProperty(el, 'clientHeight', { value: 600 });
  document.body.appendChild(el);
  return el;
}

describe('Blackboard event API', () => {
  let container: HTMLElement;
  let bb: Blackboard;

  beforeEach(() => {
    (globalThis as any).Path2D = class { constructor(_d?: string) {} };
    const proto = HTMLCanvasElement.prototype as any;
    proto.getContext = () => {
      const ctx: any = {
        scale() {}, clearRect() {}, fillRect() {}, beginPath() {}, moveTo() {},
        lineTo() {}, stroke() {}, fill() {}, arc() {}, save() {}, restore() {},
        setTransform() {}, drawImage() {}, fillText() {}, translate() {}, rotate() {},
        closePath() {},
      };
      ctx.fillStyle = ''; ctx.strokeStyle = ''; ctx.lineWidth = 1; ctx.globalAlpha = 1;
      return ctx;
    };
    container = makeEl();
    bb = new Blackboard({ container, width: 800, height: 600 });
  });

  afterEach(() => {
    bb.destroy();
    container.remove();
  });

  it('emits "change" when a stroke is committed via pointer events', () => {
    const changes: number[] = [];
    bb.on('change', (p) => changes.push(p.elements.length));
    const canvas = container.querySelectorAll('canvas')[1] as HTMLCanvasElement;
    const fire = (type: string, x: number, y: number) =>
      canvas.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, bubbles: true } as any));

    fire('pointerdown', 10, 10);
    fire('pointermove', 20, 20);
    fire('pointerup', 30, 30);

    expect(changes.length).toBe(1);
    expect(bb.getElements().length).toBe(1);
  });

  it('emits "undo"/"redo" and updates element count', () => {
    const canvas = container.querySelectorAll('canvas')[1] as HTMLCanvasElement;
    const fire = (type: string, x: number, y: number) =>
      canvas.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, bubbles: true } as any));
    fire('pointerdown', 10, 10);
    fire('pointermove', 20, 20);
    fire('pointerup', 30, 30);

    const events: string[] = [];
    bb.on('undo', () => events.push('undo'));
    bb.on('redo', () => events.push('redo'));
    bb.on('change', () => events.push('change'));

    bb.undo();
    expect(bb.getElements().length).toBe(0);
    bb.redo();
    expect(bb.getElements().length).toBe(1);

    expect(events).toContain('undo');
    expect(events).toContain('redo');
  });

  it('emits "clear" and "toolchange"', () => {
    const events: string[] = [];
    bb.on('clear', () => events.push('clear'));
    bb.on('toolchange', () => events.push('toolchange'));

    bb.setTool('rect');
    expect(events).toContain('toolchange');

    bb.clear();
    expect(events).toContain('clear');
    expect(bb.getElements().length).toBe(0);
  });

  it('stops calling a listener after off()', () => {
    let count = 0;
    const cb = () => count++;
    bb.on('change', cb);
    bb.off('change', cb);
    const canvas = container.querySelectorAll('canvas')[1] as HTMLCanvasElement;
    canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: 1, clientY: 1, bubbles: true } as any));
    canvas.dispatchEvent(new PointerEvent('pointerup', { clientX: 2, clientY: 2, bubbles: true } as any));
    expect(count).toBe(0);
  });
});
