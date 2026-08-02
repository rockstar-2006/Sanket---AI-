import React from 'react';

export const MedicalDashboardIllustration: React.FC<{ className?: string }> = ({ className = "w-full h-auto" }) => {
  return (
    <svg viewBox="0 0 600 500" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="dashBg" x1="0" y1="0" x2="600" y2="500" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F8FAFC" />
          <stop offset="1" stopColor="#EEF2FF" />
        </linearGradient>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563EB" stopOpacity="0.4" />
          <stop offset="1" stopColor="#2563EB" stopOpacity="0.0" />
        </linearGradient>
        <filter id="dashShadow" x="30" y="30" width="540" height="440" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="10" stdDeviation="14" floodColor="#2563EB" floodOpacity="0.06" />
        </filter>
      </defs>

      <circle cx="300" cy="250" r="220" fill="url(#dashBg)" />

      {/* Main Dashboard Card */}
      <g filter="url(#dashShadow)">
        <rect x="70" y="70" width="460" height="360" rx="24" fill="#FFFFFF" border-stroke="#E2E8F0" />
      </g>

      {/* Sidebar navigation line */}
      <line x1="160" y1="70" x2="160" y2="430" stroke="#F1F5F9" strokeWidth="2" />
      
      {/* Navigation Icons */}
      <circle cx="115" cy="110" r="16" fill="#DBEAFE" />
      <path d="M110 110H120M115 105V115" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" />

      <circle cx="115" cy="160" r="12" fill="#F8FAFC" />
      <circle cx="115" cy="200" r="12" fill="#F8FAFC" />
      <circle cx="115" cy="240" r="12" fill="#F8FAFC" />

      {/* Header Bar inside Dashboard */}
      <text x="190" y="115" fill="#0F172A" fontSize="16" fontFamily="Inter, sans-serif" fontWeight="700">Telehealth Portal Overview</text>
      
      {/* Stat Card 1 */}
      <rect x="190" y="140" width="150" height="70" rx="14" fill="#EFF6FF" />
      <text x="206" y="165" fill="#64748B" fontSize="11" fontFamily="Inter, sans-serif" fontWeight="600">Total Consultations</text>
      <text x="206" y="194" fill="#2563EB" fontSize="20" fontFamily="Inter, sans-serif" fontWeight="800">128 Sessions</text>

      {/* Stat Card 2 */}
      <rect x="355" y="140" width="150" height="70" rx="14" fill="#ECFEFF" />
      <text x="371" y="165" fill="#64748B" fontSize="11" fontFamily="Inter, sans-serif" fontWeight="600">Avg. Call Quality</text>
      <text x="371" y="194" fill="#0891B2" fontSize="20" fontFamily="Inter, sans-serif" fontWeight="800">99.8% HD</text>

      {/* Chart Section */}
      <rect x="190" y="225" width="315" height="185" rx="16" fill="#F8FAFC" stroke="#E2E8F0" />
      <text x="210" y="255" fill="#0F172A" fontSize="12" fontFamily="Inter, sans-serif" fontWeight="700">Patient Vitals & Traffic Analytics</text>

      {/* Area Chart Wave */}
      <path d="M210 360 C250 320, 280 370, 320 310 C360 250, 410 330, 485 280 V370 H210 Z" fill="url(#chartGrad)" />
      <path d="M210 360 C250 320, 280 370, 320 310 C360 250, 410 330, 485 280" stroke="#2563EB" strokeWidth="3" fill="none" strokeLinecap="round" />

      {/* Chart Nodes */}
      <circle cx="320" cy="310" r="5" fill="#06B6D4" stroke="#FFFFFF" strokeWidth="2" />
      <circle cx="485" cy="280" r="5" fill="#10B981" stroke="#FFFFFF" strokeWidth="2" />
    </svg>
  );
};
