import React from 'react';
import type { Preview } from '@storybook/react';
import '../../../packages/tokens/src/tokens.css';
import '../../../packages/theme/src/themes/dark.css';

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    viewport: {
      viewports: {
        xs: { name: 'XS', styles: { width: '360px', height: '640px' } },
        sm: { name: 'SM', styles: { width: '640px', height: '800px' } },
        md: { name: 'MD', styles: { width: '768px', height: '900px' } },
        lg: { name: 'LG', styles: { width: '1024px', height: '768px' } },
        xl: { name: 'XL', styles: { width: '1280px', height: '900px' } },
      },
    },
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#FFFFFF' },
        { name: 'dark', value: '#111827' },
        { name: 'high-contrast', value: '#000000' },
      ],
    },
  },
  decorators: [
    (Story) => (
      <div style={{ fontFamily: 'var(--casuya-font-sans)', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
};

export default preview;
