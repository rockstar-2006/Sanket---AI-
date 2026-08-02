import React from 'react';

export const AIChatAssistantIllustration: React.FC<{ className?: string }> = ({ className = "w-full h-auto" }) => {
  return (
    <svg viewBox="0 0 600 500" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="aiBg" x1="0" y1="0" x2="600" y2="500" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F8FAFC" />
          <stop offset="1" stopColor="#EEF2FF" />
        </linearGradient>
        <linearGradient id="aiPulse" x1="0" y1="0" x2="200" y2="200" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563EB" />
          <stop offset="1" stopColor="#06B6D4" />
        </linearGradient>
      </defs>

      <circle cx="300" cy="250" r="220" fill="url(#aiBg)" />

      {/* Central AI Node glowing rings */}
      <circle cx="300" cy="220" r="100" fill="#DBEAFE" opacity="0.4" />
      <circle cx="300" cy="220" r="70" fill="#BFDBFE" opacity="0.6" />
      <circle cx="300" cy="220" r="45" fill="url(#aiPulse)" />

      {/* AI Sparkle Icon */}
      <path d="M300 195L305 212L322 217L305 222L300 239L295 222L278 217L295 212L300 195Z" fill="#FFFFFF" />

      {/* Orbiting Tech Nodes */}
      <g>
        <circle cx="160" cy="140" r="28" fill="#FFFFFF" stroke="#2563EB" strokeWidth="3" />
        <path d="M152 140H168M160 132V148" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="184" y1="154" x2="260" y2="195" stroke="#93C5FD" strokeDasharray="4 4" strokeWidth="2" />
      </g>

      <g>
        <circle cx="440" cy="140" r="28" fill="#FFFFFF" stroke="#06B6D4" strokeWidth="3" />
        <path d="M430 140L438 148L450 134" stroke="#06B6D4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="416" y1="154" x2="340" y2="195" stroke="#67E8F9" strokeDasharray="4 4" strokeWidth="2" />
      </g>

      <g>
        <circle cx="160" cy="310" r="28" fill="#FFFFFF" stroke="#10B981" strokeWidth="3" />
        <circle cx="160" cy="310" r="10" fill="#10B981" />
        <line x1="184" y1="296" x2="260" y2="245" stroke="#6EE7B7" strokeDasharray="4 4" strokeWidth="2" />
      </g>

      <g>
        <circle cx="440" cy="310" r="28" fill="#FFFFFF" stroke="#8B5CF6" strokeWidth="3" />
        <path d="M430 310C430 300 450 300 450 310" stroke="#8B5CF6" strokeWidth="2.5" fill="none" />
        <line x1="416" y1="296" x2="340" y2="245" stroke="#C4B5FD" strokeDasharray="4 4" strokeWidth="2" />
      </g>

      {/* Transcription Wave Bar at Bottom */}
      <rect x="120" y="380" width="360" height="64" rx="20" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2" />
      <text x="144" y="417" fill="#64748B" fontSize="12" fontFamily="Inter, sans-serif" fontWeight="600">AI Clinical Transcription Active...</text>
      
      {/* Audio Wave Visualizer */}
      <line x1="360" y1="412" x2="360" y2="412" stroke="#2563EB" strokeWidth="4" strokeLinecap="round" />
      <line x1="372" y1="402" x2="372" y2="422" stroke="#06B6D4" strokeWidth="4" strokeLinecap="round" />
      <line x1="384" y1="394" x2="384" y2="430" stroke="#2563EB" strokeWidth="4" strokeLinecap="round" />
      <line x1="396" y1="406" x2="396" y2="418" stroke="#10B981" strokeWidth="4" strokeLinecap="round" />
      <line x1="408" y1="398" x2="408" y2="426" stroke="#06B6D4" strokeWidth="4" strokeLinecap="round" />
      <line x1="420" y1="408" x2="420" y2="416" stroke="#2563EB" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
};
