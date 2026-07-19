import * as Popover from '@radix-ui/react-popover';
import { useState } from 'react';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import type { Breakpoint } from '../constants/breakpoints';

export type Tab = 'PRESETS' | 'DISPLAY' | 'PROFILES';

interface TopTabsProps {
  isLightMode: boolean;
  tabs: readonly Tab[];
  activeTab: Tab;
  onChange: (tab: Tab) => void;
  tier: Breakpoint;
}

function containerClass(isLightMode: boolean): string {
  return `flex gap-1.5 p-1 rounded-lg border transition-colors ${
    isLightMode
      ? 'bg-zinc-300/50 border-zinc-200'
      : 'bg-zinc-900/50 border-zinc-800/50'
  }`;
}

function tabButtonClass(active: boolean, isLightMode: boolean): string {
  return `
                      px-5 py-2 rounded-md font-bold tracking-widest text-sm uppercase transition-all
                      ${
                        active
                          ? isLightMode
                            ? 'bg-white text-cyan-700 border border-cyan-200 shadow-sm'
                            : 'bg-zinc-800 text-cyan-400 border border-cyan-900/50 shadow-[0_0_10px_rgba(6,182,212,0.15)]'
                          : isLightMode
                            ? 'text-zinc-500 hover:text-zinc-700'
                            : 'text-zinc-500 hover:text-zinc-300'
                      }
                    `;
}

export function TopTabs(props: TopTabsProps) {
  const { isLightMode, tabs, activeTab, onChange, tier } = props;
  const [open, setOpen] = useState(false);

  const collapsed = tier.viewport === 'mobile';

  const handleSelect = (tab: Tab) => {
    onChange(tab);
    setOpen(false);
  };

  return (
    <div className="min-w-0">
      {collapsed ? (
        <Popover.Root open={open} onOpenChange={setOpen}>
          <Popover.Trigger asChild>
            <button
              aria-label={`${activeTab} tab. Show other tabs`}
              className={`tap-target flex items-center gap-1.5 px-5 py-2 rounded-lg border font-bold tracking-widest text-sm uppercase transition-colors ${
                isLightMode
                  ? 'bg-zinc-300/50 border-zinc-200 text-cyan-700'
                  : 'bg-zinc-900/50 border-zinc-800/50 text-cyan-400'
              }`}>
              <span className="truncate">{activeTab}</span>
              <ChevronDown className="w-4 h-4 shrink-0" aria-hidden />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="center"
              sideOffset={6}
              style={{
                minWidth: 'var(--radix-popover-trigger-width)',
                maxWidth: 'calc(100vw - 2rem)',
              }}
              className={`z-50 flex flex-col gap-1 p-1 rounded-lg border shadow-2xl outline-none ${
                isLightMode
                  ? 'bg-zinc-100 border-zinc-200'
                  : 'bg-zinc-900 border-zinc-800'
              }`}>
              {tabs
                .filter(tab => tab !== activeTab)
                .map(tab => (
                  <button
                    key={tab}
                    onClick={() => handleSelect(tab)}
                    className={`${tabButtonClass(false, isLightMode)} w-full text-center whitespace-nowrap`}>
                    {tab}
                  </button>
                ))}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      ) : (
        <div className={containerClass(isLightMode)}>
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => onChange(tab)}
              className={tabButtonClass(activeTab === tab, isLightMode)}>
              {tab}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
