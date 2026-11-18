'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { StackedCardsSection } from '@/components/sections/StackedCardsSection';
import { ImageWithSkeleton } from '@/components/ui/ImageWithSkeleton';
import { 
  ArrowRight, 
  Hand,
  MessageSquareText,
  Volume2,
  Calendar,
  Clock,
  Video,
  ShieldCheck,
  Zap,
  Bell,
  Users,
  Briefcase,
  Stethoscope,
  GraduationCap,
  FileCheck,
  HelpCircle,
  Laptop,
  Lock,
  ChevronRight,
  CheckCircle2,
  PlayCircle,
  Activity,
  Layers
} from 'lucide-react';

// High-performance viewport animations (once: true prevents main-thread scroll recalculation bottlenecks on mobile)
const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.1 },
  transition: { duration: 0.5, ease: [0.25, 1, 0.5, 1] as const },
};

const fadeInFromLeft = {
  initial: { opacity: 0, x: -40 },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true, amount: 0.1 },
  transition: { duration: 0.5, ease: [0.25, 1, 0.5, 1] as const },
};

const fadeInFromRight = {
  initial: { opacity: 0, x: 40 },
  whileInView: { opacity: 1, x: 0 },
  viewport: { once: true, amount: 0.1 },
  transition: { duration: 0.5, ease: [0.25, 1, 0.5, 1] as const },
};

const fadeInScale = {
  initial: { opacity: 0, scale: 0.92, y: 20 },
  whileInView: { opacity: 1, scale: 1, y: 0 },
  viewport: { once: true, amount: 0.1 },
  transition: { duration: 0.45, ease: [0.25, 1, 0.5, 1] as const },
};

export default function LandingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [quickRoomCode, setQuickRoomCode] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Background prefetch routes so clicking them renders instantaneously with 0ms lag
  useEffect(() => {
    router.prefetch('/consultation/create');
    router.prefetch('/pricing');
    router.prefetch('/call-center');
  }, [router]);

  const handleStartSession = () => {
    router.push('/consultation/create');
  };

  const handleQuickJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickRoomCode.trim()) return;
    router.push(`/room/${quickRoomCode.trim().toUpperCase()}`);
  };

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans bg-grid-lines overflow-x-hidden selection:bg-orange-500/20 selection:text-orange-600">
      <Navbar />

      {/* 1. HERO SECTION - Giant Animated Parallax Typography & 3D Illustration Canvas */}
      <section className="relative pt-16 pb-24 md:pt-24 md:pb-32 overflow-hidden">
        
        {/* Parallax Glowing Ambient Blobs (Optimized for mobile) */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[350px] sm:w-[700px] h-[300px] sm:h-[500px] bg-gradient-to-tr from-orange-400/20 via-purple-500/20 to-cyan-400/20 rounded-full blur-2xl sm:blur-3xl pointer-events-none sm:animate-pulse-glow" />
        <div className="hidden sm:block absolute top-40 -left-20 w-80 h-80 bg-orange-300/25 rounded-full blur-3xl pointer-events-none animate-float" />
        <div className="hidden sm:block absolute top-60 -right-20 w-80 h-80 bg-purple-300/25 rounded-full blur-3xl pointer-events-none animate-float-reverse" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          {/* Hero Typography Centered */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.25, 1, 0.5, 1] }}
            className="max-w-4xl mx-auto text-center space-y-6"
          >
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/90 border border-orange-200 text-orange-600 font-extrabold text-xs uppercase tracking-widest shadow-sm backdrop-blur-md">
              <Activity className="w-4 h-4 text-orange-500" />
              <span>Sanket AI • Accessible Video Platform</span>
            </div>

            <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black tracking-tight text-slate-900 leading-[1.08] font-heading">
              The <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600">Easiest Way</span> to <br />
              Conduct AI Video Meetings
            </h1>

            <p className="text-lg sm:text-2xl text-slate-600 leading-relaxed max-w-3xl mx-auto font-normal font-body">
              Empowering deaf and mute individuals to communicate directly in video calls. Sign naturally—our AI converts it to live speech & captions instantly.
            </p>

            {/* Cuvia Style Pill Action Buttons */}
            <div className="pt-6 flex flex-col sm:flex-row flex-wrap items-center justify-center gap-4">
              <button
                onClick={handleStartSession}
                className="px-8 py-4 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-base shadow-2xl shadow-slate-900/25 flex items-center gap-3 transition-all hover:scale-105 group whitespace-nowrap"
              >
                <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-black group-hover:rotate-12 transition-transform shrink-0">
                  S
                </div>
                <span>Start Free Accessible Call</span>
                <ArrowRight className="w-5 h-5 text-orange-400 group-hover:translate-x-1 transition-transform shrink-0" />
              </button>

              {/* Quick Join Room Input */}
              <form onSubmit={handleQuickJoin} className="flex items-center bg-white/90 border border-slate-300 rounded-full pl-4 pr-2 py-2 shadow-md backdrop-blur-md">
                <input
                  type="text"
                  placeholder="ENTER ROOM CODE"
                  value={quickRoomCode}
                  onChange={(e) => setQuickRoomCode(e.target.value)}
                  className="py-2 text-sm font-mono font-bold uppercase text-slate-900 placeholder-slate-400 bg-transparent focus:outline-none w-36 sm:w-44"
                />
                <button
                  type="submit"
                  className="px-6 py-3 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition shadow-md shadow-orange-500/20 whitespace-nowrap"
                >
                  Join Room
                </button>
              </form>
            </div>

          </motion.div>

          {/* Central Hero 3D Real Claymation Illustration Canvas */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.92, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.25, ease: [0.25, 1, 0.5, 1] }}
            className="mt-16 relative max-w-5xl mx-auto animate-float"
          >
            <div className="relative rounded-3xl bg-white border border-slate-200/90 shadow-2xl p-4 sm:p-8 backdrop-blur-xl">
              
              {/* Top Controls Bar */}
              <div className="flex items-center justify-between pb-6 mb-6 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full bg-rose-500 shadow-xs" />
                  <span className="w-3.5 h-3.5 rounded-full bg-amber-500 shadow-xs" />
                  <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 shadow-xs" />
                </div>
                <div className="px-4 py-1.5 rounded-full bg-slate-100 text-slate-800 font-mono text-xs font-bold flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  Sanket AI Engine • Active LiveKit SFU
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">Live 30 FPS</span>
                </div>
              </div>

              {/* Grid Layout inside Hero Card */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                
                {/* Left Floating Card */}
                <div className="lg:col-span-3 space-y-4">
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-xs">
                    <div className="w-9 h-9 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-sm mb-3 shadow-xs">
                      AI
                    </div>
                    <h4 className="font-extrabold text-slate-900 text-sm font-heading">Sign Language Call</h4>
                    <p className="text-xs text-slate-500 mt-1 font-body">Candidate & HR Interview</p>
                    <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                      <Clock className="w-3.5 h-3.5 text-orange-500" /> 30 mins, 1-on-1 Call
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-orange-50 border border-orange-200 text-orange-900 text-xs font-semibold flex items-center gap-2 shadow-xs">
                    <ShieldCheck className="w-4.5 h-4.5 text-orange-500 shrink-0" />
                    100% On-Device Landmark AI
                  </div>
                </div>

                {/* Center Hero REAL 3D Claymation Picture Illustration */}
                <div className="lg:col-span-6 relative rounded-2xl overflow-hidden border border-slate-200 shadow-md group">
                  <ImageWithSkeleton
                    src="/sanket_hero_meeting.jpg"
                    alt="Sanket AI Video Meeting 3D Claymation Illustration"
                    containerClassName="w-full h-auto aspect-[16/10]"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  
                  {/* Overlay Live Subtitle Card */}
                  <div className="absolute bottom-4 left-4 right-4 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-3.5 shadow-xl border border-slate-800 flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-orange-500 text-white shrink-0">
                      <Volume2 className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-orange-400 font-bold block">
                        Live AI Speech Output
                      </span>
                      <p className="text-base font-bold leading-relaxed text-slate-100 font-cursive">
                        &quot;Hello! I am ready to begin the evaluation.&quot;
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right Floating Card */}
                <div className="lg:col-span-3 space-y-4">
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-xs text-center">
                    <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white mx-auto flex items-center justify-center font-bold text-sm mb-2 shadow-md">
                      <Calendar className="w-5 h-5 text-orange-400" />
                    </div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Scheduled Session</span>
                    <h5 className="font-extrabold text-slate-900 text-sm mt-0.5 font-heading">Today, Active Call</h5>
                    <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Live Connected
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-900 text-white text-xs space-y-2 shadow-md">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Recognition AI</span>
                      <span className="text-emerald-400 font-bold">98.4% Acc</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div className="w-[98%] h-full bg-gradient-to-r from-orange-500 to-emerald-400 rounded-full" />
                    </div>
                  </div>
                </div>

              </div>

              {/* Floating Bell Element */}
              <div className="absolute -bottom-5 -right-5 w-12 h-12 rounded-2xl bg-indigo-600 text-white shadow-xl flex items-center justify-center animate-bounce">
                <Bell className="w-6 h-6" />
              </div>

            </div>
          </motion.div>

        </div>
      </section>

      {/* 2. TRUST BANNER */}
      <section className="py-10 bg-white border-y border-slate-200/80">
        <motion.div {...fadeInUp} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">
            Empowering Accessible Communication Across Institutions
          </p>
          <div className="flex flex-wrap items-center justify-center gap-10 md:gap-16 opacity-80 font-bold text-slate-700 text-base sm:text-lg">
            <span className="flex items-center gap-2"><Activity className="w-4 h-4 text-orange-500" /> Sanket AI Engine</span>
            <span>RPWD Act 2016 Compliant</span>
            <span>Inclusive Campus Hiring</span>
            <span>Family &amp; Daily Meetings</span>
            <span>Telecom Relay Services</span>
          </div>
        </motion.div>
      </section>

      {/* 3. VISUAL FEATURES GRID - Continuous Scroll Animations (Up & Down) */}
      <section id="features" className="py-24 bg-slate-50 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <motion.div {...fadeInUp} className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-orange-600 font-bold text-xs uppercase tracking-wider shadow-xs">
              <Layers className="w-4 h-4 text-orange-500" /> Visual First Capabilities
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight font-heading">
              Designed for Visual First Understanding
            </h2>
            <p className="text-slate-600 text-base font-body">
              Every feature is built around visual clarity, 3D artwork, and real-time AI feedback.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            
            {/* Feature 1: Slide In From Left */}
            <motion.div {...fadeInFromLeft} className="p-6 rounded-3xl bg-white border border-slate-200/90 hover:border-orange-500/50 transition-all group shadow-xs hover:shadow-2xl space-y-6 flex flex-col justify-between">
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-orange-200 group-hover:scale-[1.03] transition-transform shadow-xs">
                <ImageWithSkeleton
                  src="/img_sign_candidate.jpg"
                  alt="Sign to Speech 3D Illustration"
                  containerClassName="w-full h-full"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-base mb-3">
                  <Hand className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1 font-heading">Sign to Speech</h3>
                <p className="text-slate-600 text-xs leading-relaxed font-body">
                  Indian Sign Language gestures are tracked on-device and spoken aloud instantly.
                </p>
              </div>
            </motion.div>

            {/* Feature 2: Slide Up Scale */}
            <motion.div {...fadeInScale} className="p-6 rounded-3xl bg-white border border-slate-200/90 hover:border-purple-500/50 transition-all group shadow-xs hover:shadow-2xl space-y-6 flex flex-col justify-between">
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-purple-200 group-hover:scale-[1.03] transition-transform shadow-xs">
                <ImageWithSkeleton
                  src="/img_subtitles_bubble.jpg"
                  alt="Live Subtitles 3D Illustration"
                  containerClassName="w-full h-full"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-base mb-3">
                  <MessageSquareText className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1 font-heading">Live Subtitles</h3>
                <p className="text-slate-600 text-xs leading-relaxed font-body">
                  Spoken responses are transcribed in real-time as readable captions.
                </p>
              </div>
            </motion.div>

            {/* Feature 3: Slide Up Scale */}
            <motion.div {...fadeInScale} className="p-6 rounded-3xl bg-white border border-slate-200/90 hover:border-emerald-500/50 transition-all group shadow-xs hover:shadow-2xl space-y-6 flex flex-col justify-between">
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-emerald-200 group-hover:scale-[1.03] transition-transform shadow-xs">
                <ImageWithSkeleton
                  src="/img_device_privacy.jpg"
                  alt="100% On-Device Privacy 3D Illustration"
                  containerClassName="w-full h-full"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-base mb-3">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1 font-heading">100% Private</h3>
                <p className="text-slate-600 text-xs leading-relaxed font-body">
                  Landmark recognition runs inside the browser. Zero video uploaded.
                </p>
              </div>
            </motion.div>

            {/* Feature 4: Slide In From Right */}
            <motion.div {...fadeInFromRight} className="p-6 rounded-3xl bg-white border border-slate-200/90 hover:border-blue-500/50 transition-all group shadow-xs hover:shadow-2xl space-y-6 flex flex-col justify-between">
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-blue-200 group-hover:scale-[1.03] transition-transform shadow-xs">
                <ImageWithSkeleton
                  src="/img_instant_invite.jpg"
                  alt="Instant Room Link 3D Illustration"
                  containerClassName="w-full h-full"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-base mb-3">
                  <Zap className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1 font-heading">Instant Room Links</h3>
                <p className="text-slate-600 text-xs leading-relaxed font-body">
                  Create a room in one click. Guests join instantly without software installs.
                </p>
              </div>
            </motion.div>

          </div>

        </div>
      </section>

      {/* 4. ZIG-ZAG STORYTELLING SPLIT SHOWCASE SECTIONS - Left & Right Directional Slide Animations (Up & Down) */}
      <section className="py-24 bg-white border-y border-slate-200/80 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-24">
          
          {/* Story 1: Left Image Slides from LEFT, Right Text Slides from RIGHT */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left 3D Image Canvas - SLIDES IN FROM LEFT */}
            <motion.div {...fadeInFromLeft} className="lg:col-span-6 relative">
              <div className="relative rounded-3xl overflow-hidden border border-slate-200 shadow-2xl group p-3 bg-slate-50">
                <div className="relative rounded-2xl overflow-hidden aspect-[4/3]">
                  <ImageWithSkeleton
                    src="/sanket_solutions.jpg"
                    alt="Real-Time Sign Language Translation 3D Illustration"
                    containerClassName="w-full h-full"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur-md text-white px-3.5 py-1.5 rounded-full text-xs font-mono font-bold border border-slate-700">
                    ISL Recognition Engine
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Right Big Typography - SLIDES IN FROM RIGHT */}
            <motion.div {...fadeInFromRight} className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-orange-600 font-bold text-xs uppercase tracking-wider">
                <Hand className="w-4 h-4 text-orange-500" /> Instant Voice Synthesis
              </div>

              <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight font-heading">
                Sign Language to Spoken Voice in Real-Time
              </h2>

              <p className="text-slate-600 text-base leading-relaxed font-body">
                No human interpreter needed. When a non-verbal person signs Indian Sign Language into their camera, Sanket AI tracks 21 hand landmark points and synthesizes clear, audible spoken voice for the interviewer.
              </p>

              <div className="space-y-3 pt-2">
                {[
                  '21 Hand landmark nodes tracked at 30 FPS',
                  'Zero depth hardware required—works on standard webcams',
                  'Instant voice output directly inside the video stream',
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-sm font-bold text-slate-800">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    <span className="font-body">{item}</span>
                  </div>
                ))}
              </div>
            </motion.div>

          </div>

          {/* Story 2: Left Text Slides from LEFT, Right Image Slides from RIGHT */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Big Typography - SLIDES IN FROM LEFT */}
            <motion.div {...fadeInFromLeft} className="lg:col-span-6 space-y-6 order-2 lg:order-1">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-50 border border-purple-200 text-purple-600 font-bold text-xs uppercase tracking-wider">
                <MessageSquareText className="w-4 h-4 text-purple-600" /> Two-Way Subtitles
              </div>

              <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight font-heading">
                Real-Time Speech Subtitles for Complete Clarity
              </h2>

              <p className="text-slate-600 text-base leading-relaxed font-body">
                Communication is a two-way street. When the other participant or colleague speaks, Sanket transcribes their words into crisp, readable live captions anchored at the bottom of the video room.
              </p>

              <div className="space-y-3 pt-2">
                {[
                  'High-accuracy Speech-to-Text transcription',
                  'Overlay captions anchored cleanly above control bar',
                  'Ensures complete confidence for non-verbal participants',
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-sm font-bold text-slate-800">
                    <CheckCircle2 className="w-5 h-5 text-purple-600 shrink-0" />
                    <span className="font-body">{item}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Right 3D Image Canvas - SLIDES IN FROM RIGHT */}
            <motion.div {...fadeInFromRight} className="lg:col-span-6 relative order-1 lg:order-2">
              <div className="relative rounded-3xl overflow-hidden border border-slate-200 shadow-2xl group p-3 bg-slate-50">
                <div className="relative rounded-2xl overflow-hidden aspect-[4/3]">
                  <ImageWithSkeleton
                    src="/img_subtitles_bubble.jpg"
                    alt="Live Speech Subtitles 3D Illustration"
                    containerClassName="w-full h-full"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur-md text-white px-3.5 py-1.5 rounded-full text-xs font-mono font-bold border border-slate-700">
                    STT Subtitles Active
                  </div>
                </div>
              </div>
            </motion.div>

          </div>

        </div>
      </section>

      {/* 5. SOLUTIONS & MEETING USE-CASES GRID - Continuous Pop-In Scale Animations (Up & Down) */}
      <section id="solutions" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <motion.div {...fadeInUp} className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 text-slate-800 font-bold text-xs uppercase tracking-wider">
              <Users className="w-4 h-4 text-orange-500" /> Tailored Use Cases
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight font-heading">
              One Platform. Every Meeting.
            </h2>
            <p className="text-slate-600 text-base font-body">
              The same underlying AI video engine supports multiple official scenarios.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            
            {/* Scenario 1 */}
            <motion.div {...fadeInScale} className="p-6 rounded-3xl bg-white border border-slate-200/90 hover:border-orange-500/50 transition-all group shadow-xs hover:shadow-xl space-y-5 flex flex-col justify-between">
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-orange-200 group-hover:scale-[1.03] transition-transform">
                <ImageWithSkeleton
                  src="/img_hr_interviewer.jpg"
                  alt="Job Interviews 3D Illustration"
                  containerClassName="w-full h-full"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-1 font-heading">Job Interviews</h3>
                <p className="text-slate-600 text-xs leading-relaxed font-body">
                  Formal ISL vocabulary for technical Q&A, candidate introductions, and hiring panels.
                </p>
              </div>
            </motion.div>

            {/* Scenario 2 */}
            <motion.div {...fadeInScale} className="p-6 rounded-3xl bg-white border border-slate-200/90 hover:border-blue-500/50 transition-all group shadow-xs hover:shadow-xl space-y-5 flex flex-col justify-between">
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-blue-200 group-hover:scale-[1.03] transition-transform">
                <ImageWithSkeleton
                  src="/img_doctor_telehealth.jpg"
                  alt="Telemedicine Doctor 3D Illustration"
                  containerClassName="w-full h-full"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-1 font-heading">Family &amp; Daily Calls</h3>
                <p className="text-slate-600 text-xs leading-relaxed font-body">
                  Connect effortlessly with friends, family, and colleagues with instant two-way translation.
                </p>
              </div>
            </motion.div>

            {/* Scenario 3 */}
            <motion.div {...fadeInScale} className="p-6 rounded-3xl bg-white border border-slate-200/90 hover:border-emerald-500/50 transition-all group shadow-xs hover:shadow-xl space-y-5 flex flex-col justify-between">
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-emerald-200 group-hover:scale-[1.03] transition-transform">
                <ImageWithSkeleton
                  src="/img_student_viva.jpg"
                  alt="Academic Viva Student 3D Illustration"
                  containerClassName="w-full h-full"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-1 font-heading">Academic Viva</h3>
                <p className="text-slate-600 text-xs leading-relaxed font-body">
                  Enables deaf students to defend projects and communicate with examiners.
                </p>
              </div>
            </motion.div>

            {/* Scenario 4 */}
            <motion.div {...fadeInScale} className="p-6 rounded-3xl bg-white border border-slate-200/90 hover:border-indigo-500/50 transition-all group shadow-xs hover:shadow-xl space-y-5 flex flex-col justify-between">
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-indigo-200 group-hover:scale-[1.03] transition-transform">
                <ImageWithSkeleton
                  src="/img_govt_verification.jpg"
                  alt="Verification Calls 3D Illustration"
                  containerClassName="w-full h-full"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-1 font-heading">Verification Calls</h3>
                <p className="text-slate-600 text-xs leading-relaxed font-body">
                  Passport, visa, and public service identity verification calls without interpreters.
                </p>
              </div>
            </motion.div>

          </div>

        </div>
      </section>

      {/* 6. HOW IT WORKS PINNED STACKED CARDS ANIMATION */}
      <StackedCardsSection />

      {/* 7. VISUAL FAQ ACCORDION SECTION */}
      <section id="faq" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <motion.div {...fadeInUp} className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-slate-200 text-slate-800 font-bold text-xs uppercase tracking-wider shadow-xs">
              <HelpCircle className="w-4 h-4 text-orange-500" /> Frequently Asked Questions
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight font-heading">
              Everything You Need to Know
            </h2>
          </motion.div>

          <div className="max-w-4xl mx-auto space-y-4">
            {[
              {
                q: 'What camera or hardware is required to use Sanket?',
                a: 'Any standard webcam, laptop camera, or smartphone works out of the box. No special gloves or depth hardware are needed.',
              },
              {
                q: 'Does the interviewer or doctor need sign language training?',
                a: 'No! The interviewer hears spoken voice output and speaks into their mic normally. Live captions transcribe their reply back to the candidate.',
              },
              {
                q: 'Is camera video recorded or uploaded to the cloud?',
                a: 'Zero video is stored or recorded. Landmark tracking runs 100% locally inside your web browser for complete privacy.',
              },
              {
                q: 'Is Sanket free for candidates and non-verbal users?',
                a: 'Yes! Sanket is 100% free for candidates and deaf/mute individuals to create or join video meetings.',
              },
            ].map((item, idx) => (
              <motion.div
                key={idx}
                {...fadeInUp}
                onClick={() => toggleFaq(idx)}
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

        </div>
      </section>

      {/* 8. CALL TO ACTION BANNER */}
      <section className="py-20 bg-slate-900 text-white relative overflow-hidden">
        <motion.div {...fadeInUp} className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6 relative z-10">
          <h2 className="text-4xl sm:text-6xl font-black tracking-tight font-heading">
            Ready for Effortless Video Calls?
          </h2>
          <p className="text-slate-300 text-base sm:text-lg max-w-xl mx-auto font-body">
            Start your first accessible meeting room in one click. Free forever.
          </p>
          <div className="pt-4">
            <Link
              href="/consultation/create"
              className="inline-flex items-center gap-3 px-10 py-5 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-lg shadow-xl shadow-orange-500/25 transition-all hover:scale-105"
            >
              <span>Launch Free Accessible Call</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </motion.div>
      </section>

      <Footer />
    </div>
  );
}
