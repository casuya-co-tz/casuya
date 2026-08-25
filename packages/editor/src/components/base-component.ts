import type {
  BaseComponentData,
  ComponentType,
  ComponentStyle,
  Position,
  Size,
} from '../types.js';

export abstract class BaseComponent {
  protected data: BaseComponentData;

  constructor(
    type: ComponentType,
    id: string,
    name: string,
    position: Position = { x: 0, y: 0 },
    size: Size = { width: 200, height: 100 }
  ) {
    this.data = {
      id,
      type,
      position,
      size,
      style: {},
      locked: false,
      visible: true,
      name,
    };
  }

  get id(): string {
    return this.data.id;
  }

  get type(): ComponentType {
    return this.data.type;
  }

  get position(): Position {
    return { ...this.data.position };
  }

  get size(): Size {
    return { ...this.data.size };
  }

  get style(): ComponentStyle {
    return { ...this.data.style };
  }

  get locked(): boolean {
    return this.data.locked;
  }

  get visible(): boolean {
    return this.data.visible;
  }

  get name(): string {
    return this.data.name;
  }

  setPosition(x: number, y: number): void {
    this.data.position = { x, y };
  }

  setSize(width: number, height: number): void {
    this.data.size = { width, height };
  }

  setStyle(style: Partial<ComponentStyle>): void {
    this.data.style = { ...this.data.style, ...style };
  }

  setLocked(locked: boolean): void {
    this.data.locked = locked;
  }

  setVisible(visible: boolean): void {
    this.data.visible = visible;
  }

  setName(name: string): void {
    this.data.name = name;
  }

  abstract toJSON(): BaseComponentData;
  abstract clone(newId: string): BaseComponent;

  moveTo(x: number, y: number): void {
    this.setPosition(x, y);
  }

  resize(width: number, height: number): void {
    this.setSize(width, height);
  }

  getBoundingBox(): { x: number; y: number; width: number; height: number } {
    return {
      x: this.data.position.x,
      y: this.data.position.y,
      width: this.data.size.width,
      height: this.data.size.height,
    };
  }

  intersects(other: BaseComponent): boolean {
    const a = this.getBoundingBox();
    const b = other.getBoundingBox();
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  containsPoint(x: number, y: number): boolean {
    const bb = this.getBoundingBox();
    return x >= bb.x && x <= bb.x + bb.width && y >= bb.y && y <= bb.y + bb.height;
  }
}
