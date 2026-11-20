/**
 * Murf AI Studio Text-to-Speech Client Service
 * Bridges recognized Indian Sign Language (ISL) to ultra-realistic human voices with Indian and regional accents.
 * Includes graceful automatic fallback to browser Web Speech API.
 */

export interface MurfVoiceOption {
  id: string;
  name: string;
  locale: string;
  language: string;
  gender: 'Male' | 'Female';
  description: string;
  recommended?: boolean;
}

export const MURF_VOICE_CATALOG: MurfVoiceOption[] = [
  {
    id: 'en-IN-aarav',
    name: 'Aarav',
    locale: 'en-IN',
    language: 'Indian English',
    gender: 'Male',
    description: 'Warm, conversational Indian English male voice (Flagship)',
    recommended: true,
  },
  {
    id: 'en-IN-priya',
    name: 'Priya',
    locale: 'en-IN',
    language: 'Indian English',
    gender: 'Female',
    description: 'Friendly, articulate Indian English female voice',
    recommended: true,
  },
  {
    id: 'en-IN-eashwar',
    name: 'Eashwar',
    locale: 'en-IN',
    language: 'Indian English',
    gender: 'Male',
    description: 'Professional, calm male voice for medical & academic consultations',
  },
  {
    id: 'en-IN-arohi',
    name: 'Arohi',
    locale: 'en-IN',
    language: 'Indian English',
    gender: 'Female',
    description: 'Youthful, energetic Indian English female voice',
  },
  {
    id: 'hi-IN-kabir',
    name: 'Kabir (Hindi)',
    locale: 'hi-IN',
    language: 'Hindi',
    gender: 'Male',
    description: 'Natural, fluent Hindi male voice for native regional communication',
    recommended: true,
  },
  {
    id: 'hi-IN-ayushi',
    name: 'Ayushi (Hindi)',
    locale: 'hi-IN',
    language: 'Hindi',
    gender: 'Female',
    description: 'Polite, clear Hindi female voice',
  },
  {
    id: 'hi-IN-shaan',
    name: 'Shaan (Hindi)',
    locale: 'hi-IN',
    language: 'Hindi',
    gender: 'Male',
    description: 'Calm, empathetic Hindi voice for clinical and elder care',
  },
  {
    id: 'en-US-natalie',
    name: 'Natalie (US)',
    locale: 'en-US',
    language: 'US English',
    gender: 'Female',
    description: 'Clean, neutral international voice',
  },
];

let activeAudioElement: HTMLAudioElement | null = null;

export interface SpeakOptions {
  voiceId?: string;
  apiKey?: string;
  engine?: 'murf' | 'browser';
  onStart?: () => void;
  onEnd?: () => void;
}

/**
 * Fallback to standard browser Web Speech API
 */
export function speakWithBrowserWebSpeech(text: string, onEnd?: () => void) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.resume();
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.lang = 'en-US';

    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      const preferred =
        voices.find(
          (v) =>
            v.lang.startsWith('en') &&
            (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('India'))
        ) || voices.find((v) => v.lang.startsWith('en'));
      if (preferred) utterance.voice = preferred;
    }

    if (onEnd) {
      utterance.onend = () => onEnd();
      utterance.onerror = () => onEnd();
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('[WebSpeech Fallback] Speech synthesis notice:', err);
    onEnd?.();
  }
}

/**
 * Synthesizes and plays natural speech using Murf AI with automatic fallback to Web Speech
 */
export async function speakSentence(
  text: string,
  options?: SpeakOptions
): Promise<{ success: boolean; engineUsed: 'murf' | 'browser'; audioUrl?: string }> {
  const cleanText = text
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanText) {
    options?.onEnd?.();
    return { success: false, engineUsed: 'browser' };
  }

  // Stop any currently playing audio element
  if (activeAudioElement) {
    try {
      activeAudioElement.pause();
      activeAudioElement.currentTime = 0;
    } catch {}
    activeAudioElement = null;
  }

  const requestedEngine = options?.engine || 'browser';

  if (requestedEngine === 'browser') {
    options?.onStart?.();
    speakWithBrowserWebSpeech(cleanText, options?.onEnd);
    return { success: true, engineUsed: 'browser' };
  }

  // Murf AI Engine with fast 2200ms timeout for real-time video meetings
  const abortController = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = abortController ? setTimeout(() => abortController.abort(), 2200) : null;

  try {
    const res = await fetch('/api/tts/murf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: abortController ? abortController.signal : undefined,
      body: JSON.stringify({
        text: cleanText,
        voiceId: options?.voiceId || 'en-IN-aarav',
        apiKey: options?.apiKey || undefined,
        format: 'MP3',
      }),
    });

    if (timeoutId) clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const audioSrc = data.audioUrl || (data.audioBase64 ? `data:audio/mp3;base64,${data.audioBase64}` : null);

      if (audioSrc) {
        options?.onStart?.();
        const audio = new Audio(audioSrc);
        activeAudioElement = audio;

        audio.onended = () => {
          activeAudioElement = null;
          options?.onEnd?.();
        };

        audio.onerror = () => {
          console.warn('[Murf AI Audio] Playback error, playing instant Web Speech fallback');
          speakWithBrowserWebSpeech(cleanText, options?.onEnd);
        };

        await audio.play();
        return { success: true, engineUsed: 'murf', audioUrl: data.audioUrl };
      }
    }
  } catch (err: any) {
    if (timeoutId) clearTimeout(timeoutId);
    console.warn('[Murf AI] Generation slow or timed out, executing instant real-time browser speech:', err?.name === 'AbortError' ? 'Timeout > 2.2s' : err?.message);
  }

  // Instant Real-Time Fallback if Murf API times out or is slow
  options?.onStart?.();
  speakWithBrowserWebSpeech(cleanText, options?.onEnd);
  return { success: true, engineUsed: 'browser' };
}
