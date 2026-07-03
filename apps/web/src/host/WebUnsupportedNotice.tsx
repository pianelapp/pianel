/**
 * WebUnsupportedNotice (Task 4.2).
 *
 * Actionable, non-blocking notice surfaced at the point of failure when the
 * browser cannot connect to the piano:
 *  - Web MIDI absent  → a Chromium-based browser is required.
 *  - Non-secure ctx   → a secure (HTTPS) context is required.
 *
 * It is rendered as an inline banner (not a blocking modal) so read-only
 * features — browsing the tone library, viewing saved profiles/presets —
 * remain fully usable when connectivity is unavailable (Req 3.2).
 */
import { useState } from 'react';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import X from 'lucide-react/dist/esm/icons/x';
import type { WebCapabilities } from './webCapabilities';

export interface WebUnsupportedNoticeProps {
  capabilities: WebCapabilities;
  isLightMode?: boolean;
}

/** Build the user-facing copy from the detected capabilities. */
export function unsupportedNoticeContent(
  capabilities: WebCapabilities,
): { title: string; message: string } | null {
  const { webMidiAvailable, secureContext } = capabilities;
  if (webMidiAvailable && secureContext) return null;

  if (!secureContext && !webMidiAvailable) {
    return {
      title: 'Piano connection unavailable',
      message:
        'Connecting to your piano needs a Chromium-based browser (Chrome or Edge) ' +
        'served over a secure HTTPS connection. You can still browse tones and view ' +
        'your saved profiles and presets.',
    };
  }
  if (!secureContext) {
    return {
      title: 'Secure connection required',
      message:
        'Piano connectivity requires a secure (HTTPS) context. Open this app over ' +
        'HTTPS to connect. You can still browse tones and view your saved profiles ' +
        'and presets.',
    };
  }
  // !webMidiAvailable
  return {
    title: 'Unsupported browser',
    message:
      'This browser does not support Web MIDI, so it cannot connect to your piano. ' +
      'Use a Chromium-based browser such as Chrome or Edge. You can still browse ' +
      'tones and view your saved profiles and presets.',
  };
}

export function WebUnsupportedNotice({
  capabilities,
  isLightMode = false,
}: WebUnsupportedNoticeProps) {
  const [dismissed, setDismissed] = useState(false);
  const content = unsupportedNoticeContent(capabilities);

  if (!content || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`mx-4 mb-2 flex items-start gap-3 rounded-2xl border px-4 py-3 transition-colors ${
        isLightMode
          ? 'bg-amber-50 border-amber-200 text-amber-900'
          : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
      }`}
    >
      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold tracking-wide">{content.title}</p>
        <p className="text-sm leading-relaxed opacity-90">{content.message}</p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss notice"
        className="p-1 rounded-full hover:bg-amber-500/20 transition-colors shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
