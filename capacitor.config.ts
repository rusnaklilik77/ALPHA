import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.alpha.courier',
  appName: 'ALPHA',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
