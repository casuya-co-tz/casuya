import type { ComponentData, ComponentId, Slide, SlideId } from '../types.js';
import { ComponentType } from '../types.js';
import { TextComponent } from '../components/text-component.js';
import { ImageComponent } from '../components/image-component.js';
import { QuizComponent } from '../components/quiz-component.js';
import { ContainerComponent } from '../components/container-component.js';
import { VideoComponent } from '../components/video-component.js';
import { AudioComponent } from '../components/audio-component.js';
import { FormComponent } from '../components/form-component.js';
import { generateId } from '../utils/id-generator.js';

type ComponentFactory = (id: string) => ComponentData;

const defaultFactories: Record<ComponentType, ComponentFactory> = {
  [ComponentType.Text]: (id) => new TextComponent(id).toJSON(),
  [ComponentType.Image]: (id) => new ImageComponent(id).toJSON(),
  [ComponentType.Video]: (id) => new VideoComponent(id).toJSON(),
  [ComponentType.Audio]: (id) => new AudioComponent(id).toJSON(),
  [ComponentType.Quiz]: (id) => new QuizComponent(id).toJSON(),
  [ComponentType.Form]: (id) => new FormComponent(id).toJSON(),
  [ComponentType.Container]: (id) => new ContainerComponent(id).toJSON(),
};

export class ComponentManager {
  private factories: Map<ComponentType, ComponentFactory>;

  constructor() {
    this.factories = new Map(Object.entries(defaultFactories) as [ComponentType, ComponentFactory][]);
  }

  registerFactory(type: ComponentType, factory: ComponentFactory): void {
    this.factories.set(type, factory);
  }

  create(type: ComponentType, id?: string): ComponentData {
    const componentId = id ?? generateId();
    const factory = this.factories.get(type);
    if (!factory) {
      throw new Error(`Unknown component type: ${type}`);
    }
    return factory(componentId);
  }

  createFromData(data: ComponentData): ComponentData {
    switch (data.type) {
      case ComponentType.Text:
        return TextComponent.fromJSON(data).toJSON();
      case ComponentType.Image:
        return ImageComponent.fromJSON(data).toJSON();
      case ComponentType.Video:
        return VideoComponent.fromJSON(data).toJSON();
      case ComponentType.Audio:
        return AudioComponent.fromJSON(data).toJSON();
      case ComponentType.Quiz:
        return QuizComponent.fromJSON(data).toJSON();
      case ComponentType.Form:
        return FormComponent.fromJSON(data).toJSON();
      case ComponentType.Container:
        return ContainerComponent.fromJSON(data).toJSON();
      default:
        return data;
    }
  }

  findById(slides: Slide[], componentId: ComponentId): ComponentData | null {
    for (const slide of slides) {
      const found = slide.components.find((c) => c.id === componentId);
      if (found) return found;
    }
    return null;
  }

  findOnSlide(slide: Slide, componentId: ComponentId): ComponentData | null {
    return slide.components.find((c) => c.id === componentId) ?? null;
  }

  update(slides: Slide[], componentId: ComponentId, updates: Partial<ComponentData>): ComponentData | null {
    for (const slide of slides) {
      const index = slide.components.findIndex((c) => c.id === componentId);
      if (index !== -1) {
        const existing = slide.components[index];
        slide.components[index] = { ...existing, ...updates } as ComponentData;
        return slide.components[index];
      }
    }
    return null;
  }

  remove(slides: Slide[], componentId: ComponentId): boolean {
    for (const slide of slides) {
      const index = slide.components.findIndex((c) => c.id === componentId);
      if (index !== -1) {
        slide.components.splice(index, 1);
        return true;
      }
    }
    return false;
  }

  duplicate(slides: Slide[], componentId: ComponentId): ComponentData | null {
    const original = this.findById(slides, componentId);
    if (!original) return null;
    const clone = { ...JSON.parse(JSON.stringify(original)), id: generateId() };
    for (const slide of slides) {
      const index = slide.components.findIndex((c) => c.id === componentId);
      if (index !== -1) {
        slide.components.splice(index + 1, 0, clone as ComponentData);
        return clone as ComponentData;
      }
    }
    return null;
  }

  moveToSlide(slides: Slide[], componentId: ComponentId, targetSlideId: SlideId): boolean {
    let component: ComponentData | null = null;
    for (const slide of slides) {
      const index = slide.components.findIndex((c) => c.id === componentId);
      if (index !== -1) {
        [component] = slide.components.splice(index, 1);
        break;
      }
    }
    if (!component) return false;

    const targetSlide = slides.find((s) => s.id === targetSlideId);
    if (!targetSlide) {
      for (const slide of slides) {
        const idx = slide.components.findIndex((c) => c.id === componentId);
        if (idx !== -1) {
          slide.components.splice(idx, 0, component);
          break;
        }
      }
      return false;
    }
    targetSlide.components.push(component);
    return true;
  }

  reorderOnSlide(slide: Slide, fromIndex: number, toIndex: number): boolean {
    if (fromIndex < 0 || fromIndex >= slide.components.length) return false;
    if (toIndex < 0 || toIndex >= slide.components.length) return false;
    const [moved] = slide.components.splice(fromIndex, 1);
    slide.components.splice(toIndex, 0, moved);
    return true;
  }

  getAllByType(slides: Slide[], type: ComponentType): ComponentData[] {
    const results: ComponentData[] = [];
    for (const slide of slides) {
      for (const component of slide.components) {
        if (component.type === type) {
          results.push(component);
        }
      }
    }
    return results;
  }

  getStatistics(slides: Slide[]): Record<ComponentType, number> {
    const stats = {} as Record<ComponentType, number>;
    for (const type of Object.values(ComponentType)) {
      stats[type] = 0;
    }
    for (const slide of slides) {
      for (const component of slide.components) {
        stats[component.type]++;
      }
    }
    return stats;
  }
}
