import PlugZap from 'lucide-react/dist/esm/icons/plug-zap';
import Unplug from 'lucide-react/dist/esm/icons/unplug';
import { useConnection } from '../hooks/useConnection';
import { ConnectionPanelPopover } from './ConnectionPanelPopover';

interface ConnectionIndicatorProps {
  isLightMode: boolean;
}

export function ConnectionIndicator({ isLightMode }: ConnectionIndicatorProps) {
  const { status } = useConnection();

  const isLiveLink =
    status === 'connected' ||
    status === 'stale' ||
    status === 'connecting' ||
    status === 'scanning';
  const IconComponent = isLiveLink ? PlugZap : Unplug;

  const iconColor = (() => {
    if (status === 'connected') {
      return isLightMode
        ? 'text-green-600'
        : 'text-green-400 drop-shadow-[0_0_6px_rgba(74,222,128,0.6)]';
    }
    if (status === 'stale') {
      return isLightMode
        ? 'text-amber-600'
        : 'text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]';
    }
    if (status === 'connecting' || status === 'scanning') {
      return isLightMode ? 'text-yellow-600' : 'text-yellow-400';
    }
    return isLightMode ? 'text-zinc-400' : 'text-zinc-600';
  })();

  const shouldPulse =
    status === 'connecting' || status === 'scanning' || status === 'stale';

  const titleText =
    status === 'connected'
      ? 'Connected'
      : status === 'stale'
        ? 'Piano unresponsive — checking…'
        : status === 'connecting'
          ? 'Connecting…'
          : status === 'scanning'
            ? 'Searching for pianos…'
            : 'Open connection panel';

  return (
    <ConnectionPanelPopover isLightMode={isLightMode}>
      <button
        type="button"
        title={titleText}
        aria-label={titleText}
        className="flex flex-col items-center gap-0.5 outline-none"
      >
        <IconComponent
          className={`w-5 h-5 ${iconColor} ${shouldPulse ? 'animate-pulse' : ''}`}
        />
      </button>
    </ConnectionPanelPopover>
  );
}
