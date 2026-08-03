/* Firebase Cloud Messaging background worker (optional).
 * Copy your web app config from Firebase Console into firebaseConfig below
 * when you enable VITE_FIREBASE_VAPID_KEY — required for background push.
 */
/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js')

const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
}

if (firebaseConfig.apiKey) {
  firebase.initializeApp(firebaseConfig)
  firebase.messaging()
}

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
  const href = payload.data?.href || '/shared'
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { href },
      icon: '/icons/katana-192.png',
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const href = event.notification.data?.href || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate?.(href)
          return client.focus()
        }
      }
      return clients.openWindow(href)
    }),
  )
})
