import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Sanket AI - Accessible AI Video Meetings & Real-Time Sign Language Interpreter';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0B0F19',
          backgroundImage: 'radial-gradient(circle at 50% 30%, rgba(249, 115, 22, 0.18) 0%, rgba(11, 15, 25, 0.95) 70%)',
          fontFamily: 'sans-serif',
          position: 'relative',
          padding: '60px 80px',
        }}
      >
        {/* Background Grid Accent */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage:
              'linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            opacity: 0.6,
          }}
        />

        {/* Brand Header with Logo Mark */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '18px',
            marginBottom: '32px',
          }}
        >
          {/* Logo Mark Container */}
          <div
            style={{
              width: '76px',
              height: '76px',
              borderRadius: '24px',
              background: 'linear-gradient(135deg, #FF7A00 0%, #EA580C 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 12px 32px rgba(249, 115, 22, 0.4)',
              color: '#FFFFFF',
              fontSize: '44px',
              fontWeight: 900,
              letterSpacing: '-2px',
            }}
          >
            S
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                fontSize: '42px',
                fontWeight: 900,
                color: '#FFFFFF',
                letterSpacing: '-1.5px',
              }}
            >
              Sanket<span style={{ color: '#F97316' }}>.ai</span>
            </div>
            <div
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: '#94A3B8',
                letterSpacing: '2px',
                textTransform: 'uppercase',
              }}
            >
              Indian Sign Language • Live Video Platform
            </div>
          </div>
        </div>

        {/* Main Catchy Headline */}
        <div
          style={{
            fontSize: '56px',
            fontWeight: 900,
            color: '#FFFFFF',
            textAlign: 'center',
            lineHeight: 1.15,
            letterSpacing: '-2px',
            maxWidth: '960px',
            marginBottom: '24px',
          }}
        >
          Connecting <span style={{ color: '#FB923C' }}>Signers</span> &amp;{' '}
          <span style={{ color: '#38BDF8' }}>Speakers</span> with Real-Time AI
        </div>

        {/* Feature Pills */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            marginTop: '12px',
          }}
        >
          <div
            style={{
              padding: '10px 22px',
              borderRadius: '999px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#F1F5F9',
              fontSize: '18px',
              fontWeight: 700,
            }}
          >
            🤟 Real-time ISL Gesture Translation
          </div>
          <div
            style={{
              padding: '10px 22px',
              borderRadius: '999px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#F1F5F9',
              fontSize: '18px',
              fontWeight: 700,
            }}
          >
            ⚡ Instant Speech Subtitles
          </div>
          <div
            style={{
              padding: '10px 22px',
              borderRadius: '999px',
              background: 'rgba(249, 115, 22, 0.2)',
              border: '1px solid rgba(249, 115, 22, 0.4)',
              color: '#FED7AA',
              fontSize: '18px',
              fontWeight: 700,
            }}
          >
            🤖 3D Interpreter Avatar
          </div>
        </div>

        {/* Bottom Domain / Trust Indicator */}
        <div
          style={{
            position: 'absolute',
            bottom: '30px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '15px',
            color: '#64748B',
            fontWeight: 600,
          }}
        >
          <span>Free 1-Click Video Meetings</span>
          <span>•</span>
          <span>No Software Download Needed</span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
