import type { Lesson, ExportOptions, Slide, ComponentData, ComponentStyle } from '../types.js';
import { ComponentType } from '../types.js';

const DEFAULT_OPTIONS: ExportOptions = {
  pretty: true,
  includeMetadata: true,
  version: '1.0.0',
};

export class HtmlExporter {
  static export(lesson: Lesson, options?: Partial<ExportOptions>): string {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const lines: string[] = [];

    lines.push('<!DOCTYPE html>');
    lines.push('<html lang="en">');
    lines.push('<head>');
    lines.push('  <meta charset="UTF-8">');
    lines.push('  <meta name="viewport" content="width=device-width, initial-scale=1.0">');
    lines.push(`  <title>${HtmlExporter.escapeHtml(lesson.title)}</title>`);

    if (opts.includeMetadata) {
      lines.push(`  <meta name="description" content="${HtmlExporter.escapeHtml(lesson.description)}">`);
      lines.push(`  <meta name="author" content="${HtmlExporter.escapeHtml(lesson.metadata.author)}">`);
    }

    if (opts.includeMetadata) {
      lines.push(`  <meta name="subject" content="${HtmlExporter.escapeHtml(lesson.metadata.category || 'General')}">`);
      lines.push(`  <meta name="topic" content="${HtmlExporter.escapeHtml(lesson.metadata.category || '')}">`);
      lines.push(`  <meta name="difficulty" content="${HtmlExporter.escapeHtml(lesson.metadata.difficulty)}">`);
      lines.push(`  <meta name="language" content="${HtmlExporter.escapeHtml(lesson.metadata.language)}">`);
      lines.push(`  <meta name="duration" content="${lesson.metadata.estimatedMinutes}">`);
      lines.push(`  <meta name="grade_level" content="${HtmlExporter.escapeHtml('')}">`);
      lines.push(`  <meta name="keywords" content="${HtmlExporter.escapeHtml(lesson.metadata.tags.join(', '))}">`);
      lines.push(`  <meta name="prerequisites" content="${HtmlExporter.escapeHtml('')}">`);
      lines.push(`  <meta name="learning_objectives" content="${HtmlExporter.escapeHtml('')}">`);
    }

    lines.push('  <style>');
    lines.push(HtmlExporter.generateStyles(lesson));
    lines.push('  </style>');
    lines.push('</head>');
    lines.push('<body>');

    for (const slide of lesson.slides) {
      lines.push(HtmlExporter.generateSlideHtml(slide, lesson));
    }

    lines.push('</body>');
    lines.push('</html>');

    return lines.join('\n');
  }

  private static generateStyles(lesson: Lesson): string {
    const theme = lesson.theme;
    return [
      '* { margin: 0; padding: 0; box-sizing: border-box; }',
      'body { font-family: ' + theme.bodyFont + '; color: ' + theme.textColor + '; }',
      '.slide { width: 100%; min-height: 100vh; padding: 40px; display: flex; flex-direction: column; justify-content: center; border-bottom: 2px solid #e5e7eb; position: relative; }',
      '.slide-title { font-family: ' + theme.headingFont + '; font-size: 2.5rem; margin-bottom: 24px; color: ' + theme.primaryColor + '; }',
      '.slide-content { font-size: 1.25rem; line-height: 1.8; max-width: 800px; }',
      '.component { position: relative; margin: 16px 0; }',
      '.component img { max-width: 100%; border-radius: ' + theme.borderRadius + 'px; }',
      '.component video { max-width: 100%; border-radius: ' + theme.borderRadius + 'px; }',
      '.quiz { background: #f9fafb; padding: 24px; border-radius: ' + theme.borderRadius + 'px; border: 1px solid #e5e7eb; }',
      '.quiz-title { font-size: 1.5rem; font-weight: bold; margin-bottom: 16px; }',
      '.quiz-question { margin-bottom: 16px; padding: 12px; background: white; border-radius: 8px; }',
      '.quiz-option { display: block; margin: 8px 0; padding: 8px 12px; background: white; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer; }',
      '.form { background: #f9fafb; padding: 24px; border-radius: ' + theme.borderRadius + 'px; }',
      '.form-title { font-size: 1.5rem; font-weight: bold; margin-bottom: 16px; }',
      '.form-field { margin-bottom: 16px; }',
      '.form-field label { display: block; font-weight: 600; margin-bottom: 4px; }',
      '.form-field input, .form-field textarea, .form-field select { width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 1rem; }',
      '.form-submit { background: ' + theme.primaryColor + '; color: white; padding: 12px 24px; border: none; border-radius: ' + theme.borderRadius + 'px; font-size: 1rem; cursor: pointer; }',
      '@media print { .slide { min-height: auto; page-break-after: always; } }',
    ].join('\n    ');
  }

  private static generateSlideHtml(slide: Slide, lesson: Lesson): string {
    const lines: string[] = [];
    const bgStyle = slide.backgroundColor !== '#ffffff'
      ? ` style="background-color: ${slide.backgroundColor}"`
      : '';

    lines.push(`  <section class="slide" data-slide-id="${slide.id}"${bgStyle}>`);

    if (slide.layout === 'title' || slide.title) {
      lines.push(`    <h1 class="slide-title">${HtmlExporter.escapeHtml(slide.title)}</h1>`);
    }

    lines.push('    <div class="slide-content">');
    for (const component of slide.components) {
      lines.push(HtmlExporter.generateComponentHtml(component, lesson.theme));
    }
    lines.push('    </div>');
    lines.push('  </section>');

    return lines.join('\n');
  }

  private static generateComponentHtml(component: ComponentData, theme: Lesson['theme']): string {
    switch (component.type) {
      case ComponentType.Text:
        return HtmlExporter.generateTextHtml(component);
      case ComponentType.Image:
        return HtmlExporter.generateImageHtml(component);
      case ComponentType.Video:
        return HtmlExporter.generateVideoHtml(component);
      case ComponentType.Audio:
        return HtmlExporter.generateAudioHtml(component);
      case ComponentType.Quiz:
        return HtmlExporter.generateQuizHtml(component);
      case ComponentType.Form:
        return HtmlExporter.generateFormHtml(component);
      case ComponentType.Container:
        return HtmlExporter.generateContainerHtml(component, theme);
      default:
        return '';
    }
  }

  private static generateTextHtml(component: ComponentData & { content?: string }): string {
    const content = component.content ?? '';
    const style = HtmlExporter.buildStyleString(component.style);
    return `      <div class="component" style="${style}">${HtmlExporter.escapeHtml(content)}</div>`;
  }

  private static generateImageHtml(component: ComponentData & { src?: string; alt?: string; caption?: string }): string {
    const src = component.src ?? '';
    const alt = component.alt ?? '';
    const caption = component.caption ?? '';
    const style = HtmlExporter.buildStyleString(component.style);
    const captionHtml = caption ? `<figcaption>${HtmlExporter.escapeHtml(caption)}</figcaption>` : '';
    return `      <figure class="component" style="${style}"><img src="${HtmlExporter.escapeHtml(src)}" alt="${HtmlExporter.escapeHtml(alt)}">${captionHtml}</figure>`;
  }

  private static generateVideoHtml(component: ComponentData & { src?: string; poster?: string; controls?: boolean }): string {
    const src = component.src ?? '';
    const poster = component.poster ?? '';
    const controls = component.controls !== false;
    const style = HtmlExporter.buildStyleString(component.style);
    const posterAttr = poster ? ` poster="${HtmlExporter.escapeHtml(poster)}"` : '';
    const controlsAttr = controls ? ' controls' : '';
    return `      <div class="component" style="${style}"><video src="${HtmlExporter.escapeHtml(src)}"${posterAttr}${controlsAttr}></video></div>`;
  }

  private static generateAudioHtml(component: ComponentData & { src?: string; controls?: boolean }): string {
    const src = component.src ?? '';
    const controls = component.controls !== false;
    const style = HtmlExporter.buildStyleString(component.style);
    const controlsAttr = controls ? ' controls' : '';
    return `      <div class="component" style="${style}"><audio src="${HtmlExporter.escapeHtml(src)}"${controlsAttr}></audio></div>`;
  }

  private static generateQuizHtml(component: ComponentData & { title?: string; questions?: Array<{ id: string; text: string; options: Array<{ id: string; text: string; isCorrect: boolean }> }> }): string {
    const title = component.title ?? 'Quiz';
    const questions = component.questions ?? [];
    let html = `      <div class="quiz">`;
    html += `<div class="quiz-title">${HtmlExporter.escapeHtml(title)}</div>`;
    for (const question of questions) {
      html += `<div class="quiz-question">`;
      html += `<p><strong>${HtmlExporter.escapeHtml(question.text)}</strong></p>`;
      for (const option of question.options) {
        html += `<label class="quiz-option"><input type="radio" name="q-${question.id}" value="${option.id}"> ${HtmlExporter.escapeHtml(option.text)}</label>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
    return html;
  }

  private static generateFormHtml(component: ComponentData & { title?: string; fields?: Array<{ id: string; label: string; type: string; required: boolean; placeholder: string; options: string[] }>; submitLabel?: string }): string {
    const title = component.title ?? 'Form';
    const fields = component.fields ?? [];
    const submitLabel = component.submitLabel ?? 'Submit';
    let html = `      <div class="form">`;
    html += `<div class="form-title">${HtmlExporter.escapeHtml(title)}</div>`;
    for (const field of fields) {
      html += `<div class="form-field">`;
      html += `<label for="${field.id}">${HtmlExporter.escapeHtml(field.label)}${field.required ? ' *' : ''}</label>`;
      if (field.type === 'textarea') {
        html += `<textarea id="${field.id}" name="${field.id}"${field.required ? ' required' : ''} placeholder="${HtmlExporter.escapeHtml(field.placeholder)}"></textarea>`;
      } else if (field.type === 'select') {
        html += `<select id="${field.id}" name="${field.id}"${field.required ? ' required' : ''}>`;
        for (const opt of field.options) {
          html += `<option value="${HtmlExporter.escapeHtml(opt)}">${HtmlExporter.escapeHtml(opt)}</option>`;
        }
        html += `</select>`;
      } else {
        html += `<input type="${field.type}" id="${field.id}" name="${field.id}"${field.required ? ' required' : ''} placeholder="${HtmlExporter.escapeHtml(field.placeholder)}">`;
      }
      html += `</div>`;
    }
    html += `<button type="submit" class="form-submit">${HtmlExporter.escapeHtml(submitLabel)}</button>`;
    html += `</div>`;
    return html;
  }

  private static generateContainerHtml(component: ComponentData & { children?: string[]; direction?: string }, _theme: Lesson['theme']): string {
    const direction = component.direction ?? 'column';
    const baseStyle = component.style as Record<string, unknown>;
    const mergedStyle = { ...baseStyle, display: 'flex', flexDirection: direction };
    const parts: string[] = [];
    for (const [key, value] of Object.entries(mergedStyle)) {
      if (value === undefined || value === null || value === '') continue;
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      const cssValue = typeof value === 'number' ? `${value}px` : String(value);
      parts.push(`${cssKey}: ${cssValue}`);
    }
    const style = parts.join('; ');
    return `      <div class="component" style="${style}"></div>`;
  }

  private static buildStyleString(style: ComponentStyle | undefined): string {
    if (!style) return '';
    const parts: string[] = [];
    const styleObj = style as Record<string, unknown>;
    for (const [key, value] of Object.entries(styleObj)) {
      if (value === undefined || value === null || value === '') continue;
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      const cssValue = typeof value === 'number' ? `${value}px` : String(value);
      parts.push(`${cssKey}: ${cssValue}`);
    }
    return parts.join('; ');
  }

  private static escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }
}
