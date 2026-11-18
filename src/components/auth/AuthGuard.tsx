'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

interface AuthGuardProps {
  children: React.ReactNode;
  featureName?: string;
}

/**
 * AuthGuard
 * Automatically redirects unauthenticated users directly to the Sanket AI
 * interactive login/register page with zero intermediary prompt cards.
 */
export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      const redirectUrl = pathname ? `/auth/login?redirect=${encodeURIComponent(pathname)}` : '/auth/login';
      router.replace(redirectUrl);
    }
  }, [user, loading, router, pathname]);

  if (loading || !user) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4 p-8">
        <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono font-bold text-slate-500">
          Redirecting to Sanket AI Sign In...
        </span>
      </div>
    );
  }

  return <>{children}</>;
};
