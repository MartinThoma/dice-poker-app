# Dice Poker: Design Decisions

## Architecture

- **Plain static files, no build step and no dependencies.** Classic `<script>` tags (not ES modules) keep the game working when opened from `file://`.
- **Files:**
  - `scoring.js`: pure scoring rules with no DOM access. It also exports for Node so the rules can be tested.
  - `game.js`: game state, rendering and the leaderboard.
  - `sound.js`: the generated sound effects and the on/off setting.
  - `quests.js`: quest definitions and pure checks.
  - `questui.js`: quest storage, celebrations and the quest list.
  - `i18n.js` and `locales/<lang>.js`: language detection and all UI text.
  - `tests/`: Node unit tests for the scoring rules, quest rules and translations (`make test`).
  - `pwa.js`: install, version and update UI.
  - `sw.js`: the service worker.
  - `version.js`: the version shown to players.
- **Storage:** `localStorage` keys `dice-poker-best` (number) and `dice-poker-history` (newest first, at most 10 entries of `{score, date}`). Every access is wrapped in try/catch, so the game still runs when storage is blocked.
- **Game in progress:** saved under `dice-poker-current` as `{v, dice, held, rollsLeft, scores, pokerBonuses}`.
  - It is written after every action (roll, hold, score). A roll is saved the moment the button is clicked, with the final dice, before the 450ms animation. That way a reload mid-animation can't undo it.
  - On load, the save is validated field by field (dice 1–6, 5 booleans for holds, known category ids, fewer than 13 scores). Anything invalid or unparseable is ignored, and a fresh game starts.
  - `v` is a save-format number, separate from the app version, so app updates keep saved games. Bump `SAVE_FORMAT` in `game.js` only when the shape changes. Older saves are then discarded.
  - The save is removed when a game finishes, before it is written to the history. A reload on the game-over dialog therefore can't record the game twice.
  - Using `localStorage` (rather than `sessionStorage`) means the game also survives closing the tab or the installed app.

## Versioning and updates

- **Version source:** `version.js` holds the version for display (`self.APP_VERSION`). `sw.js` repeats it as `VERSION`, which names its cache.
  - `make bump VERSION=x.y.z` rewrites both. `make check` fails if they differ, if a precached file is missing (that would make the whole install fail silently) or if a `<script>` in `index.html` is not precached (that would break offline play).
- **Release rule:** every change that should reach players needs a version bump. Without one, installed copies keep serving the old cached files.
- **CDN-proof updates.** The production site (`martin-thoma.com`) sits behind Cloudflare, which caches `.js` files for 4 hours. No request header gets past that, so the classic `registration.update()` kept fetching the old `sw.js` and reported "up to date". The fix relies on a CDN caching per full URL, query string included:
  - **Version check:** the check fetches `version.js?fresh=<timestamp>`. The unique URL always reaches the origin. The service worker never answers `?fresh=` requests from its cache.
  - **Worker URL:** the worker is registered as `sw.js?v=<version>`. When the server reports a different version, the page registers `sw.js?v=<new>`. A new script URL is always fetched fresh, so it installs the new worker even while plain `sw.js` is stale at the CDN.
  - **Silent swap:** a waiting worker whose `?v=` equals the running version (only its URL changed, as when moving from 1.3.0's plain `sw.js`) is activated silently instead of showing the banner.
  - Both URLs are safe to cache at the CDN, because their content never changes for a given version.
  - **First visits:** `index.html` loads every script and the stylesheet as `<file>?v=<version>`. The CDN never caches HTML, so without this a visitor with no service worker yet could get new HTML with old JavaScript. In 1.4.0 that broke the page, because old `game.js` writes to elements the new HTML no longer has. `make bump` rewrites these queries and `make check` verifies them. The service worker matches with `ignoreSearch`, so the plain precached copies still serve them offline.
- **Caching:** cache-first, with one cache per version (`dice-poker-<version>`).
  - On install, the worker downloads every file as `<file>?v=<version>` with `cache: "reload"` and stores it under its plain URL. The query keeps stale CDN copies out, and `reload` keeps the browser's HTTP cache out. Without this, a new version could mix in old files.
  - On activate, it deletes the caches of older versions.
  - If the network fails, page loads fall back to the cached `index.html`.
- **Update flow:** the new worker installs and then waits; it never calls `skipWaiting()` by itself.
  - The page shows a banner. Choosing "Update" posts `SKIP_WAITING`, and the page reloads on `controllerchange`.
  - The reload is guarded so that it only happens after the player accepted. The first install also fires `controllerchange`.
- **Update checks:** on page load, on `visibilitychange` to visible, hourly, and from the "Check for updates" link. Installed apps can stay open for days, so a check on load alone is not enough.
- **Relative paths everywhere** (`start_url: "./"`, `scope: "./"`), so the app works from a subpath such as GitHub Pages.
- **Graceful degradation:** without a service worker (insecure origin, old browser), the version is still shown, and the install and update controls stay hidden.

## Translations

- **One dictionary file per language** (`locales/en.js`, `de.js`, `fr.js`, `es.js`, `id.js`), loaded as classic scripts before `i18n.js`. They are JavaScript rather than JSON because fetching JSON fails from `file://`, and loading them as scripts keeps the startup synchronous. All five are precached, so switching the browser language works offline.
- **English is the reference.** Every locale must have exactly its keys with the same `{placeholders}`. `make test` enforces this, so a missing translation fails the build instead of silently showing English. At runtime, a missing key falls back to English and then to the key itself.
- **Keys are flat and keyed by stable ids:** `cat.<boxId>`, `hint.<boxId>`, `quest.<questId>.name` and `.text`, `questcat.<groupId>`.
  - `scoring.js` and `quests.js` hold ids, icons and rules only, no text.
  - Perfection quests share one template per language (`quest.perfect.name`, e.g. "Perfekt: {cat}"), filled with the box label. Renaming a box therefore renames its quest in every language.
- **Plurals:** a value can be an object keyed by `Intl.PluralRules` categories (`one`, `other`, …), selected by `{n}`. A language may use a plural object where English has a plain string (French "restant/restants"). Indonesian only needs `other`.
- **Detection:** `I18n.detect(navigator.languages)` takes the primary subtag of each entry in order, maps the legacy `in` to `id`, and returns the first supported one, else `en`. There is no in-app picker yet; the roadmap asks for the browser setting.
- **Applying:** `i18n.js` sets `<html lang>` (for screen-reader voices and hyphenation) and fills every `data-i18n` (text) and `data-i18n-aria-label` element in `index.html`. Text that mixes in live values (the round line, buttons, the leaderboard) is rendered from templates in JavaScript, because word order differs between languages.
- **Dates** use `toLocaleDateString(I18n.lang, …)`, so they match the UI language rather than the browser's locale.
- **Word choices:**
  - The 50-point box is "Five of a Kind" (since v1.7.0; before, it shared the app's name "Dice Poker", which was confusing). Each language uses its plain term for five equal dice, matching its names for three and four of a kind: Fünferpasch, Cinq identiques, Cinco iguales, Lima Kembar. Spanish avoids "Póquer", which in Spanish dice games usually means four of a kind.
  - Its internal id stays `poker` (and `pokerBonuses`, `perfect-poker`): saved games and completed quests refer to it, so renaming the id would need a migration for no visible gain.
  - Generic box names: Dreierpasch/Viererpasch, Brelan/Carré, Trío/Cuatro iguales, Tiga/Empat Kembar.
  - Quest names are localized idioms rather than literal translations (Surgical Strike → "Punktlandung", All-In → "Tapis", Zero Waste → "Cero ceros").
  - The iOS install hint quotes the localized Share-menu labels.
- **The manifest** stays English ("Dice Poker"). A manifest can't be localized, and the name is the same in every language anyway.
- **Space:** the live leaderboard row has only about 35px for its name at 320px. Below 400px the list uses tighter spacing, names may wrap onto two lines, and `overflow-wrap: anywhere` is a last resort against overflow. The live labels were picked to fit: "Vous (en jeu)" and "Kamu (live)".

## Visual design

- **Theme:** a casino table. The dice sit on a green felt panel with a radial gradient, and the scorecard and leaderboard are paper-colored cards on a warm beige background.
- **Color tokens** (on `:root`, redefined for dark mode):
  - `--felt` `#1f6b4a`: table, focus and "available" accents. It is also the manifest `theme_color`.
  - `--accent` `#c0392b`: primary buttons, the gauge bulb and the live leaderboard row.
  - `--hold` `#f2b705`: held dice, focus outlines and the #1 rank.
  - `--bg`, `--paper`, `--ink`, `--muted` and `--line`: neutrals.
  - `--felt-ink` and `--hold-ink`: the green and gold for text. Light mode uses `#1f6b4a` and `#8a6500`; dark mode uses `#5fbf8f` and `#f2b705`.
    - They exist because `--felt` and `--hold` are surface colors. As text on paper they fail contrast: dark-mode felt is 1.9:1 and light-mode gold is 1.8:1.
    - All body text meets WCAG AA (4.5:1). Use the `-ink` tokens for links, dates, labels and ranks.
- **Icon:** a white die with black pips showing five, like a real die (v1.8.0; before, it was red with white pips).
  - `icons/icon.svg` (favicon, and the 192/512 PNGs) has a transparent background and a thin near-black outline. Without the outline a white die would vanish in light browser tabs and on light home screens.
  - `icons/icon-maskable.svg` puts the die on the felt-green table with a soft drop shadow. The die stays inside the 80% safe zone, so any mask shape leaves it whole. The opaque 180px apple-touch icon is rendered from the same file, because iOS needs an opaque square.
  - `make icons` renders all PNGs from the two SVGs (rsvg-convert and ImageMagick).
- **Dice:** CSS-grid pips (a 3×3 grid). Held dice lift by 8px and get a yellow ring. Before the first roll the dice are blank and disabled.
- **Scorecard:** each open category shows its preview score as a button. Zero-point options are dimmed so scratches are a conscious choice.
- **Layout:** the board (at most 520px wide) is on the left and the sticky leaderboard is on the right. Below 880px the leaderboard moves under the board. Between 800 and 880px the side column was only about 230px wide, so the names in the list broke after every letter.
- **Leaderboard gauge:**
  - Scale: 0 up to the highest score rounded up to the next 50, with a minimum of 200, so the marks don't bunch together.
  - Past-game labels are pushed apart by at least 15px, so a label can sit slightly above its own mark.
- **Update banner:** a dark bar fixed to the top of the screen, so it can't be missed. The footer holds the version, "Check for updates" and "Install app".

## Quests

- **Split:** the rules (`quests.js`) are pure functions over a context object and are tested in Node (`make test`). The UI (`questui.js`) handles storage, celebrations and the list dialog.
- **Context:** checked after every scored turn and once more when the game is finished. It holds the turn log, the full scorecard, totals, the start and finish times, and the history (which includes the just-finished game).
- **Turn log:** each scored turn records `{turn, cat, score, dice, rolls}`. `rolls` has one 5-boolean mask per roll (true = that die was rolled), or `null` if unknown.
  - The mask is saved in the same `persist()` call as the roll's result, so a reload mid-animation can't desync them.
  - `turn` is the turn number at scoring time. Order-sensitive quests (Scratch & Survive, The Escalator) use it rather than the position in the log, so a log that starts mid-game can't produce false positives.
  - Zero Waste reads the scorecard, which is always complete, not the log.
- **Save format 2** adds `log`, `rolls` and `startedAt` to `dice-poker-current`. Format 1 saves (v1.2.0) still load, with an empty log, unknown rolls for the current turn and an unknown start time. This keeps the promise of the update banner. Bad tracking fields are dropped one by one; they never discard the game.
- **Storage:** `dice-poker-quests` = `{questId: completedAtMs}`.
- **Celebrations:** a single promise queue, so toasts and cards never overlap.
  - On the last turn, `finish()` opens the game-over dialog only after the queue drains. A card shown over a modal dialog would be inert and couldn't be tapped.
  - Toasts and cards are `popover="manual"` elements, so they render in the top layer. Browsers without popover get a `.open` class instead.
- **Card:** a 5:7 playing card. The front is the felt-green table look with a gold border, an icon medallion with a gold ring and the name. The back is paper-colored with the name and the condition.
  - It pops in (scale and rotation, 500ms ease-out-expo, no bounce) and flips with `rotateY(180deg)` after 1.8 seconds.
  - Under reduced motion there is no pop and no 3D flip; the faces crossfade instead.
- **Icons:** emoji, so there are no image assets and they adapt to the platform. Done quests show in color with a gold tint, open ones in grayscale, and locked hidden ones as "?".
- **Header:** the trophy button with the count sits on the left, mirroring the sound button on the right. On screens narrower than 420px the title shrinks to fit between them.

## Sound

- **Generated, not recorded.** `sound.js` builds every effect with the Web Audio API, so there are no audio assets, no licensing questions and nothing extra to precache.
  - **Roll:** band-passed white-noise clicks spread over about 350ms (the rattle), then a low click per rolled die (landing). The length matches the 450ms tumble animation.
  - **Hold/release:** a 70ms triangle tick, higher (880Hz) when holding and lower (620Hz) when releasing.
  - **Score:** a sine arpeggio on C major notes: 2 notes normally, 3 for 25 points or more, 4 for 40 or more.
  - **Scratch:** a triangle tone gliding down from 220Hz to 110Hz.
- **The `AudioContext` is created on the first sound**, which always happens inside a click, so autoplay rules never block it. Turning sound off suspends it.
- **Setting:** `localStorage` key `dice-poker-sound` (`on`/`off`). The default is on, because every sound is triggered by the player's own action.
- **Toggle:** a 44px round speaker button at the top right of the header, using `aria-pressed`. The icon shows sound waves when on and an × when off.

## Motion

- **Dice:** a 450ms tumble when rolled.
- **Gauge:** the fill animates with `transform: scaleY` (not `height`) to avoid layout work on every frame.
- **Leaderboard:** rows swap places with the View Transitions API when the rank changes, and only if the browser supports it.
- **Reduced motion:** all of these animations are turned off under `prefers-reduced-motion`.
