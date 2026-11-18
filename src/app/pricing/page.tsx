'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { useWallet, PRICING_PLANS } from '@/context/WalletContext';
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
  HelpCircle 
} from 'lucide-react';

export default function PricingPage() {
  const { openRechargeModal, credits } = useWallet();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 bg-grid-lines text-slate-900 font-sans selection:bg-orange-500/20 selection:text-orange-600">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 space-y-16">
        
        {/* Header Title Section (Matches main site typography and color) */}
        <div className="text-center max-w-3xl mx-auto space-y-4 gsap-text-reveal">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-xs font-bold uppercase tracking-wider shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-orange-500" />
            <span>Usage-Based Account Plans</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 font-heading leading-tight">
            Transparent Pricing.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600">
              Pay As You Use.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto font-normal leading-relaxed">
            Every registered user receives an initial balance of <strong className="text-slate-900 font-semibold">100 Starter Credits</strong>. Recharge anytime using any standard UPI app.
          </p>

          {/* Clean Account Status Pill */}
          <div className="gsap-scale inline-flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-white border border-slate-200/90 shadow-sm text-xs text-slate-600">
            <span>Your Current Balance:</span>
            <span className="font-extrabold text-slate-900 font-mono text-sm px-2 py-0.5 rounded-lg bg-slate-100">
              {credits} Credits
            </span>
            <button
              onClick={() => openRechargeModal()}
              className="text-orange-600 font-bold hover:underline ml-1 cursor-pointer"
            >
              Recharge &rarr;
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid (Clean white cards with elegant shadows & orange accents) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
          {PRICING_PLANS.map((plan, index) => {
            const directionalClass = 
              index === 0 ? 'gsap-from-left' :
              index === 1 ? 'gsap-scale' :
              'gsap-from-right';

            return (
              <motion.div
                key={plan.id}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
                className={`${directionalClass} relative rounded-3xl p-6 sm:p-8 flex flex-col justify-between transition-all duration-200 bg-white ${
                  plan.popular
                    ? 'border-2 border-orange-500 shadow-xl shadow-orange-500/10 ring-4 ring-orange-500/5'
                    : 'border border-slate-200/90 shadow-md hover:shadow-lg'
                }`}
              >
              {plan.badge && (
                <div className="absolute -top-3.5 right-6 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-500 text-white shadow-md shadow-orange-500/20">
                  {plan.badge}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900 font-heading">{plan.name}</h3>
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                    {plan.credits} Credits
                  </span>
                </div>

                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">₹{plan.priceInr}</span>
                  <span className="text-xs text-slate-500 font-medium">/ one-time</span>
                </div>

                <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                  Provides approximately <strong className="text-slate-800 font-semibold">~{plan.approxMinutes} minutes</strong> of active GSM phone relay or {Math.floor(plan.credits / 5)} accessible video meetings.
                </p>

                {/* Feature Checklist */}
                <div className="mt-6 space-y-3 pt-6 border-t border-slate-100">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono block">
                    Plan Highlights
                  </span>
                  {plan.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-600">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-4">
                <button
                  onClick={() => openRechargeModal(plan)}
                  className={`w-full py-3.5 rounded-2xl font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
                    plan.popular
                      ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20'
                      : 'bg-slate-900 hover:bg-slate-800 text-white'
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

        {/* Breakdown of Credits Usage (Clean Enterprise White Card) */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/90 shadow-md space-y-6 gsap-reveal">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center">
              <Layers className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 font-heading">How Credits Work</h3>
              <p className="text-xs text-slate-500">Usage is tracked only while real-time AI and carrier trunks are active</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="gsap-from-left p-5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-white border border-slate-200 text-orange-600 shrink-0 shadow-xs">
                <PhoneCall className="w-4 h-4 text-orange-500" />
              </div>
              <div className="text-xs space-y-1">
                <span className="font-bold text-slate-900 block text-sm">Cellular Telephone Relay</span>
                <p className="text-slate-600 leading-relaxed">
                  Consumes <strong>1 Credit every 10 seconds</strong> of active caller voice streaming. Covers Exotel telephone carrier trunking and Groq Whisper neural transcription.
                </p>
              </div>
            </div>

            <div className="gsap-from-right p-5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-white border border-slate-200 text-cyan-600 shrink-0 shadow-xs">
                <Video className="w-4 h-4 text-cyan-600" />
              </div>
              <div className="text-xs space-y-1">
                <span className="font-bold text-slate-900 block text-sm">Accessible Video Meetings</span>
                <p className="text-slate-600 leading-relaxed">
                  Consumes <strong>5 Credits per meeting session</strong>. Includes WebRTC HD video, 3D animated avatar, and bidirectional speech translation.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Security & Support Guarantee */}
        <div className="gsap-reveal flex flex-col sm:flex-row items-center justify-between gap-4 p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Encrypted UPI transactions powered by NPCI Unified Payments Interface.</span>
          </div>
          <div className="flex items-center gap-3 text-slate-500 font-mono text-[11px] font-bold">
            <span className="px-2 py-1 rounded bg-slate-100 border border-slate-200">GPay</span>
            <span className="px-2 py-1 rounded bg-slate-100 border border-slate-200">PhonePe</span>
            <span className="px-2 py-1 rounded bg-slate-100 border border-slate-200">Paytm</span>
            <span className="px-2 py-1 rounded bg-slate-100 border border-slate-200">BHIM</span>
          </div>
        </div>

      </main>

      <Footer />
    </div>
  );
}
