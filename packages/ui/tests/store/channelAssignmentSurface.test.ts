import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import * as uiStore from '../../src/store';

const STORE_BARREL_SOURCE = readFileSync(
  resolve(__dirname, '../../src/store/index.ts'),
  'utf-8',
);

function initStoresBody(): string {
  const match = STORE_BARREL_SOURCE.match(
    /export function initStores[\s\S]*?\n}/,
  );
  if (!match) throw new Error('initStores not found in the store barrel');
  return match[0];
}

describe('renderer store barrel — channel assignment surface', () => {
  it('mirrors the session store and its selectors', () => {
    expect(typeof uiStore.useMidiChannelStore).toBe('function');
    expect(typeof uiStore.selectChannelAssignments).toBe('function');
    expect(typeof uiStore.selectAssignmentsMayBeStale).toBe('function');
    expect(uiStore.KEYBOARD_CHANNEL).toBe(4);
    expect(uiStore.DRUM_CHANNEL).toBe(10);
    expect(uiStore.ALL_MIDI_CHANNELS).toHaveLength(16);
  });

  /**
   * The renderer half of the containment guarantee. The deferred strip names
   * are not re-checked here: this barrel only re-exports from
   * `@pianel/core/store`, so naming one would fail to compile, and the core
   * barrel test already pins them.
   */
  it('never constructs or references the session store in initStores', () => {
    expect(initStoresBody()).not.toMatch(/MidiChannel/);
  });
});
