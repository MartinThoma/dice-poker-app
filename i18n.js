/* Translations: picks the UI language from the browser's language settings
 * and looks up strings from locales/<lang>.js (loaded before this file).
 *
 *   I18n.t(key, params)  the string for `key` with {placeholders} filled in.
 *                        Plural entries are selected by params.n.
 *   I18n.lang            the chosen language code ("en", "de", …).
 *
 * Missing keys fall back to English, then to the key itself, so a gap in a
 * translation never breaks the game. Static text in index.html is marked with
 * data-i18n="key" (textContent) and data-i18n-aria-label="key". */
(function (root) {
  "use strict";
  const node = typeof module !== "undefined" && module.exports;
  const SUPPORTED = ["en", "de", "fr", "es", "id"];
  const LOCALES = node ? Object.fromEntries(SUPPORTED.map((l) => [l, require(`./locales/${l}.js`)])) : root.LOCALES;

  /** First supported language in a browser language list, else English. */
  function detect(languages) {
    for (const tag of languages || []) {
      let primary = String(tag).toLowerCase().split(/[-_]/)[0];
      if (primary === "in") primary = "id"; // legacy code for Indonesian
      if (SUPPORTED.includes(primary)) return primary;
    }
    return "en";
  }

  /** A translator for one language: {lang, t, questName, questText}. */
  function forLang(lang) {
    const dict = LOCALES[lang] || LOCALES.en;
    const plural = new Intl.PluralRules(lang);
    function t(key, params = {}) {
      let msg = key in dict ? dict[key] : key in LOCALES.en ? LOCALES.en[key] : key;
      if (typeof msg === "object") msg = msg[plural.select(params.n)] || msg.other;
      return msg.replace(/\{(\w+)\}/g, (all, name) => (name in params ? String(params[name]) : all));
    }
    // Perfection quests share one template per language, filled with the box name.
    const questName = (q) => q.box ? t("quest.perfect.name", { cat: t("cat." + q.box) }) : t(`quest.${q.id}.name`);
    const questText = (q) => q.box ? t("quest.perfect.text", { cat: t("cat." + q.box), max: q.max })
      : t(`quest.${q.id}.text`);
    return { lang, t, questName, questText };
  }

  const api = { SUPPORTED, LOCALES, detect, forLang };

  if (node) {
    module.exports = api;
    return;
  }

  const current = forLang(detect(navigator.languages && navigator.languages.length
    ? navigator.languages : [navigator.language]));
  Object.assign(api, current);

  /** Translate the static text marked up in index.html. */
  api.apply = function () {
    document.documentElement.lang = current.lang;
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = current.t(el.dataset.i18n); });
    document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
      el.setAttribute("aria-label", current.t(el.dataset.i18nAriaLabel));
    });
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.content = current.t("meta.description");
  };
  api.apply();
  root.I18n = api;
})(typeof window !== "undefined" ? window : globalThis);
