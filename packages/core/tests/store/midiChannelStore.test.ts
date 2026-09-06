import {
  useMidiChannelStore,
  selectAssignmentsMayBeStale,
  selectChannelAssignments,
} from '../../src/store/midiChannelStore';

const DEVICE = 'piano-a';
const OTHER_DEVICE = 'piano-b';
const MARK = '2026-09-04T00:00:00.000Z';

function record(
  channel: 1 | 2 | 3 | 5 | 6,
  toneId: string,
  deviceId: string | null = DEVICE,
  connectionMark: string | null = MARK,
): void {
  useMidiChannelStore
    .getState()
    .record({channel, toneId, deviceId, connectionMark});
}

beforeEach(() => {
  useMidiChannelStore.getState().reset();
});

describe('midiChannelStore', () => {
  it('reports every channel as not assigned on fresh state', () => {
    const state = useMidiChannelStore.getState();
    expect(state.assignments).toEqual({});
    expect(state.deviceId).toBeNull();
    expect(selectChannelAssignments(state, DEVICE)).toEqual({});
  });

  it('replaces the record for a channel and leaves the others intact', () => {
    record(1, 'tone-a');
    record(2, 'tone-b');
    record(1, 'tone-c');

    const {assignments} = useMidiChannelStore.getState();
    expect(assignments[1]).toEqual({toneId: 'tone-c', connectionMark: MARK});
    expect(assignments[2]).toEqual({toneId: 'tone-b', connectionMark: MARK});
  });

  it('keeps both records when one tone lands on two channels', () => {
    record(3, 'tone-a');
    record(6, 'tone-a');

    const {assignments} = useMidiChannelStore.getState();
    expect(assignments[3]?.toneId).toBe('tone-a');
    expect(assignments[6]?.toneId).toBe('tone-a');
  });

  it('discards the whole map and adopts the device when the device changes', () => {
    record(1, 'tone-a');
    record(2, 'tone-b');
    record(5, 'tone-c', OTHER_DEVICE);

    const state = useMidiChannelStore.getState();
    expect(state.deviceId).toBe(OTHER_DEVICE);
    expect(state.assignments).toEqual({
      5: {toneId: 'tone-c', connectionMark: MARK},
    });
  });

  it('yields an empty set for a device that does not match the map', () => {
    record(1, 'tone-a');
    const state = useMidiChannelStore.getState();
    expect(selectChannelAssignments(state, OTHER_DEVICE)).toEqual({});
    expect(selectChannelAssignments(state, DEVICE)).toEqual({
      1: {toneId: 'tone-a', connectionMark: MARK},
    });
  });

  it('derives staleness per record so a fresh record does not clear older flags', () => {
    const reconnected = '2026-09-04T01:00:00.000Z';
    record(1, 'tone-a');
    expect(
      selectAssignmentsMayBeStale(useMidiChannelStore.getState(), DEVICE, MARK),
    ).toBe(false);

    expect(
      selectAssignmentsMayBeStale(
        useMidiChannelStore.getState(),
        DEVICE,
        reconnected,
      ),
    ).toBe(true);

    record(2, 'tone-b', DEVICE, reconnected);
    const state = useMidiChannelStore.getState();
    expect(state.assignments[1]?.connectionMark).toBe(MARK);
    expect(state.assignments[2]?.connectionMark).toBe(reconnected);
    expect(selectAssignmentsMayBeStale(state, DEVICE, reconnected)).toBe(true);
  });

  it('reports no staleness for a device that does not match the map', () => {
    record(1, 'tone-a');
    expect(
      selectAssignmentsMayBeStale(
        useMidiChannelStore.getState(),
        OTHER_DEVICE,
        'anything',
      ),
    ).toBe(false);
  });

  it('restores the fresh state on reset', () => {
    record(1, 'tone-a');
    useMidiChannelStore.getState().reset();
    const state = useMidiChannelStore.getState();
    expect(state.assignments).toEqual({});
    expect(state.deviceId).toBeNull();
  });
});
