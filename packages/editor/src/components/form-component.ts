import { ComponentType, type FormComponentData, type FormField, type ComponentStyle, type Position, type Size } from '../types.js';
import { BaseComponent } from './base-component.js';
import { generateId } from '../utils/id-generator.js';

export class FormComponent extends BaseComponent {
  private formData: FormComponentData;

  constructor(
    id: string,
    title = 'Form',
    position?: Position,
    size?: Size,
    style?: Partial<ComponentStyle>
  ) {
    super(ComponentType.Form, id, 'Form', position, size);
    this.formData = {
      ...this.data,
      type: ComponentType.Form,
      title,
      fields: [],
      submitLabel: 'Submit',
      action: '',
    };
    if (style) {
      this.setStyle(style);
      this.formData.style = this.data.style;
    }
  }

  get title(): string {
    return this.formData.title;
  }

  set title(value: string) {
    this.formData.title = value;
  }

  get fields(): FormField[] {
    return [...this.formData.fields];
  }

  get submitLabel(): string {
    return this.formData.submitLabel;
  }

  set submitLabel(value: string) {
    this.formData.submitLabel = value;
  }

  get action(): string {
    return this.formData.action;
  }

  set action(value: string) {
    this.formData.action = value;
  }

  addField(
    label: string,
    type: FormField['type'] = 'text',
    required = false
  ): FormField {
    const field: FormField = {
      id: generateId(),
      label,
      type,
      required,
      placeholder: '',
      options: [],
      validation: '',
    };
    this.formData.fields.push(field);
    return field;
  }

  removeField(fieldId: string): boolean {
    const index = this.formData.fields.findIndex((f) => f.id === fieldId);
    if (index === -1) return false;
    this.formData.fields.splice(index, 1);
    return true;
  }

  updateField(fieldId: string, updates: Partial<FormField>): boolean {
    const field = this.formData.fields.find((f) => f.id === fieldId);
    if (!field) return false;
    Object.assign(field, updates);
    return true;
  }

  moveField(fieldId: string, newIndex: number): boolean {
    const currentIndex = this.formData.fields.findIndex((f) => f.id === fieldId);
    if (currentIndex === -1) return false;
    if (newIndex < 0 || newIndex >= this.formData.fields.length) return false;
    const [field] = this.formData.fields.splice(currentIndex, 1);
    this.formData.fields.splice(newIndex, 0, field);
    return true;
  }

  getFieldCount(): number {
    return this.formData.fields.length;
  }

  getRequiredFields(): FormField[] {
    return this.formData.fields.filter((f) => f.required);
  }

  setStyle(style: Partial<ComponentStyle>): void {
    super.setStyle(style);
    this.formData.style = this.data.style;
  }

  toJSON(): FormComponentData {
    return {
      ...this.data,
      type: ComponentType.Form,
      title: this.formData.title,
      fields: this.formData.fields,
      submitLabel: this.formData.submitLabel,
      action: this.formData.action,
    };
  }

  clone(newId: string): FormComponent {
    const cloned = new FormComponent(
      newId,
      this.formData.title,
      this.position,
      this.size,
      this.style
    );
    cloned.formData.fields = JSON.parse(JSON.stringify(this.formData.fields));
    cloned.submitLabel = this.formData.submitLabel;
    cloned.action = this.formData.action;
    cloned.setName(`${this.name} (copy)`);
    return cloned;
  }

  static fromJSON(data: FormComponentData): FormComponent {
    const component = new FormComponent(
      data.id,
      data.title,
      data.position,
      data.size,
      data.style
    );
    component.formData.fields = data.fields;
    component.submitLabel = data.submitLabel;
    component.action = data.action;
    component.setLocked(data.locked);
    component.setVisible(data.visible);
    component.setName(data.name);
    return component;
  }
}
