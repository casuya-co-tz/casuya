export function semverCompare(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

export function satisfies(version, range) {
  if (range === '*' || range === 'x') return true;

  const [op, ver] = range.match(/^([<>=!~^]+)?(.+)$/)?.slice(1) || ['=', range];

  const cmp = semverCompare(version, ver);

  switch (op) {
    case '>=': return cmp >= 0;
    case '<=': return cmp <= 0;
    case '>': return cmp > 0;
    case '<': return cmp < 0;
    case '~': {
      const vParts = ver.split('.');
      const versionParts = version.split('.');
      return vParts[0] === versionParts[0] && vParts[1] === versionParts[1];
    }
    case '^': {
      const vParts = ver.split('.');
      const versionParts = version.split('.');
      return vParts[0] === versionParts[0] && semverCompare(version, ver) >= 0;
    }
    case '=':
    default: return cmp === 0;
  }
}
