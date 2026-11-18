import * as React from "react";
import { cn } from "@/lib/utils";
import { ShieldCheck, QrCode, Cpu, RotateCcw } from "lucide-react";

export interface FlippableIdCardProps extends React.HTMLAttributes<HTMLDivElement> {
  name?: string;
  role?: string;
  memberId?: string;
  credits?: number;
  isFlipped?: boolean;
}

export const FlippableIdCard = React.forwardRef<HTMLDivElement, FlippableIdCardProps>(
  (
    {
      className,
      name = "BHUSHAN POOJARY",
      role = "Verified Communicator • Signer & Speaker",
      memberId = "SKT-7381-AI",
      credits = 100,
      isFlipped: controlledFlipped,
      ...props
    },
    ref
  ) => {
    const [internalFlipped, setInternalFlipped] = React.useState(false);
    const isFlipped = controlledFlipped !== undefined ? controlledFlipped : internalFlipped;

    return (
      <div className="flex flex-col items-center select-none" ref={ref} {...props}>
        {/* Lanyard Top Strap & Gold Clip */}
        <div className="flex flex-col items-center pointer-events-none -mb-2.5 z-20">
          {/* Woven Strap with Geometric Accent */}
          <div className="w-8 h-10 bg-gradient-to-b from-orange-600 via-orange-500 to-amber-500 rounded-t-sm shadow-md flex items-center justify-center overflow-hidden border-x border-orange-700/50">
            <div className="w-1.5 h-full bg-white/30" />
          </div>

          {/* Metal Gold Swivel Clip */}
          <div className="relative -mt-0.5 flex flex-col items-center">
            <div className="w-4 h-2 rounded-sm bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-600 shadow-sm border border-yellow-200/80" />
            <div className="w-2 h-3 rounded-b-md bg-gradient-to-b from-amber-400 to-amber-600 border border-amber-300" />
            {/* Split Ring */}
            <div className="w-3.5 h-3.5 rounded-full border-2 border-amber-300 -mt-1 shadow-xs" />
          </div>
        </div>

        {/* 3D Flippable Card Container */}
        <div
          onClick={() => setInternalFlipped((prev) => !prev)}
          className={cn(
            "relative w-[265px] h-[375px] sm:w-[280px] sm:h-[395px] [perspective:1400px] cursor-pointer",
            className
          )}
        >
          {/* The inner card with 3D rotation */}
          <div
            className="relative h-full w-full rounded-2xl shadow-2xl transition-transform duration-700"
            style={{
              transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
              transformStyle: "preserve-3d",
              WebkitTransformStyle: "preserve-3d",
            }}
          >
            {/* ──────────────────────────────────────────────────────────── */}
            {/* --- FRONT OF ID PASS (Default Visible First) ---              */}
            {/* ──────────────────────────────────────────────────────────── */}
            <div
              className="absolute inset-0 h-full w-full rounded-2xl bg-white text-slate-900 border border-slate-200 shadow-[0_20px_45px_rgba(0,0,0,0.22)] flex flex-col justify-between p-4"
              style={{
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                transform: "rotateY(0deg)",
                zIndex: isFlipped ? 1 : 10,
              }}
            >
              {/* Geometric Grid Texture Background */}
              <div
                className="absolute inset-0 rounded-2xl opacity-[0.035] pointer-events-none"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)",
                  backgroundSize: "20px 20px",
                }}
              />

              {/* Punch Hole Slot at Top */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-2 rounded-full bg-slate-900/10 border border-slate-300/80 shadow-inner" />

              {/* Card Header Banner */}
              <div className="pt-2 pb-1.5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 p-0.5 flex items-center justify-center shadow-xs">
                    <svg viewBox="0 0 100 100" className="w-full h-full" fill="none">
                      <path d="M 35 34 C 35 22, 45 18, 58 18 C 72 18, 78 27, 74 38 C 70 48, 56 50, 47 53 C 38 56, 30 62, 29 71 C 28 77, 31 79, 34 78" stroke="#FFFFFF" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M 65 66 C 65 78, 55 82, 42 82 C 28 82, 22 73, 26 62 C 30 52, 44 50, 53 47 C 62 44, 70 38, 71 29 C 72 23, 69 21, 66 22" stroke="#FFF7ED" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
                      <circle cx="50" cy="50" r="8" fill="#38BDF8" />
                    </svg>
                  </div>
                  <div>
                    <span className="font-heading font-black text-xs text-slate-900 tracking-tight block leading-none">
                      SANKET<span className="text-orange-600">.AI</span>
                    </span>
                    <span className="font-mono text-[7px] uppercase tracking-widest text-slate-400 font-bold">
                      Digital Member Pass
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[8px] font-mono font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>ACTIVE</span>
                </div>
              </div>

              {/* Member Visual Avatar Box */}
              <div className="flex flex-col items-center py-1 text-center">
                <div className="relative w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 p-0.5 shadow-md shadow-orange-500/20 mb-1.5">
                  <div className="w-full h-full rounded-[14px] bg-slate-900 flex items-center justify-center text-white">
                    <span className="font-heading font-black text-2xl text-orange-400">
                      {name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm border-2 border-white">
                    <ShieldCheck className="w-3 h-3" />
                  </div>
                </div>

                <h3 className="font-heading font-black text-sm text-slate-900 tracking-tight leading-snug">
                  {name}
                </h3>
                <p className="font-body text-[9px] text-slate-500 font-medium max-w-[200px] truncate mt-0.5">
                  {role}
                </p>
              </div>

              {/* Data Grid: ID Code & Credits Balance */}
              <div className="grid grid-cols-2 gap-2 py-1.5 px-3 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <span className="block font-mono text-[7px] font-bold text-slate-400 uppercase tracking-wider">
                    Member ID
                  </span>
                  <span className="font-mono text-[11px] font-black text-slate-800 tracking-wider">
                    {memberId}
                  </span>
                </div>
                <div className="text-right">
                  <span className="block font-mono text-[7px] font-bold text-slate-400 uppercase tracking-wider">
                    Live Balance
                  </span>
                  <span className="font-mono text-[11px] font-black text-orange-600">
                    {credits} Credits
                  </span>
                </div>
              </div>

              {/* Card Footer: Verified QR Code & Hologram */}
              <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 p-0.5 flex items-center justify-center shadow-xs">
                    <QrCode className="w-6 h-6 text-slate-800" />
                  </div>
                  <div>
                    <span className="block font-mono text-[7px] text-slate-400 font-bold uppercase tracking-wider">
                      Security Token
                    </span>
                    <span className="font-mono text-[8px] text-slate-600 font-bold">
                      SHA256-ECDSA
                    </span>
                  </div>
                </div>

                {/* Holographic Security Pill */}
                <div className="px-2 py-0.5 rounded-md bg-gradient-to-r from-amber-100 via-orange-100 to-amber-100 border border-orange-200/80 flex items-center gap-1 shadow-xs">
                  <Cpu className="w-2.5 h-2.5 text-orange-600" />
                  <span className="font-mono text-[7px] font-bold text-orange-800">
                    ISL CHIP PRIMED
                  </span>
                </div>
              </div>
            </div>

            {/* ──────────────────────────────────────────────────────────── */}
            {/* --- BACK OF ID PASS (Shown Only When Flipped) ---             */}
            {/* ──────────────────────────────────────────────────────────── */}
            <div
              className="absolute inset-0 h-full w-full rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white border border-slate-700 shadow-2xl flex flex-col justify-between p-4"
              style={{
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
                zIndex: isFlipped ? 10 : 1,
              }}
            >
              {/* Punch Hole Slot at Top */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-2 rounded-full bg-black/40 border border-white/20 shadow-inner" />

              {/* Magnetic Strip */}
              <div className="pt-4">
                <div className="h-7 w-full bg-black/80 rounded-md border-y border-white/10" />
              </div>

              {/* Biometric & Compliance Zone */}
              <div className="space-y-1.5 py-1">
                <div className="flex items-center justify-between text-[8px] font-mono text-slate-400">
                  <span className="font-bold">TELECOM VOICE RELAY</span>
                  <span className="text-orange-400 font-bold">CERTIFIED</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-700/80 text-[9px] font-body text-slate-300 space-y-1">
                  <p className="leading-relaxed">
                    This credential authorizes real-time access to Sanket AI on-device neural sign interpretation, bidirectional speech synthesis, and teleconferencing rooms.
                  </p>
                  <p className="font-mono text-[8px] text-slate-400">
                    Issuance: Nov 2026 • sanket-ai.onrender.com
                  </p>
                </div>
              </div>

              {/* Barcode & Security Strip */}
              <div className="pt-1.5 border-t border-slate-700/60 space-y-1.5">
                {/* Barcode */}
                <div className="h-7 w-full bg-white rounded p-0.5 flex items-center justify-between overflow-hidden">
                  {Array.from({ length: 36 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-full bg-slate-950"
                      style={{
                        width: (i % 3 === 0 ? 3 : i % 2 === 0 ? 2 : 1) + "px",
                        marginRight: (i % 4 === 0 ? 2 : 1) + "px",
                      }}
                    />
                  ))}
                </div>

                <div className="flex items-center justify-between text-[7px] font-mono text-slate-400">
                  <span>VALID LIFETIME</span>
                  <span>PROPERTY OF SANKET AI</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Flip Instruction Hint Button */}
        <button
          type="button"
          onClick={() => setInternalFlipped((prev) => !prev)}
          className="mt-2.5 flex items-center gap-1.5 text-xs font-mono text-orange-200/90 bg-slate-900/80 hover:bg-slate-800 border border-orange-500/30 px-3.5 py-1 rounded-full backdrop-blur-sm shadow-md transition cursor-pointer"
        >
          <RotateCcw className="w-3 h-3 text-amber-400 animate-spin" />
          <span>Click to {isFlipped ? "view front" : "inspect back"}</span>
        </button>
      </div>
    );
  }
);

FlippableIdCard.displayName = "FlippableIdCard";
