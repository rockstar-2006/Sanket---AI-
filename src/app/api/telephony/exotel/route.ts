import { NextRequest, NextResponse } from 'next/server';

/**
 * Exotel Cloud Telephony Webhook & Call Gateway
 * Uses environment variables from process.env
 */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const callSid = searchParams.get('CallSid') || searchParams.get('call_sid');
    const from = searchParams.get('From') || searchParams.get('from') || 'Unknown';
    const to = searchParams.get('To') || searchParams.get('to') || process.env.EXOTEL_PHONE_NUMBER || '';
    const callType = searchParams.get('CallType') || 'transcribe';

    // Exotel sends GET requests for call status updates or passthru applet queries
    return NextResponse.json({
      status: 'success',
      service: 'Sanket AI Exotel Telephony Gateway',
      accountSid: process.env.EXOTEL_ACCOUNT_SID || '',
      virtualExoPhone: to,
      activeCall: callSid ? {
        callSid,
        from,
        timestamp: new Date().toISOString(),
      } : null,
      appletResponse: {
        action: 'stream',
        greeting: 'Welcome to Sanket AI Accessible Telephony Bridge. Connecting to Deaf Executive.',
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Exotel can send form-encoded or JSON payloads
    const contentType = req.headers.get('content-type') || '';
    let payload: Record<string, any> = {};

    if (contentType.includes('application/json')) {
      payload = await req.json();
    } else {
      const formData = await req.formData();
      formData.forEach((value, key) => {
        payload[key] = value.toString();
      });
    }

    const {
      CallSid,
      From,
      To,
      Direction,
      Status,
      RecordingUrl,
      SpeechResult,
      Digits,
    } = payload;

    console.log('[Exotel Webhook Inbound Call Event]', {
      CallSid,
      From,
      To,
      Direction,
      Status,
      RecordingUrl,
      SpeechResult,
    });

    // Inbound Call handling response for Exotel Applet
    return NextResponse.json({
      success: true,
      callSid: CallSid || `DEMO-${Date.now()}`,
      callerNumber: From || '+919876543210',
      action: 'connect_to_agent_dashboard',
      message: 'Incoming call routed to Sanket Inclusive Agent teleprompter',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[Exotel Webhook Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
