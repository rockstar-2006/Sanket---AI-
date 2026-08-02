import React from 'react';

export const AccessibleCareIllustration: React.FC<{ className?: string }> = ({ className = "w-full h-auto" }) => {
  return (
    <svg viewBox="0 0 600 500" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="accBg" x1="0" y1="0" x2="600" y2="500" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F0FDFA" />
          <stop offset="1" stopColor="#E0F2FE" />
        </linearGradient>
        <linearGradient id="accBlue" x1="0" y1="0" x2="300" y2="300" gradientUnits="userSpaceOnUse">
          <stop stopColor="#06B6D4" />
          <stop offset="1" stopColor="#2563EB" />
        </linearGradient>
        <filter id="accShadow" x="30" y="30" width="540" height="440" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="10" stdDeviation="14" floodColor="#06B6D4" floodOpacity="0.1" />
        </filter>
      </defs>

      {/* Soft Background Circle */}
      <circle cx="300" cy="250" r="210" fill="url(#accBg)" />

      {/* Main Container Panel */}
      <g filter="url(#accShadow)">
        <rect x="80" y="70" width="440" height="340" rx="24" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="2" />
      </g>

      {/* Top Header Bar */}
      <path d="M80 94C80 80.7452 90.7452 70 104 70H496C509.255 70 520 80.7452 520 94V120H80V94Z" fill="#0F172A" />
      <circle cx="110" cy="95" r="6" fill="#EF4444" />
      <circle cx="130" cy="95" r="6" fill="#F59E0B" />
      <circle cx="150" cy="95" r="6" fill="#10B981" />
      <text x="210" y="99" fill="#94A3B8" fontSize="12" fontFamily="Inter, sans-serif" fontWeight="600">Accessible Care & Sign Language Mode</text>

      {/* Left Patient Frame (Sign Language Hands) */}
      <rect x="100" y="140" width="190" height="200" rx="16" fill="#F8FAFC" stroke="#06B6D4" strokeWidth="2" />
      <circle cx="195" cy="200" r="32" fill="#CFFAFE" />
      
      {/* Patient Avatar Head */}
      <circle cx="195" cy="190" r="18" fill="#F43F5E" opacity="0.8" />
      <path d="M175 235C175 215 185 210 195 210C205 210 215 215 215 235V245H175V235Z" fill="#0284C7" />

      {/* Sign Language Hands Vector Illustration */}
      <g transform="translate(145, 250)">
        <path d="M25 10C25 4.47715 29.4772 0 35 0C40.5228 0 45 4.47715 45 10V35H25V10Z" fill="#FDBA74" />
        <path d="M45 15C45 10 49 6 54 6C59 6 63 10 63 15V35H45V15Z" fill="#FDBA74" />
        <path d="M10 25C10 20 14 16 19 16C24 16 28 20 28 25V40H10V25Z" fill="#FDBA74" />
      </g>

      {/* Accessibility Badge */}
      <rect x="110" y="150" width="80" height="22" rx="11" fill="#10B981" />
      <text x="122" y="165" fill="#FFFFFF" fontSize="10" fontFamily="Inter, sans-serif" fontWeight="700">SIGN SYNC</text>

      {/* Right AI Real-time Subtitles / Translation Box */}
      <rect x="310" y="140" width="190" height="200" rx="16" fill="#EFF6FF" stroke="#93C5FD" strokeWidth="2" />
      
      {/* Subtitles Title */}
      <text x="330" y="170" fill="#1E40AF" fontSize="13" fontFamily="Inter, sans-serif" fontWeight="700">Live AI Subtitles</text>
      
      {/* Captions Lines */}
      <rect x="330" y="190" width="150" height="10" rx="5" fill="#2563EB" opacity="0.8" />
      <rect x="330" y="210" width="120" height="10" rx="5" fill="#2563EB" opacity="0.6" />
      <rect x="330" y="230" width="135" height="10" rx="5" fill="#2563EB" opacity="0.4" />

      {/* Translated Speech Bubble */}
      <rect x="325" y="260" width="160" height="60" rx="12" fill="#FFFFFF" filter="url(#accShadow)" />
      <text x="338" y="282" fill="#0F172A" fontSize="11" fontFamily="Inter, sans-serif" fontWeight="600">"I have slight chest pain</text>
      <text x="338" y="298" fill="#0F172A" fontSize="11" fontFamily="Inter, sans-serif" fontWeight="600">since yesterday morning."</text>

      {/* Floating Accessibility Shield Icon */}
      <circle cx="300" cy="240" r="28" fill="#10B981" />
      <path d="M292 240L298 246L310 234" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};
