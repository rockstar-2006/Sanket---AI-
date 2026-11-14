/**
 * Virtual Camera Stream Generator for Multi-Browser / Multi-Tab WebRTC Testing
 *
 * When two browser tabs run on the same Windows machine, only one can access the
 * physical webcam due to exclusive hardware locking (NotReadableError: Device in use).
 * This module creates a real 720p 30fps HTML5 Canvas MediaStreamTrack that WebRTC
 * peer connections transmit seamlessly as live video.
 */

export interface VirtualStreamController {
  stream: MediaStream;
  videoTrack: MediaStreamTrack;
  stop: () => void;
}

function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.rect(x, y, w, h);
  }
}

export function createVirtualCameraStream(
  displayName: string,
  role: string = 'speaking_interviewer'
): VirtualStreamController {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');

  let animFrameId: number | null = null;
  let running = true;
  let angle = 0;

  const isSigner = role === 'deaf_signer';
  const roleLabel = isSigner ? 'Deaf Signer' : 'Hearing Speaker';
  const initial = (displayName || 'U').trim().charAt(0).toUpperCase() || 'U';

  // Ambient floating particles
  const particles = Array.from({ length: 24 }, () => ({
    x: Math.random() * 1280,
    y: Math.random() * 720,
    r: Math.random() * 3 + 1.5,
    vx: (Math.random() - 0.5) * 0.8,
    vy: (Math.random() - 0.5) * 0.8,
    opacity: Math.random() * 0.5 + 0.2,
  }));

  const drawFrame = () => {
    if (!running || !ctx) return;
    angle += 0.035;

    // 1. Deep modern gradient background
    const bgGrad = ctx.createLinearGradient(0, 0, 1280, 720);
    if (isSigner) {
      bgGrad.addColorStop(0, '#0c0a09');
      bgGrad.addColorStop(0.5, '#1c1917');
      bgGrad.addColorStop(1, '#292524');
    } else {
      bgGrad.addColorStop(0, '#030712');
      bgGrad.addColorStop(0.5, '#0f172a');
      bgGrad.addColorStop(1, '#1e1b4b');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1280, 720);

    // 2. Animated floating ambient particles
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = 1280;
      if (p.x > 1280) p.x = 0;
      if (p.y < 0) p.y = 720;
      if (p.y > 720) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = isSigner
        ? `rgba(249, 115, 22, ${p.opacity})`
        : `rgba(56, 189, 248, ${p.opacity})`;
      ctx.fill();
    });

    const cx = 640;
    const cy = 340;

    // 3. Pulsing Aura Glow Rings
    const pulse1 = Math.sin(angle) * 12 + 115;
    const pulse2 = Math.cos(angle * 0.8) * 18 + 140;

    ctx.beginPath();
    ctx.arc(cx, cy, pulse2, 0, Math.PI * 2);
    ctx.strokeStyle = isSigner ? 'rgba(249, 115, 22, 0.15)' : 'rgba(59, 130, 246, 0.15)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, pulse1, 0, Math.PI * 2);
    ctx.strokeStyle = isSigner ? 'rgba(251, 146, 60, 0.35)' : 'rgba(96, 165, 250, 0.35)';
    ctx.lineWidth = 4;
    ctx.stroke();

    // 4. Center Avatar Circle
    const avatarGrad = ctx.createLinearGradient(cx - 90, cy - 90, cx + 90, cy + 90);
    if (isSigner) {
      avatarGrad.addColorStop(0, '#f97316');
      avatarGrad.addColorStop(1, '#c2410c');
    } else {
      avatarGrad.addColorStop(0, '#38bdf8');
      avatarGrad.addColorStop(1, '#2563eb');
    }
    ctx.beginPath();
    ctx.arc(cx, cy, 90, 0, Math.PI * 2);
    ctx.fillStyle = avatarGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 4;
    ctx.stroke();

    // 5. Initial Letter
    ctx.font = 'bold 88px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 12;
    ctx.fillText(initial, cx, cy);
    ctx.shadowBlur = 0;

    // 6. Name and Role Titles
    ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(displayName, cx, cy + 145);

    ctx.font = '500 22px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = isSigner ? '#fdba74' : '#93c5fd';
    ctx.fillText(`${roleLabel} • Live Video Feed`, cx, cy + 185);

    // 7. Animated Audio/Activity Equalizer Bars
    const barCount = 9;
    const barWidth = 8;
    const barSpacing = 8;
    const totalW = barCount * (barWidth + barSpacing) - barSpacing;
    const startX = cx - totalW / 2;
    const barBaseY = cy + 225;

    for (let i = 0; i < barCount; i++) {
      const h = Math.abs(Math.sin(angle * 2 + i * 0.7)) * 26 + 6;
      ctx.fillStyle = isSigner ? '#fb923c' : '#38bdf8';
      ctx.beginPath();
      drawRoundRect(ctx, startX + i * (barWidth + barSpacing), barBaseY - h / 2, barWidth, h, 4);
      ctx.fill();
    }

    // 8. Top Watermark Pill Badge
    ctx.font = '600 18px monospace';
    const tagText = 'VIRTUAL CAMERA STREAM • MULTI-BROWSER ACTIVE';
    const tagWidth = ctx.measureText(tagText).width + 36;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    drawRoundRect(ctx, cx - tagWidth / 2, 38, tagWidth, 36, 18);
    ctx.fill();
    ctx.strokeStyle = isSigner ? 'rgba(249, 115, 22, 0.5)' : 'rgba(56, 189, 248, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = isSigner ? '#fdba74' : '#7dd3fc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tagText, cx, 56);

    animFrameId = requestAnimationFrame(drawFrame);
  };

  animFrameId = requestAnimationFrame(drawFrame);

  // Capture stream at 30 fps
  const stream = (canvas as any).captureStream(30) as MediaStream;
  const videoTrack = stream.getVideoTracks()[0];

  const stop = () => {
    running = false;
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    videoTrack.stop();
  };

  return { stream, videoTrack, stop };
}
