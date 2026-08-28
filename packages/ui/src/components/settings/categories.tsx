import type { ComponentType } from 'react';
import Palette from 'lucide-react/dist/esm/icons/palette';
import Footprints from 'lucide-react/dist/esm/icons/footprints';

export type SettingsCategoryId = 'appearance' | 'handsfree';

export interface SettingsCategory {
  id: SettingsCategoryId;
  label: string;
  icon: ComponentType<{ className?: string }>;
  widthClass: string;
}

export const SETTINGS_CATEGORIES: readonly SettingsCategory[] = [
  {
    id: 'appearance',
    label: 'Appearance',
    icon: Palette,
    widthClass: 'w-[420px]',
  },
  {
    id: 'handsfree',
    label: 'Hands-free control',
    icon: Footprints,
    widthClass: 'w-[560px]',
  },
];
