import Settings from 'lucide-react/dist/esm/icons/settings';

interface MobileMenuSettingsItemProps {
  isLightMode: boolean;
  onOpenSettings: () => void;
}

/**
 * Settings row for the mobile hamburger drawer.
 *
 * A full-width row showing the Settings icon and the literal "Settings" label,
 * intended to be the drawer's first child (focus/tab order first). Activating it
 * opens the existing Settings dialog and closes the drawer via `onOpenSettings`.
 * A bottom border separates it from the Library content below.
 */
export function MobileMenuSettingsItem({
  isLightMode,
  onOpenSettings,
}: MobileMenuSettingsItemProps) {
  return (
    <button
      type="button"
      onClick={onOpenSettings}
      className={`w-full flex items-center gap-3 px-4 py-3 border-b transition-colors ${
        isLightMode
          ? 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'
          : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-800/40'
      }`}
    >
      <Settings
        className={`w-5 h-5 ${isLightMode ? 'text-zinc-500' : 'text-zinc-400'}`}
      />
      <span className="text-lg font-bold tracking-wide">Settings</span>
    </button>
  );
}
