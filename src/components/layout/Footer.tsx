'use client';

import React from 'react';
import Link from 'next/link';
import { Heart, ShieldCheck, Lock, Sparkles, Video } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white text-slate-600 py-16 border-t border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          
          <div>
            <div className="flex items-center gap-2 font-extrabold text-2xl text-slate-900 tracking-tight mb-3">
              Sanket<span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
            </div>
            <p className="text-sm text-slate-500 leading-relaxed">
              The effortless way to conduct accessible AI video meetings. Connecting sign language users directly with anyone in seconds.
            </p>
          </div>

          <div>
            <h4 className="text-slate-900 font-bold text-sm mb-4">Meeting Solutions</h4>
            <ul className="space-y-2.5 text-sm text-slate-600">
              <li><Link href="/#solutions" className="hover:text-orange-500 transition">Job & Technical Interviews</Link></li>
              <li><Link href="/#solutions" className="hover:text-orange-500 transition">Telemedicine Consultations</Link></li>
              <li><Link href="/#solutions" className="hover:text-orange-500 transition">Academic Viva & Campus Placements</Link></li>
              <li><Link href="/#solutions" className="hover:text-orange-500 transition">Official Verification Calls</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-slate-900 font-bold text-sm mb-4">Security & Privacy</h4>
            <ul className="space-y-2.5 text-sm text-slate-600">
              <li className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-500" /> 100% On-Device Landmark AI</li>
              <li className="flex items-center gap-2"><Lock className="w-4 h-4 text-cyan-500" /> End-to-End Encrypted Media</li>
              <li className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-orange-500" /> Real-time Speech Subtitles</li>
            </ul>
          </div>

          <div>
            <h4 className="text-slate-900 font-bold text-sm mb-4">Accessibility First</h4>
            <p className="text-sm text-slate-500 leading-relaxed">
              Fully compliant with RPWD Act 2016 inclusive hiring guidelines, eliminating human interpreter dependencies.
            </p>
          </div>

        </div>

        <div className="pt-8 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400">
          <p>© {new Date().getFullYear()} Sanket Platform. All rights reserved.</p>
          <p className="flex items-center gap-1 mt-2 sm:mt-0">
            Crafted with <Heart className="w-3.5 h-3.5 text-orange-500 fill-orange-500" /> for Equal Access
          </p>
        </div>
      </div>
    </footer>
  );
};
