import { useState, useEffect } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';

type Theme = 'light' | 'dark' | 'system';

export function useTheme() {
    const [theme, setTheme] = useState<Theme>(() => {
        const saved = localStorage.getItem('theme-preference') as Theme;
        return saved || 'system';
    });

    useEffect(() => {
        const root = window.document.documentElement;
        const body = window.document.body;
        
        root.classList.remove('light', 'dark');
        if (body) {
            body.classList.remove('light', 'dark');
        }

        const activeTheme = theme === 'system'
            ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
            : theme;

        root.classList.add(activeTheme);
        root.style.colorScheme = activeTheme;

        if (body) {
            body.classList.add(activeTheme);
            body.style.backgroundColor = activeTheme === 'dark' ? '#1b2b35' : '#f3f4f6';
        }

        // Dynamic theme-color meta tag adjustment to eliminate native browser white/dark mismatch strips
        let metaThemeColor = window.document.querySelector('meta[name="theme-color"]');
        if (!metaThemeColor) {
            metaThemeColor = window.document.createElement('meta');
            metaThemeColor.setAttribute('name', 'theme-color');
            window.document.head.appendChild(metaThemeColor);
        }
        metaThemeColor.setAttribute('content', activeTheme === 'dark' ? '#1b2b35' : '#f3f4f6');

        // Apply Android StatusBar style
        const updateAndroidStatusBar = async () => {
            try {
                // If light theme, we want dark icons/text (Style.Light)
                // If dark theme, we want light icons/text (Style.Dark)
                await StatusBar.setStyle({
                    style: activeTheme === 'dark' ? Style.Dark : Style.Light
                });
                
                // Also set the status bar background color to match the theme background
                await StatusBar.setBackgroundColor({
                    color: activeTheme === 'dark' ? '#1b2b35' : '#f3f4f6'
                });
            } catch (error) {
                // Ignore errors on non-native platforms
                console.log('Capacitor StatusBar is not available:', error);
            }
        };
        updateAndroidStatusBar();

        localStorage.setItem('theme-preference', theme);
    }, [theme]);

    return { theme, setTheme };
}
