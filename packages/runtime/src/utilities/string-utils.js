export function byteSize(str) {
  if (typeof str !== 'string') return 0;
  let size = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 0x80) {
      size += 1;
    } else if (code < 0x800) {
      size += 2;
    } else if (code < 0xD800 || code >= 0xE000) {
      size += 3;
    } else {
      i++;
      size += 4;
    }
  }
  return size;
}

export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function truncate(str, maxLength, suffix = '...') {
  if (!str || str.length <= maxLength) return str || '';
  return str.substring(0, maxLength - suffix.length) + suffix;
}
