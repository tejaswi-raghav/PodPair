// components/ui/AuthProvider.tsx
'use client';

import { useEffect } from 'react';
import { onAuthStateChanged } from '@/lib/firebase';
import { authApi } from '@/lib/api';
import { useAppStore } from '@/store';
import { getSocket } from '@/lib/socket';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setUser = useAppStore((s) => s.setUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        return;
      }

      try {
        const idToken = await firebaseUser.getIdToken();
        const { data } = await authApi.login(idToken);
        setUser(data.user);

        // Connect socket with authenticated userId
        getSocket(data.user.id);
      } catch (err: any) {
        // USER_NOT_REGISTERED — let login page handle redirect
        if (err.message !== 'USER_NOT_REGISTERED') {
          console.error('Auth sync error:', err);
        }
      }
    });

    return unsubscribe;
  }, [setUser]);

  return <>{children}</>;
}
