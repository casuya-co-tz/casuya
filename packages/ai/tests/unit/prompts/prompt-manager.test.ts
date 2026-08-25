import { PromptManager } from '../../../src/prompts/prompt-manager';
import { PromptTemplate, ModelCapability, PromptCategory } from '../../../src/types';

describe('PromptManager', () => {
  let manager: PromptManager;

  function createTemplate(): PromptTemplate {
    return {
      id: 'test-template',
      name: 'Test',
      description: 'A test template',
      template: 'Hello {{name}}, welcome to {{place}}!',
      variables: [
        { name: 'name', type: 'string', required: true },
        { name: 'place', type: 'string', required: false, defaultValue: 'Casuya' },
      ],
      capability: ModelCapability.CHAT,
      version: '1.0.0',
      tags: ['test'],
      category: PromptCategory.TUTORING,
      metadata: {
        author: 'test',
        created: new Date(),
        updated: new Date(),
        usageCount: 0,
        averageTokens: 10,
        successRate: 1,
        category: PromptCategory.TUTORING,
      },
    };
  }

  beforeEach(() => {
    manager = new PromptManager();
  });

  it('should register and retrieve templates', () => {
    manager.registerTemplate(createTemplate());
    const retrieved = manager.getTemplate('test-template');
    expect(retrieved.id).toBe('test-template');
  });

  it('should throw for unknown templates', () => {
    expect(() => manager.getTemplate('unknown')).toThrow();
  });

  it('should render templates with variables', () => {
    manager.registerTemplate(createTemplate());
    const result = manager.execute({
      templateId: 'test-template',
      variables: { name: 'Student' },
    });
    expect(result.content).toBe('Hello Student, welcome to Casuya!');
    expect(result.success).toBe(true);
  });

  it('should track usage count', () => {
    manager.registerTemplate(createTemplate());
    manager.execute({ templateId: 'test-template', variables: { name: 'A' } });
    manager.execute({ templateId: 'test-template', variables: { name: 'B' } });
    expect(manager.getTemplate('test-template').metadata.usageCount).toBe(2);
  });

  it('should fail when required variables missing', () => {
    manager.registerTemplate(createTemplate());
    const result = manager.execute({
      templateId: 'test-template',
      variables: {},
    });
    expect(result.success).toBe(false);
  });
});
