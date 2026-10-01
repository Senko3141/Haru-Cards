# Haru Cards

A little Korean, every day. A personal, offline-first Korean learning PWA built with React, TypeScript, and Vite. No account, backend, analytics, or paid API. Nothing has been deployed.

## Start in VS Code

Open **this repository folder** (`Haru-Cards`) in VS Code.

Install Node.js 22 LTS or newer and pnpm 11.19.0. With npm available, install pnpm using `npm install -g pnpm@11.19.0`. Then:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the local address printed by Vite (normally http://localhost:5173).

```sh
pnpm test        # Scheduling, daily limits, backup, and IndexedDB tests
pnpm build       # Type checking and production PWA build
pnpm preview     # Serve the built app, normally http://localhost:4173
```

To run the browser checks after building:

```sh
pnpm exec playwright install chromium webkit
pnpm test:e2e
```

## Test on an iPhone

1. Put the phone and computer on the same Wi-Fi. Start `pnpm dev` and open the printed Network address in iPhone Safari. Allow the development server through your computer's firewall if necessary.
2. This plain-HTTP LAN preview tests layout and lessons, **not offline installation**. Service workers need a secure context. `localhost` is trusted on the computer, but your computer's LAN IP is not trusted on the phone. Modern secure-context features may also be absent in that HTTP preview.
3. For full phone testing before deployment, serve the production build through HTTPS using a local certificate trusted by both devices, or an HTTPS development tunnel. A tunnel exposes the app to anyone with its address; it needs the computer running. The simplest final installation is the GitHub Pages HTTPS address below.
4. In Safari on that HTTPS address, choose Share → Add to Home Screen (and Open as Web App, if shown).
5. Launch from the icon while online. Wait for the offline-ready status. Complete a lesson, review a card, close and reopen the app, then check that progress remains.
6. Enable Airplane Mode, reopen the installed app, and repeat a review. Test audio separately; text and progress do not depend on it.

Browser-engine checks are not a substitute for this physical-iPhone installation check.

## Learning loop

Six guided lessons introduce 10 basic vowels, 14 basic consonants, syllable blocks, and 205 everyday words and phrases (233 starter cards total). A correct end-of-lesson check marks the lesson complete and unlocks its cards. This is a starter course, not a full Korean curriculum; tense consonants, compound vowels, broader sound changes, and grammar are future work.

Review due cards first, then up to the daily new-card allowance (default five). Rate only after revealing the answer. **Again** means forgotten, **Hard** recalled with effort, **Good** recalled, and **Easy** effortless. `ts-fsrs` schedules the next review using FSRS; this app does not train personal FSRS parameters. The limit counts first introductions using your current local calendar day; due/relearning cards are never capped. A card rated Again returns after its scheduled short interval, not immediately. Setting the new-card limit to zero pauses introductions.

Progress includes vocabulary editing, the daily limit, and JSON backup/restore. Custom vocabulary is immediately eligible for introduction under that limit. Edits preserve its review schedule.

## Local storage and backups

All lessons, cards, schedules, completion state, settings, and review history live in IndexedDB on this device. The app shell is precached by a service worker. Reloads and app updates preserve the database. There is no automatic cross-device sync.

Export a JSON backup from Progress regularly, especially before switching domains or restoring. Website storage can be cleared or evicted. Safari and an installed web app may use separate storage contexts, so use export/import when moving between them. A backup has `version: 1`; import validates fields, dates, references, and duplicates before showing a replacement confirmation. A valid restore replaces your saved data atomically, then includes any newer bundled starter cards and lesson text. The confirmation count includes those new cards. Invalid files do not modify storage. Maximum import size: 25 MB. Two tabs cannot silently overwrite one another's saved progress; a stale tab must reload after a save conflict.

Backups contain your personal learning data. Keep them out of public Git repositories.

## Content updates

On startup and backup import, new bundled card IDs are added as unreviewed cards. Existing cards (including your edits), schedules, history, completed lessons, settings, and custom cards are preserved. Bundled lesson explanations refresh; additional imported lessons remain. Reopening the app does not duplicate cards. New cards still obey lesson locks and your daily limit.

When editing `src/content.ts`, append new entries to the end of the relevant list. IDs currently use each entry’s position, so do not reorder or remove existing entries. Changes to existing card wording do not overwrite saved cards; edit them in the app or add an explicit migration if needed.

## Pronunciation audio

This version uses the browser Web Speech API with a Korean (`ko-*`) voice, preferring one the browser identifies as local. Letter cards play example syllables (e.g. ㄱ → 가), not letter names. Romanization is an approximate aid, never an exact pronunciation guide, and stays hidden until requested during recall.

- **Device speech, selected for this version:** no paid service or API key, but Korean voices may be missing. Remote voices require connectivity. Even a voice marked local must be tested offline on the actual iPhone. The app shows a clear message on missing voices or playback errors.
- **Bundled recordings, future option:** licensed native-speaker recordings precached with the app would give predictable offline audio and consistent pronunciation. No third-party recordings have been copied into this project.
- **Cloud TTS, not implemented:** needs a service, credentials, and often payment; unsuitable for this local-only MVP.

Some operating-system speech services may send the text being spoken to their provider. Cards and learning history are not uploaded by this app. The app never substitutes an English voice for missing Korean audio.

## Publish later on GitHub Pages (free for a public repository)

The publishing workflow runs whenever you push to `main`. Saving files locally does not publish them. The workflow also supports manual runs.

1. Commit and push this project to the existing `Senko3141/Haru-Cards` repository. GitHub Pages is free for a public repository. Do not include `node_modules`, `dist`, or personal backups.
2. In repository Settings → Pages, choose **GitHub Actions** as the source.
3. In Actions, select **Publish Haru Cards** → **Run workflow**. This step publishes the app; it has not been run here.
4. Open `https://Senko3141.github.io/Haru-Cards/` and install from Safari.

Vite's relative base and the manifest's relative scope/start URL support a repository subdirectory. The workflow builds and uploads only `dist`. The public site includes the bundled starter course, but your locally entered vocabulary and progress remain in your device storage. Push to `main` for later releases. While online, the app checks for updates when you return to it, reconnect, and every minute while visible. Tap **Update & reload** when a new release is ready; it will not refresh in the middle of a session automatically.

## Project map

- `src/content.ts`: original lesson wording and starter cards
- `src/store.ts`: IndexedDB, validated backups, FSRS and daily queue
- `src/main.tsx`: Learn, Review, Progress, audio and editing
- `src/style.css`: responsive layout using system fonts (no network font dependency)
- `vite.config.ts`: install manifest and offline cache
- `src/store.test.ts`, `e2e/app.spec.ts`: unit and browser checks

## References

Starter letter structure and romanization were checked against the National Institute of Korean Language. Lessons use original concise explanations, with intentionally limited vocabulary.

- [NIKL: Hangul structure](https://m.korean.go.kr/eng_hangeul/principle/001.html)
- [NIKL: Romanization](https://m.korean.go.kr/front_eng/roman/roman_01.do)
- [TS-FSRS](https://github.com/open-spaced-repetition/ts-fsrs)
- [MDN: Local and remote speech voices](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisVoice/localService)
- [Vite: Static deployment](https://vite.dev/guide/static-deploy)
- [GitHub Pages availability](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
