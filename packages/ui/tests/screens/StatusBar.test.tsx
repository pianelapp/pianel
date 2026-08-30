/**
 * responsive-breakpoints — StatusBar compact mode.
 *
 *  - non-compact (desktop/tablet parity): icons AND textual labels/values render
 *  - compact (mobile): the voicing-mode name and volume value are hidden and
 *    those controls render icon-only; the tempo number and the beat/time-signature
 *    readout are kept. Every control keeps an accessible name and its click
 *    behavior (modal/popover wiring).
 *  - the metronome toggle is icon-only in every viewport — on/off reads from the
 *    icon highlight and the accessible name.
 */
import * as React from 'react';
import {act} from 'react';
import {usePerformanceStore} from '@pianel/core/store';
import {render, click} from '../utils/render';
import {initTestStores} from '../utils/stores';
import {StatusBar} from '../../src/screens/display/StatusBar';

beforeAll(() => {
  initTestStores();
});

function buttonByLabel(
  root: HTMLElement,
  label: string,
): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll('button')).find(
    b => b.getAttribute('aria-label') === label,
  );
}

function voicingButton(root: HTMLElement): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll('button')).find(b =>
    (b.getAttribute('aria-label') ?? '').startsWith('Voicing mode:'),
  );
}

describe('StatusBar', () => {
  describe('non-compact (default, desktop/tablet parity)', () => {
    it('renders the textual labels and numeric values alongside the icons', () => {
      const {container, unmount} = render(<StatusBar isLightMode />);
      const text = container.textContent ?? '';
      expect(text).toContain('SINGLE'); // voicing mode name
      expect(text).toContain('120'); // tempo value
      expect(text).toContain('100'); // volume value
      unmount();
    });

    it('renders the metronome toggle icon-only, with no on/off word', () => {
      const {container, unmount} = render(<StatusBar isLightMode />);
      const btn = buttonByLabel(container, 'Metronome off');
      expect(btn).toBeDefined();
      expect(btn!.querySelector('svg')).not.toBeNull();
      expect((btn!.textContent ?? '').trim()).toBe('');
      expect(container.textContent ?? '').not.toContain('Off');
      unmount();
    });

    it('signals metronome state through the icon highlight and accessible name', () => {
      const {container, unmount} = render(<StatusBar isLightMode />);

      const off = buttonByLabel(container, 'Metronome off');
      expect(off!.querySelector('svg')!.getAttribute('class')).toContain(
        'text-zinc-500',
      );

      act(() => {
        usePerformanceStore.setState({metronomeOn: true});
      });

      const on = buttonByLabel(container, 'Metronome on');
      expect(on).toBeDefined();
      expect(on!.querySelector('svg')!.getAttribute('class')).toContain(
        'text-cyan-500',
      );
      expect((on!.textContent ?? '').trim()).toBe('');

      act(() => {
        usePerformanceStore.setState({metronomeOn: false});
      });
      unmount();
    });
  });

  describe('compact (mobile)', () => {
    it('hides the voicing name and volume value (keeps tempo + beat)', () => {
      const {container, unmount} = render(<StatusBar isLightMode compact />);
      const text = container.textContent ?? '';
      // Hidden in compact.
      expect(text).not.toContain('SINGLE');
      expect(text).not.toContain('100');
      // Kept in compact — small, useful readouts.
      expect(text).toContain('120'); // tempo
      const beat = buttonByLabel(container, 'Metronome settings');
      expect((beat?.textContent ?? '').trim()).toMatch(/\d\/\d/); // time signature
      unmount();
    });

    it('exposes an accessible name for every control', () => {
      const {container, unmount} = render(<StatusBar isLightMode compact />);
      const controls = [
        buttonByLabel(container, 'Edit tempo'),
        buttonByLabel(container, 'Metronome settings'),
        voicingButton(container),
        buttonByLabel(container, 'Metronome off'),
        buttonByLabel(container, 'Volume'),
      ];
      for (const btn of controls) {
        expect(btn).toBeDefined();
      }
      unmount();
    });

    it('renders the voicing, metronome, and volume controls icon-only (no text)', () => {
      const {container, unmount} = render(<StatusBar isLightMode compact />);
      const iconOnly = [
        voicingButton(container),
        buttonByLabel(container, 'Metronome off'),
        buttonByLabel(container, 'Volume'),
      ];
      for (const btn of iconOnly) {
        expect(btn!.querySelector('svg')).not.toBeNull();
        expect((btn!.textContent ?? '').trim()).toBe('');
      }
      unmount();
    });

    it('keeps the tempo control opening the tempo modal on click', () => {
      const {container, unmount} = render(<StatusBar isLightMode compact />);
      expect(document.querySelector('[role="dialog"]')).toBeNull();
      click(buttonByLabel(container, 'Edit tempo') as Element);
      expect(document.querySelector('[role="dialog"]')).not.toBeNull();
      unmount();
    });

    it('keeps the volume control opening its popover on click', () => {
      const {container, unmount} = render(<StatusBar isLightMode compact />);
      click(buttonByLabel(container, 'Volume') as Element);
      expect(container.textContent ?? '').toContain('VOL');
      unmount();
    });
  });
});
