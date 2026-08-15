import type {SceneSummary} from './sceneSummary';

export function sceneBadgeClass(
  modeLabel: SceneSummary['modeLabel'],
  isLightMode: boolean,
): string {
  const isPlainBadge = modeLabel === 'SINGLE';
  return `text-[10px] font-mono font-bold tracking-widest px-1.5 py-0.5 rounded border ${
    isPlainBadge
      ? isLightMode
        ? 'text-zinc-400 border-zinc-300 bg-transparent'
        : 'text-zinc-600 border-zinc-700 bg-transparent'
      : isLightMode
        ? 'text-cyan-700 border-cyan-200 bg-cyan-50'
        : 'text-cyan-400 border-cyan-700 bg-cyan-950'
  }`;
}
