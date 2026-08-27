export type Behaviour = 'press' | 'release' | 'peek';

export const BEHAVIOURS: readonly Behaviour[] = Object.freeze([
  'press',
  'release',
  'peek',
] as const);

export type ChannelMessageType = 'cc' | 'note' | 'pc';

export type ControlMessageType = ChannelMessageType | 'sysex';

export type Edge = 'press' | 'release';

export interface ChannelControlMessage {
  type: ChannelMessageType;
  channel: number;
  id: number;
  value: number;
}

export interface SysexControlMessage {
  type: 'sysex';
  data: readonly number[];
  value: number;
}

export type ControlMessage = ChannelControlMessage | SysexControlMessage;

export interface ChannelControlMatch {
  type: ChannelMessageType;
  channel: number;
  id: number;
}

export interface SysexControlMatch {
  type: 'sysex';
  data: readonly number[];
}

export type ControlMatch = ChannelControlMatch | SysexControlMatch;

export interface PeekHandle {
  end(): Promise<void>;
}

export interface ControlAction {
  id: string;
  label: string;
  group: string;
  behaviours: readonly Behaviour[];
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
