import type { BlackboardBase } from '../../base';

export function bringForward(bb: BlackboardBase): void {
    if (bb.selectedIds.size !== 1) return;
    const id = bb.selectedIds.values().next().value!;
    const idx = bb.elements.findIndex(e => e.id === id);
    if (idx < 0 || idx >= bb.elements.length - 1) return;
    bb.pushUndo();
    [bb.elements[idx], bb.elements[idx + 1]] = [bb.elements[idx + 1], bb.elements[idx]];
    bb.renderAll();
    bb.emit('change');
  }

export function sendBackward(bb: BlackboardBase): void {
    if (bb.selectedIds.size !== 1) return;
    const id = bb.selectedIds.values().next().value!;
    const idx = bb.elements.findIndex(e => e.id === id);
    if (idx <= 0) return;
    bb.pushUndo();
    [bb.elements[idx], bb.elements[idx - 1]] = [bb.elements[idx - 1], bb.elements[idx]];
    bb.renderAll();
    bb.emit('change');
  }

export function bringToFront(bb: BlackboardBase): void {
    if (bb.selectedIds.size !== 1) return;
    const id = bb.selectedIds.values().next().value!;
    const idx = bb.elements.findIndex(e => e.id === id);
    if (idx < 0 || idx >= bb.elements.length - 1) return;
    bb.pushUndo();
    const [el] = bb.elements.splice(idx, 1);
    bb.elements.push(el);
    bb.renderAll();
    bb.emit('change');
  }

export function sendToBack(bb: BlackboardBase): void {
    if (bb.selectedIds.size !== 1) return;
    const id = bb.selectedIds.values().next().value!;
    const idx = bb.elements.findIndex(e => e.id === id);
    if (idx <= 0) return;
    bb.pushUndo();
    const [el] = bb.elements.splice(idx, 1);
    bb.elements.unshift(el);
    bb.renderAll();
    bb.emit('change');
  }