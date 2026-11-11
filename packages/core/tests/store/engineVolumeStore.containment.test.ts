import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import {join, relative, resolve} from 'node:path';

const CORE_SRC = resolve(__dirname, '../../src');
const UI_SRC = resolve(__dirname, '../../../ui/src');

const STORE_REFERENCE = /engineVolumeStore|useEngineVolumeStore/;

const CORE_ALLOWED = [
  join('store', 'engineVolumeStore.ts'),
  join('store', 'index.ts'),
  join('services', 'PianoService.ts'),
  join('services', 'presets', 'PresetService.ts'),
];

const UI_ALLOWED = [
  join('store', 'index.ts'),
  join('hooks', 'useMasterVolume.ts'),
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

function referencing(root: string): string[] {
  return walk(root)
    .filter(f => STORE_REFERENCE.test(readFileSync(f, 'utf-8')))
    .map(f => relative(root, f));
}

describe('engineVolumeStore containment', () => {
  it('is imported in core only by the piano service, the preset service and the barrel', () => {
    const offenders = referencing(CORE_SRC).filter(
      f => !CORE_ALLOWED.includes(f),
    );
    expect(offenders).toEqual([]);
  });

  it('is imported in the shared UI only by the store re-export and the master volume hook', () => {
    expect(existsSync(UI_SRC)).toBe(true);
    const offenders = referencing(UI_SRC).filter(f => !UI_ALLOWED.includes(f));
    expect(offenders).toEqual([]);
  });

  it('is re-exported by the shared UI store', () => {
    const source = readFileSync(join(UI_SRC, 'store', 'index.ts'), 'utf-8');
    expect(source).toMatch(/\buseEngineVolumeStore\b/);
    expect(source).toMatch(/\bselectEngineVolumeValue\b/);
    expect(source).toMatch(/\bselectEngineVolumeAttenuated\b/);
  });

  it('has no entry in the host store registry', () => {
    const source = readFileSync(join(UI_SRC, 'store', 'index.ts'), 'utf-8');
    const body = source.slice(source.indexOf('export function initStores'));
    expect(body.length).toBeGreaterThan(0);
    expect(body).not.toMatch(/EngineVolume/);
  });

  it('is absent from every persisted type', () => {
    for (const f of ['performanceSnapshot.ts', 'profile.ts', 'setlist.ts']) {
      expect(readFileSync(join(CORE_SRC, 'types', f), 'utf-8')).not.toMatch(
        STORE_REFERENCE,
      );
    }
  });
});
