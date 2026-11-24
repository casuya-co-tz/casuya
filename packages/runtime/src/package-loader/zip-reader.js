/**
 * Minimal, dependency-free ZIP reader for lesson packages.
 *
 * Supports stored (method 0) and deflate (method 8) entries. Deflate uses the
 * native `DecompressionStream('deflate-raw')` available in modern browsers; on
 * older engines an unsupported archive throws so the package parser can fall
 * back to its heuristic extractor instead of failing the whole load.
 *
 * Only the central directory is trusted for sizes/offsets. Entries are
 * sanitized (no absolute paths or `..` traversal) and bounded to avoid zip
 * bombs on low-end devices.
 */

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
const LOC_SIG = 0x04034b50;
const EOCD_MIN_SIZE = 22;
const MAX_COMMENT = 65535;

const DEFAULT_MAX_ENTRY_BYTES = 32 * 1024 * 1024;
const DEFAULT_MAX_TOTAL_BYTES = 64 * 1024 * 1024;

export function isZip(bytes) {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function isSafeEntryName(name) {
  if (!name || name.startsWith('/') || name.startsWith('\\')) return false;
  if (/^[a-zA-Z]:/.test(name)) return false;
  return !name.split(/[\\/]/).some((segment) => segment === '..');
}

/**
 * Parse the ZIP central directory.
 * @param {Uint8Array} bytes
 * @returns {Array<{filename: string, method: number, compressedSize: number, size: number, offset: number}>}
 */
export function readZipDirectory(bytes) {
  if (!isZip(bytes) || bytes.length < EOCD_MIN_SIZE) {
    throw new Error('Not a ZIP archive');
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const searchStart = Math.max(0, bytes.length - EOCD_MIN_SIZE - MAX_COMMENT);
  let eocd = -1;
  for (let i = bytes.length - EOCD_MIN_SIZE; i >= searchStart; i--) {
    if (view.getUint32(i, true) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('ZIP end-of-central-directory not found');

  const entryCount = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  if (offset >= bytes.length) throw new Error('Invalid ZIP central directory offset');

  const entries = [];
  for (let i = 0; i < entryCount; i++) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== CEN_SIG) {
      throw new Error('Corrupt ZIP central directory');
    }
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > bytes.length) throw new Error('Corrupt ZIP entry name');

    const filename = new TextDecoder().decode(bytes.subarray(nameStart, nameEnd));
    if (isSafeEntryName(filename) && !filename.endsWith('/')) {
      entries.push({ filename, method, compressedSize, size, offset: localOffset });
    }
    offset = nameEnd + extraLength + commentLength;
  }
  return entries;
}

/**
 * Read and decompress a single entry returned by {@link readZipDirectory}.
 * @param {Uint8Array} bytes
 * @param {{filename: string, method: number, compressedSize: number, size: number, offset: number}} entry
 * @param {{maxEntryBytes?: number, maxTotalBytes?: number}} [limits]
 * @returns {Promise<Uint8Array>}
 */
export async function readZipEntry(bytes, entry, limits = {}) {
  const maxEntryBytes = limits.maxEntryBytes ?? DEFAULT_MAX_ENTRY_BYTES;
  const maxTotalBytes = limits.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES;

  if (entry.size > maxEntryBytes) {
    throw new Error(`ZIP entry too large: ${entry.filename}`);
  }
  if (entry.size > maxTotalBytes) {
    throw new Error('ZIP package exceeds size limit');
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const local = entry.offset;
  if (local + 30 > bytes.length || view.getUint32(local, true) !== LOC_SIG) {
    throw new Error(`Corrupt ZIP local header: ${entry.filename}`);
  }
  const nameLength = view.getUint16(local + 26, true);
  const extraLength = view.getUint16(local + 28, true);
  const dataStart = local + 30 + nameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > bytes.length) throw new Error(`Truncated ZIP entry: ${entry.filename}`);

  const raw = bytes.subarray(dataStart, dataEnd);

  if (entry.method === 0) return raw;
  if (entry.method !== 8) {
    throw new Error(`Unsupported ZIP compression method ${entry.method}`);
  }
  return inflateRaw(raw, maxEntryBytes);
}

async function inflateRaw(data, maxBytes) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Deflate decompression is not supported in this browser');
  }
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const buffer = await new Response(stream).arrayBuffer();
  if (buffer.byteLength > maxBytes) throw new Error('ZIP entry exceeds size limit');
  return new Uint8Array(buffer);
}
