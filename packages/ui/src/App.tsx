import { useEffect, useState } from 'react';
import Settings from 'lucide-react/dist/esm/icons/settings';
import Menu from 'lucide-react/dist/esm/icons/menu';
import { useBreakpoint } from './hooks/useBreakpoint';
import { useResolvedTheme } from './hooks/useResolvedTheme';
import { ConnectionIndicator } from './components/ConnectionIndicator';
import { LibrarySidebar } from './components/LibrarySidebar';
import { MobileMenuSettingsItem } from './components/MobileMenuSettingsItem';
import { TopTabs, type Tab } from './components/TopTabs';
import { MIDIDeviceChooser } from './components/MIDIDeviceChooser';
import { AlertModal } from './components/modals/AlertModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { DisplayScreen } from './screens/display/DisplayScreen';
import { StatusBar } from './screens/display/StatusBar';
import { PresetsScreen } from './screens/presets/PresetsScreen';
import { ProfilesScreen } from './screens/profiles/ProfilesScreen';

const TABS = [
  'PRESETS',
  'DISPLAY',
  'PROFILES',
] as const satisfies readonly Tab[];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('DISPLAY');
  const [showSettings, setShowSettings] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const tier = useBreakpoint();
  const isMobile = tier.viewport === 'mobile';
  const isSidebarMobile = tier.sidebar === 'mobile';
  const isSidebarTablet = tier.sidebar === 'tablet';
  const statusBarCompact = tier.viewport === 'mobile';

  useEffect(() => {
    if (!isMobile) setLibraryOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (!libraryOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLibraryOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [libraryOpen]);

  // 009-settings-preferences (Task 5.3): the rendered theme is resolved from the
  // preference + OS scheme. The downstream `isLightMode` prop contract for every
  // screen/modal/component is unchanged — only the source of the boolean.
  const isLightMode = useResolvedTheme() === 'light';

  return (
    <div
      className={`h-dvh w-screen min-w-[320px] flex flex-col font-sans select-none overflow-hidden transition-colors duration-500 ${
        isLightMode ? 'bg-slate-100' : 'bg-zinc-950'
      }`}>
      {/* macOS traffic-light strip (draggable) */}
      <div
        className={`h-9 shrink-0 titlebar-drag border-b transition-colors ${
          isLightMode
            ? 'bg-zinc-50 border-zinc-200'
            : 'bg-zinc-950 border-zinc-800'
        }`}
      />

      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        {!isSidebarMobile && (
          <LibrarySidebar
            isLightMode={isLightMode}
            className={isSidebarTablet ? 'w-[40%] shrink-0' : undefined}
          />
        )}

        {/* ── Main Area ── */}
        <div className="flex-1 flex flex-col relative h-full min-w-0">
          {/* Top Bar */}
          <div
            className={`flex justify-between items-center pt-5 pb-2 shrink-0 ${isMobile ? 'px-4' : 'px-8'}`}>
            <div className="flex items-center gap-2">
              {isSidebarMobile && (
                <button
                  onClick={() => setLibraryOpen(true)}
                  aria-label="Open library"
                  aria-expanded={libraryOpen}
                  className="tap-target">
                  <Menu
                    className={`w-6 h-6 transition-colors ${
                      isLightMode
                        ? 'text-zinc-500 hover:text-zinc-800'
                        : 'text-zinc-400 hover:text-zinc-100'
                    }`}
                  />
                </button>
              )}
              {!isSidebarMobile && (
                <button
                  onClick={() => setShowSettings(true)}
                  aria-label="Open settings">
                  <Settings
                    className={`w-6 h-6 transition-colors ${
                      isLightMode
                        ? 'text-zinc-500 hover:text-zinc-800'
                        : 'text-zinc-400 hover:text-zinc-100'
                    }`}
                  />
                </button>
              )}
            </div>

            <TopTabs
              isLightMode={isLightMode}
              tabs={TABS}
              activeTab={activeTab}
              onChange={setActiveTab}
              tier={tier}
            />

            <ConnectionIndicator isLightMode={isLightMode} />
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden relative">
            {activeTab === 'DISPLAY' && (
              <DisplayScreen isLightMode={isLightMode} />
            )}
            {activeTab === 'PRESETS' && (
              <PresetsScreen isLightMode={isLightMode} />
            )}
            {activeTab === 'PROFILES' && (
              <ProfilesScreen isLightMode={isLightMode} />
            )}
          </div>

          {/* Bottom Status Bar */}
          <StatusBar isLightMode={isLightMode} compact={statusBarCompact} />
        </div>

        {/* Library drawer (mobile only) */}
        {isSidebarMobile && (
          <>
            <div
              onClick={() => setLibraryOpen(false)}
              aria-hidden
              className={`absolute inset-0 z-30 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
                libraryOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            />
            <div
              className={`absolute inset-y-0 left-0 z-40 flex flex-col w-[min(360px,85vw)] transition-transform duration-200 ease-out ${
                libraryOpen ? 'translate-x-0' : '-translate-x-full'
              }`}
              role="dialog"
              aria-label="Tone library"
              aria-modal="true">
              <MobileMenuSettingsItem
                isLightMode={isLightMode}
                onOpenSettings={() => {
                  setShowSettings(true);
                  setLibraryOpen(false);
                }}
              />
              <div className="flex-1 min-h-0">
                <LibrarySidebar
                  isLightMode={isLightMode}
                  className="w-full h-full"
                  onAfterSelect={() => setLibraryOpen(false)}
                />
              </div>
            </div>
          </>
        )}
      </div>
      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        isLightMode={isLightMode}
      />
      <MIDIDeviceChooser isLightMode={isLightMode} />
      <AlertModal isLightMode={isLightMode} />
    </div>
  );
}
