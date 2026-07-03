/**
 * ProfileRow — single row in the profiles list. Shows profile name + an
 * active-checkmark indicator. Click → loadProfile; right-click → context menu
 * (handled by parent).
 */

import Check from 'lucide-react/dist/esm/icons/check';
import type { Profile } from '../../store';

interface ProfileRowProps {
  profile: Profile;
  isActive: boolean;
  isDefault: boolean;
  isLightMode: boolean;
  onClick: () => void;
  onContextMenu: (event: React.MouseEvent) => void;
}

export function ProfileRow({
  profile,
  isActive,
  isDefault,
  isLightMode,
  onClick,
  onContextMenu,
}: ProfileRowProps) {
  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      aria-pressed={isActive}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left ${
        isLightMode
          ? 'bg-white border-zinc-200 hover:border-zinc-300'
          : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
      } ${
        isActive ? (isLightMode ? 'border-cyan-300' : 'border-cyan-700/60') : ''
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`text-base font-bold truncate ${
              isLightMode ? 'text-zinc-800' : 'text-zinc-200'
            }`}
          >
            {profile.name}
          </span>
          {isActive && (
            <span
              className={`text-xs font-bold tracking-widest px-1.5 py-0.5 rounded ${
                isLightMode ? 'bg-cyan-100 text-cyan-700' : 'bg-cyan-900/30 text-cyan-300'
              }`}
            >
              ACTIVE
            </span>
          )}
          {isDefault && (
            <span
              className={`text-xs font-bold tracking-widest px-1.5 py-0.5 rounded ${
                isLightMode
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-amber-900/30 text-amber-300'
              }`}
              title="Loads automatically when the app starts"
            >
              DEFAULT
            </span>
          )}
        </div>
        <div
          className={`text-xs font-mono mt-0.5 ${
            isLightMode ? 'text-zinc-400' : 'text-zinc-600'
          }`}
        >
          {profile.presets.length} preset{profile.presets.length === 1 ? '' : 's'}
          {' · '}
          {profile.favorites.length} favorite
          {profile.favorites.length === 1 ? '' : 's'}
        </div>
      </div>

      {isActive && (
        <Check
          className={`w-4 h-4 ${isLightMode ? 'text-cyan-600' : 'text-cyan-400'}`}
        />
      )}
    </button>
  );
}
