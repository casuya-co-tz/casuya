import { ComponentType, type ImageComponentData, type ComponentStyle, type Position, type Size } from '../types.js';
import { BaseComponent } from './base-component.js';

export class ImageComponent extends BaseComponent {
  private imageData: ImageComponentData;

  constructor(
    id: string,
    src = '',
    position?: Position,
    size?: Size,
    style?: Partial<ComponentStyle>
  ) {
    super(ComponentType.Image, id, 'Image', position, size);
    this.imageData = {
      ...this.data,
      type: ComponentType.Image,
      src,
      alt: '',
      caption: '',
      objectFit: 'cover',
    };
    if (style) {
      this.setStyle(style);
      this.imageData.style = this.data.style;
    }
  }

  get src(): string {
    return this.imageData.src;
  }

  set src(value: string) {
    this.imageData.src = value;
  }

  get alt(): string {
    return this.imageData.alt;
  }

  set alt(value: string) {
    this.imageData.alt = value;
  }

  get caption(): string {
    return this.imageData.caption;
  }

  set caption(value: string) {
    this.imageData.caption = value;
  }

  get objectFit(): ImageComponentData['objectFit'] {
    return this.imageData.objectFit;
  }

  set objectFit(value: ImageComponentData['objectFit']) {
    this.imageData.objectFit = value;
  }

  hasAltText(): boolean {
    return this.imageData.alt.trim().length > 0;
  }

  setStyle(style: Partial<ComponentStyle>): void {
    super.setStyle(style);
    this.imageData.style = this.data.style;
  }

  toJSON(): ImageComponentData {
    return {
      ...this.data,
      type: ComponentType.Image,
      src: this.imageData.src,
      alt: this.imageData.alt,
      caption: this.imageData.caption,
      objectFit: this.imageData.objectFit,
    };
  }

  clone(newId: string): ImageComponent {
    const cloned = new ImageComponent(
      newId,
      this.imageData.src,
      this.position,
      this.size,
      this.style
    );
    cloned.alt = this.imageData.alt;
    cloned.caption = this.imageData.caption;
    cloned.objectFit = this.imageData.objectFit;
    cloned.setName(`${this.name} (copy)`);
    return cloned;
  }

  static fromJSON(data: ImageComponentData): ImageComponent {
    const component = new ImageComponent(
      data.id,
      data.src,
      data.position,
      data.size,
      data.style
    );
    component.alt = data.alt;
    component.caption = data.caption;
    component.objectFit = data.objectFit;
    component.setLocked(data.locked);
    component.setVisible(data.visible);
    component.setName(data.name);
    return component;
  }
}
