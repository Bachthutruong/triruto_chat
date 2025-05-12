// src/contexts/AppSettingsContext.tsx
'use client';

import type { AppSettings } from '@/lib/types';
import { createContext, useContext, type ReactNode } from 'react';

type AppSettingsContextType = AppSettings | null;

const AppSettingsContext = createContext<AppSettingsContextType>(null);

export function AppSettingsProvider({ children, settings }: { children: ReactNode, settings: AppSettings | null }) {
  return (
    <AppSettingsContext.Provider value={settings}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettingsContext() {
  const context = useContext(AppSettingsContext);
  return context;
}
