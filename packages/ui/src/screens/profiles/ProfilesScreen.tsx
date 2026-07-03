/**
 * ProfilesScreen — list of profiles ordered by `updatedAt` desc with a
 * + New Profile button (FR-003 position), an Import button (FR-019), and
 * an active-profile indicator next to the active row.
 */

import { useCallback, useState } from 'react';
import Plus from 'lucide-react/dist/esm/icons/plus';
import Upload from 'lucide-react/dist/esm/icons/upload';
import { useProfiles } from '../../hooks/useProfiles';
import { useAppSettingsStore } from '../../store';
import type { Profile, ProfileExportFile } from '../../store';
import { ProfileRow } from './ProfileRow';
import { ProfileContextMenu, type ProfileMenuAction } from './ProfileContextMenu';
import { ProfileNamingDialog } from './ProfileNamingDialog';
import { showAlert } from '../../components/modals/AlertModal';

interface ProfilesScreenProps {
  isLightMode: boolean;
}

type DialogState =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'rename'; profile: Profile };

type MenuState =
  | { kind: 'closed' }
  | { kind: 'open'; profile: Profile; x: number; y: number };

type ConflictState =
  | { kind: 'closed' }
  | { kind: 'open'; parsed: ProfileExportFile; existing: Profile };

export function ProfilesScreen({ isLightMode }: ProfilesScreenProps) {
  const {
    profiles,
    activeProfile,
    createProfile,
    updateProfile,
    renameProfile,
    deleteProfile,
    loadProfile,
    exportProfile,
    importProfile,
    confirmImportOverwrite,
  } = useProfiles();

  const [dialog, setDialog] = useState<DialogState>({ kind: 'closed' });
  const [menu, setMenu] = useState<MenuState>({ kind: 'closed' });
  const [conflict, setConflict] = useState<ConflictState>({ kind: 'closed' });
  const bootProfileId = useAppSettingsStore(s => s.bootProfileId);
  const setBootProfileId = useAppSettingsStore(s => s.setBootProfileId);

  const handleCreate = useCallback(
    async (name: string) => {
      try {
        await createProfile(name);
      } catch (err) {
        await showAlert({
          variant: 'error',
          title: 'Could not create profile',
          message: err instanceof Error ? err.message : 'Unknown error.',
        });
      }
      setDialog({ kind: 'closed' });
    },
    [createProfile],
  );

  const handleRename = useCallback(
    async (name: string) => {
      if (dialog.kind !== 'rename') return;
      try {
        await renameProfile(dialog.profile.id, name);
      } catch (err) {
        await showAlert({
          variant: 'error',
          title: 'Could not rename profile',
          message: err instanceof Error ? err.message : 'Unknown error.',
        });
      }
      setDialog({ kind: 'closed' });
    },
    [dialog, renameProfile],
  );

  const handleMenuAction = useCallback(
    async (action: ProfileMenuAction) => {
      if (menu.kind !== 'open') return;
      const profile = menu.profile;
      setMenu({ kind: 'closed' });
      if (action === 'setDefault') {
        setBootProfileId(profile.id);
      } else if (action === 'update') {
        await updateProfile(profile.id);
      } else if (action === 'rename') {
        setDialog({ kind: 'rename', profile });
      } else if (action === 'export') {
        const saved = await exportProfile(profile.id);
        if (saved) {
          await showAlert({
            variant: 'success',
            title: 'Profile exported',
            message: `Saved "${profile.name}".`,
          });
        }
      } else if (action === 'delete') {
        const confirmed = await showAlert({
          variant: 'warning',
          title: 'Delete profile?',
          message: `Delete profile "${profile.name}" and all its presets? This cannot be undone.`,
          confirmLabel: 'Delete',
          cancelLabel: 'Cancel',
        });
        if (confirmed) {
          await deleteProfile(profile.id);
        }
      }
    },
    [menu, updateProfile, deleteProfile, exportProfile, setBootProfileId],
  );

  const handleImport = useCallback(async () => {
    try {
      const result = await importProfile();
      if (!result) return;
      if (result.kind === 'cancelled') return;
      if (result.kind === 'conflict') {
        setConflict({ kind: 'open', parsed: result.parsed, existing: result.existing });
      } else if (result.kind === 'imported') {
        await showAlert({
          variant: 'success',
          title: 'Profile imported',
          message: `Imported as "${result.profile.name}".`,
        });
      }
    } catch (err) {
      await showAlert({
        variant: 'error',
        title: 'Could not import profile',
        message: err instanceof Error ? err.message : 'Unknown error.',
      });
    }
  }, [importProfile]);

  const handleConfirmOverwrite = useCallback(async () => {
    if (conflict.kind !== 'open') return;
    const parsed = conflict.parsed;
    setConflict({ kind: 'closed' });
    try {
      await confirmImportOverwrite(parsed);
      await showAlert({
        variant: 'success',
        title: 'Profile overwritten',
        message: `Replaced "${parsed.profile.name}".`,
      });
    } catch (err) {
      await showAlert({
        variant: 'error',
        title: 'Overwrite failed',
        message: err instanceof Error ? err.message : 'Unknown error.',
      });
    }
  }, [conflict, confirmImportOverwrite]);

  return (
    <div className="w-full h-full flex flex-col px-8 py-4">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <span
          className={`text-sm font-bold tracking-wide ${
            isLightMode ? 'text-zinc-700' : 'text-zinc-300'
          }`}
        >
          Profiles ({profiles.length})
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleImport}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              isLightMode
                ? 'bg-zinc-200 hover:bg-zinc-300 text-zinc-700'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Import
          </button>
          <button
            onClick={() => setDialog({ kind: 'create' })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              isLightMode
                ? 'bg-zinc-200 hover:bg-zinc-300 text-zinc-700'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            New Profile
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {profiles.length === 0 ? (
          <div
            className={`text-center py-12 ${
              isLightMode ? 'text-zinc-400' : 'text-zinc-600'
            }`}
          >
            <div className="text-sm font-mono mb-2">No profiles yet</div>
            <div className="text-xs">
              Click "New Profile" to capture the current piano state
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 pb-4">
            {profiles.map(profile => (
              <ProfileRow
                key={profile.id}
                profile={profile}
                isActive={profile.id === activeProfile?.id}
                isDefault={profile.id === bootProfileId}
                isLightMode={isLightMode}
                onClick={() => loadProfile(profile.id)}
                onContextMenu={evt => {
                  evt.preventDefault();
                  setMenu({ kind: 'open', profile, x: evt.clientX, y: evt.clientY });
                }}
              />
            ))}
          </div>
        )}
      </div>

      {dialog.kind === 'create' && (
        <ProfileNamingDialog
          title="New profile"
          confirmLabel="Save Profile"
          isLightMode={isLightMode}
          onConfirm={handleCreate}
          onCancel={() => setDialog({ kind: 'closed' })}
        />
      )}
      {dialog.kind === 'rename' && (
        <ProfileNamingDialog
          title="Rename profile"
          confirmLabel="Save"
          initialValue={dialog.profile.name}
          isLightMode={isLightMode}
          onConfirm={handleRename}
          onCancel={() => setDialog({ kind: 'closed' })}
        />
      )}
      {menu.kind === 'open' && (
        <ProfileContextMenu
          x={menu.x}
          y={menu.y}
          isLightMode={isLightMode}
          isDefault={menu.profile.id === bootProfileId}
          onClose={() => setMenu({ kind: 'closed' })}
          onAction={handleMenuAction}
        />
      )}
      {conflict.kind === 'open' && (
        <ImportConflictDialog
          parsed={conflict.parsed}
          existing={conflict.existing}
          isLightMode={isLightMode}
          onCancel={() => setConflict({ kind: 'closed' })}
          onConfirm={handleConfirmOverwrite}
        />
      )}
    </div>
  );
}

function ImportConflictDialog({
  parsed,
  existing,
  isLightMode,
  onCancel,
  onConfirm,
}: {
  parsed: ProfileExportFile;
  existing: Profile;
  isLightMode: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <div
        className={`w-[360px] rounded-3xl p-6 shadow-2xl border ${
          isLightMode ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'
        }`}
      >
        <h2
          className={`text-lg font-bold mb-3 ${
            isLightMode ? 'text-zinc-800' : 'text-zinc-100'
          }`}
        >
          Profile already exists
        </h2>
        <p
          className={`text-sm leading-relaxed mb-5 ${
            isLightMode ? 'text-zinc-600' : 'text-zinc-400'
          }`}
        >
          A profile with the same id is already saved ({existing.name}). Importing
          will overwrite it with the contents of "{parsed.profile.name}". This
          cannot be undone.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className={`flex-1 text-sm font-bold tracking-widest py-2.5 rounded-xl ${
              isLightMode
                ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 text-sm font-bold tracking-widest py-2.5 rounded-xl ${
              isLightMode
                ? 'bg-amber-600 text-white hover:bg-amber-700'
                : 'bg-amber-500 text-zinc-950 hover:bg-amber-400'
            }`}
          >
            Overwrite
          </button>
        </div>
      </div>
    </div>
  );
}
