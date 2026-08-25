/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2022',
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'CasuyaEditor',
      formats: ['es', 'cjs'],
      fileName: 'index',
    },
    rollupOptions: {
      external: [],
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
