import {act} from 'react';
import {click} from '../utils/render';
import {initTestStores} from '../utils/stores';
import {wire, resetSetlistWorld} from '../fixtures/setlists';
import {byText, openContextMenu, renderDetail, renderScreen} from '../fixtures/setlistsUi';

beforeAll(() => {
  initTestStores();
});

beforeEach(() => {
  resetSetlistWorld();
});

describe('arm-time warning from SongDetail', () => {
  it('arms immediately with no dialog when no setlist follows the song', async () => {
    const {songs} = wire();
    const songId = songs.createSong('Solo Song').id;
    const onArm = jest.fn();
    const {container} = renderDetail(songId, {onArm});

    click(byText(container, 'ARM FOR CAPTURE'));
    await act(async () => {});

    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(onArm).toHaveBeenCalledWith(songId);
  });

  it('warns before arming a song setlists follow', () => {
    const {songs, setlists} = wire();
    const songId = songs.createSong('Shared').id;
    const listId = setlists.createSetlist('Bar Gig').id;
    setlists.addSong(listId, songId);
    const onArm = jest.fn();
    const {container} = renderDetail(songId, {onArm});

    click(byText(container, 'ARM FOR CAPTURE'));

    expect(container.textContent).toContain('This song is in 1 setlists');
    expect(onArm).not.toHaveBeenCalled();
  });

  it('cancelling the warning leaves armedSongId null', async () => {
    const {songs, setlists} = wire();
    const songId = songs.createSong('Shared').id;
    const listId = setlists.createSetlist('Bar Gig').id;
    setlists.addSong(listId, songId);
    const onArm = jest.fn();
    const {container} = renderDetail(songId, {onArm});

    click(byText(container, 'ARM FOR CAPTURE'));
    click(byText(container, 'Cancel'));
    await act(async () => {});

    expect(onArm).not.toHaveBeenCalled();
  });

  it('confirming the warning arms the song', async () => {
    const {songs, setlists} = wire();
    const songId = songs.createSong('Shared').id;
    const listId = setlists.createSetlist('Bar Gig').id;
    setlists.addSong(listId, songId);
    const onArm = jest.fn();
    const {container} = renderDetail(songId, {onArm});

    click(byText(container, 'ARM FOR CAPTURE'));
    click(byText(container, 'Arm anyway'));
    await act(async () => {});

    expect(onArm).toHaveBeenCalledWith(songId);
  });

  it('disarming never warns even when setlists follow the song', () => {
    const {songs, setlists} = wire();
    const songId = songs.createSong('Shared').id;
    const listId = setlists.createSetlist('Bar Gig').id;
    setlists.addSong(listId, songId);
    const onArm = jest.fn();
    const {container} = renderDetail(songId, {isArmed: true, onArm});

    click(byText(container, 'STOP CAPTURE'));

    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(onArm).toHaveBeenCalledWith(null);
  });

  it('does not warn for a song only detached setlists reference', async () => {
    const {songs, setlists} = wire();
    const songId = songs.createSong('Shared').id;
    const listId = setlists.createSetlist('Bar Gig').id;
    setlists.addSong(listId, songId);
    setlists.customizeEntry(listId, 0);
    const onArm = jest.fn();
    const {container} = renderDetail(songId, {onArm});

    click(byText(container, 'ARM FOR CAPTURE'));
    await act(async () => {});

    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(onArm).toHaveBeenCalledWith(songId);
  });
});

describe('arm-time warning from the SetlistsScreen song menu', () => {
  it('arms immediately with no dialog when no setlist follows the song', async () => {
    const {songs} = wire();
    const songId = songs.createSong('Solo Song').id;
    const onArm = jest.fn();
    const {container} = renderScreen({onArm});

    openContextMenu(container, 'Solo Song');
    click(byText(container, 'Arm for capture'));
    await act(async () => {});

    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(onArm).toHaveBeenCalledWith(songId);
  });

  it('warns before arming a song setlists follow', () => {
    const {songs, setlists} = wire();
    const songId = songs.createSong('Shared').id;
    const listId = setlists.createSetlist('Bar Gig').id;
    setlists.addSong(listId, songId);
    const onArm = jest.fn();
    const {container} = renderScreen({onArm});

    openContextMenu(container, 'Shared');
    click(byText(container, 'Arm for capture'));

    expect(container.textContent).toContain('This song is in 1 setlists');
    expect(onArm).not.toHaveBeenCalled();
  });

  it('cancelling the warning leaves armedSongId null', async () => {
    const {songs, setlists} = wire();
    const songId = songs.createSong('Shared').id;
    const listId = setlists.createSetlist('Bar Gig').id;
    setlists.addSong(listId, songId);
    const onArm = jest.fn();
    const {container} = renderScreen({onArm});

    openContextMenu(container, 'Shared');
    click(byText(container, 'Arm for capture'));
    click(byText(container, 'Cancel'));
    await act(async () => {});

    expect(onArm).not.toHaveBeenCalled();
  });

  it('confirming the warning arms the song', async () => {
    const {songs, setlists} = wire();
    const songId = songs.createSong('Shared').id;
    const listId = setlists.createSetlist('Bar Gig').id;
    setlists.addSong(listId, songId);
    const onArm = jest.fn();
    const {container} = renderScreen({onArm});

    openContextMenu(container, 'Shared');
    click(byText(container, 'Arm for capture'));
    click(byText(container, 'Arm anyway'));
    await act(async () => {});

    expect(onArm).toHaveBeenCalledWith(songId);
  });

  it('toggling off an armed song never warns', () => {
    const {songs, setlists} = wire();
    const songId = songs.createSong('Shared').id;
    const listId = setlists.createSetlist('Bar Gig').id;
    setlists.addSong(listId, songId);
    const onArm = jest.fn();
    const {container} = renderScreen({armedSongId: songId, onArm});

    openContextMenu(container, 'Shared');
    click(byText(container, 'Armed for capture'));

    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(onArm).toHaveBeenCalledWith(null);
  });

  it('does not warn for a song only detached setlists reference', async () => {
    const {songs, setlists} = wire();
    const songId = songs.createSong('Shared').id;
    const listId = setlists.createSetlist('Bar Gig').id;
    setlists.addSong(listId, songId);
    setlists.customizeEntry(listId, 0);
    const onArm = jest.fn();
    const {container} = renderScreen({onArm});

    openContextMenu(container, 'Shared');
    click(byText(container, 'Arm for capture'));
    await act(async () => {});

    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(onArm).toHaveBeenCalledWith(songId);
  });
});
