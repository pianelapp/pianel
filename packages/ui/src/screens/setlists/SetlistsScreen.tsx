import { useCallback, useState } from 'react';
import Plus from 'lucide-react/dist/esm/icons/plus';
import { useSongs } from '../../hooks/useSongs';
import { useSetlists } from '../../hooks/useSetlists';
import { usePerformCursor } from '../../hooks/usePerformCursor';
import { useLongPress, type LongPressPoint } from '../../hooks/useLongPress';
import { NamingDialog } from '../../components/NamingDialog';
import { RowContextMenu, type RowAction } from '../../components/RowContextMenu';
import { showAlert } from '../../components/modals/AlertModal';
import type { Song, Setlist } from '../../store';
import { SongDetail } from './SongDetail';
import { SetlistDetail } from './SetlistDetail';
import { sceneCountLabel } from './labels';

type Pane = 'songs' | 'setlists';

type SongMenuAction = 'rename' | 'arm' | 'delete';

type SongDialogState =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'rename'; song: Song };

type SongMenuState =
  | { kind: 'closed' }
  | { kind: 'open'; song: Song; x: number; y: number };

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

function rowClass(selected: boolean, isLightMode: boolean): string {
  return `flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left w-full ${
    isLightMode
      ? 'bg-white border-zinc-200 hover:border-zinc-300'
      : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
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
      className={rowClass(isSelected, isLightMode)}
    >
      <div className="flex-1 min-w-0">
        <div
          className={`text-base font-bold truncate ${
            isLightMode ? 'text-zinc-800' : 'text-zinc-200'
          }`}
        >
          {song.name}
        </div>
        <div
          className={`text-xs font-mono mt-0.5 ${
            isLightMode ? 'text-zinc-400' : 'text-zinc-600'
          }`}
        >
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

export function SetlistsScreen({
  isLightMode,
  armedSongId,
  onArm,
}: SetlistsScreenProps) {
  const { songs, createSong, renameSong, deleteSong } = useSongs();
  const { setlists, countSetlistsUsing } = useSetlists();
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

  const selectedSong: Song | null =
    songs.find(s => s.id === selectedSongId) ?? null;
  const selectedSetlist: Setlist | null =
    setlists.find(l => l.id === selectedSetlistId) ?? null;

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
        onArm(armedSongId === song.id ? null : song.id);
      } else if (action === 'delete') {
        const used = countSetlistsUsing(song.id);
        const usage =
          used === 0
            ? ''
            : ` It is used in ${used === 1 ? '1 setlist' : `${used} setlists`}.`;
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
    [songMenu, armedSongId, onArm, countSetlistsUsing, deleteSong],
  );

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
                  label: `Used in ${songMenuUsage === 1 ? '1 setlist' : `${songMenuUsage} setlists`}`,
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
    <div className="w-full h-full flex flex-col px-8 py-4">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPane('songs')}
            className={paneButtonClass(pane === 'songs', isLightMode)}
          >
            Songs
          </button>
          <button
            onClick={() => setPane('setlists')}
            className={paneButtonClass(pane === 'setlists', isLightMode)}
          >
            Setlists
          </button>
        </div>
        {pane === 'songs' && (
          <button
            onClick={() => setSongDialog({ kind: 'create' })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              isLightMode
                ? 'bg-zinc-200 hover:bg-zinc-300 text-zinc-700'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            New Song
          </button>
        )}
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        <div className="w-[38%] shrink-0 flex flex-col gap-2 overflow-y-auto custom-scrollbar pb-4">
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
                    setSongMenu({ kind: 'open', song, x: evt.clientX, y: evt.clientY });
                  }}
                  onLongPress={point =>
                    setSongMenu({ kind: 'open', song, x: point.x, y: point.y })
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
              <button
                key={setlist.id}
                onClick={() => setSelectedSetlistId(setlist.id)}
                aria-pressed={setlist.id === selectedSetlistId}
                className={rowClass(
                  setlist.id === selectedSetlistId,
                  isLightMode,
                )}
              >
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-base font-bold truncate ${
                      isLightMode ? 'text-zinc-800' : 'text-zinc-200'
                    }`}
                  >
                    {setlist.name}
                  </div>
                  <div
                    className={`text-xs font-mono mt-0.5 ${
                      isLightMode ? 'text-zinc-400' : 'text-zinc-600'
                    }`}
                  >
                    {setlist.entries.length} song
                    {setlist.entries.length === 1 ? '' : 's'}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        <div
          className={`flex-1 min-w-0 rounded-xl border overflow-hidden ${
            isLightMode ? 'border-zinc-200' : 'border-zinc-800'
          }`}
        >
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
              onPerform={setlistId => {
                void enterSetlist(setlistId).catch(() => {});
              }}
            />
          ) : (
            <div className={emptyStateClass(isLightMode)}>
              Select a setlist to see its songs.
            </div>
          )}
        </div>
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
    </div>
  );
}
