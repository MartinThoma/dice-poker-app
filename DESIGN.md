# Dice Poker: Design Decisions

## Architecture

- **Plain static files, no build step and no dependencies.** Classic `<script>` tags (not ES modules) keep the game working when opened from `file://`.
- **Files:**
  - `scoring.js`: pure scoring rules with no DOM access. It also exports for Node so the rules can be tested.
  - `game.js`: game state, rendering and the leaderboard.
  - `sound.js`: the generated sound effects and the on/off setting.
  - `pwa.js`: install, version and update UI.
  - `sw.js`: the service worker.
  - `version.js`: the version shown to players.
- **Storage:** `localStorage` keys `dice-poker-best` (number) and `dice-poker-history` (newest first, at most 10 entries of `{score, date}`). Every access is wrapped in try/catch, so the game still runs when storage is blocked.

## Versioning and updates

- **Version source:** `version.js` holds the version for display (`self.APP_VERSION`). `sw.js` repeats it as `VERSION`.
  - Repeating it in `sw.js` matters: the browser only installs a new service worker if `sw.js` itself changes byte for byte, so every release must change that file.
  - `make bump VERSION=x.y.z` rewrites both, and `make check` fails if they differ or if a precached file is missing (a missing file would make the whole install fail silently).
- **Release rule:** every change that should reach players needs a version bump. Without one, installed copies keep serving the old cached files.
- **Caching:** cache-first, with one cache per version (`dice-poker-<version>`).
  - On install, the worker precaches the app shell with `cache: "reload"` so it never stores stale files from the HTTP cache.
  - On activate, it deletes the caches of older versions.
  - If the network fails, page loads fall back to the cached `index.html`.
- **Update flow:** the new worker installs and then waits; it never calls `skipWaiting()` by itself.
  - The page shows a banner. Choosing "Update" posts `SKIP_WAITING`, and the page reloads on `controllerchange`.
  - The reload is guarded so that it only happens after the player accepted. The first install also fires `controllerchange`.
- **Update checks:** on page load, on `visibilitychange` to visible, hourly, and from the "Check for updates" link. Installed apps can stay open for days, so a check on load alone is not enough.
- **Relative paths everywhere** (`start_url: "./"`, `scope: "./"`), so the app works from a subpath such as GitHub Pages.
- **Graceful degradation:** without a service worker (insecure origin, old browser), the version is still shown, and the install and update controls stay hidden.

## Visual design

- **Theme:** a casino table. The dice sit on a green felt panel with a radial gradient, and the scorecard and leaderboard are paper-colored cards on a warm beige background.
- **Color tokens** (on `:root`, redefined for dark mode):
  - `--felt` `#1f6b4a`: table, focus and "available" accents. It is also the manifest `theme_color`.
  - `--accent` `#c0392b`: primary buttons, the gauge bulb and the live leaderboard row. It is also the icon color.
  - `--hold` `#f2b705`: held dice, focus outlines and the #1 rank.
  - `--bg`, `--paper`, `--ink`, `--muted` and `--line`: neutrals.
- **Icon:** a red die showing five, in SVG plus PNG at 192 and 512. There is a maskable variant on felt green with the die inside the safe zone, and an opaque 180px apple-touch icon.
- **Dice:** CSS-grid pips (a 3×3 grid). Held dice lift by 8px and get a yellow ring. Before the first roll the dice are blank and disabled.
- **Scorecard:** each open category shows its preview score as a button. Zero-point options are dimmed so scratches are a conscious choice.
- **Layout:** the board (at most 520px wide) is on the left and the sticky leaderboard is on the right. Below 800px the leaderboard moves under the board.
- **Leaderboard gauge:**
  - Scale: 0 up to the highest score rounded up to the next 50, with a minimum of 200, so the marks don't bunch together.
  - Past-game labels are pushed apart by at least 15px, so a label can sit slightly above its own mark.
- **Update banner:** a dark bar fixed to the top of the screen, so it can't be missed. The footer holds the version, "Check for updates" and "Install app".

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
