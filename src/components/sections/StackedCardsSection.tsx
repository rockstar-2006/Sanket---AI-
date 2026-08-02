'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Zap, Hand, MessageSquareText, ChevronRight } from 'lucide-react';

const steps = [
  {
    id: 1,
    stepBadge: 'STEP 01',
    title: 'Create & Share Room Link',
    description: 'Click "Start Free Meeting" to generate an encrypted room code. Share the short link or QR code with your participant in one click.',
    badgeText: 'No Software Installs Required',
    badgeIcon: Zap,
    imageSrc: '/img_instant_invite.jpg',
    tagText: '1-CLICK LINK GENERATED',
    gradient: 'from-orange-500/10 via-amber-500/5 to-white',
    badgeColor: 'bg-orange-50 text-orange-600 border-orange-200',
    tagColor: 'bg-orange-500 text-white',
  },
  {
    id: 2,
    stepBadge: 'STEP 02',
    title: 'Sign or Speak Naturally',
    description: 'The deaf or mute candidate signs naturally using Indian Sign Language. The interviewer speaks into their microphone normally.',
    badgeText: '21 Landmark Nodes at 30 FPS',
    badgeIcon: Hand,
    imageSrc: '/img_sign_candidate.jpg',
    tagText: 'LIVE LANDMARK AI',
    gradient: 'from-blue-500/10 via-indigo-500/5 to-white',
    badgeColor: 'bg-blue-50 text-blue-600 border-blue-200',
    tagColor: 'bg-blue-600 text-white',
  },
  {
    id: 3,
    stepBadge: 'STEP 03',
    title: 'Instant Voice & Live Subtitles',
    description: 'Sanket AI converts signed gestures to spoken audio output for the caller, and transcribes spoken responses into live text subtitles on screen.',
    badgeText: 'Real-time Speech-to-Text',
    badgeIcon: MessageSquareText,
    imageSrc: '/img_subtitles_bubble.jpg',
    tagText: 'DUAL-WAY TRANSLATION ACTIVE',
    gradient: 'from-emerald-500/10 via-teal-500/5 to-white',
    badgeColor: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    tagColor: 'bg-emerald-600 text-white',
  },
];

export function StackedCardsSection() {
  const [activeIndex, setActiveIndex] = useState(0);

  // Auto cycle active card every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % steps.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section id="how-it-works" className="py-20 bg-slate-50 border-y border-slate-200/80 relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-orange-600 font-bold text-xs uppercase tracking-wider shadow-xs">
            <Sparkles className="w-4 h-4 text-orange-500" /> Interactive Workflow
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
            How It Works in 3 Simple Steps
          </h2>
          <p className="text-slate-600 text-base">
            Click any step below to reveal how Sanket AI connects signers and speakers.
          </p>
        </div>

        {/* Step Selector Pills */}
        <div className="flex items-center justify-center gap-3 flex-wrap">
          {steps.map((step, index) => {
            const isActive = activeIndex === index;
            return (
              <button
                key={step.id}
                onClick={() => setActiveIndex(index)}
                className={`px-5 py-2.5 rounded-full font-bold text-xs transition-all flex items-center gap-2 ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-md scale-105'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-orange-500 animate-pulse' : 'bg-slate-300'}`} />
                <span>{step.stepBadge}: {step.title.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>

        {/* 3D Stacked Card Container (Cards layered behind each other peek-a-boo style) */}
        <div className="relative w-full max-w-5xl mx-auto h-[480px] sm:h-[420px] flex items-center justify-center">
          {steps.map((step, index) => {
            // Calculate relative offset from active card
            const offset = (index - activeIndex + steps.length) % steps.length;
            
            // Render zIndex, scale, and vertical offset for 3D peek-a-boo deck stack
            let zIndex = 30 - offset * 10;
            let scale = 1 - offset * 0.04;
            let translateY = offset * 16;
            let opacity = 1 - offset * 0.25;

            if (offset === 0) {
              // Active card in front
              zIndex = 30;
              scale = 1;
              translateY = 0;
              opacity = 1;
            }

            return (
              <motion.div
                key={step.id}
                initial={false}
                animate={{
                  zIndex,
                  scale,
                  y: translateY,
                  opacity,
                }}
                transition={{
                  duration: 0.6,
                  ease: [0.32, 0.72, 0, 1],
                }}
                onClick={() => setActiveIndex(index)}
                className={`absolute inset-0 w-full h-full p-6 sm:p-10 rounded-3xl bg-white border border-slate-200/90 shadow-2xl cursor-pointer flex flex-col justify-center bg-gradient-to-br ${step.gradient}`}
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center">
                  
                  {/* Left Column Text */}
                  <div className="lg:col-span-6 space-y-4">
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full font-mono text-xs font-bold border uppercase tracking-widest ${step.badgeColor}`}>
                      {step.stepBadge}
                    </div>
                    <h3 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                      {step.title}
                    </h3>
                    <p className="text-slate-600 text-sm sm:text-base leading-relaxed font-lexend">
                      {step.description}
                    </p>
                    <div className="pt-1">
                      <span className={`inline-flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-full border ${step.badgeColor}`}>
                        <step.badgeIcon className="w-4 h-4" /> {step.badgeText}
                      </span>
                    </div>
                  </div>

                  {/* Right Column 3D Illustration */}
                  <div className="lg:col-span-6 relative rounded-2xl overflow-hidden border border-slate-200 shadow-md group aspect-[16/10]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={step.imageSrc}
                      alt={step.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className={`absolute top-3 right-3 px-3 py-1 rounded-full font-mono text-[10px] font-bold shadow-md ${step.tagColor}`}>
                      {step.tagText}
                    </div>
                  </div>

                </div>
              </motion.div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
