/* Pure scoring rules for Dice Poker (five dice, 13 categories).
 * Box names and hints are translated: see "cat.<id>" and "hint.<id>" in locales/*.js. */
(function (root) {
  "use strict";

  const UPPER = [
    { id: "ones", face: 1 },
    { id: "twos", face: 2 },
    { id: "threes", face: 3 },
    { id: "fours", face: 4 },
    { id: "fives", face: 5 },
    { id: "sixes", face: 6 },
  ];

  const LOWER = [
    { id: "threeKind" },
    { id: "fourKind" },
    { id: "fullHouse" },
    { id: "smallStraight" },
    { id: "largeStraight" },
    { id: "poker" }, // "Five of a Kind"; the id predates the rename and is kept for saved games and quests
    { id: "chance" },
  ];

  const UPPER_BONUS_THRESHOLD = 63;
  const UPPER_BONUS = 35;

  function counts(dice) {
    const c = [0, 0, 0, 0, 0, 0, 0];
    for (const d of dice) c[d]++;
    return c;
  }

  const sum = (dice) => dice.reduce((a, b) => a + b, 0);

  function hasRun(dice, length) {
    const set = new Set(dice);
    for (let start = 1; start + length - 1 <= 6; start++) {
      let ok = true;
      for (let i = 0; i < length; i++) if (!set.has(start + i)) ok = false;
      if (ok) return true;
    }
    return false;
  }

  /** Score of `dice` (array of 5 ints 1-6) if placed in category `id`. */
  function score(id, dice) {
    const c = counts(dice);
    const max = Math.max(...c);
    const upper = UPPER.find((u) => u.id === id);
    if (upper) return c[upper.face] * upper.face;
    switch (id) {
      case "threeKind": return max >= 3 ? sum(dice) : 0;
      case "fourKind": return max >= 4 ? sum(dice) : 0;
      case "fullHouse": return c.includes(3) && c.includes(2) ? 25 : 0;
      case "smallStraight": return hasRun(dice, 4) ? 30 : 0;
      case "largeStraight": return hasRun(dice, 5) ? 40 : 0;
      case "poker": return max === 5 ? 50 : 0;
      case "chance": return sum(dice);
      default: throw new Error("Unknown category: " + id);
    }
  }

  /**
   * Totals for a map of {categoryId: score}. Poker bonus: each additional
   * five-of-a-kind after a scored 50 is worth +100 (tracked as `pokerBonuses`).
   */
  function totals(scores, pokerBonuses) {
    const upperSum = UPPER.reduce((a, u) => a + (scores[u.id] || 0), 0);
    const bonus = upperSum >= UPPER_BONUS_THRESHOLD ? UPPER_BONUS : 0;
    const lowerSum = LOWER.reduce((a, l) => a + (scores[l.id] || 0), 0);
    const extra = (pokerBonuses || 0) * 100;
    return { upperSum, bonus, lowerSum, extra, total: upperSum + bonus + lowerSum + extra };
  }

  const api = { UPPER, LOWER, UPPER_BONUS_THRESHOLD, UPPER_BONUS, score, totals };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Scoring = api;
})(typeof window !== "undefined" ? window : globalThis);
