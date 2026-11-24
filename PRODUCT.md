# Dice Poker: Product Requirements

Dice Poker is a single-player dice game in the browser. It is a static web app: no server logic, no build step, no accounts. Open roadmap items are tracked in [README.md](README.md).

## Naming

- The game, its categories and all texts use generic names only ("Dice Poker", "Five of a Kind", "Full House", …).
- "Dice Poker" is the name of the game only. The 50-point box is called "Five of a Kind".
- No trademarked or copyrighted game names, brands or artwork appear anywhere in the app, code or docs.

## Gameplay

- 5 dice, 13 rounds. Each round has up to 3 rolls.
- After the first roll, the player can hold or release any die between rolls.
- After at least one roll, the player must put the dice into exactly one unused category. A category that doesn't match scores 0 (a "scratch").
- Each open category previews the points the current dice would score.
- Categories and scores:

  | Section | Category | Score |
  |---|---|---|
  | Upper | Ones … Sixes | Sum of dice showing that face |
  | Upper | Bonus | +35 if the upper sum is 63 or more |
  | Lower | Three of a Kind | Sum of all dice if at least 3 match |
  | Lower | Four of a Kind | Sum of all dice if at least 4 match |
  | Lower | Five of a Kind | 50 for five of a kind |
  | Lower | Full House | 25 for a triple plus a pair (five of a kind does not count) |
  | Lower | Small Straight | 30 for 4 consecutive faces |
  | Lower | Large Straight | 40 for 5 consecutive faces |
  | Lower | Chance | Sum of all dice |
  | Extra | Extra five of a kind | +100 for each further five of a kind once the Five of a Kind box holds 50 |

- Dice use a cryptographically secure random source.
- When the game ends, a dialog shows the final score and whether it is a new best, and offers a new game.
- The game in progress is never lost on refresh, tab close or app update. Reloading restores the dice, held dice, rolls left and the scorecard.
  - Reloading during the roll animation keeps that roll: refreshing can't be used to re-roll.
  - A finished game is recorded exactly once, even if the page is reloaded while the game-over dialog is open. A new game starts after such a reload.

## Modes

- **Classic** is the game described above. It is always available.
- **Hands Off:** no dice can be held, so every roll rerolls all five dice. Everything else (13 rounds, 3 rolls, scoring) is the same. It unlocks once 10 quests are complete (any quests).
- A switch on the table, above the dice, picks the mode. It can only be changed before the first roll of a game, so a game never changes mode halfway. During the game it shows the active mode.
  - A locked mode shows a lock and the progress ("🔒 Hands Off", with "4/10 quests" below).
  - The chosen mode is remembered for the next game.
  - When a mode unlocks, a toast says so ("New mode unlocked · Hands Off").
- Outside Classic, the header line names the mode ("Hands Off · Round 3 of 13 · Best: 182").
- A game in progress keeps its mode across reloads and updates.

## Leaderboard

- Each mode has its own leaderboard: scores without holding can't be compared with Classic scores. Outside Classic, the title names the mode ("Leaderboard · Hands Off").
- The all-time best score of each mode is stored on the device.
- The last 10 finished games (score and date) of each mode are stored on the device.
- A live leaderboard beside the board shows:
  - a gauge with the past games as marks on the scale and the current score filling up past them;
  - a ranked list of the past games, with a "You (live)" row at the current rank that moves up as the player overtakes games;
  - a one-line summary of the current rank.

## Quests

- There are 48 quests in 8 groups. A trophy button in the header shows the progress (e.g. "4/48") and opens the quest list.
- **Modes:** each group counts in one mode. Career quests count in every mode, Hands Off quests only in Hands Off, and all other groups only in Classic. Without holding, every third roll rerolls all five dice, which would make Against All Odds trivial; and a Classic score means something different from a Hands Off score.
  - The Hands Off group shows how to unlock the mode while it is locked, and "In Hands Off mode, only these quests and Career count" once it is unlocked. Its quests are visible from the start.
- **Career progress:** open Career quests show the games played so far (e.g. "23/50").
- Quest progress is stored on the device. A quest is completed once and stays completed.
- **Celebration:**
  - A visible quest shows a short toast ("Quest complete · <name>").
  - A hidden quest shows a card with its icon and name, which flips after about 2 seconds to reveal the condition. A tap flips it early, and a second tap closes it. It closes by itself after 7 seconds.
  - Celebrations play one after another, each with a sound. Quests completed on the last turn play before the game-over dialog.
- **Hidden quests in the list:** they appear as "?" until found, with a counter ("2 of 8 found").
- **Scope:** quests are only checked during play, never retroactively against older games.

| Group | Quest | Condition |
|---|---|---|
| Score | Double Century | Finish a game with 200+ points |
| Score | High Roller | Finish a game with 250+ points |
| Score | Triple Crown | Finish a game with 300+ points |
| Score | Bonus Hunter | Earn the upper section bonus |
| Low scores | Rock Bottom | Finish a game with fewer than 100 points |
| Low scores | Limbo | Finish a game with fewer than 50 points |
| Low scores | Clean Slate | Finish a game with a 0 in at least 10 boxes |
| Low scores | Lowball | Exactly 5 in Chance (five Ones) |
| Time | Blitz | Finish a game in under 3 minutes (first roll to last score) |
| Time | Speed Demon | Finish a game in under 1 minute (first roll to last score) |
| Time | Quick Draw | Finish a game with 200+ points in under 3 minutes |
| Time | Night Owl | Finish a game between midnight and 5 am |
| Time | Early Bird | Finish a game between 5 am and 8 am |
| Time | Triple Header | Finish 3 games on the same day |
| Time | Hot Streak | Finish a game on 3 days in a row |
| Career | Warming Up | Finish 10 games (any mode) |
| Career | Regular | Finish 50 games (any mode) |
| Career | Centurion | Finish 100 games (any mode) |
| Career | Living Legend | Finish 1000 games (any mode) |
| Specials | All of a Kind | Three of a Kind, Four of a Kind and Five of a Kind all scored above 0 in one game |
| Specials | Hard Choice | A turn ends on five Sixes while at least two of Sixes, Three of a Kind, Four of a Kind, Five of a Kind and Chance are open, including Sixes or Chance (with only the "of a Kind" boxes open, the choice is clear) |
| Perfection | Perfect *X* (13 quests) | Score a box's maximum: Ones 5 … Sixes 30, Three/Four of a Kind 30, Full House 25, Small Straight 30, Large Straight 40, Five of a Kind 50, Chance 30 |
| Hidden | Surgical Strike | Upper section complete with exactly 63 |
| Hidden | Against All Odds | Third roll with all 5 dice rerolled lands a Full House, Four of a Kind, Large Straight or five of a kind (in any box) |
| Hidden | Scratch & Survive | 0 in the Five of a Kind box within the first 6 turns, final total above 225 |
| Hidden | All-In | Exactly one die held after roll 1, and the turn ends in five of a kind (on roll 2 or 3) |
| Hidden | The Gambler | 25+ in Chance with at least one One or Two among the dice |
| Hidden | Zero Waste | Finish a game with no 0 on the scorecard |
| Hidden | Twin Peaks | Five of a kind twice in one game (in any boxes), once with a face of 1–3 and once with 4–6 |
| Hidden | The Escalator | Small Straight, Large Straight, Full House on three consecutive turns, none of them 0 |
| Hidden | Wooden Spoon | Finish a game with exactly 5 points, the lowest score possible |
| Hands Off | Look, No Hands! | Finish a game in Hands Off mode |
| Hands Off | Steady Hand | Finish a Hands Off game with 175+ points |
| Hands Off | Untouchable | Finish a Hands Off game with 200+ points |
| Hands Off | Bolt from the Blue | Roll five of a kind in Hands Off mode (in any box) |
| Hands Off | Autopilot | Finish a Hands Off game with 150+ points in under 90 seconds |

- **Low scores** reward a game gone badly, or one lost on purpose. The lowest possible final score is 5: Chance always holds the sum of the dice (at least 5, with five Ones), and every other box can be scratched.
- **Speed:** Speed Demon is pure speed and needs nothing but quick taps. Quick Draw and Autopilot ask for speed and a good score at once.
- **Hands Off thresholds** come from simulating 200,000 games without holding: a typical game scores about 150, 175+ happens in about 1 game in 5, 200+ in about 1 in 30, and five of a kind in about 1 game in 90.
- **Games played** count every finished game in every mode from v1.10.0 on. Earlier versions did not count games, so the count starts from the games in the history (at most 10). The 10-game quest can therefore trigger at the end of the first game after the update.
- **Perfection names** come from the scorecard labels, so renaming a box renames its quest.
- **Changed from the roadmap:** The Gambler originally asked for "25+ in Chance using at least three Ones or Twos". That is impossible, because the maximum is 2+2+2+6+6 = 18.
- **Games in progress from v1.2.0:** turns played before the update have no roll records. Quests that depend on them (Blitz; Against All Odds and All-In for the turn interrupted by the update) can't trigger for that game, but every later game tracks them fully.

## Sound

- Sound effects play when rolling (a rattle, then one thump per die rolled), when holding or releasing a die (a tick), when banking points (a chime that gets longer for 25+ and 40+ points) and when scratching a zero (a dull "bonk").
- Sound is optional. A speaker button in the header turns it on or off, and the choice is remembered on the device. Sound is on by default.
- No audio files: every sound is generated in the browser, so there is nothing to license or download.

## Languages

- The game is available in English, German, French, Spanish and Indonesian.
- The language follows the browser's language settings: the first supported language in the player's list wins (`de-AT` counts as German). If none is supported, the game uses English.
- Everything the player reads or hears from a screen reader is translated. This includes box names, hints, quests, the leaderboard, dates and the update and install texts.
- The name "Dice Poker" stays the same in every language: it is the app's name. The 50-point box is translated: Five of a Kind, Fünferpasch, Cinq identiques, Cinco iguales, Lima Kembar.
- The naming rule above applies to every language. No translation uses the local brand name of a dice game.
- Every language fits on a 320px-wide phone without horizontal scrolling.

## App, install and updates

- The game can be installed as an app (home screen or desktop) on browsers that support it. If the browser offers an install prompt, an "Install app" button is shown. On iOS, a hint explains "Share → Add to Home Screen".
- Once loaded, the game works fully offline.
- The app icon is a white die with black pips showing five. On the home screen it sits on the green table color.
- The current version is always visible in the footer (e.g. "v1.0.0").
- The player can trigger "Check for updates" manually. The app also checks automatically when it is opened, when it returns to the foreground and once an hour while open.
- When a new version is available, a banner offers "Update" or "Later". Updating never happens silently, and the game in progress is kept across the update.
- Install, offline play and updates need HTTPS or `localhost`. Over plain HTTP on a LAN address the game still works, but these features are unavailable.

## Platform

- Works on phones (from 320px wide) and desktops, in light and dark mode, with keyboard and screen readers.
- Respects `prefers-reduced-motion`.
- `make run` serves the game on the local network and prints the URLs.
