import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface MurfGenerateRequest {
  text?: string;
  voiceId?: string;
  apiKey?: string;
  format?: 'MP3' | 'WAV' | 'FLAC';
  style?: string;
  testConnection?: boolean;
}

const DEFAULT_MURF_KEY =
  process.env.MURF_API_KEY ||
  process.env.NEXT_PUBLIC_MURF_API_KEY ||
  'ap2_38568798-de60-4b13-8b8f-2861d725d236';

export async function POST(req: NextRequest) {
  try {
    let body: MurfGenerateRequest = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const {
      text = '',
      voiceId = 'en-IN-aarav',
      apiKey,
      format = 'MP3',
      style,
      testConnection = false,
    } = body;

    const activeKey = (apiKey || DEFAULT_MURF_KEY || '').trim();

    if (!activeKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'No Murf AI API Key provided or configured.',
        },
        { status: 400 }
      );
    }

    const targetText = testConnection
      ? 'Namaste! Murf AI natural voice agent is now active and ready in Sanket.'
      : text.trim();

    if (!targetText) {
      return NextResponse.json(
        {
          success: false,
          error: 'No text provided to synthesize.',
        },
        { status: 400 }
      );
    }

    const startTime = Date.now();

    // Prepare payload without invalid style parameters
    const murfPayload: Record<string, any> = {
      text: targetText,
      voiceId: voiceId || 'en-IN-aarav',
      format: format || 'MP3',
      modelVersion: 'GEN2',
    };

    if (style && style !== 'Conversational' && style !== 'default') {
      murfPayload.style = style;
    }

    // Call Murf AI Speech Generation API with all compatible auth headers
    const response = await fetch('https://api.murf.ai/v1/speech/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': activeKey,
        'token': activeKey,
        'Authorization': `Bearer ${activeKey}`,
      },
      body: JSON.stringify(murfPayload),
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      let errorJson: any = null;
      try {
        errorJson = JSON.parse(errorText);
      } catch {}

      let errorMsg = `Murf AI API error (${response.status})`;
      if (typeof errorJson?.errorMessage === 'string') {
        errorMsg = errorJson.errorMessage;
      } else if (typeof errorJson?.message === 'string') {
        errorMsg = errorJson.message;
      } else if (typeof errorJson?.detail === 'string') {
        errorMsg = errorJson.detail;
      } else if (typeof errorJson?.error === 'string') {
        errorMsg = errorJson.error;
      } else if (typeof errorJson?.error?.message === 'string') {
        errorMsg = errorJson.error.message;
      } else if (typeof errorJson?.error?.detail === 'string') {
        errorMsg = errorJson.error.detail;
      } else if (errorText) {
        errorMsg = `Murf AI (${response.status}): ${errorText.slice(0, 150)}`;
      }

      console.warn('[Murf AI API Error]:', response.status, errorMsg);

      return NextResponse.json(
        {
          success: false,
          error: errorMsg,
          status: response.status,
          latencyMs,
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    const rawAudioUrl = data.audioFile || data.audio_file || null;
    const rawAudioBase64 = data.encodedAudio || data.encoded_audio || null;
    const finalAudioUrl =
      rawAudioUrl || (rawAudioBase64 ? `data:audio/mp3;base64,${rawAudioBase64}` : null);

    return NextResponse.json({
      success: true,
      audioUrl: finalAudioUrl,
      audioBase64: rawAudioBase64,
      voiceId,
      latencyMs,
      message: testConnection ? 'Murf AI voice generated successfully!' : 'Audio generated.',
    });
  } catch (err: any) {
    console.error('[Murf TTS Endpoint Error]:', err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Internal server error while generating Murf speech.',
      },
      { status: 500 }
    );
  }
}
