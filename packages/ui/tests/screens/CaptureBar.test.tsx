import {act} from 'react';
import {click} from '../utils/render';
import {initTestStores} from '../utils/stores';
import {wire, resetSetlistWorld} from '../fixtures/setlists';
import {byText, renderDisplay} from '../fixtures/setlistsUi';
import {DisplayScreen} from '../../src/screens/display/DisplayScreen';

beforeAll(() => {
  initTestStores();
});

beforeEach(() => {
  resetSetlistWorld();
});

describe('CaptureBar', () => {
  it('renders nothing on DISPLAY when no song is armed', () => {
    wire();
    const {container} = renderDisplay();
    expect(container.textContent).not.toContain('BUILDING');
  });

  it('names the armed song and its live scene count', () => {
    const {songs} = wire();
    const songId = songs.createSong('Isn’t She Lovely').id;
    songs.captureScene(songId, 'A');
    songs.captureScene(songId, 'B');
    songs.captureScene(songId, 'C');

    const {container} = renderDisplay({armedSongId: songId});
    expect(container.textContent).toContain('BUILDING');
    expect(container.textContent).toContain('Isn’t She Lovely');
    expect(container.textContent).toContain('3 scenes');
  });

  it('appends an auto-named scene on capture and updates the count', () => {
    const {songs} = wire();
    const songId = songs.createSong('S').id;
    const {container} = renderDisplay({armedSongId: songId});

    click(byText(container, 'CAPTURE SCENE'));

    expect(songs.getSong(songId)!.scenes.map(s => s.label)).toEqual(['Scene 1']);
    expect(container.textContent).toContain('1 scene');

    click(byText(container, 'CAPTURE SCENE'));
    expect(songs.getSong(songId)!.scenes.map(s => s.label)).toEqual([
      'Scene 1',
      'Scene 2',
    ]);
  });

  it('captures distinct snapshots on successive presses', () => {
    const {songs} = wire();
    const songId = songs.createSong('S').id;
    const {container} = renderDisplay({armedSongId: songId});
    click(byText(container, 'CAPTURE SCENE'));
    click(byText(container, 'CAPTURE SCENE'));

    const [first, second] = songs.getSong(songId)!.scenes;
    expect(first.snapshot.tempo).not.toBe(second.snapshot.tempo);
  });

  it('DONE disarms', () => {
    const {songs} = wire();
    const songId = songs.createSong('S').id;
    const onArm = jest.fn();
    const {container} = renderDisplay({armedSongId: songId, onArm});
    click(byText(container, 'DONE'));
    expect(onArm).toHaveBeenCalledWith(null);
  });

  it('disarms itself when the armed song is deleted', () => {
    const {songs} = wire();
    const songId = songs.createSong('S').id;
    const {container, rerender} = renderDisplay({armedSongId: songId});
    act(() => {
      songs.deleteSong(songId);
    });
    rerender(
      <DisplayScreen isLightMode={false} armedSongId={songId} onArm={() => {}} />,
    );
    expect(container.textContent).not.toContain('BUILDING');
  });

  it('shortens the capture label when compact', () => {
    const {songs} = wire();
    const songId = songs.createSong('S').id;
    const {container} = renderDisplay({armedSongId: songId, compact: true});

    expect(container.textContent).toContain('CAPTURE');
    expect(container.textContent).not.toContain('CAPTURE SCENE');
  });
});
