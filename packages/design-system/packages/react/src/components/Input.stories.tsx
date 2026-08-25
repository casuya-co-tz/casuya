import type { Meta, StoryObj } from '@storybook/react';
import { Input } from './Input';

const meta: Meta<typeof Input> = {
  title: 'Components/Input',
  component: Input,
  argTypes: {
    label: { control: 'text' },
    error: { control: 'text' },
    hint: { control: 'text' },
    disabled: { control: 'boolean' },
    placeholder: { control: 'text' },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: { placeholder: 'Enter text...' },
};

export const WithLabel: Story = {
  args: { label: 'Email', placeholder: 'you@school.edu' },
};

export const WithHint: Story = {
  args: { label: 'Password', placeholder: 'Enter password', hint: 'Must be at least 8 characters' },
};

export const WithError: Story = {
  args: {
    label: 'Email',
    placeholder: 'you@school.edu',
    error: 'Please enter a valid email address',
  },
};

export const Disabled: Story = {
  args: { label: 'Disabled', placeholder: 'Cannot edit', disabled: true },
};
