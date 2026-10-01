# Haru Cards

An offline-first Korean learning app built with React, TypeScript, and Vite. Install it on your iPhone’s home screen or use it in a browser. No account or backend required.

## Features

- **Learn:** Six Hangul lessons covering vowels, consonants, syllable blocks, and vocabulary. All lessons are open from the start.
- **Flashcards:** 233 starter cards, including 205 everyday words and school/club phrases. Choose any collection and practice freely. FSRS prioritizes due reviews; daily goals never restrict access.
- **Progress:** Review statistics, lesson completion, vocabulary editing, and JSON backup/restore.
- **Appearance:** Cherry blossoms and lantern-gold accents, with light, dark, and device-based themes. Matching browser and home-screen icons.
- **Audio:** Korean device speech with optional romanization hints. Voice availability and offline playback depend on your device.

## Run locally

Requires Node.js 22+ and pnpm 11.19.0.

```sh
npm install -g pnpm@11.19.0
pnpm install --frozen-lockfile
pnpm dev
```

Open the address printed by Vite, usually `http://localhost:5173`.

```sh
pnpm test         # Unit tests
pnpm build        # Type check and production build
pnpm preview      # Preview the production build
```

For browser tests, build first, then run:

```sh
pnpm exec playwright install chromium webkit
pnpm test:e2e
```

## Use on iPhone

1. Open [Haru Cards](https://senko3141.github.io/Haru-Cards/) in Safari after a successful deployment.
2. Tap **Share → Add to Home Screen → Add**. Enable **Open as Web App** if shown.
3. Open the installed app online once so it can cache its files. Offline readiness is shown in **Progress → On your iPhone**.
4. Test offline study by reopening the app in Airplane Mode. Audio may still require a connection.

For local phone previews, use the Network address printed by `pnpm dev` on the same Wi-Fi. Full offline/PWA testing requires HTTPS; a plain-HTTP LAN address is only suitable for previewing the interface.

## Publish and update

Set the repository’s **Settings → Pages → Source** to **GitHub Actions**. Every push to `main` runs tests, builds the app, and publishes it. Check **Actions → Publish Haru Cards** for the result; the workflow can also be run manually.

The installed app checks for updates when brought back into view, when connectivity returns, and every minute while visible. Tap **Update & reload** to apply a new release. Offline, it keeps the last downloaded version.

## Data and content

Progress, cards, and settings are stored locally in IndexedDB. There is no cross-device sync. Export backups from **Progress** before clearing website data or moving to another device or address. Restoring a backup replaces the current saved data after confirmation.

New starter cards merge automatically on startup and backup import without replacing existing cards, edits, or review history. Bundled lesson text also updates.

**When editing `src/content.ts`, append new entries to the end of each list.** Card IDs depend on their positions, so reordering or removing entries requires a migration. Changes to existing starter-card wording do not overwrite saved cards.

## Source files

| File                          | Purpose                                           |
| ----------------------------- | ------------------------------------------------- |
| `src/content.ts`              | Lessons and starter vocabulary                    |
| `src/store.ts`                | Storage, backups, content updates, and scheduling |
| `src/main.tsx`                | Screens, editing, audio, and appearance settings  |
| `src/style.css`               | Light/dark festival theme and responsive layout   |
| `public/`                     | Logo, icons, and festival artwork                 |
| `vite.config.ts`              | PWA manifest and offline caching                  |
| `.github/workflows/pages.yml` | GitHub Pages deployment                           |

Hangul and romanization references: [National Institute of Korean Language](https://m.korean.go.kr/eng_hangeul/principle/001.html), [romanization guide](https://m.korean.go.kr/front_eng/roman/roman_01.do). Scheduling: [TS-FSRS](https://github.com/open-spaced-repetition/ts-fsrs).
