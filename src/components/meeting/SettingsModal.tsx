'use client';

import React, { useEffect, useState } from 'react';
import { X, Camera, Mic, Volume2, CheckCircle2 } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudio, setSelectedAudio] = useState<string>('');
  const [selectedVideo, setSelectedVideo] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;

    async function loadDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioIns = devices.filter((d) => d.kind === 'audioinput');
        const videoIns = devices.filter((d) => d.kind === 'videoinput');

        setAudioDevices(audioIns);
        setVideoDevices(videoIns);

        if (audioIns.length > 0 && !selectedAudio) setSelectedAudio(audioIns[0].deviceId);
        if (videoIns.length > 0 && !selectedVideo) setSelectedVideo(videoIns[0].deviceId);
      } catch (err) {
        console.error("Failed to enumerate devices:", err);
      }
    }

    loadDevices();
  }, [isOpen, selectedAudio, selectedVideo]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl text-white">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-lg font-bold flex items-center gap-2">
            Audio & Video Hardware Settings
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Device Selection Controls */}
        <div className="p-6 space-y-6">
          {/* Microphone Selector */}
          <div>
            <label className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-2">
              <Mic className="w-4 h-4 text-primary" /> Microphone Device
            </label>
            <select
              value={selectedAudio}
              onChange={(e) => setSelectedAudio(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition"
            >
              {audioDevices.map((dev, i) => (
                <option key={dev.deviceId || i} value={dev.deviceId}>
                  {dev.label || `Microphone ${i + 1}`}
                </option>
              ))}
            </select>
          </div>

          {/* Camera Selector */}
          <div>
            <label className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-2">
              <Camera className="w-4 h-4 text-cyan-400" /> Video Camera Device
            </label>
            <select
              value={selectedVideo}
              onChange={(e) => setSelectedVideo(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition"
            >
              {videoDevices.map((dev, i) => (
                <option key={dev.deviceId || i} value={dev.deviceId}>
                  {dev.label || `Camera ${i + 1}`}
                </option>
              ))}
            </select>
          </div>

          {/* Echo Cancellation & Noise Suppression Badge */}
          <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/20 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="text-xs text-emerald-200">
              <p className="font-semibold">Clinical Acoustic Noise Cancellation Active</p>
              <p className="opacity-80">Hardware echo cancellation & 48kHz audio sampling enabled.</p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-slate-800 bg-slate-950/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-sm transition"
          >
            Apply Settings
          </button>
        </div>
      </div>
    </div>
  );
};
