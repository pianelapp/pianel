import {act, type ReactElement} from 'react';
import {render, type RenderResult} from '../utils/render';
import {SetlistsScreen} from '../../src/screens/setlists/SetlistsScreen';
import {SongDetail} from '../../src/screens/setlists/SongDetail';
import {SetlistDetail} from '../../src/screens/setlists/SetlistDetail';
import {DisplayScreen} from '../../src/screens/display/DisplayScreen';
import {PerformMode} from '../../src/screens/perform/PerformMode';
import {CurrentScene} from '../../src/screens/perform/CurrentScene';
import {SceneRail} from '../../src/screens/perform/SceneRail';
import {SongPicker, type SongPickerEntry} from '../../src/screens/perform/SongPicker';
import {PresetsScreen} from '../../src/screens/presets/PresetsScreen';
import {AlertModal} from '../../src/components/modals/AlertModal';
import {useSongs} from '../../src/hooks/useSongs';
import {useSetlists} from '../../src/hooks/useSetlists';
import {setPianoService} from '../../src/hooks/usePiano';
import {BASE_SCENE, sceneWith, wire} from './setlists';
import type {Scene} from '../../src/store';
import type {PianoService} from '@pianel/core/services/PianoService';
import type {QuickToneSlot} from '@pianel/core/types/quickToneSlot';

export function stubPianoWithTones(tones: Array<{id: string; name: string}>): void {
  const catalog = {
    findById: (id: string) => tones.find(t => t.id === id),
  };
  setPianoService({getToneCatalog: () => catalog} as unknown as PianoService);
}

export function byText(container: HTMLElement, text: string): HTMLElement {
  const matches = [...container.querySelectorAll('button, div, span')].filter(
    el => el.textContent?.trim() === text,
  );
  const innermost = matches.find(
    el => !matches.some(other => other !== el && el.contains(other)),
  );
  if (!innermost) throw new Error(`no element with text ${JSON.stringify(text)}`);
  return innermost as HTMLElement;
}

export function typeInto(container: HTMLElement, value: string): void {
  const field = container.querySelector('input, textarea');
  if (!field) throw new Error('no input or textarea found');
  const proto =
    field instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(field, value);
    field.dispatchEvent(new Event('input', {bubbles: true}));
  });
}

export function openContextMenu(container: HTMLElement, text: string): void {
  const row = byText(container, text);
  act(() => {
    row.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true}));
  });
}

let lastRendered: RenderResult | null = null;

function unmountLastRendered(): void {
  if (lastRendered && lastRendered.container.isConnected) {
    lastRendered.unmount();
  }
  lastRendered = null;
}

afterEach(unmountLastRendered);

interface RenderScreenOptions {
  armedSongId?: string | null;
  onArm?: (songId: string | null) => void;
}

export function renderScreen(opts: RenderScreenOptions = {}): RenderResult {
  unmountLastRendered();
  lastRendered = render(
    <>
      <SetlistsScreen
        isLightMode={false}
        armedSongId={opts.armedSongId ?? null}
        onArm={opts.onArm ?? (() => {})}
      />
      <AlertModal isLightMode={false} />
    </>,
  );
  return lastRendered;
}

interface RenderDetailOptions {
  isArmed?: boolean;
  onArm?: (songId: string | null) => void;
  onPerform?: (songId: string) => void;
}

function DetailHarness({
  songId,
  isArmed,
  onArm,
  onPerform,
}: RenderDetailOptions & {songId: string}) {
  const {songs} = useSongs();
  const song = songs.find(s => s.id === songId);
  if (!song) return null;
  return (
    <SongDetail
      song={song}
      isLightMode={false}
      isArmed={isArmed ?? false}
      onArm={onArm ?? (() => {})}
      onPerform={onPerform ?? (() => {})}
    />
  );
}

export function renderDetail(
  songId: string,
  opts: RenderDetailOptions = {},
): RenderResult {
  lastRendered = render(
    <>
      <DetailHarness songId={songId} {...opts} />
      <AlertModal isLightMode={false} />
    </>,
  );
  return lastRendered;
}

export interface PerformStartAt {
  entryIndex: number;
  sceneIndex?: number;
}

interface RenderListOptions {
  onPerform?: (setlistId: string, startAt?: PerformStartAt) => void;
}

function ListHarness({
  setlistId,
  onPerform,
}: RenderListOptions & {setlistId: string}) {
  const {setlists} = useSetlists();
  const setlist = setlists.find(s => s.id === setlistId);
  if (!setlist) return null;
  return (
    <SetlistDetail
      setlist={setlist}
      isLightMode={false}
      onPerform={onPerform ?? (() => {})}
    />
  );
}

export function renderList(
  setlistId: string,
  opts: RenderListOptions = {},
): RenderResult {
  lastRendered = render(
    <>
      <ListHarness setlistId={setlistId} {...opts} />
      <AlertModal isLightMode={false} />
    </>,
  );
  return lastRendered;
}

interface RenderDisplayOptions {
  armedSongId?: string | null;
  onArm?: (songId: string | null) => void;
  compact?: boolean;
}

export function renderDisplay(opts: RenderDisplayOptions = {}): RenderResult {
  lastRendered = render(
    <DisplayScreen
      isLightMode={false}
      armedSongId={opts.armedSongId ?? null}
      onArm={opts.onArm ?? (() => {})}
      compact={opts.compact ?? false}
    />,
  );
  return lastRendered;
}

interface RenderPerformOptions {
  isLightMode?: boolean;
}

export function renderPerform(opts: RenderPerformOptions = {}): RenderResult {
  lastRendered = render(<PerformMode isLightMode={opts.isLightMode ?? false} />);
  return lastRendered;
}

export async function renderPerforming(
  sceneLabels: string[],
  opts: RenderPerformOptions = {},
): Promise<RenderResult> {
  unmountLastRendered();
  const {songs, cursor} = wire();
  const songId = songs.createSong('Song').id;
  for (const label of sceneLabels) songs.captureScene(songId, label);
  lastRendered = render(<PerformMode isLightMode={opts.isLightMode ?? false} />);
  await act(async () => {
    await cursor.enterPerform({songId});
  });
  return lastRendered;
}

export async function renderPerformingSetlist(
  songNames: string[],
  opts: RenderPerformOptions = {},
): Promise<RenderResult> {
  unmountLastRendered();
  const {songs, setlists, cursor} = wire();
  const listId = setlists.createSetlist('Bar Gig').id;
  for (const name of songNames) {
    const songId = songs.createSong(name).id;
    songs.captureScene(songId, 'Scene');
    setlists.addSong(listId, songId);
  }
  lastRendered = render(<PerformMode isLightMode={opts.isLightMode ?? false} />);
  await act(async () => {
    await cursor.enterPerform({setlistId: listId});
  });
  return lastRendered;
}

interface RenderSceneOptions {
  isLightMode?: boolean;
  stacked?: boolean;
}

export function renderScene(
  scene: Scene,
  isModified = false,
  opts: RenderSceneOptions = {},
): RenderResult {
  lastRendered = render(
    <CurrentScene
      scene={scene}
      isLightMode={opts.isLightMode ?? false}
      stacked={opts.stacked ?? false}
      isModified={isModified}
    />,
  );
  return lastRendered;
}

export interface RailSceneSpec extends Partial<QuickToneSlot> {
  label: string;
}

function railScenesFromLabels(labels: string[]): Scene[] {
  return labels.map((label, index) => ({...BASE_SCENE, id: `scene-${index}`, label}));
}

function railScenesFromSpecs(specs: RailSceneSpec[]): Scene[] {
  return specs.map(({label, ...voiceModeSnapshot}, index) =>
    sceneWith(voiceModeSnapshot, {id: `scene-${index}`, label}),
  );
}

function sceneRailElement(
  scenes: Scene[],
  currentIndex: number,
  onJump: (index: number) => void,
  anchorIndex: number | null = null,
): ReactElement {
  return (
    <SceneRail
      scenes={scenes}
      currentIndex={currentIndex}
      anchorIndex={anchorIndex}
      isLightMode={false}
      onJump={onJump}
    />
  );
}

export function renderRail(
  labels: string[],
  currentIndex: number,
  onJump: (index: number) => void = () => {},
  anchorIndex: number | null = null,
): RenderResult {
  lastRendered = render(
    sceneRailElement(railScenesFromLabels(labels), currentIndex, onJump, anchorIndex),
  );
  return lastRendered;
}

export function renderRailWithScenes(
  specs: RailSceneSpec[],
  currentIndex: number,
  onJump: (index: number) => void = () => {},
  anchorIndex: number | null = null,
): RenderResult {
  lastRendered = render(
    sceneRailElement(railScenesFromSpecs(specs), currentIndex, onJump, anchorIndex),
  );
  return lastRendered;
}

export function railAt(
  labels: string[],
  currentIndex: number,
  onJump: (index: number) => void = () => {},
  anchorIndex: number | null = null,
): ReactElement {
  return sceneRailElement(
    railScenesFromLabels(labels),
    currentIndex,
    onJump,
    anchorIndex,
  );
}

export function renderPicker(
  songNames: string[],
  entryIndex: number,
  onJump: (index: number) => void = () => {},
  sceneIndex = 0,
  sceneCount = 1,
  customized: boolean[] = [],
  onClose: () => void = () => {},
): RenderResult {
  const entries: SongPickerEntry[] = songNames.map((name, index) => ({
    name,
    sceneCount,
    isCustomized: customized[index] ?? false,
  }));
  lastRendered = render(
    <SongPicker
      setlistName="Bar Gig"
      entries={entries}
      entryIndex={entryIndex}
      sceneIndex={sceneIndex}
      isLightMode={false}
      onJump={onJump}
      onClose={onClose}
    />,
  );
  return lastRendered;
}

export function renderPresets(): RenderResult {
  lastRendered = render(
    <>
      <PresetsScreen isLightMode={false} />
      <AlertModal isLightMode={false} />
    </>,
  );
  return lastRendered;
}
