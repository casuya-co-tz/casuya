import type { Tool, Point, Camera, Stroke, Shape, LaTeXElement, TextElement, ImageElement, GraphConfig, BlackboardOptions, Element, Snapshot, BlackboardEvent, BlackboardEventCallback, ToolbarElements, BlackboardAPI, BoundingBox, Viewport, SelectionBox, CollabUser, CollabState, CollabAdapter } from '../../types';
import { IS_MOBILE, uid, isInInput } from '../../utils';
import { THEMES, MOBILE_STYLES, injectMobileStyles } from '../../theme';
import { createToolbar, updateToolbarState } from '../../toolbar';
import { BlackboardBase, Constructor } from '../base';

export const CollabMixin = <T extends Constructor<BlackboardBase>>(Base: T) => class CollabTrait extends Base {
drawRemoteCursors(ctx: CanvasRenderingContext2D): void {
    for (const [userId, data] of this.remoteCursors) {
      const { user, cursor } = data;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cursor.x, cursor.y, 4 / this.camera.zoom, 0, Math.PI * 2);
      ctx.fillStyle = user.color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5 / this.camera.zoom;
      ctx.stroke();
      ctx.font = `${10 / this.camera.zoom}px system-ui, sans-serif`;
      ctx.fillStyle = user.color;
      ctx.fillText(user.name, cursor.x + 8 / this.camera.zoom, cursor.y - 4 / this.camera.zoom);
      ctx.restore();
    }
  }

getCollabState(): CollabState | null { return this.collabState; }

connectCollaboration(adapter: CollabAdapter, roomId: string, userName: string): void {
    this.collabAdapter = adapter;
    const userId = uid();
    const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const user: CollabUser = { id: userId, name: userName, color };
    adapter.connect(roomId, user);
    adapter.onElementsUpdate((elements) => {
      this.elements = elements;
      this.renderAll();
      this.emit('change');
    });
    adapter.onCursorUpdate((uid, cursor) => {
      const u = this.collabState?.users.find(u => u.id === uid);
      if (u) this.remoteCursors.set(uid, { user: u, cursor });
      this.flushLive();
    });
    adapter.onUserJoin((u) => {
      if (this.collabState) this.collabState.users.push(u);
      this.showToast(`${u.name} joined`);
    });
    adapter.onUserLeave((uid) => {
      if (this.collabState) this.collabState.users = this.collabState.users.filter(u => u.id !== uid);
      this.remoteCursors.delete(uid);
      this.flushLive();
    });
    this.collabState = { connected: true, roomId, users: [user], localUser: user };
    this.showToast('Connected to collaboration room');
  }

disconnectCollaboration(): void {
    this.collabAdapter?.disconnect();
    this.collabAdapter = null;
    this.collabState = null;
    this.remoteCursors.clear();
    this.flushLive();
  }

};
