(function () {
  "use strict";
  const { UPPER, LOWER, UPPER_BONUS_THRESHOLD, UPPER_BONUS, score, totals } = Scoring;
  const { t } = I18n;
  const label = (cat) => t("cat." + cat.id);
  const ALL = [...UPPER, ...LOWER];
  const MAX_ROLLS = 3;
  const BEST_KEY = "dice-poker-best";
  const HISTORY_KEY = "dice-poker-history";
  const HISTORY_MAX = 10;
  const CURRENT_KEY = "dice-poker-current";
  // Bump when the saved shape changes. loadSaved() still accepts format 1 (v1.2.0).
  const SAVE_FORMAT = 2;

  const PIPS = {
    1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9],
  };

  const $ = (id) => document.getElementById(id);
  const diceEl = $("dice"), rollBtn = $("roll"), statusEl = $("status");
  const cardEl = $("scorecard"), endDlg = $("end");

  let state;

  const freshState = () => ({ dice: [1, 1, 1, 1, 1], held: [false, false, false, false, false],
    rollsLeft: MAX_ROLLS, scores: {}, pokerBonuses: 0, rolling: false,
    // Quest tracking: scored turns, which dice each roll of this turn rolled
    // (null = unknown, e.g. after restoring an older save) and when play began.
    log: [], rolls: [], startedAt: null });

  function newGame() {
    state = freshState();
    clearSaved();
    render();
  }

  /* ---------- Game in progress survives reloads ---------- */

  function persist(s) {
    const { dice, held, rollsLeft, scores, pokerBonuses, log, rolls, startedAt } = s || state;
    try {
      localStorage.setItem(CURRENT_KEY, JSON.stringify(
        { v: SAVE_FORMAT, dice, held, rollsLeft, scores, pokerBonuses, log, rolls, startedAt }));
    } catch (e) {}
  }

  function clearSaved() {
    try { localStorage.removeItem(CURRENT_KEY); } catch (e) {}
  }

  const isInt = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;
  const isDice = (d) => Array.isArray(d) && d.length === 5 && d.every((x) => isInt(x, 1, 6));
  const isMask = (m) => Array.isArray(m) && m.length === 5 && m.every((x) => typeof x === "boolean");
  const isCat = (k) => ALL.some((c) => c.id === k);

  /** The saved game, or null if there is none or it is invalid. */
  function loadSaved() {
    let s;
    try { s = JSON.parse(localStorage.getItem(CURRENT_KEY)); } catch (e) { return null; }
    const ok = s && (s.v === 1 || s.v === SAVE_FORMAT) && isDice(s.dice) && isMask(s.held) &&
      isInt(s.rollsLeft, 0, MAX_ROLLS) && isInt(s.pokerBonuses, 0, ALL.length) &&
      s.scores && typeof s.scores === "object" &&
      Object.entries(s.scores).every(([k, v]) => isCat(k) && isInt(v, 0, 50)) &&
      Object.keys(s.scores).length < ALL.length;
    if (!ok) return null;
    // Quest tracking is optional: format 1 saves (v1.2.0) have none, and a bad
    // value only costs quest progress for this game, never the game itself.
    const rollsUsed = MAX_ROLLS - s.rollsLeft;
    const log = Array.isArray(s.log) && s.log.every((t) => t && isInt(t.turn, 1, ALL.length) &&
      isCat(t.cat) && isInt(t.score, 0, 50) && isDice(t.dice) &&
      (t.rolls === null || (Array.isArray(t.rolls) && t.rolls.length <= MAX_ROLLS && t.rolls.every(isMask))))
      ? s.log : [];
    const rolls = Array.isArray(s.rolls) && s.rolls.length === rollsUsed && s.rolls.every(isMask) ? s.rolls : null;
    const startedAt = Number.isFinite(s.startedAt) ? s.startedAt : null;
    return { dice: s.dice, held: s.rollsLeft === MAX_ROLLS ? s.held.map(() => false) : s.held,
      rollsLeft: s.rollsLeft, scores: s.scores, pokerBonuses: s.pokerBonuses, rolling: false,
      log, rolls: rollsUsed === 0 ? [] : rolls, startedAt };
  }

  const rollDie = () => 1 + Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296 * 6);
  const hasRolled = () => state.rollsLeft < MAX_ROLLS;
  const round = () => Object.keys(state.scores).length + 1;

  function roll() {
    if (state.rollsLeft === 0 || state.rolling) return;
    state.rollsLeft--;
    state.rolling = true;
    if (state.startedAt === null && !Object.keys(state.scores).length) state.startedAt = Date.now();
    if (state.rolls) state.rolls = [...state.rolls, state.held.map((h) => !h)];
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rolled = state.dice.map((d, i) => (state.held[i] ? d : rollDie()));
    // Save the result now, not after the animation, so reloading mid-roll can't undo it.
    persist({ ...state, dice: rolled });
    Sound.roll(state.held.filter((h) => !h).length);
    state.dice.forEach((_, i) => { if (!state.held[i]) diceEl.children[i].classList.add("rolling"); });
    setTimeout(() => {
      state.dice = rolled;
      state.rolling = false;
      render();
    }, reduce ? 0 : 450);
    renderControls();
  }

  function toggleHold(i) {
    if (!hasRolled() || state.rolling || state.rollsLeft === MAX_ROLLS) return;
    state.held[i] = !state.held[i];
    Sound.hold(state.held[i]);
    persist();
    render();
  }

  function isPoker() { return new Set(state.dice).size === 1; }

  function choose(id) {
    if (!hasRolled() || state.rolling || id in state.scores) return;
    // Extra five-of-a-kind bonus once a 50 has been banked.
    if (isPoker() && state.scores.poker === 50) state.pokerBonuses++;
    state.scores[id] = score(id, state.dice);
    state.log.push({ turn: Object.keys(state.scores).length, cat: id, score: state.scores[id],
      dice: [...state.dice], rolls: state.rolls });
    if (state.scores[id] > 0) Sound.score(state.scores[id]);
    else Sound.scratch();
    state.held = state.held.map(() => false);
    state.rollsLeft = MAX_ROLLS;
    state.rolls = [];
    if (Object.keys(state.scores).length === ALL.length) return finish();
    persist();
    render();
    QuestUI.award(Quests.newlyCompleted(questContext(false), QuestUI.done()));
  }

  function questContext(finished) {
    const tot = totals(state.scores, state.pokerBonuses);
    return { log: state.log, turn: state.log[state.log.length - 1], scores: state.scores,
      upperSum: tot.upperSum, finished, total: tot.total, startedAt: state.startedAt,
      finishedAt: finished ? Date.now() : null, history: loadHistory() };
  }

  function loadHistory() {
    try {
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY));
      return Array.isArray(h) ? h.filter((g) => Number.isFinite(g.score)).slice(0, HISTORY_MAX) : [];
    } catch (e) { return []; }
  }

  function saveGame(total) {
    const h = [{ score: total, date: Date.now() }, ...loadHistory()].slice(0, HISTORY_MAX);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch (e) {}
  }

  function bestScore() {
    try { return +localStorage.getItem(BEST_KEY) || 0; } catch (e) { return 0; }
  }

  function finish() {
    // The game is recorded in the history below; drop the save so a reload
    // on the game-over dialog can't record it twice.
    clearSaved();
    const { total } = totals(state.scores, state.pokerBonuses);
    const best = bestScore();
    const record = total > best;
    if (record) { try { localStorage.setItem(BEST_KEY, total); } catch (e) {} }
    $("final").textContent = t("end.scored", { n: total }) + " " + (record ? t("end.newBest") : t("end.best", { best }));
    saveGame(total);
    render();
    // Quest cards play first; the game-over dialog follows once they are done.
    QuestUI.award(Quests.newlyCompleted(questContext(true), QuestUI.done()))
      .then(() => endDlg.showModal());
  }

  function renderSub() {
    $("sub").textContent = t("sub", { round: Math.min(round(), 13), best: bestScore() || "–" });
  }

  function renderDice() {
    diceEl.replaceChildren(...state.dice.map((v, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "die" + (state.held[i] ? " held" : "");
      b.setAttribute("aria-pressed", state.held[i]);
      b.setAttribute("aria-label", t(state.held[i] ? "die.labelHeld" : "die.label", { i: i + 1, v }));
      b.disabled = !hasRolled();
      if (!hasRolled()) b.classList.add("blank");
      for (let p = 1; p <= 9; p++) {
        const s = document.createElement("span");
        if (hasRolled() && PIPS[v].includes(p)) s.className = "pip";
        b.append(s);
      }
      b.addEventListener("click", () => toggleHold(i));
      return b;
    }));
  }

  function renderControls() {
    rollBtn.disabled = state.rollsLeft === 0 || state.rolling;
    rollBtn.textContent = state.rollsLeft === MAX_ROLLS ? t("roll.first") : t("roll.again", { n: state.rollsLeft });
    statusEl.textContent = t(!hasRolled() ? "status.start" : state.rollsLeft === 0 ? "status.noRolls" : "status.choose");
    renderSub();
  }

  function row(cat) {
    const tr = document.createElement("tr");
    const taken = cat.id in state.scores;
    const th = document.createElement("th");
    th.scope = "row";
    th.textContent = label(cat);
    const h = document.createElement("small");
    h.textContent = cat.face ? t("hint.upper", { face: cat.face }) : t("hint." + cat.id);
    th.append(h);
    const td = document.createElement("td");
    if (taken) {
      td.textContent = state.scores[cat.id];
      tr.className = "taken";
    } else if (hasRolled() && !state.rolling) {
      const btn = document.createElement("button");
      btn.type = "button";
      const pts = score(cat.id, state.dice);
      btn.textContent = pts;
      btn.className = "option" + (pts === 0 ? " zero" : "");
      btn.setAttribute("aria-label", t("option.label", { pts, cat: label(cat) }));
      btn.addEventListener("click", () => choose(cat.id));
      td.append(btn);
    }
    tr.append(th, td);
    return tr;
  }

  function sumRow(label, value, cls) {
    const tr = document.createElement("tr");
    tr.className = "sum " + (cls || "");
    const th = document.createElement("th"); th.scope = "row"; th.textContent = label;
    const td = document.createElement("td"); td.textContent = value;
    tr.append(th, td);
    return tr;
  }

  function renderCard() {
    const tot = totals(state.scores, state.pokerBonuses);
    const body = document.createElement("tbody");
    body.append(
      ...UPPER.map(row),
      sumRow(t("row.bonus", { threshold: UPPER_BONUS_THRESHOLD, bonus: UPPER_BONUS }),
        `${tot.upperSum}/${UPPER_BONUS_THRESHOLD}` + (tot.bonus ? ` +${tot.bonus}` : "")),
      ...LOWER.map(row),
    );
    if (state.pokerBonuses) body.append(sumRow(t("row.extra"), `+${tot.extra}`));
    body.append(sumRow(t("row.total"), tot.total, "grand"));
    cardEl.replaceChildren(body);
  }

  const GAUGE_PX = 300; // keep in sync with .gauge height in style.css
  const LABEL_GAP = 15;  // minimum px between gauge labels
  let lastRank = null;

  function renderAside() {
    const { total } = totals(state.scores, state.pokerBonuses);
    const live = Object.keys(state.scores).length < ALL.length;
    const hist = loadHistory();
    const rank = 1 + hist.filter((g) => g.score > total).length;
    const scale = Math.max(200, Math.ceil(Math.max(total, ...hist.map((g) => g.score)) / 50) * 50);
    const pct = (n) => Math.min(100, (n / scale) * 100);

    const update = () => {
      const gauge = $("gauge");
      gauge.style.setProperty("--fill", pct(total) / 100);
      gauge.setAttribute("aria-valuemax", scale);
      gauge.setAttribute("aria-valuenow", total);
      gauge.setAttribute("aria-valuetext", t("gauge.value", { total, rank, count: hist.length + 1 }));
      renderMarks(hist, total, live, pct);
      renderBoard(hist, total, live, rank);
      $("rank").textContent = !hist.length ? t("rank.empty")
        : live ? (rank === 1 && total > 0 ? t("rank.leading", { total, n: hist.length })
          : t("rank.now", { rank, count: hist.length + 1, total }))
        : t("rank.placed", { rank: 1 + hist.slice(1).filter((g) => g.score > hist[0].score).length });
    };

    // Animate rows swapping places when the live score overtakes a past game.
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (document.startViewTransition && !reduce && lastRank !== null && rank !== lastRank && live) {
      document.startViewTransition(update);
    } else update();
    lastRank = live ? rank : null;
  }

  function renderMarks(hist, total, live, pct) {
    // Past games as ticks on the gauge, labels nudged apart so they don't overlap.
    const items = hist.map((g, i) => ({ score: g.score, label: String(g.score), cls: i === 0 && !live ? "latest" : "" }));
    if (live) items.push({ score: total, label: t("gauge.you", { total }), cls: "you" });
    items.sort((a, b) => a.score - b.score);
    let prev = -Infinity;
    $("marks").replaceChildren(...items.map((it) => {
      const y = (pct(it.score) / 100) * GAUGE_PX;
      const labelY = Math.max(y, prev + LABEL_GAP);
      prev = labelY;
      const m = document.createElement("span");
      m.className = "mark " + it.cls;
      m.style.setProperty("--y", y + "px");
      m.style.setProperty("--ly", labelY + "px");
      const lbl = document.createElement("span");
      lbl.className = "label";
      lbl.textContent = it.label;
      m.append(lbl);
      return m;
    }));
  }

  function renderBoard(hist, total, live, rank) {
    const rows = hist.map((g, i) => ({ score: g.score, date: g.date, id: "g" + g.date + "-" + i, latest: i === 0 && !live }));
    rows.sort((a, b) => b.score - a.score);
    if (live) rows.splice(rank - 1, 0, { score: total, id: "live", you: true });
    const fmt = (d) => new Date(d).toLocaleDateString(I18n.lang, { month: "short", day: "numeric" });
    $("leaderboard").replaceChildren(...rows.map((r, i) => {
      const li = document.createElement("li");
      li.className = (r.you ? "you" : "") + (r.latest ? " latest" : "");
      li.style.viewTransitionName = "lb-" + r.id.replace(/[^\w-]/g, "");
      const pos = document.createElement("span");
      pos.className = "pos";
      pos.textContent = i + 1;
      const who = document.createElement("span");
      who.className = "who";
      who.textContent = r.you ? t("lb.you") : r.latest ? t("lb.justNow") : fmt(r.date);
      const sc = document.createElement("strong");
      sc.textContent = r.score;
      li.append(pos, who, sc);
      return li;
    }));
  }

  function render() {
    renderAside();
    renderDice();
    renderControls();
    renderCard();
  }

  const soundBtn = $("sound");
  function renderSound() {
    const on = Sound.enabled;
    soundBtn.setAttribute("aria-pressed", on);
    soundBtn.setAttribute("aria-label", t(on ? "sound.on" : "sound.off"));
    soundBtn.title = t(on ? "sound.onTitle" : "sound.offTitle");
  }
  soundBtn.addEventListener("click", () => {
    Sound.setEnabled(!Sound.enabled);
    renderSound();
    Sound.hold(true); // audible confirmation when turning sound on
  });
  renderSound();

  rollBtn.addEventListener("click", roll);
  endDlg.addEventListener("close", newGame);
  state = loadSaved() || freshState();
  render();
})();
