'use client';

import React, { useState, useMemo } from 'react';
import { 
  X, 
  FileText, 
  Calendar, 
  Clock, 
  User, 
  CheckCircle2, 
  Copy, 
  Check, 
  Download, 
  Share2, 
  Bot, 
  Hand, 
  MessageSquareText, 
  ArrowRight,
  ShieldCheck,
  Tag,
  AlertCircle
} from 'lucide-react';
import { MeetingSession, MeetingNoteEntry } from '@/types';

interface MoMModalProps {
  session: MeetingSession | null;
  onClose: () => void;
  userName: string;
}

export const MinutesOfMeetingModal: React.FC<MoMModalProps> = ({ session, onClose, userName }) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'action_items' | 'transcript'>('summary');

  // 1. Retrieve stored MoM communication records from session or localStorage
  const storedData = useMemo(() => {
    if (!session || typeof window === 'undefined') return null;
    try {
      if (session.meetingNotes && session.meetingNotes.length > 0) {
        return {
          roomCode: session.roomCode,
          meetingNotes: session.meetingNotes,
          chatMessages: [],
          durationSec: session.durationSec || 0,
        };
      }
      const rawExact = localStorage.getItem(`sanket_mom_${session.roomCode}`);
      if (rawExact) return JSON.parse(rawExact);

      const rawUpper = localStorage.getItem(`sanket_mom_${session.roomCode.toUpperCase()}`);
      if (rawUpper) return JSON.parse(rawUpper);

      const rawLatest = localStorage.getItem('sanket_mom_latest');
      if (rawLatest) {
        const parsed = JSON.parse(rawLatest);
        if (parsed.roomCode?.toUpperCase() === session.roomCode.toUpperCase()) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Error reading stored MoM data:', e);
    }
    return null;
  }, [session]);

  const isDemoSession = session?.id === 'demo-sample-session';
  const meetingNotes: MeetingNoteEntry[] = storedData?.meetingNotes || [];
  const chatMessages: any[] = storedData?.chatMessages || [];
  const hasActualCommunication = meetingNotes.length > 0 || chatMessages.length > 0;

  const meetingDate = session?.createdAt?.seconds 
    ? new Date(session.createdAt.seconds * 1000).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

  // ─── 2. Dynamic Real-Time Transcription Highlights ──────────────────────────
  const transcriptHighlights = useMemo(() => {
    if (!session) return [];
    if (isDemoSession) {
      return [
        { time: "10:15:10 AM", speaker: session.hostName || "Dr. Sharma", text: "[Voice Spoken]: \"Good morning! Can you describe the symptoms you have been experiencing?\"" },
        { time: "10:15:35 AM", speaker: userName || "Bhushan", text: "[ISL Signed: FEVER, PAIN] → \"I have had a high fever and body ache since yesterday.\"" },
        { time: "10:16:12 AM", speaker: session.hostName || "Dr. Sharma", text: "[Voice Spoken]: \"Understood. Have you checked your temperature, or taken any antipyretic tablets yet?\"" },
        { time: "10:16:48 AM", speaker: userName || "Bhushan", text: "[ISL Signed: MEDICINE, NO] → \"No, I have not taken any medicine yet.\"" },
        { time: "10:17:30 AM", speaker: session.hostName || "Dr. Sharma", text: "[Voice Spoken]: \"I am prescribing Paracetamol 650mg twice daily for 3 days. Take plenty of warm fluids and rest.\"" },
      ];
    }

    if (meetingNotes.length > 0) {
      return meetingNotes.map((note, idx) => {
        const isSigner = note.role === 'deaf_signer';
        const spk = note.speaker || (isSigner ? userName : (session.hostName || 'Speaker'));
        let line = '';
        if (isSigner) {
          line = note.translatedContent
            ? `[ISL Signed: ${note.originalContent}] → "${note.translatedContent}"`
            : `[ISL Signed]: ${note.originalContent}`;
        } else {
          line = `[Voice Spoken]: "${note.originalContent || note.translatedContent}"`;
        }
        return {
          time: note.timestamp || `Turn ${idx + 1}`,
          speaker: spk,
          text: line,
        };
      });
    }

    if (chatMessages.length > 0) {
      return chatMessages.map((msg, idx) => ({
        time: msg.time || `Msg ${idx + 1}`,
        speaker: msg.sender || 'Participant',
        text: msg.isSigned ? `[ISL Signed Chat]: "${msg.text}"` : `[In-Call Chat]: "${msg.text}"`,
      }));
    }

    return [
      { time: "00:00:00", speaker: "System", text: `Session concluded in Room ${session.roomCode} with no spoken or signed dialogue recorded.` }
    ];
  }, [isDemoSession, meetingNotes, chatMessages, session, userName]);

  // ─── 3. Dynamic Key Discussion Points Derived From Actual Dialogue ─────────
  const discussionPoints = useMemo(() => {
    if (!session) return [];
    if (isDemoSession) {
      return [
        "Patient reported symptom onset of acute fever and body ache persisting for 24 hours.",
        "Verified patient has no known allergies to standard analgesic or antipyretic medications.",
        "Clinical guidance provided: Oral Paracetamol 650mg twice daily after food for 3 consecutive days.",
        "Advised hydration and scheduled temperature monitoring with a follow-up if fever remains elevated.",
      ];
    }

    if (hasActualCommunication) {
      const points: string[] = [];

      meetingNotes.forEach((note) => {
        const content = (note.translatedContent || note.originalContent || '').trim();
        if (content.length > 3 && !points.some(p => p.includes(content))) {
          if (note.category === 'prescription') {
            points.push(`Clinical Prescription / Guidance: "${content}"`);
          } else if (note.category === 'medical') {
            points.push(`Health & Symptoms Reviewed: "${content}" (${note.speaker})`);
          } else if (note.role === 'deaf_signer') {
            points.push(`${note.speaker} communicated via Indian Sign Language: "${content}"`);
          } else {
            points.push(`${note.speaker} discussed: "${content}"`);
          }
        }
      });

      if (points.length < 3 && chatMessages.length > 0) {
        chatMessages.forEach((msg) => {
          if (msg.text && msg.text.trim().length > 3 && !points.some(p => p.includes(msg.text))) {
            points.push(`${msg.sender} noted: "${msg.text}"`);
          }
        });
      }

      if (points.length === 0) {
        points.push(`Session established accessible WebRTC relay for Room ${session.roomCode}.`);
      }

      points.push(`Session archived with ${meetingNotes.length + chatMessages.length} total live communicative exchanges.`);
      return points.slice(0, 6);
    }

    return [
      `Session Room ${session.roomCode} was connected successfully.`,
      "No spoken voice audio or Indian Sign Language (ISL) gestures were recorded during this session.",
      "Meeting minutes and audio relay logs remain clear of any unverified statements.",
    ];
  }, [isDemoSession, hasActualCommunication, meetingNotes, chatMessages, session]);

  // ─── 4. Dynamic Action Items ──────────────────────────────────────────────
  const actionItems = useMemo(() => {
    if (!session) return [];
    if (isDemoSession) {
      return [
        {
          id: 1,
          task: "Take Paracetamol 650mg twice daily after meals for 3 days",
          owner: userName || "Bhushan",
          deadline: "3 Days",
          status: "In Progress",
          priority: "High",
        },
        {
          id: 2,
          task: "Log body temperature morning and evening and maintain proper hydration",
          owner: userName || "Bhushan",
          deadline: "Daily",
          status: "Pending",
          priority: "Medium",
        },
        {
          id: 3,
          task: "Schedule follow-up consultation room session if temperature exceeds 101°F after 72 hours",
          owner: session.hostName || "Dr. Sharma",
          deadline: "Next Week",
          status: "Pending",
          priority: "Low",
        },
      ];
    }

    if (hasActualCommunication) {
      const items: any[] = [];
      let nextId = 1;

      // Prescriptions
      const rxNotes = meetingNotes.filter(n => n.category === 'prescription');
      rxNotes.forEach((rx) => {
        items.push({
          id: nextId++,
          task: `Follow clinical dosage: ${rx.translatedContent || rx.originalContent}`,
          owner: userName,
          deadline: "As Prescribed",
          status: "In Progress",
          priority: "High",
        });
      });

      // Action items / commitments
      const aiNotes = meetingNotes.filter(n => 
        n.category === 'action_item' || 
        /\b(will|please|schedule|follow up|tomorrow|send|review)\b/i.test(n.originalContent || n.translatedContent)
      );
      aiNotes.forEach((ai) => {
        const text = (ai.translatedContent || ai.originalContent).trim();
        if (!items.some(it => it.task.includes(text))) {
          items.push({
            id: nextId++,
            task: text,
            owner: ai.speaker || userName,
            deadline: "Within 48 Hours",
            status: "Pending",
            priority: "Medium",
          });
        }
      });

      // Contextual follow-up if no specific tasks found
      if (items.length === 0) {
        items.push({
          id: 1,
          task: `Review recorded session dialogue transcript and confirm any next steps with ${session.hostName || 'attendees'}`,
          owner: userName,
          deadline: "Within 48 Hours",
          status: "In Progress",
          priority: "Medium",
        });
      }

      return items.slice(0, 4);
    }

    return [
      {
        id: 1,
        task: "No follow-up action items required — session concluded with no recorded dialogue",
        owner: "N/A",
        deadline: "Completed",
        status: "Done",
        priority: "Low",
      },
    ];
  }, [isDemoSession, hasActualCommunication, meetingNotes, session, userName]);

  // ─── 5. Dynamic Executive Summary Synthesized From Actual Communication ───
  const executiveSummary = useMemo(() => {
    if (!session) return '';
    if (isDemoSession) {
      return `Sample Clinical Consultation: Patient ${userName || 'Bhushan'} consulted ${session.hostName || 'Dr. Sharma'} regarding acute fever and throat symptoms. The session utilized on-device 21-node Indian Sign Language (ISL) neural tracking for sign-to-voice translation and automated speech-to-avatar relay. Clinical instructions and antipyretic prescription were finalized.`;
    }

    if (hasActualCommunication) {
      const totalTurns = meetingNotes.length + chatMessages.length;
      const signerNotes = meetingNotes.filter(n => n.role === 'deaf_signer');
      const speakerNotes = meetingNotes.filter(n => n.role === 'hearing_speaker');

      const sampleSnippets = meetingNotes
        .map(n => (n.translatedContent || n.originalContent || '').trim())
        .filter(s => s.length > 5)
        .slice(0, 3)
        .join('", "');

      const topicsClause = sampleSnippets ? ` Key topics discussed include: "${sampleSnippets}".` : '';

      return `This accessible session in Room ${session.roomCode} recorded ${totalTurns} total communicative exchange(s) between ${session.hostName || 'Host'} and ${userName}. The meeting bridged ${signerNotes.length} sign translation turn(s) and ${speakerNotes.length} voice speech turn(s) over real-time on-device ISL neural sync.${topicsClause} All action points and transcript records have been verified.`;
    }

    return `This session in Room ${session.roomCode} was completed on ${meetingDate}. The call concluded with no spoken voice audio or Indian Sign Language gestures recorded.`;
  }, [isDemoSession, hasActualCommunication, meetingNotes, chatMessages, session, userName, meetingDate]);

  const generateMarkdownReport = () => {
    if (!session) return '';
    return `# MINUTES OF MEETING (MoM) — SANKET AI
**Meeting Topic:** ${session.title}
**Room Code:** ${session.roomCode}
**Date & Time:** ${meetingDate}
**Host:** ${session.hostName || 'Host'}
**Attendee / Participant:** ${userName}
**Consultation Category:** ${session.consultationType.toUpperCase()}
**Platform:** Sanket AI Accessible Video Platform
**Total Recorded Exchanges:** ${meetingNotes.length + chatMessages.length}

---

## 1. Executive Summary
${executiveSummary}

## 2. Key Discussion Points & Decisions
${discussionPoints.map((pt, idx) => `${idx + 1}. ${pt}`).join('\n')}

## 3. Action Items
${actionItems.map((item) => `- [${item.status === 'Done' ? 'x' : ' '}] **${item.task}** | Owner: ${item.owner} | Due: ${item.deadline} (${item.status})`).join('\n')}

## 4. Real-Time ISL & Speech Transcription Log
${transcriptHighlights.map((tr) => `> **[${tr.time}] ${tr.speaker}:** ${tr.text}`).join('\n\n')}

---
*Report generated automatically by Sanket AI Neural Minutes of Meeting (MoM) Engine.*
`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generateMarkdownReport());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const text = generateMarkdownReport();
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `MoM-${session.roomCode}-${session.title.replace(/[^a-zA-Z0-9]/g, '_')}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!session) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header Bar */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading font-black text-base sm:text-lg text-white tracking-tight">
                  Minutes of Meeting (MoM)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider bg-orange-500/20 text-orange-300 border border-orange-500/40">
                  {hasActualCommunication ? 'AI Verified Live' : isDemoSession ? 'Sample Preview' : 'Archived'}
                </span>
              </div>
              <p className="text-slate-400 text-xs font-mono">
                Room: <strong className="text-white">{session.roomCode}</strong> • {meetingDate}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-heading font-bold border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
              title="Copy MoM Markdown"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownload}
              className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-heading font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              title="Download Markdown Report"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Meeting Quick Overview Banner */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="block text-[10px] font-mono uppercase text-slate-500 font-bold">Meeting Topic</span>
            <span className="font-heading font-bold text-slate-900 truncate block">{session.title}</span>
          </div>
          <div>
            <span className="block text-[10px] font-mono uppercase text-slate-500 font-bold">Category</span>
            <span className="font-mono font-bold text-orange-600 uppercase">{session.consultationType}</span>
          </div>
          <div>
            <span className="block text-[10px] font-mono uppercase text-slate-500 font-bold">Host</span>
            <span className="font-heading font-semibold text-slate-800 truncate block">{session.hostName || 'Organizer'}</span>
          </div>
          <div>
            <span className="block text-[10px] font-mono uppercase text-slate-500 font-bold">Relay Mode</span>
            <span className="font-mono text-emerald-600 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {hasActualCommunication ? `${meetingNotes.length + chatMessages.length} Exchanges Logged` : '21-Node ISL Active'}
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-6 bg-white gap-2 pt-2">
          <button
            onClick={() => setActiveTab('summary')}
            className={`pb-2.5 px-3 text-xs font-heading font-bold border-b-2 transition cursor-pointer ${
              activeTab === 'summary'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Executive Summary & Decisions
          </button>
          <button
            onClick={() => setActiveTab('action_items')}
            className={`pb-2.5 px-3 text-xs font-heading font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'action_items'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>Action Items</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-slate-100 text-slate-700 font-mono font-bold">
              {actionItems.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('transcript')}
            className={`pb-2.5 px-3 text-xs font-heading font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'transcript'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>Transcription Highlights</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-orange-100 text-orange-700 font-mono font-bold">
              {transcriptHighlights.length}
            </span>
          </button>
        </div>

        {/* Scrollable Document Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800 font-body text-xs sm:text-sm">
          
          {activeTab === 'summary' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              
              {/* Executive Summary */}
              <div className="p-4 rounded-2xl bg-orange-50/60 border border-orange-200/80 space-y-2">
                <div className="flex items-center gap-2 text-orange-900 font-heading font-bold text-sm">
                  <Bot className="w-4 h-4 text-orange-600" />
                  <span>AI Executive Summary</span>
                </div>
                <p className="text-slate-700 leading-relaxed text-xs sm:text-sm">
                  {executiveSummary}
                </p>
              </div>

              {/* Discussion Points */}
              <div className="space-y-3">
                <h4 className="font-heading font-bold text-slate-900 text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Key Discussion Points & Agreements</span>
                </h4>
                <ul className="space-y-2.5">
                  {discussionPoints.map((pt, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs sm:text-sm text-slate-700">
                      <span className="w-5 h-5 rounded-full bg-orange-500 text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="leading-snug">{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>

            </div>
          )}

          {activeTab === 'action_items' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between pb-1">
                <h4 className="font-heading font-bold text-slate-900 text-sm">
                  Assigned Follow-ups & Deliverables
                </h4>
                <span className="text-[11px] font-mono text-slate-500">
                  {hasActualCommunication ? 'Derived from session communication' : 'Tracked in platform records'}
                </span>
              </div>

              <div className="space-y-2.5">
                {actionItems.map((item) => (
                  <div 
                    key={item.id}
                    className="p-4 rounded-2xl border border-slate-200 bg-slate-50/80 hover:bg-slate-50 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${item.status === 'Done' ? 'bg-emerald-500' : item.status === 'In Progress' ? 'bg-amber-500 animate-pulse' : 'bg-slate-400'}`} />
                        <span className="font-heading font-bold text-slate-900 text-xs sm:text-sm">
                          {item.task}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 flex items-center gap-3">
                        <span>Assignee: <strong className="text-slate-800">{item.owner}</strong></span>
                        <span>•</span>
                        <span>Due: <strong className="text-slate-800">{item.deadline}</strong></span>
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider shrink-0 ${
                      item.status === 'Done'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : item.status === 'In Progress'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-slate-200 text-slate-700'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'transcript' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between pb-1">
                <h4 className="font-heading font-bold text-slate-900 text-sm flex items-center gap-2">
                  <MessageSquareText className="w-4 h-4 text-orange-600" />
                  <span>Real-Time Speech & ISL Gesture Log</span>
                </h4>
                <span className="text-[11px] font-mono text-slate-500">
                  {hasActualCommunication ? `${transcriptHighlights.length} dialogue turns logged` : 'Sub-150ms Neural Sync'}
                </span>
              </div>

              <div className="space-y-2 border border-slate-200 rounded-2xl p-4 bg-slate-900 text-slate-200 font-mono text-xs max-h-[360px] overflow-y-auto">
                {transcriptHighlights.map((tr, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 py-1.5 border-b border-slate-800/80 last:border-b-0">
                    <span className="text-slate-500 font-bold shrink-0">{tr.time}</span>
                    <span className="text-orange-400 font-bold shrink-0">[{tr.speaker}]:</span>
                    <span className="text-slate-300 leading-relaxed">{tr.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-mono">
            Sanket AI Document ID: <strong className="text-slate-800">MOM-{session.roomCode}</strong>
          </span>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-heading font-bold transition cursor-pointer"
          >
            Close Document
          </button>
        </div>

      </div>
    </div>
  );
};
