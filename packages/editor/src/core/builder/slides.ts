import type { Slide, SlideId, SlideLayout } from '../../types.js';
import { Constructor, LessonBuilderBase } from './base.js';

export const SlidesTrait = <T extends Constructor<LessonBuilderBase>>(Base: T) =>
  class SlidesActions extends Base {
    addSlide(title?: string, layout?: SlideLayout): Slide {
      const slide = this.slideManager.add(title, layout);
      this.lesson.slides = this.slideManager.getAll();
      this.touch();
      this.pushHistory(`Slide added: "${slide.title}"`);
      this.emit('slide:added', slide);
      return slide;
    }

    addSlideAt(index: number, title?: string, layout?: SlideLayout): Slide | null {
      const slide = this.slideManager.addAt(index, title, layout);
      if (!slide) return null;
      this.lesson.slides = this.slideManager.getAll();
      this.touch();
      this.pushHistory(`Slide added at position ${index}`);
      this.emit('slide:added', slide);
      return slide;
    }

    removeSlide(slideId: SlideId): Slide | null {
      const slide = this.slideManager.remove(slideId);
      if (!slide) return null;
      this.lesson.slides = this.slideManager.getAll();
      if (this.activeSlideId === slideId) {
        this.activeSlideId = null;
      }
      this.touch();
      this.pushHistory(`Slide removed: "${slide.title}"`);
      this.emit('slide:removed', slideId);
      return slide;
    }

    updateSlide(slideId: SlideId, updates: Partial<Omit<Slide, 'id'>>): Slide | null {
      const slide = this.slideManager.update(slideId, updates);
      if (!slide) return null;
      this.lesson.slides = this.slideManager.getAll();
      this.touch();
      this.pushHistory(`Slide updated: "${slide.title}"`);
      this.emit('slide:updated', slide);
      return slide;
    }

    reorderSlides(fromIndex: number, toIndex: number): boolean {
      const result = this.slideManager.reorder(fromIndex, toIndex);
      if (!result) return false;
      this.lesson.slides = this.slideManager.getAll();
      this.touch();
      this.pushHistory('Slides reordered');
      this.emit('slide:reordered', this.lesson.slides);
      return true;
    }

    duplicateSlide(slideId: SlideId): Slide | null {
      const slide = this.slideManager.duplicate(slideId);
      if (!slide) return null;
      this.lesson.slides = this.slideManager.getAll();
      this.touch();
      this.pushHistory(`Slide duplicated: "${slide.title}"`);
      this.emit('slide:added', slide);
      return slide;
    }
  };