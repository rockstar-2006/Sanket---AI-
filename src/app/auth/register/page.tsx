'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Video, ShieldCheck, Mail, Lock, User, AlertCircle, Stethoscope } from 'lucide-react';
import { UserRole } from '@/types';

export default function RegisterPage() {
  const router = useRouter();
  const { signUpWithEmail, signInWithGoogle } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('patient');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signUpWithEmail(email, password, name, role);
      router.push('/dashboard');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Registration failed. Please check inputs.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    try {
      await signInWithGoogle();
      router.push('/dashboard');
    } catch (err: any) {
      console.error(err);
      setError('Google Sign up failed.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary to-cyan-500 flex items-center justify-center text-white shadow-md">
            <Video className="w-6 h-6" />
          </div>
        </Link>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">
          Create <span className="text-primary">Matri Health</span> Account
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Join the next generation browser telehealth network
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-card rounded-3xl border border-slate-200 sm:px-10">
          
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              {error}
            </div>
          )}

          {/* Role Selection Tabs */}
          <div className="mb-6 grid grid-cols-2 gap-3 p-1 bg-slate-100 rounded-2xl">
            <button
              type="button"
              onClick={() => setRole('patient')}
              className={`py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                role === 'patient' 
                  ? 'bg-white text-primary shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <User className="w-4 h-4" /> Patient Account
            </button>
            <button
              type="button"
              onClick={() => setRole('doctor')}
              className={`py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                role === 'doctor' 
                  ? 'bg-white text-cyan-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Stethoscope className="w-4 h-4" /> Doctor Practitioner
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={role === 'doctor' ? "Dr. Sarah Jenkins" : "John Doe"}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@domain.com"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm shadow-soft transition disabled:opacity-50 mt-2"
            >
              {loading ? 'Creating Account...' : 'Register Account'}
            </button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-3 text-slate-400 font-semibold">Or continue with</span>
              </div>
            </div>

            <button
              onClick={handleGoogle}
              className="mt-4 w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold text-sm hover:bg-slate-50 transition"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              Google Authentication
            </button>
          </div>

          <div className="mt-8 text-center text-xs text-slate-500">
            Already registered?{' '}
            <Link href="/auth/login" className="font-bold text-primary hover:underline">
              Sign In
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
