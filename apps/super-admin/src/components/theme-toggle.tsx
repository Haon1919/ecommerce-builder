'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

export function ThemeToggle() {
    const { setTheme, theme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <div className="w-5 h-5" />;
    }

    return (
        <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500"
            aria-label="Toggle dark mode"
        >
            {theme === 'dark' ? (
                <>
                    <Sun className="h-4 w-4" />
                    <span>Light Mode</span>
                </>
            ) : (
                <>
                    <Moon className="h-4 w-4" />
                    <span>Dark Mode</span>
                </>
            )}
        </button>
    );
}
