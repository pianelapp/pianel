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
  capable: Behaviour[];
  behaviours: Behaviour[];
  conflictActionId: string | null;
  releaseWindowMs: number | null;
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
  setLearnDetecting: (
    captured: ControlMessage,
    releaseWindowMs: number | null,
  ) => void;
  setLearnConfirming: (behaviours: Behaviour[], capable?: Behaviour[]) => void;
  setLearnConflict: (
    conflictActionId: string,
    behaviours: Behaviour[],
    capable?: Behaviour[],
  ) => void;
  setLearnTimeout: () => void;
  endLearn: () => void;
}

const IDLE_LEARN: LearnState = {
  phase: 'idle',
  actionId: null,
  captured: null,
  capable: [],
  behaviours: [],
  conflictActionId: null,
  releaseWindowMs: null,
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

  setLearnDetecting: (captured, releaseWindowMs) =>
    set(state => ({
      learn: {...state.learn, phase: 'detecting', captured, releaseWindowMs},
    })),

  setLearnConfirming: (behaviours, capable = behaviours) =>
    set(state => ({
      learn: {
        ...state.learn,
        phase: 'confirming',
        behaviours,
        capable,
        conflictActionId: null,
        releaseWindowMs: null,
      },
    })),

  setLearnConflict: (conflictActionId, behaviours, capable = behaviours) =>
    set(state => ({
      learn: {
        ...state.learn,
        phase: 'conflict',
        behaviours,
        capable,
        conflictActionId,
        releaseWindowMs: null,
      },
    })),

  setLearnTimeout: () =>
    set(state => ({
      learn: {...state.learn, phase: 'timeout', releaseWindowMs: null},
    })),

  endLearn: () => set({learn: IDLE_LEARN}),
}));
