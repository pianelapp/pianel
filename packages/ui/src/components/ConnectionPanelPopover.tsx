import * as Popover from '@radix-ui/react-popover';
import { ReactNode, useEffect, useState } from 'react';
import PlugZap from 'lucide-react/dist/esm/icons/plug-zap';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import Music from 'lucide-react/dist/esm/icons/music';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw';
import Unplug from 'lucide-react/dist/esm/icons/unplug';
import { useConnection } from '../hooks/useConnection';
import { useConnectionStore } from '../store';
import { showAlert } from './modals/AlertModal';
import type { DiscoveredDevice } from '../store';

interface ConnectionPanelPopoverProps {
  isLightMode: boolean;
  children: ReactNode;
}

export function ConnectionPanelPopover({
  isLightMode,
  children,
}: ConnectionPanelPopoverProps) {
  const {
    status,
    deviceId,
    deviceName,
    connectToDevice,
    refreshDiscoveredDevices,
    disconnect,
  } = useConnection();
  const discoveredDevices = useConnectionStore(s => s.discoveredDevices);

  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    refreshDiscoveredDevices().catch(() => undefined);
  }, [open, refreshDiscoveredDevices]);

  const handleConnectRow = async (id: string) => {
    setOpen(false);
    await connectToDevice(id);
  };

  const handleDisconnect = async () => {
    const confirmed = await showAlert({
      variant: 'warning',
      title: 'Disconnect from piano?',
      message: 'You will lose live state until you reconnect.',
      confirmLabel: 'Disconnect',
      cancelLabel: 'Cancel',
    });
    if (confirmed) {
      setOpen(false);
      await disconnect();
    }
  };

  const handleRescan = () => {
    refreshDiscoveredDevices().catch(() => undefined);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={8}
          align="end"
          className={`z-50 w-[320px] rounded-2xl border shadow-2xl p-4 outline-none ${
            isLightMode
              ? 'bg-white border-zinc-200'
              : 'bg-zinc-900 border-zinc-800'
          }`}>
          {renderPanelBody({
            isLightMode,
            status,
            deviceId,
            deviceName,
            discoveredDevices,
            onConnectRow: handleConnectRow,
            onDisconnect: handleDisconnect,
            onRescan: handleRescan,
          })}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ─── Body renderer ─────────────────────────────────────────────────────────

interface PanelBodyProps {
  isLightMode: boolean;
  status: string;
  deviceId: string | null;
  deviceName: string | null;
  discoveredDevices: DiscoveredDevice[];
  onConnectRow: (id: string) => void;
  onDisconnect: () => void;
  onRescan: () => void;
}

function renderPanelBody(props: PanelBodyProps) {
  const { isLightMode, status } = props;

  const textPrimary = isLightMode ? 'text-zinc-800' : 'text-zinc-100';
  const textSecondary = isLightMode ? 'text-zinc-500' : 'text-zinc-400';
  const textMono = isLightMode ? 'text-zinc-400' : 'text-zinc-600';

  switch (status) {
    case 'connected':
      return (
        <ConnectedPanel
          {...props}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          textMono={textMono}
        />
      );
    case 'stale':
      return (
        <StalePanel
          {...props}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          textMono={textMono}
        />
      );
    case 'connecting':
      return (
        <ConnectingPanel
          {...props}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
        />
      );
    case 'scanning':
      return (
        <ScanningPanel
          {...props}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          textMono={textMono}
        />
      );
    case 'idle':
    case 'discovered':
    case 'disconnected':
    default:
      return (
        <DiscoveryPanel
          {...props}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          textMono={textMono}
        />
      );
  }
}

// ─── Sub-panels ────────────────────────────────────────────────────────────

interface SubPanelExtras {
  textPrimary: string;
  textSecondary: string;
  textMono?: string;
}

function ConnectedPanel({
  isLightMode,
  deviceName,
  deviceId,
  onDisconnect,
  textPrimary,
  textSecondary,
  textMono,
}: PanelBodyProps & SubPanelExtras) {
  const displayName = deviceName?.trim() || 'Connected piano';
  return (
    <>
      <div className="flex items-start gap-3 mb-4">
        <div
          className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border ${
            isLightMode
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-emerald-500/10 border-emerald-900/60'
          }`}>
          <PlugZap
            className={`w-5 h-5 ${
              isLightMode ? 'text-emerald-600' : 'text-emerald-400'
            }`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className={`text-base font-bold truncate ${textPrimary}`}>
            {displayName}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className={`text-[10px] font-bold tracking-widest px-1.5 py-0.5 rounded ${
                isLightMode
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-emerald-500/20 text-emerald-300'
              }`}>
              CONNECTED
            </span>
          </div>
          {deviceId && (
            <div className={`text-xs mt-1 font-mono truncate ${textMono}`}>
              {deviceId}
            </div>
          )}
        </div>
      </div>
      <button
        onClick={onDisconnect}
        className={`w-full text-sm font-bold tracking-widest py-2.5 rounded-xl transition-colors ${
          isLightMode
            ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
            : 'bg-red-500/10 text-red-300 hover:bg-red-500/20 border border-red-900/60'
        }`}>
        DISCONNECT
      </button>
      <p className={`text-[11px] mt-2 text-center ${textSecondary}`}>
        Heartbeat is active.
      </p>
    </>
  );
}

function StalePanel({
  isLightMode,
  deviceName,
  deviceId,
  onDisconnect,
  textPrimary,
  textSecondary,
  textMono,
}: PanelBodyProps & SubPanelExtras) {
  return (
    <>
      <div className="flex items-start gap-3 mb-3">
        <div
          className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border ${
            isLightMode
              ? 'bg-amber-50 border-amber-200'
              : 'bg-amber-500/10 border-amber-900/60'
          }`}>
          <AlertTriangle
            className={`w-5 h-5 ${
              isLightMode ? 'text-amber-600' : 'text-amber-400'
            }`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className={`text-base font-bold truncate ${textPrimary}`}>
            {deviceName ?? 'Piano'}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className={`text-[10px] font-bold tracking-widest px-1.5 py-0.5 rounded ${
                isLightMode
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-amber-500/20 text-amber-300'
              }`}>
              UNRESPONSIVE
            </span>
          </div>
          {deviceId && (
            <div className={`text-xs mt-1 font-mono truncate ${textMono}`}>
              {deviceId}
            </div>
          )}
        </div>
      </div>
      <div
        className={`text-xs leading-relaxed mb-4 p-2.5 rounded-lg border ${
          isLightMode
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : 'bg-amber-500/10 border-amber-900/60 text-amber-200'
        }`}>
        The Bluetooth link is up but the piano isn&apos;t replying to
        alive-checks. It will reconnect automatically as soon as it responds.
      </div>
      <button
        onClick={onDisconnect}
        className={`w-full text-sm font-bold tracking-widest py-2.5 rounded-xl transition-colors ${
          isLightMode
            ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
            : 'bg-red-500/10 text-red-300 hover:bg-red-500/20 border border-red-900/60'
        }`}>
        DISCONNECT
      </button>
      <p className={`text-[11px] mt-2 text-center ${textSecondary}`}>
        Or leave the popover open — it will refresh when the piano replies.
      </p>
    </>
  );
}

function ConnectingPanel({
  isLightMode,
  deviceName,
  textPrimary,
  textSecondary,
}: PanelBodyProps & SubPanelExtras) {
  return (
    <div className="py-6 flex flex-col items-center">
      <Loader2
        className={`w-8 h-8 mb-3 animate-spin ${
          isLightMode ? 'text-cyan-600' : 'text-cyan-400'
        }`}
      />
      <div className={`text-sm font-semibold ${textPrimary}`}>
        Connecting{deviceName ? ` to ${deviceName}` : ''}…
      </div>
      <div className={`text-xs mt-1 ${textSecondary}`}>
        Identifying engine and reading initial state.
      </div>
    </div>
  );
}

function ScanningPanel({
  isLightMode,
  discoveredDevices,
  onConnectRow,
  textPrimary,
  textSecondary,
  textMono,
}: PanelBodyProps & SubPanelExtras) {
  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <Loader2
          className={`w-5 h-5 animate-spin ${
            isLightMode ? 'text-cyan-600' : 'text-cyan-400'
          }`}
        />
        <div className={`text-sm font-bold ${textPrimary}`}>Searching…</div>
      </div>
      <DeviceList
        isLightMode={isLightMode}
        devices={discoveredDevices}
        onSelect={onConnectRow}
        emptyMessage="No pianos found yet."
        textPrimary={textPrimary}
        textSecondary={textSecondary}
        textMono={textMono ?? ''}
      />
    </>
  );
}

function DiscoveryPanel({
  isLightMode,
  status,
  deviceName,
  discoveredDevices,
  onConnectRow,
  onRescan,
  textPrimary,
  textSecondary,
  textMono,
}: PanelBodyProps & SubPanelExtras) {
  const header =
    status === 'disconnected' && deviceName
      ? `Disconnected from ${deviceName}`
      : status === 'discovered'
      ? 'Available pianos'
      : 'No piano connected';

  return (
    <>
      <div className="flex items-start gap-3 mb-3">
        <div
          className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border ${
            isLightMode
              ? 'bg-zinc-100 border-zinc-200'
              : 'bg-zinc-800/60 border-zinc-700'
          }`}>
          <Unplug
            className={`w-5 h-5 ${
              isLightMode ? 'text-zinc-500' : 'text-zinc-400'
            }`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className={`text-sm font-bold ${textPrimary}`}>{header}</div>
          <div className={`text-xs mt-0.5 ${textSecondary}`}>
            Tap a device to connect.
          </div>
        </div>
      </div>
      <DeviceList
        isLightMode={isLightMode}
        devices={discoveredDevices}
        onSelect={onConnectRow}
        emptyMessage="No pianos available. Pair your device in your OS System, then refresh."
        textPrimary={textPrimary}
        textSecondary={textSecondary}
        textMono={textMono ?? ''}
      />
      <button
        onClick={onRescan}
        className={`mt-3 w-full flex items-center justify-center gap-2 text-xs font-bold tracking-widest py-2 rounded-lg transition-colors ${
          isLightMode
            ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
            : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
        }`}>
        <RefreshCw className="w-3.5 h-3.5" />
        REFRESH
      </button>
    </>
  );
}

// ─── Shared list ───────────────────────────────────────────────────────────

interface DeviceListProps {
  isLightMode: boolean;
  devices: DiscoveredDevice[];
  onSelect: (id: string) => void;
  emptyMessage: string;
  textPrimary: string;
  textSecondary: string;
  textMono: string;
}

function DeviceList({
  isLightMode,
  devices,
  onSelect,
  emptyMessage,
  textPrimary,
  textSecondary,
  textMono,
}: DeviceListProps) {
  if (devices.length === 0) {
    return (
      <div
        className={`text-xs px-3 py-4 rounded-lg border text-center ${
          isLightMode
            ? 'border-zinc-200 bg-zinc-50 text-zinc-500'
            : 'border-zinc-800 bg-zinc-900/40 text-zinc-500'
        }`}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 max-h-64 overflow-auto">
      {devices.map(device => (
        <button
          key={device.id}
          onClick={() => onSelect(device.id)}
          className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors flex items-center gap-2.5 ${
            isLightMode
              ? 'border-zinc-200 hover:bg-cyan-50 hover:border-cyan-300'
              : 'border-zinc-800 hover:bg-zinc-800/60 hover:border-cyan-700'
          }`}>
          <Music
            className={`w-4 h-4 shrink-0 ${
              isLightMode ? 'text-cyan-600' : 'text-cyan-400'
            }`}
          />
          <div className="min-w-0 flex-1">
            <div className={`text-sm font-semibold truncate ${textPrimary}`}>
              {device.name || 'Unknown device'}
            </div>
            <div className={`text-[10px] font-mono truncate ${textMono}`}>
              {device.id}
            </div>
          </div>
          <span
            className={`text-[10px] font-bold tracking-widest ${textSecondary}`}>
            CONNECT
          </span>
        </button>
      ))}
    </div>
  );
}
