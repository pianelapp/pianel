export type Behaviour = 'press' | 'release' | 'peek';

export const BEHAVIOURS: readonly Behaviour[] = ['press', 'release', 'peek'];

export type ControlMessageType = 'cc' | 'note' | 'pc';

export type Edge = 'press' | 'release';

export interface ControlMessage {
  type: ControlMessageType;
  channel: number;
  id: number;
  value: number;
}

export interface ControlMatch {
  type: ControlMessageType;
  channel: number;
  id: number;
}

export interface PeekHandle {
  end(): Promise<void>;
}

export interface ControlAction {
  id: string;
  label: string;
  group: string;
  behaviours: Behaviour[];
  run(): Promise<void>;
  beginPeek?(): Promise<PeekHandle | null>;
}

export interface ControlBinding {
  id: string;
  match: ControlMatch;
  actionId: string;
  behaviour: Behaviour;
}

export interface ControlDevice {
  id: string;
  name: string | null;
}
