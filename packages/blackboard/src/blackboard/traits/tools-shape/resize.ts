import type { ImageElement, Point, Shape } from '../../../types';
import type { BlackboardBase } from '../../base';

export function resizeSelected(bb: BlackboardBase, handle: string, currentWorld: Point): void {
    if (!bb.dragState) return;
    const origMap = new Map(bb.dragState.origElements.map(e => [e.id, e]));
    const rawDx = currentWorld.x - bb.dragState.startWorld.x;
    const rawDy = currentWorld.y - bb.dragState.startWorld.y;

    if (bb.selectedIds.size === 1) {
      const id = bb.selectedIds.values().next().value!;
      const el = bb.elements.find(e => e.id === id);
      const orig = origMap.get(id);
      if (!el || !orig) return;
      const rotation = el.rotation ?? 0;
      let dx = rawDx, dy = rawDy;
      if (rotation !== 0) {
        const cos = Math.cos(-rotation), sin = Math.sin(-rotation);
        dx = rawDx * cos - rawDy * sin; dy = rawDx * sin + rawDy * cos;
      }
      if (el.tool === 'pen' || el.tool === 'eraser' || el.tool === 'highlighter' || el.tool === 'text') {
        bb.moveSingleElement(el, orig, dx, dy);
        return;
      }
      if (el.tool === 'image') {
        const img = el as ImageElement, o = orig as ImageElement;
        let newX = o.position.x, newY = o.position.y, newW = o.width, newH = o.height;
        if (handle === 'nw') { newX = o.position.x + dx; newY = o.position.y + dy; newW = o.width - dx; newH = o.height - dy; }
        else if (handle === 'ne') { newY = o.position.y + dy; newW = o.width + dx; newH = o.height - dy; }
        else if (handle === 'sw') { newX = o.position.x + dx; newW = o.width - dx; newH = o.height + dy; }
        else if (handle === 'se') { newW = o.width + dx; newH = o.height + dy; }
        else if (handle === 'n') { newY = o.position.y + dy; newH = o.height - dy; }
        else if (handle === 's') { newH = o.height + dy; }
        else if (handle === 'e') { newW = o.width + dx; }
        else if (handle === 'w') { newX = o.position.x + dx; newW = o.width - dx; }
        if (newW > 0 && newH > 0) { img.position = { x: newX, y: newY }; img.width = newW; img.height = newH; }
        return;
      }
      const s = el as Shape, o = orig as Shape;
      let ns = { x: o.start.x, y: o.start.y }, ne = { x: o.end.x, y: o.end.y };
      if (handle === 'nw') { ns.x = o.start.x + dx; ns.y = o.start.y + dy; }
      if (handle === 'ne') { ne.x = o.end.x + dx; ns.y = o.start.y + dy; }
      if (handle === 'sw') { ns.x = o.start.x + dx; ne.y = o.end.y + dy; }
      if (handle === 'se') { ne.x = o.end.x + dx; ne.y = o.end.y + dy; }
      if (handle === 'n') { ns.y = o.start.y + dy; }
      if (handle === 's') { ne.y = o.end.y + dy; }
      if (handle === 'e') { ne.x = o.end.x + dx; }
      if (handle === 'w') { ns.x = o.start.x + dx; }
      if (ns.x > ne.x) { const t = ns.x; ns.x = ne.x; ne.x = t; }
      if (ns.y > ne.y) { const t = ns.y; ns.y = ne.y; ne.y = t; }
      if (Math.abs(ne.x - ns.x) < 5 || Math.abs(ne.y - ns.y) < 5) return;
      s.start = ns; s.end = ne;
      return;
    }

    let origMinX = Infinity, origMinY = Infinity, origMaxX = -Infinity, origMaxY = -Infinity;
    for (const id of bb.selectedIds) {
      const orig = origMap.get(id);
      if (!orig) continue;
      const b = bb.getLocalBounds(orig);
      if (b.x < origMinX) origMinX = b.x;
      if (b.y < origMinY) origMinY = b.y;
      if (b.x + b.w > origMaxX) origMaxX = b.x + b.w;
      if (b.y + b.h > origMaxY) origMaxY = b.y + b.h;
    }
    if (origMinX === Infinity) return;
    const origW = origMaxX - origMinX, origH = origMaxY - origMinY;
    const origCX = origMinX + origW / 2, origCY = origMinY + origH / 2;
    let scaleX = 1, scaleY = 1;
    if (handle.includes('e') || handle === 'ne' || handle === 'se') scaleX = Math.max(0.1, (origW + rawDx) / origW);
    if (handle.includes('w') || handle === 'nw' || handle === 'sw') scaleX = Math.max(0.1, (origW - rawDx) / origW);
    if (handle === 'n' || handle === 'nw' || handle === 'ne') scaleY = Math.max(0.1, (origH - rawDy) / origH);
    if (handle === 's' || handle === 'sw' || handle === 'se') scaleY = Math.max(0.1, (origH + rawDy) / origH);

    for (const id of bb.selectedIds) {
      const el = bb.elements.find(e => e.id === id);
      const orig = origMap.get(id);
      if (!el || !orig) continue;
      const ob = bb.getLocalBounds(orig);
      const newCX = origCX + (ob.x + ob.w / 2 - origCX) * scaleX;
      const newCY = origCY + (ob.y + ob.h / 2 - origCY) * scaleY;
      const newW = ob.w * scaleX;
      const newH = ob.h * scaleY;
      const dx = newCX - (ob.x + ob.w / 2);
      const dy = newCY - (ob.y + ob.h / 2);
      if (el.tool === 'pen' || el.tool === 'eraser' || el.tool === 'highlighter' || el.tool === 'text') {
        bb.moveSingleElement(el, orig, dx, dy);
        continue;
      }
      if (el.tool === 'image') {
        const img = el as ImageElement, o = orig as ImageElement;
        const nw = o.width * scaleX, nh = o.height * scaleY;
        if (nw > 0 && nh > 0) { img.position = { x: o.position.x + dx, y: o.position.y + dy }; img.width = nw; img.height = nh; }
        continue;
      }
      const s = el as Shape, o = orig as Shape;
      const ns = { x: o.start.x + dx, y: o.start.y + dy };
      const ne = { x: o.end.x + dx, y: o.end.y + dy };
      s.start = ns; s.end = ne;
    }
  }