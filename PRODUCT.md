# Dice Poker: Product Requirements

Dice Poker is a single-player dice game in the browser. It is a static web app: no server logic, no build step, no accounts. Open roadmap items are tracked in [README.md](README.md).

## Naming

- The game, its categories and all texts use generic names only ("Dice Poker", "five of a kind", "Full House", …).
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
  | Lower | Full House | 25 for a triple plus a pair (five of a kind does not count) |
  | Lower | Small Straight | 30 for 4 consecutive faces |
  | Lower | Large Straight | 40 for 5 consecutive faces |
  | Lower | Dice Poker | 50 for five of a kind |
  | Lower | Chance | Sum of all dice |
  | Extra | Extra five of a kind | +100 for each further five of a kind once the Dice Poker box holds 50 |

- Dice use a cryptographically secure random source.
- When the game ends, a dialog shows the final score and whether it is a new best, and offers a new game.
- The game in progress is never lost on refresh, tab close or app update. Reloading restores the dice, held dice, rolls left and the scorecard.
  - Reloading during the roll animation keeps that roll: refreshing can't be used to re-roll.
  - A finished game is recorded exactly once, even if the page is reloaded while the game-over dialog is open. A new game starts after such a reload.

## Leaderboard

- The all-time best score is stored on the device.
- The last 10 finished games (score and date) are stored on the device.
- A live leaderboard beside the board shows:
  - a gauge with the past games as marks on the scale and the current score filling up past them;
  - a ranked list of the past games, with a "You (live)" row at the current rank that moves up as the player overtakes games;
  - a one-line summary of the current rank.

## Quests

- There are 31 quests in 5 groups. A trophy button in the header shows the progress (e.g. "4/31") and opens the quest list.
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
| Time | Blitz | Finish a game in under 3 minutes (first roll to last score) |
| Time | Night Owl | Finish a game between midnight and 5 am |
| Time | Early Bird | Finish a game between 5 am and 8 am |
| Time | Triple Header | Finish 3 games on the same day |
| Time | Hot Streak | Finish a game on 3 days in a row |
| Specials | All of a Kind | Three of a Kind, Four of a Kind and Dice Poker all scored above 0 in one game |
| Perfection | Perfect *X* (13 quests) | Score a box's maximum: Ones 5 … Sixes 30, Three/Four of a Kind 30, Full House 25, Small Straight 30, Large Straight 40, Dice Poker 50, Chance 30 |
| Hidden | Surgical Strike | Upper section complete with exactly 63 |
| Hidden | Against All Odds | Third roll with all 5 dice rerolled lands a Full House, Four of a Kind, Large Straight or five of a kind (in any box) |
| Hidden | Scratch & Survive | 0 in the Dice Poker box within the first 6 turns, final total above 225 |
| Hidden | All-In | Exactly one die held after roll 1, and the turn ends in five of a kind (on roll 2 or 3) |
| Hidden | The Gambler | 25+ in Chance with at least one One or Two among the dice |
| Hidden | Zero Waste | Finish a game with no 0 on the scorecard |
| Hidden | Twin Peaks | Five of a kind twice in one game (in any boxes), once with a face of 1–3 and once with 4–6 |
| Hidden | The Escalator | Small Straight, Large Straight, Full House on three consecutive turns, none of them 0 |

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
- The name "Dice Poker" stays the same in every language: it is the app's name and also the name of the 50-point box.
- The naming rule above applies to every language. No translation uses the local brand name of a dice game.
- Every language fits on a 320px-wide phone without horizontal scrolling.

## App, install and updates

- The game can be installed as an app (home screen or desktop) on browsers that support it. If the browser offers an install prompt, an "Install app" button is shown. On iOS, a hint explains "Share → Add to Home Screen".
- Once loaded, the game works fully offline.
- The current version is always visible in the footer (e.g. "v1.0.0").
- The player can trigger "Check for updates" manually. The app also checks automatically when it is opened, when it returns to the foreground and once an hour while open.
- When a new version is available, a banner offers "Update" or "Later". Updating never happens silently, and the game in progress is kept across the update.
- Install, offline play and updates need HTTPS or `localhost`. Over plain HTTP on a LAN address the game still works, but these features are unavailable.

## Platform

- Works on phones (from 320px wide) and desktops, in light and dark mode, with keyboard and screen readers.
- Respects `prefers-reduced-motion`.
- `make run` serves the game on the local network and prints the URLs.
