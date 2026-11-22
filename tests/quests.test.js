// Unit tests for the quest rules in quests.js. Run with `make test`.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const S = require("../scoring.js");
const { QUESTS, CATEGORIES, PERFECT, newlyCompleted } = require("../quests.js");
const I18n = require("../i18n.js");

const ALL_ROLLED = [true, true, true, true, true];
const quest = (id) => QUESTS.find((q) => q.id === id);

/** Build a quest context from a list of turns ({cat, dice, rolls?}). */
function ctx(turns, extra = {}) {
  const scores = {};
  const log = turns.map((t, i) => {
    scores[t.cat] = S.score(t.cat, t.dice);
    return { turn: t.turn || i + 1, cat: t.cat, score: scores[t.cat], dice: t.dice, rolls: t.rolls || [ALL_ROLLED] };
  });
  const tot = S.totals(scores, 0);
  return { log, turn: log[log.length - 1], scores, upperSum: tot.upperSum,
    finished: Object.keys(scores).length === 13, total: tot.total,
    startedAt: null, finishedAt: null, history: [], ...extra };
}

test("quest definitions are complete and unique", () => {
  /**
   * Every quest has a unique id, an icon and a known category.
   *
   * Names and condition texts live in the locales and are checked in i18n.test.js.
   */
  const ids = new Set();
  for (const q of QUESTS) {
    assert.ok(!ids.has(q.id), `duplicate id ${q.id}`);
    ids.add(q.id);
    assert.ok(q.icon, q.id);
    assert.ok(CATEGORIES.some((c) => c.id === q.cat), q.id);
  }
});

test("perfect maxima are reachable", () => {
  /**
   * Every "Perfect X" target is the real maximum of its box and can be scored.
   */
  const best = { ones: [1, 1, 1, 1, 1], twos: [2, 2, 2, 2, 2], threes: [3, 3, 3, 3, 3], fours: [4, 4, 4, 4, 4],
    fives: [5, 5, 5, 5, 5], sixes: [6, 6, 6, 6, 6], threeKind: [6, 6, 6, 6, 6], fourKind: [6, 6, 6, 6, 6],
    fullHouse: [2, 2, 3, 3, 3], smallStraight: [1, 2, 3, 4, 6], largeStraight: [1, 2, 3, 4, 5],
    poker: [4, 4, 4, 4, 4], chance: [6, 6, 6, 6, 6] };
  for (const [cat, dice] of Object.entries(best)) {
    assert.strictEqual(S.score(cat, dice), PERFECT[cat], cat);
    assert.deepStrictEqual(newlyCompleted(ctx([{ cat, dice }]), {}).filter((id) => id.startsWith("perfect-")), ["perfect-" + cat]);
  }
});

test("perfect quests are named after the scorecard labels", () => {
  /**
   * Perfection quest names and texts follow each language's box labels.
   *
   * A renamed box (e.g. "Dice Poker" → "Five of a Kind") renames its quest too.
   */
  for (const lang of I18n.SUPPORTED) {
    const { t, questName, questText } = I18n.forLang(lang);
    for (const c of [...S.UPPER, ...S.LOWER]) {
      const q = quest("perfect-" + c.id);
      assert.ok(questName(q).includes(t("cat." + c.id)), `${lang} ${c.id}`);
      assert.ok(questText(q).includes(String(PERFECT[c.id])), `${lang} ${c.id}`);
    }
  }
});

test("surgical strike needs exactly 63 in a complete upper section", () => {
  /**
   * Surgical Strike triggers only when all six upper boxes are filled and sum to exactly 63.
   */
  const upper = [["ones", [1, 1, 1, 2, 3]], ["twos", [2, 2, 2, 1, 1]], ["threes", [3, 3, 3, 1, 1]],
    ["fours", [4, 4, 4, 1, 1]], ["fives", [5, 5, 5, 1, 1]], ["sixes", [6, 6, 6, 1, 1]]];
  const c = ctx(upper.map(([cat, dice]) => ({ cat, dice })));
  assert.strictEqual(c.upperSum, 63);
  assert.ok(quest("surgical-strike").check(c));
  const over = ctx(upper.map(([cat, dice]) => ({ cat, dice: cat === "sixes" ? [6, 6, 6, 6, 1] : dice })));
  assert.ok(!quest("surgical-strike").check(over));
  assert.ok(!quest("surgical-strike").check(ctx(upper.slice(0, 5).map(([cat, dice]) => ({ cat, dice })))));
});

test("against all odds requires a full third reroll and a strong hand", () => {
  /**
   * Against All Odds needs three rolls, all five dice rolled on the third, and a Full House or better.
   */
  const rolls = [ALL_ROLLED, [true, true, false, false, false], ALL_ROLLED];
  const q = quest("against-all-odds");
  assert.ok(q.check(ctx([{ cat: "fullHouse", dice: [2, 2, 5, 5, 5], rolls }])));
  assert.ok(q.check(ctx([{ cat: "chance", dice: [2, 3, 4, 5, 6], rolls }])), "large straight counts, any box");
  assert.ok(!q.check(ctx([{ cat: "chance", dice: [2, 2, 3, 5, 5], rolls }])), "two pair is not enough");
  assert.ok(!q.check(ctx([{ cat: "fullHouse", dice: [2, 2, 5, 5, 5],
    rolls: [ALL_ROLLED, ALL_ROLLED, [true, true, true, true, false]] }])), "a die was held");
  assert.ok(!q.check(ctx([{ cat: "fullHouse", dice: [2, 2, 5, 5, 5], rolls: null }])), "unknown rolls");
});

test("all-in needs exactly one die held after the first roll", () => {
  /**
   * All-In triggers when a single die is held after roll 1 and the turn ends in five of a kind.
   */
  const q = quest("all-in");
  const one = [true, true, true, false, true];
  assert.ok(q.check(ctx([{ cat: "poker", dice: [3, 3, 3, 3, 3], rolls: [ALL_ROLLED, one, [true, false, true, false, false]] }])));
  assert.ok(q.check(ctx([{ cat: "poker", dice: [3, 3, 3, 3, 3], rolls: [ALL_ROLLED, one] }])), "done by roll 2");
  assert.ok(!q.check(ctx([{ cat: "poker", dice: [3, 3, 3, 3, 3], rolls: [ALL_ROLLED, [true, true, false, false, true]] }])));
  assert.ok(!q.check(ctx([{ cat: "poker", dice: [3, 3, 3, 3, 3], rolls: [ALL_ROLLED] }])), "first-roll luck");
});

test("the gambler is achievable with a low die in chance", () => {
  /**
   * The Gambler triggers for 25+ in Chance with at least one One or Two.
   *
   * The roadmap's "at least three Ones or Twos" is impossible (max 2+2+2+6+6 = 18).
   */
  const q = quest("the-gambler");
  assert.ok(q.check(ctx([{ cat: "chance", dice: [1, 6, 6, 6, 6] }])));
  assert.ok(!q.check(ctx([{ cat: "chance", dice: [3, 6, 6, 6, 6] }])), "no low die");
  assert.ok(!q.check(ctx([{ cat: "chance", dice: [2, 5, 6, 6, 5] }])), "24 points");
});

test("twin peaks needs one low and one high five of a kind", () => {
  /**
   * Twin Peaks counts five of a kind from the dice, whichever box they were scored in.
   */
  const q = quest("twin-peaks");
  assert.ok(q.check(ctx([{ cat: "poker", dice: [2, 2, 2, 2, 2] }, { cat: "sixes", dice: [6, 6, 6, 6, 6] }])));
  assert.ok(!q.check(ctx([{ cat: "poker", dice: [5, 5, 5, 5, 5] }, { cat: "sixes", dice: [6, 6, 6, 6, 6] }])));
});

test("the escalator needs three consecutive non-zero turns in order", () => {
  /**
   * The Escalator triggers for Small Straight, Large Straight, Full House on consecutive turns.
   */
  const q = quest("the-escalator");
  const turns = [{ cat: "smallStraight", dice: [1, 2, 3, 4, 4] }, { cat: "largeStraight", dice: [2, 3, 4, 5, 6] },
    { cat: "fullHouse", dice: [1, 1, 4, 4, 4] }];
  assert.ok(q.check(ctx(turns)));
  assert.ok(!q.check(ctx([turns[1], turns[0], turns[2]])), "wrong order");
  assert.ok(!q.check(ctx([...turns.slice(0, 2), { cat: "fullHouse", dice: [1, 2, 4, 4, 4] }])), "scratched");
  assert.ok(!q.check(ctx(turns.map((t, i) => ({ ...t, turn: [1, 2, 4][i] })))), "gap between turns");
});

test("scratch and survive needs an early zero in the dice poker box", () => {
  /**
   * Scratch & Survive triggers for a 0 in Dice Poker within 6 turns and a final total above 225.
   */
  const q = quest("scratch-and-survive");
  const early = { log: [{ turn: 3, cat: "poker", score: 0, dice: [1, 2, 3, 4, 6], rolls: null }],
    finished: true, total: 230, scores: {} };
  assert.ok(q.check(early));
  assert.ok(!q.check({ ...early, total: 225 }));
  assert.ok(!q.check({ ...early, log: [{ ...early.log[0], turn: 7 }] }));
});

test("zero waste reads the whole scorecard", () => {
  /**
   * Zero Waste uses the full scorecard, so a partial turn log can't fake it.
   */
  const q = quest("zero-waste");
  const scores = Object.fromEntries([...S.UPPER, ...S.LOWER].map((c) => [c.id, 5]));
  assert.ok(q.check({ finished: true, scores, log: [] }));
  assert.ok(!q.check({ finished: true, scores: { ...scores, poker: 0 }, log: [] }));
});

test("score quests trigger only for finished games", () => {
  /**
   * Score thresholds are checked against the final total of a finished game.
   */
  assert.ok(quest("double-century").check({ finished: true, total: 200 }));
  assert.ok(!quest("double-century").check({ finished: false, total: 260 }));
  assert.ok(quest("high-roller").check({ finished: true, total: 250 }));
  assert.ok(!quest("triple-crown").check({ finished: true, total: 299 }));
});

test("time quests use the finish time and the game history", () => {
  /**
   * Blitz, Night Owl, Early Bird, Triple Header and Hot Streak judge time correctly.
   */
  const at = (d, h, m = 0) => new Date(2026, 10, d, h, m).getTime();
  assert.ok(quest("blitz").check({ finished: true, startedAt: at(20, 10), finishedAt: at(20, 10, 2) }));
  assert.ok(!quest("blitz").check({ finished: true, startedAt: at(20, 10), finishedAt: at(20, 10, 3) }));
  assert.ok(!quest("blitz").check({ finished: true, startedAt: null, finishedAt: at(20, 10) }), "unknown start");
  assert.ok(quest("night-owl").check({ finished: true, finishedAt: at(20, 2) }));
  assert.ok(!quest("night-owl").check({ finished: true, finishedAt: at(20, 5) }));
  assert.ok(quest("early-bird").check({ finished: true, finishedAt: at(20, 7, 59) }));
  const hist = (days) => days.map((d) => ({ score: 100, date: at(d, 12) }));
  assert.ok(quest("triple-header").check({ finished: true, finishedAt: at(20, 12), history: hist([20, 20, 20]) }));
  assert.ok(!quest("triple-header").check({ finished: true, finishedAt: at(20, 12), history: hist([20, 20, 19]) }));
  assert.ok(quest("hot-streak").check({ finished: true, finishedAt: at(1, 12), history: hist([1, 0, -1]) }),
    "crosses a month boundary (Nov 1, Oct 31, Oct 30)");
  assert.ok(!quest("hot-streak").check({ finished: true, finishedAt: at(20, 12), history: hist([20, 18, 17]) }));
});

test("completed quests are not reported again", () => {
  /**
   * newlyCompleted skips quests that are already done.
   */
  const c = ctx([{ cat: "chance", dice: [6, 6, 6, 6, 6] }]);
  assert.ok(newlyCompleted(c, {}).includes("perfect-chance"));
  assert.ok(!newlyCompleted(c, { "perfect-chance": 1 }).includes("perfect-chance"));
});
