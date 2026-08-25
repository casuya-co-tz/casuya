import type { Meta, StoryObj } from '@storybook/react';
import { Card } from './Card';
import { Text } from './Text';

const meta: Meta<typeof Card> = {
  title: 'Components/Card',
  component: Card,
  argTypes: {
    variant: { control: 'select', options: ['elevated', 'outlined', 'filled'] },
    padding: { control: 'select', options: ['none', 'sm', 'md', 'lg'] },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Elevated: Story = {
  args: {
    variant: 'elevated',
    children: <Text>This is an elevated card with a shadow.</Text>,
  },
};

export const Outlined: Story = {
  args: {
    variant: 'outlined',
    children: <Text>This is an outlined card with a border.</Text>,
  },
};

export const Filled: Story = {
  args: {
    variant: 'filled',
    children: <Text>This is a filled card with a background.</Text>,
  },
};
