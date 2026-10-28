import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pwarmyar.mobile',
  appName: 'PwarMyar',
  webDir: 'dist',
  server: {
    // Keep the bundled asset server separate from every real API hostname.
    hostname: 'localhost',
    androidScheme: 'https',
  },
  plugins: {
    SystemBars: {
      // Share Android system-bar/cutout insets with the app's safe-area tokens.
      insetsHandling: 'css',
    },
    CapacitorCookies: {
      enabled: true,
    },
    // Native networking avoids WebView CORS and local-server interception.
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
