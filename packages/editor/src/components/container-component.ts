import { ComponentType, type ContainerComponentData, type ComponentId, type ComponentStyle, type Position, type Size } from '../types.js';
import { BaseComponent } from './base-component.js';

export class ContainerComponent extends BaseComponent {
  private containerData: ContainerComponentData;

  constructor(
    id: string,
    position?: Position,
    size?: Size,
    style?: Partial<ComponentStyle>
  ) {
    super(ComponentType.Container, id, 'Container', position, size);
    this.containerData = {
      ...this.data,
      type: ComponentType.Container,
      children: [],
      direction: 'column',
      gap: 8,
      overflow: 'visible',
    };
    if (style) {
      this.setStyle(style);
      this.containerData.style = this.data.style;
    }
  }

  get children(): ComponentId[] {
    return [...this.containerData.children];
  }

  get direction(): ContainerComponentData['direction'] {
    return this.containerData.direction;
  }

  set direction(value: ContainerComponentData['direction']) {
    this.containerData.direction = value;
  }

  get gap(): number {
    return this.containerData.gap;
  }

  set gap(value: number) {
    this.containerData.gap = Math.max(0, value);
  }

  get overflow(): ContainerComponentData['overflow'] {
    return this.containerData.overflow;
  }

  set overflow(value: ContainerComponentData['overflow']) {
    this.containerData.overflow = value;
  }

  addChild(childId: ComponentId): boolean {
    if (this.containerData.children.includes(childId)) return false;
    this.containerData.children.push(childId);
    return true;
  }

  removeChild(childId: ComponentId): boolean {
    const index = this.containerData.children.indexOf(childId);
    if (index === -1) return false;
    this.containerData.children.splice(index, 1);
    return true;
  }

  moveChild(childId: ComponentId, newIndex: number): boolean {
    const currentIndex = this.containerData.children.indexOf(childId);
    if (currentIndex === -1) return false;
    if (newIndex < 0 || newIndex >= this.containerData.children.length) return false;
    this.containerData.children.splice(currentIndex, 1);
    this.containerData.children.splice(newIndex, 0, childId);
    return true;
  }

  reorderChildren(orderedIds: ComponentId[]): void {
    this.containerData.children = orderedIds.filter((id) =>
      this.containerData.children.includes(id)
    );
  }

  getChildCount(): number {
    return this.containerData.children.length;
  }

  hasChild(childId: ComponentId): boolean {
    return this.containerData.children.includes(childId);
  }

  setStyle(style: Partial<ComponentStyle>): void {
    super.setStyle(style);
    this.containerData.style = this.data.style;
  }

  toJSON(): ContainerComponentData {
    return {
      ...this.data,
      type: ComponentType.Container,
      children: [...this.containerData.children],
      direction: this.containerData.direction,
      gap: this.containerData.gap,
      overflow: this.containerData.overflow,
    };
  }

  clone(newId: string): ContainerComponent {
    const cloned = new ContainerComponent(
      newId,
      this.position,
      this.size,
      this.style
    );
    cloned.containerData.children = [...this.containerData.children];
    cloned.direction = this.containerData.direction;
    cloned.gap = this.containerData.gap;
    cloned.overflow = this.containerData.overflow;
    cloned.setName(`${this.name} (copy)`);
    return cloned;
  }

  static fromJSON(data: ContainerComponentData): ContainerComponent {
    const component = new ContainerComponent(
      data.id,
      data.position,
      data.size,
      data.style
    );
    component.containerData.children = [...data.children];
    component.direction = data.direction;
    component.gap = data.gap;
    component.overflow = data.overflow;
    component.setLocked(data.locked);
    component.setVisible(data.visible);
    component.setName(data.name);
    return component;
  }
}
