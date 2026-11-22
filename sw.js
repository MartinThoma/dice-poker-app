/* Service worker: makes Dice Poker installable and playable offline.
 *
 * Update model: the browser re-downloads this file when the page loads and
 * when the page calls registration.update(). Any byte change (e.g. VERSION)
 * installs a new worker, which precaches the new files into a fresh cache and
 * then waits. The page shows "Update available"; when the player accepts, the
 * page posts SKIP_WAITING, the new worker takes over and the page reloads.
 */
"use strict";

// Keep in sync with version.js (`make bump VERSION=x.y.z` updates both).
const VERSION = "1.3.0";
const CACHE = "dice-poker-" + VERSION;

const SHELL = [
  "./",
  "index.html",
  "style.css",
  "scoring.js",
  "game.js",
  "sound.js",
  "quests.js",
  "questui.js",
  "pwa.js",
  "version.js",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  // cache: "reload" bypasses the HTTP cache so a new version never precaches stale files.
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(SHELL.map((url) => new Request(url, { cache: "reload" })))
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith("dice-poker-") && k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
  if (event.data === "GET_VERSION") event.source.postMessage({ type: "VERSION", version: VERSION });
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      try {
        return await fetch(req);
      } catch (err) {
        // Offline and not precached: fall back to the app shell for page loads.
        if (req.mode === "navigate") return cache.match("index.html");
        throw err;
      }
    })
  );
});
