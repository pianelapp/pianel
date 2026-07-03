/**
 * BLE MIDI Constants.
 *
 * Standard UUIDs from the Bluetooth SIG / Apple BLE MIDI accessory spec.
 * These are transport-layer constants, not piano-model-specific.
 */

/** BLE MIDI Service UUID (Bluetooth SIG / Apple BLE MIDI spec) */
export const BLE_MIDI_SERVICE_UUID = '03B80E5A-EDE8-4B33-A751-6CE34EC4C700';

/** BLE MIDI Characteristic UUID (read/write/notify) */
export const BLE_MIDI_CHARACTERISTIC_UUID =
  '7772E5DB-3868-4112-A1A9-F2669D106BF3';
