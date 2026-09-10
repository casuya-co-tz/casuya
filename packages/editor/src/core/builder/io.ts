import type { ExportOptions, ImportResult } from '../../types.js';
import { MarkdownImporter } from '../../importers/markdown-importer.js';
import { HtmlImporter } from '../../importers/html-importer.js';
import { JsonExporter } from '../../exporters/json-exporter.js';
import { HtmlExporter } from '../../exporters/html-exporter.js';
import { MarkdownExporter } from '../../exporters/markdown-exporter.js';
import { Constructor, LessonBuilderBase } from './base.js';

export const IoTrait = <T extends Constructor<LessonBuilderBase>>(Base: T) =>
  class IoActionsClass extends Base {
    importFromMarkdown(markdown: string): ImportResult {
      const result = MarkdownImporter.import(markdown);
      if (result.success && result.lesson) {
        this.load(result.lesson);
      }
      return result;
    }

    importFromHtml(html: string): ImportResult {
      const result = HtmlImporter.import(html);
      if (result.success && result.lesson) {
        this.load(result.lesson);
      }
      return result;
    }

    exportToJson(options?: Partial<ExportOptions>): string {
      return JsonExporter.export(this.serializeLesson(), options);
    }

    exportToHtml(options?: Partial<ExportOptions>): string {
      return HtmlExporter.export(this.serializeLesson(), options);
    }

    exportToMarkdown(options?: Partial<ExportOptions>): string {
      return MarkdownExporter.export(this.serializeLesson(), options);
    }

    loadTemplate(templateId: string): void {
      const template = this.templateManager.getTemplate(templateId);
      if (template) {
        this.load(template.lesson);
      }
    }
  };