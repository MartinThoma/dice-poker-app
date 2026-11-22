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

  function showUpdate() {
    const playing = window.DicePoker && window.DicePoker.gameInProgress();
    bannerText.textContent = "A new version is available." + (playing ? " Updating restarts the current game." : "");
    banner.hidden = false;
    checkStatus.textContent = "";
  }

  function watch(worker) {
    worker.addEventListener("statechange", () => {
      // "installed" with an existing controller = an update is waiting (not the first install).
      if (worker.state === "installed" && navigator.serviceWorker.controller) showUpdate();
    });
  }

  $("update-now").addEventListener("click", () => {
    if (!reg || !reg.waiting) return location.reload();
    acceptedUpdate = true;
    reg.waiting.postMessage("SKIP_WAITING");
  });
  $("update-later").addEventListener("click", () => { banner.hidden = true; });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // Only reload when the player chose to update; the first install also fires this event.
    if (!acceptedUpdate) return;
    acceptedUpdate = false;
    location.reload();
  });

  async function checkForUpdate(manual) {
    if (!reg) return;
    if (manual) checkStatus.textContent = "Checking…";
    try {
      await reg.update();
    } catch (e) {
      if (manual) checkStatus.textContent = "Could not check (offline?)";
      return;
    }
    if (reg.waiting && navigator.serviceWorker.controller) return showUpdate();
    if (manual) checkStatus.textContent = reg.installing ? "Downloading update…" : "You're up to date";
  }

  window.addEventListener("load", async () => {
    try {
      reg = await navigator.serviceWorker.register("sw.js", { updateViaCache: "none" });
    } catch (e) {
      return; // e.g. blocked by the browser; the game still works online
    }
    checkBtn.hidden = false;
    if (reg.waiting && navigator.serviceWorker.controller) showUpdate();
    if (reg.installing) watch(reg.installing);
    reg.addEventListener("updatefound", () => watch(reg.installing));

    // Installed apps can stay open for days: re-check when brought back to the
    // foreground and once an hour while open.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") checkForUpdate(false);
    });
    setInterval(() => checkForUpdate(false), 60 * 60 * 1000);
  });

  checkBtn.addEventListener("click", () => checkForUpdate(true));
})();
