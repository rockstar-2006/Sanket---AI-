/**
 * MemberBadgeCanvas.ts
 * Generates high-resolution front, back, and strap textures for the 3D Lanyard ID Card.
 * Matches the website's bright, modern theme: Crisp White Card (#FFFFFF), Vibrant Orange (#F97316),
 * Warm Amber (#F59E0B), and Deep Slate Typography (#0F172A).
 */

export interface MemberBadgeDetails {
  name: string;
  email: string;
  photoUrl?: string | null;
  role?: string;
  memberId?: string;
  credits?: number;
}

export async function generateMemberBadgeTextures(details: MemberBadgeDetails): Promise<{
  frontDataUrl: string;
  backDataUrl: string;
  strapDataUrl: string;
}> {
  if (typeof window === 'undefined') {
    return { frontDataUrl: '', backDataUrl: '', strapDataUrl: '' };
  }

  const {
    name = 'Verified Member',
    email = 'member@sanket.ai',
    photoUrl = null,
    role = 'Verified Communicator • Signer & Speaker',
    memberId = 'SKT-7381-AI',
    credits = 100,
  } = details;

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. FRONT FACE TEXTURE (1024 x 1440 - Crisp Clean White with Orange Accents)
  // ─────────────────────────────────────────────────────────────────────────────
  const frontCanvas = document.createElement('canvas');
  frontCanvas.width = 1024;
  frontCanvas.height = 1440;
  const fCtx = frontCanvas.getContext('2d')!;

  // Background - Pure White to Soft Pearl
  const bgGrad = fCtx.createLinearGradient(0, 0, 1024, 1440);
  bgGrad.addColorStop(0, '#FFFFFF');
  bgGrad.addColorStop(0.7, '#F8FAFC');
  bgGrad.addColorStop(1, '#F1F5F9');
  fCtx.fillStyle = bgGrad;
  fCtx.fillRect(0, 0, 1024, 1440);

  // Subtle Outer Card Border Line
  fCtx.strokeStyle = '#E2E8F0';
  fCtx.lineWidth = 4;
  roundRect(fCtx, 12, 12, 1000, 1416, 40);
  fCtx.stroke();

  // Subtle Geometric Grid Watermark
  fCtx.strokeStyle = 'rgba(249, 115, 22, 0.05)';
  fCtx.lineWidth = 1.5;
  for (let x = 0; x < 1024; x += 64) {
    fCtx.beginPath();
    fCtx.moveTo(x, 0);
    fCtx.lineTo(x, 1440);
    fCtx.stroke();
  }
  for (let y = 0; y < 1440; y += 64) {
    fCtx.beginPath();
    fCtx.moveTo(0, y);
    fCtx.lineTo(1024, y);
    fCtx.stroke();
  }

  // Top Accent Banner (Sanket Orange to Warm Amber)
  const topGrad = fCtx.createLinearGradient(0, 0, 1024, 0);
  topGrad.addColorStop(0, '#EA580C');
  topGrad.addColorStop(0.5, '#F97316');
  topGrad.addColorStop(1, '#F59E0B');
  fCtx.fillStyle = topGrad;
  fCtx.fillRect(0, 0, 1024, 130);

  // Brand Header in Top Banner
  fCtx.fillStyle = '#FFFFFF';
  fCtx.font = '900 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  fCtx.fillText('SANKET.AI', 90, 85);

  fCtx.font = '700 22px monospace';
  fCtx.fillStyle = '#FFF7ED';
  fCtx.fillText('OFFICIAL IDENTITY PASS', 90, 115);

  // S-Nexus Monogram Circle in header
  fCtx.beginPath();
  fCtx.arc(920, 65, 34, 0, Math.PI * 2);
  fCtx.fillStyle = '#FFFFFF';
  fCtx.fill();
  fCtx.lineWidth = 3;
  fCtx.strokeStyle = '#FED7AA';
  fCtx.stroke();

  fCtx.fillStyle = '#F97316';
  fCtx.font = '900 36px sans-serif';
  fCtx.textAlign = 'center';
  fCtx.fillText('S', 920, 78);
  fCtx.textAlign = 'left';

  // Photo Frame
  const avatarSize = 340;
  const avatarX = (1024 - avatarSize) / 2;
  const avatarY = 220;

  // Photo Frame Shadow & Glow
  fCtx.shadowColor = 'rgba(249, 115, 22, 0.2)';
  fCtx.shadowBlur = 25;
  fCtx.fillStyle = '#FFFFFF';
  roundRect(fCtx, avatarX - 8, avatarY - 8, avatarSize + 16, avatarSize + 16, 46);
  fCtx.fill();
  fCtx.shadowBlur = 0;

  // Border Stroke
  fCtx.lineWidth = 5;
  const borderGrad = fCtx.createLinearGradient(avatarX, avatarY, avatarX + avatarSize, avatarY + avatarSize);
  borderGrad.addColorStop(0, '#F97316');
  borderGrad.addColorStop(0.5, '#FBBF24');
  borderGrad.addColorStop(1, '#06B6D4');
  fCtx.strokeStyle = borderGrad;
  roundRect(fCtx, avatarX - 5, avatarY - 5, avatarSize + 10, avatarSize + 10, 42);
  fCtx.stroke();

  // Draw Avatar
  let avatarLoaded = false;
  if (photoUrl && typeof window !== 'undefined') {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = photoUrl;
      await new Promise<void>((resolve) => {
        img.onload = () => {
          fCtx.save();
          roundRect(fCtx, avatarX, avatarY, avatarSize, avatarSize, 38);
          fCtx.clip();
          fCtx.drawImage(img, avatarX, avatarY, avatarSize, avatarSize);
          fCtx.restore();
          avatarLoaded = true;
          resolve();
        };
        img.onerror = () => resolve();
        setTimeout(resolve, 600);
      });
    } catch {
      avatarLoaded = false;
    }
  }

  if (!avatarLoaded) {
    // Stylized Avatar Monogram with mascot colors
    fCtx.save();
    roundRect(fCtx, avatarX, avatarY, avatarSize, avatarSize, 38);
    fCtx.clip();
    const avGrad = fCtx.createLinearGradient(avatarX, avatarY, avatarX + avatarSize, avatarY + avatarSize);
    avGrad.addColorStop(0, '#F97316');
    avGrad.addColorStop(1, '#FB923C');
    fCtx.fillStyle = avGrad;
    fCtx.fillRect(avatarX, avatarY, avatarSize, avatarSize);

    fCtx.fillStyle = '#FFFFFF';
    fCtx.font = '900 160px sans-serif';
    fCtx.textAlign = 'center';
    fCtx.textBaseline = 'middle';
    const initial = (name.trim().charAt(0) || 'S').toUpperCase();
    fCtx.fillText(initial, avatarX + avatarSize / 2, avatarY + avatarSize / 2 + 10);
    fCtx.restore();
  }

  // User Name (Crisp Dark Typography)
  fCtx.textAlign = 'center';
  fCtx.fillStyle = '#0F172A';
  fCtx.font = '900 56px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  fCtx.fillText(name.length > 18 ? name.slice(0, 18) + '...' : name, 512, 630);

  // Email
  fCtx.fillStyle = '#64748B';
  fCtx.font = '600 28px monospace';
  fCtx.fillText(email.length > 28 ? email.slice(0, 28) + '...' : email, 512, 680);

  // Role Pill (Light Orange Badge)
  fCtx.fillStyle = '#FFF7ED';
  roundRect(fCtx, 160, 720, 704, 70, 35);
  fCtx.fill();
  fCtx.strokeStyle = '#FED7AA';
  fCtx.lineWidth = 3;
  roundRect(fCtx, 160, 720, 704, 70, 35);
  fCtx.stroke();

  fCtx.fillStyle = '#EA580C';
  fCtx.font = '800 26px -apple-system, BlinkMacSystemFont, sans-serif';
  fCtx.fillText(role.toUpperCase(), 512, 765);

  // Divider Line
  fCtx.strokeStyle = '#E2E8F0';
  fCtx.lineWidth = 2;
  fCtx.beginPath();
  fCtx.moveTo(120, 830);
  fCtx.lineTo(904, 830);
  fCtx.stroke();

  // Metrics Section (Member ID & Starter Credits)
  fCtx.textAlign = 'left';
  // Left: Member ID
  fCtx.fillStyle = '#64748B';
  fCtx.font = '700 22px monospace';
  fCtx.fillText('MEMBERSHIP NO.', 130, 885);
  fCtx.fillStyle = '#0F172A';
  fCtx.font = '900 36px monospace';
  fCtx.fillText(memberId, 130, 935);

  // Right: Wallet Balance
  fCtx.fillStyle = '#64748B';
  fCtx.font = '700 22px monospace';
  fCtx.fillText('WALLET CREDITS', 630, 885);
  fCtx.fillStyle = '#EA580C';
  fCtx.font = '900 36px monospace';
  fCtx.fillText(`${credits} PTS (ACTIVE)`, 630, 935);

  // Gold Security Microchip (Center Bottom)
  const chipX = 130;
  const chipY = 1000;
  const chipW = 180;
  const chipH = 130;
  const chipGrad = fCtx.createLinearGradient(chipX, chipY, chipX + chipW, chipY + chipH);
  chipGrad.addColorStop(0, '#F59E0B');
  chipGrad.addColorStop(0.3, '#FDE68A');
  chipGrad.addColorStop(0.7, '#D97706');
  chipGrad.addColorStop(1, '#B45309');
  fCtx.fillStyle = chipGrad;
  roundRect(fCtx, chipX, chipY, chipW, chipH, 20);
  fCtx.fill();
  fCtx.strokeStyle = '#78350F';
  fCtx.lineWidth = 3;
  roundRect(fCtx, chipX, chipY, chipW, chipH, 20);
  fCtx.stroke();

  // Microchip lines
  fCtx.strokeStyle = '#92400E';
  fCtx.lineWidth = 2.5;
  fCtx.beginPath();
  fCtx.moveTo(chipX + 45, chipY);
  fCtx.lineTo(chipX + 45, chipY + chipH);
  fCtx.moveTo(chipX + 135, chipY);
  fCtx.lineTo(chipX + 135, chipY + chipH);
  fCtx.moveTo(chipX, chipY + 65);
  fCtx.lineTo(chipX + chipW, chipY + 65);
  fCtx.stroke();

  // QR Code Box on Right
  fCtx.fillStyle = '#FFFFFF';
  fCtx.shadowColor = 'rgba(0,0,0,0.06)';
  fCtx.shadowBlur = 10;
  roundRect(fCtx, 714, 1000, 180, 180, 20);
  fCtx.fill();
  fCtx.shadowBlur = 0;
  fCtx.strokeStyle = '#CBD5E1';
  fCtx.lineWidth = 2;
  roundRect(fCtx, 714, 1000, 180, 180, 20);
  fCtx.stroke();

  // QR Code Pattern
  fCtx.fillStyle = '#0F172A';
  drawSimulatedQR(fCtx, 724, 1010, 160);

  // Security Label
  fCtx.fillStyle = '#0284C7';
  fCtx.font = '800 20px monospace';
  fCtx.fillText('ON-DEVICE AI VERIFIED', 130, 1180);
  fCtx.fillStyle = '#64748B';
  fCtx.font = '500 18px monospace';
  fCtx.fillText('21-LANDMARK HAND TRACKING • TELECOM RELAY', 130, 1215);

  // Bottom Disclaimer Bar
  fCtx.fillStyle = '#F8FAFC';
  fCtx.fillRect(0, 1340, 1024, 100);
  fCtx.fillStyle = '#64748B';
  fCtx.font = '700 18px -apple-system, BlinkMacSystemFont, sans-serif';
  fCtx.textAlign = 'center';
  fCtx.fillText('Official Digital Identity Pass • Property of Sanket AI Autonomous Systems', 512, 1395);

  const frontDataUrl = frontCanvas.toDataURL('image/png');

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. BACK FACE TEXTURE (1024 x 1440 - Crisp Clean Back Side)
  // ─────────────────────────────────────────────────────────────────────────────
  const backCanvas = document.createElement('canvas');
  backCanvas.width = 1024;
  backCanvas.height = 1440;
  const bCtx = backCanvas.getContext('2d')!;

  // Background
  bCtx.fillStyle = '#FFFFFF';
  bCtx.fillRect(0, 0, 1024, 1440);

  // Magnetic Stripe (Dark Slate)
  bCtx.fillStyle = '#0F172A';
  bCtx.fillRect(0, 120, 1024, 180);

  bCtx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  for (let i = 135; i < 290; i += 16) {
    bCtx.fillRect(0, i, 1024, 4);
  }

  // Signature Stripe
  bCtx.fillStyle = '#F1F5F9';
  bCtx.fillRect(80, 360, 680, 110);
  bCtx.strokeStyle = '#CBD5E1';
  bCtx.lineWidth = 2;
  bCtx.strokeRect(80, 360, 680, 110);

  bCtx.fillStyle = '#475569';
  bCtx.font = 'italic 700 32px cursive';
  bCtx.fillText(name, 120, 430);

  // Security CVC box
  bCtx.fillStyle = '#0F172A';
  bCtx.fillRect(780, 360, 160, 110);
  bCtx.fillStyle = '#F59E0B';
  bCtx.font = '900 36px monospace';
  bCtx.textAlign = 'center';
  bCtx.fillText('7381', 860, 430);
  bCtx.textAlign = 'left';

  // Info Block & Terms
  bCtx.fillStyle = '#0F172A';
  bCtx.font = '900 32px sans-serif';
  bCtx.fillText('TERMS & PROTOCOLS', 90, 560);

  bCtx.fillStyle = '#475569';
  bCtx.font = '500 24px -apple-system, BlinkMacSystemFont, sans-serif';
  const terms = [
    '• This digital membership card verifies access to the Sanket AI neural network.',
    '• Real-time on-device ISL recognition computes 21 coordinate vectors privately.',
    '• Voice Telecom Relay connects landline and cellular trunks throughout India.',
    '• 100 starter credits are valid across all accessible video and phone relay sessions.',
    '• For assistance or recharge inquiries, contact support at 7381709385@pthdfc.',
  ];
  let ty = 620;
  terms.forEach((t) => {
    bCtx.fillText(t, 90, ty);
    ty += 60;
  });

  // Watermark Sanket AI Emblem
  bCtx.textAlign = 'center';
  bCtx.fillStyle = 'rgba(249, 115, 22, 0.06)';
  bCtx.font = '900 320px sans-serif';
  bCtx.fillText('S', 512, 1150);

  // Barcode
  bCtx.fillStyle = '#FFFFFF';
  bCtx.fillRect(120, 1200, 784, 100);
  bCtx.fillStyle = '#0F172A';
  drawSimulatedBarcode(bCtx, 150, 1215, 724, 70);

  bCtx.fillStyle = '#64748B';
  bCtx.font = '800 20px monospace';
  bCtx.fillText(`AUTH-HASH: ${memberId}-VERIFIED-2026`, 512, 1340);

  const backDataUrl = backCanvas.toDataURL('image/png');

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. STRAP TEXTURE (Vibrant Sanket Orange with White Typography)
  // ─────────────────────────────────────────────────────────────────────────────
  const strapCanvas = document.createElement('canvas');
  strapCanvas.width = 192;
  strapCanvas.height = 1024;
  const sCtx = strapCanvas.getContext('2d')!;

  // Strap Base - Vibrant Brand Orange
  sCtx.fillStyle = '#EA580C';
  sCtx.fillRect(0, 0, 192, 1024);

  // Edge Darker Orange Trim
  sCtx.fillStyle = '#C2410C';
  sCtx.fillRect(0, 0, 10, 1024);
  sCtx.fillRect(182, 0, 10, 1024);

  // Repeated Brand Typography Along Strap
  sCtx.save();
  sCtx.translate(96, 512);
  sCtx.rotate(-Math.PI / 2);
  sCtx.textAlign = 'center';
  sCtx.fillStyle = '#FFFFFF';
  sCtx.font = '900 38px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  sCtx.fillText('★  SANKET AI  •  ACCESSIBLE TELECOM  •  SANKET AI  ★', 0, 14);
  sCtx.restore();

  const strapDataUrl = strapCanvas.toDataURL('image/png');

  return { frontDataUrl, backDataUrl, strapDataUrl };
}

// Helper: Rounded Rectangle
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Helper: Simulated QR Code
function drawSimulatedQR(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const cell = size / 21;
  const drawCorner = (cx: number, cy: number) => {
    ctx.fillRect(cx, cy, cell * 7, cell * 7);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(cx + cell, cy + cell, cell * 5, cell * 5);
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(cx + cell * 2, cy + cell * 2, cell * 3, cell * 3);
  };

  drawCorner(x, y);
  drawCorner(x + cell * 14, y);
  drawCorner(x, y + cell * 14);

  for (let r = 0; r < 21; r++) {
    for (let c = 0; c < 21; c++) {
      if ((r < 8 && c < 8) || (r < 8 && c > 12) || (r > 12 && c < 8)) continue;
      if ((r * 7 + c * 13 + 5) % 3 === 0) {
        ctx.fillRect(x + c * cell, y + r * cell, cell, cell);
      }
    }
  }
}

// Helper: Simulated Barcode
function drawSimulatedBarcode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) {
  let cx = x;
  const pattern = [2, 1, 3, 2, 4, 1, 2, 3, 1, 4, 2, 1, 3, 4, 1, 2, 2, 3, 1, 4, 2, 1, 3, 2];
  let idx = 0;
  while (cx < x + w - 20) {
    const barW = pattern[idx % pattern.length] * 2.5;
    ctx.fillRect(cx, y, barW, h);
    cx += barW + ((idx % 3) + 2) * 2;
    idx++;
  }
}
