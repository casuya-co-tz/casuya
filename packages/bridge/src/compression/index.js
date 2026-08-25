/** Lightweight compression utilities for sync payloads and stored data.
 * Uses built-in CompressionStream when available, falls back to
 * JSON minification for environments without streaming compression. */

import { CompressionError } from '../core/errors.js';

export async function compress(data) {
  try {
    const json = JSON.stringify(data);
    if (typeof CompressionStream !== 'undefined') {
      const encoded = new TextEncoder().encode(json);
      const stream = new CompressionStream('gzip');
      const writer = stream.writable.getWriter();
      writer.write(encoded);
      writer.close();
      const reader = stream.readable.getReader();
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const combined = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      return btoa(String.fromCharCode(...combined));
    }
    const minified = json.replace(/\s+/g, '');
    return btoa(unescape(encodeURIComponent(minified)));
  } catch (err) {
    throw new CompressionError('Compression failed', { cause: err });
  }
}

export async function decompress(payload) {
  try {
    if (typeof DecompressionStream !== 'undefined') {
      const raw = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
      const stream = new DecompressionStream('gzip');
      const writer = stream.writable.getWriter();
      writer.write(raw);
      writer.close();
      const reader = stream.readable.getReader();
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const combined = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      return JSON.parse(new TextDecoder().decode(combined));
    }
    const decoded = decodeURIComponent(escape(atob(payload)));
    return JSON.parse(decoded);
  } catch (err) {
    throw new CompressionError('Decompression failed', { cause: err });
  }
}