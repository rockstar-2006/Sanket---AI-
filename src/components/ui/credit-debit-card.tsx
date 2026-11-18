import * as React from "react";
import { cn } from "@/lib/utils";

// --- PROPS INTERFACE ---
export interface FlippableCreditCardProps extends React.HTMLAttributes<HTMLDivElement> {
  cardholderName?: string;
  cardNumber?: string;
  expiryDate?: string;
  cvv?: string;
  credits?: number;
  isFlipped?: boolean;
}

const FlippableCreditCard = React.forwardRef<HTMLDivElement, FlippableCreditCardProps>(
  (
    {
      className,
      cardholderName = "BHUSHAN POOJARY",
      cardNumber = "•••• •••• •••• 7381",
      expiryDate = "LIFETIME PASS",
      cvv = "738",
      credits = 0,
      isFlipped: controlledFlipped,
      ...props
    },
    ref
  ) => {
    const [internalFlipped, setInternalFlipped] = React.useState(false);
    const isFlipped = controlledFlipped !== undefined ? controlledFlipped : internalFlipped;

    // Accurate Tier & Usage Calculation: Starter tier is 100 credits, Pro is 500, Enterprise is 1500
    const baseTierCredits = credits <= 100 ? 100 : credits <= 500 ? 500 : 1500;
    const usedCredits = Math.max(0, baseTierCredits - credits);
    const capacityPercent = Math.min(100, Math.round((credits / baseTierCredits) * 100));

    return (
      <div
        className={cn(
          "group relative w-[285px] h-[178px] xs:w-[320px] xs:h-[200px] sm:w-[380px] sm:h-[238px] max-w-[94vw] shrink-0 [perspective:1400px] cursor-pointer select-none",
          className
        )}
        ref={ref}
        onClick={() => setInternalFlipped((prev) => !prev)}
        {...props}
      >
        {/* The inner container handles the transform animation purely on click state */}
        <div
          className={cn(
            "relative h-full w-full rounded-3xl shadow-2xl transition-transform duration-700 [transform-style:preserve-3d]",
            isFlipped ? "[transform:rotateY(180deg)]" : "[transform:rotateY(0deg)]"
          )}
        >
          {/* ──────────────────────────────────────────────────────────── */}
          {/* --- CARD FRONT (Sanket AI Luxury Obsidian & Gold Theme) ---  */}
          {/* ──────────────────────────────────────────────────────────── */}
          <div className="absolute inset-0 h-full w-full rounded-3xl bg-gradient-to-br from-[#0b0f19] via-[#151c2d] to-[#070b12] p-5 sm:p-6 text-white border-2 border-orange-500/60 shadow-[0_0_40px_rgba(249,115,22,0.35)] overflow-hidden [backface-visibility:hidden] flex flex-col justify-between">
            
            {/* Ambient Brand Glowing Flares */}
            <div className="absolute -top-20 -right-20 w-52 h-52 rounded-full bg-gradient-to-br from-orange-500/30 via-amber-500/20 to-transparent blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-48 h-48 rounded-full bg-cyan-500/15 blur-2xl pointer-events-none" />

            {/* Subtle Grid Pattern Overlay */}
            <div
              className="absolute inset-0 opacity-15 pointer-events-none"
              style={{
                backgroundImage:
                  "radial-gradient(rgba(249, 115, 22, 0.4) 1px, transparent 1px)",
                backgroundSize: "16px 16px",
              }}
            />

            {/* Metallic Glass Shimmer Angle */}
            <div 
              className="absolute inset-0 opacity-20 pointer-events-none"
              style={{
                background: "linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.18) 45%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0.18) 55%, transparent 65%)",
              }}
            />

            {/* Card Header: Official Brand Logo Monogram + Chip + Contactless */}
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {/* Official Sanket AI Monogram (Exact Navbar SVG) */}
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 p-1 flex items-center justify-center shadow-lg shadow-orange-500/40 border border-amber-300/40">
                  <svg viewBox="0 0 100 100" className="w-full h-full" fill="none">
                    <path d="M 35 34 C 35 22, 45 18, 58 18 C 72 18, 78 27, 74 38 C 70 48, 56 50, 47 53 C 38 56, 30 62, 29 71 C 28 77, 31 79, 34 78" stroke="#FFFFFF" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M 65 66 C 65 78, 55 82, 42 82 C 28 82, 22 73, 26 62 C 30 52, 44 50, 53 47 C 62 44, 70 38, 71 29 C 72 23, 69 21, 66 22" stroke="#FFF7ED" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
                    <circle cx="50" cy="50" r="8" fill="#38BDF8" />
                    <path d="M 50 45 L 52 49 L 55 50 L 52 51 L 50 55 L 48 51 L 45 50 L 48 49 Z" fill="#FFFFFF" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-heading font-black text-sm sm:text-base tracking-wider text-white">
                      SANKET<span className="text-orange-400">.AI</span>
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-black bg-orange-500/25 text-orange-300 border border-orange-500/50">
                      PLATINUM
                    </span>
                  </div>
                  <span className="block text-[8px] sm:text-[9px] font-mono tracking-widest text-amber-200/90 uppercase font-bold">
                    Official Member Pass
                  </span>
                </div>
              </div>

              {/* EMV Gold Smart Chip & Contactless Wave */}
              <div className="flex items-center gap-2">
                {/* Contactless waves SVG */}
                <svg className="w-5 h-5 text-amber-300/80 rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M8.5 16.5a5 5 0 0 1 7 0" />
                  <path d="M5.5 13.5a9 9 0 0 1 13 0" />
                  <path d="M2.5 10.5a13 13 0 0 1 19 0" />
                </svg>

                {/* EMV Chip */}
                <div className="relative w-11 h-8 sm:w-12 sm:h-9 rounded-lg bg-gradient-to-br from-yellow-200 via-amber-400 to-yellow-600 p-0.5 shadow-md border border-yellow-100/80 overflow-hidden">
                  <div className="w-full h-full rounded-[6px] border border-amber-900/50 grid grid-cols-3 grid-rows-2">
                    <div className="border-r border-b border-amber-900/40" />
                    <div className="border-r border-b border-amber-900/40" />
                    <div className="border-b border-amber-900/40" />
                    <div className="border-r border-amber-900/40" />
                    <div className="border-r border-amber-900/40" />
                    <div />
                  </div>
                </div>
              </div>
            </div>

            {/* Dynamic Credits Balance Display with In-Card Progress Bar */}
            <div className={cn(
              "relative z-10 my-auto py-2 px-3.5 sm:px-4 rounded-2xl border backdrop-blur-md flex flex-col gap-1.5 transition-all duration-500",
              credits > 0 
                ? "bg-gradient-to-r from-orange-950/85 via-slate-900/95 to-amber-950/85 border-amber-400/60 shadow-lg shadow-orange-500/25"
                : "bg-slate-900/85 border-slate-700/60"
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 border border-amber-500/60 shadow-xs flex items-center justify-center font-mono font-black text-xs text-amber-950">
                    <span className="text-[10px] font-black">₹</span>
                  </div>
                  <div>
                    <span className="text-[9px] sm:text-[10px] font-mono font-bold tracking-wider text-slate-300 uppercase block leading-tight">
                      Platform Balance
                    </span>
                    <span className="text-[8px] font-mono text-emerald-400 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Active Allocation
                    </span>
                  </div>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className={cn(
                    "text-xl sm:text-2xl font-mono font-black tracking-tight transition-all duration-300",
                    credits > 0 ? "text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.7)]" : "text-slate-400"
                  )}>
                    {credits}
                  </span>
                  <span className="text-[9px] font-mono font-bold text-orange-300 uppercase">
                    Credits Left
                  </span>
                </div>
              </div>

              {/* In-Card Progress Bar of Remaining Credit */}
              <div className="space-y-0.5">
                <div className="w-full bg-black/50 h-1.5 rounded-full overflow-hidden p-px border border-white/10">
                  <div 
                    className="bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-400 h-full rounded-full transition-all duration-700 shadow-sm"
                    style={{ width: `${capacityPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[7px] sm:text-[8px] font-mono text-slate-400 px-0.5">
                  <span>Usage: {usedCredits} used</span>
                  <span className="text-amber-300 font-bold">{capacityPercent}% Available</span>
                </div>
              </div>
            </div>

            {/* Card Number */}
            <div className="relative z-10 font-mono text-sm sm:text-base tracking-[0.24em] text-slate-100 text-center font-bold drop-shadow-sm">
              {cardNumber}
            </div>

            {/* Card Footer: Name & Expiry */}
            <div className="relative z-10 flex items-end justify-between pt-2 border-t border-white/10 text-xs">
              <div>
                <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                  Card Holder
                </p>
                <p className="font-mono text-xs font-bold text-white tracking-wide truncate max-w-[200px]">
                  {cardholderName}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                  Access Level
                </p>
                <p className="font-mono text-xs font-bold text-orange-400">
                  {expiryDate}
                </p>
              </div>
            </div>
          </div>

          {/* ──────────────────────────────────────────────────────────── */}
          {/* --- CARD BACK --- */}
          {/* ──────────────────────────────────────────────────────────── */}
          <div className="absolute inset-0 h-full w-full rounded-3xl bg-gradient-to-br from-[#080c14] via-[#151c2d] to-[#0b0f19] text-white border-2 border-slate-700 shadow-2xl overflow-hidden [backface-visibility:hidden] [transform:rotateY(180deg)] flex flex-col justify-between py-5">
            {/* Magnetic Strip */}
            <div className="h-10 w-full bg-gradient-to-r from-neutral-950 via-slate-900 to-black border-y border-white/5" />

            {/* Signature & CVV Strip */}
            <div className="px-6 space-y-1">
              <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 font-bold">
                <span>AUTHORIZED SIGNATURE</span>
                <span>SECURITY CVV</span>
              </div>
              <div className="flex h-9 w-full items-center justify-between rounded-lg bg-slate-200 px-3 text-slate-900">
                <span className="font-cursive italic text-xs tracking-wider text-slate-700">
                  {cardholderName}
                </span>
                <div className="rounded bg-white px-2.5 py-0.5 border border-slate-300 shadow-xs">
                  <p className="font-mono text-xs font-black tracking-widest text-slate-900">
                    {cvv}
                  </p>
                </div>
              </div>
            </div>

            {/* Card Back Footer Info */}
            <div className="px-6 flex items-center justify-between text-[9px] font-mono text-slate-400">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold text-[8px]">
                  S
                </div>
                <span>sanket-ai.onrender.com</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-5 h-5 rounded-full bg-orange-500/80 -mr-2" />
                <div className="w-5 h-5 rounded-full bg-amber-400/80" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

FlippableCreditCard.displayName = "FlippableCreditCard";

export { FlippableCreditCard };
