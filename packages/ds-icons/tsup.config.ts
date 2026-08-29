import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: {
    compilerOptions: { jsx: 'react-jsx' },
  },
  clean: true,
  external: ['react'],
});
