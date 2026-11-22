(function () {
  "use strict";
  const { UPPER, LOWER, UPPER_BONUS_THRESHOLD, UPPER_BONUS, score, totals } = Scoring;
  const ALL = [...UPPER, ...LOWER];
  const MAX_ROLLS = 3;
  const BEST_KEY = "dice-poker-best";
  const HISTORY_KEY = "dice-poker-history";
  const HISTORY_MAX = 10;
  const CURRENT_KEY = "dice-poker-current";
  // Bump when the saved shape changes; older saves are then discarded.
  const SAVE_FORMAT = 1;

  const PIPS = {
    1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9],
  };

  const $ = (id) => document.getElementById(id);
  const diceEl = $("dice"), rollBtn = $("roll"), statusEl = $("status");
  const cardEl = $("scorecard"), endDlg = $("end");

  let state;

  const freshState = () => ({ dice: [1, 1, 1, 1, 1], held: [false, false, false, false, false],
    rollsLeft: MAX_ROLLS, scores: {}, pokerBonuses: 0, rolling: false });

  function newGame() {
    state = freshState();
    clearSaved();
    render();
  }

  /* ---------- Game in progress survives reloads ---------- */

  function persist(s) {
    const { dice, held, rollsLeft, scores, pokerBonuses } = s || state;
    try {
      localStorage.setItem(CURRENT_KEY, JSON.stringify({ v: SAVE_FORMAT, dice, held, rollsLeft, scores, pokerBonuses }));
    } catch (e) {}
  }

  function clearSaved() {
    try { localStorage.removeItem(CURRENT_KEY); } catch (e) {}
  }

  /** The saved game, or null if there is none or it is invalid. */
  function loadSaved() {
    let s;
    try { s = JSON.parse(localStorage.getItem(CURRENT_KEY)); } catch (e) { return null; }
    const isInt = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;
    const ok = s && s.v === SAVE_FORMAT &&
      Array.isArray(s.dice) && s.dice.length === 5 && s.dice.every((d) => isInt(d, 1, 6)) &&
      Array.isArray(s.held) && s.held.length === 5 && s.held.every((h) => typeof h === "boolean") &&
      isInt(s.rollsLeft, 0, MAX_ROLLS) && isInt(s.pokerBonuses, 0, ALL.length) &&
      s.scores && typeof s.scores === "object" &&
      Object.entries(s.scores).every(([k, v]) => ALL.some((c) => c.id === k) && isInt(v, 0, 50)) &&
      Object.keys(s.scores).length < ALL.length;
    if (!ok) return null;
    return { dice: s.dice, held: s.rollsLeft === MAX_ROLLS ? s.held.map(() => false) : s.held,
      rollsLeft: s.rollsLeft, scores: s.scores, pokerBonuses: s.pokerBonuses, rolling: false };
  }

  const rollDie = () => 1 + Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296 * 6);
  const hasRolled = () => state.rollsLeft < MAX_ROLLS;
  const round = () => Object.keys(state.scores).length + 1;

  function roll() {
    if (state.rollsLeft === 0 || state.rolling) return;
    state.rollsLeft--;
    state.rolling = true;
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
    if (state.scores[id] > 0) Sound.score(state.scores[id]);
    else Sound.scratch();
    state.held = state.held.map(() => false);
    state.rollsLeft = MAX_ROLLS;
    if (Object.keys(state.scores).length === ALL.length) return finish();
    persist();
    render();
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
    render();
    const { total } = totals(state.scores, state.pokerBonuses);
    let best = 0;
    try { best = +localStorage.getItem(BEST_KEY) || 0; } catch (e) {}
    const record = total > best;
    if (record) { try { localStorage.setItem(BEST_KEY, total); } catch (e) {} }
    $("final").textContent = `You scored ${total} points.` + (record ? " New best!" : ` Best: ${best}.`);
    saveGame(total);
    render();
    endDlg.showModal();
  }

  function renderBest() {
    let best = 0;
    try { best = +localStorage.getItem(BEST_KEY) || 0; } catch (e) {}
    $("best").textContent = best || "–";
  }

  function renderDice() {
    diceEl.replaceChildren(...state.dice.map((v, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "die" + (state.held[i] ? " held" : "");
      b.setAttribute("aria-pressed", state.held[i]);
      b.setAttribute("aria-label", `Die ${i + 1}: ${v}${state.held[i] ? ", held" : ""}`);
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
    rollBtn.textContent = state.rollsLeft === MAX_ROLLS ? "Roll dice" : `Roll again (${state.rollsLeft} left)`;
    statusEl.textContent = !hasRolled() ? "Roll to start your turn."
      : state.rollsLeft === 0 ? "No rolls left. Pick a category." : "Hold dice, roll again or score.";
    $("round").textContent = Math.min(round(), 13);
  }

  function row(cat, extraHint) {
    const tr = document.createElement("tr");
    const taken = cat.id in state.scores;
    const th = document.createElement("th");
    th.scope = "row";
    th.textContent = cat.label;
    if (cat.hint || extraHint) {
      const h = document.createElement("small");
      h.textContent = cat.hint || extraHint;
      th.append(h);
    }
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
      btn.setAttribute("aria-label", `Score ${pts} in ${cat.label}`);
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
    const t = totals(state.scores, state.pokerBonuses);
    const body = document.createElement("tbody");
    body.append(
      ...UPPER.map((c) => row(c, `Total of ${c.label.toLowerCase()}`)),
      sumRow(`Bonus (${UPPER_BONUS_THRESHOLD}+ upper = ${UPPER_BONUS})`,
        `${t.upperSum}/${UPPER_BONUS_THRESHOLD}` + (t.bonus ? ` +${t.bonus}` : "")),
      ...LOWER.map((c) => row(c)),
    );
    if (state.pokerBonuses) body.append(sumRow("Extra Dice Poker (+100 each)", `+${t.extra}`));
    body.append(sumRow("Total", t.total, "grand"));
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
      gauge.setAttribute("aria-valuetext", `${total} points, rank ${rank} of ${hist.length + 1}`);
      renderMarks(hist, total, live, pct);
      renderBoard(hist, total, live, rank);
      $("rank").textContent = !hist.length ? "Finish a game to start your leaderboard."
        : live ? (rank === 1 && total > 0 ? `Leading with ${total}! Ahead of all ${hist.length} past games.`
          : `Now #${rank} of ${hist.length + 1} with ${total} points.`)
        : `Game over: you placed #${1 + hist.slice(1).filter((g) => g.score > hist[0].score).length}.`;
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
    if (live) items.push({ score: total, label: "You " + total, cls: "you" });
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
      const t = document.createElement("span");
      t.className = "label";
      t.textContent = it.label;
      m.append(t);
      return m;
    }));
  }

  function renderBoard(hist, total, live, rank) {
    const rows = hist.map((g, i) => ({ score: g.score, date: g.date, id: "g" + g.date + "-" + i, latest: i === 0 && !live }));
    rows.sort((a, b) => b.score - a.score);
    if (live) rows.splice(rank - 1, 0, { score: total, id: "live", you: true });
    const fmt = (d) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    $("leaderboard").replaceChildren(...rows.map((r, i) => {
      const li = document.createElement("li");
      li.className = (r.you ? "you" : "") + (r.latest ? " latest" : "");
      li.style.viewTransitionName = "lb-" + r.id.replace(/[^\w-]/g, "");
      const pos = document.createElement("span");
      pos.className = "pos";
      pos.textContent = i + 1;
      const who = document.createElement("span");
      who.className = "who";
      who.textContent = r.you ? "You (live)" : r.latest ? "Just now" : fmt(r.date);
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
    renderBest();
  }

  const soundBtn = $("sound");
  function renderSound() {
    const on = Sound.enabled;
    soundBtn.setAttribute("aria-pressed", on);
    soundBtn.setAttribute("aria-label", on ? "Sound on" : "Sound off");
    soundBtn.title = on ? "Sound on: click to mute" : "Sound off: click to unmute";
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
