/**
 * StudyTracker Pro - Service Worker
 * 堅牢なオフラインキャッシュ戦略
 * - アプリ本体 & 必須CDNの完全アトミック保存 (1つでも失敗なら古い版を維持)
 * - Safari向け Range リクエスト (206 Partial Content) 対応
 * - Firebase設定の前回控え保持 & 未取得時503返却
 * - Firestore等の外部通信バイパス
 */

// BUILD_ID は server.js 配信時に動的注入されます。静的ホスティング時は手動で値を変更してください。
const BUILD_ID = 'static-v10';
const CACHE_VERSION = BUILD_ID;
const CACHE_NAME = `study-tracker-${CACHE_VERSION}`;
const BACKUP_CACHE_NAME = 'study-tracker-firebase-backup';

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

// 必須外部CDNアセット
const EXTERNAL_CDN_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://unpkg.com/lucide@latest',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
  'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js'
];

// --- インストール処理 (完全アトミック) ---
self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const allUrls = [...CORE_ASSETS, ...EXTERNAL_CDN_ASSETS];

      // すべてのアセットを並行フェッチ。1つでも失敗すればPromise.allがrejectし、
      // インストールは失敗扱いとなるため、中途半端な壊れたキャッシュで古い版を上書きしません。
      await Promise.all(
        allUrls.map(async url => {
          const req = new Request(url, { cache: 'reload' });
          const res = await fetch(req);
          if (!res.ok && res.type !== 'opaque') {
            throw new Error(`[SW] Precache failed: ${url} (status: ${res.status})`);
          }
          await cache.put(url, res);
        })
      );

      console.log(`[SW] All assets precached successfully for ${CACHE_NAME}`);
      return self.skipWaiting();
    })()
  );
});

// --- アクティベート処理 ---
self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const keyList = await caches.keys();
      await Promise.all(
        keyList.map(key => {
          // 現在のキャッシュとFirebase設定控え以外の古いキャッシュを削除
          if (key.startsWith('study-tracker-') && key !== CACHE_NAME && key !== BACKUP_CACHE_NAME) {
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

// --- Safari向け Range リクエスト処理 (206 Partial Content) ---
async function handleRangeRequest(request, cachedResponse) {
  const rangeHeader = request.headers.get('range');
  if (!rangeHeader) return cachedResponse;

  const arrayBuffer = await cachedResponse.arrayBuffer();
  const total = arrayBuffer.byteLength;
  const parts = rangeHeader.replace(/bytes=/, '').split('-');
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : total - 1;

  if (isNaN(start) || start >= total || end >= total || start > end) {
    return new Response(null, {
      status: 416,
      statusText: 'Range Not Satisfiable',
      headers: { 'Content-Range': `bytes */${total}` }
    });
  }

  const sliced = arrayBuffer.slice(start, end + 1);
  return new Response(sliced, {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': cachedResponse.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Content-Length': String(sliced.byteLength),
      'Accept-Ranges': 'bytes'
    }
  });
}

// --- フェッチ処理 ---
self.addEventListener('fetch', event => {
  const request = event.request;

  // GETリクエスト以外はService Workerで処理しない
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 1. /api/firebase-config の処理
  // 有効な設定は控えとして保存。オフライン時は控えを返すが、控えも無ければ503を返す (空の{} 200ではない)
  if (url.origin === location.origin && url.pathname === '/api/firebase-config') {
    event.respondWith(
      (async () => {
        const backupCache = await caches.open(BACKUP_CACHE_NAME);
        try {
          const networkRes = await fetch(request);
          if (networkRes.ok) {
            const clone = networkRes.clone();
            const data = await clone.json();
            // 有効な apiKey が含まれている場合のみ控えとして保存
            if (data && data.apiKey) {
              await backupCache.put(request, networkRes.clone());
            }
            return networkRes;
          }
        } catch (err) {
          // ネットワーク障害・オフライン
        }

        // 前回の控えがあるか確認
        const cachedRes = await backupCache.match(request);
        if (cachedRes) {
          return cachedRes;
        }

        // 控えも存在しない場合は 503 Service Unavailable を返す
        return new Response(JSON.stringify({ error: 'Service Unavailable (Offline)' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })()
    );
    return;
  }

  // 2. その他の同一オリジン API (/api/*)
  if (url.origin === location.origin && url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(JSON.stringify({ error: 'Offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // 3. Firestore, Firebase Auth, Google APIs などの外部通信は SW は一切関与しない (完全バイパス)
  const isCdn = EXTERNAL_CDN_ASSETS.some(cdnUrl => request.url.startsWith(cdnUrl.split('?')[0]));
  if (url.origin !== location.origin && !isCdn) {
    return; // 通信に関与せずブラウザ本来の通信に任せる
  }

  // 4. Safari向け Range リクエスト (音声・動画等)
  if (request.headers.has('range')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request, { ignoreSearch: true });
        if (cached) {
          return handleRangeRequest(request, cached);
        }
        return fetch(request);
      })()
    );
    return;
  }

  // 5. ナビゲーションリクエスト (HTML表示)
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedIndex = (await cache.match(request)) ||
                            (await cache.match('/index.html')) ||
                            (await cache.match('/'));

        // バックグラウンドで最新のHTMLを取得・更新
        const networkFetch = fetch(request).then(async networkRes => {
          if (networkRes && networkRes.ok) {
            cache.put(request, networkRes.clone());
            cache.put('/index.html', networkRes.clone());
          }
          return networkRes;
        }).catch(() => cachedIndex);

        return cachedIndex || networkFetch;
      })()
    );
    return;
  }

  // 6. 一般リソース (JS, CSS, 画像, 必須CDN) -> Cache First / Stale-While-Revalidate
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request, { ignoreSearch: true });

      if (cached) {
        // バックグラウンドで更新を試みる (オンライン時のみ)
        if (navigator.onLine) {
          fetch(request).then(networkRes => {
            if (networkRes && (networkRes.ok || networkRes.type === 'opaque')) {
              cache.put(request, networkRes);
            }
          }).catch(() => {});
        }
        return cached;
      }

      // キャッシュにない場合はネットワークから取得
      try {
        const networkRes = await fetch(request);
        if (networkRes && (networkRes.ok || networkRes.type === 'opaque')) {
          cache.put(request, networkRes.clone());
        }
        return networkRes;
      } catch (err) {
        if (request.mode === 'navigate') {
          return (await cache.match('/index.html')) || (await cache.match('/'));
        }
        throw err;
      }
    })()
  );
});
