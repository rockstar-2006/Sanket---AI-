'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  Lock, 
  LogIn, 
  Sparkles, 
  ShieldCheck, 
  ArrowRight, 
  Video, 
  PhoneCall, 
  Zap 
} from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
  featureName?: string;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ 
  children, 
  featureName = 'Telecom Relay & Video Meetings' 
}) => {
  const { user, loading, signInWithGoogle } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4 p-8">
        <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono text-slate-400">Verifying secure authentication...</span>
      </div>
    );
  }

  if (!user) {
    const loginRedirectUrl = `/auth/login?redirect=${encodeURIComponent(pathname || '/')}`;
    const registerRedirectUrl = `/auth/register?redirect=${encodeURIComponent(pathname || '/')}`;

    return (
      <div className="min-h-[75vh] flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-lg bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-10 shadow-xl text-slate-900 space-y-6 relative overflow-hidden">
          
          {/* Top Badge */}
          <div className="flex items-center justify-between">
            <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase bg-orange-50 text-orange-700 border border-orange-200 flex items-center gap-1.5 shadow-xs">
              <Lock className="w-3 h-3 text-orange-600" />
              <span>Authentication Required</span>
            </span>

            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
              100 Credits Included
            </span>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-heading">
              Sign in to Access {featureName}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-body">
              To connect securely to real-time telecom trunks and accessible meeting rooms, a verified account is required. Every account includes starter balance for testing.
            </p>
          </div>

          {/* Quick Features List */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5 text-xs text-slate-600">
            <div className="flex items-center gap-2.5">
              <Zap className="w-4 h-4 text-orange-500 shrink-0" />
              <span>100 Starter Credits included automatically with your account.</span>
            </div>
            <div className="flex items-center gap-2.5">
              <PhoneCall className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Cellular telephone relay with live on-device speech-to-sign.</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Video className="w-4 h-4 text-cyan-600 shrink-0" />
              <span>Encrypted video meetings with 3D sign interpreter and STT subtitles.</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            <button
              onClick={async () => {
                try {
                  await signInWithGoogle();
                } catch (e) {
                  console.error('Google Sign In Error', e);
                }
              }}
              className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs transition flex items-center justify-center gap-2.5 border border-slate-200 shadow-sm cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="grid grid-cols-2 gap-2.5">
              <Link
                href={loginRedirectUrl}
                className="py-3 px-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs text-center transition flex items-center justify-center gap-1.5 shadow-xs"
              >
                <LogIn className="w-3.5 h-3.5 text-slate-300" />
                <span>Sign In</span>
              </Link>

              <Link
                href={registerRedirectUrl}
                className="py-3 px-3 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs text-center transition flex items-center justify-center gap-1.5 shadow-sm shadow-orange-500/20"
              >
                <span>Register</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          <div className="text-center">
            <Link href="/" className="text-[11px] font-mono text-slate-500 hover:text-slate-800 transition">
              &larr; Return to Home
            </Link>
          </div>

        </div>
      </div>
    );
  }

  return <>{children}</>;
};
