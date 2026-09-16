/* Katana Personal — offline icons only; never pin HTML so deploys show up */
const CACHE = 'katana-shell-v10'
const SHELL = ['/manifest.webmanifest', '/icons/katana-192.png', '/icons/katana-512.png']

function shouldBypassCache(url) {
  return (
    url.pathname.startsWith('/api/') ||
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
  const data = event.data
  if (data === 'SKIP_WAITING') {
    self.skipWaiting()
    return
  }
  if (data && data.type === 'SHOW_NOTIFICATION') {
    event.waitUntil(
      self.registration.showNotification(data.title || 'Katana', {
        body: data.body || '',
        tag: data.tag || 'katana',
        renotify: true,
        icon: '/icons/katana-192.png',
        data: { href: data.href || '/' },
      }),
    )
  }
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Never intercept third-party APIs (Supabase, etc.) or same-origin /api —
  // a failed cache fallback would return null and break the page fetch.
  if (url.origin !== self.location.origin) return

  if (shouldBypassCache(url)) {
    return
  }

  // HTML navigations: always prefer network. Do not rewrite the cache with HTML
  // so a failed fetch still can fall back to a previous good shell only as last resort.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => res)
        .catch(() =>
          caches.match('/index.html').then((r) => r || caches.match('/') || Response.error()),
        ),
    )
    return
  }

  // Hashed assets: network first, cache fallback for offline
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (
          res.ok &&
          !shouldBypassCache(url) &&
          (url.pathname.startsWith('/assets/') || SHELL.includes(url.pathname))
        ) {
          const copy = res.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
        }
        return res
      })
      .catch(() => caches.match(request).then((r) => r || Response.error())),
  )
})

self.addEventListener('push', (event) => {
  let title = 'Katana'
  let body = 'Something needs a look.'
  let href = '/'
  if (event.data) {
    try {
      const payload = event.data.json()
      title = payload.notification?.title || payload.data?.title || payload.title || title
      body = payload.notification?.body || payload.data?.body || payload.body || body
      href = payload.data?.href || payload.href || href
    } catch {
      try {
        body = event.data.text()
      } catch {
        // keep defaults
      }
    }
  }
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: 'katana-push',
      renotify: true,
      icon: '/icons/katana-192.png',
      data: { href },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const href = event.notification.data?.href || '/'
  event.waitUntil(
    (async () => {
      const all = await clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of all) {
        if ('focus' in client) {
          await client.focus()
          if (href && 'navigate' in client) {
            try {
              await client.navigate(href)
            } catch {
              // older iOS PWA clients may not support navigate
            }
          }
          return
        }
      }
      await clients.openWindow(href)
    })(),
  )
})
