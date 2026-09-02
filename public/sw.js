/* ══════════════════════════════════════════════════════════
   데일리 카드 — 서비스 워커
   지하철처럼 네트워크가 끊긴 곳에서도 마지막에 받아둔 카드가 열리게 합니다.

   캐시 세 갈래
     shell : 앱 자체(HTML/JS/CSS/아이콘)   → 캐시 먼저 쓰고 뒤에서 갱신
     data  : news.json                    → 새 걸 먼저 받고, 실패하면 캐시
     img   : 기사 썸네일(외부 도메인)        → 캐시 먼저, 개수 제한

   앱을 새로 배포하면 VERSION 을 올릴 필요 없이,
   파일 이름에 해시가 붙기 때문에 자연히 새 파일이 받아집니다.
   캐시 구조 자체를 바꿀 때만 VERSION 을 올리세요.
   ══════════════════════════════════════════════════════════ */

const VERSION = 'v1'
const SHELL = `dailycard-shell-${VERSION}`
const DATA = `dailycard-data-${VERSION}`
const IMGS = `dailycard-img-${VERSION}`
const KEEP = [SHELL, DATA, IMGS]

/** 썸네일 캐시에 보관할 최대 장수 */
const MAX_IMAGES = 120

self.addEventListener('install', () => {
  // 새 워커를 곧바로 활성화한다
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys.filter((k) => k.startsWith('dailycard-') && !KEEP.includes(k)).map((k) => caches.delete(k))
      )
      await self.clients.claim()
    })()
  )
})

/* ── 도우미 ─────────────────────────────────────────────── */

async function trimCache(name, max) {
  try {
    const cache = await caches.open(name)
    const keys = await cache.keys()
    if (keys.length <= max) return
    // 오래된 것부터 지운다 (Cache API 는 넣은 순서를 유지한다)
    await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)))
  } catch {
    /* 캐시 정리는 실패해도 무시 */
  }
}

/** 새 걸 먼저 받아보고, 안 되면 캐시로 */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const fresh = await fetch(request)
    if (fresh && fresh.ok) cache.put(request, fresh.clone())
    return fresh
  } catch (err) {
    const cached = await cache.match(request, { ignoreSearch: true })
    if (cached) return cached
    throw err
  }
}

/** 캐시를 바로 내주고, 뒤에서 조용히 갱신 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const network = fetch(request)
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone())
      return res
    })
    .catch(() => null)
  return cached || (await network) || Response.error()
}

/** 캐시에 있으면 그걸 쓰고, 없을 때만 받아온다 */
async function cacheFirst(request, cacheName, max) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  const res = await fetch(request)
  if (res && (res.ok || res.type === 'opaque')) {
    await cache.put(request, res.clone())
    trimCache(cacheName, max)
  }
  return res
}

/* ── 요청 가로채기 ──────────────────────────────────────── */

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return

  const sameOrigin = url.origin === self.location.origin

  // 1) 페이지 이동 — 새 앱이 있으면 받고, 없으면 캐시된 앱 셸을 연다
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request)
          const cache = await caches.open(SHELL)
          cache.put(request, fresh.clone())
          return fresh
        } catch {
          const cache = await caches.open(SHELL)
          return (
            (await cache.match(request, { ignoreSearch: true })) ||
            (await cache.match('./', { ignoreSearch: true })) ||
            (await cache.match('./index.html', { ignoreSearch: true })) ||
            new Response(
              '<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;padding:2rem">' +
                '오프라인이고 저장된 카드도 없습니다. 인터넷에 연결한 뒤 다시 열어 주세요.</body>',
              { headers: { 'content-type': 'text/html; charset=utf-8' }, status: 200 }
            )
          )
        }
      })()
    )
    return
  }

  // 2) 카드 데이터 — 항상 최신을 먼저 시도
  if (sameOrigin && url.pathname.endsWith('/data/news.json')) {
    event.respondWith(networkFirst(request, DATA))
    return
  }

  // 3) 앱 파일 — 즉시 띄우고 뒤에서 갱신
  if (sameOrigin) {
    event.respondWith(staleWhileRevalidate(request, SHELL))
    return
  }

  // 4) 외부 기사 썸네일 — 한 번 받으면 계속 재활용
  if (request.destination === 'image') {
    event.respondWith(
      cacheFirst(request, IMGS, MAX_IMAGES).catch(() => Response.error())
    )
  }
})
