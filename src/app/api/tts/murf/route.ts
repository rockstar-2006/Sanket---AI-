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
      testConnection = false,
    } = body;

    const activeKey = (apiKey || DEFAULT_MURF_KEY || '').trim();

    if (!activeKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'No Murf AI API Key provided or configured.',
        },
        { status: 200 }
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
        { status: 200 }
      );
    }

    const startTime = Date.now();
    const endpoint = 'https://api.murf.ai/v1/speech/generate';

    // Direct clean payload conforming to official Murf AI Gen2 specification
    const payload = {
      voiceId: voiceId || 'en-IN-aarav',
      text: targetText,
      format: format || 'MP3',
      modelVersion: 'GEN2',
    };

    const murfAbort = new AbortController();
    const murfTimeout = setTimeout(() => murfAbort.abort(), 9000);

    let successfulData: any = null;
    let lastErrorMsg = 'Murf AI generation failed.';
    let lastStatus = 500;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'api-key': activeKey,
        },
        signal: murfAbort.signal,
        body: JSON.stringify(payload),
      });

      lastStatus = response.status;
      const responseText = await response.text();

      if (response.ok) {
        try {
          successfulData = JSON.parse(responseText);
        } catch {
          lastErrorMsg = 'Murf AI returned invalid JSON.';
        }
      } else {
        try {
          const errJson = JSON.parse(responseText);
          lastErrorMsg =
            errJson?.errorMessage ||
            errJson?.message ||
            errJson?.detail ||
            `Murf error (${response.status}): ${responseText.slice(0, 150)}`;
        } catch {
          lastErrorMsg = `Murf AI (${response.status}): ${responseText.slice(0, 150)}`;
        }
      }
    } catch (fetchErr: any) {
      if (fetchErr?.name === 'AbortError') {
        lastErrorMsg = 'Murf AI took >9s to synthesize. Instant browser voice activated.';
      } else {
        lastErrorMsg = fetchErr?.message || 'Network error reaching Murf AI.';
      }
    } finally {
      clearTimeout(murfTimeout);
    }

    const latencyMs = Date.now() - startTime;

    if (!successfulData || (!successfulData.audioFile && !successfulData.audio_file && !successfulData.encodedAudio && !successfulData.encoded_audio)) {
      console.warn('[Murf AI API Notice]: Murf response notice:', lastStatus, lastErrorMsg);
      // Always return HTTP 200 with success: false so client receives structured JSON without 500 Internal Server Error
      return NextResponse.json({
        success: false,
        error: lastErrorMsg,
        statusCode: lastStatus,
        latencyMs,
      });
    }

    const rawAudioUrl = successfulData.audioFile || successfulData.audio_file || null;
    const rawAudioBase64 = successfulData.encodedAudio || successfulData.encoded_audio || null;
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
    console.error('[Murf TTS Endpoint Error]:', err?.message || err);
    return NextResponse.json({
      success: false,
      error: err?.message || 'Murf AI service error. Switched to instant browser speech.',
    });
  }
}
