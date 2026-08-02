import React from 'react';

export const BrowserConsultationIllustration: React.FC<{ className?: string }> = ({ className = "w-full h-auto" }) => {
  return (
    <svg viewBox="0 0 600 500" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="bcBg" x1="0" y1="0" x2="600" y2="500" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F8FAFC" />
          <stop offset="1" stopColor="#E2E8F0" />
        </linearGradient>
        <filter id="bcShadow" x="20" y="20" width="560" height="460" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="12" stdDeviation="16" floodColor="#0F172A" floodOpacity="0.08" />
        </filter>
      </defs>

      <circle cx="300" cy="250" r="220" fill="url(#bcBg)" />

      {/* Main Browser Window */}
      <g filter="url(#bcShadow)">
        <rect x="60" y="60" width="480" height="380" rx="20" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2" />
      </g>

      {/* Browser Bar */}
      <path d="M60 80C60 68.9543 68.9543 60 80 60H520C531.046 60 540 68.9543 540 80V104H60V80Z" fill="#0F172A" />
      <circle cx="85" cy="82" r="5" fill="#EF4444" />
      <circle cx="102" cy="82" r="5" fill="#F59E0B" />
      <circle cx="119" cy="82" r="5" fill="#10B981" />
      
      {/* URL Pill */}
      <rect x="150" y="70" width="300" height="24" rx="12" fill="#1E293B" />
      <text x="210" y="86" fill="#94A3B8" fontSize="11" fontFamily="Inter, sans-serif" fontWeight="500">https://telehealth.app/room/DR-MED-892</text>

      {/* 4 Video Grid Tiles */}
      {/* Tile 1: Doctor */}
      <rect x="80" y="120" width="210" height="130" rx="12" fill="#DBEAFE" />
      <circle cx="185" cy="170" r="25" fill="#2563EB" />
      <rect x="92" y="222" width="70" height="18" rx="9" fill="#0F172A" opacity="0.8" />
      <text x="100" y="234" fill="#FFFFFF" fontSize="9" fontFamily="Inter, sans-serif" fontWeight="600">Dr. Sarah (Host)</text>

      {/* Tile 2: Patient 1 */}
      <rect x="310" y="120" width="210" height="130" rx="12" fill="#CFFAFE" />
      <circle cx="415" cy="170" r="25" fill="#06B6D4" />
      <rect x="322" y="222" width="70" height="18" rx="9" fill="#0F172A" opacity="0.8" />
      <text x="330" y="234" fill="#FFFFFF" fontSize="9" fontFamily="Inter, sans-serif" fontWeight="600">Patient John</text>

      {/* Tile 3: Nurse / Specialist */}
      <rect x="80" y="265" width="210" height="130" rx="12" fill="#D1FAE5" />
      <circle cx="185" cy="315" r="25" fill="#10B981" />
      <rect x="92" y="367" width="85" height="18" rx="9" fill="#0F172A" opacity="0.8" />
      <text x="100" y="379" fill="#FFFFFF" fontSize="9" fontFamily="Inter, sans-serif" fontWeight="600">Nurse Emily</text>

      {/* Tile 4: Family Member */}
      <rect x="310" y="265" width="210" height="130" rx="12" fill="#FCE7F3" />
      <circle cx="415" cy="315" r="25" fill="#EC4899" />
      <rect x="322" y="367" width="85" height="18" rx="9" fill="#0F172A" opacity="0.8" />
      <text x="330" y="379" fill="#FFFFFF" fontSize="9" fontFamily="Inter, sans-serif" fontWeight="600">Consultant Tech</text>

      {/* Floating Control Bar at Bottom */}
      <rect x="180" y="390" width="240" height="40" rx="20" fill="#0F172A" />
      <circle cx="210" cy="410" r="12" fill="#2563EB" />
      <circle cx="250" cy="410" r="12" fill="#06B6D4" />
      <circle cx="290" cy="410" r="12" fill="#10B981" />
      <circle cx="330" cy="410" r="12" fill="#64748B" />
      <circle cx="390" cy="410" r="12" fill="#EF4444" />
    </svg>
  );
};
