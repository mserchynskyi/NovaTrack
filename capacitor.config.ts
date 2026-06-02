import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.novatrack.app',
  appName: 'Nova Track',
  webDir: 'dist',
  plugins: {
    GoogleAuth: {
      scopes: ["profile", "email"],
      serverClientId: "259362159478-fl2qsng5b906uac841jvsk5365hs9ck3.apps.googleusercontent.com",
      forceCodeForRefreshToken: true
    }
  }
};

export default config;
