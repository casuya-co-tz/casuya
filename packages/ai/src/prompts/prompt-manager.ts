import {
  PromptTemplate,
  PromptExecutionRequest,
  PromptExecutionResult,
  PromptVersion,
  PromptOptimizationResult,
} from '../types';
import { CasuyaAIError, ErrorCode, Logger, estimateTokens } from '../utilities';

export class PromptManager {
  private templates: Map<string, PromptTemplate>;
  private versions: Map<string, PromptVersion[]>;
  private logger: Logger;

  constructor(logger?: Logger) {
    this.templates = new Map();
    this.versions = new Map();
    this.logger = logger ?? new Logger({ prefix: '[PromptManager]' });
  }

  registerTemplate(template: PromptTemplate): void {
    this.templates.set(template.id, template);
    this.logger.info(`Template registered: ${template.id} v${template.version}`);
  }

  registerTemplates(templates: PromptTemplate[]): void {
    for (const template of templates) {
      this.registerTemplate(template);
    }
  }

  getTemplate(id: string): PromptTemplate {
    const template = this.templates.get(id);
    if (!template) {
      throw new CasuyaAIError(
        `Prompt template not found: ${id}`,
        ErrorCode.PROMPT_TEMPLATE_NOT_FOUND,
      );
    }
    return template;
  }

  execute(request: PromptExecutionRequest): PromptExecutionResult {
    const start = Date.now();
    try {
      const template = this.getTemplate(request.templateId);
      const rendered = this.renderTemplate(template, request.variables);
      const tokensUsed = estimateTokens(rendered);

      template.metadata.usageCount++;

      return {
        content: rendered,
        templateId: request.templateId,
        tokensUsed,
        latency: Date.now() - start,
        success: true,
      };
    } catch (error) {
      return {
        content: '',
        templateId: request.templateId,
        tokensUsed: 0,
        latency: Date.now() - start,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  renderTemplate(template: PromptTemplate, variables: Record<string, unknown>): string {
    let result = template.template;

    for (const variable of template.variables) {
      const value = variables[variable.name] ?? variable.defaultValue;

      if (value === undefined && variable.required) {
        throw new CasuyaAIError(
          `Required variable '${variable.name}' not provided for template '${template.id}'`,
          ErrorCode.PROMPT_VARIABLE_MISSING,
        );
      }

      if (value !== undefined) {
        result = result.replace(
          new RegExp(`\\{\\{${variable.name}\\}\\}`, 'g'),
          String(value),
        );
      }
    }

    this.validateRender(result);
    return result;
  }

  addVersion(templateId: string, version: PromptVersion): void {
    if (!this.versions.has(templateId)) {
      this.versions.set(templateId, []);
    }
    this.versions.get(templateId)!.push(version);
  }

  getVersions(templateId: string): PromptVersion[] {
    return this.versions.get(templateId) ?? [];
  }

  optimizeTemplate(templateId: string): PromptOptimizationResult {
    const template = this.getTemplate(templateId);
    const originalTokens = estimateTokens(template.template);

    const optimized = template.template
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+$/gm, '')
      .trim();

    const optimizedTokens = estimateTokens(optimized);
    const reduction = originalTokens - optimizedTokens;

    return {
      originalTemplate: template.template,
      optimizedTemplate: optimized,
      tokenReduction: reduction,
      clarityImprovement: reduction > 0 ? Math.round((reduction / originalTokens) * 100) : 0,
      suggestions: reduction > 0
        ? ['Removed redundant whitespace', 'Trimmed unnecessary line breaks']
        : ['Template is already optimized'],
    };
  }

  private validateRender(rendered: string): void {
    const unfilled = rendered.match(/\{\{[^}]+\}\}/g);
    if (unfilled && unfilled.length > 0) {
      this.logger.warn(`Template has unfilled variables: ${unfilled.join(', ')}`);
    }
  }

  listTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }
}
