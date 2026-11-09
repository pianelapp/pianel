export const ENGINE_VOLUME_MIN_POSITION = 0;
export const ENGINE_VOLUME_MAX_POSITION = 100;
export const DEFAULT_ENGINE_VOLUME_POSITION = 100;
export const ENGINE_VOLUME_MAX_VALUE = 127;
export const ENGINE_VOLUME_CURVE_EXPONENT = 0.85;

export function clampEngineVolumePosition(input: number): number {
  if (!Number.isFinite(input)) return DEFAULT_ENGINE_VOLUME_POSITION;
  return Math.max(
    ENGINE_VOLUME_MIN_POSITION,
    Math.min(ENGINE_VOLUME_MAX_POSITION, Math.round(input)),
  );
}

export function engineVolumeValueForPosition(position: number): number {
  const p = clampEngineVolumePosition(position);
  if (p <= ENGINE_VOLUME_MIN_POSITION) return 0;
  const ratio = p / ENGINE_VOLUME_MAX_POSITION;
  return Math.min(
    ENGINE_VOLUME_MAX_VALUE,
    Math.round(
      ENGINE_VOLUME_MAX_VALUE * Math.pow(ratio, ENGINE_VOLUME_CURVE_EXPONENT),
    ),
  );
}

export function engineVolumePositionForValue(value: number): number {
  if (!(value > 0)) return ENGINE_VOLUME_MIN_POSITION;
  const ratio = Math.min(value, ENGINE_VOLUME_MAX_VALUE) / ENGINE_VOLUME_MAX_VALUE;
  return clampEngineVolumePosition(
    ENGINE_VOLUME_MAX_POSITION *
      Math.pow(ratio, 1 / ENGINE_VOLUME_CURVE_EXPONENT),
  );
}
