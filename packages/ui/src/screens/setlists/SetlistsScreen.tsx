import { useCallback, useState } from 'react';
import Plus from 'lucide-react/dist/esm/icons/plus';
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left';
import { useSongs } from '../../hooks/useSongs';
import { useSetlists } from '../../hooks/useSetlists';
import { usePerformCursor } from '../../hooks/usePerformCursor';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useLongPress, type LongPressPoint } from '../../hooks/useLongPress';
import { NamingDialog } from '../../components/NamingDialog';
import {
  RowContextMenu,
  type RowAction,
} from '../../components/RowContextMenu';
import { showAlert } from '../../components/modals/AlertModal';
import type { Song, Setlist } from '../../store';
import { SongDetail } from './SongDetail';
import { SetlistDetail } from './SetlistDetail';
import { sceneCountLabel, setlistCountLabel } from './labels';
import { confirmArmForCapture } from './armGuard';

type Pane = 'songs' | 'setlists';

type SongMenuAction = 'rename' | 'arm' | 'delete';

type SetlistMenuAction = 'rename' | 'delete';

type SongDialogState =
  { kind: 'closed' } | { kind: 'create' } | { kind: 'rename'; song: Song };

type SongMenuState =
  { kind: 'closed' } | { kind: 'open'; song: Song; x: number; y: number };

type SetlistDialogState =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'rename'; setlist: Setlist };

type SetlistMenuState =
  { kind: 'closed' } | { kind: 'open'; setlist: Setlist; x: number; y: number };

interface SetlistsScreenProps {
  isLightMode: boolean;
  armedSongId: string | null;
  onArm: (songId: string | null) => void;
}

function paneButtonClass(active: boolean, isLightMode: boolean): string {
  return `px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
    active
      ? isLightMode
        ? 'bg-white text-cyan-700 border border-cyan-200 shadow-sm'
        : 'bg-zinc-800 text-cyan-400 border border-cyan-900/50'
      : isLightMode
        ? 'bg-zinc-200 hover:bg-zinc-300 text-zinc-700'
        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
  }`;
}

function headerButtonClass(isLightMode: boolean): string {
  return `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
    isLightMode
      ? 'bg-zinc-200 hover:bg-zinc-300 active:bg-zinc-400 text-zinc-700'
      : 'bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-200'
  }`;
}

function rowClass(selected: boolean, isLightMode: boolean): string {
  return `flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left w-full cursor-pointer ${
    isLightMode
      ? 'bg-white border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 active:bg-zinc-100'
      : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/60 active:bg-zinc-800/90'
  } ${selected ? (isLightMode ? 'border-cyan-300' : 'border-cyan-700/60') : ''}`;
}

function emptyStateClass(isLightMode: boolean): string {
  return `text-center py-12 ${isLightMode ? 'text-zinc-400' : 'text-zinc-600'}`;
}

interface SongRowProps {
  song: Song;
  isSelected: boolean;
  isArmed: boolean;
  isLightMode: boolean;
  onClick: () => void;
  onContextMenu: (event: React.MouseEvent) => void;
  onLongPress: (point: LongPressPoint) => void;
}

function SongRow({
  song,
  isSelected,
  isArmed,
  isLightMode,
  onClick,
  onContextMenu,
  onLongPress,
}: SongRowProps) {
  const longPress = useLongPress({ onLongPress });
  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      {...longPress}
      aria-pressed={isSelected}
      className={rowClass(isSelected, isLightMode)}>
      <div className="flex-1 min-w-0">
        <div
          className={`text-base font-bold truncate ${
            isLightMode ? 'text-zinc-800' : 'text-zinc-200'
          }`}>
          {song.name}
        </div>
        <div
          className={`text-xs font-mono mt-0.5 ${
            isLightMode ? 'text-zinc-400' : 'text-zinc-600'
          }`}>
          {sceneCountLabel(song.scenes.length)}
        </div>
      </div>
      {isArmed && (
        <span
          className="w-2 h-2 rounded-full bg-amber-400 shrink-0"
          title="armed for capture"
        />
      )}
    </button>
  );
}

interface SetlistRowProps {
  setlist: Setlist;
  isSelected: boolean;
  isLightMode: boolean;
  onClick: () => void;
  onContextMenu: (event: React.MouseEvent) => void;
  onLongPress: (point: LongPressPoint) => void;
}

function SetlistRow({
  setlist,
  isSelected,
  isLightMode,
  onClick,
  onContextMenu,
  onLongPress,
}: SetlistRowProps) {
  const longPress = useLongPress({ onLongPress });
  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      {...longPress}
      aria-pressed={isSelected}
      className={rowClass(isSelected, isLightMode)}>
      <div className="flex-1 min-w-0">
        <div
          className={`text-base font-bold truncate ${
            isLightMode ? 'text-zinc-800' : 'text-zinc-200'
          }`}>
          {setlist.name}
        </div>
        <div
          className={`text-xs font-mono mt-0.5 ${
            isLightMode ? 'text-zinc-400' : 'text-zinc-600'
          }`}>
          {setlist.entries.length} song
          {setlist.entries.length === 1 ? '' : 's'}
        </div>
      </div>
    </button>
  );
}

export function SetlistsScreen({
  isLightMode,
  armedSongId,
  onArm,
}: SetlistsScreenProps) {
  const { songs, createSong, renameSong, deleteSong } = useSongs();
  const {
    setlists,
    createSetlist,
    renameSetlist,
    deleteSetlist,
    countSetlistsUsing,
    findLibraryUses,
  } = useSetlists();
  const { enterSong, enterSetlist } = usePerformCursor();
  const [pane, setPane] = useState<Pane>('songs');
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [selectedSetlistId, setSelectedSetlistId] = useState<string | null>(
    null,
  );
  const [songDialog, setSongDialog] = useState<SongDialogState>({
    kind: 'closed',
  });
  const [songMenu, setSongMenu] = useState<SongMenuState>({ kind: 'closed' });
  const [setlistDialog, setSetlistDialog] = useState<SetlistDialogState>({
    kind: 'closed',
  });
  const [setlistMenu, setSetlistMenu] = useState<SetlistMenuState>({
    kind: 'closed',
  });

  const selectedSong: Song | null =
    songs.find(s => s.id === selectedSongId) ?? null;
  const selectedSetlist: Setlist | null =
    setlists.find(l => l.id === selectedSetlistId) ?? null;

  const { viewport } = useBreakpoint();
  const compact = viewport === 'mobile';
  const hasSelection =
    pane === 'songs' ? selectedSong !== null : selectedSetlist !== null;
  const showDetailOnly = compact && hasSelection;

  const clearSelection = (target: Pane) => {
    if (target === 'songs') setSelectedSongId(null);
    else setSelectedSetlistId(null);
  };

  const selectPane = (next: Pane) => {
    setPane(next);
    if (compact) clearSelection(next);
  };

  const handleCreateSong = useCallback(
    (name: string) => {
      createSong(name);
      setSongDialog({ kind: 'closed' });
    },
    [createSong],
  );

  const handleRenameSong = useCallback(
    (name: string) => {
      if (songDialog.kind !== 'rename') return;
      renameSong(songDialog.song.id, name);
      setSongDialog({ kind: 'closed' });
    },
    [songDialog, renameSong],
  );

  const handleSongMenuAction = useCallback(
    async (action: SongMenuAction) => {
      if (songMenu.kind !== 'open') return;
      const song = songMenu.song;
      setSongMenu({ kind: 'closed' });
      if (action === 'rename') {
        setSongDialog({ kind: 'rename', song });
      } else if (action === 'arm') {
        if (armedSongId === song.id) {
          onArm(null);
        } else {
          const proceed = await confirmArmForCapture(
            song,
            findLibraryUses,
            countSetlistsUsing,
          );
          if (proceed) onArm(song.id);
        }
      } else if (action === 'delete') {
        const used = countSetlistsUsing(song.id);
        const usage =
          used === 0 ? '' : ` It is used in ${setlistCountLabel(used)}.`;
        const confirmed = await showAlert({
          variant: 'warning',
          title: 'Delete song?',
          message: `Delete "${song.name}" and its ${sceneCountLabel(song.scenes.length)}?${usage} This cannot be undone.`,
          confirmLabel: 'Delete',
          cancelLabel: 'Cancel',
        });
        if (confirmed) {
          deleteSong(song.id);
        }
      }
    },
    [
      songMenu,
      armedSongId,
      onArm,
      findLibraryUses,
      countSetlistsUsing,
      deleteSong,
    ],
  );

  const handleCreateSetlist = useCallback(
    (name: string) => {
      createSetlist(name);
      setSetlistDialog({ kind: 'closed' });
    },
    [createSetlist],
  );

  const handleRenameSetlist = useCallback(
    (name: string) => {
      if (setlistDialog.kind !== 'rename') return;
      renameSetlist(setlistDialog.setlist.id, name);
      setSetlistDialog({ kind: 'closed' });
    },
    [setlistDialog, renameSetlist],
  );

  const handleSetlistMenuAction = useCallback(
    async (action: SetlistMenuAction) => {
      if (setlistMenu.kind !== 'open') return;
      const setlist = setlistMenu.setlist;
      setSetlistMenu({ kind: 'closed' });
      if (action === 'rename') {
        setSetlistDialog({ kind: 'rename', setlist });
      } else if (action === 'delete') {
        const confirmed = await showAlert({
          variant: 'warning',
          title: 'Delete setlist?',
          message: `Delete "${setlist.name}"? This cannot be undone.`,
          confirmLabel: 'Delete',
          cancelLabel: 'Cancel',
        });
        if (confirmed) {
          deleteSetlist(setlist.id);
        }
      }
    },
    [setlistMenu, deleteSetlist],
  );

  const setlistMenuActions: RowAction[] = [
    { id: 'rename', label: 'Rename' },
    { id: 'delete', label: 'Delete', destructive: true },
  ];

  const songMenuUsage =
    songMenu.kind === 'open' ? countSetlistsUsing(songMenu.song.id) : 0;

  const songMenuActions: RowAction[] =
    songMenu.kind === 'open'
      ? [
          { id: 'rename', label: 'Rename' },
          ...(songMenuUsage > 0
            ? [
                {
                  id: 'usage',
                  label: `Used in ${setlistCountLabel(songMenuUsage)}`,
                  disabled: true,
                },
              ]
            : []),
          {
            id: 'arm',
            label:
              armedSongId === songMenu.song.id
                ? 'Armed for capture'
                : 'Arm for capture',
          },
          { id: 'delete', label: 'Delete', destructive: true },
        ]
      : [];

  return (
    <div
      className={`w-full h-full flex flex-col py-4 ${compact ? 'px-4' : 'px-8'}`}>
      <div className="flex items-center justify-between mb-4 shrink-0">
        {showDetailOnly ? (
          <button
            data-detail-back
            onClick={() => clearSelection(pane)}
            className={headerButtonClass(isLightMode)}>
            <ChevronLeft className="w-3.5 h-3.5" />
            {pane === 'songs' ? 'Songs' : 'Setlists'}
          </button>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <button
                onClick={() => selectPane('songs')}
                className={paneButtonClass(pane === 'songs', isLightMode)}>
                Songs
              </button>
              <button
                onClick={() => selectPane('setlists')}
                className={paneButtonClass(pane === 'setlists', isLightMode)}>
                Setlists
              </button>
            </div>
            <button
              onClick={() =>
                pane === 'songs'
                  ? setSongDialog({ kind: 'create' })
                  : setSetlistDialog({ kind: 'create' })
              }
              className={headerButtonClass(isLightMode)}>
              <Plus className="w-3.5 h-3.5" />
              {pane === 'songs' ? 'New Song' : 'New Setlist'}
            </button>
          </>
        )}
      </div>

      <div className={`flex-1 min-h-0 flex ${compact ? '' : 'gap-4'}`}>
        {!showDetailOnly && (
          <div
            className={`flex flex-col gap-2 overflow-y-auto custom-scrollbar pb-4 ${
              compact ? 'w-full' : 'w-[38%] shrink-0'
            }`}>
            {pane === 'songs' ? (
              songs.length === 0 ? (
                <div className={emptyStateClass(isLightMode)}>
                  <div className="text-sm font-mono mb-2">No songs yet</div>
                  <div className="text-xs">
                    Create a song, then arm it and capture each sound from
                    DISPLAY as you play.
                  </div>
                </div>
              ) : (
                songs.map(song => (
                  <SongRow
                    key={song.id}
                    song={song}
                    isSelected={song.id === selectedSongId}
                    isArmed={song.id === armedSongId}
                    isLightMode={isLightMode}
                    onClick={() => setSelectedSongId(song.id)}
                    onContextMenu={evt => {
                      evt.preventDefault();
                      setSongMenu({
                        kind: 'open',
                        song,
                        x: evt.clientX,
                        y: evt.clientY,
                      });
                    }}
                    onLongPress={point =>
                      setSongMenu({
                        kind: 'open',
                        song,
                        x: point.x,
                        y: point.y,
                      })
                    }
                  />
                ))
              )
            ) : setlists.length === 0 ? (
              <div className={emptyStateClass(isLightMode)}>
                <div className="text-sm font-mono mb-2">No setlists yet</div>
                <div className="text-xs">
                  Group your songs into a setlist for the gig.
                </div>
              </div>
            ) : (
              setlists.map(setlist => (
                <SetlistRow
                  key={setlist.id}
                  setlist={setlist}
                  isSelected={setlist.id === selectedSetlistId}
                  isLightMode={isLightMode}
                  onClick={() => setSelectedSetlistId(setlist.id)}
                  onContextMenu={evt => {
                    evt.preventDefault();
                    setSetlistMenu({
                      kind: 'open',
                      setlist,
                      x: evt.clientX,
                      y: evt.clientY,
                    });
                  }}
                  onLongPress={point =>
                    setSetlistMenu({
                      kind: 'open',
                      setlist,
                      x: point.x,
                      y: point.y,
                    })
                  }
                />
              ))
            )}
          </div>
        )}

        {(!compact || showDetailOnly) && (
          <div
            className={`flex-1 min-w-0 rounded-xl border overflow-hidden ${
              isLightMode ? 'border-zinc-200' : 'border-zinc-800'
            }`}>
            {pane === 'songs' ? (
              selectedSong ? (
                <SongDetail
                  song={selectedSong}
                  isLightMode={isLightMode}
                  isArmed={armedSongId === selectedSong.id}
                  onArm={onArm}
                  onPerform={songId => {
                    void enterSong(songId).catch(() => {});
                  }}
                />
              ) : (
                <div className={emptyStateClass(isLightMode)}>
                  Select a song to see its scenes.
                </div>
              )
            ) : selectedSetlist ? (
              <SetlistDetail
                setlist={selectedSetlist}
                isLightMode={isLightMode}
                onPerform={(setlistId, startAt) => {
                  void enterSetlist(setlistId, startAt).catch(() => {});
                }}
              />
            ) : (
              <div className={emptyStateClass(isLightMode)}>
                Select a setlist to see its songs.
              </div>
            )}
          </div>
        )}
      </div>

      {songDialog.kind === 'create' && (
        <NamingDialog
          title="New song"
          confirmLabel="Save"
          placeholder="Song name"
          isLightMode={isLightMode}
          onConfirm={handleCreateSong}
          onCancel={() => setSongDialog({ kind: 'closed' })}
        />
      )}
      {songDialog.kind === 'rename' && (
        <NamingDialog
          title="Rename song"
          confirmLabel="Save"
          initialValue={songDialog.song.name}
          placeholder="Song name"
          isLightMode={isLightMode}
          onConfirm={handleRenameSong}
          onCancel={() => setSongDialog({ kind: 'closed' })}
        />
      )}
      {songMenu.kind === 'open' && (
        <RowContextMenu
          x={songMenu.x}
          y={songMenu.y}
          isLightMode={isLightMode}
          actions={songMenuActions}
          onClose={() => setSongMenu({ kind: 'closed' })}
          onAction={(id: string) => handleSongMenuAction(id as SongMenuAction)}
        />
      )}
      {setlistDialog.kind === 'create' && (
        <NamingDialog
          title="New setlist"
          confirmLabel="Save"
          placeholder="Setlist name"
          isLightMode={isLightMode}
          onConfirm={handleCreateSetlist}
          onCancel={() => setSetlistDialog({ kind: 'closed' })}
        />
      )}
      {setlistDialog.kind === 'rename' && (
        <NamingDialog
          title="Rename setlist"
          confirmLabel="Save"
          initialValue={setlistDialog.setlist.name}
          placeholder="Setlist name"
          isLightMode={isLightMode}
          onConfirm={handleRenameSetlist}
          onCancel={() => setSetlistDialog({ kind: 'closed' })}
        />
      )}
      {setlistMenu.kind === 'open' && (
        <RowContextMenu
          x={setlistMenu.x}
          y={setlistMenu.y}
          isLightMode={isLightMode}
          actions={setlistMenuActions}
          onClose={() => setSetlistMenu({ kind: 'closed' })}
          onAction={(id: string) =>
            handleSetlistMenuAction(id as SetlistMenuAction)
          }
        />
      )}
    </div>
  );
}
