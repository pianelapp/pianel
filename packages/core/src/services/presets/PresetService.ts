/**
 * PresetService — capture + apply path for the new per-tile Preset model
 * (007-profiles-preset-pivot). Replaces the v1 globally-scoped Preset shape.
 *
 * Responsibilities:
 *  - `captureSnapshot()` reads the full FR-005 six-group state from
 *    `performanceStore` + `appSettingsStore.quickToneSlots`.
 *  - `applyPreset(preset)` builds the documented DT1 batch (voice mode,
 *    mode-specific tones + params, volume, tempo, metronome) and dispatches
 *    via `PianoService.applyPreset`. Restores the three quick-tone slots
 *    into `appSettingsStore`. Marks the preset as active.
 *  - `applySnapshot(snapshot)` — same code path without preset-id/label
 *    coupling. Used by `ProfileService.loadProfile`.
 *
 * Missing snapshot fields are skipped (FR-010 — "no change" semantics).
 *
 * Constitution II: Hardware state wins — apply path routes through PianoService.
 * Constitution IV: DT1 fidelity — all parameter writes go through the engine.
 */

import type {Tone} from '../../types/types';
import type {PianoService} from '../PianoService';
import type {ConnectionService} from '../ConnectionService';
import type {Preset} from '../../types/profile';
import type {PerformanceSnapshot} from '../../types/performanceSnapshot';
import type {QuickToneSlot} from '../../types/quickToneSlot';
import {usePerformanceStore} from '../../store/performanceStore';
import {useAppSettingsStore} from '../../store/appSettingsStore';
import {
  VOICING_MODE_TO_BYTE,
  byteToVoicingMode,
} from '../../helpers/voicingMode';

export class PresetService {
  private pianoService: PianoService;
  private connectionService: ConnectionService | null = null;

  constructor(pianoService: PianoService) {
    this.pianoService = pianoService;
  }

  /**
   * Wire in the ConnectionService so `applySnapshot` can trigger an RQ1
   * read-back after writes — the piano then repopulates `performanceStore`
   * via `parseStateResponse` (hardware-authoritative, Constitution II).
   *
   * Optional: tests construct `PresetService` without a ConnectionService
   * and exercise the DT1 batch in isolation; the read-back step is skipped
   * when unset.
   */
  setConnectionService(connectionService: ConnectionService): void {
    this.connectionService = connectionService;
  }

  /**
   * Capture the current performanceStore + appSettingsStore state into a
   * `PerformanceSnapshot` suitable for embedding into a Preset or
   * `Profile.defaultState`.
   */
  captureSnapshot(): PerformanceSnapshot {
    const perf = usePerformanceStore.getState();
    const app = useAppSettingsStore.getState();

    const voiceModeByte = perf.voiceMode ?? VOICING_MODE_TO_BYTE.single;
    const voiceMode = byteToVoicingMode(voiceModeByte) ?? 'single';

    const voiceModeSnapshot: QuickToneSlot = {
      voiceMode,
      rightToneId: perf.activeTone?.id ?? null,
      leftToneId: perf.leftTone?.id ?? null,
      dualTone2Id: perf.dualTone2?.id ?? null,
      splitPoint: perf.splitPoint,
      balance: perf.balance,
      dualBalance: perf.dualBalance,
      splitLeftShift: perf.splitLeftShift,
      splitRightShift: perf.splitRightShift,
      dualT1Shift: perf.dualT1Shift,
      dualT2Shift: perf.dualT2Shift,
    };

    // Deep-copy the three quick-tone slots to decouple the snapshot from
    // any future mutation of `appSettingsStore.quickToneSlots`.
    const quickToneSlots = app.quickToneSlots.map(slot =>
      slot ? {...slot} : null,
    ) as PerformanceSnapshot['quickToneSlots'];

    return {
      volume: perf.volume,
      tempo: perf.tempo,
      metronome: {
        on: perf.metronomeOn,
        beat: perf.metronomeBeat,
        pattern: perf.metronomePattern,
        volume: perf.metronomeVolume,
        tone: perf.metronomeTone,
      },
      voiceModeSnapshot,
      currentToneId: perf.activeTone?.id ?? null,
      quickToneSlots,
    };
  }

  /**
   * Apply a Preset: build the DT1 batch from `preset.snapshot`, send via
   * PianoService, restore the three quick-tone slot assignments, then mark
   * the preset as active in performanceStore.
   */
  async applyPreset(preset: Preset): Promise<void> {
    await this.applySnapshot(preset.snapshot);
    usePerformanceStore.getState().setActivePreset(preset.id);
  }

  /**
   * Apply a raw `PerformanceSnapshot` — same logic as `applyPreset` but
   * without preset-id coupling. Used by `ProfileService.loadProfile`.
   *
   * After the DT1 batch lands, fires the same RQ1 sweep used at connect
   * time so `performanceStore` is repopulated from what actually took
   * effect on the piano (Constitution II — hardware state wins). The only
   * eager store write is `setActiveTone`, kept for snappy UI on the
   * always-visible tone display; the read-back will confirm/correct it.
   */
  async applySnapshot(snapshot: PerformanceSnapshot): Promise<void> {
    const engine = this.pianoService.getEngine();
    if (!engine) return;

    const commands: number[][] = [];
    const perf = usePerformanceStore.getState();

    // 1. Voice mode (if differs) — first so downstream registers settle.
    const targetVoiceMode = snapshot.voiceModeSnapshot?.voiceMode;
    if (targetVoiceMode) {
      const targetByte = VOICING_MODE_TO_BYTE[targetVoiceMode];
      if (perf.voiceMode !== targetByte) {
        commands.push(engine.buildVoiceModeChange(targetByte));
      }
    }

    const tones = engine.tones;
    const vm = snapshot.voiceModeSnapshot;

    // 2. Mode-specific tone writes.
    if (vm?.rightToneId) {
      const t = tones.findById(vm.rightToneId);
      if (t) commands.push(engine.buildToneChange(t));
    }
    if (vm?.voiceMode === 'split' && vm.leftToneId) {
      const t = tones.findById(vm.leftToneId);
      if (t) commands.push(engine.buildLeftToneChange(t));
    }
    if (vm?.voiceMode === 'dual' && vm.dualTone2Id) {
      const t = tones.findById(vm.dualTone2Id);
      if (t) commands.push(engine.buildDualTone2Change(t));
    }

    // 3. Split / Dual params.
    if (vm?.voiceMode === 'split') {
      if (vm.splitPoint !== undefined) {
        commands.push(engine.buildSplitPointChange(vm.splitPoint));
      }
      if (vm.balance !== undefined) {
        commands.push(engine.buildBalanceChange(vm.balance));
      }
      if (vm.splitLeftShift !== undefined) {
        commands.push(
          engine.buildShiftChange('split-left', vm.splitLeftShift - 0x40),
        );
      }
      if (vm.splitRightShift !== undefined) {
        commands.push(
          engine.buildShiftChange('split-right', vm.splitRightShift - 0x40),
        );
      }
    } else if (vm?.voiceMode === 'dual') {
      if (vm.dualBalance !== undefined) {
        commands.push(engine.buildDualBalanceChange(vm.dualBalance));
      }
      if (vm.dualT1Shift !== undefined) {
        commands.push(
          engine.buildShiftChange('dual-tone1', vm.dualT1Shift - 0x40),
        );
      }
      if (vm.dualT2Shift !== undefined) {
        commands.push(
          engine.buildShiftChange('dual-tone2', vm.dualT2Shift - 0x40),
        );
      }
    }

    // 4. Volume.
    if (snapshot.volume !== undefined) {
      commands.push(engine.buildVolumeChange(snapshot.volume));
    }

    // 5. Tempo.
    if (snapshot.tempo !== undefined) {
      commands.push(engine.buildTempoChange(snapshot.tempo));
    }

    // 6. Metronome.
    const metro = snapshot.metronome ?? {};
    if (metro.on !== undefined && metro.on !== perf.metronomeOn) {
      commands.push(engine.buildMetronomeToggle());
    }
    if (metro.beat !== undefined) {
      commands.push(engine.buildMetronomeParam('beat', metro.beat));
    }
    if (metro.pattern !== undefined) {
      commands.push(engine.buildMetronomeParam('pattern', metro.pattern));
    }
    if (metro.volume !== undefined) {
      commands.push(engine.buildMetronomeParam('volume', metro.volume));
    }
    if (metro.tone !== undefined) {
      commands.push(engine.buildMetronomeParam('tone', metro.tone));
    }

    await this.pianoService.applyPreset(commands);

    // 7. Restore the three quick-tone slots into appSettingsStore.
    if (snapshot.quickToneSlots) {
      const appSettings = useAppSettingsStore.getState();
      snapshot.quickToneSlots.forEach((slot, i) => {
        appSettings.setQuickToneSlot(i as 0 | 1 | 2, slot);
      });
    }

    // 8. Mirror the captured current tone into the live store so the
    //    always-visible tone display reflects the change without waiting
    //    on the RQ1 round-trip. Authoritative reconciliation happens in
    //    step 9 below.
    if (vm?.rightToneId) {
      const t = tones.findById(vm.rightToneId);
      if (t) usePerformanceStore.getState().setActiveTone(t);
    }

    // 9. Hardware-authoritative read-back: fire the engine's full RQ1
    //    sweep so the piano repopulates voiceMode / volume / metronome /
    //    split-and-dual params / tones in `performanceStore` via
    //    `parseStateResponse`. Awaited so callers know state is settled.
    if (this.connectionService) {
      try {
        await this.connectionService.refreshPerformanceState();
      } catch {
        // Non-fatal: a slow RQ1 leaves the store mid-stale rather than
        // breaking the apply. The 2s safety timer in ConnectionService
        // clears `pendingStateReads` so future notifications parse cleanly.
      }
    }
  }

  /**
   * Build the suggested-filename for a single Preset export. Reserved for
   * future per-preset export — not used in this branch (FR-018 exports
   * profiles, not individual presets).
   */
  suggestedFilename(preset: Preset): string {
    return `${sanitizeFilename(preset.label)}.pianel-preset.json`;
  }
}

// Compatibility re-export: some tests/utilities historically importing
// PresetExportFile may still reference the v1 single-preset shape. The new
// pivot exports whole profiles instead — see `ProfileExportFile`.
export type {ProfileExportFile as PresetExportFile} from '../../types/profile';

// Helper used by both PresetService.suggestedFilename and ProfileService.
export function sanitizeFilename(name: string): string {
  // Strip filesystem-illegal characters; collapse whitespace.
  return name.replace(/[/\\:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
}
