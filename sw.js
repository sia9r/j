const CACHE_NAME = 'gh-site-cache-v1';
const URLs = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(URLs).catch(()=>{}))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request).then(resp => {
        if(resp && resp.status === 200){
          const resClone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, resClone));
        }
        return resp;
      }).catch(()=> caches.match('/'));
    })
  );
});
