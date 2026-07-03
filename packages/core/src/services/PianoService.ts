/**
 * Piano Service — Core Facade.
 *
 * T034: Routes commands to engine via transport, handles notifications
 * by updating the correct stores. Debounces rapid input.
 *
 * Constitution II: Bidirectional Control Surface.
 * Constitution V: Services orchestrate engine + transport.
 */

import type {Transport} from '../transport/types';
import type {PianoEngine} from '../engine/IPianoEngine';
import type {Tone, ToneCatalog, PianoEvent} from '../types/types';
import {VOICING_MODE_TO_BYTE, encodeShift} from '../helpers/voicingMode';
import type {VoicingMode, ShiftTarget} from '../types/voicingMode';
import type {QuickToneSlot} from '../types/quickToneSlot';
import {usePerformanceStore} from '../store/performanceStore';
import {useAppSettingsStore} from '../store/appSettingsStore';
import {getChordService} from './ChordService';

/** Debounce timeout for rapid input (ms). */
const DEBOUNCE_MS = 50;

export class PianoService {
  private transport: Transport;
  private engine: PianoEngine | null = null;
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(transport: Transport) {
    this.transport = transport;
  }

  /** Set the engine (called by ConnectionService after identification). */
  setEngine(engine: PianoEngine): void {
    this.engine = engine;
  }

  /** Get the current engine. */
  getEngine(): PianoEngine | null {
    return this.engine;
  }

  /** Get the tone catalog from the active engine. */
  getToneCatalog(): ToneCatalog | null {
    return this.engine?.tones ?? null;
  }

  /**
   * Dispatch a piano state event to the correct store.
   * Handles both incoming BLE notifications and app-originated events
   * (pad apply, preset apply).
   */
  dispatchEvent(event: PianoEvent): void {
    const store = usePerformanceStore.getState();

    switch (event.type) {
      case 'tone': {
        if (!this.engine) break;
        const tone = this.engine.tones.findByDT1(
          event.category,
          event.indexHigh,
          event.indexLow,
        );
        if (tone) {
          store.setActiveTone(tone);
          // BUG-05: Sync category index so category display stays current
          const catIdx = this.engine.tones.categories.findIndex(
            c => c.id === tone.category,
          );
          if (catIdx >= 0) {
            useAppSettingsStore.getState().setLastCategoryIndex(catIdx);
          }
        }
        break;
      }
      case 'volume':
        store.setVolume(event.value);
        break;
      case 'tempo':
        store.setTempo(event.bpm);
        break;
      case 'metronomeState':
        store.setMetronomeOn(event.on);
        break;
      case 'headphonesConnection':
        store.setHeadphonesConnected(event.connected);
        break;
      case 'metronomeBeat':
        store.setMetronomeBeat(event.value);
        break;
      case 'metronomePattern':
        store.setMetronomePattern(event.value);
        break;
      case 'metronomeVolume':
        store.setMetronomeVolume(event.value);
        break;
      case 'metronomeTone':
        store.setMetronomeTone(event.value);
        break;
      case 'voiceMode':
        store.setVoiceMode(event.value);
        break;
      case 'transpose':
        store.setTranspose(event.value);
        break;
      case 'keyTouch':
        store.setKeyTouch(event.value);
        break;
      case 'splitPoint':
        store.setSplitPoint(event.value);
        break;
      case 'balance':
        store.setBalance(event.value);
        break;
      case 'dualBalance':
        store.setDualBalance(event.value);
        break;
      case 'leftTone': {
        if (!this.engine) break;
        const leftTone = this.engine.tones.findByDT1(
          event.category,
          event.indexHigh,
          event.indexLow,
        );
        store.setLeftTone(leftTone ?? null);
        break;
      }
      case 'dualTone2': {
        if (!this.engine) break;
        const dualTone2 = this.engine.tones.findByDT1(
          event.category,
          event.indexHigh,
          event.indexLow,
        );
        store.setDualTone2(dualTone2 ?? null);
        break;
      }
      case 'splitLeftShift':
        store.setSplitLeftShift(event.value);
        break;
      case 'splitRightShift':
        store.setSplitRightShift(event.value);
        break;
      case 'dualT1Shift':
        store.setDualT1Shift(event.value);
        break;
      case 'dualT2Shift':
        store.setDualT2Shift(event.value);
        break;
      case 'twinMode':
        store.setTwinMode(event.value);
        break;
      case 'noteOn': {
        const chordSvc = getChordService();
        chordSvc.addNote(event.note);
        break;
      }
      case 'noteOff': {
        const chordSvc = getChordService();
        chordSvc.removeNote(event.note);
        break;
      }
      case 'controlChange':
        // T021 (A7): CC echoes are informational only over BLE — log, don't update stores
        console.debug(
          `CC echo: ch=${event.channel} cc=${event.controller} val=${event.value}`,
        );
        break;
      case 'programChange':
        // T021 (A7): PC echoes are informational only over BLE — log, don't update stores
        console.debug(`PC echo: ch=${event.channel} pc=${event.program}`);
        break;
      case 'unknown':
        // Logged but not acted on
        break;
    }
  }

  /**
   * Change the active tone.
   * Debounced — only the last selection in a rapid sequence is sent.
   */
  async changeTone(tone: Tone): Promise<void> {
    if (!this.engine) return;

    this.debounce('tone', async () => {
      if (!this.engine) return;
      const sysex = this.engine.buildToneChange(tone);
      await this.transport.send(sysex);
    });
  }

  /**
   * Change volume.
   * @param value 0–100
   */
  async changeVolume(value: number): Promise<void> {
    if (!this.engine) return;

    this.debounce('volume', async () => {
      if (!this.engine) return;
      const sysex = this.engine.buildVolumeChange(value);
      await this.transport.send(sysex);
    });
  }

  /**
   * Change tempo.
   * @param bpm 20–250
   */
  async changeTempo(bpm: number): Promise<void> {
    if (!this.engine) return;

    this.debounce('tempo', async () => {
      if (!this.engine) return;
      const sysex = this.engine.buildTempoChange(bpm);
      await this.transport.send(sysex);
    });
  }

  /** Toggle metronome on/off. */
  async toggleMetronome(): Promise<void> {
    if (!this.engine) return;

    const sysex = this.engine.buildMetronomeToggle();
    await this.transport.send(sysex);
  }

  /**
   * Change a metronome parameter.
   */
  async changeMetronomeParam(
    param: 'beat' | 'pattern' | 'volume' | 'tone',
    value: number,
  ): Promise<void> {
    if (!this.engine) return;

    const sysex = this.engine.buildMetronomeParam(param, value);
    await this.transport.send(sysex);
  }

  /**
   * Apply a preset — sends a batch of DT1 commands.
   */
  async applyPreset(commands: number[][]): Promise<void> {
    for (const cmd of commands) {
      await this.transport.send(cmd);
    }
  }

  // ─── Voicing modes (005-piano-modes) ─────────────────────────

  /**
   * Switch the piano's voicing mode.
   *
   * Twin entry sends two DT1 writes in order — first forces Pair speaker
   * mode (01 00 02 06 = 0x00) to ensure a well-defined state, then the
   * voice-mode write itself. Other modes send only the voice-mode write.
   *
   * Not debounced — voice-mode changes are discrete UI commits.
   */
  async changeVoiceMode(mode: VoicingMode): Promise<void> {
    if (!this.engine) return;
    const byte = VOICING_MODE_TO_BYTE[mode];

    const store = usePerformanceStore.getState();
    store.setVoiceMode(byte);

    // Single/Twin have no second slot — collapse the UI selector so the next
    // entry into Dual/Split starts from Tone 1/Upper.
    if (mode === 'single' || mode === 'twin') {
      useAppSettingsStore.getState().setActiveToneSlot('right');
    }

    if (mode === 'twin') {
      // Force Pair speaker mode before entering Twin.
      store.setTwinMode(0);
      const pairMsg = this.engine.buildTwinModeSet('pair');
      await this.transport.send(pairMsg);
    }

    const modeMsg = this.engine.buildVoiceModeChange(byte);
    await this.transport.send(modeMsg);
  }

  /**
   * Send the Split Lower tone DT1 write (01 00 02 0A-0C). Debounced.
   * For Dual Tone 2 see `changeDualTone2` (different DT1 address).
   *
   * Mirrors `changeTone`: this method only sends to the piano. The caller
   * owns the store update (`setLeftTone`) — that contract keeps history
   * pushes from happening twice per selection and lets undo work.
   */
  async changeLeftTone(tone: Tone): Promise<void> {
    if (!this.engine) return;
    this.debounce('leftTone', async () => {
      if (!this.engine) return;
      const sysex = this.engine.buildLeftToneChange(tone);
      await this.transport.send(sysex);
    });
  }

  /**
   * Send the Dual Tone 2 DT1 write (01 00 02 0D-0F). Debounced.
   * Address verified via Roland Piano App APK reverse-engineering
   * (`toneForDual` in midiConnector.js) — distinct from Split Lower.
   *
   * Caller owns the `setDualTone2` store update. See `changeLeftTone`.
   */
  async changeDualTone2(tone: Tone): Promise<void> {
    if (!this.engine) return;
    this.debounce('dualTone2', async () => {
      if (!this.engine) return;
      const sysex = this.engine.buildDualTone2Change(tone);
      await this.transport.send(sysex);
    });
  }

  /**
   * Set the Split point MIDI note (01 00 02 01). Debounced.
   */
  async changeSplitPoint(note: number): Promise<void> {
    if (!this.engine) return;
    usePerformanceStore.getState().setSplitPoint(note);

    this.debounce('splitPoint', async () => {
      if (!this.engine) return;
      const sysex = this.engine.buildSplitPointChange(note);
      await this.transport.send(sysex);
    });
  }

  /**
   * Set the balance. Mode-aware: in Dual mode writes to 01 00 02 05; otherwise
   * (Split, and any other mode that surfaces the slider in the UI) writes to
   * 01 00 02 03. The piano stores Split and Dual balance in separate registers
   * — verified via BLE capture of the Roland Piano App. Debounced.
   */
  async changeBalance(value: number): Promise<void> {
    if (!this.engine) return;
    const store = usePerformanceStore.getState();
    const isDual = (store.voiceMode ?? 0) === VOICING_MODE_TO_BYTE.dual;

    if (isDual) {
      store.setDualBalance(value);
    } else {
      store.setBalance(value);
    }

    this.debounce('balance', async () => {
      if (!this.engine) return;
      const sysex = isDual
        ? this.engine.buildDualBalanceChange(value)
        : this.engine.buildBalanceChange(value);
      await this.transport.send(sysex);
    });
  }

  /**
   * Set one of the four voicing-mode shift parameters. Debounced per target.
   * `octaves` is the signed octave shift; clamped internally to ±24.
   */
  async changeShift(target: ShiftTarget, octaves: number): Promise<void> {
    if (!this.engine) return;
    const byte = encodeShift(octaves);
    const store = usePerformanceStore.getState();
    switch (target) {
      case 'split-left':
        store.setSplitLeftShift(byte);
        break;
      case 'split-right':
        store.setSplitRightShift(byte);
        break;
      case 'dual-tone1':
        store.setDualT1Shift(byte);
        break;
      case 'dual-tone2':
        store.setDualT2Shift(byte);
        break;
    }

    this.debounce(`shift:${target}`, async () => {
      if (!this.engine) return;
      const sysex = this.engine.buildShiftChange(target, octaves);
      await this.transport.send(sysex);
    });
  }

  /**
   * Apply a quick-tone slot: restore the captured voicing mode, tones, and
   * mode-relevant parameters.
   *
   * Order matters — on the FP-30X the voice-mode write resets some downstream
   * registers, so we send it first, then the tone writes for that mode, then
   * the parameter writes. All writes are awaited sequentially (no debounce)
   * because this is a discrete user commit, not rapid input.
   */
  async applyQuickToneSlot(slot: QuickToneSlot): Promise<void> {
    if (!this.engine) return;
    const engine = this.engine;
    const tones = engine.tones;
    const perf = usePerformanceStore.getState();

    const modeByte = VOICING_MODE_TO_BYTE[slot.voiceMode];

    // Voice mode — Twin needs the Pair-speaker write first.
    if (slot.voiceMode === 'twin') {
      perf.setTwinMode(0);
      await this.transport.send(engine.buildTwinModeSet('pair'));
    }
    perf.setVoiceMode(modeByte);
    if (slot.voiceMode === 'single' || slot.voiceMode === 'twin') {
      useAppSettingsStore.getState().setActiveToneSlot('right');
    }
    await this.transport.send(engine.buildVoiceModeChange(modeByte));

    // Right tone (Tone 1 / Upper / Single).
    if (slot.rightToneId) {
      const tone = tones.findById(slot.rightToneId);
      if (tone) {
        perf.setActiveTone(tone);
        await this.transport.send(engine.buildToneChange(tone));
      }
    }

    // Mode-specific tones + params.
    if (slot.voiceMode === 'split') {
      if (slot.leftToneId) {
        const left = tones.findById(slot.leftToneId);
        if (left) {
          perf.setLeftTone(left);
          await this.transport.send(engine.buildLeftToneChange(left));
        }
      }
      if (slot.splitPoint !== undefined) {
        perf.setSplitPoint(slot.splitPoint);
        await this.transport.send(engine.buildSplitPointChange(slot.splitPoint));
      }
      if (slot.balance !== undefined) {
        perf.setBalance(slot.balance);
        await this.transport.send(engine.buildBalanceChange(slot.balance));
      }
      if (slot.splitLeftShift !== undefined) {
        perf.setSplitLeftShift(slot.splitLeftShift);
        await this.transport.send(
          engine.buildShiftChange('split-left', slot.splitLeftShift - 0x40),
        );
      }
      if (slot.splitRightShift !== undefined) {
        perf.setSplitRightShift(slot.splitRightShift);
        await this.transport.send(
          engine.buildShiftChange('split-right', slot.splitRightShift - 0x40),
        );
      }
    } else if (slot.voiceMode === 'dual') {
      if (slot.dualTone2Id) {
        const t2 = tones.findById(slot.dualTone2Id);
        if (t2) {
          perf.setDualTone2(t2);
          await this.transport.send(engine.buildDualTone2Change(t2));
        }
      }
      if (slot.dualBalance !== undefined) {
        perf.setDualBalance(slot.dualBalance);
        await this.transport.send(
          engine.buildDualBalanceChange(slot.dualBalance),
        );
      }
      if (slot.dualT1Shift !== undefined) {
        perf.setDualT1Shift(slot.dualT1Shift);
        await this.transport.send(
          engine.buildShiftChange('dual-tone1', slot.dualT1Shift - 0x40),
        );
      }
      if (slot.dualT2Shift !== undefined) {
        perf.setDualT2Shift(slot.dualT2Shift);
        await this.transport.send(
          engine.buildShiftChange('dual-tone2', slot.dualT2Shift - 0x40),
        );
      }
    }
  }

  // ─── Private ────────────────────────────────────────────────

  private debounce(key: string, fn: () => Promise<void>): void {
    const existing = this.debounceTimers.get(key);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(async () => {
      this.debounceTimers.delete(key);
      try {
        await fn();
      } catch {
        // Send failures are non-fatal; the echo won't arrive
      }
    }, DEBOUNCE_MS);

    this.debounceTimers.set(key, timer);
  }
}
