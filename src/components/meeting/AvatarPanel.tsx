'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { AvatarModel, matchSignWord } from './AvatarModel';
import { Mic, Volume2, VolumeX, Bot } from 'lucide-react';

interface AvatarPanelProps {
  speakingText: string;
  isSpeaking: boolean;
  onClose: () => void;
}

// Animated waveform bars shown while speaking
function WaveformBars({ active }: { active: boolean }) {
  return (
    <div className="flex items-end gap-0.5 h-5">
      {[1, 1.4, 0.8, 1.6, 1, 1.2, 0.7, 1.5, 1].map((h, i) => (
        <div
          key={i}
          className="w-1 rounded-full bg-orange-400 transition-all"
          style={{
            height: active ? `${h * 10}px` : '3px',
            animation: active ? `waveBar 0.${5 + i}s ease-in-out infinite alternate` : 'none',
            animationDelay: `${i * 60}ms`,
            opacity: active ? 1 : 0.3,
          }}
        />
      ))}
      <style>{`
        @keyframes waveBar {
          from { transform: scaleY(0.4); }
          to   { transform: scaleY(1.0); }
        }
      `}</style>
    </div>
  );
}

export function AvatarPanel({ speakingText, isSpeaking, onClose }: AvatarPanelProps) {
  const [displayText, setDisplayText] = useState('');
  const [charIdx, setCharIdx] = useState(0);
  const [signWord, setSignWord] = useState<string | null>(null);

  // Typewriter effect for the speech bubble
  useEffect(() => {
    if (!speakingText) {
      setDisplayText('');
      setCharIdx(0);
      setSignWord(null);
      return;
    }
    setCharIdx(0);
    setDisplayText('');
    const matched = matchSignWord(speakingText);
    if (matched) {
      setSignWord(matched);
    }
  }, [speakingText]);

  useEffect(() => {
    if (!speakingText || charIdx >= speakingText.length) return;
    const t = setTimeout(() => {
      setDisplayText(speakingText.slice(0, charIdx + 1));
      setCharIdx((c) => c + 1);
    }, 28);
    return () => clearTimeout(t);
  }, [speakingText, charIdx]);

  return (
    <div className="relative flex flex-col bg-slate-900 rounded-2xl overflow-hidden border border-slate-700/60 shadow-2xl h-full w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-950/70 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-orange-400 animate-pulse' : 'bg-slate-600'}`} />
          <Bot className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-white text-xs font-bold tracking-wide">3D Sign Avatar</span>
        </div>
        <div className="flex items-center gap-2">
          <WaveformBars active={isSpeaking} />
          {isSpeaking ? (
            <Volume2 className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
          ) : (
            <VolumeX className="w-3.5 h-3.5 text-slate-500" />
          )}
          <button
            onClick={onClose}
            className="ml-1 text-slate-500 hover:text-white transition text-xs px-2 py-0.5 rounded-lg hover:bg-slate-800"
          >
            ✕
          </button>
        </div>
      </div>

      {/* 3D Canvas */}
      <div className="flex-1 min-h-0 relative">
        <AvatarModel
          isSpeaking={isSpeaking}
          signWord={signWord}
          onSignComplete={() => setSignWord(null)}
          className="w-full h-full"
        />

        {/* Speaking indicator ring around avatar */}
        {isSpeaking && (
          <div
            className="absolute inset-0 pointer-events-none rounded-xl border-2 border-orange-400/30"
            style={{ animation: 'speakRing 1s ease-in-out infinite alternate' }}
          />
        )}
      </div>

      {/* Speech bubble at bottom */}
      <div className="shrink-0 px-3 pb-3">
        <div
          className={`rounded-xl px-3 py-2.5 text-xs leading-relaxed font-body min-h-[44px] transition-all duration-300 ${
            isSpeaking
              ? 'bg-orange-500/15 border border-orange-500/40 text-orange-100'
              : 'bg-slate-800/70 border border-slate-700/50 text-slate-400'
          }`}
        >
          {displayText ? (
            <>
              {displayText}
              {charIdx < (speakingText?.length ?? 0) && (
                <span className="inline-block w-0.5 h-3 bg-orange-400 ml-0.5 align-middle animate-pulse" />
              )}
            </>
          ) : (
            <span className="italic opacity-50">Waiting for message...</span>
          )}
        </div>
      </div>

      <style>{`
        @keyframes speakRing {
          from { box-shadow: 0 0 0 0 rgba(251,146,60,0.0); }
          to   { box-shadow: 0 0 0 8px rgba(251,146,60,0.12); }
        }
      `}</style>
    </div>
  );
}
