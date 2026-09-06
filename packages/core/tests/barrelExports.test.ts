import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import * as storeBarrel from '../src/store/index';
import * as rootBarrel from '../src/index';

const STORE_BARREL_SOURCE = readFileSync(
  resolve(__dirname, '../src/store/index.ts'),
  'utf-8',
);
const ROOT_BARREL_SOURCE = readFileSync(
  resolve(__dirname, '../src/index.ts'),
  'utf-8',
);

/**
 * The shaping-strip slice is deferred, so its vocabulary must stay off the
 * public surface. Type-only names cannot be probed at runtime, so the barrel
 * sources are read directly.
 */
const DEFERRED_STRIP_NAMES = [
  'ChannelStrip',
  'DrumStrip',
  'KeyboardStrip',
  'ShapingStrip',
  'StripFor',
  'MidiChannelStrips',
  'NEUTRAL_STRIP',
  'MidiChannelSnapshot',
  'GlobalFxSnapshot',
  'EMPTY_MIDI_CHANNEL_SNAPSHOT',
];

describe('barrel exports', () => {
  it('store barrel exposes the cursor store and setlist errors', () => {
    expect(typeof storeBarrel.useCursorStore).toBe('function');
    expect(typeof storeBarrel.CURRENT_SCHEMA_VERSION).toBe('number');
    expect(typeof storeBarrel.SongNotFoundError).toBe('function');
    expect(typeof storeBarrel.SceneNotFoundError).toBe('function');
    expect(typeof storeBarrel.SetlistNotFoundError).toBe('function');
    expect(typeof storeBarrel.EntryNotFoundError).toBe('function');
    expect(typeof storeBarrel.EmptySongError).toBe('function');
    expect(typeof storeBarrel.EmptySetlistError).toBe('function');
    expect(typeof storeBarrel.MissingSongError).toBe('function');
    expect(typeof storeBarrel.normalizeProfile).toBe('function');
  });

  it('root barrel exposes the three new services', () => {
    expect(typeof rootBarrel.SongService).toBe('function');
    expect(typeof rootBarrel.SetlistService).toBe('function');
    expect(typeof rootBarrel.SetlistCursorService).toBe('function');
  });

  it('store barrel exposes the control stores', () => {
    expect(typeof storeBarrel.useControlBindingsStore.getState).toBe('function');
    expect(typeof storeBarrel.useControlSurfaceStore.getState).toBe('function');
    expect(typeof storeBarrel.createControlBindingsStore).toBe('function');
    expect(storeBarrel.CONTROL_BINDINGS_VERSION).toBe(1);
  });

  it('root barrel exposes the control surface service and registry', () => {
    expect(typeof rootBarrel.ControlSurfaceService).toBe('function');
    expect(typeof rootBarrel.ControlActionRegistry).toBe('function');
    expect(typeof rootBarrel.getControlActionRegistry).toBe('function');
  });

  it('store barrel exposes the MIDI channel assignment surface', () => {
    expect(typeof storeBarrel.useMidiChannelStore).toBe('function');
    expect(typeof storeBarrel.selectChannelAssignments).toBe('function');
    expect(typeof storeBarrel.selectAssignmentsMayBeStale).toBe('function');
    expect(storeBarrel.KEYBOARD_CHANNEL).toBe(4);
    expect(storeBarrel.DRUM_CHANNEL).toBe(10);
    expect(storeBarrel.ALL_MIDI_CHANNELS).toHaveLength(16);
  });

  /**
   * Bound as types rather than matched against the barrel source: a substring
   * match cannot fail here, because every name is a substring of a sibling
   * export. The tests project is typechecked, so a removed re-export breaks
   * this block at compile time.
   */
  it('store barrel re-exports the assignment types', () => {
    const channel: storeBarrel.MidiChannel = 5;
    const assignment: storeBarrel.ChannelAssignment = {
      toneId: '0-0-0',
      connectionMark: null,
    };
    const state: storeBarrel.MidiChannelState = {
      assignments: {[channel]: assignment},
      deviceId: null,
    };
    const actions: storeBarrel.MidiChannelActions = {
      record: () => {},
      reset: () => {},
    };
    const ineligibility: storeBarrel.ChannelToneIneligibility =
      'requires-drum-kit';
    const plan: storeBarrel.ChannelToneChangePlan = {
      eligible: false,
      reason: ineligibility,
    };
    const refusal: storeBarrel.ChannelToneAssignmentRefusal = 'send-failed';
    const result: storeBarrel.ChannelToneAssignmentResult = {
      status: 'refused',
      channel,
      reason: refusal,
    };
    const target: storeBarrel.ChannelToneTarget = {
      channel,
      eligible: false,
      reason: ineligibility,
    };

    expect(state.assignments[5]).toBe(assignment);
    expect(typeof actions.reset).toBe('function');
    expect(plan.eligible).toBe(false);
    expect(result.status).toBe('refused');
    expect(target.channel).toBe(5);
  });

  it('root barrel re-exports the assignment vocabulary module', () => {
    expect(ROOT_BARREL_SOURCE).toContain(
      "export * from './types/midiChannelAssignment'",
    );
  });

  it('keeps the deferred shaping-strip names off the public surface', () => {
    const leaked = DEFERRED_STRIP_NAMES.filter(name => {
      const re = new RegExp(`\\b${name}\\b`);
      return re.test(STORE_BARREL_SOURCE) || re.test(ROOT_BARREL_SOURCE);
    });
    expect(leaked).toEqual([]);
    expect(
      (storeBarrel as Record<string, unknown>).NEUTRAL_STRIP,
    ).toBeUndefined();
    expect(
      (rootBarrel as Record<string, unknown>).EMPTY_MIDI_CHANNEL_SNAPSHOT,
    ).toBeUndefined();
  });
});
