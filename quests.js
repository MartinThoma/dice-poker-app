/* Quest definitions and their pure checks (no DOM, testable in Node).
 * Names and conditions are translated: locales/*.js hold them as
 * "quest.<id>.name" and "quest.<id>.text" (see i18n.js).
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

  // Quest groups in display order. Labels live in locales/*.js ("questcat.<id>").
  const CATEGORIES = [{ id: "score" }, { id: "time" }, { id: "special" }, { id: "perfect" }, { id: "hidden" }];

  const QUESTS = [
    // Score-based
    { id: "double-century", cat: "score", icon: "💯",
      check: (c) => c.finished && c.total >= 200 },
    { id: "high-roller", cat: "score", icon: "💰",
      check: (c) => c.finished && c.total >= 250 },
    { id: "triple-crown", cat: "score", icon: "👑",
      check: (c) => c.finished && c.total >= 300 },
    { id: "bonus-hunter", cat: "score", icon: "🎁",
      check: (c) => c.upperSum >= S.UPPER_BONUS_THRESHOLD },

    // Time-based
    { id: "blitz", cat: "time", icon: "⚡",
      check: (c) => c.finished && c.startedAt != null && c.finishedAt - c.startedAt < 3 * 60 * 1000 },
    { id: "night-owl", cat: "time", icon: "🦉",
      check: (c) => c.finished && hour(c.finishedAt) < 5 },
    { id: "early-bird", cat: "time", icon: "🐦",
      check: (c) => c.finished && hour(c.finishedAt) >= 5 && hour(c.finishedAt) < 8 },
    { id: "triple-header", cat: "time", icon: "🎟️",
      check: (c) => c.finished && c.history.filter((g) => dayKey(g.date) === dayKey(c.finishedAt)).length >= 3 },
    { id: "hot-streak", cat: "time", icon: "🔥",
      check: (c) => {
        if (!c.finished) return false;
        const days = new Set(c.history.map((g) => dayKey(g.date)));
        const d = new Date(c.finishedAt);
        return [0, 1, 2].every((back) => days.has(dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - back).getTime())));
      } },

    // Specials
    { id: "all-of-a-kind", cat: "special", icon: "🎲",
      check: (c) => c.scores.threeKind > 0 && c.scores.fourKind > 0 && c.scores.poker > 0 },

    // Perfection: one per box, named from the box's scorecard label (see i18n.js).
    ...[...S.UPPER, ...S.LOWER].map((cat) => ({
      id: "perfect-" + cat.id, cat: "perfect", icon: "⭐", box: cat.id, max: PERFECT[cat.id],
      check: (c) => c.turn && c.turn.cat === cat.id && c.turn.score === PERFECT[cat.id],
    })),

    // Hidden: names and conditions are only revealed once found.
    { id: "surgical-strike", cat: "hidden", icon: "🎯",
      check: (c) => S.UPPER.every((u) => u.id in c.scores) && c.upperSum === S.UPPER_BONUS_THRESHOLD },
    { id: "against-all-odds", cat: "hidden", icon: "🍀",
      check: (c) => {
        const r = c.turn && c.turn.rolls;
        if (!r || r.length !== 3 || !r[2].every(Boolean)) return false;
        const d = c.turn.dice;
        return fullHouse(d) || fourKind(d) || largeStraight(d) || fiveKind(d);
      } },
    { id: "scratch-and-survive", cat: "hidden", icon: "🩹",
      check: (c) => c.finished && c.total > 225 &&
        c.log.some((t) => t.cat === "poker" && t.score === 0 && t.turn <= 6) },
    { id: "all-in", cat: "hidden", icon: "🎰",
      check: (c) => {
        const r = c.turn && c.turn.rolls;
        return !!r && r.length >= 2 && r[1].filter(Boolean).length === 4 && fiveKind(c.turn.dice);
      } },
    { id: "the-gambler", cat: "hidden", icon: "🃏",
      check: (c) => c.turn && c.turn.cat === "chance" && c.turn.score >= 25 && c.turn.dice.some((d) => d <= 2) },
    { id: "zero-waste", cat: "hidden", icon: "♻️",
      check: (c) => c.finished && Object.values(c.scores).every((v) => v > 0) },
    { id: "twin-peaks", cat: "hidden", icon: "⛰️",
      check: (c) => {
        const faces = c.log.filter((t) => fiveKind(t.dice)).map((t) => t.dice[0]);
        return faces.some((f) => f <= 3) && faces.some((f) => f >= 4);
      } },
    { id: "the-escalator", cat: "hidden", icon: "📈",
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
