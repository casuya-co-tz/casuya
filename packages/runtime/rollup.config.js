import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

const production = process.env.PRODUCTION;

export default {
  input: 'src/index.js',
  output: [
    {
      file: 'dist/casuya-runtime.js',
      format: 'iife',
      name: 'CasuyaRuntime',
      sourcemap: !production,
      globals: {}
    },
    {
      file: 'dist/casuya-runtime.min.js',
      format: 'iife',
      name: 'CasuyaRuntime',
      sourcemap: false,
      plugins: [terser({
        compress: {
          drop_console: production,
          drop_debugger: production
        },
        mangle: true
      })]
    },
    {
      file: 'dist/casuya-runtime.esm.js',
      format: 'es',
      sourcemap: !production
    }
  ],
  plugins: [
    nodeResolve({ browser: true }),
    commonjs()
  ],
  external: []
};
