export type MasterVolumeSide = 'left' | 'right';

export const DEFAULT_MASTER_VOLUME_SIDE: MasterVolumeSide = 'right';

export function toMasterVolumeSide(value: unknown): MasterVolumeSide {
  return value === 'left' || value === 'right'
    ? value
    : DEFAULT_MASTER_VOLUME_SIDE;
}
