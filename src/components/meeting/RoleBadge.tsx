'use client';

import React from 'react';
import { ParticipantRole } from '@/lib/agents/types';
import { Mic, HandMetal, Sparkles } from 'lucide-react';

interface RoleBadgeProps {
  role: ParticipantRole;
  size?: 'sm' | 'md';
}

export function RoleBadge({ role, size = 'md' }: RoleBadgeProps) {
  if (role === 'deaf_signer') {
    return (
      <span className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-wider rounded-full border shadow-sm ${
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'
      } bg-cyan-950/80 text-cyan-300 border-cyan-500/50 shadow-cyan-500/20`}>
        <HandMetal className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        <span>Deaf Signer</span>
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-wider rounded-full border shadow-sm ${
      size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'
    } bg-amber-950/80 text-amber-300 border-amber-500/50 shadow-amber-500/20`}>
      <Mic className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      <span>Speaking Interviewer</span>
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
    </span>
  );
}
