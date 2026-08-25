import { ComponentType, type VideoComponentData, type ComponentStyle, type Position, type Size } from '../types.js';
import { BaseComponent } from './base-component.js';

export class VideoComponent extends BaseComponent {
  private videoData: VideoComponentData;

  constructor(
    id: string,
    src = '',
    position?: Position,
    size?: Size,
    style?: Partial<ComponentStyle>
  ) {
    super(ComponentType.Video, id, 'Video', position, size);
    this.videoData = {
      ...this.data,
      type: ComponentType.Video,
      src,
      poster: '',
      autoplay: false,
      loop: false,
      muted: false,
      controls: true,
    };
    if (style) {
      this.setStyle(style);
      this.videoData.style = this.data.style;
    }
  }

  get src(): string {
    return this.videoData.src;
  }

  set src(value: string) {
    this.videoData.src = value;
  }

  get poster(): string {
    return this.videoData.poster;
  }

  set poster(value: string) {
    this.videoData.poster = value;
  }

  get autoplay(): boolean {
    return this.videoData.autoplay;
  }

  set autoplay(value: boolean) {
    this.videoData.autoplay = value;
  }

  get loop(): boolean {
    return this.videoData.loop;
  }

  set loop(value: boolean) {
    this.videoData.loop = value;
  }

  get muted(): boolean {
    return this.videoData.muted;
  }

  set muted(value: boolean) {
    this.videoData.muted = value;
  }

  get controls(): boolean {
    return this.videoData.controls;
  }

  set controls(value: boolean) {
    this.videoData.controls = value;
  }

  setStyle(style: Partial<ComponentStyle>): void {
    super.setStyle(style);
    this.videoData.style = this.data.style;
  }

  toJSON(): VideoComponentData {
    return {
      ...this.data,
      type: ComponentType.Video,
      src: this.videoData.src,
      poster: this.videoData.poster,
      autoplay: this.videoData.autoplay,
      loop: this.videoData.loop,
      muted: this.videoData.muted,
      controls: this.videoData.controls,
    };
  }

  clone(newId: string): VideoComponent {
    const cloned = new VideoComponent(
      newId,
      this.videoData.src,
      this.position,
      this.size,
      this.style
    );
    cloned.poster = this.videoData.poster;
    cloned.autoplay = this.videoData.autoplay;
    cloned.loop = this.videoData.loop;
    cloned.muted = this.videoData.muted;
    cloned.controls = this.videoData.controls;
    cloned.setName(`${this.name} (copy)`);
    return cloned;
  }

  static fromJSON(data: VideoComponentData): VideoComponent {
    const component = new VideoComponent(
      data.id,
      data.src,
      data.position,
      data.size,
      data.style
    );
    component.poster = data.poster;
    component.autoplay = data.autoplay;
    component.loop = data.loop;
    component.muted = data.muted;
    component.controls = data.controls;
    component.setLocked(data.locked);
    component.setVisible(data.visible);
    component.setName(data.name);
    return component;
  }
}
