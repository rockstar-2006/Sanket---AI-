'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Download, Monitor, Smartphone, X, CheckCircle2, Share2, PlusSquare } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(true);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isDesktop, setIsDesktop] = useState<boolean>(true);
  const [showIosGuide, setShowIosGuide] = useState<boolean>(false);
  const [showAndroidGuide, setShowAndroidGuide] = useState<boolean>(false);

  // Helper to grab prompt event either from state or early window capturer
  const getPromptEvent = useCallback((): BeforeInstallPromptEvent | null => {
    if (deferredPrompt) return deferredPrompt;
    if (typeof window !== 'undefined' && (window as any).__pwaInstallPrompt) {
      return (window as any).__pwaInstallPrompt;
    }
    return null;
  }, [deferredPrompt]);

  useEffect(() => {
    // 0. Check localStorage dismissal and install flags
    try {
      const alreadyInstalled = localStorage.getItem('sanket_pwa_installed') === 'true';
      const dismissedTime = localStorage.getItem('sanket_pwa_dismissed_time');
      const isDismissedRecently = dismissedTime && Date.now() - Number(dismissedTime) < 24 * 60 * 60 * 1000;

      if (alreadyInstalled || isDismissedRecently) {
        setIsDismissed(true);
        if (alreadyInstalled) setIsInstalled(true);
      } else {
        setIsDismissed(false);
      }
    } catch {
      setIsDismissed(false);
    }

    // 1. Register Service Worker on client load
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const registerSW = () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            reg.update().catch(() => {});
          })
          .catch(() => {});
      };

      if (document.readyState === 'complete') {
        registerSW();
      } else {
        window.addEventListener('load', registerSW, { once: true });
      }
    }

    // 2. Check if already running in standalone / installed PWA window
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(isStandaloneMode);
      if (isStandaloneMode) {
        try {
          localStorage.setItem('sanket_pwa_installed', 'true');
        } catch {}
      }
    };

    checkStandalone();

    // 3. Platform Detection
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    const isMobileDevice = /android|iphone|ipad|ipod|mobile/.test(userAgent);

    setIsIOS(isIosDevice);
    setIsDesktop(!isMobileDevice);

    // 4. Check for early captured prompt
    if (typeof window !== 'undefined' && (window as any).__pwaInstallPrompt) {
      setDeferredPrompt((window as any).__pwaInstallPrompt);
    }

    // 5. Event Listeners for beforeinstallprompt & appinstalled
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).__pwaInstallPrompt = e;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handlePromptAvailable = () => {
      if (typeof window !== 'undefined' && (window as any).__pwaInstallPrompt) {
        setDeferredPrompt((window as any).__pwaInstallPrompt);
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      if (typeof window !== 'undefined') (window as any).__pwaInstallPrompt = null;
      try {
        localStorage.setItem('sanket_pwa_installed', 'true');
        localStorage.setItem('sanket_pwa_dismissed_time', String(Date.now()));
      } catch {}
      setTimeout(() => {
        setIsDismissed(true);
      }, 4000);
    };

    // 6. External Trigger (e.g. from Navbar or drawer button)
    const handleOpenCustomEvent = async () => {
      setIsDismissed(false);
      const prompt = (window as any).__pwaInstallPrompt || deferredPrompt;
      if (prompt) {
        try {
          await prompt.prompt();
          const choiceResult = await prompt.userChoice;
          if (choiceResult?.outcome === 'accepted') {
            setIsInstalled(true);
            try {
              localStorage.setItem('sanket_pwa_installed', 'true');
            } catch {}
          }
        } catch (err) {
          console.error('[PWA] Prompt call error:', err);
        }
        return;
      }

      if (isIosDevice) {
        setShowIosGuide(true);
      } else if (isMobileDevice) {
        setShowAndroidGuide(true);
      } else {
        alert('To install Sanket AI on desktop: click the install icon in your browser address bar.');
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('pwa-prompt-available', handlePromptAvailable);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('open-pwa-install', handleOpenCustomEvent);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pwa-prompt-available', handlePromptAvailable);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('open-pwa-install', handleOpenCustomEvent);
    };
  }, []);

  const handleDismiss = () => {
    try {
      localStorage.setItem('sanket_pwa_dismissed_time', String(Date.now()));
    } catch {}
    setIsDismissed(true);
    setShowIosGuide(false);
    setShowAndroidGuide(false);
  };

  const handleInstallClick = async () => {
    const prompt = getPromptEvent();

    if (prompt) {
      try {
        await prompt.prompt();
        const choiceResult = await prompt.userChoice;
        if (choiceResult?.outcome === 'accepted') {
          setIsInstalled(true);
          try {
            localStorage.setItem('sanket_pwa_installed', 'true');
            localStorage.setItem('sanket_pwa_dismissed_time', String(Date.now()));
          } catch {}
        }
      } catch (err) {
        console.error('[PWA] Prompt error:', err);
      }
      setDeferredPrompt(null);
      if (typeof window !== 'undefined') (window as any).__pwaInstallPrompt = null;
      return;
    }

    if (isIOS) {
      setShowIosGuide(true);
      return;
    }

    if (!isDesktop) {
      setShowAndroidGuide(true);
      return;
    }

    alert('To install Sanket AI on desktop: click the install icon in your browser address bar.');
  };

  // If already running in installed standalone window, don't show prompt
  if (isStandalone || isDismissed) {
    return null;
  }

  // If already successfully installed
  if (isInstalled) {
    return (
      <div className="fixed bottom-5 right-5 z-50 bg-slate-900/95 border border-emerald-500/40 text-white px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
        <div>
          <p className="text-xs font-bold text-emerald-300">App Ready!</p>
          <p className="text-[11px] text-slate-300">Sanket AI is now installed on your device.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Floating Install Prompt Banner (Bottom Right on Desktop, Bottom Center on Mobile) */}
      <div className="fixed bottom-4 sm:bottom-5 inset-x-4 sm:inset-x-auto sm:right-5 z-50 max-w-sm sm:w-auto bg-slate-900/95 border border-slate-700/80 text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl backdrop-blur-xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 p-1 flex items-center justify-center shadow-md shadow-orange-500/20 shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full" fill="none">
                <path d="M 35 34 C 35 22, 45 18, 58 18 C 72 18, 78 27, 74 38 C 70 48, 56 50, 47 53 C 38 56, 30 62, 29 71 C 28 77, 31 79, 34 78" stroke="#FFFFFF" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M 65 66 C 65 78, 55 82, 42 82 C 28 82, 22 73, 26 62 C 30 52, 44 50, 53 47 C 62 44, 70 38, 71 29 C 72 23, 69 21, 66 22" stroke="#FFF7ED" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
                <circle cx="50" cy="50" r="8" fill="#38BDF8" />
                <path d="M 50 45 L 52 49 L 55 50 L 52 51 L 50 55 L 48 51 L 45 50 L 48 49 Z" fill="#FFFFFF" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-extrabold text-white tracking-tight">
                  {isDesktop ? 'Install Sanket AI Desktop' : 'Install Sanket AI App'}
                </span>
                <span className="text-[9px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full border border-orange-500/30">
                  PWA
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                {isDesktop
                  ? 'Standalone window, zero browser tabs, faster 60 FPS sign recognition.'
                  : 'Fast home screen access, instant video meetings with 1 tap.'}
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={handleInstallClick}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-md shadow-orange-500/20 transition active:scale-95 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isDesktop ? 'Install Desktop App' : 'Install App'}</span>
          </button>
          <button
            onClick={handleDismiss}
            className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
          >
            Maybe Later
          </button>
        </div>
      </div>

      {/* iOS Safari Step-by-Step Installation Modal */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full text-white shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-orange-400" />
                <h3 className="font-bold text-sm">Install on iPhone / iPad</h3>
              </div>
              <button
                onClick={handleDismiss}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Apple Safari installs Sanket AI directly to your iPhone Home Screen:
            </p>

            <div className="space-y-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-orange-400 font-bold shrink-0">
                  1
                </div>
                <div className="flex items-center gap-2 text-slate-200">
                  <span>Tap Safari&apos;s <strong>Share</strong> button</span>
                  <Share2 className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>at the bottom toolbar.</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-orange-400 font-bold shrink-0">
                  2
                </div>
                <div className="flex items-center gap-2 text-slate-200">
                  <span>Scroll down and tap <strong>Add to Home Screen</strong></span>
                  <PlusSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-orange-400 font-bold shrink-0">
                  3
                </div>
                <div className="text-slate-200">
                  Tap <strong>Add</strong> in the top-right corner to finish.
                </div>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              className="mt-5 w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 font-bold text-xs text-white transition cursor-pointer"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* Android Alternative Fallback Guide (Only if native prompt was unavailable) */}
      {showAndroidGuide && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full text-white shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-orange-400" />
                <h3 className="font-bold text-sm">Install on Android</h3>
              </div>
              <button
                onClick={() => setShowAndroidGuide(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              To install Sanket AI directly onto your Android device:
            </p>

            <div className="space-y-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-orange-400 font-bold shrink-0">
                  1
                </div>
                <div className="text-slate-200">
                  Tap the <strong>three dots (⋮)</strong> menu in Chrome&apos;s top right corner.
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-orange-400 font-bold shrink-0">
                  2
                </div>
                <div className="text-slate-200">
                  Select <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowAndroidGuide(false)}
              className="mt-5 w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 font-bold text-xs text-white transition cursor-pointer"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </>
  );
};
