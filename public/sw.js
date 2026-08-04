/* Katana Personal — keep the shell available offline */
const CACHE = 'katana-shell-v3'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/katana-192.png', '/icons/katana-512.png']

function shouldBypassCache(url) {
  // Never cache Vite HMR / prebundled deps — stale hashes cause blank screens.
  return (
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.includes('/.vite/') ||
    url.searchParams.has('v') && url.pathname.endsWith('.js') && url.pathname.includes('node_modules')
  )
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin === self.location.origin && shouldBypassCache(url)) {
    return
  }

  // App shell: network first, fall back to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((cache) => cache.put('/index.html', copy))
          return res
        })
        .catch(() => caches.match('/index.html')),
    )
    return
  }

  // Static assets only — network first with cache fallback (not cache-first)
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok && url.origin === self.location.origin && !shouldBypassCache(url)) {
          const copy = res.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
        }
        return res
      })
      .catch(() => caches.match(request)),
  )
})

self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload
  try {
    payload = event.data.json()
  } catch {
    return
  }
  const title = payload.notification?.title || payload.data?.title || 'Katana'
  const body = payload.notification?.body || payload.data?.body || ''
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { href: payload.data?.href || '/' },
      icon: '/icons/katana-192.png',
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const href = event.notification.data?.href || '/'
  event.waitUntil(clients.openWindow(href))
})
