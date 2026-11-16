'use client';

import React, { useState, useMemo } from 'react';
import { QrCodeEncoder } from '@/lib/qrCode';
import { 
  QrCode, 
  Copy, 
  Check, 
  Download, 
  Share2, 
  X, 
  Smartphone, 
  Video, 
} from 'lucide-react';

interface QrInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
}

export const QrInviteModal: React.FC<QrInviteModalProps> = ({
  isOpen,
  onClose,
  roomId,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Compute absolute join URL
  const joinUrl = useMemo(() => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/room/${encodeURIComponent(roomId)}`;
    }
    return `https://sanket.ai/room/${roomId}`;
  }, [roomId]);

  // Generate QR matrix
  const matrix = useMemo(() => {
    try {
      return QrCodeEncoder.encode(joinUrl);
    } catch (e) {
      console.error('[QR] Failed to encode:', e);
      return [];
    }
  }, [joinUrl]);

  if (!isOpen) return null;

  const handleCopyCode = async () => {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(roomId);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  const handleCopyLink = async () => {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(joinUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join Sanket AI Meeting (${roomId})`,
          text: `Join our accessible video meeting on Sanket AI with real-time Indian Sign Language translation. Room Code: ${roomId}`,
          url: joinUrl,
        });
      } catch {
        // User cancelled share
      }
    } else {
      handleCopyLink();
    }
  };

  const handleDownloadQr = () => {
    if (!matrix || matrix.length === 0) return;
    const size = matrix.length;
    const scale = 14; // Crisp 600px+ resolution
    const margin = 4 * scale;
    const canvasSize = size * scale + margin * 2;

    const canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // QR modules
    ctx.fillStyle = '#0f172a';
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (matrix[r][c]) {
          ctx.fillRect(margin + c * scale, margin + r * scale, scale, scale);
        }
      }
    }

    // Brand bottom label on exported image
    ctx.fillStyle = '#f97316';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Sanket AI • Room ${roomId}`, canvasSize / 2, canvasSize - 18);

    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `Sanket_Meeting_${roomId}_QR.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const matrixSize = matrix.length;
  const cellSize = 10;
  const padding = 4;
  const viewBoxSize = (matrixSize + padding * 2) * cellSize;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      
      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl p-6 sm:p-8 text-white shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-400 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-orange-500/20 shrink-0">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white tracking-tight">
                Scan to Join Meeting
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 font-mono text-[10px] font-bold uppercase">
                Instant Access
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Point any smartphone camera to jump directly into this consultation.
            </p>
          </div>
        </div>

        {/* QR Code Presentation Box */}
        <div className="flex flex-col items-center justify-center mb-6">
          <div className="p-4 bg-white rounded-3xl shadow-xl border border-slate-200/80 relative group">
            {matrix.length > 0 ? (
              <svg
                viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
                className="w-56 h-56 sm:w-64 sm:h-64 block rounded-xl"
              >
                {/* Quiet Zone */}
                <rect width={viewBoxSize} height={viewBoxSize} fill="#ffffff" />
                {/* Dark Modules */}
                {matrix.map((row, r) =>
                  row.map((isDark, c) =>
                    isDark ? (
                      <rect
                        key={`${r}-${c}`}
                        x={(c + padding) * cellSize}
                        y={(r + padding) * cellSize}
                        width={cellSize}
                        height={cellSize}
                        fill="#0f172a"
                      />
                    ) : null
                  )
                )}
              </svg>
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-slate-400 text-xs">
                Generating QR...
              </div>
            )}

            {/* Center Logo Badge */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-10 h-10 rounded-xl bg-slate-900 border-2 border-white shadow-lg flex items-center justify-center text-orange-400">
                <Video className="w-5 h-5" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 mt-3 text-[11px] text-slate-400 font-medium">
            <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
            <span>Compatible with iPhone (iOS Camera), Android, and Tablet scanners</span>
          </div>
        </div>

        {/* Room Code Monospace Card */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 mb-4 flex items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
              Meeting Room Code
            </span>
            <span className="text-2xl font-black text-white font-mono tracking-widest">
              {roomId}
            </span>
          </div>

          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 transition cursor-pointer active:scale-95"
          >
            {copiedCode ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-300" />
                <span>Copy Code</span>
              </>
            )}
          </button>
        </div>

        {/* Direct Link Bar */}
        <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-2.5 pl-3.5 mb-6 flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-400 font-mono truncate max-w-[260px] sm:max-w-xs">
            {joinUrl}
          </span>
          <button
            onClick={handleCopyLink}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition shrink-0 cursor-pointer flex items-center gap-1.5"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy Link</span>
              </>
            )}
          </button>
        </div>

        {/* Footer Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleDownloadQr}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs shadow-md shadow-orange-500/20 transition cursor-pointer active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Download QR Image</span>
          </button>

          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white font-bold text-xs transition cursor-pointer active:scale-95"
          >
            <Share2 className="w-4 h-4" />
            <span>Share Invitation</span>
          </button>
        </div>

      </div>
    </div>
  );
};
