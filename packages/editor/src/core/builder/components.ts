import type { ComponentData, ComponentType, SlideId } from '../../types.js';
import { Constructor, LessonBuilderBase } from './base.js';

export const ComponentsTrait = <T extends Constructor<LessonBuilderBase>>(Base: T) =>
  class ComponentsActions extends Base {
    addComponent(
      slideId: SlideId,
      type: ComponentType,
      componentOverrides?: Partial<ComponentData>,
    ): ComponentData | null {
      const component = this.componentManager.create(type);
      const merged = { ...component, ...componentOverrides } as ComponentData;
      const success = this.slideManager.addComponent(slideId, merged);
      if (!success) return null;
      this.lesson.slides = this.slideManager.getAll();
      this.touch();
      this.pushHistory(`Component added: ${type}`);
      this.emit('component:added', merged);
      return merged;
    }

    removeComponent(componentId: string): boolean {
      if (this.activeSlideId) {
        const success = this.slideManager.removeComponent(this.activeSlideId, componentId);
        if (success) {
          this.lesson.slides = this.slideManager.getAll();
          this.touch();
          this.pushHistory('Component removed');
          this.emit('component:removed', componentId);
          return true;
        }
      }

      for (const slide of this.lesson.slides) {
        if (this.slideManager.removeComponent(slide.id, componentId)) {
          this.lesson.slides = this.slideManager.getAll();
          this.touch();
          this.pushHistory('Component removed');
          this.emit('component:removed', componentId);
          return true;
        }
      }
      return false;
    }

    updateComponent(componentId: string, updates: Partial<ComponentData>): ComponentData | null {
      const result = this.componentManager.update(this.lesson.slides, componentId, updates);
      if (!result) return null;
      this.lesson.slides = this.slideManager.getAll();
      this.touch();
      this.pushHistory('Component updated');
      this.emit('component:updated', result);
      return result;
    }
  };