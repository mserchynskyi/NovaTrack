import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark' | 'system';

export function useTheme() {
    const [theme, setTheme] = useState<Theme>(() => {
        const saved = localStorage.getItem('theme-preference') as Theme;
        return saved || 'system';
    });

    useEffect(() => {
        const root = window.document.documentElement;
        
        root.classList.remove('light', 'dark');

        if (theme === 'system') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            root.classList.add(systemTheme);
            root.style.colorScheme = systemTheme;
        } else {
            root.classList.add(theme);
            root.style.colorScheme = theme;
        }

        localStorage.setItem('theme-preference', theme);
    }, [theme]);

    return { theme, setTheme };
}
