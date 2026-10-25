/**
 * StudyTracker Pro - Service Worker
 * 高度なオフラインキャッシュ戦略 (Cache-First / Stale-While-Revalidate)
 */

const CACHE_VERSION = 'v9';
const CACHE_STATIC = `study-tracker-static-${CACHE_VERSION}`;
const CACHE_DYNAMIC = `study-tracker-dynamic-${CACHE_VERSION}`;
const CACHE_FONTS = `study-tracker-fonts-${CACHE_VERSION}`;

// 必須コアアセット (アプリシェル)
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
  '/study_timer.png',
  '/timer-sound.mp3',
  '/js/utils.js',
  '/js/state.js',
  '/js/sync.js',
  '/js/ui.js',
  '/js/timer.js',
  '/js/todos.js',
  '/js/dashboard.js',
  '/js/subjects.js',
  '/js/achievements.js',
  '/js/main.js'
];

// 外部CDNアセット
const EXTERNAL_CDN_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://unpkg.com/lucide@latest',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
  'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js'
];

// --- インストール処理 ---
self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      // 1. 同一オリジンのコアアセットをキャッシュ
      const staticCache = await caches.open(CACHE_STATIC);
      try {
        await staticCache.addAll(CORE_ASSETS);
      } catch (err) {
        console.warn('[SW] Core precache partial fail:', err);
        // 個別フォールバックで取得可能なものを保存
        await Promise.allSettled(
          CORE_ASSETS.map(url =>
            fetch(url, { cache: 'reload' })
              .then(res => {
                if (res.ok) return staticCache.put(url, res);
              })
              .catch(() => {})
          )
        );
      }

      // 2. 外部CDNリソースを安全に事前フェッチ＆キャッシュ
      const dynamicCache = await caches.open(CACHE_DYNAMIC);
      await Promise.allSettled(
        EXTERNAL_CDN_ASSETS.map(url =>
          fetch(url, { mode: 'cors' })
            .then(res => {
              if (res.ok || res.type === 'opaque') {
                return dynamicCache.put(url, res);
              }
            })
            .catch(() => {
              // no-cors で再試行
              return fetch(url, { mode: 'no-cors' })
                .then(res => dynamicCache.put(url, res))
                .catch(() => {});
            })
        )
      );

      return self.skipWaiting();
    })()
  );
});

// --- アクティベート処理 ---
self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const allowedCaches = [CACHE_STATIC, CACHE_DYNAMIC, CACHE_FONTS];
      const keyList = await caches.keys();
      await Promise.all(
        keyList.map(key => {
          if (!allowedCaches.includes(key)) {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
      return self.clients.claim();
    })()
  );
});

// --- 通知クリック処理 ---
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});

// --- フェッチ処理（リクエスト振り分け） ---
self.addEventListener('fetch', event => {
  const request = event.request;

  // GETリクエスト以外はService Workerで処理しない
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 1. APIエンドポイント (/api/*)
  // ネットワーク優先。オフライン時は空のJSONを返してフロントエンドのクラッシュを防ぐ
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // 2. Google Fonts (fonts.googleapis.com, fonts.gstatic.com)
  // Cache First 戦略
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(CACHE_FONTS).then(async cache => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          return cached || new Response('', { status: 408 });
        }
      })
    );
    return;
  }

  // 3. ナビゲーションリクエスト（HTML画面表示）
  // Stale-While-Revalidate / Cache First with Network Fallback
  // オフラインでも即座に index.html を返す
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const staticCache = await caches.open(CACHE_STATIC);
        const cachedIndex = (await staticCache.match(request)) ||
                            (await staticCache.match('/index.html')) ||
                            (await staticCache.match('/'));

        const networkFetch = fetch(request).then(async networkResponse => {
          if (networkResponse && networkResponse.ok) {
            staticCache.put(request, networkResponse.clone());
            staticCache.put('/index.html', networkResponse.clone());
          }
          return networkResponse;
        }).catch(err => {
          console.log('[SW] Navigation fetch offline, using cached index');
          return cachedIndex;
        });

        // キャッシュがあれば即時返却し、裏で最新化（オフラインでも超高速表示）
        return cachedIndex || networkFetch;
      })()
    );
    return;
  }

  // 4. 外部CDNスクリプト / スタイル (Tailwind, Chart.js, Lucide, Firebase)
  // Cache First 戦略 (キャッシュにあれば即座に返却、無ければネットワークから取得・キャッシュ)
  if (
    url.hostname.includes('cdn.tailwindcss.com') ||
    url.hostname.includes('jsdelivr.net') ||
    url.hostname.includes('unpkg.com') ||
    url.hostname.includes('gstatic.com')
  ) {
    event.respondWith(
      caches.open(CACHE_DYNAMIC).then(async cache => {
        const cached = await cache.match(request);
        if (cached) {
          // バックグラウンドで更新確認
          fetch(request).then(res => {
            if (res && (res.ok || res.type === 'opaque')) {
              cache.put(request, res);
            }
          }).catch(() => {});
          return cached;
        }

        try {
          const networkResponse = await fetch(request);
          if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          return cached || Promise.reject(err);
        }
      })
    );
    return;
  }

  // 5. その他の同一オリジンリソース（JSファイル、画像、タイマー音声など）
  // Stale-While-Revalidate 戦略
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(async cachedResponse => {
      const fetchPromise = fetch(request).then(async networkResponse => {
        if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
          const cache = await caches.open(CACHE_STATIC);
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      }).catch(err => {
        // オフライン時のフェッチエラー
        if (cachedResponse) return cachedResponse;
        // もしHTMLリクエストならindex.htmlを返す
        if (request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/index.html');
        }
      });

      return cachedResponse || fetchPromise;
    })
  );
});
