# Contributing to Pianel

Thanks for your interest in contributing! Pianel is a community project and contributions of all kinds — bug reports, fixes, docs, new piano-model support — are welcome.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating, you agree to uphold it.

## Getting set up

Pianel is an npm-workspaces monorepo. You need Node.js ≥ 22.8 and npm.

```sh
git clone https://github.com/pianelapp/pianel.git
cd pianel
npm install

npm run dev:desktop   # run the Electron app
npm run dev:web       # run the web PWA
```

The shared logic lives in `packages/core`; shared UI in `packages/ui`; the apps in `apps/desktop` and `apps/web`.

## Before you open a pull request

Every change must pass lint and type checks with **zero errors**:

```sh
npm run lint          # ESLint across workspaces
npm run typecheck     # TypeScript across workspaces
npm test              # tests across workspaces
```

- Keep changes focused; one logical change per PR.
- Match the style and conventions of the surrounding code.
- Update docs when behavior changes.
- Add or update tests for `packages/core` logic where practical.

## Branching & commits

- Branch off `main`.
- Use clear, descriptive commit messages (Conventional Commits style is encouraged: `feat:`, `fix:`, `docs:`, `refactor:`, etc.).
- Open the PR against `main` and fill in the PR template.

## Reverse-engineering & legal note

Pianel implements an undocumented protocol determined by **black-box observation** of the piano's own MIDI/Bluetooth traffic. Please do **not** contribute any material copied from Roland's source code, firmware, or copyrighted documentation. Original observations, your own measurements, and independently written implementations are welcome.

## Adding support for another piano

The architecture treats each model as a pluggable engine. If you want to add a new model, open an issue first to discuss the approach — this helps coordinate the engine/transport interfaces.

## Reporting bugs & requesting features

Use the GitHub issue templates. For bugs, include your platform (desktop / web), OS, the piano model, and steps to reproduce.
