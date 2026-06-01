import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './lib/AuthContext';

// Register or unregister PWA service worker based on environment
if ('serviceWorker' in navigator && (import.meta as any).env.PROD) {
  window.addEventListener('load', () => {
    // Check if we are running inside native Capacitor environment
    const isNative = (window as any).Capacitor && (window as any).Capacitor.isNativePlatform && (window as any).Capacitor.isNativePlatform();
    
    if (isNative) {
      // In native apps, the Service Worker causes stale asset caching across app updates.
      // Unregister any existing service workers.
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (let registration of registrations) {
          registration.unregister();
          console.log('Unregistered Service Worker in native environment');
        }
      });
    } else {
      // Register for web PWA
      const swUrl = (import.meta as any).env.BASE_URL + 'sw.js';
      navigator.serviceWorker.register(swUrl)
        .then(reg => console.log('Service Worker registered successfully:', reg.scope))
        .catch(err => console.warn('Service Worker registration failed:', err));
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);

