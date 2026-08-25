/** Builds dist/casuya-bridge.esm.js (ESM), .js (IIFE global), and .min.js
 * using esbuild. Run with `npm run build`. */

import { build } from 'esbuild';
import { mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = resolve(__dirname, '..', 'dist');
if (!existsSync(dist)) mkdirSync(dist, { recursive: true });

const entryPoint = resolve(__dirname, '..', 'src', 'index.js');

async function run() {
  // ESM build
  await build({
    entryPoints: [entryPoint],
    outfile: resolve(dist, 'casuya-bridge.esm.js'),
    format: 'esm',
    bundle: true,
    sourcemap: true,
    target: ['es2020'],
  });

  // IIFE global build (window.CasuyaBridge)
  await build({
    entryPoints: [entryPoint],
    outfile: resolve(dist, 'casuya-bridge.js'),
    format: 'iife',
    globalName: 'CasuyaBridgeLib',
    bundle: true,
    sourcemap: true,
    target: ['es2020'],
  });

  // Minified IIFE build
  await build({
    entryPoints: [entryPoint],
    outfile: resolve(dist, 'casuya-bridge.min.js'),
    format: 'iife',
    globalName: 'CasuyaBridgeLib',
    bundle: true,
    minify: true,
    sourcemap: true,
    target: ['es2020'],
  });

  console.log('Build complete: dist/casuya-bridge.{js,esm.js,min.js}');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
