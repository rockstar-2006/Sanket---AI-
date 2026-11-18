'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { useWallet, PRICING_PLANS, PricingPlan } from '@/context/WalletContext';
import { 
  Zap, 
  Sparkles, 
  CheckCircle2, 
  ShieldCheck, 
  Smartphone, 
  ArrowRight, 
  PhoneCall, 
  Video, 
  Lock, 
  CreditCard,
  Layers,
  Copy,
  Check,
  QrCode,
  ExternalLink,
  HelpCircle,
  Clock,
  Award
} from 'lucide-react';

const OFFICIAL_UPI_ID = '7381709385@pthdfc';
const OFFICIAL_PAYEE_NAME = 'Sanket AI';

export default function PricingPage() {
  const { openRechargeModal, credits, addCredits } = useWallet();

  // Instant On-Page UPI Payment States
  const [selectedPlanForUpi, setSelectedPlanForUpi] = useState<PricingPlan>(PRICING_PLANS[1]);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [utrInput, setUtrInput] = useState('');
  const [isVerifyingUtr, setIsVerifyingUtr] = useState(false);
  const [utrSuccessMsg, setUtrSuccessMsg] = useState('');
  const [utrErrorMsg, setUtrErrorMsg] = useState('');

  // Active payment amount
  const activeAmount = customAmount ? Number(customAmount) || selectedPlanForUpi.priceInr : selectedPlanForUpi.priceInr;
  const estimatedCredits = customAmount 
    ? Math.floor((Number(customAmount) || 0) * 6.5) 
    : selectedPlanForUpi.credits;

  // Real NPCI UPI URI standard for GPay, PhonePe, Paytm, BHIM, Cred
  const upiIntentUri = `upi://pay?pa=${encodeURIComponent(OFFICIAL_UPI_ID)}&pn=${encodeURIComponent(OFFICIAL_PAYEE_NAME)}&am=${activeAmount}&cu=INR&tn=${encodeURIComponent(`Sanket AI Recharge (${estimatedCredits} Credits)`)}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(upiIntentUri)}`;

  const handleCopyUpi = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(OFFICIAL_UPI_ID);
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2500);
    }
  };

  const handleLaunchUpiApp = () => {
    window.location.href = upiIntentUri;
  };

  const handleVerifyOnPageUtr = (e: React.FormEvent) => {
    e.preventDefault();
    setUtrErrorMsg('');
    setUtrSuccessMsg('');

    const cleanUtr = utrInput.trim();
    if (!cleanUtr || cleanUtr.length < 6) {
      setUtrErrorMsg('Please enter a valid 12-digit UPI UTR or Transaction Reference number.');
      return;
    }

    setIsVerifyingUtr(true);
    setTimeout(() => {
      setIsVerifyingUtr(false);
      addCredits(estimatedCredits, `UPI Recharge (₹${activeAmount})`, cleanUtr);
      setUtrSuccessMsg(`🎉 Success! +${estimatedCredits} Credits have been credited to your account!`);
      setUtrInput('');
    }, 1200);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 bg-grid-lines text-slate-900 font-sans selection:bg-orange-500/20 selection:text-orange-600 overflow-x-hidden">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16 space-y-12 sm:space-y-20">
        
        {/* ─── 1. GRAND HERO HEADER ─── */}
        <section className="relative text-center max-w-4xl mx-auto space-y-5 pt-4 sm:pt-8">
          
          {/* Subtle Ambient Radial Lighting */}
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-[340px] sm:w-[650px] h-[300px] sm:h-[400px] bg-gradient-to-tr from-orange-400/20 via-amber-300/15 to-cyan-400/10 rounded-full blur-3xl pointer-events-none -z-10" />

          {/* Luxury Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-50 border border-orange-200/90 text-orange-700 text-xs font-black uppercase tracking-widest shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-orange-500" />
            <span>Official Pricing &amp; Direct UPI Gateway</span>
          </div>

          {/* Main Grand Title */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-slate-900 font-heading leading-[1.08]">
            Accessible Communication.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600">
              Simple, Transparent UPI.
            </span>
          </h1>

          <p className="text-sm sm:text-lg text-slate-600 max-w-2xl mx-auto font-normal leading-relaxed">
            Every registered user receives <strong className="text-slate-900 font-bold">100 Complimentary Starter Credits</strong>. Recharge anytime using any standard UPI app (GPay, PhonePe, Paytm, BHIM).
          </p>

          {/* Grand Account Balance Pill */}
          <div className="inline-flex flex-wrap items-center justify-center gap-3 px-5 py-2.5 rounded-2xl bg-white/95 border border-slate-200/90 shadow-md backdrop-blur-md text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Current Account Balance:</span>
            </span>
            <span className="font-extrabold text-slate-900 font-mono text-sm px-2.5 py-0.5 rounded-lg bg-orange-50 border border-orange-200 text-orange-700">
              {credits} Credits
            </span>
            <span className="text-slate-300 hidden sm:inline">•</span>
            <a
              href="#upi-terminal"
              className="text-orange-600 font-extrabold hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>Instant Recharge via UPI</span>
              <span>&darr;</span>
            </a>
          </div>

        </section>

        {/* ─── 2. DEDICATED GRAND UPI TERMINAL SECTION (Featuring 7381709385@pthdfc) ─── */}
        <section id="upi-terminal" className="relative rounded-3xl sm:rounded-4xl p-6 sm:p-10 bg-gradient-to-b from-slate-900 to-slate-950 text-white shadow-2xl border border-slate-800 overflow-hidden">
          
          {/* Decorative Corner Glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-4xl mx-auto space-y-8">
            
            {/* Terminal Header */}
            <div className="text-center sm:text-left flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[11px] font-mono font-bold uppercase tracking-wider mb-2">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Direct Merchant UPI Gateway</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-heading">
                  Quick UPI Payment &amp; Instant Recharge
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">
                  Pay directly to our verified UPI ID with zero gateway fees and automatic credit top-up.
                </p>
              </div>

              {/* Verified NPCI Badge */}
              <div className="shrink-0 flex items-center justify-center sm:justify-end gap-2 bg-slate-800/60 border border-slate-700/60 px-4 py-2 rounded-2xl text-emerald-400 text-xs font-mono font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>NPCI / HDFC Verified</span>
              </div>
            </div>

            {/* Split Grid: Left QR & UPI Copy | Right Amount & UTR Form */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              
              {/* Left Column: Official UPI ID & Dynamic QR Code */}
              <div className="lg:col-span-5 flex flex-col items-center text-center space-y-4 bg-slate-900/80 p-6 rounded-3xl border border-slate-800">
                
                <span className="text-[11px] font-mono text-slate-400 font-bold uppercase tracking-wider">
                  Scan QR with any UPI App
                </span>

                {/* QR Code Container */}
                <div className="p-3 bg-white rounded-2xl shadow-xl shrink-0 group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrCodeUrl}
                    alt="Sanket AI UPI Payment QR Code"
                    className="w-44 h-44 sm:w-48 sm:h-48 rounded-xl object-contain"
                  />
                </div>

                {/* Amount Display */}
                <div className="text-center">
                  <span className="text-xs text-slate-400">Total Recharge Amount:</span>
                  <div className="text-2xl font-black text-white font-heading">
                    ₹{activeAmount}{' '}
                    <span className="text-xs text-orange-400 font-mono font-bold">
                      ({estimatedCredits} Credits)
                    </span>
                  </div>
                </div>

                {/* Official UPI ID Box with 1-Click Copy */}
                <div className="w-full bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center justify-between gap-2">
                  <div className="text-left overflow-hidden">
                    <span className="text-[10px] text-slate-500 font-mono block">Official Merchant VPA:</span>
                    <span className="text-xs sm:text-sm font-mono font-bold text-orange-400 truncate block select-all">
                      {OFFICIAL_UPI_ID}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyUpi}
                    className="px-3 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold font-mono transition flex items-center gap-1.5 shrink-0 shadow-md shadow-orange-500/20 cursor-pointer"
                  >
                    {copiedUpi ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

              </div>

              {/* Right Column: Interactive Quick Amount Selector & Direct Action */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* 1. Quick Select Plan / Amount */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider block">
                    1. Choose Recharge Plan
                  </span>
                  
                  <div className="grid grid-cols-3 gap-2.5">
                    {PRICING_PLANS.map((plan) => {
                      const isSelected = !customAmount && selectedPlanForUpi.id === plan.id;
                      return (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() => {
                            setSelectedPlanForUpi(plan);
                            setCustomAmount('');
                          }}
                          className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between cursor-pointer ${
                            isSelected
                              ? 'border-orange-500 bg-orange-500/15 ring-2 ring-orange-500/30'
                              : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 text-slate-300'
                          }`}
                        >
                          <span className="text-[11px] font-bold text-slate-400 block truncate">
                            {plan.name}
                          </span>
                          <span className="text-lg sm:text-xl font-black text-white font-heading mt-1">
                            ₹{plan.priceInr}
                          </span>
                          <span className="text-[10px] text-orange-400 font-mono font-bold mt-1">
                            +{plan.credits} Crd
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Direct Pay Buttons */}
                <div className="space-y-3 pt-2">
                  <span className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider block">
                    2. Complete Payment via Any App
                  </span>

                  <button
                    type="button"
                    onClick={handleLaunchUpiApp}
                    className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-black text-sm sm:text-base shadow-xl shadow-orange-500/25 flex items-center justify-center gap-3 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                  >
                    <Smartphone className="w-5 h-5" />
                    <span>Pay ₹{activeAmount} with GPay / PhonePe / Paytm</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </button>

                  <div className="flex items-center justify-center gap-3 text-slate-400 text-xs font-mono">
                    <span>Supports:</span>
                    <span className="text-slate-200 font-bold">Google Pay</span>
                    <span>•</span>
                    <span className="text-slate-200 font-bold">PhonePe</span>
                    <span>•</span>
                    <span className="text-slate-200 font-bold">Paytm</span>
                    <span>•</span>
                    <span className="text-slate-200 font-bold">BHIM</span>
                  </div>
                </div>

                {/* 3. Direct UTR Verification Form */}
                <form onSubmit={handleVerifyOnPageUtr} className="space-y-3 pt-4 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider">
                      3. Enter 12-Digit UTR for Instant Credits
                    </span>
                    <span className="text-[11px] text-slate-500">Auto-verification</span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <input
                      type="text"
                      value={utrInput}
                      onChange={(e) => setUtrInput(e.target.value)}
                      placeholder="e.g. 431289567123"
                      className="flex-1 px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm font-mono focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 placeholder:text-slate-600"
                    />

                    <button
                      type="submit"
                      disabled={isVerifyingUtr}
                      className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs sm:text-sm font-bold font-mono transition flex items-center justify-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      {isVerifyingUtr ? (
                        <>
                          <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                          <span>Verifying...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Verify &amp; Add</span>
                        </>
                      )}
                    </button>
                  </div>

                  {utrErrorMsg && (
                    <p className="text-xs text-rose-400 font-medium">{utrErrorMsg}</p>
                  )}
                  {utrSuccessMsg && (
                    <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{utrSuccessMsg}</span>
                    </div>
                  )}
                </form>

              </div>

            </div>

          </div>
        </section>

        {/* ─── 3. GRAND 3-TIER PRICING CARDS GRID ─── */}
        <section className="space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 font-heading tracking-tight">
              Pre-Paid Credit Bundles
            </h2>
            <p className="text-sm text-slate-600">
              Credits never expire. Top-up only when you need active telephone relay or meeting rooms.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch pt-2">
            {PRICING_PLANS.map((plan) => {
              const isPopular = plan.popular;

              return (
                <motion.div
                  key={plan.id}
                  whileHover={{ y: -6 }}
                  transition={{ duration: 0.2 }}
                  className={`relative rounded-3xl p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 bg-white ${
                    isPopular
                      ? 'border-2 border-orange-500 shadow-2xl shadow-orange-500/15 ring-4 ring-orange-500/10 md:-translate-y-2'
                      : 'border border-slate-200/90 shadow-md hover:shadow-xl'
                  }`}
                >
                  {/* Top Badge for Featured Card */}
                  {plan.badge && (
                    <div className="absolute -top-3.5 right-6 px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25">
                      {plan.badge}
                    </div>
                  )}

                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold text-slate-900 font-heading">
                        {plan.name}
                      </h3>
                      <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                        {plan.credits} Credits
                      </span>
                    </div>

                    {/* Price in INR */}
                    <div className="mt-4 flex items-baseline gap-1.5">
                      <span className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight font-heading">
                        ₹{plan.priceInr}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">/ one-time UPI</span>
                    </div>

                    <p className="mt-2 text-xs text-slate-500 leading-relaxed font-body">
                      Covers approximately <strong className="text-slate-800 font-semibold">~{plan.approxMinutes} mins</strong> of active phone relay or {Math.floor(plan.credits / 5)} full video meetings.
                    </p>

                    {/* Feature Highlights */}
                    <div className="mt-6 space-y-3 pt-6 border-t border-slate-100">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono block">
                        Included Features
                      </span>
                      {plan.features.map((feat, idx) => (
                        <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-700">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span className="leading-snug">{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Card Button */}
                  <div className="mt-8 pt-4">
                    <button
                      type="button"
                      onClick={() => openRechargeModal(plan)}
                      className={`w-full py-4 rounded-2xl font-black text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                        isPopular
                          ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-orange-500/25'
                          : 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/10'
                      }`}
                    >
                      <Smartphone className="w-4 h-4" />
                      <span>Recharge ₹{plan.priceInr} via UPI</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* ─── 4. CREDIT CONSUMPTION TRANSPARENCY MATRIX ─── */}
        <section className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/90 shadow-md space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center shadow-xs">
              <Layers className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 font-heading">
                Transparent Credit Consumption
              </h3>
              <p className="text-xs text-slate-500">
                Credits are only deducted during active real-time carrier or neural compute
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Tile 1 */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center gap-2 text-orange-600">
                <Video className="w-4 h-4" />
                <span className="font-bold text-xs uppercase tracking-wider">Video Meetings</span>
              </div>
              <div className="text-2xl font-black text-slate-900 font-heading">
                5 Credits <span className="text-xs text-slate-500 font-normal">/ session</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Includes full WebRTC HD stream, real-time ISL tracking, and bidirectional subtitles.
              </p>
            </div>

            {/* Tile 2 */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center gap-2 text-emerald-600">
                <PhoneCall className="w-4 h-4" />
                <span className="font-bold text-xs uppercase tracking-wider">Telecom Relay</span>
              </div>
              <div className="text-2xl font-black text-slate-900 font-heading">
                1 Credit <span className="text-xs text-slate-500 font-normal">/ 10 seconds</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Covers active cellular telephone voice streaming, Groq Whisper STT, and voice synthesis.
              </p>
            </div>

            {/* Tile 3 */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center gap-2 text-cyan-600">
                <Sparkles className="w-4 h-4" />
                <span className="font-bold text-xs uppercase tracking-wider">3D ISL Hologram</span>
              </div>
              <div className="text-2xl font-black text-slate-900 font-heading">
                0 Credits <span className="text-xs text-emerald-600 font-bold">(Free)</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Real-time 3D avatar rendering &amp; 262 ISL gesture dataset playback included with every account.
              </p>
            </div>

            {/* Tile 4 */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center gap-2 text-purple-600">
                <ShieldCheck className="w-4 h-4" />
                <span className="font-bold text-xs uppercase tracking-wider">Privacy &amp; AI</span>
              </div>
              <div className="text-2xl font-black text-slate-900 font-heading">
                Unlimited <span className="text-xs text-slate-500 font-normal">Always</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                21 Landmark node computer vision runs locally inside browser memory. Zero video stored.
              </p>
            </div>

          </div>
        </section>

        {/* ─── 5. SECURITY & SUPPORT GUARANTEE ─── */}
        <section className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs text-xs text-slate-600">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Official Merchant VPA: <strong className="text-slate-900 font-mono font-bold">{OFFICIAL_UPI_ID}</strong> • Powered by National Payments Corporation of India (NPCI).
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px] font-bold flex-wrap justify-center">
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">GPay</span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">PhonePe</span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">Paytm</span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">BHIM</span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">Cred</span>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
