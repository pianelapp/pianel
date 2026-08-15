import {act} from 'react';
import {render, type RenderResult} from '../utils/render';
import {SetlistsScreen} from '../../src/screens/setlists/SetlistsScreen';
import {SongDetail} from '../../src/screens/setlists/SongDetail';
import {SetlistDetail} from '../../src/screens/setlists/SetlistDetail';
import {DisplayScreen} from '../../src/screens/display/DisplayScreen';
import {PresetsScreen} from '../../src/screens/presets/PresetsScreen';
import {AlertModal} from '../../src/components/modals/AlertModal';
import {useSongs} from '../../src/hooks/useSongs';
import {useSetlists} from '../../src/hooks/useSetlists';

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

afterEach(() => {
  if (lastRendered && lastRendered.container.isConnected) {
    lastRendered.unmount();
  }
  lastRendered = null;
});

interface RenderScreenOptions {
  armedSongId?: string | null;
  onArm?: (songId: string | null) => void;
}

export function renderScreen(opts: RenderScreenOptions = {}): RenderResult {
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

interface RenderListOptions {
  onPerform?: (setlistId: string) => void;
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

export function renderPresets(): RenderResult {
  lastRendered = render(
    <>
      <PresetsScreen isLightMode={false} />
      <AlertModal isLightMode={false} />
    </>,
  );
  return lastRendered;
}
