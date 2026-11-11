import {readdirSync, readFileSync, statSync} from 'node:fs';
import {join, relative, resolve} from 'node:path';

const SRC = resolve(__dirname, '../../src');

const PERSISTENCE_SERVICE_DIRS = [
  join('services', 'presets'),
  join('services', 'profiles'),
  join('services', 'songs'),
  join('services', 'setlists'),
];

const PERSISTED_TYPE_FILES = [
  join('types', 'performanceSnapshot.ts'),
  join('types', 'profile.ts'),
  join('types', 'setlist.ts'),
  join('types', 'quickToneSlot.ts'),
];

const STORE_REFERENCE = /midiChannelStore|useMidiChannelStore|ChannelAssignment/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith('.ts')) out.push(full);
  }
  return out;
}

describe('midiChannelStore containment', () => {
  it('is not imported by any persistence service', () => {
    const offenders: string[] = [];
    for (const dir of PERSISTENCE_SERVICE_DIRS) {
      for (const file of walk(join(SRC, dir))) {
        if (STORE_REFERENCE.test(readFileSync(file, 'utf-8'))) {
          offenders.push(relative(SRC, file));
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('scans the persistence service folders it is meant to cover', () => {
    for (const dir of PERSISTENCE_SERVICE_DIRS) {
      expect(walk(join(SRC, dir)).length).toBeGreaterThan(0);
    }
  });

  it('is absent from every persisted type', () => {
    const offenders = PERSISTED_TYPE_FILES.filter(f =>
      STORE_REFERENCE.test(readFileSync(join(SRC, f), 'utf-8')),
    );
    expect(offenders).toEqual([]);
  });
});
