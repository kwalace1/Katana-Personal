/* Katana Personal — offline icons only; never pin HTML so deploys show up */
const CACHE = 'katana-shell-v4'
const SHELL = ['/manifest.webmanifest', '/icons/katana-192.png', '/icons/katana-512.png']

function shouldBypassCache(url) {
  return (
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.includes('/.vite/') ||
    (url.searchParams.has('v') && url.pathname.endsWith('.js') && url.pathname.includes('node_modules'))
  )
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin === self.location.origin && shouldBypassCache(url)) {
    return
  }

  // HTML navigations: always prefer network. Do not rewrite the cache with HTML
  // so a failed fetch still can fall back to a previous good shell only as last resort.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => res)
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/'))),
    )
    return
  }

  // Hashed assets: network first, cache fallback for offline
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (
          res.ok &&
          url.origin === self.location.origin &&
          !shouldBypassCache(url) &&
          (url.pathname.startsWith('/assets/') || SHELL.includes(url.pathname))
        ) {
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
