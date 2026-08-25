/** Simple release helper: bumps package.json version and writes a
 * CHANGELOG.md entry stub. Run with `node scripts/release.js <patch|minor|major>`. */

import { readFileSync, writeFileSync } from 'node:fs';

const part = process.argv[2] ?? 'patch';
const pkgPath = new URL('../package.json', import.meta.url);
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

const [major, minor, patch] = pkg.version.split('.').map(Number);
const next =
  part === 'major'
    ? `${major + 1}.0.0`
    : part === 'minor'
    ? `${major}.${minor + 1}.0`
    : `${major}.${minor}.${patch + 1}`;

pkg.version = next;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

const changelogPath = new URL('../CHANGELOG.md', import.meta.url);
const changelog = readFileSync(changelogPath, 'utf8');
const today = new Date().toISOString().slice(0, 10);
const entry = `## [${next}] - ${today}\n\n### Changed\n- \n\n`;
writeFileSync(changelogPath, changelog.replace('# Changelog\n\n', `# Changelog\n\n${entry}`));

console.log(`Bumped version to ${next}`);
