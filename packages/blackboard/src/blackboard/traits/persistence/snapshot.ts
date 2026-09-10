import type { Element } from '../../../types';

export function filterValidSnapshotElements(elements: unknown[]): Element[] {
  const validTools = new Set(['pen', 'eraser', 'highlighter', 'laser', 'line', 'rect', 'circle', 'arrow', 'diamond', 'text', 'image', 'katex']);
  return (elements as any[]).filter((el: any) => {
    if (!el || typeof el.id !== 'string' || !validTools.has(el.tool)) return false;
    if ((el.tool === 'pen' || el.tool === 'eraser' || el.tool === 'highlighter' || el.tool === 'laser') && !Array.isArray(el.points)) return false;
    if ((el.tool === 'line' || el.tool === 'rect' || el.tool === 'circle' || el.tool === 'arrow' || el.tool === 'diamond') && (!el.start || !el.end)) return false;
    if (el.tool === 'text' && (!el.position || typeof el.content !== 'string')) return false;
    if (el.tool === 'image' && (!el.position || typeof el.src !== 'string')) return false;
    if (el.tool === 'katex' && (!el.position || typeof el.latex !== 'string')) return false;
    return true;
  }) as Element[];
}