// modules/teacher/utils.js — shared utilities for teacher dashboard views

function renderBlackboardReplay(elements) {
  if (window.ensureKaTeX && !window.katex) window.ensureKaTeX();
  const canvas = document.getElementById("bb-replay-canvas");
  if (!canvas || !elements.length) return;
  const ctx = canvas.getContext("2d");
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  elements.forEach(el => {
    if ((el.tool === "pen" || el.tool === "highlighter" || el.tool === "eraser") && el.points) {
      el.points.forEach(p => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
    } else if (el.tool === "text" || el.tool === "katex") {
      const px = el.position?.x || 0, py = el.position?.y || 0;
      minX = Math.min(minX, px); minY = Math.min(minY, py);
      maxX = Math.max(maxX, px + (el.width || 300)); maxY = Math.max(maxY, py + (el.fontSize || 16) * 2);
    } else if (el.start && el.end) {
      minX = Math.min(minX, el.start.x, el.end.x); minY = Math.min(minY, el.start.y, el.end.y);
      maxX = Math.max(maxX, el.start.x, el.end.x); maxY = Math.max(maxY, el.start.y, el.end.y);
    }
  });
  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 800; maxY = 600; }
  const pad = 40;
  const w = maxX - minX + pad * 2;
  const h = maxY - minY + pad * 2;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.translate(-minX + pad, -minY + pad);
  elements.forEach(el => {
    ctx.save();
    ctx.globalAlpha = el.opacity ?? 1;
    if (el.tool === "pen" || el.tool === "highlighter" || el.tool === "eraser") {
      if (el.tool === "eraser") { ctx.globalCompositeOperation = "destination-out"; ctx.strokeStyle = "rgba(0,0,0,1)"; }
      else if (el.tool === "highlighter") { ctx.globalCompositeOperation = "multiply"; ctx.strokeStyle = el.color; }
      else { ctx.globalCompositeOperation = "source-over"; ctx.strokeStyle = el.color; }
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      const pts = el.points || [];
      if (pts.length < 2) { ctx.restore(); return; }
      const hasPressure = pts.some(p => p.pressure !== undefined && p.pressure !== 0.5);
      if (hasPressure && el.tool === "pen") {
        for (let i = 1; i < pts.length; i++) {
          const prev = pts[i - 1], curr = pts[i];
          ctx.lineWidth = (el.width || 2) * (0.3 + (curr.pressure ?? 0.5) * 1.4);
          ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(curr.x, curr.y); ctx.stroke();
        }
      } else {
        ctx.lineWidth = el.width || 2;
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          const prev = pts[i - 1], curr = pts[i];
          ctx.quadraticCurveTo(prev.x, prev.y, (prev.x + curr.x) / 2, (prev.y + curr.y) / 2);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y); ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
    } else if (el.tool === "text") {
      ctx.fillStyle = el.color || "#000";
      ctx.font = `${el.fontSize || 16}px ${el.fontFamily || "sans-serif"}`;
      ctx.textAlign = "left"; ctx.textBaseline = "top";
      const maxW = el.width > 1 ? el.width : 300;
      const lines = (el.content || "").split("\n");
      const lineH = (el.fontSize || 16) * 1.4;
      let lineIdx = 0;
      lines.forEach((line) => {
        if (!line) return;
        const words = line.split(" ");
        let cur = "";
        words.forEach(word => {
          const test = cur ? cur + " " + word : word;
          if (ctx.measureText(test).width > maxW && cur) { ctx.fillText(cur, el.position.x, el.position.y + lineIdx * lineH); cur = word; lineIdx++; }
          else cur = test;
        });
        if (cur) ctx.fillText(cur, el.position.x, el.position.y + lineIdx * lineH);
        lineIdx++;
      });
    } else if (el.tool === "katex") {
      if (window.katex) {
        try {
          const html = window.katex.renderToString(el.latex || "", { throwOnError: false, displayMode: true });
          const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${(el.fontSize || 16) * (el.latex || "").length * 0.6}" height="${(el.fontSize || 16) * 1.8}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="font-size:${el.fontSize || 16}px;color:${el.color || "#000"};white-space:nowrap;">${html}</div></foreignObject></svg>`;
          const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const img = new Image();
          img.onload = () => { ctx.drawImage(img, el.position.x, el.position.y, el.width || img.naturalWidth, el.height || img.naturalHeight); URL.revokeObjectURL(url); };
          img.src = url;
        } catch { ctx.fillStyle = el.color || "#000"; ctx.font = `${el.fontSize || 16}px "Courier New", monospace`; ctx.fillText(el.latex || "", el.position.x, el.position.y); }
      } else {
        ctx.fillStyle = el.color || "#000"; ctx.font = `${el.fontSize || 16}px "Courier New", monospace`;
        ctx.fillText(el.latex || "", el.position.x, el.position.y);
      }
    } else if (el.start && el.end) {
      ctx.strokeStyle = el.color || "#000"; ctx.lineWidth = el.width || 2; ctx.lineCap = "round";
      if (el.dashPattern) ctx.setLineDash(el.dashPattern);
      switch (el.tool) {
        case "line": ctx.beginPath(); ctx.moveTo(el.start.x, el.start.y); ctx.lineTo(el.end.x, el.end.y); ctx.stroke(); break;
        case "rect": {
          const rx = Math.min(el.start.x, el.end.x), ry = Math.min(el.start.y, el.end.y);
          const rw = Math.abs(el.end.x - el.start.x), rh = Math.abs(el.end.y - el.start.y);
          if (el.filled) { ctx.fillStyle = el.color; ctx.globalAlpha = 0.25 * (el.opacity ?? 1); ctx.fillRect(rx, ry, rw, rh); ctx.globalAlpha = el.opacity ?? 1; }
          ctx.strokeRect(rx, ry, rw, rh); break;
        }
        case "circle": {
          const cx = (el.start.x + el.end.x) / 2, cy = (el.start.y + el.end.y) / 2;
          const rrx = Math.abs(el.end.x - el.start.x) / 2, rry = Math.abs(el.end.y - el.start.y) / 2;
          ctx.beginPath(); ctx.ellipse(cx, cy, rrx, rry, 0, 0, Math.PI * 2);
          if (el.filled) { ctx.fillStyle = el.color; ctx.globalAlpha = 0.25 * (el.opacity ?? 1); ctx.fill(); ctx.globalAlpha = el.opacity ?? 1; }
          ctx.stroke(); break;
        }
        case "arrow": {
          const dx = el.end.x - el.start.x, dy = el.end.y - el.start.y, len = Math.hypot(dx, dy);
          if (len > 1) {
            ctx.beginPath(); ctx.moveTo(el.start.x, el.start.y); ctx.lineTo(el.end.x, el.end.y); ctx.stroke();
            const headLen = Math.min(15, len * 0.3), angle = Math.atan2(dy, dx);
            ctx.beginPath(); ctx.moveTo(el.end.x, el.end.y);
            ctx.lineTo(el.end.x - headLen * Math.cos(angle - Math.PI / 6), el.end.y - headLen * Math.sin(angle - Math.PI / 6));
            ctx.moveTo(el.end.x, el.end.y);
            ctx.lineTo(el.end.x - headLen * Math.cos(angle + Math.PI / 6), el.end.y - headLen * Math.sin(angle + Math.PI / 6));
            ctx.stroke();
          }
          break;
        }
      }
      if (el.dashPattern) ctx.setLineDash([]);
    }
    ctx.restore();
  });
}
