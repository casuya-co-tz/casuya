// tools/split-blackboard.mjs
// Split packages/blackboard/src/Blackboard.ts (a single large class) into:
//   src/blackboard/base.ts            - fields, constructor, static members, `declare` stubs
//   src/blackboard/traits/<name>.ts   - method groups as mixin classes
//   src/Blackboard.ts                 - composition class (extends mixin chain)
// Uses the TypeScript compiler API for robust parsing.
import ts from "typescript";
import fs from "fs";
import path from "path";

const PKG = "packages/blackboard";
const input = path.join(PKG, "src/Blackboard.ts");
const outDir = path.join(PKG, "src/blackboard");
const traitsDir = path.join(outDir, "traits");
const text = fs.readFileSync(input, "utf8");
const sf = ts.createSourceFile("Blackboard.ts", text, ts.ScriptTarget.Latest, true);

function findClass(n) {
  if (ts.isClassDeclaration(n) && n.name && n.name.text === "Blackboard") return n;
  let found = null;
  ts.forEachChild(n, (c) => { if (!found) found = findClass(c); });
  return found;
}
const cls = findClass(sf);

// exported type/interface/enum names from types.ts
const typesText = fs.readFileSync(path.join(PKG, "src/types.ts"), "utf8");
const tsf = ts.createSourceFile("types.ts", typesText, ts.ScriptTarget.Latest, true);
const typeNames = new Set();
ts.forEachChild(tsf, (n) => {
  if ((ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n) || ts.isEnumDeclaration(n)) && n.name) typeNames.add(n.name.text);
});

const helperFromUtils = ["IS_MOBILE", "uid", "isInInput"];
const helperFromTheme = ["THEMES", "MOBILE_STYLES", "injectMobileStyles"];
const helperFromToolbar = ["createToolbar", "updateToolbarState"];
const helperImportLine = (spec, names) =>
  names.length ? `import { ${names.join(", ")} } from '${spec}';` : "";

function classify(name) {
  const n = name || "";
  if (/collab|remote|cursor|peer|socket|sync|broadcast|presence|user|signal|awareness/i.test(n)) return "collab";
  if (/save|load|storage|serial|snapshot|autosave|download|upload|file|json|export|import|toDataURL|toSVG|toPNG|toImage|deserialize|persist/i.test(n)) return "persistence";
  if (/pointer|mouse|touch|key|event|drag|drop|wheel|gesture|pinch|pan|zoom|click|handler|listener|bind|unbind|keydown|keyup/i.test(n)) return "input";
  if (/toolbar|menu|overlay|modal|toast|dialog|contextmenu|help|panel|button|theme|appearance|notify|ui/i.test(n)) return "ui";
  if (/render|draw|paint|canvas|ctx|redraw|frame|layer|thumb|compose/i.test(n)) return "render";
  if (/pen|eraser|shape|text|image|sticky|laser|brush|color|fill|stroke|handwriting|math|latex|katex|graph|select|resize|rotate|duplicate|copy|paste|clipboard|delete|undo|redo|tool/i.test(n)) return "tools";
  if (/point|segment|distance|geometry|coord|world|screen|intersect|bound|hit|transform|vector|angle|bbox|polygon/i.test(n)) return "geometry";
  return "misc";
}

function hasModifier(node, kind) {
  return node.modifiers && node.modifiers.some((x) => x.kind === kind);
}

const baseParts = [];
const traitMembers = {};
const importLines = [];
for (const st of sf.statements) {
  if (ts.isImportDeclaration(st)) importLines.push(text.slice(st.getStart(sf), st.end));
}

function replaceSelf(s) {
  return s.replace(/\bBlackboard\./g, "BlackboardBase.").replace(/\bBlackboard\b/g, "BlackboardBase");
}

function makeStub(sig, kind) {
  if (kind === "get") return `${sig} { return undefined as any; }`;
  if (kind === "set") return `${sig} { }`;
  return `${sig} { return undefined as any; }`;
}

for (const m of cls.members) {
  if (ts.isConstructorDeclaration(m)) {
    baseParts.push(replaceSelf(text.slice(m.getStart(sf), m.end)));
    continue;
  }
  if (ts.isPropertyDeclaration(m)) {
    let t = replaceSelf(text.slice(m.getStart(sf), m.end));
    t = t.replace(/^(\s*)(private|protected)\s+/, "$1");
    baseParts.push(t);
    continue;
  }
  if (ts.isMethodDeclaration(m)) {
    const name = m.name.getText(sf);
    if (hasModifier(m, ts.SyntaxKind.StaticKeyword)) {
      baseParts.push(replaceSelf(text.slice(m.getStart(sf), m.end)));
      continue;
    }
    const trait = classify(name);
    const impl = replaceSelf(text.slice(m.getStart(sf), m.end)).replace(/^(\s*)(private|protected)\s+/, "$1");
    let sig = replaceSelf(text.slice(m.getStart(sf), m.body ? m.body.getStart(sf) : m.getStart(sf))).trim();
    sig = sig.replace(/^\s*(public\s+|private\s+|protected\s+|async\s+)/, "");
    const stub = makeStub(sig, "method");
    (traitMembers[trait] = traitMembers[trait] || []).push({ impl, stub });
    continue;
  }
  if (ts.isGetAccessorDeclaration(m) || ts.isSetAccessorDeclaration(m)) {
    const name = m.name.getText(sf);
    if (hasModifier(m, ts.SyntaxKind.StaticKeyword)) {
      baseParts.push(replaceSelf(text.slice(m.getStart(sf), m.end)));
      continue;
    }
    const trait = classify(name);
    const impl = replaceSelf(text.slice(m.getStart(sf), m.end)).replace(/^(\s*)(private|protected)\s+/, "$1");
    const bodyStart = m.body ? m.body.getStart(sf) : m.getStart(sf);
    let sig = replaceSelf(text.slice(m.getStart(sf), bodyStart)).trim();
    sig = sig.replace(/^\s*(public\s+|private\s+|protected\s+|async\s+)/, "");
    const stub = makeStub(sig, ts.isGetAccessorDeclaration(m) ? "get" : "set");
    (traitMembers[trait] = traitMembers[trait] || []).push({ impl, stub });
    continue;
  }
  baseParts.push(replaceSelf(text.slice(m.getStart(sf), m.end)));
}

const TRAIT_ORDER = ["geometry", "render", "tools", "input", "ui", "collab", "persistence", "misc"];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const mixinName = (s) => cap(s) + "Mixin";

const typeImport = `import type { ${[...typeNames].join(", ")} } from '../../types';`;
const helperImport = [
  helperImportLine("../../utils", helperFromUtils),
  helperImportLine("../../theme", helperFromTheme),
  helperImportLine("../../toolbar", helperFromToolbar),
  `import { BlackboardBase, Constructor } from '../base';`,
].filter(Boolean).join("\n");
const baseImports = [
  `import type { ${[...typeNames].join(", ")} } from '../types';`,
  helperImportLine("../utils", helperFromUtils),
  helperImportLine("../theme", helperFromTheme),
  helperImportLine("../toolbar", helperFromToolbar),
  "",
  `export type Constructor<T = {}> = new (...args: any[]) => T;`,
].filter(Boolean).join("\n");

// base.ts
let base = baseImports + "\n\nexport class BlackboardBase {\n";
base += baseParts.join("\n\n") + "\n\n";
for (const trait of TRAIT_ORDER) {
  for (const mem of traitMembers[trait] || []) base += "  " + mem.stub + "\n";
}
base += "}\n";
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(traitsDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "base.ts"), base);

// trait files
for (const trait of TRAIT_ORDER) {
  const mems = traitMembers[trait];
  if (!mems || !mems.length) continue;
  let f = `${typeImport}\n${helperImport}\n\nexport const ${mixinName(trait)} = <T extends Constructor<BlackboardBase>>(Base: T) => class ${cap(trait)}Trait extends Base {\n`;
  for (const mem of mems) f += mem.impl + "\n\n";
  f += "};\n";
  fs.writeFileSync(path.join(traitsDir, `${trait}.ts`), f);
}

// Blackboard.ts composition
const chain = TRAIT_ORDER.filter((t) => traitMembers[t] && traitMembers[t].length)
  .map(mixinName)
  .reduce((acc, name) => `${name}(${acc})`, "BlackboardBase");
const blackboard = `import { BlackboardBase } from './blackboard/base';
import { GeometryMixin } from './blackboard/traits/geometry';
import { RenderMixin } from './blackboard/traits/render';
import { ToolsMixin } from './blackboard/traits/tools';
import { InputMixin } from './blackboard/traits/input';
import { UiMixin } from './blackboard/traits/ui';
import { CollabMixin } from './blackboard/traits/collab';
import { PersistenceMixin } from './blackboard/traits/persistence';
import { MiscMixin } from './blackboard/traits/misc';
import type { BlackboardAPI } from './types';

const BlackboardImpl = ${chain};
export class Blackboard extends BlackboardImpl implements BlackboardAPI {}
`;
fs.writeFileSync(input, blackboard);

console.log("Split Blackboard into base + traits:", TRAIT_ORDER.filter((t) => traitMembers[t] && traitMembers[t].length).join(", "));
console.log("Base parts (fields/ctor/static):", baseParts.length, "| total trait methods:", Object.values(traitMembers).reduce((a, b) => a + b.length, 0));
