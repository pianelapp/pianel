import type {SceneSummary} from './sceneSummary';

export function sceneBadgeClass(
  modeLabel: SceneSummary['modeLabel'],
  isLightMode: boolean,
  large = false,
): string {
  const isPlainBadge = modeLabel === 'SINGLE';
  return `${large ? 'text-xs px-2 py-1' : 'text-[10px] px-1.5 py-0.5'} font-mono font-bold tracking-widest rounded border ${
    isPlainBadge
      ? isLightMode
        ? 'text-zinc-400 border-zinc-300 bg-transparent'
        : 'text-zinc-600 border-zinc-700 bg-transparent'
      : isLightMode
        ? 'text-cyan-700 border-cyan-200 bg-cyan-50'
        : 'text-cyan-400 border-cyan-700 bg-cyan-950'
  }`;
}

export function statusBadgeClass(
  tone: 'amber' | 'red',
  isLightMode: boolean,
  large = false,
): string {
  return `${large ? 'text-xs px-2 py-1' : 'text-[10px] px-1.5 py-0.5'} font-mono font-bold tracking-widest rounded border ${
    tone === 'amber'
      ? isLightMode
        ? 'text-amber-600 border-amber-200 bg-amber-50'
        : 'text-amber-400 border-amber-900/50 bg-amber-950/40'
      : isLightMode
        ? 'text-red-600 border-red-200 bg-red-50'
        : 'text-red-400 border-red-900/50 bg-red-950/40'
  }`;
}
