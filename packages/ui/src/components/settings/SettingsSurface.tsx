import type { ReactElement } from 'react';
import { SettingsMenu } from './SettingsMenu';
import { SettingsPanel } from './SettingsPanel';
import { AppearanceSettings } from './AppearanceSettings';
import { HandsFreeSection } from './HandsFreeSection';
import { SETTINGS_CATEGORIES, type SettingsCategoryId } from './categories';

export type SettingsView =
  null | { kind: 'menu' } | { kind: 'category'; id: SettingsCategoryId };

const SCREENS: Record<
  SettingsCategoryId,
  (props: { isLightMode: boolean }) => ReactElement
> = {
  appearance: AppearanceSettings,
  handsfree: HandsFreeSection,
};

interface SettingsSurfaceProps {
  view: SettingsView;
  isLightMode: boolean;
  onSelect: (id: SettingsCategoryId) => void;
  onClose: () => void;
}

export function SettingsSurface({
  view,
  isLightMode,
  onSelect,
  onClose,
}: SettingsSurfaceProps) {
  if (view === null) return null;

  if (view.kind === 'menu') {
    return (
      <SettingsMenu
        isLightMode={isLightMode}
        onSelect={onSelect}
        onClose={onClose}
      />
    );
  }

  const category = SETTINGS_CATEGORIES.find(c => c.id === view.id);
  if (!category) return null;
  const Screen = SCREENS[view.id];

  return (
    <SettingsPanel
      title={category.label}
      widthClass={category.widthClass}
      isLightMode={isLightMode}
      onClose={onClose}>
      <Screen isLightMode={isLightMode} />
    </SettingsPanel>
  );
}
