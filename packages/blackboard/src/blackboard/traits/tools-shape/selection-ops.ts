import type { Element, ImageElement, Point, Shape, Stroke, TextElement } from '../../../types';
import type { BlackboardBase } from '../../base';
import { uid } from '../../../utils';
import { rotatePointAbout } from './geometry';

export function nudgeSelected(bb: BlackboardBase, dx: number, dy: number): void {
    if (bb.selectedIds.size === 0) return;
    bb.pushUndo();
    for (const id of bb.selectedIds) {
      const el = bb.elements.find(e => e.id === id);
      if (!el) continue;
    if (el.tool === 'pen' || el.tool === 'eraser' || el.tool === 'highlighter') {
        const s = el as Stroke;
        s.points = s.points.map(p => ({ x: p.x + dx, y: p.y + dy, pressure: p.pressure }));
      } else if (el.tool === 'text') {
        (el as TextElement).position = { x: (el as TextElement).position.x + dx, y: (el as TextElement).position.y + dy };
      } else if (el.tool === 'image') {
        (el as ImageElement).position = { x: (el as ImageElement).position.x + dx, y: (el as ImageElement).position.y + dy };
      } else {
        const s = el as Shape;
        s.start = { x: s.start.x + dx, y: s.start.y + dy };
        s.end = { x: s.end.x + dx, y: s.end.y + dy };
      }
    }
    bb.renderAll();
    bb.emit('change');
  }

export function duplicateSelected(bb: BlackboardBase): void {
    if (bb.selectedIds.size === 0) return;
    bb.pushUndo();
    const newIds = new Set<string>();
    const groupMap = new Map<string, string>();
    for (const id of bb.selectedIds) {
      const el = bb.elements.find(e => e.id === id);
      if (!el) continue;
      const clone = JSON.parse(JSON.stringify(el));
      clone.id = uid();
      if (el.groupId) {
        if (!groupMap.has(el.groupId)) groupMap.set(el.groupId, uid());
        clone.groupId = groupMap.get(el.groupId);
      } else {
        clone.groupId = undefined;
      }
      if ('start' in clone) { clone.start = { x: clone.start.x + 20, y: clone.start.y + 20 }; clone.end = { x: clone.end.x + 20, y: clone.end.y + 20 }; }
      if ('position' in clone) { clone.position = { x: clone.position.x + 20, y: clone.position.y + 20 }; }
      if ('points' in clone) { clone.points = clone.points.map((p: any) => ({ x: p.x + 20, y: p.y + 20, pressure: p.pressure })); }
      bb.elements.push(clone);
      newIds.add(clone.id);
    }
    bb.selectedIds = newIds;
    bb.renderAll();
    bb.emit('change');
  }

export function rotateSelected(bb: BlackboardBase, angle: number): void {
    if (bb.selectedIds.size === 0) return;
    bb.pushUndo();
    const ids = [...bb.selectedIds];
    if (ids.length === 1) {
      const el = bb.elements.find(e => e.id === ids[0]);
      if (el) el.rotation = ((el.rotation ?? 0) + angle) % (Math.PI * 2);
    } else {
      let cx = 0, cy = 0, count = 0;
      for (const id of ids) {
        const el = bb.elements.find(e => e.id === id);
        if (!el) continue;
        const b = bb.getLocalBounds(el);
        cx += b.x + b.w / 2;
        cy += b.y + b.h / 2;
        count++;
      }
      if (count > 0) { cx /= count; cy /= count; }
      const center: Point = { x: cx, y: cy };
      for (const id of ids) {
        const el = bb.elements.find(e => e.id === id);
        if (!el) continue;
        if (el.tool === 'pen' || el.tool === 'eraser' || el.tool === 'highlighter') {
          const s = el as Stroke;
          s.points = s.points.map(p => rotatePointAbout(p, center, angle));
        } else if (el.tool === 'text') {
          (el as TextElement).position = rotatePointAbout((el as TextElement).position, center, angle);
        } else if (el.tool === 'image') {
          (el as ImageElement).position = rotatePointAbout((el as ImageElement).position, center, angle);
        } else {
          const s = el as Shape;
          s.start = rotatePointAbout(s.start, center, angle);
          s.end = rotatePointAbout(s.end, center, angle);
        }
      }
    }
    bb.renderAll();
    bb.emit('change');
  }