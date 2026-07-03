/** Roland manufacturer ID */
export const ROLAND_MANUFACTURER_ID = 0x41;

/** FP-30X default device ID */
export const FP30X_DEVICE_ID = 0x10;

/** FP-30X DT1/RQ1 model ID (4 bytes) */
export const FP30X_MODEL_ID = [0x00, 0x00, 0x00, 0x28] as const;

/** DT1 command byte */
export const DT1_COMMAND = 0x12;

/** RQ1 command byte */
export const RQ1_COMMAND = 0x11;

/** SysEx start/end */
export const SYSEX_START = 0xf0;
export const SYSEX_END = 0xf7;

/** FP-30X device family code (from Identity Reply) */
export const FP30X_FAMILY_CODE: [number, number] = [0x19, 0x03];

/** Universal SysEx Identity Request */
export const IDENTITY_REQUEST = [
  0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7,
] as const;

/** Human-readable model name */
export const FP30X_MODEL_NAME = 'Roland FP-30X';
