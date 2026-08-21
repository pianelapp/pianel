import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const [dirA, dirB] = process.argv.slice(2);

function leaves(file) {
  const text = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const out = [];
  const isJSDoc = node =>
    node.kind >= ts.SyntaxKind.FirstJSDocNode &&
    node.kind <= ts.SyntaxKind.LastJSDocNode;
  const walk = node => {
    if (isJSDoc(node)) return;
    const kids = node.getChildren(sf);
    if (kids.length === 0) {
      if (node.kind !== ts.SyntaxKind.EndOfFileToken) {
        out.push(`${node.kind}|${node.getText(sf)}`);
      }
      return;
    }
    for (const kid of kids) walk(kid);
  };
  walk(sf);
  return out;
}

function walkDir(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walkDir(p, acc);
    else if (/\.tsx?$/.test(entry.name)) acc.push(p);
  }
  return acc;
}

let same = 0;
const diverged = [];

for (const orig of walkDir(dirA)) {
  const rel = path.relative(dirA, orig);
  const a = leaves(orig);
  const b = leaves(path.join(dirB, rel));
  if (a.length === b.length && a.every((x, i) => x === b[i])) {
    same += 1;
  } else {
    const at = a.findIndex((x, i) => x !== b[i]);
    diverged.push({rel, a: a.length, b: b.length, at, sample: [a[at], b[at]]});
  }
}

console.log(`AST-token-identical: ${same} / ${same + diverged.length}`);
for (const d of diverged) {
  console.log(`  DIVERGES ${d.rel}  ${d.a} vs ${d.b} tokens, first at ${d.at}`);
  console.log(`    A: ${JSON.stringify(d.sample[0])}`);
  console.log(`    B: ${JSON.stringify(d.sample[1])}`);
}
process.exit(diverged.length === 0 ? 0 : 1);
