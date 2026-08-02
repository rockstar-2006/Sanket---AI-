import React from 'react';

export const TelemedicineDoctorIllustration: React.FC<{ className?: string }> = ({ className = "w-full h-auto" }) => {
  return (
    <svg viewBox="0 0 600 500" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="bgGrad" x1="0" y1="0" x2="600" y2="500" gradientUnits="userSpaceOnUse">
          <stop stopColor="#EFF6FF" />
          <stop offset="1" stopColor="#E0F2FE" />
        </linearGradient>
        <linearGradient id="primaryGrad" x1="0" y1="0" x2="200" y2="200" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563EB" />
          <stop offset="1" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient id="cyanGrad" x1="0" y1="0" x2="150" y2="150" gradientUnits="userSpaceOnUse">
          <stop stopColor="#06B6D4" />
          <stop offset="1" stopColor="#0891B2" />
        </linearGradient>
        <linearGradient id="emeraldGrad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10B981" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
        <filter id="softShadow" x="40" y="40" width="520" height="420" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="12" stdDeviation="16" floodColor="#1E3A8A" floodOpacity="0.08" />
        </filter>
      </defs>

      {/* Outer Glow Circle */}
      <circle cx="300" cy="250" r="210" fill="url(#bgGrad)" />
      
      {/* Background Tech Nodes */}
      <circle cx="120" cy="120" r="6" fill="#06B6D4" opacity="0.6" />
      <line x1="120" y1="120" x2="200" y2="150" stroke="#06B6D4" strokeDasharray="4 4" strokeWidth="2" opacity="0.4" />
      <circle cx="480" cy="110" r="8" fill="#10B981" opacity="0.6" />
      <line x1="480" y1="110" x2="420" y2="160" stroke="#10B981" strokeDasharray="4 4" strokeWidth="2" opacity="0.4" />

      {/* Main Laptop / Frame with Shadow */}
      <g filter="url(#softShadow)">
        {/* Screen Bezel */}
        <rect x="100" y="90" width="400" height="280" rx="20" fill="#0F172A" />
        {/* Display Inner */}
        <rect x="112" y="102" width="376" height="256" rx="12" fill="#FFFFFF" />
      </g>

      {/* Camera Dot */}
      <circle cx="300" cy="96" r="3" fill="#10B981" />

      {/* Doctor Video Call Content */}
      <rect x="120" y="110" width="360" height="240" rx="8" fill="#F8FAFC" />
      
      {/* Doctor Figure Backdrop */}
      <circle cx="300" cy="200" r="65" fill="#DBEAFE" />

      {/* Doctor Hair & Face */}
      <circle cx="300" cy="180" r="28" fill="#FCE7F3" />
      <path d="M272 176C272 160 284 150 300 150C316 150 328 160 328 176C328 180 324 182 320 182C316 182 312 178 300 178C288 178 284 182 280 182C276 182 272 180 272 176Z" fill="#1E293B" />

      {/* Medical Doctor Coat */}
      <path d="M245 270C245 220 270 210 300 210C330 210 355 220 355 270V280H245V270Z" fill="url(#primaryGrad)" />
      {/* Shirt V-Neck */}
      <path d="M285 210L300 240L315 210Z" fill="#FFFFFF" />
      {/* Stethoscope */}
      <path d="M275 220C275 245 325 245 325 220" stroke="#06B6D4" strokeWidth="4" strokeLinecap="round" fill="none" />
      <circle cx="300" cy="245" r="7" fill="#06B6D4" />

      {/* Live Status Pill */}
      <rect x="132" y="122" width="100" height="26" rx="13" fill="#0F172A" opacity="0.85" />
      <circle cx="146" cy="135" r="5" fill="#10B981" />
      <text x="158" y="139" fill="#FFFFFF" fontSize="11" fontFamily="Inter, sans-serif" fontWeight="600">DR. ARTHUR</text>

      {/* Vitals Overlay Badge */}
      <rect x="360" y="270" width="110" height="60" rx="12" fill="#FFFFFF" filter="url(#softShadow)" />
      <path d="M372 300 H385 L390 288 L396 312 L402 294 L407 300 H420" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <text x="372" y="322" fill="#64748B" fontSize="10" fontFamily="Inter, sans-serif" fontWeight="500">BPM: 74 • Normal</text>

      {/* Laptop Base */}
      <path d="M60 370C60 370 80 395 120 395H480C520 395 540 370 540 370H60Z" fill="#CBD5E1" />
      <rect x="250" y="373" width="100" height="6" rx="3" fill="#94A3B8" />

      {/* Floating Audio Waves */}
      <rect x="420" y="130" width="4" height="16" rx="2" fill="#06B6D4" />
      <rect x="428" y="122" width="4" height="28" rx="2" fill="#2563EB" />
      <rect x="436" y="126" width="4" height="20" rx="2" fill="#10B981" />
      <rect x="444" y="134" width="4" height="10" rx="2" fill="#06B6D4" />
    </svg>
  );
};
