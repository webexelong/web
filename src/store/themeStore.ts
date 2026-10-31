import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setTheme: (mode: ThemeMode) => void;
}

const STORAGE_KEY = 'ai_smartserve_theme';

const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const applyThemeToDocument = (resolved: 'light' | 'dark') => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  // Sync mobile browser status bar / theme color
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', resolved === 'dark' ? '#17120F' : '#F6F1E7');
  }
};

const getInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'system';
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
  } catch {
    // Ignore localStorage restrictions
  }
  return 'system';
};

const initialTheme = getInitialTheme();
const initialResolved = initialTheme === 'system' ? getSystemTheme() : initialTheme;
applyThemeToDocument(initialResolved);

export const useThemeStore = create<ThemeState>((set, get) => {
  // Listen for OS color scheme changes when mode is 'system'
  if (typeof window !== 'undefined' && window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      const current = get().theme;
      if (current === 'system') {
        const nextResolved = e.matches ? 'dark' : 'light';
        applyThemeToDocument(nextResolved);
        set({ resolvedTheme: nextResolved });
      }
    };
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleMediaChange);
    } else if ((mediaQuery as any).addListener) {
      (mediaQuery as any).addListener(handleMediaChange);
    }
  }

  return {
    theme: initialTheme,
    resolvedTheme: initialResolved,
    setTheme: (mode: ThemeMode) => {
      try {
        localStorage.setItem(STORAGE_KEY, mode);
      } catch {
        // Ignore storage errors
      }
      const nextResolved = mode === 'system' ? getSystemTheme() : mode;
      applyThemeToDocument(nextResolved);
      set({ theme: mode, resolvedTheme: nextResolved });
    },
  };
});

