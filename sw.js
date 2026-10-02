/**
 * AIBC - AI广播电台 Service Worker
 * 缓存静态资源以提高应用性能
 */

const CACHE_NAME = 'aibc-cache-v1';

// 需要缓存的静态资源
const STATIC_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './css/animations.css',
  './js/utils.js',
  './js/config.js',
  './js/theme.js',
  './js/helpTips.js',
  './js/apiService.js',
  './js/promptGenerator.js',
  './js/audioManager.js',
  './js/stationManager.js',
  './js/ui.js',
  './js/app.js'
];

// 安装Service Worker，缓存静态资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// 激活新的Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 拦截请求，优先使用缓存
self.addEventListener('fetch', (event) => {
  // 仅缓存同源请求
  if (event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          // 如果在缓存中找到响应则返回缓存的响应
          if (response) {
            return response;
          }

          // 否则发送网络请求
          return fetch(event.request).then((networkResponse) => {
            // 不缓存非成功响应
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            // 缓存新响应
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });

            return networkResponse;
          });
        })
    );
  }
});