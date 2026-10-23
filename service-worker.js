// service-worker.js - saves the app files on the device so the app also works offline.

// IMPORTANT: change this version name (v1 -> v2 -> v3 ...) after EVERY update of any app file.
// Otherwise people keep seeing the old cached version.
const CACHE_NAME = "schulplaner-v1";
const FILES = ["./", "index.html", "style.css", "app.js", "storage.js", "manifest.json", "icon-192.png", "icon-512.png"];

// Install: download and save all files.
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES)));
  self.skipWaiting();
});

// Activate: delete caches from older versions.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
  );
  self.clients.claim();
});

// Fetch: answer from the cache first, ask the network only if the file is not saved.
self.addEventListener("fetch", (event) => {
  event.respondWith(caches.match(event.request).then((saved) => saved || fetch(event.request)));
});
