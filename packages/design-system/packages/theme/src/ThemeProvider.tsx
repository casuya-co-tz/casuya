import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark' | 'high-contrast';

export interface Theme {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

export interface ThemeProviderProps {
  children: ReactNode;
  defaultMode?: ThemeMode;
  storageKey?: string;
}

const ThemeContext = createContext<Theme | null>(null);

function getStoredTheme(storageKey: string): ThemeMode | null {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored === 'light' || stored === 'dark' || stored === 'high-contrast') {
      return stored;
    }
  } catch {}
  return null;
}

function getPreferredTheme(): ThemeMode {
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function ThemeProvider({
  children,
  defaultMode,
  storageKey = 'casuya-theme',
}: ThemeProviderProps) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    return getStoredTheme(storageKey) ?? getPreferredTheme() ?? defaultMode ?? 'light';
  });

  const setMode = useCallback(
    (newMode: ThemeMode | ((prev: ThemeMode) => ThemeMode)) => {
      setModeState((prev) => {
        const next = typeof newMode === 'function' ? (newMode as (prev: ThemeMode) => ThemeMode)(prev) : newMode;
        try {
          localStorage.setItem(storageKey, next);
        } catch {}
        return next;
      });
    },
    [storageKey],
  );

  const toggle = useCallback(() => {
    setMode((prev: ThemeMode) => (prev === 'light' ? 'dark' : 'light'));
  }, [setMode]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', mode);

    if (mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [mode]);

  return (
    <ThemeContext.Provider value={{ mode, setMode, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
