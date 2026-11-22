/* Optional sound effects, synthesized with the Web Audio API (no audio files,
 * so nothing to license and nothing extra to download or cache).
 * The on/off choice is stored per device; sound is on by default. */
(function () {
  "use strict";
  const KEY = "dice-poker-sound";
  let enabled = true;
  try { enabled = localStorage.getItem(KEY) !== "off"; } catch (e) {}

  let ctx = null, master = null, noise = null;

  // Created lazily inside a click handler so browsers allow playback.
  function audio() {
    if (!enabled) return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // 50 ms of white noise, reused for every dice click.
      noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function envelope(at, peak, decay) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    g.connect(master);
    return g;
  }

  function click(at, freq, peak) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = freq;
    bp.Q.value = 3;
    src.connect(bp).connect(envelope(at, peak, 0.04));
    src.start(at);
    src.stop(at + 0.05);
  }

  function tone(at, freq, dur, type, peak, glideTo) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, at + dur);
    o.connect(envelope(at, peak, dur));
    o.start(at);
    o.stop(at + dur + 0.02);
  }

  const Sound = {
    get enabled() { return enabled; },
    setEnabled(on) {
      enabled = on;
      try { localStorage.setItem(KEY, on ? "on" : "off"); } catch (e) {}
      if (!on && ctx) ctx.suspend();
    },

    /** Dice rattling in a cup and landing; `count` = number of dice rolled. */
    roll(count) {
      if (!audio()) return;
      const t = ctx.currentTime;
      const hits = 6 + count * 2;
      for (let i = 0; i < hits; i++) {
        click(t + Math.random() * 0.35, 1800 + Math.random() * 2600, 0.15 + Math.random() * 0.2);
      }
      // A thump per die landing on the felt.
      for (let i = 0; i < count; i++) {
        const at = t + 0.36 + i * 0.025 + Math.random() * 0.02;
        click(at, 500 + Math.random() * 300, 0.5);
      }
    },

    /** Short wooden tick: higher when holding, lower when releasing. */
    hold(on) {
      if (!audio()) return;
      tone(ctx.currentTime, on ? 880 : 620, 0.07, "triangle", 0.35);
    },

    /** Bright chime when banking points; longer for big scores. */
    score(points) {
      if (!audio()) return;
      const t = ctx.currentTime;
      const notes = points >= 40 ? [523.25, 659.25, 783.99, 1046.5]
        : points >= 25 ? [523.25, 659.25, 783.99]
        : [659.25, 783.99];
      notes.forEach((f, i) => tone(t + i * 0.08, f, 0.35, "sine", 0.3));
    },

    /** Dull downward "bonk" for a zero (scratch). */
    scratch() {
      if (!audio()) return;
      tone(ctx.currentTime, 220, 0.25, "triangle", 0.4, 110);
    },
  };

  window.Sound = Sound;
})();
