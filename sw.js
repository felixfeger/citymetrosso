/* ═══════════════════════════════════════════════════
   City Metro SSO - Service Worker v2
═══════════════════════════════════════════════════ */

const CACHE_NAME = 'cm-sso-v2';
const API_HOST   = 'citymetrosso.felixfeger46.workers.dev';

// Pages to cache - cache individually so one failure doesn't break all
const PAGES = [
  '/index.html',
  '/verify.html',
  '/reset-password.html',
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // Cache each page individually - ignore failures
      return Promise.allSettled(
        PAGES.map(function(url) {
          return cache.add(url).catch(function(err) {
            console.warn('[SW] Failed to cache ' + url + ':', err);
          });
        })
      );
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  // Let API calls always go to the network
  if (url.hostname === API_HOST) {
    return;
  }

  // Only handle GET requests for same-origin pages
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function(cached) {
      var networkRequest = fetch(event.request).then(function(response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function() {
        // Network failed - serve cached version if available
        return cached || new Response('Offline', { status: 503 });
      });

      // Serve cache immediately if available, update in background
      return cached || networkRequest;
    })
  );
});
