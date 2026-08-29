import { useCallback, useEffect, useState } from 'react';
import X from 'lucide-react/dist/esm/icons/x';
import { useControlSurface } from '../../hooks/useControlSurface';
import { ActionBindingRow } from './ActionBindingRow';
import { LearnBindingDialog } from './LearnBindingDialog';
import { bindingLabel, messageLabel, relativeTime } from './bindingLabel';
import type { DiscoveredDevice } from '@pianel/core/transport/types';

const MONITOR_POLL_MS = 30_000;

interface HandsFreeSectionProps {
  isLightMode: boolean;
}

export function HandsFreeSection({ isLightMode }: HandsFreeSectionProps) {
  const surface = useControlSurface();
  const { listDevices, attachDevice, detachDevice } = surface;
  const [choosing, setChoosing] = useState(false);
  const [options, setOptions] = useState<DiscoveredDevice[] | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const ageing = surface.lastMessageAt !== null;

  useEffect(() => {
    if (!ageing) return;
    const id = setInterval(() => setNow(Date.now()), MONITOR_POLL_MS);
    return () => clearInterval(id);
  }, [ageing]);

  const handleChoose = useCallback(async () => {
    setChoosing(true);
    setOptions(await listDevices());
  }, [listDevices]);

  const handlePick = useCallback(
    async (device: DiscoveredDevice) => {
      setChoosing(false);
      setOptions(null);
      await attachDevice({ id: device.id, name: device.name });
    },
    [attachDevice],
  );

  const handleForget = useCallback(async () => {
    setChoosing(false);
    setOptions(null);
    await detachDevice();
  }, [detachDevice]);

  const bodyClass = isLightMode ? 'text-zinc-600' : 'text-zinc-400';
  const actionClass = isLightMode ? 'text-cyan-700' : 'text-cyan-400';
  const destructiveClass = isLightMode ? 'text-red-600' : 'text-red-400';
  const waitingClass = isLightMode ? 'text-amber-700' : 'text-amber-400';
  const sectionRuleClass = isLightMode ? 'border-zinc-300' : 'border-zinc-700';
  const rowRuleClass = isLightMode ? 'divide-zinc-200' : 'divide-zinc-800';

  const groups: Array<{ name: string; actions: typeof surface.actions }> = [];
  for (const action of surface.actions) {
    const existing = groups.find(g => g.name === action.group);
    if (existing) existing.actions = [...existing.actions, action];
    else groups.push({ name: action.group, actions: [action] });
  }

  return (
    <div data-handsfree-section className="flex flex-col">
      <div data-hf-device className="flex items-center gap-2 mb-2">
        <span className={`min-w-0 truncate text-sm font-medium ${bodyClass}`}>
          {surface.device
            ? (surface.device.name ?? surface.device.id)
            : 'No footswitch'}
        </span>
        {surface.device && (
          <span
            data-hf-device-status
            className={`shrink-0 text-xs font-bold tracking-widest ${
              surface.attached ? actionClass : waitingClass
            }`}>
            {surface.attached ? 'Connected' : 'Waiting'}
          </span>
        )}
        <button
          type="button"
          data-hf-choose
          onClick={() => void handleChoose()}
          className={`ml-auto shrink-0 tap-target text-xs font-bold tracking-widest ${actionClass}`}>
          {surface.device ? 'CHANGE' : 'CHOOSE DEVICE'}
        </button>
        {surface.device && (
          <button
            type="button"
            data-hf-forget
            onClick={() => void handleForget()}
            className={`shrink-0 tap-target text-xs font-bold tracking-widest ${destructiveClass}`}>
            FORGET
          </button>
        )}
      </div>

      {choosing && (
        <div className="mb-2 flex flex-col">
          {options && options.length === 0 && (
            <span className={`text-xs ${bodyClass}`}>
              No MIDI inputs found. Wake the pedal and try again.
            </span>
          )}
          {(options ?? []).map(device => (
            <button
              key={device.id}
              type="button"
              data-hf-device-option
              onClick={() => void handlePick(device)}
              className={`tap-target text-left text-sm truncate ${bodyClass}`}>
              {device.name}
            </button>
          ))}
        </div>
      )}

      <div data-hf-monitor className={`text-xs truncate ${bodyClass}`}>
        {surface.lastMessage && surface.lastMessageAt !== null
          ? `${messageLabel(surface.lastMessage)} · ${relativeTime(surface.lastMessageAt, now)}`
          : 'No messages yet'}
      </div>

      {groups.map(group => (
        <div
          key={group.name}
          data-hf-group={group.name}
          className={`mt-3 pt-3 border-t ${sectionRuleClass}`}>
          <span
            className={`block text-sm font-bold tracking-widest mb-1 ${bodyClass}`}>
            {group.name.toUpperCase()}
          </span>
          <div className={`pl-3 divide-y ${rowRuleClass}`}>
            {group.actions.map(action => (
              <ActionBindingRow
                key={action.id}
                actionId={action.id}
                label={action.label}
                bindings={surface.bindings.filter(
                  b => b.actionId === action.id,
                )}
                isLightMode={isLightMode}
                onAdd={() => surface.startLearn(action.id)}
                onRemove={surface.removeBinding}
              />
            ))}
          </div>
        </div>
      ))}

      {surface.orphanBindings.length > 0 && (
        <div
          data-hf-orphan
          className={`mt-3 pt-3 border-t ${sectionRuleClass}`}>
          {surface.orphanBindings.map(binding => (
            <div key={binding.id} className="flex items-center gap-2">
              <span className={`min-w-0 truncate text-xs ${waitingClass}`}>
                unrecognised (was: {binding.actionId}) · {bindingLabel(binding)}
              </span>
              <button
                type="button"
                data-hf-remove
                aria-label={`Remove ${bindingLabel(binding)}`}
                onClick={() => surface.removeBinding(binding.id)}
                className={`ml-auto shrink-0 tap-target flex items-center justify-center ${destructiveClass}`}>
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <LearnBindingDialog isLightMode={isLightMode} />
    </div>
  );
}
