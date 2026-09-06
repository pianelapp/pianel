import {create} from 'zustand';
import type {MidiChannel} from '../types/midiChannelStrip';

export interface ChannelAssignment {
  toneId: string;
  connectionMark: string | null;
}

export interface MidiChannelState {
  assignments: Partial<Record<MidiChannel, ChannelAssignment>>;
  deviceId: string | null;
}

export interface MidiChannelActions {
  record: (input: {
    channel: MidiChannel;
    toneId: string;
    deviceId: string | null;
    connectionMark: string | null;
  }) => void;
  reset: () => void;
}

const EMPTY_ASSIGNMENTS: Partial<Record<MidiChannel, ChannelAssignment>> = {};

export const useMidiChannelStore = create<
  MidiChannelState & MidiChannelActions
>()(set => ({
  assignments: {},
  deviceId: null,

  record: ({channel, toneId, deviceId, connectionMark}) =>
    set(state => {
      const entry: ChannelAssignment = {toneId, connectionMark};
      if (state.deviceId !== deviceId) {
        return {deviceId, assignments: {[channel]: entry}};
      }
      return {assignments: {...state.assignments, [channel]: entry}};
    }),

  reset: () => set({assignments: {}, deviceId: null}),
}));

export function selectChannelAssignments(
  state: MidiChannelState,
  deviceId: string | null,
): Partial<Record<MidiChannel, ChannelAssignment>> {
  return state.deviceId === deviceId ? state.assignments : EMPTY_ASSIGNMENTS;
}

export function selectAssignmentsMayBeStale(
  state: MidiChannelState,
  deviceId: string | null,
  connectionMark: string | null,
): boolean {
  if (state.deviceId !== deviceId) return false;
  return Object.values(state.assignments).some(
    a => a !== undefined && a.connectionMark !== connectionMark,
  );
}
