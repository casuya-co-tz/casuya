import type {
  Lesson,
  ComponentData,
  AccessibilityCheck,
  AccessibilityIssue,
} from '../types.js';
import { ComponentType } from '../types.js';

export class AccessibilityManager {
  private contrastThreshold = 4.5;
  private minFontSize = 12;

  checkLesson(lesson: Lesson): AccessibilityCheck[] {
    const checks: AccessibilityCheck[] = [];

    for (const slide of lesson.slides) {
      for (const component of slide.components) {
        const issues = this.checkComponent(component, slide);
        if (issues.length > 0) {
          checks.push({ componentId: component.id, issues });
        }
      }
    }

    if (lesson.slides.length > 0) {
      const firstSlide = lesson.slides[0];
      if (firstSlide) {
        const hasHeading = firstSlide.components.some(
          (c) => c.type === ComponentType.Text && c.name.toLowerCase().includes('title')
        );
        if (!hasHeading) {
          checks.push({
            componentId: 'lesson',
            issues: [
              {
                type: 'missing-heading',
                message: 'Lesson should start with a title or heading component',
                severity: 'warning',
              },
            ],
          });
        }
      }
    }

    return checks;
  }

  checkComponent(component: ComponentData, _slide: Lesson['slides'][0]): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];

    switch (component.type) {
      case ComponentType.Image:
        issues.push(...this.checkImageAccessibility(component));
        break;
      case ComponentType.Video:
        issues.push(...this.checkVideoAccessibility(component));
        break;
      case ComponentType.Audio:
        issues.push(...this.checkAudioAccessibility(component));
        break;
      case ComponentType.Form:
        issues.push(...this.checkFormAccessibility(component));
        break;
      case ComponentType.Text:
        issues.push(...this.checkTextAccessibility(component));
        break;
      case ComponentType.Quiz:
        issues.push(...this.checkQuizAccessibility(component));
        break;
    }

    if (component.style.fontSize && component.style.fontSize < this.minFontSize) {
      issues.push({
        type: 'missing-label',
        message: `Font size ${component.style.fontSize}px may be too small for readability`,
        severity: 'warning',
      });
    }

    if (component.style.opacity !== undefined && component.style.opacity < 0.5) {
      issues.push({
        type: 'low-contrast',
        message: `Opacity ${component.style.opacity} may reduce readability`,
        severity: 'warning',
      });
    }

    return issues;
  }

  private checkImageAccessibility(component: ComponentData): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];
    const imageComponent = component as ComponentData & { alt?: string; src?: string };

    if (!imageComponent.alt || imageComponent.alt.trim().length === 0) {
      issues.push({
        type: 'missing-alt',
        message: 'Image is missing alt text for screen readers',
        severity: 'error',
      });
    }

    if (!imageComponent.src || imageComponent.src.trim().length === 0) {
      issues.push({
        type: 'missing-label',
        message: 'Image is missing a source URL',
        severity: 'error',
      });
    }

    return issues;
  }

  private checkVideoAccessibility(component: ComponentData): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];
    const videoComponent = component as ComponentData & { src?: string };

    if (!videoComponent.src || videoComponent.src.trim().length === 0) {
      issues.push({
        type: 'missing-label',
        message: 'Video is missing a source URL',
        severity: 'error',
      });
    }

    return issues;
  }

  private checkAudioAccessibility(component: ComponentData): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];
    const audioComponent = component as ComponentData & { src?: string };

    if (!audioComponent.src || audioComponent.src.trim().length === 0) {
      issues.push({
        type: 'missing-label',
        message: 'Audio is missing a source URL',
        severity: 'error',
      });
    }

    return issues;
  }

  private checkFormAccessibility(component: ComponentData): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];
    const formComponent = component as ComponentData & { fields?: Array<{ id: string; label: string; required: boolean }> };
    const fields = formComponent.fields ?? [];

    for (const field of fields) {
      if (!field.label || field.label.trim().length === 0) {
        issues.push({
          type: 'missing-label',
          message: `Form field "${field.id}" is missing a label`,
          severity: 'error',
        });
      }
    }

    if (fields.length === 0) {
      issues.push({
        type: 'missing-label',
        message: 'Form has no fields defined',
        severity: 'warning',
      });
    }

    return issues;
  }

  private checkTextAccessibility(component: ComponentData): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];
    const textComponent = component as ComponentData & { content?: string };

    if (!textComponent.content || textComponent.content.trim().length === 0) {
      issues.push({
        type: 'missing-label',
        message: 'Text component is empty',
        severity: 'info',
      });
    }

    return issues;
  }

  private checkQuizAccessibility(component: ComponentData): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];
    const quizComponent = component as ComponentData & { questions?: Array<{ id: string; text: string; options: Array<{ text: string }> }> };

    if (!quizComponent.questions || quizComponent.questions.length === 0) {
      issues.push({
        type: 'missing-label',
        message: 'Quiz has no questions defined',
        severity: 'warning',
      });
    }

    return issues;
  }

  getContrastRatio(foreground: string, background: string): number {
    const fgLuminance = this.getRelativeLuminance(foreground);
    const bgLuminance = this.getRelativeLuminance(background);
    const lighter = Math.max(fgLuminance, bgLuminance);
    const darker = Math.min(fgLuminance, bgLuminance);
    return (lighter + 0.05) / (darker + 0.05);
  }

  hasSufficientContrast(foreground: string, background: string): boolean {
    return this.getContrastRatio(foreground, background) >= this.contrastThreshold;
  }

  private getRelativeLuminance(color: string): number {
    const rgb = this.parseColorToRgb(color);
    if (!rgb) return 0;

    const [r, g, b] = rgb.map((c) => {
      const sRGB = c / 255;
      return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  private parseColorToRgb(color: string): number[] | null {
    const hexMatch = color.match(/^#([0-9a-f]{3,8})$/i);
    if (hexMatch) {
      const hex = hexMatch[1];
      if (!hex) return null;
      if (hex.length === 3) {
        return [
          parseInt(hex[0] + hex[0], 16),
          parseInt(hex[1] + hex[1], 16),
          parseInt(hex[2] + hex[2], 16),
        ];
      }
      if (hex.length >= 6) {
        return [
          parseInt(hex.substring(0, 2), 16),
          parseInt(hex.substring(2, 4), 16),
          parseInt(hex.substring(4, 6), 16),
        ];
      }
    }

    const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      return [parseInt(rgbMatch[1]!), parseInt(rgbMatch[2]!), parseInt(rgbMatch[3]!)];
    }

    return null;
  }
}
