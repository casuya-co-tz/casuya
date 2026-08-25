import { ComponentType, type AudioComponentData, type ComponentStyle, type Position, type Size } from '../types.js';
import { BaseComponent } from './base-component.js';

export class AudioComponent extends BaseComponent {
  private audioData: AudioComponentData;

  constructor(
    id: string,
    src = '',
    position?: Position,
    size?: Size,
    style?: Partial<ComponentStyle>
  ) {
    super(ComponentType.Audio, id, 'Audio', position, size);
    this.audioData = {
      ...this.data,
      type: ComponentType.Audio,
      src,
      autoplay: false,
      loop: false,
      controls: true,
    };
    if (style) {
      this.setStyle(style);
      this.audioData.style = this.data.style;
    }
  }

  get src(): string {
    return this.audioData.src;
  }

  set src(value: string) {
    this.audioData.src = value;
  }

  get autoplay(): boolean {
    return this.audioData.autoplay;
  }

  set autoplay(value: boolean) {
    this.audioData.autoplay = value;
  }

  get loop(): boolean {
    return this.audioData.loop;
  }

  set loop(value: boolean) {
    this.audioData.loop = value;
  }

  get controls(): boolean {
    return this.audioData.controls;
  }

  set controls(value: boolean) {
    this.audioData.controls = value;
  }

  setStyle(style: Partial<ComponentStyle>): void {
    super.setStyle(style);
    this.audioData.style = this.data.style;
  }

  toJSON(): AudioComponentData {
    return {
      ...this.data,
      type: ComponentType.Audio,
      src: this.audioData.src,
      autoplay: this.audioData.autoplay,
      loop: this.audioData.loop,
      controls: this.audioData.controls,
    };
  }

  clone(newId: string): AudioComponent {
    const cloned = new AudioComponent(
      newId,
      this.audioData.src,
      this.position,
      this.size,
      this.style
    );
    cloned.autoplay = this.audioData.autoplay;
    cloned.loop = this.audioData.loop;
    cloned.controls = this.audioData.controls;
    cloned.setName(`${this.name} (copy)`);
    return cloned;
  }

  static fromJSON(data: AudioComponentData): AudioComponent {
    const component = new AudioComponent(
      data.id,
      data.src,
      data.position,
      data.size,
      data.style
    );
    component.autoplay = data.autoplay;
    component.loop = data.loop;
    component.controls = data.controls;
    component.setLocked(data.locked);
    component.setVisible(data.visible);
    component.setName(data.name);
    return component;
  }
}
