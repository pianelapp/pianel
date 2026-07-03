import { useState, useEffect, ReactNode } from 'react';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import Info from 'lucide-react/dist/esm/icons/info';
import X from 'lucide-react/dist/esm/icons/x';

export type AlertVariant = 'success' | 'warning' | 'error' | 'info';

export interface AlertOptions {
  variant: AlertVariant;
  title: string;
  message: string;
  /** Custom icon override. Receives no props — caller controls sizing/color. */
  icon?: ReactNode;
  /** Button label. Defaults to "OK". */
  confirmLabel?: string;
  /**
   * When provided, the modal renders a Cancel button next to Confirm. The promise
   * returned by showAlert resolves `true` on Confirm and `false` on Cancel/close.
   * When omitted, only the Confirm button is shown (single-button behavior).
   */
  cancelLabel?: string;
}

interface AlertModalProps {
  isLightMode: boolean;
}

// ─── Module-level state (imperative API, mirrors MIDIDeviceChooser pattern) ───

let _resolve: ((confirmed: boolean) => void) | null = null;
let _setOpen: ((v: boolean) => void) | null = null;
let _setOptions: ((opts: AlertOptions | null) => void) | null = null;

/**
 * Show an alert / confirm dialog.
 *
 * Resolves with:
 *   - `true`  when the user clicks the confirm button (default OK, or custom label).
 *   - `false` when the user dismisses via Cancel, Esc, or the close (X) button.
 *
 * Single-button alerts (no `cancelLabel`) always resolve `true` — the previous
 * void-return behavior — so existing callers that don't read the value work
 * unchanged.
 */
export function showAlert(options: AlertOptions): Promise<boolean> {
  return new Promise(resolve => {
    _resolve = resolve;
    _setOptions?.(options);
    _setOpen?.(true);
  });
}

// ─── Variant tokens ───────────────────────────────────────────────────────────

const VARIANT_STYLES: Record<
  AlertVariant,
  {
    DefaultIcon: typeof CheckCircle2;
    light: { ring: string; tint: string; icon: string };
    dark: { ring: string; tint: string; icon: string };
  }
> = {
  success: {
    DefaultIcon: CheckCircle2,
    light: { ring: 'border-emerald-200', tint: 'bg-emerald-50', icon: 'text-emerald-600' },
    dark: { ring: 'border-emerald-900/60', tint: 'bg-emerald-500/10', icon: 'text-emerald-400' },
  },
  warning: {
    DefaultIcon: AlertTriangle,
    light: { ring: 'border-amber-200', tint: 'bg-amber-50', icon: 'text-amber-600' },
    dark: { ring: 'border-amber-900/60', tint: 'bg-amber-500/10', icon: 'text-amber-400' },
  },
  error: {
    DefaultIcon: AlertCircle,
    light: { ring: 'border-red-200', tint: 'bg-red-50', icon: 'text-red-600' },
    dark: { ring: 'border-red-900/60', tint: 'bg-red-500/10', icon: 'text-red-400' },
  },
  info: {
    DefaultIcon: Info,
    light: { ring: 'border-cyan-200', tint: 'bg-cyan-50', icon: 'text-cyan-600' },
    dark: { ring: 'border-cyan-900/60', tint: 'bg-cyan-500/10', icon: 'text-cyan-400' },
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function AlertModal({ isLightMode }: AlertModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<AlertOptions | null>(null);

  useEffect(() => {
    _setOpen = setIsOpen;
    _setOptions = setOptions;
    return () => {
      _setOpen = null;
      _setOptions = null;
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        // Enter confirms when there is a confirm/cancel split; when there's
        // only one button it's still effectively a confirm.
        handleConfirm();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, options?.cancelLabel]);

  const handleClose = () => {
    const resolve = _resolve;
    _resolve = null;
    setIsOpen(false);
    resolve?.(false);
  };

  const handleConfirm = () => {
    const resolve = _resolve;
    _resolve = null;
    setIsOpen(false);
    resolve?.(true);
  };

  if (!isOpen || !options) return null;

  const styles = VARIANT_STYLES[options.variant];
  const tones = isLightMode ? styles.light : styles.dark;
  const { DefaultIcon } = styles;
  const iconNode = options.icon ?? <DefaultIcon className={`w-7 h-7 ${tones.icon}`} />;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="alert-modal-title"
      aria-describedby="alert-modal-message"
    >
      <div
        className={`w-[320px] rounded-3xl p-6 shadow-2xl border transition-colors ${
          isLightMode ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'
        }`}
      >
        <div className="flex items-start justify-between mb-4">
          <div
            className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center border ${tones.tint} ${tones.ring}`}
          >
            {iconNode}
          </div>
          <button
            onClick={handleClose}
            aria-label="Close"
            className="p-1.5 rounded-full hover:bg-zinc-500/20 transition-colors"
          >
            <X
              className={`w-4 h-4 ${isLightMode ? 'text-zinc-500' : 'text-zinc-400'}`}
            />
          </button>
        </div>

        <h2
          id="alert-modal-title"
          className={`text-lg font-bold mb-1.5 ${
            isLightMode ? 'text-zinc-800' : 'text-zinc-100'
          }`}
        >
          {options.title}
        </h2>
        <p
          id="alert-modal-message"
          className={`text-base leading-relaxed mb-5 ${
            isLightMode ? 'text-zinc-600' : 'text-zinc-400'
          }`}
        >
          {options.message}
        </p>

        {options.cancelLabel ? (
          <div className="flex gap-2">
            <button
              onClick={handleClose}
              className={`flex-1 text-sm font-bold tracking-widest py-2.5 rounded-xl transition-colors ${
                isLightMode
                  ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                  : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
              }`}
            >
              {options.cancelLabel}
            </button>
            <button
              onClick={handleConfirm}
              autoFocus
              className={`flex-1 text-sm font-bold tracking-widest py-2.5 rounded-xl transition-colors ${
                options.variant === 'warning' || options.variant === 'error'
                  ? isLightMode
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-red-500/80 text-white hover:bg-red-500'
                  : isLightMode
                    ? 'bg-cyan-600 text-white hover:bg-cyan-700'
                    : 'bg-cyan-500/80 text-white hover:bg-cyan-500'
              }`}
            >
              {options.confirmLabel ?? 'OK'}
            </button>
          </div>
        ) : (
          <button
            onClick={handleConfirm}
            autoFocus
            className={`w-full text-sm font-bold tracking-widest py-2.5 rounded-xl transition-colors ${
              isLightMode
                ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
            }`}
          >
            {options.confirmLabel ?? 'OK'}
          </button>
        )}
      </div>
    </div>
  );
}
