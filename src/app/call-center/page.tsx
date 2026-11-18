'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { useWallet } from '@/context/WalletContext';
import { 
  Phone, 
  PhoneCall, 
  PhoneOff, 
  PhoneIncoming, 
  Mic, 
  MicOff, 
  Volume2, 
  Video, 
  VideoOff, 
  Cpu, 
  Hand, 
  MessageSquare, 
  Clock, 
  ShieldCheck, 
  Headphones, 
  Building2, 
  Send,
  Zap,
  Activity,
  Layers,
  ArrowRight,
  Wifi,
  CheckCircle2,
  Radio,
  RotateCcw,
  Settings,
  Key,
  Check,
  AlertCircle,
  X,
  ExternalLink,
  Eye,
  EyeOff,
  Play,
  Wand2,
  ChevronDown,
  ChevronUp,
  Type
} from 'lucide-react';
import { 
  ISLCameraRecognizerEngine, 
  RecognitionFrameUpdate, 
  DetectedSignCandidate,
  RecognitionMode
} from '@/lib/islCameraRecognizer';
import { composeContextualSentence } from '@/lib/sentenceComposer';

interface TranscriptItem {
  id: string;
  sender: 'caller' | 'agent';
  text: string;
  timestamp: string;
  gesture?: string;
}

export type AIProvider = 'gemini' | 'claude' | 'openai' | 'groq' | 'openrouter';

export interface CustomAIConfig {
  provider: AIProvider;
  model: string;
  apiKey: string;
  customBaseUrl?: string;
}

const DEFAULT_AI_CONFIG: CustomAIConfig = {
  provider: 'gemini',
  model: 'gemini-1.5-flash',
  apiKey: '',
  customBaseUrl: '',
};

const PROVIDER_MODELS: Record<AIProvider, { id: string; name: string; shortName: string }[]> = {
  gemini: [
    { id: 'gemini-1.5-flash', name: 'Google Gemini 1.5 Flash (Ultra Fast)', shortName: 'Gemini 1.5 Flash' },
    { id: 'gemini-2.0-flash', name: 'Google Gemini 2.0 Flash (Next-Gen)', shortName: 'Gemini 2.0 Flash' },
    { id: 'gemini-1.5-pro', name: 'Google Gemini 1.5 Pro (Deep Reasoning)', shortName: 'Gemini 1.5 Pro' },
  ],
  claude: [
    { id: 'claude-3-7-sonnet-20250219', name: 'Anthropic Claude 3.7 Sonnet (Hybrid Reasoning)', shortName: 'Claude 3.7 Sonnet' },
    { id: 'claude-3-5-sonnet-20241022', name: 'Anthropic Claude 3.5 Sonnet v2 (Recommended)', shortName: 'Claude 3.5 Sonnet' },
    { id: 'claude-3-5-haiku-20241022', name: 'Anthropic Claude 3.5 Haiku (Lightning Fast)', shortName: 'Claude 3.5 Haiku' },
    { id: 'claude-3-opus-20240229', name: 'Anthropic Claude 3 Opus (Maximum Precision)', shortName: 'Claude 3 Opus' },
    { id: 'claude-3-haiku-20240307', name: 'Anthropic Claude 3 Haiku (Compact)', shortName: 'Claude 3 Haiku' },
  ],
  openai: [
    { id: 'gpt-4o-mini', name: 'OpenAI GPT-4o Mini (Fast & Affordable)', shortName: 'GPT-4o Mini' },
    { id: 'gpt-4o', name: 'OpenAI GPT-4o (Flagship Omni)', shortName: 'GPT-4o' },
    { id: 'o3-mini', name: 'OpenAI o3-mini (Reasoning Engine)', shortName: 'o3-mini' },
  ],
  groq: [
    { id: 'openai/gpt-oss-20b', name: 'OpenAI GPT OSS 20B (1000 T/s - Fastest)', shortName: 'GPT OSS 20B' },
    { id: 'openai/gpt-oss-120b', name: 'OpenAI GPT OSS 120B (High Precision)', shortName: 'GPT OSS 120B' },
    { id: 'gemma2-9b-it', name: 'Google Gemma 2 9B (Production)', shortName: 'Gemma 2 9B' },
  ],
  openrouter: [
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet via OpenRouter', shortName: 'Claude 3.5' },
    { id: 'anthropic/claude-3.7-sonnet', name: 'Claude 3.7 Sonnet via OpenRouter', shortName: 'Claude 3.7' },
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3 via OpenRouter', shortName: 'DeepSeek V3' },
    { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B via OpenRouter', shortName: 'Llama 3.3' },
  ],
};

interface DemoScenario {
  id: string;
  title: string;
  callerName: string;
  callerNumber: string;
  category: string;
  dialogue: string[];
  suggestedReplies: string[];
}

const PRESET_SCENARIOS: DemoScenario[] = [
  {
    id: 'daily',
    title: 'Daily Chat with Friends & Family',
    callerName: 'Rahul (Friend)',
    callerNumber: '+91 98450 12890',
    category: 'Daily Casual Life & Social Communication',
    dialogue: [
      'Hey! Great to connect with you. How are you doing today?',
      'Awesome! Are you free to catch up or grab lunch together later?',
      'Sounds great, let us meet at the cafe near the circle. See you soon!'
    ],
    suggestedReplies: [
      'Hello! Good to see you. I am doing great today, how about you?',
      'Yes, absolutely! I am free, let us grab lunch together.',
      'Awesome! Thank you so much, see you at the cafe soon!'
    ]
  },
  {
    id: 'ecommerce',
    title: 'Food & E-Commerce Delivery',
    callerName: 'Priya Sharma',
    callerNumber: '+91 98450 12890',
    category: 'E-Commerce / Logistics',
    dialogue: [
      'Hello, I placed a food order 40 minutes ago and the rider is not reachable. Can you please check where my delivery is?',
      'Yes, my order ID is 48291. Please check quickly.',
      'Understood! Thank you so much for the quick confirmation.'
    ],
    suggestedReplies: [
      'Hello! Welcome to Support. Could you please provide your order ID?',
      'Thank you. I have checked with the hub — your delivery rider is 5 minutes away and arriving shortly.',
      'You are very welcome! Is there anything else I can assist you with today?'
    ]
  },
  {
    id: 'banking',
    title: 'Banking & Card Services',
    callerName: 'Vikram Mehta',
    callerNumber: '+91 97112 44321',
    category: 'Fintech / Banking',
    dialogue: [
      'Hi, I just tried withdrawing cash at an ATM and it declined. Is my debit card blocked?',
      'My registered phone number is 9711244321 and account ends in 8840.',
      'That is great, thank you for resolving it so quickly!'
    ],
    suggestedReplies: [
      'Welcome to Card Support. Let me verify your account. Please confirm your registered mobile number.',
      'Thank you. A temporary security hold was placed. I have now verified your identity and unblocked your card.',
      'Your card is now fully active. Thank you for banking with us!'
    ]
  },
  {
    id: 'emergency',
    title: 'Emergency 112 Dispatch',
    callerName: 'Anand Kumar',
    callerNumber: '+91 94480 99123',
    category: 'Emergency Helpline',
    dialogue: [
      'Emergency! There has been a road accident near MG Road circle. We need an ambulance urgently!',
      'Two people are injured, both are conscious but need medical assistance right away.',
      'Thank you, please send them fast!'
    ],
    suggestedReplies: [
      'This is Emergency Response. An ambulance has been dispatched to MG Road circle immediately.',
      'Paramedics are en route with an estimated arrival time of 4 minutes. Please ensure the area is safe.',
      'Our emergency response unit has arrived at your location.'
    ]
  }
];

export default function CallCenterPage() {
  const { credits, deductCredits, openRechargeModal } = useWallet();

  // Call State
  const [callStatus, setCallStatus] = useState<'idle' | 'ringing' | 'connected' | 'ended'>('idle');
  const [activeCaller, setActiveCaller] = useState<{ name: string; number: string }>({
    name: 'Rahul (Friend)',
    number: '+91 98450 12890'
  });
  const [callDuration, setCallDuration] = useState<number>(0);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [currentScenarioIndex, setCurrentScenarioIndex] = useState(0);
  const [scenarioStep, setScenarioStep] = useState(0);

  // Recognition Mode & Fingerspelling State
  const [recognitionMode, setRecognitionMode] = useState<RecognitionMode>('hybrid');
  const [spelledLetters, setSpelledLetters] = useState<string[]>([]);
  const spelledLettersRef = useRef<string[]>([]);
  useEffect(() => {
    spelledLettersRef.current = spelledLetters;
  }, [spelledLetters]);

  // Agent State
  const [agentInputText, setAgentInputText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micListening, setMicListening] = useState(false);
  const [cameraActive, setCameraActive] = useState(true);
  const [detectedGesture, setDetectedGesture] = useState<string | null>(null);
  const [holdProgress, setHoldProgress] = useState<number>(0);
  const [handsDetected, setHandsDetected] = useState<number>(0);

  // AI Contextual Sentence Synthesis State
  const [signedTokens, setSignedTokens] = useState<string[]>([]);
  const signedTokensRef = useRef<string[]>([]);
  const [composedSentence, setComposedSentence] = useState<string>('');
  const [autoSpeakCountdown, setAutoSpeakCountdown] = useState<number | null>(null);
  const [autoSpeakEnabled, setAutoSpeakEnabled] = useState<boolean>(true);
  const [isComposingWithAi, setIsComposingWithAi] = useState<boolean>(false);
  const [composerSource, setComposerSource] = useState<string>('Google Gemini 1.5');
  const autoSpeakTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Client Custom AI Provider Configuration (Claude, Gemini, OpenAI, Groq, OpenRouter)
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [aiConfig, setAiConfig] = useState<CustomAIConfig>(DEFAULT_AI_CONFIG);
  const [tempConfig, setTempConfig] = useState<CustomAIConfig>(DEFAULT_AI_CONFIG);
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [testStatus, setTestStatus] = useState<{ loading: boolean; success?: boolean; message?: string } | null>(null);
  const [testSynthesisStatus, setTestSynthesisStatus] = useState<{
    loading: boolean;
    success?: boolean;
    sentence?: string;
    message?: string;
  } | null>(null);
  const aiConfigRef = useRef<CustomAIConfig>(DEFAULT_AI_CONFIG);
  useEffect(() => {
    aiConfigRef.current = aiConfig;
  }, [aiConfig]);

  const syncAiConfigToServer = (config: CustomAIConfig) => {
    if (!config?.apiKey) return;
    socketRef.current?.emit('telephony-sync-config', config);
    fetch('/api/telephony/exotel?action=syncConfig', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    }).catch(() => {});
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sanket_custom_ai_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        setAiConfig(parsed);
        setTempConfig(parsed);
        aiConfigRef.current = parsed;
        setComposerSource(
          parsed.provider === 'claude'
            ? `Claude (${parsed.model})`
            : parsed.provider === 'openai'
              ? `OpenAI (${parsed.model})`
              : parsed.provider === 'groq'
                ? `Groq (${parsed.model})`
                : parsed.provider === 'openrouter'
                  ? `OpenRouter (${parsed.model})`
                  : `Gemini (${parsed.model})`
        );
        syncAiConfigToServer(parsed);
      }
    } catch {}
  }, []);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recognizerRef = useRef<ISLCameraRecognizerEngine | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const callerReplyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);

  // Synchronized state refs to avoid closure staleness
  const callStatusRef = useRef(callStatus);
  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

  const scenarioStepRef = useRef(scenarioStep);
  useEffect(() => {
    scenarioStepRef.current = scenarioStep;
  }, [scenarioStep]);

  const transcriptsRef = useRef(transcripts);
  useEffect(() => {
    transcriptsRef.current = transcripts;
  }, [transcripts]);

  const currentScenarioIndexRef = useRef(currentScenarioIndex);
  useEffect(() => {
    currentScenarioIndexRef.current = currentScenarioIndex;
  }, [currentScenarioIndex]);

  // Auto-scroll transcripts ONLY inside the chat container (never jump or scroll the browser window)
  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTo({
        top: transcriptContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [transcripts]);

  // Call duration counter & real-time credit consumption (1 credit per 10s of active relay)
  useEffect(() => {
    if (callStatus === 'connected') {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => {
          const nextSec = prev + 1;
          if (nextSec > 0 && nextSec % 10 === 0) {
            const hasCredits = deductCredits(1, 'Telecom Relay Call (10s usage)');
            if (!hasCredits) {
              handleEndCall();
              openRechargeModal();
            }
          }
          return nextSec;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (callStatus === 'idle') setCallDuration(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callStatus]);

  // ─── Real-Time Inbound GSM Call Listener (Exotel Webhook Polling & Socket.IO) ───
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket.IO] Connected to telephony gateway, syncing AI key...');
      if (aiConfigRef.current?.apiKey) {
        syncAiConfigToServer(aiConfigRef.current);
      }
    });

    socket.on('telephony-caller-speech', (data: { text: string; caller?: string }) => {
      console.log('[Socket.IO] Telephony caller speech event:', data);
      if (data?.text) {
        setCallStatus('connected');
        addTranscript('caller', data.text);
      }
    });

    socket.on('telephony-call-status', (data: { status: string; callSid?: string }) => {
      if (data?.status === 'connected') {
        setCallStatus('connected');
      } else if (data?.status === 'ended') {
        setCallStatus('ended');
        setTimeout(() => setCallStatus('idle'), 2000);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (callStatus === 'ended') return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/telephony/exotel');
        if (res.ok) {
          const data = await res.json();
          if (data?.activeCall) {
            if (callStatus === 'idle' && data.activeCall.status === 'ringing') {
              setActiveCaller({
                name: `Caller (${data.activeCall.from})`,
                number: data.activeCall.from,
              });
              setCallStatus('ringing');
            }
            if (data.activeCall.latestSpeech) {
              setCallStatus('connected');
              // Only add from HTTP polling as fallback if Socket.IO is disconnected
              if (!socketRef.current?.connected) {
                addTranscript('caller', data.activeCall.latestSpeech);
              }
              fetch('/api/telephony/exotel?action=clearSpeech').catch(() => {});
            }
          }
        }
      } catch {}
    }, 1500);

    return () => clearInterval(pollInterval);
  }, [callStatus]);

  // Start webcam and initialize live ISL Camera Recognizer
  useEffect(() => {
    let stream: MediaStream | null = null;
    let isCancelled = false;

    async function initCameraAndRecognizer() {
      if (!cameraActive) return;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
          audio: false,
        });

        if (isCancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        const recognizer = new ISLCameraRecognizerEngine();
        recognizerRef.current = recognizer;
        recognizer.setMode(recognitionMode);

        if (videoRef.current && canvasRef.current) {
          await recognizer.initialize(
            videoRef.current,
            canvasRef.current,
            (update: RecognitionFrameUpdate) => {
              setHandsDetected(update.handsDetected);
              setHoldProgress(update.holdProgress);

              if (update.candidate) {
                setDetectedGesture(update.candidate.displayLabel);
              } else if (update.handsDetected === 0) {
                setDetectedGesture(null);
              }

              if (update.confirmedToken) {
                const token = update.confirmedToken.token.toUpperCase();
                const isLetter = update.confirmedToken.type === 'letter';
                setDetectedGesture(isLetter ? `Letter ${token}` : token);

                if (isLetter) {
                  // Live fingerspelling accumulator: works in both standby practice and live call!
                  setSpelledLetters((prev) => {
                    const lastLetter = prev[prev.length - 1];
                    // Anti-bounce: ignore consecutive duplicate if user maintains same letter posture
                    if (lastLetter === token) {
                      return prev;
                    }
                    const updated = [...prev, token];
                    spelledLettersRef.current = updated;
                    return updated;
                  });
                } else {
                  // Whole ISL gesture confirmed!
                  // If there was a pending fingerspelled word, flush it first
                  if (spelledLettersRef.current.length > 0) {
                    const word = spelledLettersRef.current.join('');
                    handleTokenInputRef.current(`SPELL:${word}`);
                    setSpelledLetters([]);
                    spelledLettersRef.current = [];
                  }

                  // Process gesture immediately in both standby practice & active call!
                  handleTokenInputRef.current(token);
                }
              }
            },
            recognitionMode
          );
        }
      } catch (err) {
        console.warn('[CallCenter] Camera recognizer init error:', err);
      }
    }

    initCameraAndRecognizer();

    return () => {
      isCancelled = true;
      if (recognizerRef.current) {
        recognizerRef.current.stop();
        recognizerRef.current = null;
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraActive]);

  // Web Speech Recognition for live microphone transcription
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const reco = new SpeechRecognition();
        reco.continuous = true;
        reco.interimResults = true;
        reco.lang = 'en-IN';

        reco.onresult = (event: any) => {
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            }
          }
          if (finalTranscript.trim()) {
            addTranscript('caller', finalTranscript.trim());
          }
        };

        reco.onerror = (e: any) => console.log('Speech recognition error:', e);
        recognitionRef.current = reco;
      }
    }
  }, []);

  const lastProcessedSpeechRef = useRef<{ text: string; sender: string; time: number }>({ text: '', sender: '', time: 0 });

  const addTranscript = (sender: 'caller' | 'agent', text: string, gesture?: string) => {
    const cleanText = text.trim();
    // Filter out punctuation-only artifacts or empty noise
    if (!cleanText || cleanText === '.' || cleanText.toLowerCase() === 'empty') return;

    // Deduplication filter: Prevent identical consecutive speech from flooding the teleprompter
    const now = Date.now();
    const last = lastProcessedSpeechRef.current;
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (
      last.sender === sender &&
      normalize(last.text) === normalize(cleanText) &&
      now - last.time < 3500
    ) {
      console.log('[Transcript Deduplication] Filtered repeated speech bubble:', cleanText);
      return;
    }

    lastProcessedSpeechRef.current = { text: cleanText, sender, time: now };

    const newItem: TranscriptItem = {
      id: `${Date.now()}-${Math.random()}`,
      sender,
      text: cleanText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      gesture
    };
    setTranscripts((prev) => [...prev, newItem]);
  };

  const handleStartSimulatedCall = (scenario: DemoScenario) => {
    if (callerReplyTimerRef.current) clearTimeout(callerReplyTimerRef.current);
    clearPendingSentence();
    setActiveCaller({ name: scenario.callerName, number: scenario.callerNumber });
    setTranscripts([]);
    setScenarioStep(0);
    scenarioStepRef.current = 0;
    setCallStatus('connected');
    callerReplyTimerRef.current = setTimeout(() => {
      if (callStatusRef.current === 'connected') {
        const firstMsg = scenario.dialogue[0];
        addTranscript('caller', firstMsg);
        speakCustomerVoice(firstMsg);
      }
    }, 500);
  };

  const handleAnswerCall = () => {
    setCallStatus('connected');
    setTranscripts([]);
    setScenarioStep(0);
    scenarioStepRef.current = 0;
    clearPendingSentence();
    fetch('/api/telephony/exotel?action=answer').catch(() => {});

    // Only inject preset scenario dialogue if this is a manual demo simulation, NEVER for real phone callers!
    const isRealPhoneCall = activeCaller.name.includes('Caller') || (activeCaller.number && (activeCaller.number.startsWith('+') || activeCaller.number.startsWith('0')));
    if (callerReplyTimerRef.current) clearTimeout(callerReplyTimerRef.current);

    if (!isRealPhoneCall) {
      const scenario = PRESET_SCENARIOS[currentScenarioIndex];
      callerReplyTimerRef.current = setTimeout(() => {
        if (callStatusRef.current === 'connected') {
          const firstMsg = scenario.dialogue[0];
          addTranscript('caller', firstMsg);
          speakCustomerVoice(firstMsg);
        }
      }, 500);
    }
  };

  const handleEndCall = () => {
    setCallStatus('ended');
    clearPendingSentence();
    fetch('/api/telephony/exotel?action=dismiss').catch(() => {});
    if (callerReplyTimerRef.current) {
      clearTimeout(callerReplyTimerRef.current);
      callerReplyTimerRef.current = null;
    }
    if (micListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setMicListening(false);
    }
    setTimeout(() => setCallStatus('idle'), 2000);
  };

  // Convert Agent text/signs to Voice (TTS) - Instant synthesis matching online meeting room
  const handleAgentSpeak = async (text: string, gestureName?: string) => {
    if (!text.trim()) return;

    // In standby practice mode, synthesize voice immediately so the user can hear their sign
    if (callStatusRef.current !== 'connected') {
      setIsSpeaking(true);
      fallbackSpeak(text);
      return;
    }

    addTranscript('agent', text, gestureName);
    setAgentInputText('');
    setIsSpeaking(true);

    // Instant local speech synthesis (Zero network delay, under 50ms, matching meeting room)
    fallbackSpeak(text);

    // Emit via WebSocket & HTTP to ensure instantaneous telecom audio downlink
    socketRef.current?.emit('telephony-agent-speak', { text });

    // Dispatch spoken text to Exotel telephony gateway
    fetch('/api/telephony/exotel?action=speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }).catch(() => {});

    // Only inject preset dialogue if it's a simulated demo, NEVER on a real phone call!
    const isRealPhoneCall = activeCaller.name.includes('Caller') || (activeCaller.number && (activeCaller.number.startsWith('+') || activeCaller.number.startsWith('0')));
    if (!isRealPhoneCall) {
      const scenario = PRESET_SCENARIOS[currentScenarioIndex];
      const nextStep = scenarioStepRef.current + 1;
      if (nextStep < scenario.dialogue.length) {
        scenarioStepRef.current = nextStep;
        setScenarioStep(nextStep);
        if (callerReplyTimerRef.current) clearTimeout(callerReplyTimerRef.current);
        callerReplyTimerRef.current = setTimeout(() => {
          if (callStatusRef.current === 'connected') {
            const nextMsg = scenario.dialogue[nextStep];
            addTranscript('caller', nextMsg);
            speakCustomerVoice(nextMsg);
          }
        }, 2500);
      }
    }
  };

  const fallbackSpeak = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setIsSpeaking(false);
    }
  };

  const speakCustomerVoice = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.pitch = 1.1;
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const toggleMic = () => {
    if (!recognitionRef.current) return;
    if (micListening) {
      recognitionRef.current.stop();
      setMicListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setMicListening(true);
      } catch (e) {
        console.error('Mic start error', e);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ─── AI Contextual Sentence Synthesis & Gesture Handlers ─────────────────
  const handleTokenInputRef = useRef<(token: string) => void>(() => {});

  const commitAndSpeakSentence = (sentenceToSpeak?: string, gestureLabel?: string) => {
    if (autoSpeakTimerRef.current) clearTimeout(autoSpeakTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setAutoSpeakCountdown(null);

    const finalSentence = sentenceToSpeak || composedSentence;
    const finalGesture = gestureLabel || (signedTokensRef.current.length > 0 ? signedTokensRef.current.join(' + ') : 'ISL');

    if (finalSentence && finalSentence.trim()) {
      handleAgentSpeak(finalSentence.trim(), finalGesture);
      setComposedSentence('');
      setSignedTokens([]);
      signedTokensRef.current = [];
    }
  };

  const clearPendingSentence = () => {
    if (autoSpeakTimerRef.current) clearTimeout(autoSpeakTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setAutoSpeakCountdown(null);
    setComposedSentence('');
    setSignedTokens([]);
    signedTokensRef.current = [];
    setSpelledLetters([]);
    spelledLettersRef.current = [];
  };

  const completeSpelledWord = () => {
    if (spelledLettersRef.current.length === 0) return;
    const word = spelledLettersRef.current.join('');
    handleTokenInput(`SPELL:${word}`);
    setSpelledLetters([]);
    spelledLettersRef.current = [];
  };

  const backspaceSpelledLetter = () => {
    setSpelledLetters((prev) => prev.slice(0, -1));
  };

  const clearSpelledLetters = () => {
    setSpelledLetters([]);
    spelledLettersRef.current = [];
  };

  const handleModeChange = (mode: RecognitionMode) => {
    setRecognitionMode(mode);
    if (recognizerRef.current) {
      recognizerRef.current.setMode(mode);
    }
  };

  const handleTestConnection = async () => {
    setTestStatus({ loading: true });
    try {
      const res = await fetch('/api/telephony/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testConnection: true,
          customConfig: tempConfig,
        }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setTestStatus({
          loading: false,
          success: true,
          message: `Verified! Latency: ${data.latencyMs}ms (${data.model})`,
        });
      } else {
        setTestStatus({
          loading: false,
          success: false,
          message: data.message || 'Authentication error. Please check your API key.',
        });
      }
    } catch (e: any) {
      setTestStatus({
        loading: false,
        success: false,
        message: e?.message || 'Network connection failed.',
      });
    }
  };

  const handleTestSynthesis = async () => {
    setTestSynthesisStatus({ loading: true });
    try {
      const res = await fetch('/api/telephony/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokens: ['HELLO', 'HOW ARE YOU'],
          scenarioId: 'daily',
          dialogueStep: 0,
          callerMessage: 'Hey! Great to connect with you. How are you doing today?',
          customConfig: tempConfig,
        }),
      });
      const data = await res.json();
      if (res.ok && data.sentence) {
        setTestSynthesisStatus({
          loading: false,
          success: true,
          sentence: data.sentence,
          message: `Generated via ${data.model || tempConfig.model} (${data.source || 'ai'})`,
        });
      } else {
        setTestSynthesisStatus({
          loading: false,
          success: false,
          message: data.message || data.error || 'Failed to synthesize sample sentence.',
        });
      }
    } catch (e: any) {
      setTestSynthesisStatus({
        loading: false,
        success: false,
        message: e?.message || 'Network error during synthesis test.',
      });
    }
  };

  const handleSaveConfig = () => {
    setAiConfig(tempConfig);
    aiConfigRef.current = tempConfig;
    try {
      localStorage.setItem('sanket_custom_ai_config', JSON.stringify(tempConfig));
    } catch {}
    setComposerSource(
      tempConfig.provider === 'claude'
        ? `Claude (${tempConfig.model})`
        : tempConfig.provider === 'openai'
          ? `OpenAI (${tempConfig.model})`
          : tempConfig.provider === 'groq'
            ? `Groq (${tempConfig.model})`
            : tempConfig.provider === 'openrouter'
              ? `OpenRouter (${tempConfig.model})`
              : `Gemini (${tempConfig.model})`
    );
    syncAiConfigToServer(tempConfig);
    setShowConfigModal(false);
  };

  const handleResetToDefaultConfig = () => {
    setTempConfig(DEFAULT_AI_CONFIG);
    setAiConfig(DEFAULT_AI_CONFIG);
    aiConfigRef.current = DEFAULT_AI_CONFIG;
    try {
      localStorage.removeItem('sanket_custom_ai_config');
    } catch {}
    setComposerSource('Google Gemini 1.5');
    setTestStatus(null);
    setTestSynthesisStatus(null);
  };

  const handleTokenInput = (token: string) => {
    const upperToken = token.toUpperCase();

    // 1. If agent signs "NO" (Thumbs down) while a sentence is pending, cancel/abort!
    if (upperToken.includes('NO') && autoSpeakTimerRef.current) {
      clearPendingSentence();
      return;
    }

    // 2. If agent signs "YES" (Thumbs up) while a sentence is already formed, trigger speak immediately!
    if ((upperToken.includes('YES') || upperToken.includes('OK')) && composedSentence) {
      commitAndSpeakSentence();
      return;
    }

    // 3. Accumulate signed tokens (keep up to 3 recent tokens)
    const newTokens = [...signedTokensRef.current.slice(-2), upperToken];
    signedTokensRef.current = newTokens;
    setSignedTokens(newTokens);

    // 4. Retrieve context: last caller question & current scenario
    const callerMessages = transcriptsRef.current.filter((t) => t.sender === 'caller');
    const lastCaller = callerMessages.length > 0 ? callerMessages[callerMessages.length - 1].text : '';
    const scenarioId = PRESET_SCENARIOS[currentScenarioIndexRef.current].id;
    const step = scenarioStepRef.current;

    // 5. Instantly provide initial NLP synthesis so UI has zero delay
    const initialResult = composeContextualSentence(newTokens, scenarioId, step, lastCaller);
    setComposedSentence(initialResult.sentence);

    // 6. Asynchronously invoke selected AI Provider (Claude, Gemini, OpenAI, etc.)
    setIsComposingWithAi(true);
    fetch('/api/telephony/compose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tokens: newTokens,
        scenarioId,
        dialogueStep: step,
        callerMessage: lastCaller,
        customConfig: aiConfigRef.current,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.sentence && data.sentence.trim()) {
          setComposedSentence(data.sentence.trim());
          setComposerSource(data.model || 'Google Gemini 1.5');
        }
      })
      .catch((err) => {
        console.warn('[AI Model] Call error, maintained local result:', err);
      })
      .finally(() => {
        setIsComposingWithAi(false);
      });

    // 7. Handle auto-speak: Ultra-fast 700ms trigger matching the responsive meeting room speed
    if (autoSpeakTimerRef.current) clearTimeout(autoSpeakTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    if (autoSpeakEnabled) {
      setAutoSpeakCountdown(1);

      autoSpeakTimerRef.current = setTimeout(() => {
        setAutoSpeakCountdown(null);
        commitAndSpeakSentence();
      }, 700);
    }
  };

  useEffect(() => {
    handleTokenInputRef.current = handleTokenInput;
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 bg-grid-lines text-slate-900 font-sans selection:bg-orange-500/20 selection:text-orange-600">
      <Navbar />

      <AuthGuard featureName="Voice Telecom Relay">
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-28 pb-12 sm:pt-32 flex flex-col gap-6">
        
        {/* Top Header Card — Clean Original Brand Style */}
        <section className="gsap-text-reveal bg-white rounded-3xl border border-slate-200/80 shadow-xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center font-black shadow-xs shrink-0">
              <Headphones className="w-7 h-7 text-orange-500" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-600 font-extrabold text-[11px] uppercase tracking-wider">
                  <Activity className="w-3.5 h-3.5 text-orange-500" />
                  Inclusive Voice Relay &bull; Daily &amp; Enterprise
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Telecom Trunk Active
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1.5 font-heading">
                Voice Telecom &amp; Daily Relay
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 flex items-center gap-3 flex-wrap">
                <span>DID: <strong className="text-slate-900 font-mono">080-472-91039</strong></span>
                <span>•</span>
                <span>Bridge: <strong className="text-slate-900 font-mono">+91 95138 86363</strong></span>
                <span>•</span>
                <span>Account: <strong className="text-slate-700">smvitm4</strong></span>
                <span>•</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-mono font-semibold">
                  <span>Balance: <strong className="text-slate-900">{credits} Cr</strong></span>
                  <button
                    onClick={() => openRechargeModal()}
                    className="ml-1 px-1.5 py-0.2 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-[9px] font-sans font-bold cursor-pointer transition"
                  >
                    + Top-Up
                  </button>
                </span>
              </p>
            </div>
          </div>

          {/* Quick Scenario Evaluator Selector */}
          <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full px-4 py-2">
              <Building2 className="w-4 h-4 text-orange-500 shrink-0" />
              <select
                value={currentScenarioIndex}
                onChange={(e) => {
                  const idx = Number(e.target.value);
                  setCurrentScenarioIndex(idx);
                  if (callStatus === 'idle') {
                    setActiveCaller({
                      name: PRESET_SCENARIOS[idx].callerName,
                      number: PRESET_SCENARIOS[idx].callerNumber
                    });
                  }
                }}
                className="bg-transparent text-xs text-slate-800 font-bold focus:outline-none cursor-pointer"
              >
                {PRESET_SCENARIOS.map((sc, i) => (
                  <option key={sc.id} value={i} className="bg-white text-slate-900">
                    {sc.title}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => handleStartSimulatedCall(PRESET_SCENARIOS[currentScenarioIndex])}
              disabled={callStatus !== 'idle'}
              className="flex items-center gap-2 px-6 py-3 rounded-full text-xs font-bold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white transition shadow-md shadow-orange-500/25 cursor-pointer shrink-0"
            >
              <PhoneIncoming className="w-4 h-4" />
              <span>Simulate Call</span>
            </button>
          </div>
        </section>

        {/* Incoming Call Ringing Banner */}
        {callStatus === 'ringing' && (
          <div className="bg-gradient-to-r from-orange-50 via-white to-amber-50 border-2 border-orange-400 rounded-3xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-lg animate-bounce shrink-0">
                <PhoneIncoming className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider font-extrabold text-orange-600">
                  Incoming Telecom Call
                </span>
                <h3 className="text-xl font-black text-slate-900">
                  {activeCaller.name} <span className="text-slate-500 text-sm font-normal">({activeCaller.number})</span>
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Routed via Exotel Gateway • {PRESET_SCENARIOS[currentScenarioIndex].category}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleEndCall}
                className="px-6 py-3 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                Decline
              </button>
              <button
                onClick={handleAnswerCall}
                className="flex items-center gap-2 px-7 py-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/30 cursor-pointer"
              >
                <PhoneCall className="w-4 h-4" />
                <span>Accept Call</span>
              </button>
            </div>
          </div>
        )}

        {/* Main 2-Column Split Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left Column: Live Audio Subtitle Teleprompter (7 Cols) */}
          <div className="gsap-from-left lg:col-span-7 flex flex-col gap-4">
            
            {/* Active Call Status Bar */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full shrink-0 ${
                  callStatus === 'connected' ? 'bg-emerald-500 animate-pulse' :
                  callStatus === 'ringing' ? 'bg-amber-500 animate-ping' : 'bg-emerald-400'
                }`} />
                <div>
                  <h4 className="text-xs font-extrabold text-slate-900">
                    {callStatus === 'connected' ? `Active Call: ${activeCaller.name}` :
                     callStatus === 'ringing' ? 'Call Ringing...' : 'Sign Relay Ready (Practice & Daily Mode)'}
                  </h4>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {callStatus === 'connected' 
                      ? `Duration: ${formatTime(callDuration)} • Live Trunk Audio Connected` 
                      : 'Camera is active • Sign or fingerspell to formulate speech'}
                  </p>
                </div>
              </div>

              {callStatus === 'connected' ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleMic}
                    title="Toggle Local Mic Transcription"
                    className={`p-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                      micListening 
                        ? 'bg-red-50 text-red-600 border-red-200' 
                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:text-slate-900'
                    }`}
                  >
                    {micListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={handleEndCall}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                  >
                    <PhoneOff className="w-3.5 h-3.5" />
                    <span>Hang Up</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleStartSimulatedCall(PRESET_SCENARIOS[currentScenarioIndex])}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  <PhoneIncoming className="w-3.5 h-3.5" />
                  <span>Start Call</span>
                </button>
              )}
            </div>

            {/* High-Legibility Subtitle Feed */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl flex flex-col h-[440px] sm:h-[520px] overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-orange-500" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                    Live Teleprompter • Customer Speech
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">
                  Deepgram ASR (Real-Time)
                </span>
              </div>

              {/* Transcript Chat Stream */}
              <div 
                ref={transcriptContainerRef}
                className="flex-1 p-6 overflow-y-auto space-y-4 font-sans max-h-[480px] scroll-smooth"
              >
                {transcripts.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-8">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                      <Headphones className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-sm font-bold text-slate-700">Helpline is Online &amp; Waiting</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm">
                      When someone calls your number or you click &quot;Simulate Call&quot;, incoming speech will transcribe here in real-time.
                    </p>
                  </div>
                ) : (
                  <>
                    {transcripts.map((t) => (
                      <div
                        key={t.id}
                        className={`flex flex-col ${t.sender === 'caller' ? 'items-start' : 'items-end'}`}
                      >
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 mb-1 px-1 font-mono">
                          <span className="font-bold text-slate-700">
                            {t.sender === 'caller' ? `Customer (${activeCaller.name})` : 'You (Deaf Executive)'}
                          </span>
                          <span>•</span>
                          <span>{t.timestamp}</span>
                          {t.gesture && (
                            <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200 text-[9px] font-bold">
                              ISL: {t.gesture}
                            </span>
                          )}
                        </div>

                        <div
                          className={`max-w-[85%] rounded-2xl px-5 py-3.5 shadow-sm leading-relaxed ${
                            t.sender === 'caller'
                              ? 'bg-slate-100 border border-slate-200/80 text-slate-900 text-lg font-bold'
                              : 'bg-orange-500 text-white rounded-br-none text-base font-semibold shadow-md shadow-orange-500/20'
                          }`}
                        >
                          {t.text}
                        </div>
                      </div>
                    ))}

                    {/* Turn-Taking Cue: Tell Deaf User when it is their turn to reply */}
                    {callStatus === 'connected' && transcripts.length > 0 && transcripts[transcripts.length - 1].sender === 'caller' && (
                      <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 text-xs font-bold animate-pulse shadow-xs self-start my-2">
                        <Hand className="w-4 h-4 text-amber-600 animate-bounce" />
                        <span>Your turn to reply! Sign into the camera or tap a quick reply below.</span>
                      </div>
                    )}
                  </>
                )}
                <div ref={transcriptEndRef} />
              </div>

              {/* Status Footer */}
              <div className="px-6 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 font-mono">
                <span className="flex items-center gap-2">
                  <Volume2 className={`w-4 h-4 ${isSpeaking ? 'text-orange-500 animate-pulse' : 'text-slate-400'}`} />
                  <span>{isSpeaking ? 'Transmitting synthetic voice to caller phone...' : 'Audio downlink idle'}</span>
                </span>
                <span className="text-[11px] text-slate-500">
                  Instant Speech Engine (&lt;50ms latency)
                </span>
              </div>
            </div>

          </div>

          {/* Right Column: Deaf Executive Response Studio (5 Cols) */}
          <div className="gsap-from-right lg:col-span-5 flex flex-col gap-4">
            
            {/* Webcam ISL Gesture Capture Box */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Hand className="w-4 h-4 text-orange-500" />
                  <span className="text-xs font-bold text-slate-800">
                    Camera &bull; ISL Sign &amp; Spelling Tracker
                  </span>
                </div>

                {/* Recognition Mode Selector */}
                <div className="flex items-center gap-1 bg-white border border-slate-200 p-0.5 rounded-full shadow-xs">
                  <button
                    onClick={() => handleModeChange('hybrid')}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition cursor-pointer ${
                      recognitionMode === 'hybrid'
                        ? 'bg-orange-500 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Auto-Hybrid
                  </button>
                  <button
                    onClick={() => handleModeChange('word')}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition cursor-pointer ${
                      recognitionMode === 'word'
                        ? 'bg-orange-500 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Words
                  </button>
                  <button
                    onClick={() => handleModeChange('fingerspell')}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition cursor-pointer ${
                      recognitionMode === 'fingerspell'
                        ? 'bg-orange-500 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    A-Z Spell
                  </button>
                </div>

                <button
                  onClick={() => setCameraActive(!cameraActive)}
                  className="text-xs text-slate-500 hover:text-slate-900 transition cursor-pointer"
                >
                  {cameraActive ? <Video className="w-4 h-4 text-emerald-600" /> : <VideoOff className="w-4 h-4 text-slate-400" />}
                </button>
              </div>

              <div className="relative aspect-video bg-slate-950 flex items-center justify-center overflow-hidden">
                {cameraActive ? (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover transform scale-x-[-1]"
                    />
                    <canvas
                      ref={canvasRef}
                      width={640}
                      height={480}
                      className="absolute inset-0 w-full h-full pointer-events-none z-10 scale-x-[-1] object-cover"
                    />
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-500 gap-2">
                    <VideoOff className="w-8 h-8" />
                    <span className="text-xs font-medium">Camera Inactive</span>
                  </div>
                )}

                {/* Gesture Overlay HUD */}
                <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md border border-slate-200 rounded-full px-3.5 py-1.5 flex items-center gap-2 shadow-lg z-20">
                  <span className={`w-2.5 h-2.5 rounded-full ${detectedGesture ? 'bg-emerald-500 animate-pulse' : 'bg-orange-500 animate-ping'} inline-block`} />
                  <span className="text-xs font-bold text-slate-900">
                    {detectedGesture
                      ? callStatus === 'connected'
                        ? `Sign: ${detectedGesture}`
                        : `Sign: ${detectedGesture} (Start call to transmit)`
                      : handsDetected > 0
                        ? 'Analyzing hand kinematics...'
                        : 'Position hands in view'}
                  </span>
                  {holdProgress > 0 && holdProgress < 1 && (
                    <span className="text-[10px] font-mono font-bold text-orange-600 bg-orange-100 rounded-full px-2 py-0.5">
                      {Math.round(holdProgress * 100)}%
                    </span>
                  )}
                </div>
              </div>

              {/* Fingerspelling Live Letter Accumulator Dock */}
              {(recognitionMode === 'fingerspell' || recognitionMode === 'hybrid' || spelledLetters.length > 0) && (
                <div className="p-3 bg-amber-50/80 border-t border-amber-200/90 flex items-center justify-between gap-3 animate-in fade-in duration-200 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] uppercase font-bold text-amber-900 tracking-wider flex items-center gap-1">
                      <Type className="w-3.5 h-3.5 text-amber-800" />
                      <span>Spelled Word:</span>
                    </span>
                    {spelledLetters.length > 0 ? (
                      <div className="flex items-center gap-1">
                        {spelledLetters.map((l, i) => (
                          <span
                            key={i}
                            className="w-6 h-6 rounded-md bg-white border border-amber-300 text-amber-950 font-black text-xs flex items-center justify-center shadow-xs"
                          >
                            {l}
                          </span>
                        ))}
                        <span className="text-xs font-black text-slate-900 ml-1.5">
                          ({spelledLetters.join('')})
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-amber-800/80 italic font-medium">
                        Sign letters (A-Z) in camera to spell names or words...
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={backspaceSpelledLetter}
                      disabled={spelledLetters.length === 0}
                      title="Backspace"
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100 border border-amber-300 text-[10px] font-bold text-amber-900 transition disabled:opacity-40 cursor-pointer shadow-xs"
                    >
                      Del
                    </button>
                    <button
                      onClick={clearSpelledLetters}
                      disabled={spelledLetters.length === 0}
                      title="Clear letters"
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100 border border-amber-300 text-[10px] font-bold text-amber-900 transition disabled:opacity-40 cursor-pointer shadow-xs"
                    >
                      Clear
                    </button>
                    <button
                      onClick={completeSpelledWord}
                      disabled={spelledLetters.length === 0}
                      className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-extrabold transition shadow-xs disabled:opacity-40 cursor-pointer"
                    >
                      Add Word
                    </button>
                  </div>
                </div>
              )}

              {/* Fast Sign Action Triggers (Core Daily Communication) */}
              <div className="p-3 bg-slate-50/80 border-t border-slate-100 grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {[
                  { sign: 'HELLO', label: 'Hello' },
                  { sign: 'HOW ARE YOU', label: 'How Are You' },
                  { sign: 'PLEASE WAIT', label: 'Wait' },
                  { sign: 'THANK YOU', label: 'Thank You' },
                  { sign: 'FOOD', label: 'Food / Eat' },
                  { sign: 'YES', label: 'Yes / Good' }
                ].map((item) => (
                  <button
                    key={item.sign}
                    onClick={() => {
                      setDetectedGesture(item.sign);
                      handleTokenInput(item.sign);
                    }}
                    disabled={callStatus !== 'connected'}
                    className="p-1.5 rounded-xl bg-white hover:bg-orange-50 border border-slate-200 hover:border-orange-300 text-center transition cursor-pointer shadow-xs group disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <div className="text-[9px] text-slate-500 font-bold group-hover:text-slate-700 truncate">{item.label}</div>
                    <div className="text-[10px] font-bold text-orange-600 mt-0.5">
                      {callStatus === 'connected' ? 'Sign' : 'Standby'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* AI Sentence Composer Deck (Contextual Sign-to-Fluent-Speech) */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl p-5 flex flex-col gap-3.5 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center shadow-xs">
                    <Cpu className="w-4 h-4 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5 flex-wrap">
                      <span>AI Sentence Composer</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-200 flex items-center gap-1">
                        <Activity className={`w-3 h-3 text-orange-500 ${isComposingWithAi ? 'animate-pulse' : ''}`} />
                        <span>{isComposingWithAi ? `${aiConfig.provider.toUpperCase()} AI Synthesizing...` : composerSource}</span>
                      </span>
                    </h3>
                    <p className="text-[10px] text-slate-500">
                      Live generative translation from ISL signs into human speech
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setTempConfig(aiConfig);
                      setTestStatus(null);
                      setShowConfigModal(true);
                    }}
                    title="Configure AI Model & Custom API Key"
                    className="p-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-orange-50 hover:border-orange-300 text-slate-600 hover:text-orange-600 transition shadow-xs flex items-center gap-1 cursor-pointer text-[11px] font-bold"
                  >
                    <Settings className="w-3.5 h-3.5 text-orange-500" />
                    <span className="hidden sm:inline">AI Settings</span>
                  </button>

                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoSpeakEnabled}
                      onChange={(e) => setAutoSpeakEnabled(e.target.checked)}
                      className="rounded accent-orange-500 cursor-pointer w-3.5 h-3.5"
                    />
                    <span>Auto-Speak</span>
                  </label>
                </div>
              </div>

              {/* Formed Sentence Preview Box */}
              <div className="rounded-2xl bg-slate-50 border border-slate-200/90 p-3.5 min-h-[95px] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                      Detected Signs &bull; {signedTokens.length > 0 ? `${signedTokens.length} Gestures` : 'Ready'}
                    </span>
                    {signedTokens.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {signedTokens.map((t, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[10px] font-extrabold border border-orange-200 shadow-xs flex items-center gap-1"
                          >
                            <Hand className="w-3 h-3 text-orange-600 shrink-0" />
                            <span>{t}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {composedSentence ? (
                    <p className="text-sm font-bold text-slate-900 leading-snug">
                      &ldquo;{composedSentence}&rdquo;
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 italic">
                      {callStatus === 'connected'
                        ? 'Perform a sign (e.g. WAIT, HELLO, YES, HELP, THANK YOU). AI will automatically compose a polite sentence based on what the caller said.'
                        : 'Connect call to compose contextual sentences.'}
                    </p>
                  )}
                </div>

                {/* Auto-Speak Countdown & Action Controls */}
                {composedSentence && (
                  <div className="mt-3 pt-2.5 border-t border-slate-200/70 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {autoSpeakCountdown !== null && (
                        <span className="text-[11px] font-bold text-orange-600 animate-pulse flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Transmitting in {autoSpeakCountdown}s...</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={clearPendingSentence}
                        className="px-3 py-1.5 rounded-full text-[11px] font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition cursor-pointer"
                      >
                        Cancel
                      </button>

                      <button
                        onClick={() => commitAndSpeakSentence()}
                        disabled={callStatus !== 'connected'}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Speak Now</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Contextual Smart Macros Deck */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl p-5 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3.5">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-orange-500" />
                    <h3 className="text-xs font-extrabold text-slate-900">
                      Suggested Canned Responses
                    </h3>
                  </div>
                  <span className="text-[10px] text-slate-600 font-mono bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                    Instant Voice
                  </span>
                </div>

                <div className="space-y-2">
                  {PRESET_SCENARIOS[currentScenarioIndex].suggestedReplies.map((reply, i) => (
                    <button
                      key={i}
                      onClick={() => handleAgentSpeak(reply)}
                      disabled={callStatus !== 'connected'}
                      className="w-full text-left p-3.5 rounded-2xl bg-slate-50 hover:bg-orange-50/70 border border-slate-200/80 hover:border-orange-300 text-xs text-slate-800 transition group disabled:opacity-40 cursor-pointer"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-lg bg-white border border-slate-200 group-hover:border-orange-300 text-slate-600 group-hover:text-orange-600 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5 shadow-xs">
                          {i + 1}
                        </span>
                        <span className="leading-relaxed font-medium">{reply}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Type-to-Speak Text Field */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!agentInputText.trim()) return;
                  handleAgentSpeak(agentInputText.trim());
                }}
                className="mt-4 pt-4 border-t border-slate-100 flex gap-2"
              >
                <input
                  type="text"
                  value={agentInputText}
                  onChange={(e) => setAgentInputText(e.target.value)}
                  placeholder={callStatus === 'connected' ? 'Type custom message to speak into call...' : 'Connect call to type...'}
                  disabled={callStatus !== 'connected'}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 transition disabled:opacity-40"
                />
                <button
                  type="submit"
                  disabled={callStatus !== 'connected' || !agentInputText.trim()}
                  className="px-6 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-md cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 text-orange-400" />
                  <span>Speak</span>
                </button>
              </form>
            </div>

          </div>

        </div>

      </main>
      </AuthGuard>

      {/* Client AI Provider & Model Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center shadow-xs">
                  <Key className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    AI Model &amp; Custom API Key
                  </h3>
                  <p className="text-xs text-slate-500">
                    Connect your own Claude, Gemini, OpenAI, or Groq account
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Provider Selection Tabs */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Select AI Provider</label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {[
                  { id: 'gemini', name: 'Gemini', badge: 'Google' },
                  { id: 'claude', name: 'Claude', badge: 'Anthropic' },
                  { id: 'openai', name: 'OpenAI', badge: 'GPT-4o' },
                  { id: 'groq', name: 'Groq', badge: 'Fast Llama' },
                  { id: 'openrouter', name: 'OpenRouter', badge: 'Multi' }
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      const newProvider = p.id as AIProvider;
                      const models = PROVIDER_MODELS[newProvider];
                      setTempConfig({
                        ...tempConfig,
                        provider: newProvider,
                        model: models[0]?.id || '',
                      });
                      setTestStatus(null);
                    }}
                    className={`p-2.5 rounded-2xl border text-center transition cursor-pointer flex flex-col items-center justify-center ${
                      tempConfig.provider === p.id
                        ? 'bg-orange-50/80 border-orange-400 text-orange-950 font-black shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold'
                    }`}
                  >
                    <span className="text-xs font-black">{p.name}</span>
                    <span className="text-[9px] text-slate-500 mt-0.5">{p.badge}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Model Selection: Free-Form Input + Quick Preset Pills */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">
                  Model Identifier ({tempConfig.provider.toUpperCase()})
                </label>
                <span className="text-[10px] text-slate-400">Type any model or pick a preset</span>
              </div>
              <input
                type="text"
                value={tempConfig.model}
                onChange={(e) => {
                  setTempConfig({ ...tempConfig, model: e.target.value });
                  setTestStatus(null);
                  setTestSynthesisStatus(null);
                }}
                placeholder="e.g. claude-3-7-sonnet-20250219 or gpt-4o"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 font-mono font-bold focus:outline-none focus:border-orange-500 shadow-inner"
              />
              {/* Quick Preset Pills */}
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span className="text-[10px] font-semibold text-slate-400">Presets:</span>
                {PROVIDER_MODELS[tempConfig.provider]?.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setTempConfig({ ...tempConfig, model: m.id });
                      setTestStatus(null);
                      setTestSynthesisStatus(null);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                      tempConfig.model === m.id
                        ? 'bg-orange-500 text-white border-orange-500 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300 hover:bg-orange-50/50'
                    }`}
                  >
                    {m.shortName || m.id}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom API Key Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">
                  {tempConfig.provider.toUpperCase()} API Key
                </label>
                <span className="text-[10px] text-slate-400">Stored safely in browser localStorage</span>
              </div>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={tempConfig.apiKey}
                  onChange={(e) => {
                    setTempConfig({ ...tempConfig, apiKey: e.target.value });
                    setTestStatus(null);
                    setTestSynthesisStatus(null);
                  }}
                  placeholder={
                    tempConfig.provider === 'claude'
                      ? 'sk-ant-api03-...'
                      : tempConfig.provider === 'openai'
                        ? 'sk-proj-...'
                        : tempConfig.provider === 'groq'
                          ? 'gsk_...'
                          : tempConfig.provider === 'openrouter'
                            ? 'sk-or-v1-...'
                            : 'AIzaSy... (or leave blank to use default key)'
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 pr-10 text-xs text-slate-900 font-mono placeholder-slate-400 focus:outline-none focus:border-orange-500"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Leave empty to use Sanket AI&apos;s pre-configured cloud API key.
              </p>
            </div>

            {/* Advanced Endpoint / Proxy Option */}
            <div className="border border-slate-100 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between px-3.5 py-2 text-[11px] font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 transition cursor-pointer"
              >
                <span>Advanced: Custom API Endpoint / Proxy (Optional)</span>
                {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {showAdvanced && (
                <div className="p-3 bg-white border-t border-slate-100 space-y-1">
                  <input
                    type="text"
                    value={tempConfig.customBaseUrl || ''}
                    onChange={(e) => setTempConfig({ ...tempConfig, customBaseUrl: e.target.value })}
                    placeholder="https://your-custom-proxy.com/v1"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-500"
                  />
                  <p className="text-[10px] text-slate-400">
                    Useful for enterprise gateways, LiteLLM, or custom proxies.
                  </p>
                </div>
              )}
            </div>

            {/* Test Results Display */}
            {testStatus && (
              <div
                className={`p-3 rounded-2xl border text-xs flex items-start gap-2.5 animate-in fade-in duration-150 ${
                  testStatus.loading
                    ? 'bg-slate-50 border-slate-200 text-slate-700'
                    : testStatus.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {testStatus.loading ? (
                  <RotateCcw className="w-4 h-4 text-orange-500 animate-spin shrink-0 mt-0.5" />
                ) : testStatus.success ? (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-bold">
                    {testStatus.loading
                      ? `Testing handshake with ${tempConfig.provider.toUpperCase()}...`
                      : testStatus.success
                        ? 'Connection Verified!'
                        : 'Connection Test Failed'}
                  </p>
                  {testStatus.message && (
                    <p className="text-[11px] mt-0.5 opacity-90">{testStatus.message}</p>
                  )}
                </div>
              </div>
            )}

            {/* Test Synthesis Result Box */}
            {testSynthesisStatus && (
              <div
                className={`p-3 rounded-2xl border text-xs flex items-start gap-2.5 animate-in fade-in duration-150 ${
                  testSynthesisStatus.loading
                    ? 'bg-slate-50 border-slate-200 text-slate-700'
                    : testSynthesisStatus.success
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-900'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {testSynthesisStatus.loading ? (
                  <RotateCcw className="w-4 h-4 text-indigo-500 animate-spin shrink-0 mt-0.5" />
                ) : testSynthesisStatus.success ? (
                  <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-bold">
                    {testSynthesisStatus.loading
                      ? `Synthesizing sample sign with ${tempConfig.model}...`
                      : testSynthesisStatus.success
                        ? 'Sample Sign-to-Speech Test'
                        : 'Synthesis Test Failed'}
                  </p>
                  {testSynthesisStatus.sentence && (
                    <div className="mt-1 p-2 bg-white/80 rounded-xl border border-indigo-100 font-medium text-slate-800 text-[11px]">
                      &ldquo;{testSynthesisStatus.sentence}&rdquo;
                    </div>
                  )}
                  {testSynthesisStatus.message && (
                    <p className="text-[10px] mt-1 opacity-80">{testSynthesisStatus.message}</p>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2.5 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testStatus?.loading || testSynthesisStatus?.loading}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold transition cursor-pointer shadow-xs disabled:opacity-50"
                  title="Verify API key handshake and measure ping latency"
                >
                  <Zap className="w-3.5 h-3.5 text-orange-500" />
                  <span>Test Connection</span>
                </button>

                <button
                  type="button"
                  onClick={handleTestSynthesis}
                  disabled={testStatus?.loading || testSynthesisStatus?.loading}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition cursor-pointer shadow-xs disabled:opacity-50"
                  title="Test actual sign-to-sentence formation with the selected model"
                >
                  <Wand2 className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Test Synthesis</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetToDefaultConfig}
                  className="px-3.5 py-2 rounded-full text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                >
                  Reset Default
                </button>
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  className="px-5 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-md cursor-pointer"
                >
                  Save &amp; Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
