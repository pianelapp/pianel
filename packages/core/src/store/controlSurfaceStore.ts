import {create} from 'zustand';
import type {Behaviour, ControlMessage} from '../types/control';

export type LearnPhase =
  | 'idle'
  | 'armed'
  | 'detecting'
  | 'confirming'
  | 'conflict'
  | 'timeout';

export interface LearnState {
  phase: LearnPhase;
  actionId: string | null;
  captured: ControlMessage | null;
  behaviours: Behaviour[];
  conflictActionId: string | null;
}

export interface HeldControl {
  actionId: string;
  behaviour: Behaviour;
}

export interface ControlSurfaceState {
  attached: boolean;
  deviceName: string | null;
  held: HeldControl | null;
  lastMessage: ControlMessage | null;
  lastMessageAt: number | null;
  learn: LearnState;
}

export interface ControlSurfaceActions {
  setAttached: (attached: boolean, deviceName: string | null) => void;
  setHeld: (held: HeldControl | null) => void;
  noteMessage: (message: ControlMessage, at: number) => void;
  startLearn: (actionId: string) => void;
  setLearnDetecting: (captured: ControlMessage) => void;
  setLearnConfirming: (behaviours: Behaviour[]) => void;
  setLearnConflict: (conflictActionId: string, behaviours: Behaviour[]) => void;
  setLearnTimeout: () => void;
  endLearn: () => void;
}

const IDLE_LEARN: LearnState = {
  phase: 'idle',
  actionId: null,
  captured: null,
  behaviours: [],
  conflictActionId: null,
};

export const useControlSurfaceStore = create<
  ControlSurfaceState & ControlSurfaceActions
>()(set => ({
  attached: false,
  deviceName: null,
  held: null,
  lastMessage: null,
  lastMessageAt: null,
  learn: IDLE_LEARN,

  setAttached: (attached, deviceName) => set({attached, deviceName}),

  setHeld: held => set({held}),

  noteMessage: (message, at) => set({lastMessage: message, lastMessageAt: at}),

  startLearn: actionId => set({learn: {...IDLE_LEARN, phase: 'armed', actionId}}),

  setLearnDetecting: captured =>
    set(state => ({learn: {...state.learn, phase: 'detecting', captured}})),

  setLearnConfirming: behaviours =>
    set(state => ({
      learn: {...state.learn, phase: 'confirming', behaviours, conflictActionId: null},
    })),

  setLearnConflict: (conflictActionId, behaviours) =>
    set(state => ({
      learn: {...state.learn, phase: 'conflict', behaviours, conflictActionId},
    })),

  setLearnTimeout: () =>
    set(state => ({learn: {...state.learn, phase: 'timeout'}})),

  endLearn: () => set({learn: IDLE_LEARN}),
}));
