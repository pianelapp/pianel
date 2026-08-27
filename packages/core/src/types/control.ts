export type Behaviour = 'press' | 'release' | 'peek';

export const BEHAVIOURS: readonly Behaviour[] = ['press', 'release', 'peek'];

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
  data: number[];
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
  data: number[];
}

export type ControlMatch = ChannelControlMatch | SysexControlMatch;

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
