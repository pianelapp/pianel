/**
 * Web-host connection-error mapping (Task 6.2/6.3).
 *
 * The shared `useConnection` reporter (`reportConnectError`) lives in the
 * cross-host renderer (`@pianel/ui`) and is consumed unchanged. This module is
 * the web host's own, app-layer mapping of connect-time failures into
 * actionable, user-facing copy that fits the *browser* environment:
 *
 *   - Permission denied / blocked (the browser's MIDI-SysEx prompt was denied,
 *     or MIDI was previously blocked for the origin) → guide the user to
 *     re-enable MIDI in their browser settings.
 *   - No MIDI device available → guide the user to connect via USB or pair via
 *     the OS Bluetooth settings, then retry.
 *
 * It is intentionally pure and side-effect-free so it can be unit-tested in
 * isolation and reused by the web transport wrapper and the web shell. The
 * shared `@pianel/core` and `@pianel/ui` packages are never modified.
 */
import type { AlertVariant } from '@pianel/ui/components/modals/AlertModal';

export interface MappedConnectError {
  variant: AlertVariant;
  title: string;
  message: string;
}

export const PERMISSION_DENIED_TITLE = 'MIDI access blocked';
export const NO_DEVICE_TITLE = 'No piano found';

export const PERMISSION_DENIED_MESSAGE =
  'Your browser blocked MIDI access for this site. Re-enable MIDI (and SysEx) ' +
  'in your browser settings — open the site permissions for this page, set ' +
  'MIDI device control to "Allow", then reload and try connecting again.';

export const NO_DEVICE_MESSAGE =
  'No piano was found. Connect your piano via USB cable, or pair it via your ' +
  'operating system’s Bluetooth settings, then retry.';

function errorName(err: unknown): string {
  if (err instanceof Error && typeof err.name === 'string') return err.name;
  if (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    typeof (err as { name?: unknown }).name === 'string'
  ) {
    return (err as { name: string }).name;
  }
  return '';
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err ?? '');
}

/** True when the error indicates the browser denied / blocked MIDI access. */
export function isPermissionDeniedError(err: unknown): boolean {
  const name = errorName(err);
  if (name === 'SecurityError' || name === 'NotAllowedError') return true;
  const message = errorMessage(err).toLowerCase();
  return (
    /permission/.test(message) &&
    /(denied|blocked|not allowed)/.test(message)
  ) || /\bblocked\b/.test(message) && /midi/.test(message);
}

/** True when the error indicates that no MIDI device is available. */
export function isNoDeviceError(err: unknown): boolean {
  const message = errorMessage(err).toLowerCase();
  return /no midi devices? found/.test(message) || /no midi device/.test(message);
}

/**
 * Map a connect-time error to actionable web-host copy, or `null` when the
 * error is not one the web host has special guidance for (the default reporter
 * then surfaces the raw message).
 */
export function mapWebConnectError(err: unknown): MappedConnectError | null {
  if (isPermissionDeniedError(err)) {
    return {
      variant: 'warning',
      title: PERMISSION_DENIED_TITLE,
      message: PERMISSION_DENIED_MESSAGE,
    };
  }
  if (isNoDeviceError(err)) {
    return {
      variant: 'warning',
      title: NO_DEVICE_TITLE,
      message: NO_DEVICE_MESSAGE,
    };
  }
  return null;
}
