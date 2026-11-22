/* Quest progress storage, celebrations and the quest list dialog.
 *  - Visible quests: a short toast at the bottom.
 *  - Hidden quests: a card pops up showing the name and icon, then flips over
 *    to reveal the condition.
 * Celebrations play one after another; award() resolves when all are done. */
(function () {
  "use strict";
  const KEY = "dice-poker-quests";
  const { QUESTS, CATEGORIES } = Quests;
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

  /* ---------- Celebrations ---------- */

  function open(el) {
    if (el.showPopover) el.showPopover(); else el.classList.add("open");
  }
  function close(el) {
    if (el.hidePopover) { try { el.hidePopover(); } catch (e) {} } else el.classList.remove("open");
  }

  async function toast(q) {
    const el = $("quest-toast");
    $("toast-icon").textContent = q.icon;
    $("toast-name").textContent = q.name;
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
    $("card-name").textContent = q.name;
    $("card-back-name").textContent = q.name;
    $("card-text").textContent = q.text;
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
    const now = Date.now();
    ids.forEach((id) => { d[id] = now; });
    save(d);
    renderBadge();
    ids.forEach((id) => {
      const q = byId[id];
      queue = queue.then(() => {
        Sound.quest(q.cat === "hidden");
        return q.cat === "hidden" ? card(q) : toast(q);
      });
    });
    return queue;
  }

  /* ---------- Quest list ---------- */

  function renderBadge() {
    const n = Object.keys(done()).filter((id) => id in byId).length;
    $("quest-count").textContent = `${n}/${QUESTS.length}`;
    $("quests-btn").setAttribute("aria-label", `Quests: ${n} of ${QUESTS.length} complete`);
  }

  function tile(q, when) {
    const li = document.createElement("li");
    const hiddenLocked = q.cat === "hidden" && !when;
    li.className = "quest" + (when ? " done" : "") + (hiddenLocked ? " locked" : "");
    const icon = document.createElement("span");
    icon.className = "q-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = hiddenLocked ? "?" : q.icon;
    const body = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = hiddenLocked ? "Hidden quest" : q.name;
    const text = document.createElement("p");
    text.textContent = hiddenLocked ? "Keep playing to discover it." : q.text;
    body.append(name, text);
    if (when) {
      const t = document.createElement("time");
      t.dateTime = new Date(when).toISOString();
      t.textContent = "✓ " + new Date(when).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
      body.append(t);
    }
    li.append(icon, body);
    return li;
  }

  function renderList() {
    const d = done();
    const total = Object.keys(d).filter((id) => id in byId).length;
    $("quests-summary").textContent = `${total} of ${QUESTS.length} complete`;
    $("quests-list").replaceChildren(...CATEGORIES.map((cat) => {
      const qs = QUESTS.filter((q) => q.cat === cat.id);
      const n = qs.filter((q) => q.id in d).length;
      const sec = document.createElement("section");
      const h = document.createElement("h3");
      h.textContent = cat.label;
      const c = document.createElement("span");
      c.className = "q-count";
      c.textContent = cat.id === "hidden" ? `${n} of ${qs.length} found` : `${n}/${qs.length}`;
      h.append(c);
      const ul = document.createElement("ul");
      ul.className = "quests" + (cat.id === "perfect" ? " compact" : "");
      // Done quests first within each group, then in definition order.
      ul.append(...[...qs].sort((a, b) => (b.id in d) - (a.id in d)).map((q) => tile(q, d[q.id])));
      sec.append(h, ul);
      return sec;
    }));
  }

  $("quests-btn").addEventListener("click", () => { renderList(); $("quests-dlg").showModal(); });
  $("quests-close").addEventListener("click", () => $("quests-dlg").close());
  // Click on the backdrop closes the dialog.
  $("quests-dlg").addEventListener("click", (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });
  renderBadge();

  window.QuestUI = { award, done };
})();
