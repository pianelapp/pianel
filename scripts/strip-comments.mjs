import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const PRESERVE =
  /eslint-disable|eslint-enable|eslint-env|@ts-expect-error|@ts-ignore|@ts-nocheck|prettier-ignore|istanbul ignore|@jest-environment|@jsx|<reference/;

const SENTINEL = String.fromCharCode(0);

function commentRanges(text, fileName) {
  const kind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    true,
    kind,
  );
  const seen = new Map();

  const add = ranges => {
    for (const r of ranges ?? []) {
      if (PRESERVE.test(text.slice(r.pos, r.end))) continue;
      seen.set(`${r.pos}:${r.end}`, [r.pos, r.end]);
    }
  };

  const walk = node => {
    add(ts.getLeadingCommentRanges(text, node.getFullStart()));
    add(ts.getTrailingCommentRanges(text, node.end));
    for (const child of node.getChildren(sf)) walk(child);
  };
  walk(sf);

  return [...seen.values()].sort((a, b) => b[0] - a[0]);
}

function tidy(text) {
  const lines = text.split('\n').flatMap(line => {
    if (!line.includes(SENTINEL)) return [line.replace(/\s+$/, '')];
    const bare = line.split(SENTINEL).join('');
    return bare.trim() === '' ? [] : [bare.replace(/\s+$/, '')];
  });

  const out = [];
  for (const line of lines) {
    if (line === '' && (out.length === 0 || out[out.length - 1] === '')) continue;
    out.push(line);
  }
  while (out.length && out[out.length - 1] === '') out.pop();
  return out.join('\n') + '\n';
}

const dryRun = process.argv.includes('--dry-run');
const files = process.argv
  .slice(2)
  .filter(a => !a.startsWith('--') && a !== import.meta.filename);

let stripped = 0;
let kept = 0;

for (const file of files) {
  const abs = path.resolve(file);
  const original = fs.readFileSync(abs, 'utf8');
  const ranges = commentRanges(original, abs);

  let next = original;
  for (const [pos, end] of ranges) {
    next = next.slice(0, pos) + SENTINEL + next.slice(end);
  }
  next = tidy(next);

  const directives = (original.match(PRESERVE) ?? []).length;
  stripped += ranges.length;
  kept += directives;

  const delta = original.split('\n').length - next.split('\n').length;
  console.log(
    `${String(ranges.length).padStart(4)} stripped ${String(delta).padStart(
      4,
    )} lines  ${file}`,
  );
  if (!dryRun && next !== original) fs.writeFileSync(abs, next);
}

console.log(
  `\n${files.length} files, ${stripped} comments stripped, ${kept} directives kept${
    dryRun ? '  (dry run)' : ''
  }`,
);
