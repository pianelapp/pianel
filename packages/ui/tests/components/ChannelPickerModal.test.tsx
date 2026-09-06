import {act} from 'react';
import {click, keydown, render} from '../utils/render';
import {initTestStores} from '../utils/stores';
import {useConnectionStore, useMidiChannelStore} from '../../src/store';
import {setPianoService} from '../../src/hooks/usePiano';
import {ChannelPickerModal} from '../../src/components/modals/ChannelPickerModal';
import {PianoService} from '@pianel/core/services/PianoService';
import {FP30XEngine} from '@pianel/core/engine/fp30x/FP30XEngine';
import {fp30xToneCatalog} from '@pianel/core/engine/fp30x/tones';
import type {Transport} from '@pianel/core/transport/types';

beforeAll(() => {
  initTestStores();
});

const DEVICE = 'piano-a';
const MARK = '2026-09-04T00:00:00.000Z';

const concertPiano = fp30xToneCatalog.findById('0-0-0')!;
const standardSet = fp30xToneCatalog.categories.find(c => c.id === 0x07)!
  .tones[0];

let sent: number[][] = [];

function wireService(): PianoService {
  sent = [];
  const transport = {
    status: 'connected',
    send: jest.fn(async (msg: number[]) => {
      sent.push(msg);
    }),
    subscribe: jest.fn().mockReturnValue(() => {}),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    scan: jest.fn().mockResolvedValue(undefined),
    stopScan: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
  } as unknown as Transport;
  const service = new PianoService(transport);
  service.setEngine(new FP30XEngine());
  setPianoService(service);
  return service;
}

function reviewRows(container: HTMLElement): HTMLElement[] {
  const list = container.querySelector('.custom-scrollbar');
  if (!list) throw new Error('channel list not found');
  return Array.from(list.children) as HTMLElement[];
}

function openReview(tone = concertPiano, onClose = jest.fn()) {
  const result = render(
    <ChannelPickerModal
      tone={tone}
      open
      mode="review"
      isLightMode={false}
      onClose={onClose}
    />,
  );
  return {...result, onClose};
}

function recordOn(channel: number, toneId: string, mark = MARK): void {
  act(() => {
    useMidiChannelStore.getState().record({
      channel: channel as 1,
      toneId,
      deviceId: DEVICE,
      connectionMark: mark,
    });
  });
}

function rows(container: HTMLElement): HTMLButtonElement[] {
  const list = container.querySelector('.custom-scrollbar');
  if (!list) throw new Error('channel list not found');
  return Array.from(list.querySelectorAll('button'));
}

function isDisabled(row: HTMLButtonElement): boolean {
  return row.getAttribute('aria-disabled') === 'true';
}

function rowText(container: HTMLElement, channel: number): string {
  return (rows(container)[channel - 1].textContent ?? '').trim();
}

function open(tone = concertPiano, onClose = jest.fn(), isLightMode = false) {
  const result = render(
    <ChannelPickerModal
      tone={tone}
      open
      isLightMode={isLightMode}
      onClose={onClose}
    />,
  );
  return {...result, onClose};
}

beforeEach(() => {
  act(() => useMidiChannelStore.getState().reset());
  wireService();
  act(() => {
    useConnectionStore.setState({
      status: 'connected',
      deviceId: DEVICE,
      lastConnectedAt: MARK,
    });
  });
});

describe('ChannelPickerModal', () => {
  it('keeps an ineligible row reachable so its reason can be read out', () => {
    const {container, unmount} = open();
    const ch4 = rows(container)[3];
    expect(ch4.hasAttribute('disabled')).toBe(false);
    expect(ch4.getAttribute('aria-disabled')).toBe('true');
    expect(ch4.textContent).toContain('Follows the tone selected on the piano');
    unmount();
  });

  it('focuses the first eligible channel on open', () => {
    const {container, unmount} = open();
    expect(document.activeElement).toBe(rows(container)[0]);
    unmount();

    const kit = open(standardSet);
    expect(document.activeElement).toBe(rows(kit.container)[0]);
    kit.unmount();
  });

  it('styles the card for each theme', () => {
    const dark = open();
    const darkCard = dark.container.querySelector('.rounded-3xl')!.className;
    dark.unmount();

    const light = open(concertPiano, jest.fn(), true);
    const lightCard = light.container.querySelector('.rounded-3xl')!.className;
    light.unmount();

    expect(lightCard).not.toBe(darkCard);
    expect(lightCard).toContain('bg-zinc-50/95');
    expect(darkCard).toContain('bg-zinc-900/95');
  });

  it('renders nothing when closed', () => {
    const {container, unmount} = render(
      <ChannelPickerModal
        tone={concertPiano}
        open={false}
        isLightMode={false}
        onClose={jest.fn()}
      />,
    );
    expect(container.textContent).toBe('');
    unmount();
  });

  it('lists sixteen channels in ascending order with the tone in the header', () => {
    const {container, unmount} = open();
    const labels = rows(container).map(
      b => (b.querySelector('span')?.textContent ?? '').trim(),
    );
    expect(labels).toEqual([
      'Ch. 1', 'Ch. 2', 'Ch. 3', 'Ch. 4', 'Ch. 5', 'Ch. 6', 'Ch. 7', 'Ch. 8',
      'Ch. 9', 'Ch. 10', 'Ch. 11', 'Ch. 12', 'Ch. 13', 'Ch. 14', 'Ch. 15',
      'Ch. 16',
    ]);
    expect(container.textContent).toContain(concertPiano.name);
    unmount();
  });

  it('shows an explicit not-assigned indication on a fresh session', () => {
    const {container, unmount} = open();
    expect(rowText(container, 5)).toContain('Not assigned');
    unmount();
  });

  it('frames the list as what Pianel last sent and warns about external MIDI', () => {
    const {container, unmount} = open();
    expect(container.textContent).toContain('Last sent by Pianel');
    expect(container.textContent).toContain(
      'An assigned channel sounds only when an external MIDI device plays that channel.',
    );
    unmount();
  });

  it('disables channel 4 with its reason', () => {
    const {container, unmount} = open();
    expect(isDisabled(rows(container)[3])).toBe(true);
    expect(rowText(container, 4)).toContain(
      'Follows the tone selected on the piano',
    );
    unmount();
  });

  it('disables channel 10 for a melodic tone and enables it for a rhythm set', () => {
    const melodic = open();
    expect(isDisabled(rows(melodic.container)[9])).toBe(true);
    expect(rowText(melodic.container, 10)).toContain('Drum kits only');
    melodic.unmount();

    const kit = open(standardSet);
    expect(isDisabled(rows(kit.container)[9])).toBe(false);
    expect(rowText(kit.container, 10)).not.toContain('Drum kits only');
    kit.unmount();
  });

  it('shows the stale notice only when the records are flagged', async () => {
    const fresh = open();
    expect(fresh.container.textContent).not.toContain('may no longer match');
    fresh.unmount();

    act(() => {
      useMidiChannelStore.getState().record({
        channel: 5,
        toneId: concertPiano.id,
        deviceId: DEVICE,
        connectionMark: MARK,
      });
      useConnectionStore.setState({lastConnectedAt: '2026-09-04T02:00:00.000Z'});
    });

    const stale = open();
    expect(stale.container.textContent).toContain('may no longer match');
    stale.unmount();
  });

  it('offers no clear or unassign affordance', () => {
    const {container, unmount} = open();
    const text = (container.textContent ?? '').toLowerCase();
    expect(text).not.toContain('clear');
    expect(text).not.toContain('unassign');
    expect(text).not.toContain('remove');
    unmount();
  });

  it('closes first and commits, with no confirmation step over an existing record', async () => {
    act(() => {
      useMidiChannelStore.getState().record({
        channel: 5,
        toneId: standardSet.id,
        deviceId: DEVICE,
        connectionMark: MARK,
      });
    });
    const {container, onClose, unmount} = open();
    expect(rowText(container, 5)).toContain(standardSet.name);

    click(rows(container)[4]);
    await act(async () => {});

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(sent).toHaveLength(3);
    expect(useMidiChannelStore.getState().assignments[5]?.toneId).toBe(
      concertPiano.id,
    );
    unmount();
  });

  it('sends nothing on a backdrop click', async () => {
    const {container, onClose, unmount} = open();
    click(container.firstElementChild!);
    await act(async () => {});
    expect(onClose).toHaveBeenCalled();
    expect(sent).toEqual([]);
    expect(useMidiChannelStore.getState().assignments).toEqual({});
    unmount();
  });

  it('sends nothing on escape', async () => {
    const {onClose, unmount} = open();
    keydown('Escape');
    await act(async () => {});
    expect(onClose).toHaveBeenCalled();
    expect(sent).toEqual([]);
    expect(useMidiChannelStore.getState().assignments).toEqual({});
    unmount();
  });

  it('does not commit when a disabled row is clicked', async () => {
    const {container, onClose, unmount} = open();
    click(rows(container)[3]);
    await act(async () => {});
    expect(onClose).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
    unmount();
  });
});

describe('ChannelPickerModal — review mode', () => {
  it('lists only the channels that hold a record, in ascending order', () => {
    recordOn(6, standardSet.id);
    recordOn(2, concertPiano.id);

    const {container, unmount} = openReview();

    expect(reviewRows(container).map(r => (r.textContent ?? '').trim())).toEqual(
      [`Ch. 2${concertPiano.name}`, `Ch. 6${standardSet.name}`],
    );
    expect(container.textContent).not.toContain('Not assigned');
    unmount();
  });

  it('renders the rows as non-interactive, with nothing to click', () => {
    recordOn(6, standardSet.id);
    const {container, onClose, unmount} = openReview();

    const list = container.querySelector('.custom-scrollbar')!;
    expect(list.querySelectorAll('button')).toHaveLength(0);

    click(reviewRows(container)[0]);
    expect(sent).toEqual([]);
    expect(onClose).not.toHaveBeenCalled();
    expect(useMidiChannelStore.getState().assignments[6]?.toneId).toBe(
      standardSet.id,
    );
    unmount();
  });

  it('names itself for review and does not name a tone', () => {
    recordOn(6, standardSet.id);
    const {container, unmount} = openReview();

    const title = container.querySelector('#channel-picker-title')!;
    expect(title.textContent).toBe('MIDI channel assignments');
    expect(container.textContent).toContain('Last sent by Pianel');
    expect(container.textContent).not.toContain(concertPiano.name);
    expect(container.textContent).not.toContain('Piano #');
    unmount();
  });

  it('never shows an ineligibility reason', () => {
    recordOn(6, standardSet.id);
    const {container, unmount} = openReview();
    expect(container.textContent).not.toContain('Drum kits only');
    expect(container.textContent).not.toContain(
      'Follows the tone selected on the piano',
    );
    unmount();
  });

  it('says so plainly when nothing has been sent yet', () => {
    const {container, unmount} = openReview();
    expect(reviewRows(container)).toHaveLength(1);
    expect(container.textContent).toContain(
      'Nothing sent to a MIDI channel yet this session.',
    );
    unmount();
  });

  it('keeps the external-MIDI hint and the stale notice', () => {
    recordOn(6, standardSet.id, '2026-09-01T00:00:00.000Z');
    const {container, unmount} = openReview();

    expect(container.textContent).toContain(
      'An assigned channel sounds only when an external MIDI device plays that channel.',
    );
    expect(container.textContent).toContain('may no longer match');
    unmount();
  });

  it('takes focus so the dialog is announced, and escape dismisses it', () => {
    recordOn(6, standardSet.id);
    const {container, onClose, unmount} = openReview();

    expect(document.activeElement).toBe(
      container.querySelector('.rounded-3xl'),
    );
    keydown('Escape');
    expect(onClose).toHaveBeenCalled();
    expect(sent).toEqual([]);
    unmount();
  });
});
