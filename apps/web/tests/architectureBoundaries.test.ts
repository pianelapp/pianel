/**
 * Task 9.2 — architecture-boundary enforcement.
 *
 * Statically verifies the web host depends on `@pianel/core` only through the
 * established ports/service facades and on `@pianel/ui` only through
 * App/components/hooks/store/transport — preserving the dependency direction
 * (presentation → services via hooks → engine + transport) and never importing
 * engine protocol logic (DT1/RQ1 SysEx, parsers, address maps, tone catalog)
 * directly into the web app source.
 *
 * Scans `apps/web/src/**` (production source; tests may wire engines for
 * fixtures and are excluded).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SRC = resolve(__dirname, '../src');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

function importsOf(file: string): string[] {
  const src = readFileSync(file, 'utf-8');
  const re = /from\s+['"]([^'"]+)['"]/g;
  const specs: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) specs.push(m[1]);
  return specs;
}

const files = walk(SRC);
const allImports = files.flatMap((f) => importsOf(f).map((spec) => ({ f, spec })));

describe('Web host architecture boundaries', () => {
  it('never imports engine/protocol internals from core', () => {
    // Engine protocol knowledge (SysEx builders, parsers, addresses, tones) must
    // stay behind the engine boundary — the web app must not reach into it.
    const forbidden = allImports.filter(({ spec }) =>
      /^@pianel\/core\/engine\b/.test(spec) ||
      /^@pianel\/core\/.*\/(parser|sysex|addresses|tones)\b/.test(spec),
    );
    expect(forbidden.map((x) => `${x.f}: ${x.spec}`)).toEqual([]);
  });

  it('imports core only via service facades / ports / store', () => {
    const coreImports = allImports.filter(({ spec }) =>
      spec.startsWith('@pianel/core'),
    );
    const allowed = /^@pianel\/core(\/(services|store|transport\/types|transport$))/;
    const violations = coreImports.filter(({ spec }) => {
      if (spec === '@pianel/core' || spec === '@pianel/core/store') return false;
      if (spec === '@pianel/core/store/storage') return false;
      if (spec === '@pianel/core/transport/types') return false;
      return !allowed.test(spec);
    });
    expect(violations.map((x) => `${x.f}: ${x.spec}`)).toEqual([]);
  });

  it('consumes shared renderer presentation only via hooks/components/App/store/transport/host', () => {
    const uiImports = allImports.filter(({ spec }) => spec.startsWith('@pianel/ui'));
    const allowed =
      /^@pianel\/ui(\/(App$|hooks\/|components\/|store$|transport\/|host\/))/;
    const violations = uiImports.filter(
      ({ spec }) => spec !== '@pianel/ui' && !allowed.test(spec),
    );
    expect(violations.map((x) => `${x.f}: ${x.spec}`)).toEqual([]);
  });
});
