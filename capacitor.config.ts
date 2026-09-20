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
      backgroundColor: '#F4F8F9',
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#5B4B8A',
      sound: 'default',
    },
    Keyboard: {
      resize: 'body',
    },
  },
  ios: {
    // 'automatic' insets the WebView and leaves a native black strip above the page.
    // Draw edge-to-edge; CSS env(safe-area-inset-*) pads content under the status bar.
    contentInset: 'never',
    preferredContentMode: 'mobile',
    scheme: 'Katana Personal',
  },
}

export default config
