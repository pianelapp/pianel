import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const SRC = resolve(__dirname, '../src');
const SERVICE_LAYER_DIRS = ['hooks', 'host'];
const SERVICE_GETTER_CALL = /\bget[A-Z][A-Za-z]*Service\s*\(/;
const DYNAMIC_SERVICE_IMPORT = /\bimport\s*\(\s*['"]@pianel\/core\/services/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

function isTypeOnlyClause(clause: string): boolean {
  if (/^type\b/.test(clause)) return true;
  const braced = clause.match(/^\{([\s\S]*)\}$/);
  if (!braced) return false;
  return braced[1]
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .every(part => /^type\b/.test(part));
}

interface PresentationFile {
  path: string;
  source: string;
  runtimeServiceSpecs: string[];
}

function readPresentationFile(file: string): PresentationFile {
  const source = readFileSync(file, 'utf-8');
  const re = /^import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/gm;
  const runtimeServiceSpecs: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    if (isTypeOnlyClause(m[1].trim())) continue;
    if (m[2].startsWith('@pianel/core/services')) runtimeServiceSpecs.push(m[2]);
  }
  return { path: relative(SRC, file), source, runtimeServiceSpecs };
}

function isServiceLayer(relPath: string): boolean {
  const [top] = relPath.split(sep);
  return SERVICE_LAYER_DIRS.includes(top);
}

const presentation = walk(SRC)
  .map(readPresentationFile)
  .filter(f => !isServiceLayer(f.path));

describe('Renderer architecture boundaries', () => {
  it('imports core services into presentation only as types', () => {
    const violations = presentation.flatMap(f =>
      f.runtimeServiceSpecs.map(spec => `${f.path}: ${spec}`),
    );
    expect(violations).toEqual([]);
  });

  it('never calls a service-instance getter from presentation', () => {
    const violations = presentation
      .filter(f => SERVICE_GETTER_CALL.test(f.source))
      .map(f => f.path);
    expect(violations).toEqual([]);
  });

  it('never reaches a core service through a dynamic import', () => {
    const violations = presentation
      .filter(f => DYNAMIC_SERVICE_IMPORT.test(f.source))
      .map(f => f.path);
    expect(violations).toEqual([]);
  });

  it('scans the presentation files it is meant to cover', () => {
    const scanned = new Set(presentation.map(f => f.path));
    expect(scanned.size).toBeGreaterThan(30);
    for (const expected of [
      join('screens', 'setlists', 'SetlistDetail.tsx'),
      join('screens', 'display', 'QuickToneSlots.tsx'),
      join('components', 'NamingDialog.tsx'),
      'App.tsx',
    ]) {
      expect(scanned.has(expected)).toBe(true);
    }
  });
});
