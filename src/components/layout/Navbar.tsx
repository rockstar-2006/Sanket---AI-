'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Sparkles, ArrowRight, User, LogOut, Video, Menu, X } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, profile, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-4 z-50 w-full px-4 flex flex-col items-center pointer-events-none">
      
      {/* Floating Capsule Dock Container */}
      <div className="pointer-events-auto bg-slate-900/95 text-white backdrop-blur-xl border border-slate-800 shadow-2xl rounded-full p-2 pl-3 pr-3 flex items-center justify-between gap-3 sm:gap-6 w-full sm:w-auto max-w-fit transition-all duration-300">
        
        {/* Left Circular White Logo Pill */}
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="w-10 h-10 rounded-full bg-white text-slate-900 flex items-center justify-center font-black shadow-md group-hover:scale-105 transition-transform">
            <Video className="w-5 h-5 text-orange-500" />
          </div>
          <span className="font-extrabold text-base text-white tracking-tight pr-1">
            Sanket<span className="w-1.5 h-1.5 rounded-full bg-orange-500 ml-0.5 inline-block" />
          </span>
        </Link>

        {/* Center Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-6 text-xs font-bold text-slate-300">
          <Link href="/" className="text-white hover:text-orange-400 transition">
            Home
          </Link>
          <Link href="/#features" className="hover:text-orange-400 transition">
            Features
          </Link>
          <Link href="/#solutions" className="hover:text-orange-400 transition">
            Solutions
          </Link>
          <Link href="/#how-it-works" className="hover:text-orange-400 transition">
            How It Works
          </Link>
          <Link href="/test-avatar" className="text-orange-400 hover:text-orange-300 font-extrabold transition flex items-center gap-1">
            <span>3D Sign Studio</span>
          </Link>
          {user && (
            <Link href="/dashboard" className="hover:text-orange-400 transition">
              Dashboard
            </Link>
          )}
        </nav>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {user ? (
            <>
              <Link
                href="/consultation/create"
                className="flex items-center gap-1.5 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs font-extrabold bg-white text-slate-900 hover:bg-slate-100 shadow-md transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                <span>New Call</span>
              </Link>

              <Link href="/profile" className="hidden sm:flex items-center gap-2 group">
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-orange-400 text-xs overflow-hidden">
                  {profile?.photoURL ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.photoURL} alt={profile.displayName || ''} className="w-full h-full object-cover" />
                  ) : (
                    (profile?.displayName || user.email || 'U').charAt(0).toUpperCase()
                  )}
                </div>
              </Link>

              <button
                onClick={logout}
                title="Sign Out"
                className="hidden sm:block p-2 text-slate-400 hover:text-rose-400 rounded-full hover:bg-slate-800 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/auth/login"
                className="hidden sm:inline-block px-3.5 py-2 rounded-full text-xs font-bold text-slate-300 hover:text-white transition"
              >
                Sign In
              </Link>

              <Link
                href="/consultation/create"
                className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs font-extrabold bg-white text-slate-900 hover:bg-slate-100 shadow-md flex items-center gap-1.5 transition"
              >
                <span>Start Call</span>
                <ArrowRight className="w-3.5 h-3.5 text-orange-500" />
              </Link>
            </div>
          )}

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-slate-300 hover:text-white rounded-full hover:bg-slate-800 transition"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-orange-400" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

      </div>

      {/* Mobile Drawer Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="pointer-events-auto mt-3 w-full max-w-sm rounded-3xl bg-slate-900/98 text-white border border-slate-800 shadow-2xl p-5 space-y-4 backdrop-blur-2xl">
          <div className="flex flex-col space-y-3 font-semibold text-sm">
            <Link onClick={() => setMobileMenuOpen(false)} href="/" className="px-3 py-2 rounded-xl hover:bg-slate-800 transition">
              Home
            </Link>
            <Link onClick={() => setMobileMenuOpen(false)} href="/#features" className="px-3 py-2 rounded-xl hover:bg-slate-800 transition">
              Features
            </Link>
            <Link onClick={() => setMobileMenuOpen(false)} href="/#solutions" className="px-3 py-2 rounded-xl hover:bg-slate-800 transition">
              Solutions
            </Link>
            <Link onClick={() => setMobileMenuOpen(false)} href="/#how-it-works" className="px-3 py-2 rounded-xl hover:bg-slate-800 transition">
              How It Works
            </Link>
            <Link onClick={() => setMobileMenuOpen(false)} href="/#faq" className="px-3 py-2 rounded-xl hover:bg-slate-800 transition">
              Help
            </Link>
            {user && (
              <Link onClick={() => setMobileMenuOpen(false)} href="/dashboard" className="px-3 py-2 rounded-xl bg-orange-500/20 text-orange-400 font-bold transition">
                Dashboard
              </Link>
            )}
          </div>

          {user && (
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="truncate max-w-[180px]">{user.email}</span>
              <button onClick={logout} className="text-rose-400 font-bold hover:underline">
                Sign Out
              </button>
            </div>
          )}
        </div>
      )}

    </header>
  );
};
