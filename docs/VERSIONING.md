# Versioning & Releases

Pianel uses a single [Semantic Versioning](https://semver.org/) number for the
whole product. One git tag `vX.Y.Z` drives both the desktop binaries and the web
release, and all workspace `package.json` files (`root`, `apps/desktop`,
`apps/web`, `packages/core`, `packages/ui`) stay in lock-step at that number.

Versioning is **automated** by
[release-please](https://github.com/googleapis/release-please): it reads
[Conventional Commits](https://www.conventionalcommits.org/) on `main` and keeps
an always-open "Release PR" that bumps the version and updates
[`CHANGELOG.md`](../CHANGELOG.md). **Merging that PR** is the human checkpoint —
it creates the tag and the GitHub Release.

## Conventional Commits

Every commit that lands on `main` should follow the Conventional Commits format:

```
<type>[optional scope]: <description>

[optional body]

[optional footer, e.g. BREAKING CHANGE: ...]
```

How each type affects the next release:

| Commit | Release effect | Changelog |
|--------|----------------|-----------|
| `fix:` | Release (see phase rules below) | ✅ Bug Fixes |
| `feat:` | Release (see phase rules below) | ✅ Features |
| `feat!:` / `fix!:` / a `BREAKING CHANGE:` footer | Release (bigger bump — see below) | ✅ + ⚠ BREAKING |
| `chore:` `docs:` `ci:` `refactor:` `test:` `style:` `build:` `perf:` | **No release on their own** | Appear in history / "Other" sections |

## Versioning model (SemVer)

Format: `MAJOR.MINOR.PATCH` (e.g. `0.3.1`).

### Pre-1.0.0 rules — **current phase**

While the version is `0.y.z` the product contract is **not** frozen; breaking
changes are expected during active development. To keep the number honest we cap
breaking changes at a MINOR bump instead of jumping to `1.0.0`:

| Bump | `0.1.0 →` | Meaning | Commit |
|------|-----------|---------|--------|
| MINOR | `0.2.0` | Breaking change or significant milestone (the "big" pre-1.0 bump) | `feat!:` / `fix!:` / `BREAKING CHANGE:` |
| PATCH | `0.1.1` | New feature **or** bug fix | `feat:` / `fix:` |

This is produced by two release-please flags:

- `bump-minor-pre-major: true` — a breaking change bumps MINOR, not MAJOR.
- `bump-patch-for-minor-pre-major: true` — a `feat:` bumps PATCH, not MINOR.

### Graduating to 1.0.0

When the product/API is considered stable, cut `1.0.0` **once** via a commit
whose footer contains:

```
Release-As: 1.0.0
```

release-please will then produce a `1.0.0` Release PR. After that, remove the
two pre-major flags from `release-please-config.json` and the standard post-1.0
rules below apply.

### Post-1.0.0 rules — future phase

| Bump | Example | Meaning | Commit |
|------|---------|---------|--------|
| MAJOR | `1.x.x → 2.0.0` | Breaking change — users must change something to keep working | `feat!:` / `BREAKING CHANGE:` |
| MINOR | `1.2.x → 1.3.0` | New backwards-compatible feature | `feat:` |
| PATCH | `1.2.3 → 1.2.4` | Bug fix / internal change, nothing breaks | `fix:` |

## Release flow

```
merge  feat: add tone favourites   → release-please opens/updates PR "chore: release 0.1.1"
                                       • bumps root + 4 workspace package.json → 0.1.1
                                       • writes the 0.1.1 section of CHANGELOG.md
review & merge the Release PR      → creates tag v0.1.1
                                       + GitHub Release with the changelog notes
                                       → the published release triggers the production web deploy
                                         (admin approval gate)
```

The Release PR stays open and re-computes itself as more commits land on `main`,
so it always reflects "what the next release would contain." A release happens
only when a human merges that PR.

## Desktop binaries — Phase 2

This system wires up versioning, the changelog, and GitHub Releases. Building and
attaching macOS/Windows installers to each release is a documented follow-up:
because release-please already publishes with a token that can trigger downstream
workflows, a desktop-build workflow can reuse the same `release: published`
trigger, run `electron-builder` on macOS + Windows runners, and upload the
`.dmg` / `.exe` installers as assets on the same GitHub Release.
