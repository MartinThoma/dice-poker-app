/* Service worker: makes Dice Poker installable and playable offline.
 *
 * Update model: the page registers this file as "sw.js?v=<version>". To check
 * for updates it fetches version.js with a unique query string (so no CDN can
 * answer with an old copy) and, if the version differs, registers
 * "sw.js?v=<new version>". The new worker precaches the new files into a fresh
 * cache and then waits. The page shows "Update available"; when the player
 * accepts, the page posts SKIP_WAITING, the new worker takes over and the page
 * reloads.
 *
 * Every file is downloaded as "<file>?v=<version>" and stored under its plain
 * URL: a CDN caches per full URL, so a new version never picks up a stale copy
 * of an old file.
 */
"use strict";

// Keep in sync with version.js (`make bump VERSION=x.y.z` updates both).
const VERSION = "1.9.0";
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
  "i18n.js",
  "locales/en.js",
  "locales/de.js",
  "locales/fr.js",
  "locales/es.js",
  "locales/id.js",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  // ?v= bypasses CDN caches, cache: "reload" the browser's HTTP cache.
  const versioned = (url) => url + (url.includes("?") ? "&" : "?") + "v=" + encodeURIComponent(VERSION);
  event.waitUntil(
    caches.open(CACHE).then((cache) => Promise.all(SHELL.map(async (url) => {
      const res = await fetch(new Request(versioned(url), { cache: "reload" }));
      if (!res.ok) throw new Error(`Precaching ${url} failed: HTTP ${res.status}`);
      await cache.put(url, res);
    })))
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
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.searchParams.has("fresh")) return; // update checks always go to the network
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
