import { NextRequest, NextResponse } from 'next/server';

/**
 * Exotel Cloud Telephony Webhook & Call Gateway
 * Synchronizes incoming GSM phone calls to the Sanket AI web dashboard
 */

declare global {
  var activeExotelCall: {
    callSid: string;
    from: string;
    to: string;
    timestamp: string;
    status: 'ringing' | 'connected' | 'ended';
    latestSpeech?: string;
    latestAgentReply?: string;
  } | null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    // Dismiss active call from dashboard
    if (action === 'dismiss' || action === 'answer') {
      if (globalThis.activeExotelCall) {
        globalThis.activeExotelCall.status = action === 'answer' ? 'connected' : 'ended';
      }
      return NextResponse.json({ status: 'ok', activeCall: globalThis.activeExotelCall });
    }

    if (action === 'clearSpeech') {
      if (globalThis.activeExotelCall) {
        delete globalThis.activeExotelCall.latestSpeech;
      }
      return NextResponse.json({ status: 'ok' });
    }

    const callSid = searchParams.get('CallSid') || searchParams.get('call_sid');
    const from = searchParams.get('From') || searchParams.get('from') || 'Unknown';
    const to = searchParams.get('To') || searchParams.get('to') || process.env.EXOTEL_PHONE_NUMBER || '';

    if (callSid) {
      globalThis.activeExotelCall = {
        callSid,
        from,
        to,
        timestamp: new Date().toISOString(),
        status: 'ringing',
      };
    }

    return NextResponse.json({
      status: 'success',
      service: 'Sanket AI Exotel Telephony Gateway',
      accountSid: process.env.EXOTEL_ACCOUNT_SID || '',
      virtualExoPhone: to,
      activeCall: globalThis.activeExotelCall || null,
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
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    // Agent speaks from web dashboard -> send down the line
    if (action === 'speak') {
      let data: any = {};
      try { data = await req.json(); } catch {}
      const speechText = data.text || '';
      if (globalThis.activeExotelCall) {
        globalThis.activeExotelCall.latestAgentReply = speechText;
      }
      if (typeof (globalThis as any).triggerTelephonySpeak === 'function') {
        (globalThis as any).triggerTelephonySpeak(speechText);
      }
      return NextResponse.json({ status: 'queued', text: speechText });
    }

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

    const callerSpeech = SpeechResult || Digits;

    console.log('[Exotel Inbound Call Webhook Event]', {
      CallSid,
      From,
      To,
      Direction,
      Status,
      callerSpeech,
    });

    const callerId = From ? (From.startsWith('+') ? From : `+${From}`) : '+917381709385';
    globalThis.activeExotelCall = {
      callSid: CallSid || `EXO-${Date.now()}`,
      from: callerId,
      to: To || process.env.EXOTEL_PHONE_NUMBER || '',
      timestamp: new Date().toISOString(),
      status: 'ringing',
      latestSpeech: callerSpeech || undefined,
    };

    // Return Passthru response for Exotel Applet
    return NextResponse.json({
      success: true,
      callSid: globalThis.activeExotelCall.callSid,
      callerNumber: callerId,
      action: 'connect_to_agent_dashboard',
      message: 'Incoming call routed to Sanket Inclusive Agent teleprompter',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[Exotel Webhook Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
