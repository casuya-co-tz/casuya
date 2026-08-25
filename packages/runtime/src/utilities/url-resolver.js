export function urlResolver(baseUrl, relativePath) {
  if (!relativePath) return baseUrl;
  if (relativePath.startsWith('data:') || relativePath.startsWith('blob:') || relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath;
  }
  const base = baseUrl.endsWith('/') ? baseUrl : baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
  const parts = relativePath.split('/');
  const stack = base.split('/');
  if (stack[stack.length - 1] === '') stack.pop();
  for (const part of parts) {
    if (part === '.' || part === '') continue;
    if (part === '..') {
      if (stack.length > 0) stack.pop();
    } else {
      stack.push(part);
    }
  }
  return stack.join('/');
}
