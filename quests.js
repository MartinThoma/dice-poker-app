/* Quest definitions and their pure checks (no DOM, testable in Node).
 *
 * Each check receives a context describing the game right after a category
 * was scored:
 *   log        turns scored this game: {turn, cat, score, dice, rolls}
 *              (turn = 1..13; rolls = one array of 5 booleans per roll, true
 *              where that die was rolled, or null if unknown)
 *   turn       the last entry of log (the turn just scored)
 *   scores     {categoryId: points} for the whole game (always complete)
 *   upperSum   sum of the upper section
 *   finished   true once all 13 categories are scored
 *   total      final total (only meaningful when finished)
 *   startedAt  ms timestamp of the game's first roll, or null if unknown
 *   finishedAt ms timestamp the game ended (only when finished)
 *   history    finished games {score, date}, newest first, including this one
 */
(function (root) {
  "use strict";
  const S = typeof module !== "undefined" && module.exports ? require("./scoring.js") : root.Scoring;

  const counts = (dice) => { const c = [0, 0, 0, 0, 0, 0, 0]; dice.forEach((d) => c[d]++); return c; };
  const fiveKind = (dice) => new Set(dice).size === 1;
  const fourKind = (dice) => Math.max(...counts(dice)) >= 4;
  const fullHouse = (dice) => { const c = counts(dice); return c.includes(3) && c.includes(2); };
  const largeStraight = (dice) => S.score("largeStraight", dice) > 0;
  const dayKey = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
  const hour = (ms) => new Date(ms).getHours();

  // Highest possible score per box: what "Perfect X" asks for.
  const PERFECT = {
    ones: 5, twos: 10, threes: 15, fours: 20, fives: 25, sixes: 30,
    threeKind: 30, fourKind: 30, fullHouse: 25, smallStraight: 30, largeStraight: 40, poker: 50, chance: 30,
  };

  const CATEGORIES = [
    { id: "score", label: "Score" },
    { id: "time", label: "Time" },
    { id: "special", label: "Specials" },
    { id: "perfect", label: "Perfection" },
    { id: "hidden", label: "Hidden" },
  ];

  const QUESTS = [
    // Score-based
    { id: "double-century", cat: "score", icon: "💯", name: "Double Century",
      text: "Finish a game with 200 points or more.",
      check: (c) => c.finished && c.total >= 200 },
    { id: "high-roller", cat: "score", icon: "💰", name: "High Roller",
      text: "Finish a game with 250 points or more.",
      check: (c) => c.finished && c.total >= 250 },
    { id: "triple-crown", cat: "score", icon: "👑", name: "Triple Crown",
      text: "Finish a game with 300 points or more.",
      check: (c) => c.finished && c.total >= 300 },
    { id: "bonus-hunter", cat: "score", icon: "🎁", name: "Bonus Hunter",
      text: "Earn the upper section bonus (63 points or more in Ones to Sixes).",
      check: (c) => c.upperSum >= S.UPPER_BONUS_THRESHOLD },

    // Time-based
    { id: "blitz", cat: "time", icon: "⚡", name: "Blitz",
      text: "Finish a game in under 3 minutes, from first roll to last score.",
      check: (c) => c.finished && c.startedAt != null && c.finishedAt - c.startedAt < 3 * 60 * 1000 },
    { id: "night-owl", cat: "time", icon: "🦉", name: "Night Owl",
      text: "Finish a game between midnight and 5 am.",
      check: (c) => c.finished && hour(c.finishedAt) < 5 },
    { id: "early-bird", cat: "time", icon: "🐦", name: "Early Bird",
      text: "Finish a game between 5 am and 8 am.",
      check: (c) => c.finished && hour(c.finishedAt) >= 5 && hour(c.finishedAt) < 8 },
    { id: "triple-header", cat: "time", icon: "🎟️", name: "Triple Header",
      text: "Finish 3 games on the same day.",
      check: (c) => c.finished && c.history.filter((g) => dayKey(g.date) === dayKey(c.finishedAt)).length >= 3 },
    { id: "hot-streak", cat: "time", icon: "🔥", name: "Hot Streak",
      text: "Finish a game on 3 days in a row.",
      check: (c) => {
        if (!c.finished) return false;
        const days = new Set(c.history.map((g) => dayKey(g.date)));
        const d = new Date(c.finishedAt);
        return [0, 1, 2].every((back) => days.has(dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - back).getTime())));
      } },

    // Specials
    { id: "all-of-a-kind", cat: "special", icon: "🎲", name: "All of a Kind",
      text: "Score Three of a Kind, Four of a Kind and Dice Poker in the same game (none of them 0).",
      check: (c) => c.scores.threeKind > 0 && c.scores.fourKind > 0 && c.scores.poker > 0 },

    // Perfection: one per box, named from the scorecard labels.
    ...[...S.UPPER, ...S.LOWER].map((cat) => ({
      id: "perfect-" + cat.id, cat: "perfect", icon: "⭐", name: "Perfect " + cat.label,
      text: `Score the maximum of ${PERFECT[cat.id]} points in ${cat.label}.`,
      check: (c) => c.turn && c.turn.cat === cat.id && c.turn.score === PERFECT[cat.id],
    })),

    // Hidden: names and conditions are only revealed once found.
    { id: "surgical-strike", cat: "hidden", icon: "🎯", name: "Surgical Strike",
      text: "Finish the upper section with exactly 63 points: the bonus with 0 points to spare.",
      check: (c) => S.UPPER.every((u) => u.id in c.scores) && c.upperSum === S.UPPER_BONUS_THRESHOLD },
    { id: "against-all-odds", cat: "hidden", icon: "🍀", name: "Against All Odds",
      text: "Reroll all 5 dice on your third roll and still land a Full House, Four of a Kind, Large Straight or five of a kind.",
      check: (c) => {
        const r = c.turn && c.turn.rolls;
        if (!r || r.length !== 3 || !r[2].every(Boolean)) return false;
        const d = c.turn.dice;
        return fullHouse(d) || fourKind(d) || largeStraight(d) || fiveKind(d);
      } },
    { id: "scratch-and-survive", cat: "hidden", icon: "🩹", name: "Scratch & Survive",
      text: "Take a 0 in the Dice Poker box within your first 6 turns and still finish with more than 225 points.",
      check: (c) => c.finished && c.total > 225 &&
        c.log.some((t) => t.cat === "poker" && t.score === 0 && t.turn <= 6) },
    { id: "all-in", cat: "hidden", icon: "🎰", name: "All-In",
      text: "Hold only a single die after your first roll and turn it into five of a kind by your third roll.",
      check: (c) => {
        const r = c.turn && c.turn.rolls;
        return !!r && r.length >= 2 && r[1].filter(Boolean).length === 4 && fiveKind(c.turn.dice);
      } },
    { id: "the-gambler", cat: "hidden", icon: "🃏", name: "The Gambler",
      text: "Score 25 or more in Chance with at least one One or Two among the dice.",
      check: (c) => c.turn && c.turn.cat === "chance" && c.turn.score >= 25 && c.turn.dice.some((d) => d <= 2) },
    { id: "zero-waste", cat: "hidden", icon: "♻️", name: "Zero Waste",
      text: "Finish a game without a single 0 on the scorecard.",
      check: (c) => c.finished && Object.values(c.scores).every((v) => v > 0) },
    { id: "twin-peaks", cat: "hidden", icon: "⛰️", name: "Twin Peaks",
      text: "Roll five of a kind twice in one game: once with a low face (1–3) and once with a high face (4–6).",
      check: (c) => {
        const faces = c.log.filter((t) => fiveKind(t.dice)).map((t) => t.dice[0]);
        return faces.some((f) => f <= 3) && faces.some((f) => f >= 4);
      } },
    { id: "the-escalator", cat: "hidden", icon: "📈", name: "The Escalator",
      text: "Score a Small Straight, then a Large Straight, then a Full House on three turns in a row.",
      check: (c) => {
        const n = c.log.length;
        if (n < 3) return false;
        const [a, b, d] = c.log.slice(n - 3);
        return a.cat === "smallStraight" && b.cat === "largeStraight" && d.cat === "fullHouse" &&
          a.score > 0 && b.score > 0 && d.score > 0 && b.turn === a.turn + 1 && d.turn === b.turn + 1;
      } },
  ];

  /** Ids of quests not in `done` whose condition holds for context `c`. */
  function newlyCompleted(c, done) {
    return QUESTS.filter((q) => !(q.id in done) && q.check(c)).map((q) => q.id);
  }

  const api = { QUESTS, CATEGORIES, PERFECT, newlyCompleted };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Quests = api;
})(typeof window !== "undefined" ? window : globalThis);
