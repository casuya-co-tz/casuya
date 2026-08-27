import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@casuya/ds-react': resolve(root, '../../packages/ds-react/src/index.ts'),
      '@casuya/ds-icons': resolve(root, '../../packages/ds-icons/src/index.ts'),
      '@casuya/ds-theme': resolve(root, '../../packages/ds-theme/src/index.ts'),
      '@casuya/ds-a11y': resolve(root, '../../packages/ds-a11y/src/index.ts'),
      '@casuya/ds-tokens': resolve(root, '../../packages/ds-tokens/src/index.ts'),
      '@casuya/ds-hooks': resolve(root, '../../packages/ds-hooks/src/index.ts'),
    },
  },
});
