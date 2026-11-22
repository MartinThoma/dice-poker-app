// Unit tests for the translations in i18n.js and locales/*.js. Run with `make test`.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const S = require("../scoring.js");
const { QUESTS, CATEGORIES } = require("../quests.js");
const I18n = require("../i18n.js");

const EN = I18n.LOCALES.en;
const OTHERS = I18n.SUPPORTED.filter((l) => l !== "en");

/** Placeholder names used by a message (a string or a plural object). */
function placeholders(msg) {
  const texts = typeof msg === "object" ? Object.values(msg) : [msg];
  return [...new Set(texts.flatMap((s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1])))].sort();
}

test("every language defines exactly the English keys", () => {
  /**
   * Every language defines every UI string that English defines, and no extra ones.
   *
   * A missing key would silently show English; an extra one is usually a typo.
   */
  for (const lang of OTHERS) {
    const keys = Object.keys(I18n.LOCALES[lang]);
    assert.deepStrictEqual(Object.keys(EN).filter((k) => !keys.includes(k)), [], `${lang} is missing keys`);
    assert.deepStrictEqual(keys.filter((k) => !(k in EN)), [], `${lang} has unknown keys`);
  }
});

test("translations use the same placeholders as English", () => {
  /**
   * Every translated string fills in the same {placeholders} as its English original.
   *
   * A language may turn a plain string into a plural object, as long as the
   * plural variants still use the same placeholders.
   */
  for (const lang of OTHERS) {
    for (const [key, msg] of Object.entries(I18n.LOCALES[lang])) {
      assert.deepStrictEqual(placeholders(msg), placeholders(EN[key]), `${lang} ${key}`);
    }
  }
});

test("plural entries are well formed", () => {
  /**
   * Plural entries always have an "other" form and only use valid plural categories.
   *
   * Plural objects are selected by {n}, so the "other" form must show {n}. A
   * singular form may spell it out instead ("your past game").
   */
  const valid = ["zero", "one", "two", "few", "many", "other"];
  for (const lang of I18n.SUPPORTED) {
    for (const [key, msg] of Object.entries(I18n.LOCALES[lang])) {
      if (typeof msg === "string") continue;
      assert.ok(typeof msg.other === "string", `${lang} ${key} needs "other"`);
      assert.ok(msg.other.includes("{n}"), `${lang} ${key}.other must use {n}`);
      for (const cat of Object.keys(msg)) assert.ok(valid.includes(cat), `${lang} ${key}: ${cat}`);
    }
  }
});

test("every box, quest and quest group has text in every language", () => {
  /**
   * Scorecard boxes, quests and quest groups all resolve to real text in every language.
   *
   * A lookup that falls through returns the key itself, which must never happen.
   */
  for (const lang of I18n.SUPPORTED) {
    const { t, questName, questText } = I18n.forLang(lang);
    const dict = I18n.LOCALES[lang];
    for (const c of [...S.UPPER, ...S.LOWER]) assert.ok(dict["cat." + c.id], `${lang} cat.${c.id}`);
    for (const c of S.LOWER) assert.ok(dict["hint." + c.id], `${lang} hint.${c.id}`);
    for (const c of CATEGORIES) assert.ok(dict["questcat." + c.id], `${lang} questcat.${c.id}`);
    for (const q of QUESTS) {
      for (const s of [questName(q), questText(q)]) {
        assert.ok(s && !s.startsWith("quest.") && !/\{\w+\}/.test(s), `${lang} ${q.id}: ${s}`);
      }
    }
    assert.notStrictEqual(t("row.total"), "row.total");
  }
});

test("no translation uses a trademarked game name", () => {
  /**
   * No language names a trademarked dice game.
   *
   * PRODUCT.md requires generic names only, in every language.
   */
  const banned = /yahtzee|yatzy|kniffel|yam'?s|generala/i;
  for (const lang of I18n.SUPPORTED) {
    for (const [key, msg] of Object.entries(I18n.LOCALES[lang])) {
      assert.ok(!banned.test(JSON.stringify(msg)), `${lang} ${key}`);
    }
  }
});

test("the language follows the browser's language list", () => {
  /**
   * The first supported browser language wins; anything else falls back to English.
   *
   * Region subtags are ignored and the legacy Indonesian code "in" maps to "id".
   */
  assert.strictEqual(I18n.detect(["de-AT", "en-US"]), "de");
  assert.strictEqual(I18n.detect(["pt-BR", "fr-CA"]), "fr");
  assert.strictEqual(I18n.detect(["ES"]), "es");
  assert.strictEqual(I18n.detect(["in-ID"]), "id");
  assert.strictEqual(I18n.detect(["id"]), "id");
  assert.strictEqual(I18n.detect(["pt-BR", "ja"]), "en");
  assert.strictEqual(I18n.detect([]), "en");
  assert.strictEqual(I18n.detect(undefined), "en");
});

test("messages fill placeholders and pick plural forms", () => {
  /**
   * t() fills in parameters, selects plural forms by n and falls back to English, then to the key.
   */
  const en = I18n.forLang("en");
  assert.strictEqual(en.t("end.scored", { n: 1 }), "You scored 1 point.");
  assert.strictEqual(en.t("end.scored", { n: 212 }), "You scored 212 points.");
  assert.strictEqual(en.t("rank.leading", { n: 1, total: 90 }), "Leading with 90! Ahead of your past game.");
  const fr = I18n.forLang("fr");
  assert.strictEqual(fr.t("roll.again", { n: 1 }), "Relancer (1 restant)");
  assert.strictEqual(fr.t("roll.again", { n: 2 }), "Relancer (2 restants)");
  const id = I18n.forLang("id");
  assert.strictEqual(id.t("end.scored", { n: 1 }), "Skormu 1 poin.");
  assert.strictEqual(I18n.forLang("xx").t("row.total"), "Total", "unknown language falls back to English");
  assert.strictEqual(en.t("no.such.key"), "no.such.key");
});
