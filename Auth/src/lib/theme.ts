export const THEME_STORAGE_KEY = 'k2s-theme';

export type AppTheme = 'light' | 'dark';

function canUseDom() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

export function getStoredTheme(): AppTheme {
  if (!canUseDom()) {
    return 'light';
  }

  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark'
      ? 'dark'
      : 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(theme: AppTheme) {
  if (!canUseDom()) {
    return;
  }

  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
}

export function persistTheme(theme: AppTheme) {
  applyTheme(theme);

  if (!canUseDom()) {
    return;
  }

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage write failures and keep the active DOM theme.
  }
}

export function initializeTheme() {
  const theme = getStoredTheme();
  applyTheme(theme);
  return theme;
}
