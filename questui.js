/* Quest progress storage, celebrations and the quest list dialog.
 *  - Visible quests: a short toast at the bottom.
 *  - Hidden quests: a card pops up showing the name and icon, then flips over
 *    to reveal the condition.
 * Celebrations play one after another; award() resolves when all are done.
 * Unlocking a mode (see Quests.MODES) is announced with a toast as well.
 * It also keeps the count of finished games that Career quests need. */
(function () {
  "use strict";
  const KEY = "dice-poker-quests";
  const PLAYED_KEY = "dice-poker-played";
  const HISTORY_KEY = "dice-poker-history";
  const { QUESTS, CATEGORIES, MODES } = Quests;
  const { t, questName, questText } = I18n;
  const byId = Object.fromEntries(QUESTS.map((q) => [q.id, q]));
  const $ = (id) => document.getElementById(id);
  const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function done() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      return d && typeof d === "object" && !Array.isArray(d) ? d : {};
    } catch (e) { return {}; }
  }

  function save(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
  }

  /** Number of completed quests that still exist. */
  function countCompleted(d = done()) {
    return Object.keys(d).filter((id) => id in byId).length;
  }

  /** Finished games in all modes. Before v1.10.0 nothing counted them, so the
   *  first read starts from the games in the history (at most 10 per mode). */
  function getPlayedCount() {
    try {
      const n = +localStorage.getItem(PLAYED_KEY);
      if (localStorage.getItem(PLAYED_KEY) !== null && Number.isInteger(n) && n >= 0) return n;
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY));
      return Array.isArray(h) ? h.length : 0;
    } catch (e) { return 0; }
  }

  /** Count one more finished game and return the new total. */
  function recordFinishedGame() {
    const n = getPlayedCount() + 1;
    try { localStorage.setItem(PLAYED_KEY, String(n)); } catch (e) {}
    return n;
  }

  /* ---------- Celebrations ---------- */

  function open(el) {
    if (el.showPopover) el.showPopover(); else el.classList.add("open");
  }
  function close(el) {
    if (el.hidePopover) { try { el.hidePopover(); } catch (e) {} } else el.classList.remove("open");
  }

  async function toast(icon, label, name) {
    const el = $("quest-toast");
    $("toast-icon").textContent = icon;
    $("toast-label").textContent = label;
    $("toast-name").textContent = name;
    open(el);
    el.classList.remove("leaving");
    await wait(2600);
    el.classList.add("leaving");
    await wait(reduceMotion() ? 0 : 250);
    close(el);
  }

  function card(q) {
    const el = $("quest-card");
    $("card-icon").textContent = q.icon;
    $("card-name").textContent = questName(q);
    $("card-back-name").textContent = questName(q);
    $("card-text").textContent = questText(q);
    el.classList.remove("flipped");
    open(el);
    return new Promise((resolve) => {
      let finished = false;
      const flip = setTimeout(() => el.classList.add("flipped"), 1800);
      const auto = setTimeout(end, 7000);
      function end() {
        if (finished) return;
        finished = true;
        clearTimeout(flip); clearTimeout(auto);
        el.removeEventListener("click", onClick);
        close(el);
        resolve();
      }
      // First tap flips early, second tap closes.
      function onClick() {
        if (el.classList.contains("flipped")) end();
        else { clearTimeout(flip); el.classList.add("flipped"); }
      }
      el.addEventListener("click", onClick);
    });
  }

  let queue = Promise.resolve();

  /** Mark quests as done and celebrate them. Resolves after all celebrations. */
  function award(ids) {
    if (!ids.length) return queue;
    const d = done();
    const before = countCompleted(d);
    const now = Date.now();
    ids.forEach((id) => { d[id] = now; });
    save(d);
    renderBadge();
    ids.forEach((id) => {
      const q = byId[id];
      queue = queue.then(() => {
        Sound.quest(q.cat === "hidden");
        return q.cat === "hidden" ? card(q) : toast(q.icon, t("toast.done"), questName(q));
      });
    });
    const after = countCompleted(d);
    MODES.filter((m) => m.unlockAt > before && m.unlockAt <= after).forEach((m) => {
      queue = queue.then(() => {
        Sound.quest(true);
        return toast("🔓", t("toast.mode"), t("mode." + m.id));
      });
    });
    return queue;
  }

  /* ---------- Quest list ---------- */

  function renderBadge() {
    const n = countCompleted();
    $("quest-count").textContent = `${n}/${QUESTS.length}`;
    $("quests-btn").setAttribute("aria-label", t("quests.badge", { n, total: QUESTS.length }));
  }

  function tile(q, when, games) {
    const li = document.createElement("li");
    const hiddenLocked = q.cat === "hidden" && !when;
    li.className = "quest" + (when ? " done" : "") + (hiddenLocked ? " locked" : "");
    const icon = document.createElement("span");
    icon.className = "q-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = hiddenLocked ? "?" : q.icon;
    const body = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = hiddenLocked ? t("quest.locked") : questName(q);
    const text = document.createElement("p");
    text.textContent = hiddenLocked ? t("quest.lockedText") : questText(q);
    body.append(name, text);
    if (q.goal && !when) {
      const progress = document.createElement("small");
      progress.className = "q-progress";
      progress.textContent = `${Math.min(games, q.goal)}/${q.goal}`;
      body.append(progress);
    }
    if (when) {
      const time = document.createElement("time");
      time.dateTime = new Date(when).toISOString();
      time.textContent = "✓ " + new Date(when).toLocaleDateString(I18n.lang, { month: "short", day: "numeric", year: "numeric" });
      body.append(time);
    }
    li.append(icon, body);
    return li;
  }

  function renderList() {
    const d = done();
    const total = countCompleted(d);
    const games = getPlayedCount();
    $("quests-summary").textContent = t("quests.summary", { n: total, total: QUESTS.length });
    $("quests-list").replaceChildren(...CATEGORIES.map((cat) => {
      const qs = QUESTS.filter((q) => q.cat === cat.id);
      const n = qs.filter((q) => q.id in d).length;
      const sec = document.createElement("section");
      const h = document.createElement("h3");
      h.textContent = t("questcat." + cat.id);
      const c = document.createElement("span");
      c.className = "q-count";
      c.textContent = cat.id === "hidden" ? t("quests.found", { n, total: qs.length }) : `${n}/${qs.length}`;
      h.append(c);
      sec.append(h);
      // A mode's own group says how it unlocks, or that only it (and the
      // groups for every mode) counts there.
      const mode = cat.mode && cat.mode !== "classic" && MODES.find((m) => m.id === cat.mode);
      if (mode) {
        const note = document.createElement("p");
        note.className = "q-note";
        note.textContent = total >= mode.unlockAt ? t("quests.modeNote", { mode: t("mode." + mode.id) })
          : t("quests.modeLocked", { mode: t("mode." + mode.id), goal: mode.unlockAt, n: total });
        sec.append(note);
      }
      const ul = document.createElement("ul");
      ul.className = "quests" + (cat.id === "perfect" ? " compact" : "");
      // Done quests first within each group, then in definition order.
      ul.append(...[...qs].sort((a, b) => (b.id in d) - (a.id in d)).map((q) => tile(q, d[q.id], games)));
      sec.append(ul);
      return sec;
    }));
  }

  $("quests-btn").addEventListener("click", () => { renderList(); $("quests-dlg").showModal(); });
  $("quests-close").addEventListener("click", () => $("quests-dlg").close());
  // Click on the backdrop closes the dialog.
  $("quests-dlg").addEventListener("click", (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });
  renderBadge();

  window.QuestUI = { award, done, countCompleted, getPlayedCount, recordFinishedGame };
})();
