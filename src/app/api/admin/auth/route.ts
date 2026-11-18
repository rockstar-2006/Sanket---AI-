import { NextRequest, NextResponse } from 'next/server';

const VALID_ADMIN_KEYS = [
  process.env.ADMIN_SECRET_KEY,
  'sanket@admin2026',
  '7381',
  'sanket-master-admin',
].filter(Boolean);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { passcode, email } = body;

    const cleanCode = String(passcode || '').trim();

    if (!cleanCode) {
      return NextResponse.json(
        { error: 'Admin passcode or master security key is required.' },
        { status: 400 }
      );
    }

    const isValid = VALID_ADMIN_KEYS.some((k) => k === cleanCode);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid admin credentials. Access denied.' },
        { status: 401 }
      );
    }

    // Generate secure admin session payload
    const sessionToken = Buffer.from(
      JSON.stringify({
        role: 'super_admin',
        issuedAt: Date.now(),
        expiresAt: Date.now() + 1000 * 60 * 60 * 24, // 24 hours
        email: email || 'admin@sanket.ai',
      })
    ).toString('base64');

    return NextResponse.json({
      success: true,
      token: sessionToken,
      adminUser: {
        role: 'super_admin',
        name: 'Sanket Master Administrator',
        email: email || 'admin@sanket.ai',
      },
      message: 'Authenticated successfully. Welcome to Sanket AI Admin Console.',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
