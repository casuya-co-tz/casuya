import type { TextElement } from '../../../types';

export function drawTextOnContext(ctx: CanvasRenderingContext2D, el: TextElement): void {
  ctx.fillStyle = el.color;
  ctx.font = `${el.fontSize}px ${el.fontFamily}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const maxWidth = el.width > 1 ? el.width : 300;
  const rawLines = el.content.split('\n');
  const wrappedLines: string[] = [];
  for (const rawLine of rawLines) {
    if (rawLine === '') { wrappedLines.push(''); continue; }
    const words = rawLine.split(' ');
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? currentLine + ' ' + word : word;
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        wrappedLines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    wrappedLines.push(currentLine);
  }
  const lineHeight = el.fontSize * 1.4;
  for (let i = 0; i < wrappedLines.length; i++) {
    ctx.fillText(wrappedLines[i], el.position.x, el.position.y + i * lineHeight);
  }
}