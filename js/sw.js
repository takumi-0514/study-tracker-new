const CACHE_NAME = "study-timer-v3";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./study_timer.png",
  "./timer-sound.mp3",
  "./js/achievements.js",
  "./js/dashboard.js",
  "./js/main.js",
  "./js/state.js",
  "./js/subjects.js",
  "./js/sync.js",
  "./js/timer.js",
  "./js/todos.js",
  "./js/ui.js",
  "./js/utils.js",
  "https://cdn.tailwindcss.com",
  "https://cdn.jsdelivr.net/npm/chart.js",
  "https://unpkg.com/lucide@latest"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Use all() for critical files, but gracefully handle external ones if they fail
        return Promise.allSettled(APP_SHELL.map(url => {
          return fetch(new Request(url, { cache: 'no-cache', mode: 'no-cors' }))
            .then(response => {
              if (response.ok || response.type === 'opaque') {
                return cache.put(url, response);
              }
              throw new Error(`Failed to fetch ${url}`);
            });
        }));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("./");
    })
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Use Stale-While-Revalidate strategy for everything
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        // Cache the new response (even if it's opaque from CDNs)
        if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(err => {
        console.warn('Network request failed, relying on cache', err);
      });

      // Return the cached response immediately if it exists, otherwise wait for the network
      return cachedResponse || fetchPromise;
    })
  );
});
