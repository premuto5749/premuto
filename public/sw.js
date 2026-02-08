// Minimal service worker for PWA install eligibility
// Network-first strategy, no caching — preserves existing app behavior

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})
