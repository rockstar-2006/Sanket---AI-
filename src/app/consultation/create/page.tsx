'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { useAuth } from '@/context/AuthContext';
import { createMeetingSession } from '@/lib/firebase/services';
import { ConsultationType } from '@/types';
import { 
  Video, 
  ShieldCheck, 
  Briefcase, 
  Stethoscope, 
  GraduationCap, 
  FileCheck,
  Users, 
  ArrowRight,
  Sparkles,
  Volume2,
  Lock
} from 'lucide-react';

export default function CreateConsultationPage() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const [title, setTitle] = useState('Sign Language Video Session');
  const [description, setDescription] = useState('Accessible AI video call with real-time sign recognition.');
  const [consultationType, setConsultationType] = useState<ConsultationType>('general');
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      router.push('/auth/login');
      return;
    }

    setLoading(true);
    try {
      const session = await createMeetingSession({
        title,
        description,
        hostUid: user.uid,
        hostName: profile?.displayName || user.email?.split('@')[0] || "Host",
        consultationType,
        maxParticipants: 4,
      });

      router.push(`/consultation/join/${session.roomCode}`);
    } catch (err) {
      console.error("Failed creating session:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 bg-grid-lines text-slate-900">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        
        {/* Page Title Header */}
        <div className="text-center max-w-2xl mx-auto mb-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-orange-600 font-bold text-xs uppercase tracking-wider shadow-xs">
            <Sparkles className="w-4 h-4 text-orange-500" /> Instant Room Generator
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">
            Create Accessible Video Call
          </h1>
          <p className="text-slate-600 text-sm">
            Setup an encrypted meeting room with on-device sign language recognition and real-time speech subtitles.
          </p>
        </div>

        {/* 2-Column Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Column: UNIQUE 3D Illustration Canvas */}
          <div className="lg:col-span-6 space-y-6">
            <div className="relative rounded-3xl overflow-hidden border border-slate-200 shadow-2xl group bg-white p-4">
              <div className="relative rounded-2xl overflow-hidden aspect-[4/3]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/sanket_solutions.jpg"
                  alt="Accessible Video Meeting 3D Illustration"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                
                {/* Floating Badge */}
                <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-mono font-bold flex items-center gap-2 border border-slate-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  LiveKit SFU Active
                </div>

                {/* Subtitle Badge */}
                <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-md p-3 rounded-2xl shadow-lg border border-orange-200 flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-orange-500 text-white shrink-0">
                    <Volume2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider block">Live Speech Output</span>
                    <span className="text-xs font-bold text-slate-900">&quot;Instant Two-Way Speech & Subtitles&quot;</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Privacy note */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between text-xs font-medium text-slate-700">
              <span className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-600" />
                100% Client-Side Landmark AI
              </span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-mono font-bold text-[10px]">
                RPWD Act 2016 Compliant
              </span>
            </div>
          </div>

          {/* Right Column: Room Creation Form */}
          <div className="lg:col-span-6 bg-white rounded-3xl border border-slate-200/90 shadow-lg p-8 space-y-6">
            
            <form onSubmit={handleCreate} className="space-y-6">
              
              {/* Session Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Meeting Session Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Technical Candidate Interview"
                  className="w-full px-4 py-3.5 rounded-2xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition"
                />
              </div>

              {/* Scenario Category Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Meeting Category
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { id: 'general', label: 'Job Interview', icon: Briefcase },
                    { id: 'urgent', label: 'Telemedicine', icon: Stethoscope },
                    { id: 'specialist', label: 'Academic Viva', icon: GraduationCap },
                    { id: 'followup', label: 'Verification', icon: FileCheck },
                  ].map((item) => {
                    const Icon = item.icon;
                    const isSelected = consultationType === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setConsultationType(item.id as ConsultationType)}
                        className={`p-3.5 rounded-2xl border text-center transition flex flex-col items-center gap-2 ${
                          isSelected 
                            ? 'border-orange-500 bg-orange-50 text-orange-600 shadow-xs font-bold' 
                            : 'border-slate-200 hover:border-slate-300 text-slate-600'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-xs">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Room Capacity Info */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">LiveKit SFU Connected</div>
                    <div className="text-xs text-slate-500">Encrypted relay for up to 4 participants</div>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-mono font-bold text-xs">
                  4 Max
                </span>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 px-6 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-bold text-base shadow-md shadow-orange-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? 'Launching Room...' : 'Enter Pre-Call Lobby'}
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>

          </div>

        </div>

      </main>

      <Footer />
    </div>
  );
}
