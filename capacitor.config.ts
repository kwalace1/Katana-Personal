import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Native shell for App Store / Shipaton.
 * Bundle id must match App Store Connect once Apple Developer enrollment is approved.
 */
const config: CapacitorConfig = {
  appId: 'com.katana.personal',
  appName: 'Katana Personal',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#F4F8F9',
      showSpinner: false,
    },
    StatusBar: {
      style: 'LIGHT',
    },
    Keyboard: {
      resize: 'body',
    },
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'Katana Personal',
  },
}

export default config
