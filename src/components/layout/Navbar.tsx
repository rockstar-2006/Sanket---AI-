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
  KeyRound,
  Activity,
  LogOut, 
  PhoneCall, 
  Compass, 
  Laptop, 
  ChevronDown, 
  ArrowRight,
  Shield,
  Layers,
  ExternalLink,
  CreditCard,
  Database
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, profile, logout } = useAuth();
  const { credits, openRechargeModal } = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Typewriter tagline when side drawer opens
  const [typewriterText, setTypewriterText] = useState('');
  const fullTagline = "Accessible video meetings & real-time telecom relay.";

  useEffect(() => {
    if (!menuOpen) {
      setTypewriterText('');
      return;
    }

    let idx = 0;
    const interval = setInterval(() => {
      if (idx < fullTagline.length) {
        setTypewriterText(fullTagline.slice(0, idx + 1));
        idx++;
      } else {
        clearInterval(interval);
      }
    }, 22);

    return () => clearInterval(interval);
  }, [menuOpen]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  // Close profile dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navMenuItems = [
    {
      title: 'Home',
      desc: 'Platform overview & ecosystem',
      href: '/',
      icon: Compass,
      badge: null,
      accent: 'text-orange-400 bg-orange-500/10 border-orange-500/20 group-hover:bg-orange-500/20 group-hover:border-orange-500/40',
      glow: 'group-hover:shadow-[0_0_20px_-5px_rgba(249,115,22,0.3)]',
    },
    {
      title: 'Telecom Relay',
      desc: 'Live cellular voice call bridge',
      href: '/call-center',
      icon: PhoneCall,
      badge: 'LIVE RELAY',
      targetId: 'tour-telecom-relay',
      accent: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 group-hover:bg-emerald-500/20 group-hover:border-emerald-500/40',
      glow: 'group-hover:shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]',
    },
    {
      title: 'New Video Meeting',
      desc: 'Accessible video & real-time captions',
      href: '/consultation/create',
      icon: Video,
      badge: 'ISL',
      accent: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20 group-hover:bg-cyan-500/20 group-hover:border-cyan-500/40',
      glow: 'group-hover:shadow-[0_0_20px_-5px_rgba(6,182,212,0.3)]',
    },
    {
      title: 'Join Call with Code',
      desc: 'Enter room session directly',
      href: '/consultation/join',
      icon: KeyRound,
      badge: null,
      accent: 'text-amber-400 bg-amber-500/10 border-amber-500/20 group-hover:bg-amber-500/20 group-hover:border-amber-500/40',
      glow: 'group-hover:shadow-[0_0_20px_-5px_rgba(245,158,11,0.3)]',
    },
    {
      title: 'Pricing & Wallet',
      desc: 'Flexible UPI plans from ₹29',
      href: '/pricing',
      icon: Zap,
      badge: 'UPI',
      accent: 'text-orange-400 bg-orange-500/10 border-orange-500/20 group-hover:bg-orange-500/20 group-hover:border-orange-500/40',
      glow: 'group-hover:shadow-[0_0_20px_-5px_rgba(249,115,22,0.3)]',
    },
    {
      title: 'Download App',
      desc: 'Install native PWA on Desktop & Mobile',
      href: '/download',
      icon: Laptop,
      badge: 'PWA',
      accent: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20 group-hover:bg-indigo-500/20 group-hover:border-indigo-500/40',
      glow: 'group-hover:shadow-[0_0_20px_-5px_rgba(99,102,241,0.3)]',
    },
    {
      title: 'Dataset & Docs',
      desc: '288 ISL motion files, schema & CLI',
      href: '/docs',
      icon: Database,
      badge: 'CLI',
      accent: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 group-hover:bg-emerald-500/20 group-hover:border-emerald-500/40',
      glow: 'group-hover:shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]',
    },
  ];

  return (
    <>
      {/* ──────────────────────────────────────────────────────────── */}
      {/* 1. COMPACT CAPSULE NAVBAR (Always pristine, never deformed)  */}
      {/* ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-4 z-40 w-full px-4 flex flex-col items-center pointer-events-none">
        <div className="pointer-events-auto bg-slate-900/95 backdrop-blur-md text-white border border-slate-800 shadow-2xl rounded-full px-4 sm:px-6 py-2 transition-all duration-300 w-full max-w-4xl flex items-center justify-between gap-3 sm:gap-6">
          
          {/* Left: Brand Monogram & Logo */}
          <Link 
            href="/" 
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

          {/* Desktop Center Links (Fast Direct Access) */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300 font-heading">
            <Link 
              href="/" 
              prefetch={true}
              className="hover:text-white transition"
            >
              Home
            </Link>
            <Link 
              id="tour-telecom-relay"
              href="/call-center" 
              prefetch={true}
              className="hover:text-white transition flex items-center gap-1.5 text-orange-400 font-bold px-2.5 py-1 rounded-full bg-slate-800/60 border border-orange-500/20"
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

          {/* Right Action Controls */}
          <div className="flex items-center gap-2.5 shrink-0">
            
            {/* Credit Balance Chip (Authenticated) */}
            {user && (
              <button
                onClick={() => openRechargeModal()}
                title="Account Balance - Click to top up"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
              >
                <span className="text-slate-400 text-[11px] hidden sm:inline font-mono">Credits:</span>
                <span className="font-bold text-white font-mono">{credits}</span>
                <span className="w-4 h-4 rounded-full bg-orange-500/20 text-orange-400 font-bold text-[10px] flex items-center justify-center border border-orange-500/30 ml-0.5">
                  +
                </span>
              </button>
            )}

            {/* Profile Dropdown (Desktop) */}
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-1.5 p-1 rounded-full hover:bg-slate-800 transition cursor-pointer"
                  title={user.email || 'Account'}
                >
                  <div className="w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-xs shadow-sm overflow-hidden font-heading">
                    {profile?.photoURL ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (profile?.displayName || user.email || 'U').charAt(0).toUpperCase()
                    )}
                  </div>
                  <ChevronDown className="w-3 h-3 text-slate-400 hidden sm:block" />
                </button>

                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-2 text-xs text-slate-300 space-y-1 animate-in fade-in zoom-in-95 duration-150 z-50 font-body">
                    <div className="px-3 py-2 border-b border-slate-800 text-[11px] text-slate-400 truncate font-mono">
                      {user.email}
                    </div>
                    <Link
                      href="/dashboard"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="block px-3 py-2 rounded-xl hover:bg-slate-800 hover:text-white transition font-heading font-medium"
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/profile"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="block px-3 py-2 rounded-xl hover:bg-slate-800 hover:text-white transition font-heading font-medium"
                    >
                      Profile Settings
                    </Link>
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        logout();
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-rose-500/10 text-rose-400 transition flex items-center justify-between cursor-pointer font-heading font-medium"
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
                className="hidden sm:inline-block px-3.5 py-1.5 rounded-full text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition font-heading"
              >
                Sign In
              </Link>
            )}

            {/* Quick Start Button (Desktop) */}
            <Link
              href="/consultation/create"
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-white text-slate-900 hover:bg-slate-100 transition shadow-sm font-heading"
            >
              <span>Start</span>
            </Link>

            {/* 3-LINE HAMBURGER TOGGLE BUTTON */}
            <button
              onClick={() => setMenuOpen(true)}
              className="p-1.5 sm:p-2 rounded-full text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer flex items-center justify-center"
              aria-label="Open Navigation Drawer"
              title="Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

          </div>

        </div>
      </header>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 2. SOLID MODERN NAVIGATION DRAWER (100% Opaque, High Craft)  */}
      {/* ──────────────────────────────────────────────────────────── */}
      {menuOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          
          {/* Deep Solid Backdrop Overlay for Desktop / Tablet */}
          <div 
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 bg-[#060a12]/95 backdrop-blur-md animate-in fade-in duration-200 cursor-pointer"
          />

          {/* Solid Navigation Drawer: Full-screen on mobile (<sm), solid side sheet on sm+ */}
          <div className="relative w-full sm:max-w-md h-full bg-[#0b0f19] border-l border-slate-800 shadow-2xl flex flex-col justify-between p-5 sm:p-6 pb-8 sm:pb-6 overflow-y-auto z-10 animate-in slide-in-from-right duration-300 ease-out select-none">
            
            {/* Ambient Lighting Gradients (Inside Drawer Only - 100% Opaque Exterior) */}
            <div className="absolute -top-24 -right-24 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute top-1/2 -left-28 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Top Section */}
            <div className="relative z-10 space-y-4 sm:space-y-5">
              
              {/* Drawer Header: Brand + Status Pill + Close Button */}
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 p-1 flex items-center justify-center shadow-md shadow-orange-500/20">
                    <svg viewBox="0 0 100 100" className="w-full h-full" fill="none">
                      <path d="M 35 34 C 35 22, 45 18, 58 18 C 72 18, 78 27, 74 38 C 70 48, 56 50, 47 53 C 38 56, 30 62, 29 71 C 28 77, 31 79, 34 78" stroke="#FFFFFF" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M 65 66 C 65 78, 55 82, 42 82 C 28 82, 22 73, 26 62 C 30 52, 44 50, 53 47 C 62 44, 70 38, 71 29 C 72 23, 69 21, 66 22" stroke="#FFF7ED" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
                      <circle cx="50" cy="50" r="8" fill="#38BDF8" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-white tracking-tight font-heading block leading-none">
                        Sanket<span className="text-orange-500">.ai</span>
                      </span>
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 font-mono text-[8px] font-bold">
                        <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                        LIVE
                      </span>
                    </div>
                    <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400 block mt-0.5">
                      Platform Navigation
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setMenuOpen(false)}
                  className="w-8 h-8 rounded-full bg-[#131b2e] hover:bg-[#1a253f] text-slate-300 hover:text-white border border-slate-700/80 flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm group"
                  aria-label="Close Drawer"
                >
                  <X className="w-4 h-4 group-hover:rotate-90 transition-transform duration-200" />
                </button>
              </div>

              {/* Kinetic Typing Animated Tagline (Aesthetic Terminal Style) */}
              <div className="px-4 py-3 rounded-2xl bg-gradient-to-b from-[#141b2c] to-[#0f1523] border border-slate-800 min-h-[50px] flex flex-col justify-center shadow-inner relative overflow-hidden group">
                <div className="flex items-center gap-1.5 mb-1">
                  <Activity className="w-3 h-3 text-orange-400" />
                  <span className="text-[9px] font-mono font-bold tracking-wider text-orange-400/90 uppercase">
                    AI Assistive Core
                  </span>
                </div>
                <p className="font-body text-xs text-slate-200 font-medium leading-snug">
                  {typewriterText}
                  <span className="inline-block w-1.5 h-3 ml-1 bg-orange-500 animate-pulse align-middle shadow-sm shadow-orange-500/50" />
                </p>
              </div>

              {/* Staggered Navigation Items (Appearing One by One) */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
                    Core Applications
                  </span>
                  <span className="text-[9px] font-mono text-slate-500 font-semibold">
                    6 Services
                  </span>
                </div>

                <div className="space-y-1.5">
                  {navMenuItems.map((item, idx) => {
                    const IconComponent = item.icon;
                    return (
                      <Link
                        key={item.title}
                        id={item.targetId}
                        href={item.href}
                        onClick={() => setMenuOpen(false)}
                        className={`group flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-[#111726] to-[#121929] hover:from-[#151f33] hover:to-[#1a2640] border border-slate-800/90 hover:border-orange-500/40 transition-all duration-200 hover:translate-x-0.5 ${item.glow || ''}`}
                        style={{
                          animationName: 'slideInMenuItem',
                          animationDuration: '0.32s',
                          animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                          animationFillMode: 'forwards',
                          animationDelay: `${idx * 45}ms`,
                          opacity: 0,
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shadow-xs group-hover:scale-105 transition-transform ${item.accent}`}>
                            <IconComponent className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-heading font-bold text-xs sm:text-sm text-slate-100 group-hover:text-orange-400 transition-colors">
                                {item.title}
                              </h4>
                              {item.badge && (
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold border ${
                                  item.badge === 'LIVE RELAY'
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                                    : 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                                }`}>
                                  {item.badge}
                                </span>
                              )}
                            </div>
                            <p className="font-body text-[11px] text-slate-400 group-hover:text-slate-300 transition-colors">
                              {item.desc}
                            </p>
                          </div>
                        </div>

                        <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-orange-400 group-hover:translate-x-1 transition-all shrink-0" />
                      </Link>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Bottom Section: Wallet, Profile & Actions */}
            <div className="relative z-10 pt-4 border-t border-slate-800/80 space-y-3">
              
              {/* Wallet Credits Bar (Solid Card with Dual Tone Border) */}
              {user ? (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#151c2d] via-[#121827] to-[#181c29] border border-orange-500/30 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold text-xs border border-orange-500/30 shadow-xs">
                      ₹
                    </div>
                    <div>
                      <span className="block text-[9px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                        Wallet Credits
                      </span>
                      <span className="font-mono text-xs font-black text-amber-400 flex items-center gap-1">
                        <span>{credits}</span>
                        <span className="text-[10px] text-slate-400 font-normal">Available</span>
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      openRechargeModal();
                    }}
                    className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-heading font-extrabold text-[11px] shadow-sm shadow-orange-500/20 active:scale-95 transition-all cursor-pointer"
                  >
                    + Top Up
                  </button>
                </div>
              ) : (
                <Link
                  href="/auth/login"
                  onClick={() => setMenuOpen(false)}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-heading font-extrabold text-xs shadow-md transition flex items-center justify-center gap-2"
                >
                  <span>Sign In to Account</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}

              {/* User Profile or PWA Install Action */}
              <div className="flex items-center justify-between text-xs pt-1">
                {user ? (
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2 truncate pr-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0 font-heading shadow-xs">
                        {(profile?.displayName || user.email || 'U').charAt(0).toUpperCase()}
                      </div>
                      <span className="text-[11px] font-mono text-slate-300 truncate max-w-[160px]">
                        {user.email}
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        logout();
                      }}
                      className="text-rose-400 hover:text-rose-300 font-heading font-bold text-xs cursor-pointer flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-lg hover:bg-rose-500/10 transition"
                    >
                      <LogOut className="w-3 h-3" />
                      <span>Exit</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new Event('open-pwa-install'));
                      }
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-[#111726] hover:bg-[#162035] text-slate-200 border border-slate-800 font-heading font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-orange-400" />
                    <span>Install Offline App</span>
                  </button>
                )}
              </div>

            </div>

            <style>{`
              @keyframes slideInMenuItem {
                from {
                  opacity: 0;
                  transform: translateX(20px);
                }
                to {
                  opacity: 1;
                  transform: translateX(0);
                }
              }
            `}</style>

          </div>

        </div>
      )}
    </>
  );
};
