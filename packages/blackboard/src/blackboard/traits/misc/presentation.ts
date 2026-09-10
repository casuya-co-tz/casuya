import type { BlackboardBase } from '../../base';

export function startPresentation(bb: BlackboardBase): void {
    if (bb.elements.length === 0) return;
    bb.presenterMode = true;
    bb.presenterStep = 0;
    bb.showPresenterView();
    bb.showToast('Presentation mode — use arrow keys or click to advance');
  }

export function stopPresentation(bb: BlackboardBase): void {
    bb.presenterMode = false;
    bb.presenterStep = 0;
    if (bb.presenterOverlay) { bb.presenterOverlay.remove(); bb.presenterOverlay = null; }
    bb.renderAll();
  }

export function isPresenting(bb: BlackboardBase): boolean { return bb.presenterMode; }

export function presentNext(bb: BlackboardBase): void {
    if (!bb.presenterMode) return;
    if (bb.presenterStep < bb.elements.length - 1) {
      bb.presenterStep++;
      bb.showPresenterView();
    } else {
      bb.showToast('End of presentation');
    }
  }

export function presentPrev(bb: BlackboardBase): void {
    if (!bb.presenterMode) return;
    if (bb.presenterStep > 0) {
      bb.presenterStep--;
      bb.showPresenterView();
    }
  }

export function showPresenterView(bb: BlackboardBase): void {
    if (!bb.presenterOverlay) {
      bb.presenterOverlay = document.createElement('div');
      bb.presenterOverlay.style.cssText = 'position:fixed;inset:0;z-index:3000;background:#000;display:flex;align-items:center;justify-content:center;';
      bb.presenterOverlay.addEventListener('click', (e) => {
        if (e.target === bb.presenterOverlay) bb.presentNext();
      });
      bb.presenterOverlay.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === ' ') bb.presentNext();
        else if (e.key === 'ArrowLeft') bb.presentPrev();
        else if (e.key === 'Escape') bb.stopPresentation();
      });
      document.body.appendChild(bb.presenterOverlay);
      bb.presenterOverlay.tabIndex = 0;
      bb.presenterOverlay.focus();
    }
    const visible = bb.elements.slice(0, bb.presenterStep + 1);
    const c = document.createElement('canvas');
    c.width = bb.width * bb.dpr;
    c.height = bb.height * bb.dpr;
    c.style.cssText = 'max-width:95vw;max-height:90vh;object-fit:contain;';
    const ctx = c.getContext('2d')!;
    ctx.scale(bb.dpr, bb.dpr);
    ctx.fillStyle = '#1e1e2e';
    ctx.fillRect(0, 0, bb.width, bb.height);
    for (const el of visible) bb.drawElement(ctx, el);
    bb.presenterOverlay.innerHTML = '';
    bb.presenterOverlay.appendChild(c);
    const counter = document.createElement('div');
    counter.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);color:#888;font:14px system-ui;background:rgba(0,0,0,0.5);padding:4px 12px;border-radius:8px;';
    counter.textContent = `${bb.presenterStep + 1} / ${bb.elements.length}`;
    bb.presenterOverlay.appendChild(counter);
  }