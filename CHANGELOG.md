# Changelog

All notable changes to Pianel are documented here. This file is maintained
automatically by [release-please](https://github.com/googleapis/release-please)
from [Conventional Commits](https://www.conventionalcommits.org/); see
[docs/VERSIONING.md](docs/VERSIONING.md) for the versioning rules.

## [0.1.1](https://github.com/pianelapp/pianel/compare/v0.1.0...v0.1.1) (2026-07-17)


### Bug Fixes

* add long-press capability. Context menu was not triggering on lo… ([#1](https://github.com/pianelapp/pianel/issues/1)) ([f5f0d50](https://github.com/pianelapp/pianel/commit/f5f0d506310956e6a3b7b691efa6e335b833e647))

## 0.1.0 (2026-07-13)

Initial versioned release of Pianel — an offline-first control surface for the
Roland FP‑30X digital piano, built from a shared TypeScript core.

### Features

- **Tone browsing & selection** — the full FP‑30X catalog (SuperNATURAL + GM2
  voices) with categories, favorites, and quick-tone slots.
- **Live, bidirectional status** — tempo, volume, metronome, beat, and active
  tones stay in sync with the physical piano in both directions.
- **Profiles & presets** — capture full parameter setups and recall them in one
  action; export/import as files for backup and sharing.
- **Live performance** — real-time chord detection, Split / Dual / Twin voicing
  modes, transpose, and key-touch control.
- **Hardware-synth UI** — a dark, tactile, glowing-display aesthetic that
  follows the system light/dark setting.
- **Two targets from one core** — an Electron desktop app (Windows & macOS) and
  a browser PWA, both driving the same `@pianel/core` logic over Web Bluetooth /
  Web MIDI.
