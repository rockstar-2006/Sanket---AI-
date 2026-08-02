import React from 'react';

export const SecureHealthcareIllustration: React.FC<{ className?: string }> = ({ className = "w-full h-auto" }) => {
  return (
    <svg viewBox="0 0 600 500" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="secBg" x1="0" y1="0" x2="600" y2="500" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ECFDF5" />
          <stop offset="1" stopColor="#EFF6FF" />
        </linearGradient>
        <linearGradient id="shieldGrad" x1="0" y1="0" x2="300" y2="400" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10B981" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
        <linearGradient id="lockGrad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563EB" />
          <stop offset="1" stopColor="#06B6D4" />
        </linearGradient>
      </defs>

      <circle cx="300" cy="250" r="210" fill="url(#secBg)" />

      {/* Main Shield Path */}
      <path d="M300 80L440 130V260C440 350 380 410 300 440C220 410 160 350 160 260V130L300 80Z" fill="url(#shieldGrad)" />

      {/* Inner White Shield Outline */}
      <path d="M300 100L420 144V255C420 334 368 388 300 415C232 388 180 334 180 255V144L300 100Z" fill="#FFFFFF" opacity="0.15" />

      {/* Medical Cross Symbol */}
      <g transform="translate(300, 230)">
        <rect x="-18" y="-55" width="36" height="110" rx="10" fill="#FFFFFF" />
        <rect x="-55" y="-18" width="110" height="36" rx="10" fill="#FFFFFF" />
      </g>

      {/* Central Encryption Lock Badge */}
      <circle cx="300" cy="230" r="40" fill="url(#lockGrad)" />
      
      {/* Lock Shackle & Body */}
      <rect x="286" y="222" width="28" height="24" rx="4" fill="#FFFFFF" />
      <path d="M291 222V214C291 209 295 205 300 205C305 205 309 209 309 214V222" stroke="#FFFFFF" strokeWidth="3" fill="none" />
      <circle cx="300" cy="232" r="3" fill="#2563EB" />

      {/* Compliance Floating Pills */}
      <g>
        <rect x="90" y="180" width="130" height="44" rx="22" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2" />
        <circle cx="116" cy="202" r="8" fill="#10B981" />
        <text x="134" y="206" fill="#0F172A" fontSize="11" fontFamily="Inter, sans-serif" fontWeight="700">HIPAA READY</text>
      </g>

      <g>
        <rect x="380" y="320" width="130" height="44" rx="22" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2" />
        <circle cx="406" cy="342" r="8" fill="#06B6D4" />
        <text x="424" y="346" fill="#0F172A" fontSize="11" fontFamily="Inter, sans-serif" fontWeight="700">AES-256 P2P</text>
      </g>
    </svg>
  );
};
