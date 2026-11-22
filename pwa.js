/* Install, update and version UI. Works without a service worker too
 * (plain http on the LAN, file://): the version is still shown, the
 * install/update controls just stay hidden. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const banner = $("update-banner");
  const bannerText = $("update-text");
  const checkBtn = $("check-update");
  const checkStatus = $("update-status");
  const installBtn = $("install");
  const iosHint = $("ios-hint");

  $("version").textContent = "v" + (self.APP_VERSION || "?");

  /* ---------- Install ---------- */
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  let deferredPrompt = null;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // show our own button instead of the mini-infobar
    deferredPrompt = e;
    installBtn.hidden = false;
  });
  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.hidden = true;
  });
  window.addEventListener("appinstalled", () => { installBtn.hidden = true; iosHint.hidden = true; });

  // iOS Safari has no install prompt; tell players how to add it manually.
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (ios && !standalone && "serviceWorker" in navigator) iosHint.hidden = false;

  /* ---------- Updates ---------- */
  if (!("serviceWorker" in navigator)) return; // insecure context (e.g. http://192.168…) or old browser

  let acceptedUpdate = false;
  let reg = null;

  const running = self.APP_VERSION;
  const scriptFor = (version) => "sw.js?v=" + encodeURIComponent(version);
  const versionOf = (worker) => {
    try { return new URL(worker.scriptURL).searchParams.get("v"); } catch (e) { return null; }
  };

  function showUpdate() {
    bannerText.textContent = "A new version is available. Your game in progress is kept.";
    banner.hidden = false;
    checkStatus.textContent = "";
  }

  // A worker finished installing while this page is controlled: offer it,
  // unless it is the version already running (only its URL changed, e.g. when
  // moving from "sw.js" to "sw.js?v=…"), which is swapped in silently.
  function onWaiting(worker) {
    if (!navigator.serviceWorker.controller) return; // first install, nothing to replace
    if (versionOf(worker) === running) worker.postMessage("SKIP_WAITING");
    else showUpdate();
  }

  function watch(worker) {
    if (!worker) return;
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed") onWaiting(worker);
    });
  }

  $("update-now").addEventListener("click", () => {
    if (!reg || !reg.waiting) return location.reload();
    acceptedUpdate = true;
    reg.waiting.postMessage("SKIP_WAITING");
  });
  $("update-later").addEventListener("click", () => { banner.hidden = true; });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // Only reload when the player chose to update; the first install and
    // silent same-version swaps also fire this event.
    if (!acceptedUpdate) return;
    acceptedUpdate = false;
    location.reload();
  });

  /** Version published on the server. The unique query string makes sure no
   * CDN or browser cache can answer with an old copy (the site sits behind a
   * CDN that caches .js files for hours). */
  async function latestVersion() {
    const res = await fetch("version.js?fresh=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const m = (await res.text()).match(/APP_VERSION\s*=\s*"([^"]+)"/);
    if (!m) throw new Error("No version in version.js");
    return m[1];
  }

  let checking = false;
  async function checkForUpdate(manual) {
    if (!reg || checking) return;
    checking = true;
    if (manual) checkStatus.textContent = "Checking…";
    let latest;
    try {
      latest = await latestVersion();
      if (latest !== running) {
        const known = [reg.installing, reg.waiting].some((w) => w && versionOf(w) === latest);
        // A new script URL per version: the browser must fetch it fresh, so a
        // cached old sw.js can't hide the update.
        if (!known) reg = await navigator.serviceWorker.register(scriptFor(latest), { updateViaCache: "none" });
      }
    } catch (e) {
      if (manual) checkStatus.textContent = "Could not check (offline?)";
      return;
    } finally {
      checking = false;
    }
    if (reg.waiting && versionOf(reg.waiting) !== running && navigator.serviceWorker.controller) return showUpdate();
    if (manual) {
      checkStatus.textContent = latest === running ? "You're up to date"
        : `Downloading v${latest}…`;
    }
  }

  window.addEventListener("load", async () => {
    try {
      reg = await navigator.serviceWorker.register(scriptFor(running), { updateViaCache: "none" });
    } catch (e) {
      return; // e.g. blocked by the browser; the game still works online
    }
    checkBtn.hidden = false;
    if (reg.waiting) onWaiting(reg.waiting);
    watch(reg.installing);
    reg.addEventListener("updatefound", () => watch(reg.installing));
    checkForUpdate(false);

    // Installed apps can stay open for days: re-check when brought back to the
    // foreground and once an hour while open.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") checkForUpdate(false);
    });
    setInterval(() => checkForUpdate(false), 60 * 60 * 1000);
  });

  checkBtn.addEventListener("click", () => checkForUpdate(true));
})();
