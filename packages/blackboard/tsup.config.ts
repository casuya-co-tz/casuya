import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts',
    },
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    target: 'es2022',
    external: ['mathjs'],
  },
  {
    entry: {
      'blackboard.umd': 'src/browser-core.ts',
    },
    format: ['iife'],
    sourcemap: true,
    clean: true,
    target: 'es2022',
    globalName: 'CasuyaBlackboard',
    outExtension() {
      return { js: '.js' };
    },
  },
]);
