import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { UserSession } from '@/lib/types';
import { 
  getUserSession, 
  clearUserSession, 
  isRememberMeActive, 
  extendSession 
} from '@/lib/utils/auth';

export function useAuth() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Load session on mount
  useEffect(() => {
    const loadSession = () => {
      try {
        const currentSession = getUserSession();
        setSession(currentSession);
        
        // Extend session if remember me is active
        if (currentSession && isRememberMeActive()) {
          extendSession();
        }
      } catch (error) {
        console.error('Error loading session:', error);
        clearUserSession();
        setSession(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, []);

  // Auto-extend session on user activity (if remember me is active)
  const handleUserActivity = useCallback(() => {
    if (session && isRememberMeActive()) {
      extendSession();
    }
  }, [session]);

  // Setup activity listeners
  useEffect(() => {
    if (typeof window !== 'undefined' && session && isRememberMeActive()) {
      const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
      
      let activityTimeout: NodeJS.Timeout;
      
      const throttledActivityHandler = () => {
        clearTimeout(activityTimeout);
        activityTimeout = setTimeout(handleUserActivity, 60000); // Extend every minute of activity
      };

      events.forEach(event => {
        document.addEventListener(event, throttledActivityHandler, { passive: true });
      });

      return () => {
        clearTimeout(activityTimeout);
        events.forEach(event => {
          document.removeEventListener(event, throttledActivityHandler);
        });
      };
    }
  }, [session, handleUserActivity]);

  const logout = useCallback(() => {
    const currentSession = session;
    clearUserSession();
    setSession(null);
    
    // Redirect based on role
    if (currentSession?.role === 'admin' || currentSession?.role === 'staff') {
      router.push('/login');
    } else {
      router.push('/enter-phone');
    }
  }, [session, router]);

  const updateSession = useCallback((newSession: UserSession) => {
    setSession(newSession);
  }, []);

  return {
    session,
    isLoading,
    isAuthenticated: !!session,
    isRememberMe: isRememberMeActive(),
    logout,
    updateSession,
  };
} 