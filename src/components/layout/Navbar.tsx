'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useWallet } from '@/context/WalletContext';
import { 
  Video, 
  Menu, 
  X, 
  Download, 
  Zap, 
  Sparkles, 
  User, 
  LogOut, 
  PhoneCall, 
  Compass,
  HelpCircle,
  Laptop,
  CheckCircle2,
  ChevronDown,
  Layers,
  ArrowRight
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, profile, logout } = useAuth();
  const { credits, openRechargeModal } = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown or expanded menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
      if (menuOpen && menuContainerRef.current && !menuContainerRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  return (
    <header className="sticky top-4 z-50 w-full px-4 flex flex-col items-center pointer-events-none">
      
      {/* Unified Capsule that seamlessly morphs into the expanded menu container */}
      <div 
        ref={menuContainerRef}
        className={`pointer-events-auto bg-slate-900 text-white border border-slate-800 shadow-2xl transition-all duration-300 w-full max-w-4xl ${
          menuOpen ? 'rounded-3xl p-5 sm:p-7 space-y-6' : 'rounded-full px-4 sm:px-6 py-2'
        }`}
      >
        
        {/* Top Header Row (Always visible, seamlessly converts) */}
        <div className="flex items-center justify-between gap-3 sm:gap-6 w-full">
          
          {/* Left: Brand Logo */}
          <Link 
            href="/" 
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2.5 group shrink-0"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 p-1 flex items-center justify-center shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform">
              <svg viewBox="0 0 100 100" className="w-full h-full" fill="none">
                <path d="M 35 34 C 35 22, 45 18, 58 18 C 72 18, 78 27, 74 38 C 70 48, 56 50, 47 53 C 38 56, 30 62, 29 71 C 28 77, 31 79, 34 78" stroke="#FFFFFF" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M 65 66 C 65 78, 55 82, 42 82 C 28 82, 22 73, 26 62 C 30 52, 44 50, 53 47 C 62 44, 70 38, 71 29 C 72 23, 69 21, 66 22" stroke="#FFF7ED" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
                <circle cx="50" cy="50" r="8" fill="#38BDF8" />
                <path d="M 50 45 L 52 49 L 55 50 L 52 51 L 50 55 L 48 51 L 45 50 L 48 49 Z" fill="#FFFFFF" />
              </svg>
            </div>
            <span className="font-extrabold text-sm sm:text-base text-white tracking-tight font-heading">
              Sanket<span className="text-orange-500">.ai</span>
            </span>
          </Link>

          {/* Center Links (Visible when collapsed on desktop) */}
          {!menuOpen && (
            <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300">
              <Link 
                href="/" 
                prefetch={true}
                className="hover:text-white transition"
              >
                Home
              </Link>
              <Link 
                href="/call-center" 
                prefetch={true}
                className="hover:text-white transition flex items-center gap-1.5 text-orange-400 font-bold"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Telecom Relay</span>
              </Link>
              <Link 
                href="/consultation/create" 
                prefetch={true}
                className="hover:text-white transition"
              >
                Meetings
              </Link>
              <Link 
                href="/pricing" 
                prefetch={true}
                className="hover:text-white transition"
              >
                Pricing
              </Link>
            </nav>
          )}

          {/* Right Action Controls */}
          <div className="flex items-center gap-2.5 shrink-0">
            
            {/* Subtle Credit Balance Chip */}
            <button
              onClick={() => openRechargeModal()}
              title="Account Balance - Click to manage"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
            >
              <span className="text-slate-400 text-[11px] hidden sm:inline">Credits:</span>
              <span className="font-bold text-white font-mono">{credits}</span>
              <span className="w-4 h-4 rounded-full bg-orange-500/20 text-orange-400 font-bold text-[10px] flex items-center justify-center border border-orange-500/30 ml-0.5">
                +
              </span>
            </button>

            {/* User Profile or Sign In */}
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-1.5 p-1 rounded-full hover:bg-slate-800 transition cursor-pointer"
                  title={user.email || 'Account'}
                >
                  <div className="w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-xs shadow-sm overflow-hidden">
                    {profile?.photoURL ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (profile?.displayName || user.email || 'U').charAt(0).toUpperCase()
                    )}
                  </div>
                  <ChevronDown className="w-3 h-3 text-slate-400 hidden sm:block" />
                </button>

                {/* Profile Dropdown */}
                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-2 text-xs text-slate-300 space-y-1 animate-in fade-in zoom-in-95 duration-150 z-50">
                    <div className="px-3 py-2 border-b border-slate-800 text-[11px] text-slate-400 truncate">
                      {user.email}
                    </div>
                    <Link
                      href="/dashboard"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="block px-3 py-2 rounded-xl hover:bg-slate-800 hover:text-white transition"
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/profile"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="block px-3 py-2 rounded-xl hover:bg-slate-800 hover:text-white transition"
                    >
                      Profile Settings
                    </Link>
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        logout();
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-rose-500/10 text-rose-400 transition flex items-center justify-between cursor-pointer"
                    >
                      <span>Sign Out</span>
                      <LogOut className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/auth/login"
                className="hidden sm:inline-block px-3.5 py-1.5 rounded-full text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition"
              >
                Sign In
              </Link>
            )}

            {/* Quick Call Action (When Collapsed) */}
            {!menuOpen && (
              <Link
                href="/consultation/create"
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-white text-slate-900 hover:bg-slate-100 transition shadow-sm"
              >
                <span>Start</span>
              </Link>
            )}

            {/* Unified Menu Toggle Button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1.5 rounded-full text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              aria-label={menuOpen ? 'Close Menu' : 'Open Menu'}
              title={menuOpen ? 'Close' : 'Menu'}
            >
              {menuOpen ? <X className="w-5 h-5 text-orange-400" /> : <Menu className="w-5 h-5" />}
            </button>

          </div>

        </div>

        {/* ─── Expanded Menu Body (Clean, perfectly fills the space inside the same container) ─── */}
        {menuOpen && (
          <div className="space-y-6 pt-2 animate-in fade-in duration-200">
            
            {/* Primary Navigation Cards */}
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono block mb-3">
                Core Applications
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                
                <Link
                  href="/"
                  prefetch={true}
                  onClick={() => setMenuOpen(false)}
                  className="p-4 rounded-2xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 transition flex flex-col justify-between group"
                >
                  <div className="w-8 h-8 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                    <Compass className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white flex items-center justify-between">
                      <span>Home</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                    </h4>
                    <p className="text-[11px] text-slate-300 mt-0.5">Platform overview &amp; introduction</p>
                  </div>
                </Link>

                <Link
                  href="/call-center"
                  prefetch={true}
                  onClick={() => setMenuOpen(false)}
                  className="p-4 rounded-2xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 transition flex flex-col justify-between group"
                >
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                    <PhoneCall className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span>Telecom Relay</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                    </h4>
                    <p className="text-[11px] text-slate-300 mt-0.5">Live cellular phone call bridge</p>
                  </div>
                </Link>

                <Link
                  href="/consultation/create"
                  prefetch={true}
                  onClick={() => setMenuOpen(false)}
                  className="p-4 rounded-2xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 transition flex flex-col justify-between group"
                >
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                    <Video className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white flex items-center justify-between">
                      <span>New Meeting</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                    </h4>
                    <p className="text-[11px] text-slate-300 mt-0.5">3D Sign avatar &amp; STT subtitles</p>
                  </div>
                </Link>

                <Link
                  href="/consultation/join"
                  prefetch={true}
                  onClick={() => setMenuOpen(false)}
                  className="p-4 rounded-2xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 transition flex flex-col justify-between group"
                >
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white flex items-center justify-between">
                      <span>Join Call</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                    </h4>
                    <p className="text-[11px] text-slate-300 mt-0.5">Enter meeting room with code</p>
                  </div>
                </Link>

              </div>
            </div>

            {/* Secondary Sections & Resources */}
            <div className="pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              
              <Link
                href="/pricing"
                prefetch={true}
                onClick={() => setMenuOpen(false)}
                className="p-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 transition flex items-center justify-between text-white border border-slate-700"
              >
                <div>
                  <span className="font-bold block text-sm">Pricing &amp; Balance</span>
                  <span className="text-[11px] text-slate-300">Plans from ₹29 with UPI</span>
                </div>
                <span className="text-xs font-mono text-orange-400 font-bold">&rarr;</span>
              </Link>

              <Link
                href="/download"
                onClick={() => setMenuOpen(false)}
                className="p-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 transition flex items-center justify-between text-white border border-slate-700"
              >
                <div>
                  <span className="font-bold block text-sm">Download App</span>
                  <span className="text-[11px] text-slate-300">Desktop &amp; Mobile PWA</span>
                </div>
                <Laptop className="w-4 h-4 text-slate-400" />
              </Link>

              <button
                onClick={() => {
                  setMenuOpen(false);
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new Event('open-pwa-install'));
                  }
                }}
                className="p-3.5 rounded-2xl bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 border border-orange-500/30 transition flex items-center justify-between text-left cursor-pointer"
              >
                <div>
                  <span className="font-bold block text-sm">Install PWA</span>
                  <span className="text-[11px] text-orange-300">Run as native offline app</span>
                </div>
                <Download className="w-4 h-4 text-orange-400" />
              </button>

            </div>

            {/* Quick Informational Links Row */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
              <div className="flex items-center gap-4 flex-wrap">
                <Link 
                  href="/#features" 
                  onClick={() => setMenuOpen(false)}
                  className="hover:text-white transition"
                >
                  Key Features
                </Link>
                <Link 
                  href="/#how-it-works" 
                  onClick={() => setMenuOpen(false)}
                  className="hover:text-white transition"
                >
                  How It Works
                </Link>
                <Link 
                  href="/#faq" 
                  onClick={() => setMenuOpen(false)}
                  className="hover:text-white transition"
                >
                  FAQ &amp; Help
                </Link>
              </div>

              {user ? (
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-500 font-mono truncate max-w-[160px]">{user.email}</span>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                    }}
                    className="text-rose-400 font-bold hover:underline cursor-pointer"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <Link
                  href="/auth/login"
                  onClick={() => setMenuOpen(false)}
                  className="text-orange-400 font-bold hover:underline"
                >
                  Sign In to Account &rarr;
                </Link>
              )}
            </div>

          </div>
        )}

      </div>

    </header>
  );
};

