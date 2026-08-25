export function truncate(str: string, maxLength: number, suffix: string = '...'): string {
  if (str.length <= maxLength) return str;
  if (maxLength <= suffix.length) return suffix.slice(0, maxLength);
  return str.slice(0, maxLength - suffix.length).trimEnd() + suffix;
}
