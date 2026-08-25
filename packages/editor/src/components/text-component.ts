import { ComponentType, type TextComponentData, type ComponentStyle, type Position, type Size } from '../types.js';
import { BaseComponent } from './base-component.js';

export class TextComponent extends BaseComponent {
  private textData: TextComponentData;

  constructor(
    id: string,
    content = '',
    position?: Position,
    size?: Size,
    style?: Partial<ComponentStyle>
  ) {
    super(ComponentType.Text, id, 'Text', position, size);
    this.textData = {
      ...this.data,
      type: ComponentType.Text,
      content,
      markdown: false,
    };
    if (style) {
      this.setStyle(style);
      this.textData.style = this.data.style;
    }
  }

  get content(): string {
    return this.textData.content;
  }

  set content(value: string) {
    this.textData.content = value;
  }

  get markdown(): boolean {
    return this.textData.markdown;
  }

  set markdown(value: boolean) {
    this.textData.markdown = value;
  }

  getPlainText(): string {
    if (!this.textData.markdown) return this.textData.content;
    return this.textData.content
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1');
  }

  getWordCount(): number {
    return this.getPlainText().trim().split(/\s+/).filter(Boolean).length;
  }

  getCharacterCount(): number {
    return this.getPlainText().length;
  }

  setStyle(style: Partial<ComponentStyle>): void {
    super.setStyle(style);
    this.textData.style = this.data.style;
  }

  toJSON(): TextComponentData {
    return {
      ...this.data,
      type: ComponentType.Text,
      content: this.textData.content,
      markdown: this.textData.markdown,
    };
  }

  clone(newId: string): TextComponent {
    const cloned = new TextComponent(
      newId,
      this.textData.content,
      this.position,
      this.size,
      this.style
    );
    cloned.markdown = this.textData.markdown;
    cloned.setName(`${this.name} (copy)`);
    return cloned;
  }

  static fromJSON(data: TextComponentData): TextComponent {
    const component = new TextComponent(
      data.id,
      data.content,
      data.position,
      data.size,
      data.style
    );
    component.markdown = data.markdown;
    component.setLocked(data.locked);
    component.setVisible(data.visible);
    component.setName(data.name);
    return component;
  }
}
