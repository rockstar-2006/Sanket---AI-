'use client';

import React, { useState } from 'react';
import { X, Check, FileText, Briefcase, Sparkles, RefreshCw } from 'lucide-react';

interface ContextDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveContext: (resume: string, jobDescription: string) => void;
  initialResume?: string;
  initialJobDescription?: string;
}

export function ContextDrawer({
  isOpen,
  onClose,
  onSaveContext,
  initialResume = `Experienced Full Stack Engineer.
Core Skills: TypeScript, React, Next.js, Node.js, Kubernetes, Docker, Python, PostgreSQL, Redis, GraphQL, WebRTC, TailwindCSS, AWS, Three.js, MediaPipe, LiveKit.
Projects: Built microservices platform deployed with Kubernetes and Helm, real-time caching layers with Redis, and AI multimodal pipelines.`,
  initialJobDescription = `Senior AI & Telehealth Platform Engineer.
Required: Kubernetes container orchestration, Docker, Next.js, WebSockets, WebRTC, real-time video streaming, PostgreSQL database design, Redis caching, and Google GenAI agent integration.`,
}: ContextDrawerProps) {
  const [resume, setResume] = useState(initialResume);
  const [jobDescription, setJobDescription] = useState(initialJobDescription);
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveContext(resume, jobDescription);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-cyan-500/40 rounded-3xl p-6 shadow-2xl shadow-cyan-950/60 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-white font-bold text-base">LLM Context Engine Dictionary</h3>
              <p className="text-xs text-slate-400">
                Ground the fingerspelling auto-completer with Candidate Resume & Job Description.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Candidate Resume Textarea */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
            <FileText className="w-4 h-4" />
            Candidate Resume & Technical Skills
          </label>
          <textarea
            value={resume}
            onChange={(e) => setResume(e.target.value)}
            rows={5}
            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-3 text-xs text-slate-200 font-mono focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
            placeholder="Paste candidate technical skills, languages, frameworks..."
          />
        </div>

        {/* Job Description Textarea */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
            <Briefcase className="w-4 h-4" />
            Job Description & Role Requirements
          </label>
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            rows={5}
            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-3 text-xs text-slate-200 font-mono focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400/40"
            placeholder="Paste target job requirements and architecture stack..."
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <span className="text-[11px] text-slate-500">
            Terms are pre-compiled into a 0ms prefix Trie and synchronized with the Google GenAI Context Agent.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/20 transition active:scale-95"
            >
              {saved ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>Context Updated!</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>Sync Context Engine</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
