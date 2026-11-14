'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { 
  Download, 
  Monitor, 
  Smartphone, 
  Laptop, 
  Apple, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  Maximize2, 
  Video, 
  Share2, 
  PlusSquare,
  HelpCircle,
  Volume2,
  Calendar,
  Layers
} from 'lucide-react';

type PlatformId = 'windows' | 'mac' | 'android' | 'ios' | 'linux';

interface PlatformInfo {
  id: PlatformId;
  name: string;
  category: 'desktop' | 'mobile';
  icon: React.ReactNode;
  recommendedBrowser: string;
  steps: { title: string; desc: string; icon: React.ReactNode }[];
}

const fadeInUp = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: false, amount: 0.2 },
  transition: { duration: 0.75, ease: [0.25, 1, 0.5, 1] as const },
};

const fadeInScale = {
  initial: { opacity: 0, scale: 0.92, y: 20 },
  whileInView: { opacity: 1, scale: 1, y: 0 },
  viewport: { once: false, amount: 0.2 },
  transition: { duration: 0.7, ease: [0.25, 1, 0.5, 1] as const },
};

export default function DownloadPage() {
  const [detectedOs, setDetectedOs] = useState<PlatformId>('windows');
  const [activePlatform, setActivePlatform] = useState<PlatformId>('windows');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ua = navigator.userAgent.toLowerCase();
      let platform: PlatformId = 'windows';

      if (/iphone|ipad|ipod/.test(ua)) {
        platform = 'ios';
      } else if (/android/.test(ua)) {
        platform = 'android';
      } else if (/macintosh|mac os x/.test(ua)) {
        platform = 'mac';
      } else if (/linux/.test(ua)) {
        platform = 'linux';
      } else {
        platform = 'windows';
      }

      setDetectedOs(platform);
      setActivePlatform(platform);
    }
  }, []);

  const triggerInstallPrompt = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('open-pwa-install'));
    }
  };

  const platforms: Record<PlatformId, PlatformInfo> = {
    windows: {
      id: 'windows',
      name: 'Windows 11 / 10',
      category: 'desktop',
      icon: <Monitor className="w-5 h-5 text-sky-500" />,
      recommendedBrowser: 'Google Chrome, Microsoft Edge, Brave',
      steps: [
        {
          title: '1. Click "Install App Now"',
          desc: 'Click the primary button below or the install icon (⊞ or ⬇) in your browser address bar.',
          icon: <Download className="w-5 h-5 text-orange-500" />
        },
        {
          title: '2. Confirm Browser Dialog',
          desc: 'Click "Install" to create instant desktop shortcuts and pin Sanket AI to your Windows Taskbar.',
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        },
        {
          title: '3. Launch Standalone Window',
          desc: 'Enjoy a clean, distraction-free meeting experience powered by 60 FPS hardware GPU acceleration.',
          icon: <Maximize2 className="w-5 h-5 text-indigo-500" />
        }
      ]
    },
    mac: {
      id: 'mac',
      name: 'macOS (Apple Silicon & Intel)',
      category: 'desktop',
      icon: <Apple className="w-5 h-5 text-slate-800" />,
      recommendedBrowser: 'Safari (macOS Sonoma+), Chrome, Edge',
      steps: [
        {
          title: '1. Open in Safari or Chrome',
          desc: 'In Safari: Click File > Add to Dock... In Chrome: Click the install icon in the address bar.',
          icon: <Share2 className="w-5 h-5 text-orange-500" />
        },
        {
          title: '2. Add to macOS Dock',
          desc: 'Keep "Sanket AI" as the title and click Add. It now integrates like a native macOS app.',
          icon: <PlusSquare className="w-5 h-5 text-emerald-500" />
        },
        {
          title: '3. Instant Apple Metal Speed',
          desc: 'Launch meetings straight from your Dock or Launchpad with full Apple GPU acceleration.',
          icon: <Zap className="w-5 h-5 text-amber-500" />
        }
      ]
    },
    android: {
      id: 'android',
      name: 'Android Phones & Tablets',
      category: 'mobile',
      icon: <Smartphone className="w-5 h-5 text-emerald-500" />,
      recommendedBrowser: 'Google Chrome, Samsung Internet',
      steps: [
        {
          title: '1. Tap Install / Add to Home',
          desc: 'Tap "Install for Android" below or open Chrome’s top menu (⋮) > "Install App".',
          icon: <Download className="w-5 h-5 text-orange-500" />
        },
        {
          title: '2. Instant Home Screen Launcher',
          desc: 'Zero storage bloat or Google Play waits; the icon appears right on your phone home screen.',
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        },
        {
          title: '3. Fullscreen Camera Signing',
          desc: 'Launches full-screen with native front camera framing for high-precision sign recognition.',
          icon: <Video className="w-5 h-5 text-sky-500" />
        }
      ]
    },
    ios: {
      id: 'ios',
      name: 'iOS & iPadOS',
      category: 'mobile',
      icon: <Smartphone className="w-5 h-5 text-slate-700" />,
      recommendedBrowser: 'Apple Safari',
      steps: [
        {
          title: '1. Tap Share in Safari',
          desc: 'Tap the Share icon (square with arrow ⎋) on the bottom toolbar in Apple Safari.',
          icon: <Share2 className="w-5 h-5 text-sky-500" />
        },
        {
          title: '2. Tap "Add to Home Screen"',
          desc: 'Scroll down the Safari action list and tap "Add to Home Screen ⊞".',
          icon: <PlusSquare className="w-5 h-5 text-emerald-500" />
        },
        {
          title: '3. Tap "Add" at Top Right',
          desc: 'Open Sanket AI directly from your iPhone home screen with zero browser bars.',
          icon: <CheckCircle2 className="w-5 h-5 text-orange-500" />
        }
      ]
    },
    linux: {
      id: 'linux',
      name: 'Linux & ChromeOS',
      category: 'desktop',
      icon: <Laptop className="w-5 h-5 text-amber-500" />,
      recommendedBrowser: 'Chrome, Chromium, Edge, Brave',
      steps: [
        {
          title: '1. Click Install App',
          desc: 'Click "Install for Linux" or use the browser address bar prompt.',
          icon: <Download className="w-5 h-5 text-orange-500" />
        },
        {
          title: '2. Desktop Menu Integration',
          desc: 'Automatically creates standard desktop and application launcher entries (.desktop).',
          icon: <Layers className="w-5 h-5 text-emerald-500" />
        },
        {
          title: '3. 60 FPS Vulkan/OpenGL Speed',
          desc: 'Uses native hardware acceleration for 60 FPS on-device neural sign translation.',
          icon: <Zap className="w-5 h-5 text-sky-500" />
        }
      ]
    }
  };

  const active = platforms[activePlatform];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans bg-grid-lines overflow-x-hidden selection:bg-orange-500/20 selection:text-orange-600">
      <Navbar />

      {/* Parallax Glowing Ambient Blobs (Matching Landing Page) */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-gradient-to-tr from-orange-400/20 via-purple-500/20 to-cyan-400/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-40 -left-20 w-80 h-80 bg-orange-300/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-60 -right-20 w-80 h-80 bg-purple-300/30 rounded-full blur-3xl pointer-events-none" />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-24 w-full relative z-10">
        
        {/* 1. HERO SECTION */}
        <section className="text-center max-w-4xl mx-auto mb-16 pt-4 space-y-6">
          
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/90 border border-orange-200 text-orange-600 font-extrabold text-xs uppercase tracking-widest shadow-sm backdrop-blur-md"
          >
            <Sparkles className="w-4 h-4 text-orange-500" />
            <span>Sanket AI • Pure PWA Desktop & Mobile Edition</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-5xl sm:text-7xl lg:text-8xl font-black tracking-tight text-slate-900 leading-[1.08] font-heading"
          >
            Get the <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600">Sanket AI</span> App
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.2 }}
            className="text-lg sm:text-2xl text-slate-600 leading-relaxed max-w-3xl mx-auto font-normal font-body"
          >
            A dedicated, distraction-free meeting window with hardware-accelerated 60 FPS Indian Sign Language recognition, 3D avatar, and persistent camera permissions.
          </motion.p>

          {/* Primary Auto-Detected Hero Card (Matching Cuvia Style Pill Action Dock) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="bg-white/95 rounded-[2.5rem] p-6 sm:p-10 shadow-2xl border border-slate-200/80 backdrop-blur-xl relative overflow-hidden text-left"
          >
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
              
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-3xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-xl">
                  {platforms[detectedOs].icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Detected System</span>
                    <span className="text-[11px] font-black text-emerald-800 bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      {platforms[detectedOs].name}
                    </span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 font-heading">
                    Install for {platforms[detectedOs].name}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5 font-body">
                    Optimized for {platforms[detectedOs].recommendedBrowser}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                <button
                  onClick={triggerInstallPrompt}
                  className="w-full sm:w-auto px-8 py-4 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-base shadow-2xl shadow-slate-900/25 flex items-center justify-center gap-3 transition-all hover:scale-105 group whitespace-nowrap"
                >
                  <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-black group-hover:rotate-12 transition-transform shrink-0">
                    <Download className="w-4 h-4 text-white" />
                  </div>
                  <span>Install Sanket AI Now</span>
                  <ArrowRight className="w-5 h-5 text-orange-400 group-hover:translate-x-1 transition-transform shrink-0" />
                </button>

                <Link
                  href="/consultation/create"
                  className="w-full sm:w-auto px-6 py-4 rounded-full bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-base text-center shadow-xs transition"
                >
                  Open in Browser
                </Link>
              </div>

            </div>
          </motion.div>

        </section>

        {/* 2. PLATFORM SWITCHER TABS (Floating Capsule Dock Style) */}
        <section className="mb-14">
          <div className="flex items-center justify-center flex-wrap gap-2 p-2 bg-white/90 border border-slate-200/90 rounded-full shadow-md backdrop-blur-md max-w-fit mx-auto">
            {(Object.keys(platforms) as PlatformId[]).map((key) => {
              const p = platforms[key];
              const isSelected = activePlatform === key;
              return (
                <button
                  key={key}
                  onClick={() => setActivePlatform(key)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {p.icon}
                  <span>{p.name.split(' ')[0]}</span>
                  {detectedOs === key && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-orange-500 text-white font-black">
                      YOUR OS
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* 3. STEP-BY-STEP INSTALL GUIDE & REALISTIC MEETING SHOWCASE */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center mb-24">
          
          {/* Left: 3-Step Clean Visual Guide */}
          <div className="lg:col-span-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-2xl font-black text-slate-900 font-heading">
                How to Install on {active.name}
              </h2>
              <span className="text-xs font-bold text-orange-600 bg-orange-50 border border-orange-200 px-3 py-1 rounded-full uppercase tracking-wider">
                Instant Setup
              </span>
            </div>

            <div className="space-y-4">
              {active.steps.map((step, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs hover:shadow-xl transition-all duration-300 group flex items-start gap-4"
                >
                  <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200/80 flex items-center justify-center text-orange-600 font-black text-base shrink-0 group-hover:scale-105 transition-transform">
                    {idx + 1}
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 font-heading">{step.title}</h3>
                    <p className="text-sm text-slate-600 mt-1 leading-relaxed font-body">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2">
              <button
                onClick={triggerInstallPrompt}
                className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 transition active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Trigger Installation Prompt Now</span>
              </button>
            </div>
          </div>

          {/* Right: Real Claymation / UI App Window Showcase (Matching Landing Page Mockup) */}
          <div className="lg:col-span-6">
            <div className="bg-white/95 rounded-[2.5rem] p-6 shadow-2xl border border-slate-200/80 backdrop-blur-xl relative overflow-hidden group">
              
              {/* Window Chrome Title Bar */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4 px-2">
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-rose-500/80" />
                  <div className="w-3.5 h-3.5 rounded-full bg-amber-500/80" />
                  <div className="w-3.5 h-3.5 rounded-full bg-emerald-500/80" />
                </div>
                <div className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-100 text-[11px] font-bold text-slate-700">
                  <Video className="w-3.5 h-3.5 text-orange-500" />
                  <span>Sanket AI — Desktop Application</span>
                </div>
                <div className="text-[11px] font-mono text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  60 FPS ACTIVE
                </div>
              </div>

              {/* Inner Showcase Grid (Camera Framing HUD + 3D Avatar + Subtitles) */}
              <div className="rounded-2xl bg-slate-900 text-white p-5 space-y-4 shadow-inner">
                
                <div className="grid grid-cols-2 gap-3">
                  {/* Camera Framing HUD Preview */}
                  <div className="aspect-video bg-slate-800 rounded-xl border border-emerald-500/50 relative flex items-center justify-center overflow-hidden">
                    <div className="absolute top-2 left-2 text-[10px] bg-black/70 px-2 py-0.5 rounded text-emerald-400 font-mono flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      Framing HUD: Optimal
                    </div>
                    <div className="border-2 border-dashed border-emerald-400/60 rounded-lg w-3/4 h-3/4 flex items-center justify-center">
                      <span className="text-[11px] text-slate-300 font-bold">Signing Zone Active</span>
                    </div>
                  </div>

                  {/* 3D Anatomical Avatar Preview */}
                  <div className="aspect-video bg-slate-800 rounded-xl border border-indigo-500/50 relative flex items-center justify-center overflow-hidden">
                    <div className="absolute top-2 left-2 text-[10px] bg-black/70 px-2 py-0.5 rounded text-indigo-400 font-mono">
                      3D Anatomical Avatar
                    </div>
                    <div className="text-center">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-400 mx-auto flex items-center justify-center text-indigo-300 font-black text-xs mb-1 shadow-md">
                        3D
                      </div>
                      <span className="text-[10px] text-slate-300 font-medium">Three.js FBX Engine</span>
                    </div>
                  </div>
                </div>

                {/* Subtitle Card (Matching Landing Page Live Speech Output) */}
                <div className="bg-slate-950/90 rounded-2xl p-4 border border-slate-800 flex items-start gap-3 shadow-lg">
                  <div className="p-2 rounded-xl bg-orange-500 text-white shrink-0">
                    <Volume2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-orange-400 font-bold block">
                      Live AI Speech Output
                    </span>
                    <p className="text-base font-bold leading-relaxed text-slate-100 font-cursive">
                      &quot;Doctor, I am ready for the consultation.&quot;
                    </p>
                  </div>
                </div>

              </div>

              <div className="mt-4 text-center">
                <p className="text-xs text-slate-500 font-body">
                  Runs 100% locally on your computer’s GPU. Zero video is transmitted to external servers.
                </p>
              </div>

            </div>
          </div>

        </section>

        {/* 4. VALUE PROPOSITION HIGHLIGHT CARDS (Matching Landing Page 3D Illustration Cards) */}
        <section className="mb-24">
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-slate-200 text-slate-800 font-bold text-xs uppercase tracking-wider shadow-xs">
              <Sparkles className="w-4 h-4 text-orange-500" /> Standalone Advantages
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight font-heading">
              Why Install the Standalone App?
            </h2>
            <p className="text-slate-600 text-base font-body">
              All the power of the web, with the speed, stability, and focus of native desktop software.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Card 1 */}
            <motion.div {...fadeInScale} className="bg-white rounded-3xl p-8 border border-slate-200/90 shadow-xs hover:shadow-xl transition-all space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-orange-100 border border-orange-200 flex items-center justify-center text-orange-600 shadow-sm">
                <Zap className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 font-heading">Hardware-Accelerated 60 FPS</h3>
              <p className="text-slate-600 text-sm leading-relaxed font-body">
                Operating in a standalone PWA window avoids browser tab throttling, granting direct WebGL & WASM GPU access for ultra-responsive sign language translation.
              </p>
            </motion.div>

            {/* Card 2 */}
            <motion.div {...fadeInScale} className="bg-white rounded-3xl p-8 border border-slate-200/90 shadow-xs hover:shadow-xl transition-all space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-sm">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 font-heading">Persistent Camera Access</h3>
              <p className="text-slate-600 text-sm leading-relaxed font-body">
                The operating system permanently remembers camera and microphone permissions. Say goodbye to repeated browser permission popups on every call.
              </p>
            </motion.div>

            {/* Card 3 */}
            <motion.div {...fadeInScale} className="bg-white rounded-3xl p-8 border border-slate-200/90 shadow-xs hover:shadow-xl transition-all space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-sky-100 border border-sky-200 flex items-center justify-center text-sky-600 shadow-sm">
                <Maximize2 className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 font-heading">Distraction-Free Window</h3>
              <p className="text-slate-600 text-sm leading-relaxed font-body">
                No address bars, bookmarks, or social media tabs. Give your full visual focus to the sign language signing HUD, subtitles, and medical minutes.
              </p>
            </motion.div>

          </div>
        </section>

        {/* 5. FAQ ACCORDION SECTION (Matching Landing Page Visual System) */}
        <section className="max-w-4xl mx-auto mb-12">
          <div className="text-center mb-12 space-y-3">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-slate-200 text-slate-800 font-bold text-xs uppercase tracking-wider shadow-xs">
              <HelpCircle className="w-4 h-4 text-orange-500" /> Installation FAQs
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight font-heading">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-4">
            {[
              {
                q: 'Do I need administrator privileges on my Windows or Mac computer?',
                a: 'No! Progressive Web Apps install directly into your user profile via your browser. You do not need admin passwords, elevated permissions, or corporate IT clearance.',
              },
              {
                q: 'How does the application update when new sign vocabularies are added?',
                a: 'Updates are 100% silent and automatic. Whenever we update the AI model or features, the background Service Worker updates on your next launch without manual re-downloads.',
              },
              {
                q: 'Is my video or sign recognition data recorded or uploaded?',
                a: 'Zero video is stored or recorded. All MediaPipe landmark detection and ONNX sequence classification runs 100% on-device inside your hardware GPU.',
              },
              {
                q: 'Can I uninstall the application at any time?',
                a: 'Yes, easily. In Windows, right-click Sanket AI in your Start Menu and select "Uninstall". On macOS, drag it from your Applications folder to the Trash. On mobile, tap and hold to remove.',
              },
            ].map((item, idx) => (
              <motion.div
                key={idx}
                {...fadeInUp}
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs cursor-pointer hover:border-orange-500/40 transition"
              >
                <div className="flex items-center justify-between font-bold text-slate-900 text-base sm:text-lg font-heading">
                  <span>{item.q}</span>
                  <span className="text-orange-500 font-extrabold text-xl">{openFaq === idx ? '−' : '+'}</span>
                </div>
                {openFaq === idx && (
                  <p className="mt-3 text-slate-600 text-sm leading-relaxed border-t border-slate-100 pt-3 font-body">
                    {item.a}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
