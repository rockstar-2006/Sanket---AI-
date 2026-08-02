'use client';

import React from 'react';
import { X, Mic, MicOff, Video, VideoOff, ShieldCheck, User } from 'lucide-react';
import { ParticipantState } from '@/types';

interface ParticipantsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  localUser: ParticipantState;
  participants: Map<string, ParticipantState>;
}

export const ParticipantsSidebar: React.FC<ParticipantsSidebarProps> = ({
  isOpen,
  onClose,
  localUser,
  participants,
}) => {
  if (!isOpen) return null;

  const allList = [
    { ...localUser, socketId: 'local', isLocal: true },
    ...Array.from(participants.values()).map(p => ({ ...p, isLocal: false }))
  ];

  return (
    <div className="fixed right-0 top-0 bottom-0 w-full sm:w-80 bg-slate-900 border-l border-slate-800 text-white z-50 flex flex-col shadow-2xl transition-transform duration-300">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
        <h3 className="font-semibold text-base flex items-center gap-2">
          Participants ({allList.length}/4)
        </h3>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Participant Roster List */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3">
        {allList.map((p) => (
          <div
            key={p.socketId}
            className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:bg-slate-800 transition"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center font-bold text-primary text-sm">
                {p.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photoURL} alt={p.displayName} className="w-full h-full rounded-full object-cover" />
                ) : (
                  p.displayName.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
                  {p.displayName} {p.isLocal && <span className="text-slate-400 text-xs">(You)</span>}
                </div>
                <div className="text-xs text-slate-400 capitalize flex items-center gap-1">
                  {p.role === 'doctor' ? (
                    <span className="text-cyan-400 font-medium flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Medical Specialist
                    </span>
                  ) : (
                    'Patient Participant'
                  )}
                </div>
              </div>
            </div>

            {/* Status Icons */}
            <div className="flex items-center gap-2">
              <span className={`p-1.5 rounded-lg ${p.isMuted ? 'text-rose-400 bg-rose-500/10' : 'text-emerald-400 bg-emerald-500/10'}`}>
                {p.isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </span>
              <span className={`p-1.5 rounded-lg ${p.isVideoOff ? 'text-rose-400 bg-rose-500/10' : 'text-cyan-400 bg-cyan-500/10'}`}>
                {p.isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
              </span>
            </div>
          </div>
        ))}

        <div className="p-4 rounded-xl bg-slate-950/60 border border-dashed border-slate-700 text-center text-xs text-slate-400 mt-6">
          <p>Maximum capacity: 4 participants</p>
          <p className="text-[11px] text-slate-500 mt-1">Peer-to-peer mesh optimized for clinical clarity.</p>
        </div>
      </div>
    </div>
  );
};
