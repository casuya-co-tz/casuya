import type { Lesson, ExportOptions, ComponentData } from '../types.js';
import { ComponentType } from '../types.js';

const DEFAULT_OPTIONS: ExportOptions = {
  pretty: true,
  includeMetadata: true,
  version: '1.0.0',
};

export class MarkdownExporter {
  static export(lesson: Lesson, options?: Partial<ExportOptions>): string {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const lines: string[] = [];

    lines.push(`# ${lesson.title}`);
    lines.push('');

    if (opts.includeMetadata) {
      if (lesson.description) {
        lines.push(lesson.description);
        lines.push('');
      }
      if (lesson.metadata.author) {
        lines.push(`**Author:** ${lesson.metadata.author}`);
      }
      if (lesson.metadata.difficulty) {
        lines.push(`**Difficulty:** ${lesson.metadata.difficulty}`);
      }
      if (lesson.metadata.estimatedMinutes > 0) {
        lines.push(`**Estimated Time:** ${lesson.metadata.estimatedMinutes} minutes`);
      }
      if (lesson.metadata.tags.length > 0) {
        lines.push(`**Tags:** ${lesson.metadata.tags.join(', ')}`);
      }
      if (lesson.description || lesson.metadata.author) {
        lines.push('');
      }
      lines.push('---');
      lines.push('');
    }

    for (let i = 0; i < lesson.slides.length; i++) {
      const slide = lesson.slides[i];
      if (!slide.visible) continue;

      lines.push(`## ${slide.title}`);
      lines.push('');

      for (const component of slide.components) {
        lines.push(MarkdownExporter.componentToMarkdown(component));
      }

      if (slide.notes) {
        lines.push('');
        lines.push(`> **Notes:** ${slide.notes}`);
      }

      if (i < lesson.slides.length - 1) {
        lines.push('');
        lines.push('---');
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  private static componentToMarkdown(component: ComponentData): string {
    switch (component.type) {
      case ComponentType.Text:
        return MarkdownExporter.textToMarkdown(component);
      case ComponentType.Image:
        return MarkdownExporter.imageToMarkdown(component);
      case ComponentType.Video:
        return MarkdownExporter.videoToMarkdown(component);
      case ComponentType.Audio:
        return MarkdownExporter.audioToMarkdown(component);
      case ComponentType.Quiz:
        return MarkdownExporter.quizToMarkdown(component);
      case ComponentType.Form:
        return MarkdownExporter.formToMarkdown(component);
      case ComponentType.Container:
        return '';
      default:
        return '';
    }
  }

  private static textToMarkdown(component: ComponentData & { content?: string }): string {
    return component.content ?? '';
  }

  private static imageToMarkdown(component: ComponentData & { src?: string; alt?: string; caption?: string }): string {
    const src = component.src ?? '';
    const alt = component.alt ?? '';
    const caption = component.caption ?? alt;
    let md = `![${alt}](${src})`;
    if (caption) {
      md += `\n*${caption}*`;
    }
    return md;
  }

  private static videoToMarkdown(component: ComponentData & { src?: string }): string {
    const src = component.src ?? '';
    return `[Video: ${src}](${src})`;
  }

  private static audioToMarkdown(component: ComponentData & { src?: string }): string {
    const src = component.src ?? '';
    return `[Audio: ${src}](${src})`;
  }

  private static quizToMarkdown(component: ComponentData & { title?: string; questions?: Array<{ text: string; type: string; options: Array<{ text: string; isCorrect: boolean }>; points: number; explanation: string }> }): string {
    const title = component.title ?? 'Quiz';
    const questions = component.questions ?? [];
    let md = `### ${title}\n\n`;
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      md += `${i + 1}. ${q.text} (${q.points} pts)\n`;
      if (q.type === 'multiple-choice' || q.type === 'true-false') {
        for (let j = 0; j < (q.options?.length ?? 0); j++) {
          const opt = q.options[j];
          const marker = opt?.isCorrect ? '[x]' : '[ ]';
          md += `   ${marker} ${opt?.text ?? ''}\n`;
        }
      }
      if (q.explanation) {
        md += `   > ${q.explanation}\n`;
      }
      md += '\n';
    }
    return md;
  }

  private static formToMarkdown(component: ComponentData & { title?: string; fields?: Array<{ label: string; type: string; required: boolean }> }): string {
    const title = component.title ?? 'Form';
    const fields = component.fields ?? [];
    let md = `### ${title}\n\n`;
    for (const field of fields) {
      const req = field.required ? ' (required)' : '';
      md += `- **${field.label}**${req} (_${field.type}_)\n`;
    }
    return md;
  }
}
