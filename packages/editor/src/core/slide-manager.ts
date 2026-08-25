import type { Slide, SlideId, ComponentData } from '../types.js';
import { SlideLayout, SlideTransition } from '../types.js';
import { generateId } from '../utils/id-generator.js';

export class SlideManager {
  private slides: Slide[] = [];

  get count(): number {
    return this.slides.length;
  }

  get isEmpty(): boolean {
    return this.slides.length === 0;
  }

  getAll(): Slide[] {
    return this.slides.map((s) => ({ ...s, components: [...s.components] }));
  }

  getById(id: SlideId): Slide | undefined {
    const slide = this.slides.find((s) => s.id === id);
    return slide ? { ...slide, components: [...slide.components] } : undefined;
  }

  getIndex(id: SlideId): number {
    return this.slides.findIndex((s) => s.id === id);
  }

  add(title = 'Untitled Slide', layout: SlideLayout = SlideLayout.Content): Slide {
    const slide: Slide = {
      id: generateId(),
      title,
      layout,
      transition: SlideTransition.None,
      duration: 0,
      components: [],
      backgroundColor: '#ffffff',
      backgroundImage: '',
      notes: '',
      locked: false,
      visible: true,
    };
    this.slides.push(slide);
    return { ...slide, components: [...slide.components] };
  }

  addAt(index: number, title = 'Untitled Slide', layout: SlideLayout = SlideLayout.Content): Slide | null {
    if (index < 0 || index > this.slides.length) return null;
    const slide: Slide = {
      id: generateId(),
      title,
      layout,
      transition: SlideTransition.None,
      duration: 0,
      components: [],
      backgroundColor: '#ffffff',
      backgroundImage: '',
      notes: '',
      locked: false,
      visible: true,
    };
    this.slides.splice(index, 0, slide);
    return { ...slide, components: [...slide.components] };
  }

  remove(id: SlideId): Slide | null {
    const index = this.slides.findIndex((s) => s.id === id);
    if (index === -1) return null;
    const [removed] = this.slides.splice(index, 1);
    return removed;
  }

  update(id: SlideId, updates: Partial<Omit<Slide, 'id'>>): Slide | null {
    const slide = this.slides.find((s) => s.id === id);
    if (!slide) return null;
    Object.assign(slide, updates);
    return { ...slide, components: [...slide.components] };
  }

  reorder(fromIndex: number, toIndex: number): boolean {
    if (fromIndex < 0 || fromIndex >= this.slides.length) return false;
    if (toIndex < 0 || toIndex >= this.slides.length) return false;
    const [moved] = this.slides.splice(fromIndex, 1);
    this.slides.splice(toIndex, 0, moved);
    return true;
  }

  duplicate(id: SlideId): Slide | null {
    const index = this.slides.findIndex((s) => s.id === id);
    if (index === -1) return null;
    const original = this.slides[index];
    const duplicate: Slide = {
      ...JSON.parse(JSON.stringify(original)),
      id: generateId(),
      title: `${original.title} (copy)`,
    };
    this.slides.splice(index + 1, 0, duplicate);
    return { ...duplicate, components: [...duplicate.components] };
  }

  moveUp(id: SlideId): boolean {
    const index = this.getIndex(id);
    if (index <= 0) return false;
    return this.reorder(index, index - 1);
  }

  moveDown(id: SlideId): boolean {
    const index = this.getIndex(id);
    if (index === -1 || index >= this.slides.length - 1) return false;
    return this.reorder(index, index + 1);
  }

  addComponent(slideId: SlideId, component: ComponentData): boolean {
    const slide = this.slides.find((s) => s.id === slideId);
    if (!slide) return false;
    slide.components.push(component);
    return true;
  }

  removeComponent(slideId: SlideId, componentId: string): boolean {
    const slide = this.slides.find((s) => s.id === slideId);
    if (!slide) return false;
    const index = slide.components.findIndex((c) => c.id === componentId);
    if (index === -1) return false;
    slide.components.splice(index, 1);
    return true;
  }

  getComponents(slideId: SlideId): ComponentData[] {
    const slide = this.slides.find((s) => s.id === slideId);
    return slide ? [...slide.components] : [];
  }

  setSlides(slides: Slide[]): void {
    this.slides = slides.map((s) => ({ ...s, components: [...s.components] }));
  }

  clear(): void {
    this.slides = [];
  }

  getVisible(): Slide[] {
    return this.slides.filter((s) => s.visible);
  }

  getLocked(): Slide[] {
    return this.slides.filter((s) => s.locked);
  }

  toggleVisibility(id: SlideId): boolean {
    const slide = this.slides.find((s) => s.id === id);
    if (!slide) return false;
    slide.visible = !slide.visible;
    return true;
  }

  toggleLock(id: SlideId): boolean {
    const slide = this.slides.find((s) => s.id === id);
    if (!slide) return false;
    slide.locked = !slide.locked;
    return true;
  }
}
