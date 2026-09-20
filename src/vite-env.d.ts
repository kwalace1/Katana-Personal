/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_DEV_AUTH_BYPASS?: string
  readonly VITE_DEV_EMAIL?: string
  readonly VITE_DEV_PASSWORD?: string
  readonly VITE_DEV_FULL_NAME?: string
  readonly VITE_VAPID_PUBLIC_KEY?: string
  readonly VITE_APP_URL?: string
  readonly VITE_REVENUECAT_APPLE_API_KEY?: string
  readonly VITE_STRIPE_PRICE_ID?: string
  readonly VITE_ALLOW_WEB_APP?: string
  readonly VITE_LOCK_WEB_APP?: string
  readonly VITE_IOS_DOWNLOAD_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}













