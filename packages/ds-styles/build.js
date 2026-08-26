const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const distDir = path.join(__dirname, 'dist');

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.css'));
for (const file of files) {
  const content = fs.readFileSync(path.join(srcDir, file), 'utf-8');
  fs.writeFileSync(path.join(distDir, file), content);
  console.log(`Copied ${file} -> dist/${file}`);
}

// Build index.css from tokens + reset
const tokensPath = path.join(__dirname, '..', 'tokens', 'src', 'tokens.css');
const resetPath = path.join(srcDir, 'reset.css');
const indexParts = [];

if (fs.existsSync(tokensPath)) {
  indexParts.push(fs.readFileSync(tokensPath, 'utf-8'));
}
if (fs.existsSync(resetPath)) {
  indexParts.push(fs.readFileSync(resetPath, 'utf-8'));
}

fs.writeFileSync(path.join(distDir, 'index.css'), indexParts.join('\n\n'));
console.log('Built dist/index.css');
