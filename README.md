# Pianel

> An offline-first control surface for the Roland FP‑30X digital piano — the display and controls your piano never had.

![License](https://img.shields.io/badge/license-Apache--2.0-blue)
![Platforms](https://img.shields.io/badge/platforms-macOS%20%7C%20Web-lightgrey)

**Pianel** turns your desktop or browser into a far richer control panel for the Roland FP‑30X digital piano. The FP‑30X ships with almost no on-board display and only a handful of button combinations — Pianel surfaces the hundreds of tones, live status, presets, and performance controls that are otherwise locked behind an undocumented Roland SysEx protocol.

It treats the **piano as the source of truth**: it both writes parameters to the piano and reads the piano's real state back, so the UI always reflects what the hardware is actually doing. Everything works **fully offline** — no accounts, no cloud, no network. Bluetooth to the piano is the only external connection.

> [!IMPORTANT]
> **Pianel is an independent, community project. It is not affiliated with, endorsed by, or sponsored by Roland Corporation.**
> "Roland" and "FP‑30X" are trademarks of Roland Corporation, used here only to describe hardware compatibility. Pianel was built by observing the piano's own MIDI / Bluetooth traffic (black-box reverse engineering) and contains no Roland source code, firmware, or proprietary assets.

## Features

- **Tone browsing & selection** — the full FP‑30X catalog (SuperNATURAL + GM2 voices) with categories, favorites, and quick-tone slots.
- **Live, bidirectional status** — tempo, volume, metronome, beat, and active tones stay in sync with the physical piano in both directions.
- **Profiles & presets** — capture full parameter setups and recall them in one action; export/import as files for backup and sharing.
- **Live performance** — real-time chord detection, Split / Dual / Twin voicing modes, transpose, and key-touch control.
- **Hardware-synth UI** — a dark, tactile, glowing-display aesthetic that follows your system light/dark setting.

## Platforms

Pianel is built from a shared TypeScript core so the same logic drives every target:

| Target | Stack | Transport | Status |
|--------|-------|-----------|--------|
| **Desktop** | Electron (macOS), Vite + React | Web Bluetooth / Web MIDI | ✅ In this repo |
| **Web** | Progressive Web App, Vite + React | Web Bluetooth / Web MIDI | ✅ In this repo |
| **Mobile** | React Native, iOS | Bluetooth LE | 🚧 Planned |

## Monorepo structure

This is an npm-workspaces monorepo.

| Package | Description |
|---------|-------------|
| `packages/core` | Pure TypeScript shared logic — engine, services, stores, transport types. No platform dependencies. |
| `packages/ui` | Shared UI primitives and design system, consumed by the apps. |
| `apps/desktop` | Electron desktop app (`@pianel/desktop`). |
| `apps/web` | Browser PWA (`@pianel/web`). |

## Getting started

> Requires Node.js ≥ 22.8 and npm.

```sh
# Install all workspace dependencies
npm install

# Run an app in development
npm run dev:desktop     # Electron desktop app
npm run dev:web         # Web PWA

# Build
npm run build:desktop   # desktop
npm run build:web       # web

# Tests / lint / typecheck (across workspaces)
npm test
npm run lint
npm run typecheck
```

## How it works

The FP‑30X exposes almost nothing useful over standard MIDI CC/PC. Its real control lives in an undocumented Roland **DT1 / RQ1 SysEx** protocol, which this project determined by observing BLE MIDI traffic. The shared implementation lives in `packages/core`.

## Roadmap & other pianos

Pianel's architecture treats each piano model as a pluggable **engine**, not a hardcoded assumption — the FP‑30X is simply the first supported model. Contributions adding support for other Roland (or compatible) pianos are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md).

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md) before opening an issue or pull request.

## License

Licensed under the [Apache License 2.0](LICENSE). See [NOTICE](NOTICE) for attribution details.
