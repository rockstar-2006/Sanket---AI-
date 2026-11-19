'use client';
// Sanket AI Accessible Teleconference & Meeting Room - v2.4

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Holographic3DSkeleton, createNeutralPoseLandmarks } from '@/lib/holographic3DSkeleton';
import { generateFingerspellFrames, ISL_LETTER_DESCRIPTIONS } from '@/lib/fingerspellingEngine';
import { generateISLGestureFrames } from '@/lib/islGestureEngine';
import {
  LandmarkMotionSmoother,
  generateSmoothBridge,
  FrameLandmarks,
} from '@/lib/motionSmoothing';
import { ChoreographedSignAction, SpeechToSignPipelineResult } from '@/lib/agents/speechToSignAgent';
import {
  VOCABULARY_262,
  ISL_EXCLUDED_STOPWORDS,
  COMPOUND_PHRASE_MAP,
  CONCEPTUAL_LEMMATIZATION_MAP,
} from '@/lib/agents/translatorAgent';
import nextDynamic from 'next/dynamic';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/context/AuthContext';
import { useWallet } from '@/context/WalletContext';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { normalizeRoomCode } from '@/types';
import { saveMeetingNotes, endMeetingSession } from '@/lib/firebase/services';
import { SignEmoji3DViewer, SIGN_EMOJIS_LIST, SignEmojiDef } from '@/components/emojis/SignEmoji3DViewer';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Sparkles,
  Copy,
  Check,
  Clock,
  Users,
  Volume2,
  Sliders,
  Send,
  Radio,
  Layers,
  MessageSquare,
  HandMetal,
  X,
  ScreenShare,
  ScreenShareOff,
  Hand,
  Smile,
  RotateCcw,
  Share2,
  LayoutGrid,
  Monitor,
  Maximize2,
  Minimize2,
  User,
  Trash2,
  Play,
  VolumeX,
  Eye,
  EyeOff,
  ChevronRight,
  BookOpen,
  Search,
  ArrowRight,
  Briefcase,
  GraduationCap,
  HeartHandshake,
  Stethoscope,
  CheckCircle2,
  Activity,
  FileText,
  Printer,
  Download,
  Target,
  ShieldCheck,
  AlertTriangle,
  QrCode,
  Info,
  Zap,
} from 'lucide-react';
import { QrInviteModal } from '@/components/meeting/QrInviteModal';
import {
  ISLCameraRecognizerEngine,
  DetectedSignCandidate,
  RecognitionFrameUpdate,
  SwitchSignId,
  AVAILABLE_SWITCH_SIGNS,
  FramingStatus,
} from '@/lib/islCameraRecognizer';
import { ISLOnnxRecognizer } from '@/lib/islOnnxRecognizer';
import { createVirtualCameraStream, VirtualStreamController } from '@/lib/virtualCameraStream';

const AvatarModel = nextDynamic(
  () => import('@/components/meeting/AvatarModel').then((m) => m.AvatarModel),
  { ssr: false }
);

interface InCallChatMessage {
  id: string;
  sender: string;
  role: string;
  text: string;
  time: string;
  isSelf: boolean;
  isSigned?: boolean;
}

interface BufferedSignItem {
  id: string;
  token: string;
  type: 'letter' | 'gesture' | 'word';
  displayLabel?: string;
  timestamp: number;
}

export interface MeetingNoteEntry {
  id: string;
  timestamp: string;
  speaker: string;
  role: 'hearing_speaker' | 'deaf_signer';
  sourceType: 'speech' | 'sign' | 'fingerspell';
  originalContent: string;
  translatedContent: string;
  category?: 'general' | 'medical' | 'prescription' | 'action_item' | 'question';
}

function categorizeMeetingEntry(text: string, role: string): 'general' | 'medical' | 'prescription' | 'action_item' | 'question' {
  const lower = (text || '').toLowerCase();
  if (/\b(mg|tablet|tablets|syrup|capsule|capsules|dosage|dose|take|daily|twice|thrice|prescription|rx|paracetamol|antibiotic|drops|medicine|medication)\b/.test(lower)) {
    return 'prescription';
  }
  if (/\b(pain|fever|headache|cough|cold|infection|doctor|hospital|clinic|treatment|symptom|blood|bp|pulse|report|test|heart|scan|allergy|illness|disease)\b/.test(lower)) {
    return 'medical';
  }
  if (/\b(will|must|should|action|follow up|schedule|appointment|tomorrow|next week|send|submit|check|review)\b/.test(lower)) {
    return 'action_item';
  }
  if (lower.includes('?') || /\b(what|where|when|why|how|who|which)\b/.test(lower)) {
    return 'question';
  }
  return 'general';
}

const COMMON_CONVERSATIONAL_WORDS = [
  'doctor', 'hospital', 'medicine', 'patient', 'nurse', 'emergency',
  'treatment', 'pain', 'fever', 'headache', 'cold', 'cough', 'clinic',
  'pharmacy', 'health', 'heart', 'blood', 'test', 'report',
  'thank you', 'thanks', 'namaste', 'hello', 'good morning', 'good evening',
  'how are you', 'welcome', 'please', 'help', 'family', 'friend', 'water',
  'food', 'appointment', 'tomorrow', 'today', 'yesterday', 'problem', 'ready',
];

export interface PredictiveContext {
  userName?: string;
  userRole?: string;
  lastQuestionPrompt?: string;
  meetingContext?: string;
  customWords?: string[];
}

function predictWordsFromLetters(
  letters: string[],
  maxSuggestions = 4,
  customWordsOrContext: string[] | PredictiveContext = []
): string[] {
  if (!letters || letters.length === 0) return [];
  const prefix = letters.join('').toLowerCase().trim();
  if (!prefix) return [];

  let customWords: string[] = [];
  let userName = '';
  let lastQuestion = '';

  if (Array.isArray(customWordsOrContext)) {
    customWords = customWordsOrContext;
  } else if (customWordsOrContext && typeof customWordsOrContext === 'object') {
    customWords = customWordsOrContext.customWords || [];
    userName = customWordsOrContext.userName || '';
    lastQuestion = customWordsOrContext.lastQuestionPrompt || '';
  }

  const seen = new Set<string>();
  const exactPrefixMatches: string[] = [];
  const containsMatches: string[] = [];

  // 1. ChatGPT-Style Conversational Entity Expansion:
  // Detect intent of the remote participant's last speech / question
  const lowerQ = lastQuestion.toLowerCase();
  const isNameQuestion = /\b(name|who|call|introduce|naam|ur name|your name)\b/i.test(lowerQ);
  const isLocationQuestion = /\b(where|live|city|location|from|stay|address|kahan)\b/i.test(lowerQ);
  const isMedicalQuestion = /\b(medicine|tablet|fever|pain|cough|headache|doctor|symptom|illness|dawa)\b/i.test(lowerQ);
  const isWorkQuestion = /\b(work|job|profession|role|company|occupation|study|college|kaam)\b/i.test(lowerQ);

  const intentEntities: string[] = [];

  // A. User Identity / Proper Nouns (e.g. BHUSHAN POOJARY)
  if (userName) {
    const cleanUser = userName.trim().toUpperCase();
    if (cleanUser) {
      intentEntities.push(cleanUser); // Full multi-word entity
      cleanUser.split(/\s+/).forEach((part) => {
        if (part.length >= 2) intentEntities.push(part);
      });
    }
  }

  // B. Location / City Entities
  if (isLocationQuestion) {
    const CITIES = ['MANGALORE', 'BANGALORE', 'BENGALURU', 'MUMBAI', 'DELHI', 'CHENNAI', 'HYDERABAD', 'PUNE', 'KOLKATA', 'AHMEDABAD', 'JAIPUR', 'KARNATAKA', 'MAHARASHTRA', 'INDIA'];
    intentEntities.push(...CITIES);
  }

  // C. Medical / Health Entities
  if (isMedicalQuestion) {
    const MEDS = ['PARACETAMOL', 'CROCIN', 'AZITHROMYCIN', 'METFORMIN', 'AMOXICILLIN', 'PANTOCID', 'INSULIN', 'VITAMIN', 'COUGH SYRUP', 'FEVER', 'HEADACHE', 'STOMACH PAIN', 'BLOOD PRESSURE', 'DIABETES'];
    intentEntities.push(...MEDS);
  }

  // D. Profession Entities
  if (isWorkQuestion) {
    const JOBS = ['SOFTWARE ENGINEER', 'DEVELOPER', 'ENGINEER', 'STUDENT', 'DESIGNER', 'TEACHER', 'ANALYST', 'DOCTOR', 'NURSE', 'RESEARCHER'];
    intentEntities.push(...JOBS);
  }

  // Check intent entities first with highest ranking
  for (const entity of intentEntities) {
    const clean = entity.toLowerCase().trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);

    if (clean.startsWith(prefix) && clean !== prefix) {
      // If it answers the question directly (e.g. name question and matches BHUSHAN POOJARY), put it at the very front
      if (isNameQuestion && userName && clean.includes(userName.toLowerCase().trim())) {
        exactPrefixMatches.unshift(entity.toUpperCase());
      } else {
        exactPrefixMatches.push(entity.toUpperCase());
      }
    } else if (clean.includes(prefix) && clean !== prefix && prefix.length >= 2) {
      containsMatches.push(entity.toUpperCase());
    }
  }

  // 2. High Priority: Words from user biography and profile (e.g. BHUSHAN, POOJARY, FEVER)
  for (const cw of customWords) {
    const clean = cw.toLowerCase().trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);

    if (clean.startsWith(prefix) && clean !== prefix) {
      exactPrefixMatches.push(clean.toUpperCase());
    } else if (clean.includes(prefix) && clean !== prefix && prefix.length >= 2) {
      containsMatches.push(clean.toUpperCase());
    }
  }

  // 3. Conversational Dictionary & ISL 262 Dataset Vocabulary
  const vocabList = [
    ...COMMON_CONVERSATIONAL_WORDS,
    ...Array.from(VOCABULARY_262),
  ];

  for (const word of vocabList) {
    const clean = word.toLowerCase().trim();
    if (seen.has(clean)) continue;
    seen.add(clean);

    if (clean.startsWith(prefix) && clean !== prefix) {
      exactPrefixMatches.push(clean.toUpperCase());
    } else if (clean.includes(prefix) && clean !== prefix && prefix.length >= 2) {
      containsMatches.push(clean.toUpperCase());
    }
  }

  // Prioritize shortest, most direct matches (keeping top-ranked intent entity at index 0)
  const topIntent = exactPrefixMatches.length > 0 && isNameQuestion ? exactPrefixMatches[0] : null;
  const rest = topIntent ? exactPrefixMatches.slice(1) : exactPrefixMatches;
  rest.sort((a, b) => a.length - b.length);
  containsMatches.sort((a, b) => a.length - b.length);

  const finalMatches = topIntent ? [topIntent, ...rest] : rest;
  return [...finalMatches, ...containsMatches].slice(0, maxSuggestions);
}

const NEXT_WORD_SUGGESTIONS: Record<string, string[]> = {
  'I': ['BHUSHAN', 'DEAF', 'READY', 'FINE', 'DOCTOR', 'FEVER', 'HELP'],
  'ME': ['BHUSHAN', 'NAME', 'CALL', 'HELP', 'DOCTOR'],
  'MY': ['NAME', 'NAME BHUSHAN', 'DOCTOR', 'HEALTH', 'FAMILY'],
  'NAME': ['BHUSHAN', 'PLEASE'],
  'HELLO': ['HOW ARE YOU', 'GOOD MORNING', 'DOCTOR', 'PLEASE', 'HELP', 'THANK YOU', 'MEETING'],
  'GOOD MORNING': ['HOW ARE YOU', 'DOCTOR', 'FAMILY', 'FRIEND', 'THANK YOU'],
  'GOOD NIGHT': ['SEE YOU SOON', 'TAKE CARE', 'SLEEP', 'TOMORROW'],
  'GOOD': ['MORNING', 'NIGHT', 'AFTERNOON', 'DOCTOR', 'THANK YOU'],
  'HOW ARE YOU': ['TODAY', 'FEELING', 'FINE', 'DOCTOR', 'THANK YOU'],
  'THANK YOU': ['DOCTOR', 'VERY MUCH', 'HELP', 'GOODBYE'],
  'HELP': ['PLEASE', 'DOCTOR', 'EMERGENCY', 'MEDICINE', 'HOSPITAL'],
  'DOCTOR': ['HELP', 'FEVER', 'MEDICINE', 'HOSPITAL', 'PLEASE'],
  'PLEASE': ['HELP', 'WAIT', 'DOCTOR', 'COME', 'LISTEN', 'TIME'],
  'YES': ['THANK YOU', 'UNDERSTAND', 'AGREE', 'OK', 'MORNING', 'READY'],
  'NO': ['PROBLEM', 'FEVER', 'PAIN', 'WORRY'],
  'FOOD': ['WATER', 'PLEASE', 'MEDICINE'],
  'WATER': ['PLEASE', 'COLD', 'THANK YOU'],
  'WAIT': ['1 MINUTE', 'PLEASE', 'READY', 'TIME'],
  'PERFECT': ['THANK YOU', 'GREAT', 'VERY GOOD'],
  'TIME': ['PLEASE', 'MEETING', 'NOW', 'READY'],
  'MEETING': ['TODAY', 'TOMORROW', 'TIME', 'DOCTOR', 'READY'],
  'HOUSE': ['FAMILY', 'FRIEND', 'GO', 'PLEASE'],
  'CAR': ['FAST', 'GO', 'HOSPITAL', 'READY'],
  'BOOK': ['READ', 'PLEASE', 'THANK YOU'],
};

function getNextWordSuggestions(
  tokens: BufferedSignItem[],
  userName?: string,
  contextWords?: string[]
): string[] {
  const firstName = userName ? userName.trim().split(/\s+/)[0].toUpperCase() : 'BHUSHAN';
  const existingTokens = new Set(tokens.map((t) => t.token.toUpperCase().trim()));

  if (!tokens || tokens.length === 0) {
    const list = ['HELLO', firstName, 'DOCTOR', 'HELP'];
    if (contextWords && contextWords.length > 0) {
      list.push(...contextWords.slice(0, 3));
    }
    return Array.from(new Set(list));
  }

  const lastItem = tokens[tokens.length - 1];
  const upper = lastItem.token.toUpperCase().trim();
  const suggestions = [...(NEXT_WORD_SUGGESTIONS[upper] || ['THANK YOU', 'PLEASE', 'DOCTOR', 'HELP'])];
  if (['I', 'ME', 'MY', 'NAME', 'CALL'].includes(upper)) {
    if (!suggestions.includes(firstName)) {
      suggestions.unshift(firstName);
    }
  }
  if (contextWords && contextWords.length > 0) {
    contextWords.slice(0, 3).forEach((w) => {
      if (!suggestions.includes(w)) suggestions.push(w);
    });
  }

  // Strict anti-repetition: Filter out any suggestion that is already in the current sentence
  const filtered = suggestions.filter((s) => !existingTokens.has(s.toUpperCase().trim()));
  return filtered.length > 0 ? filtered : ['THANK YOU', 'PLEASE', 'DOCTOR', 'HELP'].filter((s) => !existingTokens.has(s));
}

// 10 Curated High-Frequency Conversational Presets for 1-Click Tests
const CURATED_PRESETS = [
  { label: 'Hello, how are you?', text: 'hello how are you' },
  { label: 'Physician in hospital', text: 'the physician is in the hospital' },
  { label: 'My name is Sanket', text: 'my name is sanket' },
  { label: 'Where is hospital?', text: 'where is the hospital' },
  { label: 'Fast automobile', text: 'fast automobile' },
  { label: 'Good morning family', text: 'good morning family' },
  { label: 'Meeting this afternoon', text: 'we have an important meeting this afternoon' },
  { label: 'Computer is fast', text: 'the computer is running fast' },
  { label: 'Bus full of crowd', text: 'the bus is full of crowd' },
  { label: 'Very happy today', text: 'i am very happy today' },
];

// 10 Curated High-Frequency Daily Conversation Shortcuts for Deaf Signer (1-Click Voice Speech)
const DAILY_QUICK_REACTIONS = [
  { label: 'Hello', tokens: ['HELLO'], spoken: 'Hello! Nice to see you.' },
  { label: 'I am here', tokens: ['I'], spoken: 'I am here.' },
  { label: 'Yes', tokens: ['YES'], spoken: 'Yes, absolutely.' },
  { label: 'No', tokens: ['NO'], spoken: 'No, not right now.' },
  { label: 'How are you?', tokens: ['HOW ARE YOU'], spoken: 'How are you doing today?' },
  { label: 'Thank you', tokens: ['THANK YOU'], spoken: 'Thank you so much.' },
  { label: 'Please wait', tokens: ['WAIT'], spoken: 'Please give me a moment.' },
  { label: 'Repeat', tokens: ['REPEAT'], spoken: 'Could you please repeat that?' },
  { label: 'Great', tokens: ['PERFECT'], spoken: 'That sounds great.' },
  { label: 'Need help', tokens: ['HELP'], spoken: 'Could you please help me?' },
  { label: 'Take break', tokens: ['WAIT', '1', 'MINUTE'], spoken: 'Let us take a quick one minute break.' },
  { label: 'Goodbye', tokens: ['SEE YOU SOON'], spoken: 'See you soon. Take care.' },
];

// Curated ISL Visual Posture Guide Items for Camera Signers
interface ISLSignGuideItem {
  token: string;
  displayLabel: string;
  category: 'Greetings' | 'Daily' | 'Medical' | 'Basics';
  actionSummary: string;
  detailedGuide: string;
  recommendedHand: 'Single Hand' | 'Both Hands';
  datasetWord?: string;
}

const ISL_SIGN_GUIDE_ITEMS: ISLSignGuideItem[] = [
  {
    token: 'GOOD MORNING',
    displayLabel: 'Good Morning',
    category: 'Greetings',
    actionSummary: 'Left arm flat at chest, right hand rises up like the morning sun.',
    detailedGuide: 'Hold your non-dominant forearm horizontally across your chest (representing the horizon). Place your dominant hand below it, then raise it upward with open fingers spread wide like the rising sun.',
    recommendedHand: 'Both Hands',
    datasetWord: 'goodmorning',
  },
  {
    token: 'GOOD NIGHT',
    displayLabel: 'Good Night',
    category: 'Greetings',
    actionSummary: 'Tilt your head and press flat hand(s) against your cheek like a pillow.',
    detailedGuide: 'Tilt your head slightly to the side and press your flat palm (or both palms pressed together) against your cheek/ear, mimicking resting on a pillow to sleep.',
    recommendedHand: 'Single Hand',
    datasetWord: 'goodnight',
  },
  {
    token: 'HELLO',
    displayLabel: 'Hello',
    category: 'Greetings',
    actionSummary: 'Flat open hand salute near forehead/eyebrow or friendly wave.',
    detailedGuide: 'Raise your open dominant hand to your forehead or temple level with fingers extended. Can be held horizontally across your brow (salute) or waved gently.',
    recommendedHand: 'Single Hand',
    datasetWord: 'hello',
  },
  {
    token: 'I',
    displayLabel: 'I / Me',
    category: 'Greetings',
    actionSummary: 'Point index finger at your chest, or rest flat palm over heart.',
    detailedGuide: 'Point your dominant index finger directly towards your chest/heart with other fingers curled (or rest your flat open palm over your heart). In ISL, this signifies "I", "Me", or self-reference.',
    recommendedHand: 'Single Hand',
    datasetWord: 'i',
  },
  {
    token: 'HOW ARE YOU',
    displayLabel: 'How Are You?',
    category: 'Greetings',
    actionSummary: 'Both hands open at chest level offering forward warmly.',
    detailedGuide: 'Hold both hands side-by-side in front of your chest with palms facing slightly upward and fingers open, moving gently forward in enquiry.',
    recommendedHand: 'Both Hands',
    datasetWord: 'howareyou',
  },
  {
    token: 'THANK YOU',
    displayLabel: 'Thank You',
    category: 'Greetings',
    actionSummary: 'Both palms in Namaste prayer, or flat hand extending from chin.',
    detailedGuide: 'Press both palms together in front of your chest (Namaste), or touch your flat fingers to your chin and extend them outward toward the camera.',
    recommendedHand: 'Both Hands',
    datasetWord: 'thankyou',
  },
  {
    token: 'HELP',
    displayLabel: 'Help',
    category: 'Medical',
    actionSummary: 'Closed fist placed directly on top of flat open palm.',
    detailedGuide: 'Hold your non-dominant hand flat at chest level with palm facing up. Form a fist with your dominant hand and place it firmly resting on top of the flat palm.',
    recommendedHand: 'Both Hands',
    datasetWord: 'help',
  },
  {
    token: 'DOCTOR',
    displayLabel: 'Doctor',
    category: 'Medical',
    actionSummary: 'Two fingers (index & middle) touching the opposite wrist pulse.',
    detailedGuide: 'Hold one arm out at chest height. Take the index and middle fingers of your other hand and place them against your inner wrist, as if feeling a pulse.',
    recommendedHand: 'Both Hands',
    datasetWord: 'doctor',
  },
  {
    token: 'PLEASE',
    displayLabel: 'Please',
    category: 'Daily',
    actionSummary: 'Flat palm resting against the center of the chest.',
    detailedGuide: 'Place your flat open hand directly over the center of your chest/sternum, with fingers pointing upward or slightly angled.',
    recommendedHand: 'Single Hand',
    datasetWord: 'please',
  },
  {
    token: 'WATER',
    displayLabel: 'Water',
    category: 'Daily',
    actionSummary: 'Form a "W" with 3 upright fingers held near your chin.',
    detailedGuide: 'Extend your index, middle, and ring fingers upright (forming the letter W) while tucking your pinky and thumb. Bring the index finger tip near your lower lip/chin.',
    recommendedHand: 'Single Hand',
    datasetWord: 'water',
  },
  {
    token: 'FOOD',
    displayLabel: 'Food / Eat',
    category: 'Daily',
    actionSummary: 'Fingertips clustered together and brought toward the mouth.',
    detailedGuide: 'Bunch all five fingertips together (thumb touching other 4 fingertips) and bring them close to your lips, mimicking putting food into your mouth.',
    recommendedHand: 'Single Hand',
    datasetWord: 'food',
  },
  {
    token: 'YES',
    displayLabel: 'Yes / Good',
    category: 'Basics',
    actionSummary: 'Closed fist with thumb pointing straight up.',
    detailedGuide: 'Make a clean fist with all four fingers curled tightly and your thumb pointing straight up in the classic thumbs-up posture.',
    recommendedHand: 'Single Hand',
    datasetWord: 'good',
  },
  {
    token: 'NO',
    displayLabel: 'No / Disagree',
    category: 'Basics',
    actionSummary: 'Closed fist with thumb pointing straight down.',
    detailedGuide: 'Make a fist with your thumb extended downwards toward the floor in the classic thumbs-down posture.',
    recommendedHand: 'Single Hand',
    datasetWord: 'bad',
  },
  {
    token: 'WAIT',
    displayLabel: 'Wait / Pause',
    category: 'Basics',
    actionSummary: 'Open flat palm facing forward at chest level.',
    detailedGuide: 'Raise one flat open hand with palm facing directly forward toward the camera, fingers spread or together.',
    recommendedHand: 'Single Hand',
    datasetWord: 'wait',
  },
  {
    token: 'TIME',
    displayLabel: 'Time / Clock',
    category: 'Daily',
    actionSummary: 'Index finger tapping opposite wrist where a watch is worn.',
    detailedGuide: 'Hold your non-dominant wrist out and tap its back 1-2 times with the index finger of your dominant hand, indicating a wristwatch.',
    recommendedHand: 'Both Hands',
    datasetWord: 'time',
  },
  {
    token: 'HOUSE',
    displayLabel: 'House / Home',
    category: 'Daily',
    actionSummary: 'Fingertips of both flat hands touching at an angle forming a roof /\\.',
    detailedGuide: 'Bring both flat hands together at chest height so that your fingertips touch at a peak angle, forming an inverted V roof shape.',
    recommendedHand: 'Both Hands',
    datasetWord: 'house',
  },
  {
    token: 'CAR',
    displayLabel: 'Car / Drive',
    category: 'Daily',
    actionSummary: 'Both hands in closed fists holding and turning a steering wheel.',
    detailedGuide: 'Hold both closed fists side-by-side in front of your chest and move them slightly up and down as if turning a car steering wheel.',
    recommendedHand: 'Both Hands',
    datasetWord: 'car',
  },
  {
    token: 'BOOK',
    displayLabel: 'Book',
    category: 'Daily',
    actionSummary: 'Both flat hands open side-by-side like an open book.',
    detailedGuide: 'Hold both flat open hands palms-up side-by-side in front of your chest with little fingers touching, as if holding an open book.',
    recommendedHand: 'Both Hands',
    datasetWord: 'book',
  },
  {
    token: 'MEETING',
    displayLabel: 'Meeting',
    category: 'Daily',
    actionSummary: 'Both index fingers upright and coming together.',
    detailedGuide: 'Hold both index fingers pointing upward and bring them towards each other until they almost touch, representing people gathering.',
    recommendedHand: 'Both Hands',
    datasetWord: 'meeting',
  },
];

// High-Frequency Signs Pre-cached into RAM on room join for 0ms Instant Retrieval
const HIGH_FREQUENCY_PREFETCH_WORDS = [
  'hello', 'goodmorning', 'goodafternoon', 'goodnight',
  'doctor', 'hospital', 'happy', 'fast', 'bus', 'family',
  'meeting', 'help', 'food', 'water', 'car', 'thankyou',
  'welcome', 'computer', 'today', 'people'
];

// Category groupings for all 262 ISL Parquet Dataset words
const DATASET_CATEGORY_MAP: Record<string, string[]> = {
  'Greetings & Basics': [
    'hello', 'howareyou', 'thankyou', 'goodmorning', 'goodafternoon', 'goodevening', 'goodnight', 'alright', 'pleased'
  ],
  'Jobs & Health': [
    'doctor', 'patient', 'hospital', 'medicine', 'nurse', 'job', 'teacher', 'student', 'police', 'lawyer', 'manager', 'author', 'artist', 'soldier', 'waiter', 'secretary', 'reporter', 'priest', 'actor'
  ],
  'Family & People': [
    'family', 'father', 'mother', 'brother', 'sister', 'son', 'daughter', 'husband', 'wife', 'child', 'baby', 'boy', 'girl', 'parent', 'friend', 'neighbour', 'grandfather', 'grandmother', 'man', 'woman', 'adult', 'crowd', 'player', 'president', 'queen', 'king'
  ],
  'Places & Transport': [
    'hospital', 'home', 'house', 'school', 'university', 'bank', 'market', 'office', 'park', 'restaurant', 'temple', 'library', 'court', 'city', 'india', 'location', 'trainstation', 'car', 'bus', 'train', 'plane', 'bicycle', 'boat', 'truck', 'trainticket', 'transportation'
  ],
  'Time & Days': [
    'today', 'tomorrow', 'yesterday', 'morning', 'afternoon', 'evening', 'night', 'time', 'hour', 'minute', 'second', 'week', 'month', 'year', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
  ],
  'Home & Electronics': [
    'computer', 'laptop', 'television', 'screen', 'cellphone', 'telephone', 'camera', 'radio', 'clock', 'fan', 'lamp', 'table', 'chair', 'bed', 'bedroom', 'bathroom', 'kitchen', 'door', 'window', 'book', 'pen', 'pencil', 'paper', 'letter', 'page', 'box', 'bag', 'card', 'key', 'lock', 'tool', 'soap', 'ring', 'gift'
  ],
  'Adjectives': [
    'good', 'bad', 'happy', 'sad', 'fast', 'slow', 'biglarge', 'smalllittle', 'clean', 'dirty', 'hot', 'cold', 'cool', 'warm', 'new', 'old', 'nice', 'rich', 'poor', 'healthy', 'sick', 'strong', 'weak', 'tall', 'short', 'heavy', 'light', 'hard', 'soft', 'expensive', 'cheap', 'famous', 'quiet', 'loud', 'deep', 'shallow', 'thick', 'thin', 'tight', 'loose', 'wide', 'narrow', 'alive', 'dead', 'blind', 'deaf', 'young'
  ],
  'Clothes & Colours': [
    'shirt', 'tshirt', 'pant', 'dress', 'skirt', 'suit', 'shoes', 'pocket', 'hat', 'clothing', 'red', 'blue', 'green', 'yellow', 'orange', 'pink', 'black', 'white', 'brown', 'grey', 'colour'
  ],
  'Animals & Nature': [
    'animal', 'dog', 'cat', 'bird', 'fish', 'horse', 'cow', 'mouse', 'summer', 'winter', 'spring', 'fall', 'season', 'exmonsoon'
  ],
  'Society & Communication': [
    'peace', 'science', 'technology', 'marriage', 'money', 'price', 'bill', 'exercise', 'energy', 'god', 'religion', 'sport', 'team', 'newspaper', 'war', 'attack', 'death', 'sign'
  ]
};

const ALL_262_DATASET_WORDS = Array.from(VOCABULARY_262).sort().map((w) => {
  let cat = 'General';
  for (const [categoryName, words] of Object.entries(DATASET_CATEGORY_MAP)) {
    if (words.includes(w)) {
      cat = categoryName;
      break;
    }
  }
  return {
    word: w,
    displayLabel: w.charAt(0).toUpperCase() + w.slice(1),
    category: cat,
  };
});

// Remote Peer in Google Meet / WebRTC Room
interface RemoteParticipant {
  socketId: string;
  uid: string;
  displayName: string;
  role: string;
  stream: MediaStream | null;
  isVideoOff: boolean;
  isMuted: boolean;
  isScreenSharing: boolean;
}

// Public Google STUN servers + OpenRelay TURN servers for reliable WebRTC NAT traversal across cellular/ngrok
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelay',
      credential: 'openrelay',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelay',
      credential: 'openrelay',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelay',
      credential: 'openrelay',
    },
  ],
  iceCandidatePoolSize: 10,
};

// ─── Remote Participant Video Card ──────────────────────────────────────────
const RemoteParticipantTile: React.FC<{
  participant: RemoteParticipant;
  isCompact?: boolean;
}> = ({ participant, isCompact }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      if (videoRef.current.srcObject !== participant.stream) {
        videoRef.current.srcObject = participant.stream;
      }
      videoRef.current.play().catch(() => {});
    }
    if (audioRef.current && participant.stream) {
      if (audioRef.current.srcObject !== participant.stream) {
        audioRef.current.srcObject = participant.stream;
      }
      audioRef.current.play().catch(() => {});
    }
  }, [participant.stream]);

  // Click-to-unblock-audio policy in case browser blocks background sound
  useEffect(() => {
    const handleUnblock = () => {
      if (audioRef.current && audioRef.current.paused && audioRef.current.srcObject) {
        audioRef.current.play().catch(() => {});
      }
    };
    window.addEventListener('click', handleUnblock, { once: true });
    return () => window.removeEventListener('click', handleUnblock);
  }, []);

  // Strict mute synchronization: immediately silence remote audio when peer is muted
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = Boolean(participant.isMuted);
    }
  }, [participant.isMuted]);

  const initials = participant.displayName
    ? participant.displayName.trim().charAt(0).toUpperCase()
    : 'P';

  const hasVideoTrack = Boolean(
    participant.stream &&
    participant.stream.getVideoTracks().length > 0 &&
    participant.stream.getVideoTracks().some((t) => t.enabled)
  );

  return (
    <div
      className={`relative rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl flex flex-col justify-between ${
        isCompact ? 'h-44 sm:h-52 w-full shrink-0' : 'flex-1 w-full h-full min-h-[260px]'
      }`}
    >
      {/* Audio element ensures remote voice is strictly heard when unmuted, and 100% silenced when muted */}
      <audio
        ref={(el) => {
          audioRef.current = el;
          if (el && participant.stream && el.srcObject !== participant.stream) {
            el.srcObject = participant.stream;
            el.play().catch(() => {});
          }
          if (el) {
            el.muted = Boolean(participant.isMuted);
          }
        }}
        autoPlay
        playsInline
        muted={Boolean(participant.isMuted)}
      />

      {/* Top Badges */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-20 flex items-center justify-between pointer-events-none">
        <span className="px-2.5 py-0.5 rounded-full bg-slate-950/80 backdrop-blur-md border border-slate-700/80 text-[10px] font-mono text-slate-300 font-semibold flex items-center gap-1.5 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {participant.role === 'speaking_interviewer' ? 'Speaker' : 'Signer'}
        </span>

        <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-mono text-slate-400 border border-white/10">
          {participant.isScreenSharing ? 'Screen 1080p' : 'HD 720p'}
        </span>
      </div>

      {/* Video / Camera Off Element — Video element is ALWAYS muted to prevent duplicate audio output or mute leaks */}
      <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden">
        <video
          ref={(el) => {
            videoRef.current = el;
            if (el && participant.stream && el.srcObject !== participant.stream) {
              el.srcObject = participant.stream;
              el.play().catch(() => {});
            }
          }}
          autoPlay
          playsInline
          muted={true}
          className={`w-full h-full ${
            participant.isScreenSharing ? 'object-contain bg-black' : 'object-cover'
          }`}
        />

        {(!hasVideoTrack || participant.isVideoOff) && !participant.isScreenSharing && (
          <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center gap-2 z-10 text-slate-400">
            <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200 text-xl font-bold shadow-md">
              {initials}
            </div>
            <span className="text-xs text-slate-400 font-medium">
              {participant.stream ? 'Camera is off' : 'Connecting stream...'}
            </span>
          </div>
        )}

        {participant.isMuted && (
          <div className="absolute top-2.5 right-12 z-20 bg-rose-600/90 text-white p-1 rounded-full border border-rose-400 shadow-md">
            <MicOff className="w-3 h-3" />
          </div>
        )}
      </div>

      {/* Bottom Name Pill */}
      <div className="absolute bottom-2.5 left-2.5 z-20 pointer-events-auto">
        <div className="px-3 py-1 rounded-full bg-slate-950/85 backdrop-blur-md border border-slate-700/80 text-xs font-semibold text-slate-200 flex items-center gap-1.5 shadow-lg">
          <div className="w-4 h-4 rounded-full bg-orange-500 text-white flex items-center justify-center text-[9px] font-bold">
            {initials}
          </div>
          <span className="truncate max-w-[140px]">{participant.displayName}</span>
        </div>
      </div>
    </div>
  );
};

// ─── Google Meet Screen Presentation Canvas ─────────────────────────────────
const PresentationView: React.FC<{
  stream: MediaStream | null;
  presenterName: string;
  isLocal: boolean;
}> = ({ stream, presenterName, isLocal }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden relative shadow-xl h-full"
    >
      {/* Presentation Top Bar */}
      <div className="px-4 py-2 bg-slate-950/95 border-b border-slate-800 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full bg-orange-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm">
            <ScreenShare className="w-3.5 h-3.5" />
            <span>PRESENTATION ACTIVE</span>
          </span>
          <span className="text-xs font-mono text-slate-300">
            {isLocal ? 'You are presenting to everyone' : `${presenterName} is presenting`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800">
            1080p 30 FPS
          </span>
          <button
            onClick={toggleFullscreen}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Screen Viewport */}
      <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-contain bg-black"
        />
      </div>
    </div>
  );
};

function MeetingRoomContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();
  const { credits, deductCredits, openRechargeModal } = useWallet();
  const lastBilledMinuteRef = useRef<number>(0);
  const meetingDurationRef = useRef<number>(0);

  const rawRoom = decodeURIComponent(String(params?.roomId || 'ROOM-DEMO'));
  const roomId = normalizeRoomCode(rawRoom) || 'ROOM-DEMO';
  const searchName = searchParams?.get('name');
  const authName = profile?.displayName || user?.email?.split('@')[0];
  const [guestId, setGuestId] = useState<string>('Guest');

  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? sessionStorage.getItem('sanket_guest_id') : null;
      if (stored) {
        setGuestId(stored);
      } else {
        const generated = `Guest-${Math.floor(1000 + Math.random() * 9000)}`;
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('sanket_guest_id', generated);
        }
        setGuestId(generated);
      }
    } catch {
      setGuestId(`Guest-${Math.floor(1000 + Math.random() * 9000)}`);
    }
  }, []);

  const displayName = searchName?.trim() || authName?.trim() || guestId;
  const age = searchParams?.get('age') || '22';
  const rawRole = (searchParams?.get('role') || '').toLowerCase().trim();
  const isSpeakerRole =
    rawRole.includes('speak') ||
    rawRole.includes('voice') ||
    rawRole.includes('interviewer') ||
    rawRole === 'doctor' ||
    rawRole === 'host';
  const userRole: 'deaf_signer' | 'speaking_interviewer' = isSpeakerRole
    ? 'speaking_interviewer'
    : 'deaf_signer';
  const directJoinParam = searchParams?.get('direct') === '1';
  const hasRoleParam = Boolean(searchParams?.get('role'));
  const [hasJoined, setHasJoined] = useState<boolean>(directJoinParam && hasRoleParam);
  const [lobbyName, setLobbyName] = useState<string>('');
  const [selectedLobbyRole, setSelectedLobbyRole] = useState<'deaf_signer' | 'speaking_interviewer'>(userRole);
  const [activeRole, setActiveRole] = useState<'deaf_signer' | 'speaking_interviewer'>(userRole);
  const [isMicOn, setIsMicOn] = useState<boolean>(true);
  const [isVideoOn, setIsVideoOn] = useState<boolean>(searchParams?.get('videoOff') !== '1');
  const [isCameraStreamActive, setIsCameraStreamActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const virtualStreamControllerRef = useRef<VirtualStreamController | null>(null);
  const [isVirtualCameraActive, setIsVirtualCameraActive] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const hasJoinedRef = useRef(hasJoined);
  hasJoinedRef.current = hasJoined;
  const activeRoleRef = useRef(activeRole);
  activeRoleRef.current = activeRole;
  const effectiveDisplayNameRef = useRef(displayName);
  effectiveDisplayNameRef.current = lobbyName.trim() || displayName;

  // ─── User Biography & Meeting Context Profile (for Context-Aware AI) ─────────
  const [meetingContext, setMeetingContext] = useState<string>('');
  const [showContextModal, setShowContextModal] = useState<boolean>(false);
  const [showLobbyContext, setShowLobbyContext] = useState<boolean>(false);
  const [showSwitchSettings, setShowSwitchSettings] = useState<boolean>(false);
  const meetingContextRef = useRef<string>('');
  meetingContextRef.current = meetingContext;

  // ─── Custom Mode Switch Gesture Preference (Isolated & Persisted per Account) ───
  const [customSwitchSign, setCustomSwitchSign] = useState<SwitchSignId>('INDEX_TOUCH');

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const savedSign = localStorage.getItem('sanket_switch_sign_pref') as SwitchSignId;
        if (savedSign && AVAILABLE_SWITCH_SIGNS.some((s) => s.id === savedSign)) {
          setCustomSwitchSign(savedSign);
        }
      }
    } catch {}
  }, []);

  const handleSelectSwitchSign = (signId: SwitchSignId) => {
    setCustomSwitchSign(signId);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('sanket_switch_sign_pref', signId);
      }
    } catch {}
    if (lobbyRecognizerRef.current) {
      lobbyRecognizerRef.current.setSwitchSign(signId);
    }
    if (recognizerRef.current) {
      recognizerRef.current.setSwitchSign(signId);
    }
    const def = AVAILABLE_SWITCH_SIGNS.find((s) => s.id === signId);
    setToastMessage(`Switch Gesture set to: ${def?.name || signId}`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // ─── Custom User AI Settings (BYOK: Bring Your Own API Key & Model) ───────────
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [customApiKey, setCustomApiKey] = useState<string>('');
  const [customModel, setCustomModel] = useState<string>('gemini-2.0-flash');
  const [canvasReady, setCanvasReady] = useState<number>(0);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const savedKey = localStorage.getItem('sanket_custom_api_key') || '';
        const savedModel = localStorage.getItem('sanket_custom_model') || 'gemini-2.0-flash';
        const savedContext = sessionStorage.getItem('sanket_meeting_context') || '';
        if (savedKey) setCustomApiKey(savedKey);
        if (savedModel) setCustomModel(savedModel);
        if (savedContext) setMeetingContext(savedContext);
      }
    } catch {}
  }, []);

  const saveAiSettings = (apiKey: string, model: string) => {
    setCustomApiKey(apiKey.trim());
    setCustomModel(model.trim());
    try {
      if (typeof window !== 'undefined') {
        if (apiKey.trim()) {
          localStorage.setItem('sanket_custom_api_key', apiKey.trim());
        } else {
          localStorage.removeItem('sanket_custom_api_key');
        }
        localStorage.setItem('sanket_custom_model', model.trim());
      }
      setToastMessage('AI Key & Model Settings Saved!');
      setTimeout(() => setToastMessage(null), 3000);
      setShowSettingsModal(false);
    } catch {}
  };

  // Extract custom words from user name & meeting context for instant auto-complete
  const customBiographicalWords = React.useMemo(() => {
    const words = new Set<string>();
    const source = `${lobbyName} ${displayName} ${meetingContext}`.toUpperCase();
    const tokens = source.match(/\b[A-Z]{2,}\b/g) || [];
    tokens.forEach((t) => {
      if (t.length >= 2 && !ISL_EXCLUDED_STOPWORDS.has(t.toLowerCase())) {
        words.add(t);
      }
    });
    return Array.from(words);
  }, [lobbyName, displayName, meetingContext]);

  useEffect(() => {
    if (!lobbyName && displayName) {
      setLobbyName(displayName);
    }
  }, [displayName]);

  const [avatarMode, setAvatarMode] = useState<'hologram' | '3d_avatar' | 'emojis'>(
    userRole === 'speaking_interviewer' ? '3d_avatar' : 'hologram'
  );
  const [selectedSignEmojiId, setSelectedSignEmojiId] = useState<string>('doctor');
  const [showSignEmojiPicker, setShowSignEmojiPicker] = useState<boolean>(false);
  const [floatingReaction, setFloatingReaction] = useState<{ id: string; name: string; icon: string } | null>(null);

  const triggerSignReaction = (emoji: { id: string; name: string; icon: string }) => {
    setFloatingReaction(emoji);
    setSelectedSignEmojiId(emoji.id);
    executeTranslateAndSign(emoji.id);
    setTimeout(() => {
      setFloatingReaction((prev) => (prev?.id === emoji.id ? null : prev));
    }, 4500);
  };
  const [hologramMountEl, setHologramMountEl] = useState<HTMLDivElement | null>(null);
  const [showReadyCard, setShowReadyCard] = useState(false);
  const [currentFrameInfo, setCurrentFrameInfo] = useState<{ current: number; total: number }>({ current: 0, total: 63 });

  // ─── 3D Avatar Model Selector & Custom Uploader States ──────────────────────
  const [available3DModels, setAvailable3DModels] = useState<
    { filename: string; name: string; sizeMb: string; ext: string; url: string }[]
  >([]);
  const [selected3DModelUrl, setSelected3DModelUrl] = useState<string>('/api/avatar-model?file=mans.fbx');
  const [avatarColorMode, setAvatarColorMode] = useState<'auto' | 'natural' | 'original'>('natural');
  const [isUploadingModel, setIsUploadingModel] = useState<boolean>(false);

  useEffect(() => {
    fetch('/api/avatar-model?list=true')
      .then((r) => r.json())
      .then((data) => {
        if (data?.models && Array.isArray(data.models) && data.models.length > 0) {
          setAvailable3DModels(data.models);
        }
      })
      .catch((err) => console.warn('[AvatarModelList] fetch notice:', err));
  }, []);

  const handleUploadCustomModel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingModel(true);
      setToastMessage(`Uploading model "${file.name}"...`);
      const res = await fetch(`/api/avatar-model?upload=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: file,
      });
      if (res.ok) {
        setToastMessage(`Model "${file.name}" uploaded successfully! Activating...`);
        const newUrl = `/api/avatar-model?file=${encodeURIComponent(file.name)}`;
        setSelected3DModelUrl(newUrl);
        fetch('/api/avatar-model?list=true')
          .then((r) => r.json())
          .then((d) => {
            if (d?.models) setAvailable3DModels(d.models);
          });
      } else {
        setToastMessage('Failed to upload model.');
      }
    } catch (err: any) {
      setToastMessage(`Upload failed: ${err.message}`);
    } finally {
      setIsUploadingModel(false);
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  // ─── Pre-Call Lobby Diagnostics & Gesture Tester States ─────────────────────
  const lobbyVideoRef = useRef<HTMLVideoElement | null>(null);
  const lobbyCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lobbyRecognizerRef = useRef<ISLCameraRecognizerEngine | null>(null);
  const [isLobbySignTestActive, setIsLobbySignTestActive] = useState<boolean>(true);
  const [lobbyCandidate, setLobbyCandidate] = useState<DetectedSignCandidate | null>(null);
  const [lobbyHoldProgress, setLobbyHoldProgress] = useState<number>(0);
  const [lobbyConfirmedSign, setLobbyConfirmedSign] = useState<string | null>(null);
  const [lobbyTestedSigns, setLobbyTestedSigns] = useState<string[]>([]);
  const [lobbyHandsDetected, setLobbyHandsDetected] = useState<number>(0);
  const [lobbySignTestMode, setLobbySignTestMode] = useState<'word' | 'fingerspell'>('word');
  const [lobbyActiveTip, setLobbyActiveTip] = useState<{ label: string; tip: string } | null>(null);
  const [lobbyMicVolume, setLobbyMicVolume] = useState<number>(0);
  const [lobbyVoiceTestTranscript, setLobbyVoiceTestTranscript] = useState<string>('');
  const [isLobbyVoiceTesting, setIsLobbyVoiceTesting] = useState<boolean>(false);

  // Keep lobby video element synced with local camera stream
  useEffect(() => {
    if (!hasJoined && lobbyVideoRef.current && localStreamRef.current) {
      if (lobbyVideoRef.current.srcObject !== localStreamRef.current) {
        lobbyVideoRef.current.srcObject = localStreamRef.current;
      }
      lobbyVideoRef.current.play().catch(() => {});
    }
  }, [hasJoined, isCameraStreamActive, isVideoOn]);

  // Pre-Call Lobby Sign Recognition Tester
  useEffect(() => {
    if (hasJoined || selectedLobbyRole !== 'deaf_signer' || !isVideoOn || !isLobbySignTestActive) {
      if (lobbyRecognizerRef.current) {
        lobbyRecognizerRef.current.stop();
        lobbyRecognizerRef.current = null;
      }
      setLobbyCandidate(null);
      setLobbyHoldProgress(0);
      setLobbyHandsDetected(0);
      return;
    }

    let cancelled = false;
    const recognizer = new ISLCameraRecognizerEngine();
    lobbyRecognizerRef.current = recognizer;

    const startTestLoop = () => {
      if (cancelled) return;
      const vEl = lobbyVideoRef.current;
      const cEl = lobbyCanvasRef.current;
      if (!vEl || !cEl) {
        setTimeout(startTestLoop, 150);
        return;
      }

      if (localStreamRef.current && vEl.srcObject !== localStreamRef.current) {
        vEl.srcObject = localStreamRef.current;
        vEl.play().catch(() => {});
      }

      // Wait until camera stream is live and video has non-zero dimensions
      if (!localStreamRef.current || vEl.readyState < 2 || vEl.videoWidth <= 0 || vEl.videoHeight <= 0) {
        setTimeout(startTestLoop, 100);
        return;
      }

      recognizer.initialize(
        vEl,
        cEl,
        (update) => {
          if (cancelled) return;
          setLobbyCandidate(update.candidate);
          setLobbyHoldProgress(update.holdProgress);
          setLobbyHandsDetected(update.handsDetected || 0);

          if (update.confirmedToken) {
            const rawToken = update.confirmedToken.token;

            // Handle Physical Mode Switch Gesture in Lobby Test
            if (rawToken === 'MODE_SWITCH') {
              const newMode = lobbySignTestMode === 'word' ? 'fingerspell' : 'word';
              setLobbySignTestMode(newMode);
              recognizer.setMode(newMode);
              recognizer.playModeSwitchChime(newMode);
              const label = `MODE SWITCH: ${newMode === 'fingerspell' ? 'SPELL LETTERS' : 'ISL WORDS'}`;
              setLobbyConfirmedSign(label);
              setLobbyTestedSigns((prev) => (prev.includes('SWITCH GESTURE') ? prev : [...prev, 'SWITCH GESTURE']));
              setTimeout(() => {
                setLobbyConfirmedSign((curr) => (curr === label ? null : curr));
              }, 4000);
              return;
            }

            const rawLabel = update.confirmedToken.displayLabel || update.confirmedToken.token;
            const cleanLabel = rawLabel
              .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
              .replace(/\s+/g, ' ')
              .trim();
            const token = cleanLabel.toUpperCase();
            setLobbyConfirmedSign(token);
            setLobbyTestedSigns((prev) => (prev.includes(token) ? prev : [...prev, token]));

            // Audio confirmation chime
            try {
              const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.frequency.setValueAtTime(587.33, ctx.currentTime);
              osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
              gain.gain.setValueAtTime(0.12, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
              osc.start();
              osc.stop(ctx.currentTime + 0.18);
            } catch {}

            // Speak clean natural English word (without emojis or slashes)
            if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
              try {
                window.speechSynthesis.resume();
                window.speechSynthesis.cancel();
                const spokenForm = cleanLabel.split('/')[0].trim().toLowerCase();
                const utter = new SpeechSynthesisUtterance(spokenForm);
                utter.rate = 1.0;
                utter.volume = 1.0;
                window.speechSynthesis.speak(utter);
              } catch {}
            }

            setTimeout(() => {
              setLobbyConfirmedSign((curr) => (curr === token ? null : curr));
            }, 3500);
          }
        },
        lobbySignTestMode,
        customSwitchSign
      );
    };

    const timer = setTimeout(startTestLoop, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      recognizer.stop();
      if (lobbyRecognizerRef.current === recognizer) {
        lobbyRecognizerRef.current = null;
      }
    };
  }, [hasJoined, selectedLobbyRole, isVideoOn, isLobbySignTestActive, lobbySignTestMode, isCameraStreamActive, customSwitchSign]);

  // Pre-Call Lobby Microphone Volume Level Meter
  useEffect(() => {
    if (hasJoined || selectedLobbyRole !== 'speaking_interviewer' || !localStreamRef.current || !isMicOn) {
      setLobbyMicVolume(0);
      return;
    }

    let audioCtx: AudioContext | null = null;
    let animId = 0;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      audioCtx = new AudioContextClass();
      const source = audioCtx.createMediaStreamSource(localStreamRef.current);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const checkVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setLobbyMicVolume(Math.min(100, Math.round((avg / 128) * 100)));
        animId = requestAnimationFrame(checkVolume);
      };
      checkVolume();
    } catch {}

    return () => {
      cancelAnimationFrame(animId);
      if (audioCtx) {
        audioCtx.close().catch(() => {});
      }
    };
  }, [hasJoined, selectedLobbyRole, isMicOn]);

  // Pre-Call Voice Speech-to-Sign Tester
  const testLobbyVoice = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
      return;
    }

    try {
      setIsLobbyVoiceTesting(true);
      setLobbyVoiceTestTranscript('Listening... Speak now into your microphone.');
      const testRec = new SpeechRecognition();
      testRec.lang = 'en-US';
      testRec.interimResults = true;
      testRec.maxAlternatives = 1;

      testRec.onresult = (evt: any) => {
        let interim = '';
        for (let i = 0; i < evt.results.length; i++) {
          interim += evt.results[i][0]?.transcript || '';
        }
        if (interim) {
          setLobbyVoiceTestTranscript(`Transcribed: "${interim}" • Voice-to-Sign Ready!`);
        }
      };

      testRec.onerror = () => {
        setIsLobbyVoiceTesting(false);
      };

      testRec.onend = () => {
        setIsLobbyVoiceTesting(false);
      };

      testRec.start();
      setTimeout(() => {
        try { testRec.stop(); } catch {}
        setIsLobbyVoiceTesting(false);
      }, 5000);
    } catch {
      setIsLobbyVoiceTesting(false);
    }
  };

  // Pre-Call Audio Output (TTS) Tester for Deaf Signers
  const testLobbyAudioOutput = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance('Audio check passed. Your signs will be spoken aloud to participants.');
        utter.rate = 1.0;
        window.speechSynthesis.speak(utter);
        setToastMessage('Playing test speech audio: "Audio check passed..."');
        setTimeout(() => setToastMessage(null), 3000);
      } catch {}
    }
  };

  // Retry Camera Acquisition when locked or previously failed
  const retryCamera = async () => {
    setCameraError(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;

    // Stop virtual stream if active so physical camera takes full control
    if (virtualStreamControllerRef.current) {
      virtualStreamControllerRef.current.stop();
      virtualStreamControllerRef.current = null;
    }
    setIsVirtualCameraActive(false);

    let stream: MediaStream | null = null;
    try {
      // 1. Try ideal 720p Video + Audio
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
    } catch (err: any) {
      console.warn('[Camera Retry] Audio+Video failed, trying video only:', err);
      // 2. Fallback: Video only 720p
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } catch {
        // 3. Fallback: Basic video
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (basicErr: any) {
          console.warn('[Camera Retry] All video attempts failed:', basicErr);
          if (basicErr?.name === 'NotReadableError' || String(basicErr).includes('Device in use')) {
            setCameraError('Camera is in use by another tab or app (e.g. your other open tab). Close that tab and click Retry.');
          } else {
            setCameraError('Could not start camera. Please check camera permissions in browser settings.');
          }
          setIsVideoOn(false);
          setIsCameraStreamActive(false);
          return;
        }
      }
    }

    if (stream && stream.getVideoTracks().length > 0) {
      localStreamRef.current = stream;
      if (lobbyVideoRef.current) {
        lobbyVideoRef.current.srcObject = stream;
        lobbyVideoRef.current.play().catch(() => {});
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }
      setIsCameraStreamActive(true);
      setIsVideoOn(true);
      setCameraError(null);

      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];

      // Push real video track to all active WebRTC peers
      peerConnectionsRef.current.forEach((pc) => {
        pc.getTransceivers().forEach((transceiver) => {
          if ((transceiver.receiver.track.kind === 'video' || transceiver.sender.track?.kind === 'video') && videoTrack) {
            transceiver.sender.replaceTrack(videoTrack);
          }
          if ((transceiver.receiver.track.kind === 'audio' || transceiver.sender.track?.kind === 'audio') && audioTrack) {
            transceiver.sender.replaceTrack(audioTrack);
          }
        });
      });

      socketRef.current?.emit('toggle-media', {
        roomId,
        state: { isVideoOff: false },
      });

      setToastMessage('Real camera connected successfully!');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  // Automatically release hardware camera and microphone when navigating away or closing tab
  useEffect(() => {
    const handleUnload = () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  // ─── Meeting State ────────────────────────────────────────────────────────
  const [isCopied, setIsCopied] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isLinkCopied, setIsLinkCopied] = useState(false);
  const [meetingDurationSec, setMeetingDurationSec] = useState(0);
  const [participantCount, setParticipantCount] = useState(1);
  const [showSignCompanion, setShowSignCompanion] = useState(true);
  const [joinUrl, setJoinUrl] = useState('');
  const [clockTime, setClockTime] = useState<string>('');

  // Active Meeting Duration & Real-Time Unified Credit Billing (10 credits per minute)
  useEffect(() => {
    if (!hasJoined) {
      setMeetingDurationSec(0);
      lastBilledMinuteRef.current = 0;
      meetingDurationRef.current = 0;
      return;
    }

    const interval = setInterval(() => {
      setMeetingDurationSec((prev) => {
        const nextSec = prev + 1;
        meetingDurationRef.current = nextSec;
        const currentMinute = Math.floor(nextSec / 60);

        // Deduct 10 credits at each completed 1-minute milestone (same unified rate as telecom relay)
        if (currentMinute > lastBilledMinuteRef.current) {
          lastBilledMinuteRef.current = currentMinute;
          const hasCredits = deductCredits(10, `Accessible Video Meeting (${currentMinute} min active)`);
          if (!hasCredits) {
            setToastMessage('Credits depleted. Please top up your wallet to continue.');
            openRechargeModal();
          }
        }
        return nextSec;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [hasJoined, deductCredits, openRechargeModal]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setClockTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setJoinUrl(`${window.location.origin}/room/${roomId}`);
    }
  }, [roomId]);

  // WebRTC Peer Connections & Remote Participants Map
  const [remoteParticipants, setRemoteParticipants] = useState<Map<string, RemoteParticipant>>(new Map());
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const peerStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const candidateQueuesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  // Google Meet Layout Mode ('grid' | 'signer_focus' | 'presentation')
  const [viewMode, setViewMode] = useState<'grid' | 'signer_focus' | 'presentation'>('grid');
  const [isLocalPiPDocked, setIsLocalPiPDocked] = useState(false);
  const [showParticipantList, setShowParticipantList] = useState(false);
  const [gridPage, setGridPage] = useState<number>(1);

  // Media States (Google Meet Controls)
  const [isListening, setIsListening] = useState(false);
  const [showCaptions, setShowCaptions] = useState(false);
  const [showPresetDrawer, setShowPresetDrawer] = useState(false);
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const showChatDrawerRef = useRef(false);
  const [chatInputText, setChatInputText] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');

  // Auto-dismiss the "Your meeting is ready" popup after 14 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowReadyCard(false);
    }, 14000);
    return () => clearTimeout(timer);
  }, []);

  // Ensure local video element always has localStreamRef attached across re-renders
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      if (localVideoRef.current.srcObject !== localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      localVideoRef.current.play().then(() => setIsCameraStreamActive(true)).catch(() => {});
      if (localStreamRef.current.getVideoTracks().some((t) => t.readyState === 'live')) {
        setIsCameraStreamActive(true);
      }
    }
  }, [isVideoOn, viewMode, remoteParticipants.size]);

  // In-Call Messages & Chat Drawer State
  const [chatMessages, setChatMessages] = useState<InCallChatMessage[]>([]);
  const [chatDrawerInput, setChatDrawerInput] = useState('');
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [autoSignChat, setAutoSignChat] = useState(true);

  // Screen Sharing State
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // Subtitle & Speech-to-Sign Pipeline States
  const [currentSentence, setCurrentSentence] = useState('');
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [currentAction, setCurrentAction] = useState<ChoreographedSignAction | null>(null);
  const [animationQueue, setAnimationQueue] = useState<ChoreographedSignAction[]>([]);
  const [currentActionIndex, setCurrentActionIndex] = useState(-1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlayingSign, setIsPlayingSign] = useState(false);

  // ─── Sign-to-Speech (ISL Camera Recognizer & TTS) States ───────────────────
  const [isSignToSpeechActive, setIsSignToSpeechActive] = useState<boolean>(userRole === 'deaf_signer');
  const [signingInputMode, setSigningInputMode] = useState<'word' | 'fingerspell'>('word');
  const [showFramingGuide, setShowFramingGuide] = useState<boolean>(true);
  const [framingStatus, setFramingStatus] = useState<FramingStatus>({
    isInZone: false,
    message: 'Position hands in chest signing zone',
    zoneState: 'no_hands',
  });
  const [meetingNotesLog, setMeetingNotesLog] = useState<MeetingNoteEntry[]>([]);

  // Continuous persistence of meeting minutes / MoM ledger
  useEffect(() => {
    if (meetingNotesLog.length > 0 && typeof window !== 'undefined') {
      try {
        const payload = {
          roomCode: roomId,
          meetingNotes: meetingNotesLog,
          chatMessages,
          durationSec: meetingDurationSec,
          savedAt: Date.now(),
        };
        localStorage.setItem(`sanket_mom_${roomId}`, JSON.stringify(payload));
        localStorage.setItem(`sanket_mom_${roomId.toUpperCase()}`, JSON.stringify(payload));
        localStorage.setItem('sanket_mom_latest', JSON.stringify(payload));
      } catch (err) {
        console.warn('Failed auto-saving meeting notes to localStorage:', err);
      }
    }
  }, [meetingNotesLog, chatMessages, roomId, meetingDurationSec]);
  const [showMeetingNotesModal, setShowMeetingNotesModal] = useState<boolean>(false);
  const [showQrInviteModal, setShowQrInviteModal] = useState<boolean>(false);
  const [showSignGuideModal, setShowSignGuideModal] = useState<boolean>(false);
  const [showHeaderMoreMenu, setShowHeaderMoreMenu] = useState<boolean>(false);
  const [guideActiveTab, setGuideActiveTab] = useState<'camera' | 'dataset'>('camera');
  const [guideActiveCategory, setGuideActiveCategory] = useState<string>('All');
  const [guideSearchQuery, setGuideSearchQuery] = useState<string>('');
  const [detectedSignCandidate, setDetectedSignCandidate] = useState<DetectedSignCandidate | null>(null);
  const [holdProgress, setHoldProgress] = useState<number>(0);
  const [isHandMoving, setIsHandMoving] = useState<boolean>(false);
  const [motionStatusMessage, setMotionStatusMessage] = useState<string>('');
  const [bufferedSignTokens, setBufferedSignTokens] = useState<BufferedSignItem[]>([]);
  const [livePredictedSentence, setLivePredictedSentence] = useState<string>('');
  const [isSpeakingSign, setIsSpeakingSign] = useState<boolean>(false);
  const [autoSpeakSigns, setAutoSpeakSigns] = useState<boolean>(true);
  const autoSpeakTimerRef = useRef<NodeJS.Timeout | null>(null);
  const executeSignToSpeechRef = useRef<(customTokens?: string[]) => Promise<void>>(() => Promise.resolve());
  const recognizerRef = useRef<ISLCameraRecognizerEngine | null>(null);
  const landmarksCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // ─── Virtual Camera Stream Toggle for Multi-Browser Testing on 1 PC ─────────
  const startVirtualCamera = useCallback(() => {
    if (virtualStreamControllerRef.current) {
      virtualStreamControllerRef.current.stop();
    }
    const currentName = effectiveDisplayNameRef.current || displayName || 'User';
    const ctrl = createVirtualCameraStream(currentName, activeRoleRef.current);
    virtualStreamControllerRef.current = ctrl;
    setIsVirtualCameraActive(true);
    setCameraError(null);

    const existingAudio = localStreamRef.current?.getAudioTracks()[0];
    if (existingAudio) {
      ctrl.stream.addTrack(existingAudio);
    }
    localStreamRef.current = ctrl.stream;

    if (lobbyVideoRef.current) {
      lobbyVideoRef.current.srcObject = ctrl.stream;
      lobbyVideoRef.current.play().catch(() => {});
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = ctrl.stream;
      localVideoRef.current.play().catch(() => {});
    }
    setIsCameraStreamActive(true);
    setIsVideoOn(true);

    peerConnectionsRef.current.forEach((pc) => {
      pc.getTransceivers().forEach((transceiver) => {
        if (transceiver.receiver.track.kind === 'video' || transceiver.sender.track?.kind === 'video') {
          transceiver.sender.replaceTrack(ctrl.videoTrack);
        }
      });
    });

    socketRef.current?.emit('toggle-media', {
      roomId,
      state: { isVideoOff: false },
    });

    setToastMessage('Virtual Camera active: Both browser windows can stream video concurrently!');
    setTimeout(() => setToastMessage(null), 4000);
  }, [displayName, roomId]);

  const switchBackToHardwareCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      const newVideoTrack = stream.getVideoTracks()[0];
      const newAudioTrack = stream.getAudioTracks()[0];

      if (virtualStreamControllerRef.current) {
        virtualStreamControllerRef.current.stop();
        virtualStreamControllerRef.current = null;
      }
      setIsVirtualCameraActive(false);
      setCameraError(null);

      localStreamRef.current = stream;

      if (lobbyVideoRef.current) {
        lobbyVideoRef.current.srcObject = stream;
        lobbyVideoRef.current.play().catch(() => {});
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }
      setIsCameraStreamActive(true);
      setIsVideoOn(true);

      peerConnectionsRef.current.forEach((pc) => {
        pc.getTransceivers().forEach((transceiver) => {
          if ((transceiver.receiver.track.kind === 'video' || transceiver.sender.track?.kind === 'video') && newVideoTrack) {
            transceiver.sender.replaceTrack(newVideoTrack);
          }
          if ((transceiver.receiver.track.kind === 'audio' || transceiver.sender.track?.kind === 'audio') && newAudioTrack) {
            transceiver.sender.replaceTrack(newAudioTrack);
          }
        });
      });

      socketRef.current?.emit('toggle-media', {
        roomId,
        state: { isVideoOff: false },
      });

      setToastMessage('Connected to physical webcam successfully!');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      console.warn('[Camera] Physical camera busy:', err);
      setCameraError('Physical webcam is still locked by another tab. Continuing on Virtual Camera.');
    }
  }, [roomId]);

  // Pre-warm the 261-class ISL ONNX neural model on room mount
  useEffect(() => {
    const warmRecognizer = new ISLOnnxRecognizer();
    warmRecognizer.initialize().then((loaded) => {
      if (loaded) {
        console.log('🚀 [Sanket AI] 261-Class Deep ISL Model Active in Browser via WebGL/WASM!');
      }
    }).catch(() => {});
  }, []);

  // Real-time AI Sentence Formation: Reconstructs fluent grammatical English from buffered sign concepts
  useEffect(() => {
    if (bufferedSignTokens.length === 0) {
      setLivePredictedSentence('');
      return;
    }

    const tokens = bufferedSignTokens.map((t) => t.token);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/agents/sign-to-speech', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tokens,
            apiKey: customApiKey || undefined,
            model: customModel || undefined,
            context: meetingContextRef.current || undefined,
            userName: effectiveDisplayNameRef.current || undefined,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.spokenText) {
            setLivePredictedSentence(data.spokenText);
          }
        }
      } catch {
        const joined = tokens.join(' ');
        const deduped = joined.replace(/\b(\w+)(?:\s+\1\b)+/gi, '$1');
        setLivePredictedSentence(deduped.charAt(0).toUpperCase() + deduped.slice(1).toLowerCase() + '.');
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [bufferedSignTokens, customApiKey, customModel]);

  // Auto-Speak on Gesture Pause: Automatically broadcasts spoken voice to remote hearing speaker
  useEffect(() => {
    if (autoSpeakTimerRef.current) {
      clearTimeout(autoSpeakTimerRef.current);
      autoSpeakTimerRef.current = null;
    }

    if (!autoSpeakSigns || bufferedSignTokens.length === 0 || !hasJoined) {
      return;
    }

    // When signer pauses for 1.8s, automatically speak and broadcast to speaker
    autoSpeakTimerRef.current = setTimeout(() => {
      if (bufferedSignTokens.length > 0 && !isSpeakingSign) {
        console.log('[Auto-Speak] Automatically speaking buffered signs to speaker...');
        executeSignToSpeechRef.current();
      }
    }, 1800);

    return () => {
      if (autoSpeakTimerRef.current) {
        clearTimeout(autoSpeakTimerRef.current);
      }
    };
  }, [bufferedSignTokens, autoSpeakSigns, hasJoined, isSpeakingSign]);

  // Active trailing fingerspelled letters and real-time word predictions
  const trailingLetters = React.useMemo(() => {
    const letters: string[] = [];
    for (let i = bufferedSignTokens.length - 1; i >= 0; i--) {
      if (bufferedSignTokens[i].type === 'letter') {
        letters.unshift(bufferedSignTokens[i].token);
      } else {
        break;
      }
    }
    return letters;
  }, [bufferedSignTokens]);

  const activePredictions = React.useMemo(() => {
    const lastPrompt = currentSentence || interimTranscript || '';
    return predictWordsFromLetters(trailingLetters, 4, {
      userName: effectiveDisplayNameRef.current || displayName || '',
      lastQuestionPrompt: lastPrompt,
      customWords: customBiographicalWords,
    });
  }, [trailingLetters, currentSentence, interimTranscript, displayName, customBiographicalWords]);

  const activeSpelledWord = trailingLetters.join('');

  const handleAcceptPrediction = useCallback((predictedWord: string, autoReturnToWordMode = true) => {
    const cleanWord = predictedWord.toUpperCase().trim();
    setBufferedSignTokens((prev) => {
      let lastNonLetterIndex = prev.length - 1;
      while (lastNonLetterIndex >= 0 && prev[lastNonLetterIndex].type === 'letter') {
        lastNonLetterIndex--;
      }
      const kept = prev.slice(0, lastNonLetterIndex + 1);
      // Strict anti-repetition: if sentence already ended with this word, do not append duplicate!
      if (kept.length > 0 && kept[kept.length - 1].token === cleanWord) {
        return kept;
      }
      return [
        ...kept,
        {
          id: `${Date.now()}-${Math.random()}`,
          token: cleanWord,
          type: 'word',
          displayLabel: cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1).toLowerCase(),
          timestamp: Date.now(),
        },
      ];
    });

    if (autoReturnToWordMode && signingInputMode === 'fingerspell') {
      setSigningInputMode('word');
      recognizerRef.current?.setMode('word');
      if (recognizerRef.current?.playModeSwitchChime) {
        recognizerRef.current.playModeSwitchChime('word');
      }
      setToastMessage(`Auto-Committed: "${predictedWord}" • Returned to ISL Words Mode`);
      setTimeout(() => setToastMessage(null), 3000);
    }
  }, [signingInputMode]);

  // Hands-Free Auto-Commit: When signer spells 2-3 characters and pauses for 1.2s, auto-commit top predicted entity and return to Word mode!
  useEffect(() => {
    if (signingInputMode !== 'fingerspell' || trailingLetters.length < 2 || activePredictions.length === 0 || !hasJoined) {
      return;
    }

    const topMatch = activePredictions[0];
    const prefix = trailingLetters.join('').toLowerCase();
    if (!topMatch) return;

    // Signer has paused hands after spelling 2+ letters
    const timer = setTimeout(() => {
      console.log(`[Hands-Free Auto-Commit] Paused after "${prefix}", auto-committing: "${topMatch}"`);
      handleAcceptPrediction(topMatch, true);
    }, 1250);

    return () => clearTimeout(timer);
  }, [trailingLetters, activePredictions, signingInputMode, hasJoined, handleAcceptPrediction]);

  const nextWordSuggestions = React.useMemo(() => {
    return getNextWordSuggestions(bufferedSignTokens, effectiveDisplayNameRef.current, customBiographicalWords);
  }, [bufferedSignTokens, customBiographicalWords]);

  const handleAppendWord = useCallback((word: string) => {
    const TOKEN_MAP: Record<string, string> = {
      'YES': 'good',
      'NO': 'bad',
      'HELLO': 'hello',
      'THANK YOU': 'thankyou',
      'GOOD MORNING': 'goodmorning',
      'GOOD NIGHT': 'goodnight',
      'HOW ARE YOU': 'howareyou',
      'DOCTOR': 'doctor',
      'HELP': 'help',
      'TIME': 'time',
      'HOUSE': 'house',
      'CAR': 'car',
      'BOOK': 'book',
      'MEETING': 'meeting',
      'WATER': 'water',
      'FOOD': 'food',
      'PLEASE': 'please',
      'WAIT': 'wait',
      'PERFECT': 'perfect',
      'I LOVE YOU': 'love',
    };
    const cleanWord = TOKEN_MAP[word.toUpperCase()] || word.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (playActionRef.current) {
      playActionRef.current({
        type: 'word',
        token: word.toUpperCase(),
        displayLabel: word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
        source: 'dataset_parquet',
        parquetWord: cleanWord,
        durationMs: 2200,
      });
    }
    setBufferedSignTokens((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].token === word.toUpperCase()) {
        return prev;
      }
      return [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          token: word.toUpperCase(),
          type: 'word',
          displayLabel: word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
          timestamp: Date.now(),
        },
      ];
    });
  }, []);

  const handleToggleSigningMode = useCallback((mode: 'word' | 'fingerspell') => {
    setSigningInputMode(mode);
    if (recognizerRef.current) {
      recognizerRef.current.setMode(mode);
    }
  }, []);

  // Three.js & Animation Refs
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const skeletonRef = useRef<Holographic3DSkeleton | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Animation Playback Engine Refs
  const animationQueueRef = useRef<ChoreographedSignAction[]>([]);
  const currentActionIndexRef = useRef<number>(-1);
  const isPlayingRef = useRef<boolean>(false);
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const advanceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const standbyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const glideIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPlayedFrameRef = useRef<FrameLandmarks | null>(null);
  const prefetchCacheRef = useRef<Map<string, FrameLandmarks[]>>(new Map());
  const smootherRef = useRef<LandmarkMotionSmoother>(new LandmarkMotionSmoother());

  // Speech Recognition & Socket.IO Refs
  const speechRecognitionRef = useRef<any>(null);
  const isListeningRef = useRef<boolean>(false);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const playActionRef = useRef<(action: ChoreographedSignAction) => void>(() => {});
  const advanceQueueRef = useRef<() => void>(() => {});
  const stopAllPlaybackRef = useRef<() => void>(() => {});
  const executeTranslateAndSignRef = useRef<(text: string) => Promise<void>>(() => Promise.resolve());

  // ─── 1. Call Duration Timer ────────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      setMeetingDurationSec((sec) => sec + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Auto-activate live continuous speech-to-sign on user interaction for speakers
  useEffect(() => {
    if (userRole === 'speaking_interviewer') {
      const startOnInteraction = () => {
        if (!isListeningRef.current) {
          toggleListening();
          setToastMessage('Live Speech Recognition is active. Speak now to sign in ISL.');
          setTimeout(() => setToastMessage(null), 3500);
        }
        window.removeEventListener('click', startOnInteraction);
      };
      window.addEventListener('click', startOnInteraction, { once: true });
      return () => window.removeEventListener('click', startOnInteraction);
    }
  }, [userRole]);

  // ─── 2. Smooth Background Memory Prefetch (Non-Blocking) ──────────────────
  useEffect(() => {
    // Only prefetch top greeting words after UI mounts and finishes rendering cleanly
    const timer = setTimeout(() => {
      const topWords = ['hello', 'welcome', 'doctor', 'hospital'];
      topWords.forEach((word, idx) => {
        setTimeout(() => {
          if (!prefetchCacheRef.current.has(word)) {
            fetch(`/api/dataset-parquet?word=${encodeURIComponent(word)}`)
              .then((r) => r.json())
              .then((d) => {
                if (d?.frames?.length > 0) {
                  prefetchCacheRef.current.set(word, d.frames);
                }
              })
              .catch(() => {});
          }
        }, idx * 600);
      });
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  // ─── 3. Local Camera & Microphone Hardware Setup ────────────────────────────
  useEffect(() => {
    let active = true;

    async function initMedia() {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;

      let stream: MediaStream | null = null;
      // 1. Try requesting ideal 720p Video + Audio
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
      } catch (err: any) {
        console.warn('[Camera] Audio+Video failed, trying video only:', err);
        if (err?.name === 'NotReadableError' || String(err).includes('Device in use')) {
          setCameraError('Camera is in use by another tab or app (e.g. your other open room tab). Close other tabs using your webcam and click Retry.');
        }
        // 2. Fallback: Try Video only (in case mic is denied, absent, or busy)
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          });
        } catch (vErr: any) {
          console.warn('[Camera] Ideal 720p video failed, trying basic video:', vErr);
          if (vErr?.name === 'NotReadableError' || String(vErr).includes('Device in use')) {
            setCameraError('Camera is in use by another tab or app (e.g. your other open room tab). Close other tabs using your webcam and click Retry.');
          }
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
          } catch (basicErr: any) {
            console.warn('[Camera] Video acquisition failed:', basicErr);
            if (basicErr?.name === 'NotReadableError' || String(basicErr).includes('Device in use')) {
              setCameraError('Camera is in use by another tab or app (e.g. your other open room tab). Close other tabs using your webcam and click Retry.');
            }
            // 3. Fallback: Audio only
            try {
              stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            } catch (aErr) {
              console.error('[Camera] No video or audio media available:', aErr);
            }
          }
        }
      }

      if (!active) {
        if (stream) stream.getTracks().forEach((t) => t.stop());
        return;
      }

      // If hardware video was not acquired (e.g. camera is busy or locked by another window):
      if (!stream || stream.getVideoTracks().length === 0) {
        console.warn('[Camera] Real video track not available on mount. Showing Google Meet style avatar & retry prompt.');
        setIsVideoOn(false);
        setIsCameraStreamActive(false);
        setCameraError('Camera in use by another tab or app. Close other tabs using your webcam and click "Retry Camera".');
      } else {
        setCameraError(null);
        setIsVideoOn(true);
        setIsCameraStreamActive(true);
      }

      if (stream) {
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(() => {});
        }
        if (lobbyVideoRef.current) {
          lobbyVideoRef.current.srcObject = stream;
          lobbyVideoRef.current.play().catch(() => {});
        }
        setIsCameraStreamActive(stream.getVideoTracks().length > 0);
        setIsVideoOn(stream.getVideoTracks().length > 0);

        // Initial track enabled states
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) videoTrack.enabled = true;
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) audioTrack.enabled = isMicOn;

        // Push local tracks to any already-opened peer connections via transceivers
        peerConnectionsRef.current.forEach((pc) => {
          pc.getTransceivers().forEach((transceiver) => {
            if ((transceiver.receiver.track.kind === 'audio' || transceiver.sender.track?.kind === 'audio') && audioTrack) {
              transceiver.sender.replaceTrack(audioTrack);
            } else if ((transceiver.receiver.track.kind === 'video' || transceiver.sender.track?.kind === 'video') && videoTrack) {
              transceiver.sender.replaceTrack(videoTrack);
            }
          });
        });

        // Broadcast to all other peers in the room that my video and audio are live
        if (socketRef.current?.connected) {
          socketRef.current.emit('toggle-media', {
            roomId,
            state: {
              isVideoOff: !stream.getVideoTracks().some((t) => t.enabled),
              isMuted: !stream.getAudioTracks().some((t) => t.enabled),
            },
          });
        }
      } else {
        localStreamRef.current = null;
      }
    }

    initMedia();

    return () => {
      active = false;
      if (virtualStreamControllerRef.current) {
        virtualStreamControllerRef.current.stop();
        virtualStreamControllerRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // ─── 4. WebRTC Signaling & Socket.IO Real-Time Peer Event Relay ─────────────
  useEffect(() => {
    const rawSignalingUrl = (process.env.NEXT_PUBLIC_SIGNALING_SERVER_URL || '').trim();
    // Guard against stale or unreachable external signaling domains; default to same-origin
    const isExternalSignaling =
      rawSignalingUrl &&
      !rawSignalingUrl.includes('localhost') &&
      !rawSignalingUrl.includes('sanket-signaling') &&
      (typeof window !== 'undefined' ? rawSignalingUrl !== window.location.origin : true);
    const socket = isExternalSignaling
      ? io(rawSignalingUrl, { path: '/socket.io', transports: ['websocket', 'polling'] })
      : io({ path: '/socket.io', transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    // Helper: Build or retrieve RTCPeerConnection for a given peer
    const getOrCreatePeerConnection = (targetSocketId: string, participantInfo?: any) => {
      if (peerConnectionsRef.current.has(targetSocketId)) {
        return peerConnectionsRef.current.get(targetSocketId)!;
      }

      console.log(`[WebRTC] Creating RTCPeerConnection for ${targetSocketId}`);
      const pc = new RTCPeerConnection(RTC_CONFIG);
      peerConnectionsRef.current.set(targetSocketId, pc);

      // Add local media tracks (screen share stream or camera stream)
      const outgoingStream = screenStreamRef.current || localStreamRef.current;
      if (outgoingStream && outgoingStream.getTracks().length > 0) {
        outgoingStream.getTracks().forEach((track) => {
          pc.addTrack(track, outgoingStream);
        });
      } else {
        pc.addTransceiver('audio', { direction: 'sendrecv' });
        pc.addTransceiver('video', { direction: 'sendrecv' });
      }

      // Send local ICE candidates over Socket.IO
      pc.onicecandidate = (event) => {
        if (event.candidate && socket.connected) {
          socket.emit('ice-candidate', {
            targetSocketId,
            candidate: event.candidate,
          });
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log(`[WebRTC] ICE Connection State (${targetSocketId}):`, pc.iceConnectionState);
        if (pc.iceConnectionState === 'failed') {
          console.warn(`[WebRTC] ICE failed for ${targetSocketId}, attempting restart...`);
          try {
            pc.restartIce();
          } catch {}
        }
      };

      // Receive incoming remote tracks (audio, video, or screen share)
      pc.ontrack = (event) => {
        console.log(`[WebRTC] Received remote track (${event.track.kind}) from ${targetSocketId}`);
        let remoteStream = peerStreamsRef.current.get(targetSocketId);
        if (!remoteStream) {
          remoteStream = new MediaStream();
          peerStreamsRef.current.set(targetSocketId, remoteStream);
        }
        remoteStream.getTracks().filter((t) => t.kind === event.track.kind).forEach((t) => remoteStream!.removeTrack(t));
        remoteStream.addTrack(event.track);

        const freshStream = new MediaStream(remoteStream.getTracks());

        setRemoteParticipants((prev) => {
          const next = new Map(prev);
          const existing = next.get(targetSocketId) || {
            socketId: targetSocketId,
            uid: targetSocketId,
            displayName: participantInfo?.displayName || 'Remote Participant',
            role: participantInfo?.role || 'speaking_interviewer',
            stream: null,
            isVideoOff: false,
            isMuted: Boolean(participantInfo?.isMuted),
            isScreenSharing: Boolean(participantInfo?.isScreenSharing),
          };
          next.set(targetSocketId, {
            ...existing,
            stream: freshStream,
            isVideoOff: event.track.kind === 'video' ? !event.track.enabled : existing.isVideoOff,
          });
          return next;
        });

        event.track.onunmute = () => {
          console.log(`[WebRTC] Track unmuted (${event.track.kind}) from ${targetSocketId}`);
          setRemoteParticipants((prev) => {
            const next = new Map(prev);
            const existing = next.get(targetSocketId);
            if (existing && remoteStream) {
              next.set(targetSocketId, {
                ...existing,
                stream: new MediaStream(remoteStream.getTracks()),
                isVideoOff: false,
              });
            }
            return next;
          });
        };
      };

      return pc;
    };

    socket.on('connect', () => {
      console.log(`[Google Meet Room] Connected to signaling server as: ${socket.id}`);
      if (hasJoinedRef.current) {
        socket.emit('join-room', {
          roomId,
          user: {
            uid: socket.id,
            displayName: effectiveDisplayNameRef.current,
            role: activeRoleRef.current,
            isVideoOff: !isVideoOn,
            isMuted: activeRoleRef.current === 'deaf_signer' ? true : !isMicOn,
            isScreenSharing,
          },
        });
      }
    });

    // 0. Real-time authoritative participant roster from server
    socket.on('room-participants', (data: { count: number; participants: any[] }) => {
      console.log(`[Socket.IO] Authoritative room-participants count:`, data.count);
      setParticipantCount(data.count);

      setRemoteParticipants((prev) => {
        const next = new Map(prev);
        data.participants.forEach((p) => {
          if (p.socketId !== socket.id) {
            const existing = next.get(p.socketId);
            const stream = existing?.stream || peerStreamsRef.current.get(p.socketId) || null;
            next.set(p.socketId, {
              socketId: p.socketId,
              uid: p.uid || p.socketId,
              displayName: p.displayName || 'Participant',
              role: p.role || 'speaking_interviewer',
              stream,
              isVideoOff: Boolean(p.isVideoOff),
              isMuted: Boolean(p.isMuted),
              isScreenSharing: Boolean(p.isScreenSharing),
            });
          }
        });
        const activeIds = new Set(data.participants.map((p) => p.socketId));
        Array.from(next.keys()).forEach((sId) => {
          if (!activeIds.has(sId)) {
            next.delete(sId);
            peerStreamsRef.current.delete(sId);
          }
        });
        return next;
      });
    });

    // 1. Initial participants in room when I join
    socket.on('room-joined', (data: { socketId: string; existingParticipants: any[]; roomCode: string }) => {
      console.log(`[Socket.IO] Room joined. Existing peers:`, data.existingParticipants);
      setParticipantCount((data.existingParticipants?.length || 0) + 1);

      setRemoteParticipants((prev) => {
        const next = new Map(prev);
        data.existingParticipants?.forEach((p) => {
          const stream = peerStreamsRef.current.get(p.socketId) || null;
          next.set(p.socketId, {
            socketId: p.socketId,
            uid: p.uid || p.socketId,
            displayName: p.displayName || 'Participant',
            role: p.role || 'speaking_interviewer',
            stream,
            isVideoOff: Boolean(p.isVideoOff),
            isMuted: Boolean(p.isMuted),
            isScreenSharing: Boolean(p.isScreenSharing),
          });
        });
        return next;
      });

      // Newcomer initializes peer connection for all existing participants
      data.existingParticipants?.forEach((p) => {
        getOrCreatePeerConnection(p.socketId, p);
      });
    });
    socket.on('user-joined', async (data: { participant: any }) => {
      const p = data.participant;
      console.log(`[Socket.IO] New participant joined:`, p);
      setParticipantCount((count) => count + 1);

      setRemoteParticipants((prev) => {
        const next = new Map(prev);
        next.set(p.socketId, {
          socketId: p.socketId,
          uid: p.uid || p.socketId,
          displayName: p.displayName || 'Participant',
          role: p.role || 'speaking_interviewer',
          stream: null,
          isVideoOff: Boolean(p.isVideoOff),
          isMuted: Boolean(p.isMuted),
          isScreenSharing: Boolean(p.isScreenSharing),
        });
        return next;
      });

      // Initiate WebRTC call to newcomer
      try {
        const pc = getOrCreatePeerConnection(p.socketId, p);
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await pc.setLocalDescription(offer);

        socket.emit('offer', {
          targetSocketId: p.socketId,
          offer,
          callerUser: {
            displayName,
            role: userRole,
            isVideoOff: !isVideoOn,
            isMuted: !isMicOn,
            isScreenSharing,
          },
        });
        console.log(`[WebRTC] Sent SDP offer to newcomer: ${p.socketId}`);
      } catch (err) {
        console.error(`[WebRTC] Error initiating offer to ${p.socketId}:`, err);
      }
    });

    // 3. Receive WebRTC Offer -> Answer back
    socket.on('offer', async (data: { callerSocketId: string; offer: RTCSessionDescriptionInit; callerUser?: any }) => {
      console.log(`[WebRTC] Received offer from ${data.callerSocketId}`);
      try {
        const pc = getOrCreatePeerConnection(data.callerSocketId, data.callerUser);
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

        // Drain any queued candidates
        const queued = candidateQueuesRef.current.get(data.callerSocketId) || [];
        for (const cand of queued) {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        }
        candidateQueuesRef.current.delete(data.callerSocketId);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('answer', {
          targetSocketId: data.callerSocketId,
          answer,
        });
        console.log(`[WebRTC] Sent SDP answer to ${data.callerSocketId}`);
      } catch (err) {
        console.error(`[WebRTC] Error answering offer:`, err);
      }
    });

    // 4. Receive WebRTC Answer -> Complete connection handshake
    socket.on('answer', async (data: { callerSocketId: string; answer: RTCSessionDescriptionInit }) => {
      console.log(`[WebRTC] Received answer from ${data.callerSocketId}`);
      const pc = peerConnectionsRef.current.get(data.callerSocketId);
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          const queued = candidateQueuesRef.current.get(data.callerSocketId) || [];
          for (const cand of queued) {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          }
          candidateQueuesRef.current.delete(data.callerSocketId);
        } catch (err) {
          console.error(`[WebRTC] Error setting remote description for answer:`, err);
        }
      }
    });

    // 5. Receive ICE Candidate
    socket.on('ice-candidate', async (data: { callerSocketId: string; candidate: RTCIceCandidateInit }) => {
      const pc = peerConnectionsRef.current.get(data.callerSocketId);
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.error(`[WebRTC] Error adding ICE candidate:`, err);
        }
      } else {
        const queue = candidateQueuesRef.current.get(data.callerSocketId) || [];
        queue.push(data.candidate);
        candidateQueuesRef.current.set(data.callerSocketId, queue);
      }
    });

    // 6. Media State Sync (Camera on/off, Mute, Screen sharing)
    socket.on('user-media-toggled', (data: { socketId: string; state: any }) => {
      console.log(`[WebRTC] Peer media toggled:`, data.socketId, data.state);
      setRemoteParticipants((prev) => {
        const next = new Map(prev);
        const existing = next.get(data.socketId);
        if (existing) {
          const updated = { ...existing, ...data.state };
          next.set(data.socketId, updated);
          // If remote peer started screen sharing, auto-switch to presentation mode!
          if (data.state.isScreenSharing) {
            setViewMode('presentation');
          }
        }
        return next;
      });
    });

    // 7. Peer disconnected
    socket.on('user-disconnected', (data: { socketId: string }) => {
      console.log(`[WebRTC] Peer disconnected: ${data.socketId}`);
      setParticipantCount((count) => Math.max(1, count - 1));

      const pc = peerConnectionsRef.current.get(data.socketId);
      if (pc) {
        pc.close();
        peerConnectionsRef.current.delete(data.socketId);
      }
      candidateQueuesRef.current.delete(data.socketId);

      setRemoteParticipants((prev) => {
        const next = new Map(prev);
        next.delete(data.socketId);
        return next;
      });
    });

    // Real-time live transcript streaming from remote speaker (Google Meet live subtitles)
    socket.on('live-transcript', (data: { transcript: string }) => {
      setInterimTranscript(data.transcript || '');
    });

    // Remote Sign & Speech Broadcast: When speaking peer speaks, render locally at 60 FPS
    socket.on('sign-speech-event', (data: { sentence: string; pipelineResult: SpeechToSignPipelineResult }) => {
      console.log('[Socket.IO] Received sign-speech-event:', data.sentence);
      setShowSignCompanion(true);
      setAvatarMode('hologram');
      setInterimTranscript('');
      setCurrentSentence(data.sentence);
      if (data.pipelineResult?.animationQueue?.length > 0) {
        animationQueueRef.current = data.pipelineResult.animationQueue;
        setAnimationQueue(data.pipelineResult.animationQueue);
        currentActionIndexRef.current = 0;
        setCurrentActionIndex(0);
        setTimeout(() => {
          if (playActionRef.current && data.pipelineResult?.animationQueue?.[0]) {
            playActionRef.current(data.pipelineResult.animationQueue[0]);
          }
        }, 80);
      }

      // Log into Bilingual Meeting Minutes & Clinical Records ledger
      const islTokens = data.pipelineResult?.islGrammarTokens || [];
      const remoteSpeechNote: MeetingNoteEntry = {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        speaker: 'Doctor / Speaker',
        role: 'hearing_speaker',
        sourceType: 'speech',
        originalContent: data.sentence,
        translatedContent: islTokens.length > 0 ? `ISL Signs: [${islTokens.join(', ')}]` : 'ISL 3D Avatar Articulation',
        category: categorizeMeetingEntry(data.sentence, 'hearing_speaker'),
      };
      setMeetingNotesLog((prev) => [...prev, remoteSpeechNote]);
    });

    // Remote Signer Speech Event: When a Deaf peer signs, speak aloud and render subtitles
    socket.on('signer-speech-event', (data: { signerName: string; spokenText: string; tokens: string[]; time: string }) => {
      console.log('[Socket.IO] Received signer-speech-event:', data);

      setInterimTranscript('');
      const cleanSpeech = (data.spokenText || '')
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
        .trim();
      setCurrentSentence(`${data.signerName}: "${cleanSpeech}"`);

      // Log into Bilingual Meeting Minutes & Clinical Records ledger
      const remoteSignerNote: MeetingNoteEntry = {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: data.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        speaker: data.signerName || 'Deaf Signer',
        role: 'deaf_signer',
        sourceType: 'sign',
        originalContent: data.tokens && data.tokens.length > 0 ? `ISL: [${data.tokens.join(', ')}]` : 'ISL Motion',
        translatedContent: cleanSpeech,
        category: categorizeMeetingEntry(cleanSpeech, 'deaf_signer'),
      };
      setMeetingNotesLog((prev) => [...prev, remoteSignerNote]);

      // If local peer is speaking interviewer or hearing participant, speak aloud via TTS
      if (typeof window !== 'undefined' && 'speechSynthesis' in window && cleanSpeech) {
        try {
          window.speechSynthesis.resume();
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(cleanSpeech);
          utter.rate = 1.0;
          utter.pitch = 1.0;
          utter.volume = 1.0;
          utter.lang = 'en-US';
          const voices = window.speechSynthesis.getVoices();
          if (voices && voices.length > 0) {
            const preferred = voices.find((v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.default)) || voices.find((v) => v.lang.startsWith('en'));
            if (preferred) utter.voice = preferred;
          }
          window.speechSynthesis.speak(utter);
        } catch (e) {
          console.warn('[TTS] Synthesis audio notice:', e);
        }
      }

      // Add to in-call messages drawer
      setChatMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          sender: data.signerName || 'Signer',
          role: 'deaf_signer',
          text: data.spokenText,
          time: data.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isSelf: false,
          isSigned: true,
        },
      ]);
    });

    // In-Call Real-Time Chat Relay
    socket.on('chat-message', (data: any) => {
      const incoming: InCallChatMessage = {
        id: data.id || `${Date.now()}-${Math.random()}`,
        sender: data.sender || 'Participant',
        role: data.role || 'Member',
        text: data.text || '',
        time: data.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isSelf: false,
        isSigned: data.isSigned,
      };
      setChatMessages((prev) => [...prev, incoming]);
      if (!showChatDrawerRef.current) {
        setUnreadChatCount((count) => count + 1);
      }
      if (data.isSigned && data.text) {
        executeTranslateAndSignRef.current(data.text);
      }
    });

    return () => {
      socket.emit('leave-room', { roomId });
      socket.disconnect();
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
      candidateQueuesRef.current.clear();
    };
  }, [roomId, displayName, age, userRole]);

  // Sync drawer ref for socket handler
  useEffect(() => {
    showChatDrawerRef.current = showChatDrawer;
    if (showChatDrawer) {
      setUnreadChatCount(0);
    }
  }, [showChatDrawer]);

  // ─── 5. Three.js High-Visibility 3D Skeleton Setup (Perfect Centered Framing) ──
  useEffect(() => {
    if (!hologramMountEl || !showSignCompanion || avatarMode !== 'hologram') {
      if (skeletonRef.current) {
        skeletonRef.current = null;
      }
      return;
    }

    let cleanupFn: (() => void) | null = null;
    let cancelled = false;

    const container = hologramMountEl;
    // Clean existing canvas if any
    container.innerHTML = '';

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 500;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 1.05, 2.3);
    camera.lookAt(0, 1.05, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 1.05, 0);
    controlsRef.current = controls;

    // Floor Pedestal Grid
    const grid = new THREE.GridHelper(6, 12, 0x06b6d4, 0x1e293b);
    grid.position.y = 0.01;
    scene.add(grid);

    // Multi-Angle Lighting (Key Cyan, Warm Rose Fill, High-Angle Rim)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.8);
    scene.add(ambientLight);

    const keyCyanLight = new THREE.DirectionalLight(0x06b6d4, 2.8);
    keyCyanLight.position.set(1.5, 2.5, 2.5);
    scene.add(keyCyanLight);

    const fillRoseLight = new THREE.DirectionalLight(0xf43f5e, 2.0);
    fillRoseLight.position.set(-1.5, 1.0, 2.0);
    scene.add(fillRoseLight);

    const backRimLight = new THREE.DirectionalLight(0x38bdf8, 2.4);
    backRimLight.position.set(0, 2.4, -2.0);
    scene.add(backRimLight);

    // High-Visibility 3D Skeleton
    const skeleton = new Holographic3DSkeleton(scene);
    skeletonRef.current = skeleton;
    // Initialize standby resting posture immediately
    skeleton.resetToDefaultPose();

    // Render loop
    let animId = 0;
    const renderLoop = () => {
      controls.update();
      renderer.render(scene, camera);
      animId = requestAnimationFrame(renderLoop);
    };
    renderLoop();
    animFrameIdRef.current = animId;

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth || 600;
      const h = container.clientHeight || 500;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);

    cleanupFn = () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      cancelAnimationFrame(animId);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      controls.dispose();
      renderer.dispose();
      skeleton.dispose();
      skeletonRef.current = null;
    };

    return () => {
      cancelled = true;
      if (cleanupFn) cleanupFn();
    };
  }, [hologramMountEl, showSignCompanion, avatarMode]);

  // ─── 6. Smooth Glide Back to Standby Neutral Posture ───────────────────────
  const glideToStandby = useCallback(() => {
    if (glideIntervalRef.current) {
      clearInterval(glideIntervalRef.current);
      glideIntervalRef.current = null;
    }
    if (!skeletonRef.current) return;
    if (!lastPlayedFrameRef.current) {
      skeletonRef.current.resetToDefaultPose();
      return;
    }

    const neutralPose = createNeutralPoseLandmarks();
    const bridge = generateSmoothBridge(lastPlayedFrameRef.current, neutralPose, 14);
    let step = 0;

    glideIntervalRef.current = setInterval(() => {
      if (step < bridge.length && skeletonRef.current) {
        skeletonRef.current.update(bridge[step]);
        step++;
      } else {
        if (glideIntervalRef.current) {
          clearInterval(glideIntervalRef.current);
          glideIntervalRef.current = null;
        }
        if (skeletonRef.current) skeletonRef.current.resetToDefaultPose();
        lastPlayedFrameRef.current = null;
      }
    }, 33);
  }, []);

  // ─── 7. Stop All Playback Cleanly ──────────────────────────────────────────
  const stopAllPlayback = useCallback(() => {
    if (playbackTimerRef.current) {
      clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
    if (standbyTimeoutRef.current) {
      clearTimeout(standbyTimeoutRef.current);
      standbyTimeoutRef.current = null;
    }
    if (glideIntervalRef.current) {
      clearInterval(glideIntervalRef.current);
      glideIntervalRef.current = null;
    }
    isPlayingRef.current = false;
    setIsPlayingSign(false);
  }, []);
  stopAllPlaybackRef.current = stopAllPlayback;

  // ─── 8. Sign Playback Engine: Calibrated Presentation Duration (>= 2.1s) ─────
  const startPlayingFrames = useCallback((
    frameList: FrameLandmarks[],
    onComplete: () => void,
    targetDurationMs: number = 2100 // Enforce >= 2.1s per sign gesture so Deaf viewers absorb the sign
  ) => {
    if (!frameList || frameList.length === 0) {
      onComplete();
      return;
    }

    stopAllPlaybackRef.current();
    isPlayingRef.current = true;
    setIsPlayingSign(true);

    let frameIdx = 0;
    setCurrentFrameInfo({ current: 1, total: frameList.length });
    if (skeletonRef.current && frameList[0]) {
      const smoothed0 = smootherRef.current.smooth(frameList[0]);
      skeletonRef.current.update(smoothed0);
    }

    // Mathematical pacing calibration:
    // Motion duration + presentation hold is strictly >= targetDurationMs (2.1s)
    const holdDurationMs = 500;
    const motionDurationMs = Math.max(1500, targetDurationMs - holdDurationMs);
    const frameDelay = Math.max(58, Math.round(motionDurationMs / Math.max(1, frameList.length)));
    const totalMotionMs = frameList.length * frameDelay;
    const finalHoldMs = Math.max(500, targetDurationMs - totalMotionMs);

    const tick = () => {
      playbackTimerRef.current = setTimeout(() => {
        frameIdx++;
        setCurrentFrameInfo({ current: Math.min(frameIdx + 1, frameList.length), total: frameList.length });
        if (frameIdx >= frameList.length) {
          playbackTimerRef.current = null;
          isPlayingRef.current = false;
          setIsPlayingSign(false);
          lastPlayedFrameRef.current = frameList[frameList.length - 1];

          // Hold the canonical presentation posture for finalHoldMs so viewer absorbs it
          advanceTimeoutRef.current = setTimeout(() => {
            onComplete();
          }, finalHoldMs);
          return;
        }

        const raw = frameList[frameIdx];
        if (skeletonRef.current && raw) {
          const smoothed = smootherRef.current.smooth(raw);
          skeletonRef.current.update(smoothed);
        }

        tick();
      }, frameDelay);
    };

    tick();
  }, []);

  // ─── 9. Unified Play Action (Dataset Parquet Word OR 3D Fingerspelling) ─────
  const playAction = useCallback(async (action: ChoreographedSignAction) => {
    if (!action) return;
    stopAllPlaybackRef.current();
    setActiveToken(action.token);
    setCurrentAction(action);

    // ── Fingerspelling Branch: Prioritize letter actions immediately ──
    if (action.source === 'fingerspell_letter' || action.type === 'letter') {
      try {
        const char = (action.token || 'A').charAt(0).toUpperCase();
        let letterFrames = generateFingerspellFrames(char, 28);
        if (lastPlayedFrameRef.current) {
          const bridge = generateSmoothBridge(lastPlayedFrameRef.current, letterFrames[0], 8);
          letterFrames = [...bridge, ...letterFrames];
        }
        smootherRef.current.reset();
        // Calibrated 1200ms per letter so Deaf viewer clearly sees each handshape
        startPlayingFrames(letterFrames, () => advanceQueueRef.current(), 1200);
      } catch (err) {
        console.error('[Google Meet Sign Play] Fingerspell error:', err);
        advanceQueueRef.current();
      }
      return;
    }

    // ── Dataset Parquet / Sign Gesture Branch ──
    const targetDurationMs = 2100;
    const parquetKeyword = action.parquetWord || action.token;

    // Fast path: In-Memory Client Cache (0ms latency!)
    const cached = prefetchCacheRef.current.get(parquetKeyword);
    if (cached && cached.length > 0) {
      let framesToPlay = cached;
      if (lastPlayedFrameRef.current) {
        const bridge = generateSmoothBridge(lastPlayedFrameRef.current, cached[0], 10);
        framesToPlay = [...bridge, ...cached];
      }
      smootherRef.current.reset();
      startPlayingFrames(framesToPlay, () => advanceQueueRef.current(), targetDurationMs);
      return;
    }

    // Fetch Parquet frames from backend
    try {
      const res = await fetch(`/api/dataset-parquet?word=${encodeURIComponent(parquetKeyword)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.frames && data.frames.length > 0) {
          prefetchCacheRef.current.set(parquetKeyword, data.frames);
          let framesToPlay = data.frames;
          if (lastPlayedFrameRef.current) {
            const bridge = generateSmoothBridge(lastPlayedFrameRef.current, framesToPlay[0], 10);
            framesToPlay = [...bridge, ...framesToPlay];
          }
          smootherRef.current.reset();
          console.log(`[ISL Parquet Dataset] Playing authentic parquet landmarks for "${parquetKeyword}" (${data.frames.length} frames, File: ${data.file})`);
          startPlayingFrames(framesToPlay, () => advanceQueueRef.current(), targetDurationMs);
          return;
        }
      }
    } catch (err) {
      console.warn('[Google Meet Sign Play] Parquet fetch error:', err);
    }

    // Authentic ISL standard: Unknown proper nouns are fingerspelled using standard A-Z handshapes
    try {
      const letters = parquetKeyword.toUpperCase().split('').filter((c: string) => /[A-Z0-9]/.test(c));
      if (letters.length > 0) {
        let allLetterFrames: any[] = [];
        for (const ch of letters) {
          const lFrames = generateFingerspellFrames(ch, 20);
          allLetterFrames = [...allLetterFrames, ...lFrames];
        }
        if (lastPlayedFrameRef.current && allLetterFrames.length > 0) {
          const bridge = generateSmoothBridge(lastPlayedFrameRef.current, allLetterFrames[0], 8);
          allLetterFrames = [...bridge, ...allLetterFrames];
        }
        smootherRef.current.reset();
        startPlayingFrames(allLetterFrames, () => advanceQueueRef.current(), Math.max(1200, letters.length * 400));
        return;
      }
    } catch (fsErr) {
      console.error('[Google Meet Sign Play] Letters error:', fsErr);
    }
    advanceQueueRef.current();
  }, [startPlayingFrames]);
  playActionRef.current = playAction;

  // ─── 10. Advance Queue to Next Sign in Sentence ────────────────────────────
  const advanceQueue = useCallback(() => {
    const queue = animationQueueRef.current;
    const nextIdx = currentActionIndexRef.current + 1;

    if (nextIdx < queue.length) {
      currentActionIndexRef.current = nextIdx;
      setCurrentActionIndex(nextIdx);
      const nextAction = queue[nextIdx];

      // Prefetch upcoming words in background for zero-lag playback
      const futureAction = queue[nextIdx + 1];
      if (futureAction?.parquetWord && !prefetchCacheRef.current.has(futureAction.parquetWord)) {
        fetch(`/api/dataset-parquet?word=${encodeURIComponent(futureAction.parquetWord)}`)
          .then((r) => r.json())
          .then((d) => {
            if (d?.frames) prefetchCacheRef.current.set(futureAction.parquetWord!, d.frames);
          })
          .catch(() => {});
      }

      playActionRef.current(nextAction);
    } else {
      // Finished all signs in sentence: hold for 1800ms for user absorption, then glide to rest
      setActiveToken(null);
      setCurrentAction(null);
      isPlayingRef.current = false;
      setIsPlayingSign(false);
      standbyTimeoutRef.current = setTimeout(() => {
        glideToStandby();
        setCurrentFrameInfo({ current: 0, total: 0 });
      }, 1800);
    }
  }, [glideToStandby]);
  advanceQueueRef.current = advanceQueue;

  // ─── 11. Execute Google ADK Speech-to-Sign Pipeline (With Guaranteed Fallback) ──
  const buildFallbackPipelineResult = (inputText: string): SpeechToSignPipelineResult => {
    let text = inputText.trim().toLowerCase();

    // 0. Pre-process verified 262 ISL Compound Phrases (e.g. 'good morning' -> 'goodmorning', 'how are you' -> 'howareyou')
    for (const [phrase, target] of Object.entries(COMPOUND_PHRASE_MAP)) {
      text = text.replace(new RegExp(`\\b${phrase}\\b`, 'gi'), target);
    }

    const rawWords = text.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
    const queue: ChoreographedSignAction[] = [];
    const tokens: string[] = [];

    for (const w of rawWords) {
      // Omit English auxiliary words / stopwords according to ISL grammar
      if (rawWords.length > 1 && ISL_EXCLUDED_STOPWORDS.has(w)) continue;

      // 1. Exact Match against our 262 Indian Sign Language Dataset
      if (VOCABULARY_262.has(w)) {
        tokens.push(w.toUpperCase());
        queue.push({
          type: 'word',
          token: w,
          displayLabel: w.toUpperCase(),
          source: 'dataset_parquet',
          parquetWord: w,
          durationMs: 2100,
        });
        continue;
      }

      // 2. Direct Pronoun & Communicative Lemmatization (e.g. 'my' -> 'i', 'name' -> 'sign', 'your' -> 'you')
      const mapped = CONCEPTUAL_LEMMATIZATION_MAP[w];
      if (mapped && VOCABULARY_262.has(mapped)) {
        tokens.push(`${mapped.toUpperCase()} (${w})`);
        queue.push({
          type: 'word',
          token: mapped,
          displayLabel: `${mapped.toUpperCase()} (${w})`,
          source: 'vector_synonym',
          originalWord: w,
          parquetWord: mapped,
          durationMs: 2100,
        });
        continue;
      }

      // 3. Simple Stemming / Plural stripping (e.g. 'doctors' -> 'doctor', 'cars' -> 'car')
      if (w.endsWith('s') && w.length > 2) {
        const singular = w.slice(0, -1);
        if (VOCABULARY_262.has(singular)) {
          tokens.push(singular.toUpperCase());
          queue.push({
            type: 'word',
            token: singular,
            displayLabel: `${singular.toUpperCase()} (plural)`,
            source: 'vector_synonym',
            originalWord: w,
            parquetWord: singular,
            durationMs: 2100,
          });
          continue;
        }
      }

      // 4. Unknown Word or Proper Noun: Decompose into individual letter-by-letter ISL Fingerspelling!
      tokens.push(w.toUpperCase());
      const letters = w.toUpperCase().split('');
      for (let i = 0; i < letters.length; i++) {
        const char = letters[i];
        if (/[A-Z0-9]/.test(char)) {
          queue.push({
            type: 'letter',
            token: char,
            displayLabel: `${w.toUpperCase()} [${char}] (${i + 1}/${letters.length})`,
            source: 'fingerspell_letter',
            originalWord: w,
            durationMs: 1200,
          });
        }
      }
    }

    if (queue.length === 0 && rawWords.length > 0) {
      const first = rawWords[0];
      tokens.push(first.toUpperCase());
      const letters = first.toUpperCase().split('');
      for (let i = 0; i < letters.length; i++) {
        const char = letters[i];
        if (/[A-Z0-9]/.test(char)) {
          queue.push({
            type: 'letter',
            token: char,
            displayLabel: `${first.toUpperCase()} [${char}]`,
            source: 'fingerspell_letter',
            originalWord: first,
            durationMs: 1200,
          });
        }
      }
    }

    return {
      originalText: inputText,
      islGrammarTokens: tokens,
      omittedStopwords: [],
      semanticSubstitutions: [],
      animationQueue: queue,
      modelUsed: 'client-procedural-fallback',
      executionTimeMs: 10,
      linguisticExplanation: 'Live ISL Sign articulation with procedural 3D skeleton fingerspelling choreography.',
    };
  };

  const executeTranslateAndSign = async (queryText: string) => {
    const text = queryText.trim();
    if (!text) return;

    setIsProcessing(true);
    setCurrentSentence(text);
    setInterimTranscript('');

    let pipelineData: SpeechToSignPipelineResult | null = null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res = await fetch('/api/agents/speech-to-sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          apiKey: customApiKey || undefined,
          model: customModel || undefined,
          context: meetingContextRef.current || undefined,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data?.animationQueue && data.animationQueue.length > 0) {
          pipelineData = data;
        }
      }
    } catch (err) {
      console.warn('[Google Meet Speech-to-Sign] API timeout/network error, engaging instant client fallback:', err);
    }

    // If server pipeline failed or had no queue, construct guaranteed instant fallback!
    if (!pipelineData || !pipelineData.animationQueue || pipelineData.animationQueue.length === 0) {
      pipelineData = buildFallbackPipelineResult(text);
    }

    if (pipelineData && pipelineData.animationQueue.length > 0) {
      animationQueueRef.current = pipelineData.animationQueue;
      setAnimationQueue(pipelineData.animationQueue);
      currentActionIndexRef.current = 0;
      setCurrentActionIndex(0);

      // Play locally
      if (playActionRef.current) {
        playActionRef.current(pipelineData.animationQueue[0]);
      }

      // Broadcast to other participants in the room via Socket.IO
      if (socketRef.current) {
        socketRef.current.emit('sign-speech-event', {
          roomId,
          data: {
            sentence: text,
            pipelineResult: pipelineData,
          },
        });
      }

      // Log to Bilingual Meeting Minutes & Clinical Records ledger
      const localHearingNote: MeetingNoteEntry = {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        speaker: effectiveDisplayNameRef.current || displayName || 'Hearing Speaker',
        role: 'hearing_speaker',
        sourceType: 'speech',
        originalContent: text,
        translatedContent: `ISL Signs: [${(pipelineData.islGrammarTokens || []).join(', ')}]`,
        category: categorizeMeetingEntry(text, 'hearing_speaker'),
      };
      setMeetingNotesLog((prev) => [...prev, localHearingNote]);
    }

    setIsProcessing(false);
  };
  executeTranslateAndSignRef.current = executeTranslateAndSign;

  // ─── 11b. Execute Sign-to-Speech (ISL Gestures → Spoken Audio & Captions) ────
  const executeSignToSpeech = async (customTokens?: string[]) => {
    const rawTokens = customTokens && customTokens.length > 0 
      ? customTokens 
      : bufferedSignTokens.map((t) => t.token);
    if (!rawTokens || rawTokens.length === 0) return;

    // Deduplicate consecutive identical tokens
    const tokensToUse = rawTokens.filter((t, idx) => idx === 0 || t.toUpperCase().trim() !== rawTokens[idx - 1].toUpperCase().trim());
    if (tokensToUse.length === 0) return;

    setIsSpeakingSign(true);
    let spokenSentence = '';

    try {
      const res = await fetch('/api/agents/sign-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokens: tokensToUse,
          apiKey: customApiKey || undefined,
          model: customModel || undefined,
          context: meetingContextRef.current || undefined,
          userName: effectiveDisplayNameRef.current || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.spokenText) {
          spokenSentence = data.spokenText;
        }
      }
    } catch (err) {
      console.warn('[Sign-to-Speech] API error, falling back to local phrase join:', err);
    }

    if (!spokenSentence) {
      // Clean local grammatical fallback
      const joined = tokensToUse.join(' ');
      spokenSentence = joined.charAt(0).toUpperCase() + joined.slice(1) + '.';
    }

    // Clean spoken sentence from any emojis or artifacts, and collapse consecutive repeated words
    const cleanSpokenSentence = (spokenSentence || tokensToUse.join(' '))
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/\b(\w+)(?:\s+\1\b)+/gi, '$1')
      .replace(/\s+/g, ' ')
      .trim();

    // 1. Speak aloud via browser Web Speech API
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && cleanSpokenSentence) {
      try {
        window.speechSynthesis.resume();
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(cleanSpokenSentence);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        utterance.lang = 'en-US';
        const voices = window.speechSynthesis.getVoices();
        if (voices && voices.length > 0) {
          const preferred = voices.find((v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.default)) || voices.find((v) => v.lang.startsWith('en'));
          if (preferred) utterance.voice = preferred;
        }
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('[TTS] Synthesis audio notice:', e);
      }
    }

    // 2. Broadcast to other participants via Socket.IO
    if (socketRef.current) {
      socketRef.current.emit('signer-speech-event', {
        roomId,
        data: {
          signerName: displayName,
          spokenText: cleanSpokenSentence,
          tokens: tokensToUse,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      });
    }

    // Log to Bilingual Meeting Minutes & Clinical Records ledger
    const localSignerNote: MeetingNoteEntry = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      speaker: effectiveDisplayNameRef.current || displayName || 'Deaf Signer',
      role: 'deaf_signer',
      sourceType: signingInputMode === 'fingerspell' ? 'fingerspell' : 'sign',
      originalContent: `ISL: [${tokensToUse.join(', ')}]`,
      translatedContent: cleanSpokenSentence,
      category: categorizeMeetingEntry(cleanSpokenSentence, 'deaf_signer'),
    };
    setMeetingNotesLog((prev) => [...prev, localSignerNote]);

    // 3. Update local subtitles & in-call chat
    setCurrentSentence(`You (Signer): "${cleanSpokenSentence}"`);
    setChatMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        sender: displayName,
        role: userRole,
        text: cleanSpokenSentence,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isSelf: true,
        isSigned: true,
      },
    ]);

    // 4. Clear buffered tokens
    if (!customTokens) {
      setBufferedSignTokens([]);
    }

    setIsSpeakingSign(false);
  };
  executeSignToSpeechRef.current = executeSignToSpeech;

  // ─── 11c. Initialize ISL Camera Recognizer for Deaf Signer ──────────────────
  useEffect(() => {
    if (!hasJoined || !isSignToSpeechActive || !localVideoRef.current || !landmarksCanvasRef.current || !isVideoOn) {
      if (recognizerRef.current) {
        recognizerRef.current.stop();
        recognizerRef.current = null;
      }
      return;
    }

    const recognizer = new ISLCameraRecognizerEngine();
    recognizerRef.current = recognizer;

    let lastUiProgressUpdate = 0;
    let lastCandidateToken: string | null = null;
    let lastMovingState: boolean = false;

    recognizer.initialize(localVideoRef.current, landmarksCanvasRef.current, (update) => {
      const now = performance.now();
      const currentToken = update.candidate ? update.candidate.token : null;
      const currentMoving = Boolean(update.isMoving);
      const isConfirmed = Boolean(update.confirmedToken);

      // Fast-path immediate update for candidate changes, hand state transitions, or confirmations
      if (isConfirmed || currentToken !== lastCandidateToken || currentMoving !== lastMovingState || (now - lastUiProgressUpdate > 75)) {
        lastUiProgressUpdate = now;
        lastCandidateToken = currentToken;
        lastMovingState = currentMoving;

        setDetectedSignCandidate(update.candidate);
        setHoldProgress(update.holdProgress);
        setIsHandMoving(currentMoving);
        if (update.statusMessage !== undefined) {
          setMotionStatusMessage(update.statusMessage || '');
        }
      }

      if (update.framing) {
        setFramingStatus(update.framing);
      }

      if (update.confirmedToken) {
        const confirmed = update.confirmedToken;
        const token = confirmed.token;

        // 0. Physical Mode Switch Gesture (e.g. Two Index Fingers Touching)
        if (token === 'MODE_SWITCH') {
          const nextMode = signingInputMode === 'word' ? 'fingerspell' : 'word';
          setSigningInputMode(nextMode);
          recognizerRef.current?.setMode(nextMode);
          if (recognizerRef.current?.playModeSwitchChime) {
            recognizerRef.current.playModeSwitchChime(nextMode);
          }
          setToastMessage(
            nextMode === 'fingerspell'
              ? 'Switched to Spell Letters (A-Z) Mode'
              : 'Switched to Whole ISL Words Mode'
          );
          setTimeout(() => setToastMessage(null), 3000);
          return;
        }

        // In pure ISL Word mode: allow 'I' (self-sign), but suppress single fingerspelling letters
        if (signingInputMode === 'word') {
          if ((token.length <= 1 && token !== 'I') || confirmed.type === 'letter') {
            return;
          }
        }

        // 1. Play subtle audio confirmation chime
        if (typeof window !== 'undefined') {
          try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
            osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
            gain.gain.setValueAtTime(0.12, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
            osc.start();
            osc.stop(ctx.currentTime + 0.18);
          } catch {}
        }

        // 2. Handle Fingerspelling Letter Confirmation
        if (confirmed.type === 'letter') {
          if (playActionRef.current) {
            playActionRef.current({
              type: 'letter',
              token: token.toUpperCase(),
              displayLabel: `Letter ${token.toUpperCase()}`,
              source: 'fingerspell_letter',
              durationMs: 1200,
            });
          }
          setToastMessage(`Spelled: Letter ${token.toUpperCase()}`);
          setTimeout(() => setToastMessage(null), 2000);

          setBufferedSignTokens((prev) => {
            const lastItem = prev[prev.length - 1];
            // Strict anti-repetition: Prevent identical consecutive letter spam while holding sign
            if (lastItem && lastItem.token === token.toUpperCase()) {
              return prev;
            }
            return [
              ...prev,
              {
                id: `${Date.now()}-${Math.random()}`,
                token: token.toUpperCase(),
                type: 'letter',
                displayLabel: token.toUpperCase(),
                timestamp: Date.now(),
              },
            ];
          });
          return;
        }

        // 2. Mirror on 3D Hologram Avatar: Play authentic .parquet dataset animation immediately!
        const TOKEN_TO_PARQUET: Record<string, string> = {
          'YES': 'good',
          'NO': 'bad',
          'HELLO': 'hello',
          'THANK YOU': 'thankyou',
          'GOOD MORNING': 'goodmorning',
          'GOOD NIGHT': 'goodnight',
          'HOW ARE YOU': 'howareyou',
          'DOCTOR': 'doctor',
          'HELP': 'help',
          'TIME': 'time',
          'HOUSE': 'house',
          'CAR': 'car',
          'BOOK': 'book',
          'MEETING': 'meeting',
          'WATER': 'water',
          'FOOD': 'food',
          'PLEASE': 'please',
          'WAIT': 'wait',
          'PERFECT': 'perfect',
          'I LOVE YOU': 'love',
        };
        const parquetWord = TOKEN_TO_PARQUET[token.toUpperCase()] || token.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (playActionRef.current) {
          playActionRef.current({
            type: 'word',
            token: token.toUpperCase(),
            displayLabel: confirmed.displayLabel || token,
            source: 'dataset_parquet',
            parquetWord,
            durationMs: 2200,
          });
        }

        // 3. Show instant visual confirmation toast
        setToastMessage(`Confirmed: ${confirmed.displayLabel || token} • Playing 3D Avatar Demo`);
        setTimeout(() => setToastMessage(null), 3000);

        // 4. Append to sentence dock buffer (Strictly prevents identical consecutive duplicates)
        setBufferedSignTokens((prev) => {
          const lastItem = prev[prev.length - 1];
          if (lastItem && lastItem.token.toUpperCase().trim() === token.toUpperCase().trim()) {
            return prev;
          }
          return [
            ...prev,
            {
              id: `${Date.now()}-${Math.random()}`,
              token,
              type: 'word',
              displayLabel: confirmed.displayLabel || token,
              timestamp: Date.now(),
            },
          ];
        });
      }
    }, signingInputMode, customSwitchSign);

    return () => {
      recognizer.stop();
      recognizerRef.current = null;
    };
  }, [isSignToSpeechActive, isVideoOn, isCameraStreamActive, signingInputMode, hasJoined, activeRole, viewMode, canvasReady, customSwitchSign]);

  // ─── 12. Microphone & Live Speech Recognition (Continuous with Auto-Restart) ──
  const toggleListening = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
      return;
    }

    if (isListeningRef.current || isListening) {
      isListeningRef.current = false;
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      setInterimTranscript('');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      isListeningRef.current = true;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let finalChunk = '';
        let interimChunk = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res.isFinal) {
            finalChunk += res[0]?.transcript || '';
          } else {
            interimChunk += res[0]?.transcript || '';
          }
        }

        const cleanedInterim = interimChunk.trim();
        const cleanedFinal = finalChunk.trim();

        if (cleanedFinal) {
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          setInterimTranscript('');
          socketRef.current?.emit('live-transcript', { roomId, transcript: '' });
          executeTranslateAndSignRef.current(cleanedFinal);
        } else if (cleanedInterim) {
          setInterimTranscript(cleanedInterim);
          // Broadcast live streaming subtitle to remote deaf participant in real time!
          socketRef.current?.emit('live-transcript', { roomId, transcript: cleanedInterim });

          // Auto-commit on natural pause (900ms) in case browser delays isFinal
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            if (cleanedInterim) {
              setInterimTranscript('');
              socketRef.current?.emit('live-transcript', { roomId, transcript: '' });
              executeTranslateAndSignRef.current(cleanedInterim);
            }
          }, 900);
        }
      };

      recognition.onerror = (e: any) => {
        if (e.error === 'no-speech') {
          // Normal pause in speech, keep listening active
          return;
        }
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          console.warn('[Speech Recognition] Permission denied:', e.error);
          isListeningRef.current = false;
          setIsListening(false);
          setInterimTranscript('');
        }
      };

      recognition.onend = () => {
        // Continuous auto-restart: if user hasn't explicitly stopped listening, keep listening
        if (isListeningRef.current) {
          try {
            recognition.start();
          } catch {
            setTimeout(() => {
              if (isListeningRef.current) {
                try {
                  recognition.start();
                } catch {}
              }
            }, 300);
          }
        } else {
          setIsListening(false);
          setInterimTranscript('');
        }
      };

      speechRecognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('[Speech Recognition Launch Error]:', err);
      isListeningRef.current = false;
      setIsListening(false);
    }
  };

  // ─── 13. Camera & Microphone Hardware Toggles ─────────────────────────────
  const toggleVideo = async () => {
    const next = !isVideoOn;
    setIsVideoOn(next);

    try {
      if (localStreamRef.current && localStreamRef.current.getVideoTracks().length > 0) {
        localStreamRef.current.getVideoTracks().forEach((track) => {
          track.enabled = next;
        });
      } else if (next) {
        // Camera track was missing/stopped — acquire new HD video track with fallback
        let newStream: MediaStream | null = null;
        try {
          newStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          });
        } catch {
          try {
            newStream = await navigator.mediaDevices.getUserMedia({ video: true });
          } catch (camErr) {
            console.warn('[Camera] Fallback video acquisition error:', camErr);
          }
        }

        const newVideoTrack = newStream?.getVideoTracks()[0];
        if (newVideoTrack) {
          if (!localStreamRef.current) {
            localStreamRef.current = newStream;
          } else {
            localStreamRef.current.addTrack(newVideoTrack);
          }
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
            localVideoRef.current.play().catch(() => {});
          }
          setIsCameraStreamActive(true);
          peerConnectionsRef.current.forEach((pc) => {
            pc.getTransceivers().forEach((transceiver) => {
              if (transceiver.receiver.track.kind === 'video' || transceiver.sender.track?.kind === 'video') {
                transceiver.sender.replaceTrack(newVideoTrack);
              }
            });
          });
        } else {
          setCameraError('Camera in use by another tab or app. Close other tabs using your webcam and click Retry.');
          setIsVideoOn(false);
          setIsCameraStreamActive(false);
        }
      }
    } catch (err) {
      console.warn('[Camera] Failed to toggle video track:', err);
    }

    socketRef.current?.emit('toggle-media', {
      roomId,
      state: { isVideoOff: !next },
    });
  };

  const requestCameraAccess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().then(() => setIsCameraStreamActive(true)).catch(() => {});
      }
      setIsCameraStreamActive(true);
      setIsVideoOn(true);
      setIsMicOn(true);

      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];

      peerConnectionsRef.current.forEach((pc) => {
        pc.getTransceivers().forEach((transceiver) => {
          if ((transceiver.receiver.track.kind === 'audio' || transceiver.sender.track?.kind === 'audio') && audioTrack) {
            transceiver.sender.replaceTrack(audioTrack);
          } else if ((transceiver.receiver.track.kind === 'video' || transceiver.sender.track?.kind === 'video') && videoTrack) {
            transceiver.sender.replaceTrack(videoTrack);
          }
        });
      });

      socketRef.current?.emit('toggle-media', {
        roomId,
        state: { isVideoOff: false, isMuted: false },
      });
    } catch (err) {
      console.warn('[Camera] Direct permission request note:', err);
    }
  };

  const toggleMic = async () => {
    const next = !isMicOn;
    setIsMicOn(next);

    // 1. Immediately toggle all audio tracks in localStreamRef
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = next;
      });
    }

    // 2. Immediately toggle all audio senders in all WebRTC peer connections
    peerConnectionsRef.current.forEach((pc) => {
      pc.getSenders().forEach((sender) => {
        if (sender.track && sender.track.kind === 'audio') {
          sender.track.enabled = next;
        }
      });
    });

    // 3. Sync speech recognition (if muting, stop transcription immediately so no spoken text or sign events leak)
    if (!next) {
      isListeningRef.current = false;
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      setInterimTranscript('');
    } else if (next && activeRoleRef.current === 'speaking_interviewer') {
      if (!isListeningRef.current) {
        toggleListening();
      }
    }

    // 4. If unmuting but local audio track was missing, acquire it
    if (next && (!localStreamRef.current || localStreamRef.current.getAudioTracks().length === 0)) {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const audioTrack = audioStream.getAudioTracks()[0];
          if (audioTrack) {
            audioTrack.enabled = true;
            if (!localStreamRef.current) {
              localStreamRef.current = audioStream;
            } else {
              localStreamRef.current.addTrack(audioTrack);
            }
            peerConnectionsRef.current.forEach((pc) => {
              pc.getTransceivers().forEach((transceiver) => {
                if (transceiver.receiver.track.kind === 'audio' || transceiver.sender.track?.kind === 'audio') {
                  transceiver.sender.replaceTrack(audioTrack);
                }
              });
            });
          }
        } catch (aErr) {
          console.warn('[Microphone] Could not acquire audio track:', aErr);
        }
      }
    }

    // 5. Broadcast authoritative mute state to all room participants
    socketRef.current?.emit('toggle-media', {
      roomId,
      state: { isMuted: !next },
    });
  };

  // ─── 14. Screen Sharing Support (Full 1080p WebRTC Replacement) ───────────
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      // 1. Stop screen stream
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
      }
      // 2. Restore local video element to camera
      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      // 3. Switch peer connection video tracks back to camera
      if (localStreamRef.current) {
        const cameraTrack = localStreamRef.current.getVideoTracks()[0];
        peerConnectionsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
          if (sender && cameraTrack) {
            sender.replaceTrack(cameraTrack);
          }
        });
      }
      setIsScreenSharing(false);
      setViewMode('grid');
      socketRef.current?.emit('toggle-media', { roomId, state: { isScreenSharing: false } });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: 1920, height: 1080, frameRate: 30 },
        audio: false,
      });

      screenStreamRef.current = stream;
      const screenTrack = stream.getVideoTracks()[0];

      setIsScreenSharing(true);
      setViewMode('presentation');
      socketRef.current?.emit('toggle-media', { roomId, state: { isScreenSharing: true } });

      // Replace video track on all existing peer connections
      peerConnectionsRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(screenTrack);
        }
      });

      // Browser native "Stop Sharing" button listener
      screenTrack.onended = () => {
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach((track) => track.stop());
          screenStreamRef.current = null;
        }
        if (localVideoRef.current && localStreamRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
        if (localStreamRef.current) {
          const cameraTrack = localStreamRef.current.getVideoTracks()[0];
          peerConnectionsRef.current.forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
            if (sender && cameraTrack) {
              sender.replaceTrack(cameraTrack);
            }
          });
        }
        setIsScreenSharing(false);
        setViewMode('grid');
        socketRef.current?.emit('toggle-media', { roomId, state: { isScreenSharing: false } });
      };
    } catch (err) {
      console.warn('[ScreenShare] Error or cancelled:', err);
    }
  };

  // ─── 15. In-Call Chat Messaging ───────────────────────────────────────────
  const sendChatMessage = (textOverride?: string) => {
    const text = (textOverride || chatDrawerInput).trim();
    if (!text) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msg: InCallChatMessage = {
      id: `${Date.now()}-${Math.random()}`,
      sender: displayName,
      role: userRole === 'deaf_signer' ? 'Deaf Participant' : 'Voice Speaker',
      text,
      time: timeStr,
      isSelf: true,
      isSigned: autoSignChat,
    };

    setChatMessages((prev) => [...prev, msg]);
    setChatDrawerInput('');

    if (socketRef.current?.connected) {
      socketRef.current.emit('chat-message', {
        roomId,
        message: {
          id: msg.id,
          sender: msg.sender,
          role: msg.role,
          text: msg.text,
          time: msg.time,
          isSigned: autoSignChat,
        },
      });
    }

    if (autoSignChat) {
      executeTranslateAndSign(text);
    }
  };

  // ─── 16. Robust Meeting Exit (Leave Call) ─────────────────────────────────
  const handleLeaveMeeting = () => {
    // Pro-rate partial minute block if active for >= 30s beyond last billed minute
    const finalSec = meetingDurationRef.current;
    const remainderSec = finalSec % 60;
    if (finalSec >= 30 && remainderSec >= 30) {
      deductCredits(5, 'Accessible Video Meeting (Partial 30s block)');
    }
    lastBilledMinuteRef.current = 0;
    meetingDurationRef.current = 0;

    // 1. Terminate all hardware & virtual tracks immediately
    if (virtualStreamControllerRef.current) {
      virtualStreamControllerRef.current.stop();
      virtualStreamControllerRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }

    // 2. Shut down all WebRTC peer connections
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    candidateQueuesRef.current.clear();

    // 3. Shut down speech recognition
    if (speechRecognitionRef.current) {
      try {
        isListeningRef.current = false;
        speechRecognitionRef.current.stop();
      } catch {}
    }

    // 4. Clear all playback & queue timers
    if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
    if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);
    if (standbyTimeoutRef.current) clearTimeout(standbyTimeoutRef.current);
    if (glideIntervalRef.current) clearInterval(glideIntervalRef.current);

    // 5. Notify socket & disconnect
    if (socketRef.current) {
      try {
        socketRef.current.emit('leave-room', { roomId });
        socketRef.current.disconnect();
      } catch {}
    }

    // 6. Save MoM record to localStorage & Firebase
    try {
      if (typeof window !== 'undefined') {
        const payload = {
          roomCode: roomId,
          meetingNotes: meetingNotesLog,
          chatMessages,
          durationSec: finalSec,
          savedAt: Date.now(),
        };
        localStorage.setItem(`sanket_mom_${roomId}`, JSON.stringify(payload));
        localStorage.setItem(`sanket_mom_${roomId.toUpperCase()}`, JSON.stringify(payload));
        localStorage.setItem('sanket_mom_latest', JSON.stringify(payload));
      }
    } catch {}

    try {
      saveMeetingNotes(roomId, meetingNotesLog, { durationSec: finalSec }).catch(() => {});
      endMeetingSession(roomId, { meetingNotes: meetingNotesLog, durationSec: finalSec }).catch(() => {});
    } catch {}

    // 7. Navigate cleanly back to dashboard
    window.location.href = `/dashboard`;
  };

  const getJoinUrl = () => {
    if (joinUrl) return joinUrl;
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/room/${roomId}`;
    }
    return '';
  };

  const copyMeetingLink = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const shareUrl = getJoinUrl();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      setIsLinkCopied(true);
      setToastMessage('Meeting invite link copied to clipboard! Send it to anyone to join.');
      setTimeout(() => {
        setIsCopied(false);
        setIsLinkCopied(false);
        setToastMessage(null);
      }, 3000);
    }
  };

  const openShareModal = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setShowShareModal(true);
  };

  const copyOnlyCode = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(roomId);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleNativeShare = async () => {
    const shareUrl = getJoinUrl();
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: 'Join Sanket AI Accessible Video Meeting',
          text: `Join our live accessible video meeting on Sanket AI (Room Code: ${roomId}):`,
          url: shareUrl,
        });
      } catch (err) {
        copyMeetingLink();
      }
    } else {
      copyMeetingLink();
    }
  };

  const handleJoinMeeting = () => {
    if (credits < 10) {
      setToastMessage('Account balance low. Please recharge credits to join video meeting.');
      openRechargeModal();
      return;
    }
    hasJoinedRef.current = true;
    setHasJoined(true);
    setActiveRole(selectedLobbyRole);
    activeRoleRef.current = selectedLobbyRole;

    const chosenName = lobbyName.trim() || displayName;
    effectiveDisplayNameRef.current = chosenName;

    // Cleanly stop lobby recognizer before transitioning to in-call recognition
    if (lobbyRecognizerRef.current) {
      lobbyRecognizerRef.current.stop();
      lobbyRecognizerRef.current = null;
    }

    if (meetingContext.trim()) {
      try {
        sessionStorage.setItem('sanket_meeting_context', meetingContext.trim());
      } catch {}
    }

    if (selectedLobbyRole === 'deaf_signer') {
      setIsSignToSpeechActive(true);
      setShowCaptions(true);
      setIsMicOn(false);
      setAvatarMode('hologram');
      if (isListeningRef.current) {
        toggleListening();
      }
      setToastMessage('Joined as Deaf Signer • ISL Sign-to-Speech active');
    } else {
      setIsSignToSpeechActive(false);
      setIsMicOn(true);
      setShowCaptions(true);
      setAvatarMode('3d_avatar');
      setToastMessage('Joined as Hearing Speaker • Voice-to-Sign active');
      setTimeout(() => {
        if (!isListeningRef.current) {
          toggleListening();
        }
      }, 500);
    }

    if (socketRef.current?.connected) {
      socketRef.current.emit('join-room', {
        roomId,
        user: {
          uid: socketRef.current.id,
          displayName: chosenName,
          role: selectedLobbyRole,
          isVideoOff: !isVideoOn,
          isMuted: selectedLobbyRole === 'deaf_signer' ? true : !isMicOn,
          isScreenSharing: false,
        },
      });
    }
  };

  const handleSwitchRole = (newRole: 'deaf_signer' | 'speaking_interviewer') => {
    setActiveRole(newRole);
    activeRoleRef.current = newRole;

    if (newRole === 'deaf_signer') {
      setIsSignToSpeechActive(true);
      setShowCaptions(true);
      setAvatarMode('hologram');
      if (isListeningRef.current) {
        toggleListening();
      }
      setToastMessage('Switched to Deaf Signer View: ISL Sign-to-Speech active');
    } else {
      setIsSignToSpeechActive(false);
      setIsMicOn(true);
      setShowCaptions(true);
      setAvatarMode('3d_avatar');
      if (!isListeningRef.current) {
        toggleListening();
      }
      setToastMessage('Switched to Hearing Speaker View: Live Voice-to-Sign active');
    }

    socketRef.current?.emit('toggle-media', {
      roomId,
      state: { role: newRole },
    });
    setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
  };

  if (!hasJoined) {
    const finalDisplayName = lobbyName.trim() || displayName;
    return (
      <div className="min-h-screen w-screen bg-slate-50 bg-grid-lines text-slate-900 flex flex-col justify-between font-sans select-none relative overflow-y-auto selection:bg-orange-500/20 selection:text-orange-600">
        {/* Header */}
        <header className="h-16 px-6 sm:px-10 flex items-center justify-between border-b border-slate-200/80 bg-white shadow-xs shrink-0">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-full bg-white text-slate-900 border border-slate-200 flex items-center justify-center font-black shadow-sm group-hover:scale-105 transition-transform">
              <Video className="w-4 h-4 text-orange-500" />
            </div>
            <span className="font-extrabold text-base text-slate-900 tracking-tight flex items-center font-heading">
              Sanket<span className="w-1.5 h-1.5 rounded-full bg-orange-500 ml-0.5 inline-block" />
              <span className="text-xs font-normal text-slate-500 border-l border-slate-200 pl-2.5 ml-2.5 font-sans">
                Meeting Lobby
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => openRechargeModal()}
              className="text-xs font-mono text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full border border-slate-200 flex items-center gap-1.5 transition cursor-pointer"
              title="Click to recharge wallet"
            >
              <Zap className="w-3.5 h-3.5 text-orange-500" />
              <span>Balance: <strong className="text-slate-900 font-bold">{credits} Cr</strong></span>
            </button>
            <span className="text-xs font-mono text-slate-700 bg-slate-100 px-3.5 py-1.5 rounded-full border border-slate-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Room: <strong className="text-slate-900 font-bold">{roomId}</strong>
            </span>
            <span className="text-xs font-mono text-slate-500 hidden sm:inline">
              {clockTime}
            </span>
          </div>
        </header>

        {/* Main Lobby Container */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 sm:py-8 flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-10">
          {/* Left Column: Camera Preview & Pre-Call Diagnostics Tile */}
          <div className="gsap-from-left w-full lg:w-[50%] flex flex-col">
            <div className="w-full aspect-video rounded-3xl bg-slate-950 border border-slate-300 overflow-hidden relative shadow-xl flex items-center justify-center">
              {/* Local Video Stream */}
              <video
                ref={(el) => {
                  lobbyVideoRef.current = el;
                  if (el && localStreamRef.current && el.srcObject !== localStreamRef.current) {
                    el.srcObject = localStreamRef.current;
                    el.play().catch(() => {});
                  }
                }}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${isVirtualCameraActive ? '' : 'scale-x-[-1]'} ${isVideoOn ? 'block' : 'hidden'}`}
              />

              {/* Hand Landmarks 21-Joint Overlay Canvas for Live Sign Testing in Lobby */}
              <canvas
                ref={lobbyCanvasRef}
                width={640}
                height={360}
                className={`absolute inset-0 w-full h-full pointer-events-none z-10 scale-x-[-1] object-cover ${
                  isVideoOn && selectedLobbyRole === 'deaf_signer' && isLobbySignTestActive ? 'block' : 'hidden'
                }`}
              />

              {!isVideoOn && !cameraError && (
                <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                  <div className="w-20 h-20 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl font-bold text-slate-200 shadow-lg">
                    {finalDisplayName.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-medium text-slate-400">Camera is off</span>
                </div>
              )}

              {/* Camera Locked / In-Use Error Alert Banner with One-Click Retry */}
              {cameraError && !isVirtualCameraActive && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 bg-slate-950/95 text-center gap-3 backdrop-blur-sm animate-in fade-in duration-200">
                  <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
                    <VideoOff className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-bold text-white">
                    Camera Locked by Another Tab / App
                  </div>
                  <p className="text-xs text-slate-300 max-w-sm leading-relaxed">
                    {cameraError}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap justify-center">
                    <button
                      type="button"
                      onClick={startVirtualCamera}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg transition cursor-pointer flex items-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Use Virtual Camera (2-Tab Test)</span>
                    </button>
                    <button
                      type="button"
                      onClick={retryCamera}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs shadow-lg transition cursor-pointer flex items-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Retry Real Camera</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Top Bar: Mode Switcher & Status */}
              <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-auto">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/75 backdrop-blur-md border border-white/10 text-[11px] font-mono font-medium text-slate-200">
                  <span className={`w-2 h-2 rounded-full ${isVideoOn ? (isVirtualCameraActive ? 'bg-indigo-400 animate-pulse' : 'bg-emerald-400 animate-pulse') : 'bg-rose-400'}`} />
                  {isVirtualCameraActive ? (
                    <span className="flex items-center gap-1.5 text-indigo-300">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Virtual Camera (Multi-Tab Active)</span>
                    </span>
                  ) : selectedLobbyRole === 'deaf_signer' ? (
                    <span className="flex items-center gap-1.5">
                      <Hand className="w-3.5 h-3.5 text-orange-400" />
                      <span>Pre-Call Sign Diagnostics</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Mic className="w-3.5 h-3.5 text-sky-400" />
                      <span>Pre-Call Voice Diagnostics</span>
                    </span>
                  )}
                </div>

                {isVirtualCameraActive && (
                  <button
                    type="button"
                    onClick={switchBackToHardwareCamera}
                    className="px-2.5 py-1 rounded-full text-[10px] font-mono bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-200 transition cursor-pointer"
                  >
                    Retry Real Cam
                  </button>
                )}

                {selectedLobbyRole === 'deaf_signer' && isVideoOn && (
                  <div className="flex items-center bg-black/75 backdrop-blur-md rounded-full p-1 border border-white/10 shadow-md">
                    <button
                      type="button"
                      onClick={() => {
                        setLobbySignTestMode('word');
                        lobbyRecognizerRef.current?.setMode('word');
                        setLobbyActiveTip(null);
                      }}
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition cursor-pointer ${
                        lobbySignTestMode === 'word'
                          ? 'bg-orange-500 text-white font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Words
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLobbySignTestMode('fingerspell');
                        lobbyRecognizerRef.current?.setMode('fingerspell');
                        setLobbyActiveTip(null);
                      }}
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition cursor-pointer ${
                        lobbySignTestMode === 'fingerspell'
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Letters
                    </button>
                  </div>
                )}
              </div>

              {/* Verified Sign Pop-up / Live Feedback Banner */}
              {selectedLobbyRole === 'deaf_signer' && isVideoOn && (
                <>
                  {lobbyConfirmedSign ? (
                    <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-4 py-2 rounded-2xl bg-emerald-950/95 border-2 border-emerald-400 text-white shadow-2xl flex items-center gap-2.5">
                        <Check className="w-5 h-5 text-emerald-400 shrink-0" />
                        <div>
                          <div className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                            Verified: &quot;{lobbyConfirmedSign}&quot;
                          </div>
                          <div className="text-[10px] text-slate-300 font-mono">
                            Camera &amp; AI calibrated for call!
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : lobbyCandidate ? (
                    <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 pointer-events-none animate-in fade-in duration-100">
                      <div className="px-4 py-2 rounded-2xl bg-slate-900/95 border border-orange-500 text-white shadow-2xl flex items-center gap-3">
                        <div className="relative w-6 h-6 flex items-center justify-center shrink-0">
                          <svg className="w-6 h-6 -rotate-90" viewBox="0 0 32 32">
                            <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="3" fill="none" className="text-slate-800" />
                            <circle
                              cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="3" fill="none"
                              strokeDasharray={2 * Math.PI * 13}
                              strokeDashoffset={(2 * Math.PI * 13) * (1 - Math.min(1, Math.max(0, lobbyHoldProgress)))}
                              className="text-orange-500"
                            />
                          </svg>
                          <span className="text-[8px] font-mono font-bold text-orange-400 absolute">
                            {Math.round(lobbyHoldProgress * 100)}%
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold uppercase text-white">
                            {lobbyCandidate.displayLabel || lobbyCandidate.token}
                          </span>
                          <span className="text-[9px] text-slate-300 font-mono">
                            Hold gesture to test...
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                      <div className="px-3.5 py-1.5 rounded-full bg-black/75 backdrop-blur-md border border-white/10 text-slate-300 text-[11px] font-mono flex items-center gap-2 shadow-lg">
                        <Hand className="w-3.5 h-3.5 text-orange-400" />
                        <span>Raise your hand to test signing</span>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Speaker Audio Meter in Preview */}
              {selectedLobbyRole === 'speaking_interviewer' && (
                <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                  <div className="px-4 py-2 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-sky-500/40 text-white shadow-xl flex items-center gap-3">
                    <div className="flex items-center gap-1 h-4">
                      {[1, 2, 3, 4, 5].map((bar) => {
                        const active = lobbyMicVolume > bar * 16;
                        return (
                          <div
                            key={bar}
                            className={`w-1 rounded-full transition-all duration-75 ${
                              active ? 'bg-emerald-400 h-4' : 'bg-slate-700 h-1.5'
                            }`}
                          />
                        );
                      })}
                    </div>
                    <div className="text-left font-mono">
                      <div className="text-[11px] font-bold text-sky-300">
                        {isMicOn ? (lobbyMicVolume > 10 ? 'Microphone Active (Sound Detected)' : 'Speak into mic to test volume') : 'Microphone Muted'}
                      </div>
                      <div className="text-[9px] text-slate-400">
                        Level: {lobbyMicVolume}%
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Controls on Preview */}
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4">
                <button
                  type="button"
                  onClick={toggleMic}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg cursor-pointer ${
                    isMicOn
                      ? 'bg-[#3c4043] hover:bg-[#474a4d] text-white border border-white/10'
                      : 'bg-rose-600 hover:bg-rose-500 text-white'
                  }`}
                  title={isMicOn ? 'Turn off microphone' : 'Turn on microphone'}
                >
                  {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </button>

                <button
                  type="button"
                  onClick={toggleVideo}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg cursor-pointer ${
                    isVideoOn
                      ? 'bg-[#3c4043] hover:bg-[#474a4d] text-white border border-white/10'
                      : 'bg-rose-600 hover:bg-rose-500 text-white'
                  }`}
                  title={isVideoOn ? 'Turn off camera' : 'Turn on camera'}
                >
                  {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Clean Diagnostics & Pre-Call Test Hub */}
            <div className="w-full mt-3 bg-white rounded-3xl border border-slate-200/90 shadow-md p-4 sm:p-5 flex flex-col gap-3.5">
              {/* Row 1: Real-Time Equipment & Pipeline Status */}
              <div className="flex items-center justify-between gap-2 text-xs font-mono pb-3 border-b border-slate-100 flex-wrap">
                <div className="flex items-center gap-1.5 text-slate-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Camera: <strong className="text-emerald-700 font-bold">{isVideoOn ? 'Active' : 'Off'}</strong></span>
                </div>

                {selectedLobbyRole === 'deaf_signer' ? (
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <span className={`w-2 h-2 rounded-full ${lobbyHandsDetected > 0 ? 'bg-emerald-500' : 'bg-amber-500 animate-ping'}`} />
                    <span>
                      {lobbyHandsDetected > 0 ? (
                        <strong className="text-emerald-700 font-bold">{lobbyHandsDetected} Hand in Frame</strong>
                      ) : (
                        <span className="text-amber-700 font-medium">Raise hand to test</span>
                      )}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <span className={`w-2 h-2 rounded-full ${isMicOn ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    <span>Mic: <strong className="text-slate-900 font-bold">{isMicOn ? `${lobbyMicVolume}% dB` : 'Muted'}</strong></span>
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-slate-700">
                  <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                  <span>AI Engine: <strong className="text-orange-600 font-bold">261 Signs + A-Z</strong></span>
                </div>
              </div>

              {/* Row 2: Role-Specific Interactive Test */}
              {selectedLobbyRole === 'deaf_signer' ? (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Hand className="w-3.5 h-3.5 text-orange-500" />
                      <span>Quick Sign Test:</span>
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Hold gesture 0.4s to verify
                    </span>
                  </div>

                  {/* Clean Single-Row Sign Chips */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { label: 'Hello', hint: 'Raise open flat palm near temple and wave gently outward.' },
                      { label: 'Thank You', hint: 'Touch fingertips of flat hand to chin and move forward towards camera.' },
                      { label: 'Doctor', hint: 'Tap index & middle fingertips of dominant hand onto opposite wrist.' },
                      { label: 'Yes / Good', hint: 'Make a fist with thumb extended upright.' },
                      { label: 'Letters (A-Z)', hint: 'Switch to fingerspell mode to test spelling letters.' },
                    ].map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => {
                          if (item.label.includes('Letters')) {
                            const newMode = lobbySignTestMode === 'word' ? 'fingerspell' : 'word';
                            setLobbySignTestMode(newMode);
                            lobbyRecognizerRef.current?.setMode(newMode);
                            setLobbyActiveTip(null);
                          } else {
                            setLobbyActiveTip({ label: item.label, tip: item.hint });
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Active Sign Tip if clicked */}
                  {lobbyActiveTip && (
                    <div className="p-2.5 rounded-xl bg-orange-50 border border-orange-200 text-xs text-orange-950 flex items-start justify-between gap-2 animate-in fade-in duration-150 shadow-xs">
                      <div>
                        <strong className="text-orange-900 mr-1">{lobbyActiveTip.label}:</strong>
                        <span className="text-orange-800">{lobbyActiveTip.tip}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setLobbyActiveTip(null)}
                        className="text-orange-500 hover:text-orange-900 text-xs font-bold"
                      >
                        ×
                      </button>
                    </div>
                  )}

                  {/* Tested signs confirmation badge if any tested */}
                  {lobbyTestedSigns.length > 0 && (
                    <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-950 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-bold text-emerald-800 text-[11px]">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Calibrated ({lobbyTestedSigns.length} gestures verified)</span>
                      </span>
                      <span className="text-[10px] text-emerald-700 font-mono">100% Ready</span>
                    </div>
                  )}

                  {/* Compact Hands-Free Mode Switch Sign Dropdown/Accordion */}
                  <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowSwitchSettings(!showSwitchSettings)}
                      className="flex items-center justify-between text-[11px] font-mono text-slate-600 hover:text-slate-900 cursor-pointer w-full text-left"
                    >
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-orange-500" />
                        <span>Hands-Free Switch Sign: <strong className="text-slate-800 underline">{AVAILABLE_SWITCH_SIGNS.find(s => s.id === customSwitchSign)?.name || customSwitchSign}</strong></span>
                      </span>
                      <span className="text-orange-600 font-bold">{showSwitchSettings ? 'Close' : 'Change'}</span>
                    </button>

                    {showSwitchSettings && (
                      <div className="grid grid-cols-2 gap-1.5 pt-1 animate-in fade-in duration-150">
                        {AVAILABLE_SWITCH_SIGNS.map((sign) => {
                          const isSelected = customSwitchSign === sign.id;
                          return (
                            <button
                              key={sign.id}
                              type="button"
                              onClick={() => {
                                handleSelectSwitchSign(sign.id);
                                setShowSwitchSettings(false);
                              }}
                              className={`p-2 rounded-xl border text-left text-xs transition cursor-pointer ${
                                isSelected
                                  ? 'bg-orange-50 border-orange-500 text-orange-950 font-bold shadow-xs'
                                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold">{sign.name}</span>
                                {isSelected && <span className="text-[9px] bg-orange-500 text-white px-1 rounded">Active</span>}
                              </div>
                              <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">{sign.instruction}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Speaker / Doctor View */
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Mic className="w-3.5 h-3.5 text-sky-500" />
                      <span>Microphone Test:</span>
                    </span>
                    <button
                      type="button"
                      onClick={testLobbyVoice}
                      disabled={isLobbyVoiceTesting}
                      className={`px-3 py-1 rounded-xl text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                        isLobbyVoiceTesting
                          ? 'bg-sky-500 text-white font-bold animate-pulse'
                          : 'bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-300'
                      }`}
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>{isLobbyVoiceTesting ? 'Listening...' : 'Test Speech Now'}</span>
                    </button>
                  </div>

                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden flex border border-slate-200">
                    <div
                      className={`h-full transition-all duration-75 rounded-full ${
                        lobbyMicVolume > 70 ? 'bg-rose-500' : lobbyMicVolume > 30 ? 'bg-emerald-500' : 'bg-sky-500'
                      }`}
                      style={{ width: `${Math.max(4, isMicOn ? lobbyMicVolume : 0)}%` }}
                    />
                  </div>

                  {lobbyVoiceTestTranscript && (
                    <div className="p-2 rounded-xl bg-sky-50 border border-sky-300 text-sky-950 font-mono text-[11px]">
                      {lobbyVoiceTestTranscript}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Clean, Contained Pre-Join Card */}
          <div className="gsap-from-right w-full lg:w-[50%] bg-white rounded-3xl border border-slate-200/90 shadow-xl p-6 sm:p-8 flex flex-col justify-between space-y-5">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-orange-600 font-mono bg-orange-50 px-2.5 py-1 rounded-full border border-orange-200">
                  Pre-Call Setup
                </span>
                <span className="text-xs font-mono text-slate-500">
                  Room: <strong className="text-slate-900 font-bold">{roomId}</strong>
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-heading mt-2">
                Ready to join?
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 font-sans">
                Choose your accessibility mode and join the session.
              </p>
            </div>

            {/* Field 1: Your Display Name */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider font-mono">
                Your Name
              </label>
              <input
                type="text"
                value={lobbyName}
                onChange={(e) => setLobbyName(e.target.value)}
                placeholder={displayName || 'Enter your name'}
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 font-semibold text-sm focus:outline-none focus:border-orange-500 focus:bg-white shadow-xs transition placeholder-slate-400"
              />
            </div>

            {/* Field 2: Role Selection (Signer vs Speaker) */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider font-mono">
                Choose Your Role:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Role 1: Deaf Signer */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLobbyRole('deaf_signer');
                    setAvatarMode('hologram');
                    setIsSignToSpeechActive(true);
                  }}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                    selectedLobbyRole === 'deaf_signer'
                      ? 'bg-orange-50/80 border-2 border-orange-500 ring-2 ring-orange-500/10 shadow-sm'
                      : 'bg-slate-50/80 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center border border-orange-200">
                      <Hand className="w-4 h-4 text-orange-600" />
                    </div>
                    {selectedLobbyRole === 'deaf_signer' && (
                      <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 font-heading">
                      Deaf Signer
                    </h4>
                    <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                      I communicate using Indian Sign Language (ISL).
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-orange-700 font-medium">
                    ✓ ISL Camera Sign-to-Speech
                  </span>
                </button>

                {/* Role 2: Hearing Speaker */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLobbyRole('speaking_interviewer');
                    setAvatarMode('3d_avatar');
                    setIsSignToSpeechActive(false);
                  }}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                    selectedLobbyRole === 'speaking_interviewer'
                      ? 'bg-sky-50/80 border-2 border-sky-500 ring-2 ring-sky-500/10 shadow-sm'
                      : 'bg-slate-50/80 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center border border-sky-200">
                      <Mic className="w-4 h-4 text-sky-600" />
                    </div>
                    {selectedLobbyRole === 'speaking_interviewer' && (
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 font-heading">
                      Hearing Speaker
                    </h4>
                    <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                      I communicate using my spoken voice.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-sky-700 font-medium">
                    ✓ Real-Time 3D Sign Avatar
                  </span>
                </button>
              </div>
            </div>

            {/* Field 3: Meeting Context / Topic (Clean Accordion) */}
            <div className="border border-slate-200/90 rounded-2xl p-3 bg-slate-50/60">
              <button
                type="button"
                onClick={() => setShowLobbyContext(!showLobbyContext)}
                className="w-full flex items-center justify-between text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                  <span>Topic &amp; Biography (Context for AI Translation)</span>
                </span>
                <span className="text-orange-600 font-mono text-[11px] font-bold">
                  {showLobbyContext ? 'Hide' : meetingContext ? 'Edit' : '+ Add'}
                </span>
              </button>

              {showLobbyContext && (
                <div className="mt-2.5 space-y-2 animate-in fade-in duration-150">
                  <textarea
                    rows={2}
                    value={meetingContext}
                    onChange={(e) => setMeetingContext(e.target.value)}
                    placeholder="e.g. Doctor consultation for fever and headache."
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-orange-500 resize-none shadow-xs"
                  />
                  <div className="flex items-center gap-1 flex-wrap">
                    {[
                      { label: 'Doctor', text: `Medical consultation with doctor for health checkup.` },
                      { label: 'Job Interview', text: `Candidate interview for software engineer role.` },
                      { label: 'Class', text: `Student attending academic lecture and discussion.` },
                      { label: 'Personal', text: `Casual conversation with family and friends.` },
                    ].map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => setMeetingContext(item.text)}
                        className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-[10px] font-mono text-slate-700 shadow-xs cursor-pointer"
                      >
                        + {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Field 4: AI Model & Custom Key Setting */}
            <div className="border border-slate-200/90 rounded-2xl p-3 bg-slate-50/70 hover:bg-slate-50 transition">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center border border-orange-200 shrink-0">
                    <Sliders className="w-4 h-4 text-orange-600" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span>AI Model &amp; Custom API Key</span>
                      {customApiKey ? (
                        <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-mono font-bold">
                          Custom
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 text-[9px] font-mono font-bold">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      Active: <strong className="text-slate-800">{customModel}</strong>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowSettingsModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-orange-50 border border-slate-200 hover:border-orange-300 text-orange-600 font-bold text-xs shadow-xs transition cursor-pointer"
                >
                  Configure
                </button>
              </div>
            </div>

            {/* Action Row: Big Join Button */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleJoinMeeting}
                className="w-full py-4 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-black text-base shadow-xl shadow-orange-500/25 transition-all hover:scale-[1.01] flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>
                  {selectedLobbyRole === 'deaf_signer' && lobbyTestedSigns.length > 0
                    ? `Join Meeting (${lobbyTestedSigns.length} Signs Verified)`
                    : 'Join Meeting Now'}
                </span>
                <ArrowRight className="w-5 h-5" />
              </button>

              <div className="text-center text-[11px] text-slate-500 font-mono">
                Direct P2P Encrypted WebRTC Video • Live Indian Sign Language AI
              </div>
            </div>

          </div>
        </main>

        {/* AI Key & Model Configuration Modal for Lobby */}
        {showSettingsModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-7 shadow-2xl max-w-lg w-full text-slate-900 space-y-5 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600">
                    <Sliders className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 font-heading">AI Model &amp; API Key Settings</h3>
                    <p className="text-xs text-slate-500">Bring Your Own Key (BYOK) for custom model translation.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Custom Gemini API Key */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 font-mono flex items-center justify-between">
                  <span>Google Gemini API Key</span>
                  <span className="text-[10px] text-slate-400">Stored safely in local browser</span>
                </label>
                <input
                  type="password"
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  placeholder="AIzaSy... (Leave blank to use Platform Key)"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono text-xs focus:outline-none focus:border-orange-500 focus:bg-white shadow-xs transition"
                />
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Your custom key will be used for real-time speech-to-ISL and camera sign-to-speech AI sentence synthesis.
                </p>
              </div>

              {/* Model Name Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 font-mono">
                  Select Model Version
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setCustomModel(m)}
                      className={`py-2 px-2 rounded-xl text-xs font-mono text-center border transition cursor-pointer ${
                        customModel === m
                          ? 'bg-orange-50 border-orange-500 text-orange-950 font-bold shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  placeholder="Or enter custom model name (e.g. gemini-2.5-flash)..."
                  className="w-full px-4 py-2 mt-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono text-xs focus:outline-none focus:border-orange-500 focus:bg-white shadow-xs transition"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => saveAiSettings(customApiKey, customModel)}
                  className="flex-1 py-3 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs transition shadow-md shadow-orange-500/25 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Save &amp; Apply Settings</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    saveAiSettings('', 'gemini-2.0-flash');
                    setCustomApiKey('');
                    setCustomModel('gemini-2.0-flash');
                  }}
                  className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition cursor-pointer"
                >
                  Reset Default
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-white overflow-hidden select-none font-sans relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-slate-700 text-white px-5 py-2.5 rounded-full shadow-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-3 duration-200 pointer-events-auto">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ─── 1. Sanket AI Top Header Bar ────────────────────────────── */}
      <header className="h-14 sm:h-16 px-4 sm:px-6 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between z-20 shrink-0">
        {/* Left: Brand Icon, Name, Room Code & Role Badge */}
        <div className="flex items-center gap-3 sm:gap-4">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-full bg-white text-slate-900 flex items-center justify-center font-black shadow-md group-hover:scale-105 transition-transform">
              <Video className="w-4 h-4 text-orange-500" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-sm sm:text-base text-white tracking-tight flex items-center">
                Sanket<span className="w-1.5 h-1.5 rounded-full bg-orange-500 ml-0.5 inline-block" />
                <span className="text-[11px] font-medium text-slate-400 border-l border-slate-800 pl-2 ml-2 hidden sm:inline">
                  Meeting Studio
                </span>
              </span>
              <button
                type="button"
                onClick={copyMeetingLink}
                className="text-[11px] text-slate-400 hover:text-orange-400 font-mono flex items-center gap-1 transition text-left cursor-pointer"
                title="Click to copy room link"
              >
                Room: <strong className="text-orange-400">{roomId}</strong>
                <Copy className="w-2.5 h-2.5 opacity-60 hover:opacity-100" />
              </button>
            </div>
          </Link>

          <span className="hidden lg:inline-flex px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[10px] font-medium items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>{activeRole === 'deaf_signer' ? 'Deaf Signer' : 'Voice Speaker'}</span>
          </span>
        </div>

        {/* Center: Clean Layout Mode Switcher */}
        <div className="flex items-center bg-slate-900 rounded-full p-1 border border-slate-800 text-xs shadow-inner">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 transition font-medium cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-slate-800 text-white font-bold shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Google Meet Grid Layout"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Grid</span>
          </button>
          <button
            onClick={() => setViewMode('signer_focus')}
            className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 transition font-medium cursor-pointer ${
              viewMode === 'signer_focus'
                ? 'bg-orange-500 text-white font-bold shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
            title="3D Signer Focus Layout"
          >
            <HandMetal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Signer Focus</span>
          </button>
          {(isScreenSharing || Array.from(remoteParticipants.values()).some((p) => p.isScreenSharing)) && (
            <button
              onClick={() => setViewMode('presentation')}
              className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 transition font-medium cursor-pointer ${
                viewMode === 'presentation'
                  ? 'bg-orange-500 text-white font-bold shadow-xs'
                  : 'text-orange-400 hover:text-orange-300'
              }`}
              title="Screen Presentation Layout"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Presentation</span>
            </button>
          )}
        </div>

        {/* Right: Clean Utility & Status Group (Google Meet Minimalist Standard) */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Automated Bilingual Clinical / Meeting Minutes Generator */}
          <button
            type="button"
            onClick={() => setShowMeetingNotesModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 text-xs font-semibold text-slate-200 hover:text-emerald-400 transition cursor-pointer"
            title="Export Bilingual Meeting Minutes & Clinical Records"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Minutes</span>
            {meetingNotesLog.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold">
                {meetingNotesLog.length}
              </span>
            )}
          </button>

          {/* Meeting Clock / Duration */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{formatTime(meetingDurationSec)}</span>
          </div>

          {/* More Options Popover Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowHeaderMoreMenu(!showHeaderMoreMenu)}
              className={`p-2 rounded-full border transition cursor-pointer ${
                showHeaderMoreMenu
                  ? 'bg-orange-500 text-white border-orange-500 shadow-md'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300 hover:text-white'
              }`}
              title="More Options & Settings"
            >
              <Sliders className="w-4 h-4" />
            </button>

            {showHeaderMoreMenu && (
              <div className="absolute right-0 top-12 w-64 bg-slate-900/98 backdrop-blur-2xl border border-slate-800 rounded-2xl p-2 shadow-2xl z-50 text-xs text-slate-200 animate-in fade-in zoom-in-95 duration-150 space-y-1">
                <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold border-b border-slate-800">
                  Meeting Tools
                </div>

                {/* Role Switcher */}
                <div className="p-1">
                  <div className="text-[11px] text-slate-400 px-2 py-1">Active Role:</div>
                  <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-950 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        handleSwitchRole('deaf_signer');
                        setShowHeaderMoreMenu(false);
                      }}
                      className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer ${
                        activeRole === 'deaf_signer'
                          ? 'bg-orange-500 text-white font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Hand className="w-3 h-3" />
                      <span>Signer</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleSwitchRole('speaking_interviewer');
                        setShowHeaderMoreMenu(false);
                      }}
                      className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer ${
                        activeRole === 'speaking_interviewer'
                          ? 'bg-sky-500 text-white font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Mic className="w-3 h-3" />
                      <span>Speaker</span>
                    </button>
                  </div>
                </div>

                {/* LLM Context */}
                <button
                  type="button"
                  onClick={() => {
                    setShowContextModal(true);
                    setShowHeaderMoreMenu(false);
                  }}
                  className="w-full px-3 py-2 rounded-xl hover:bg-slate-800 flex items-center gap-2.5 transition text-left cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-orange-400 shrink-0" />
                  <div className="flex-1">
                    <div className="font-semibold text-white">LLM Context &amp; Bio</div>
                    <div className="text-[10px] text-slate-400">Contextual medical &amp; meeting vocabulary</div>
                  </div>
                </button>

                {/* Sign Postures Guide */}
                <button
                  type="button"
                  onClick={() => {
                    setShowSignGuideModal(true);
                    setShowHeaderMoreMenu(false);
                  }}
                  className="w-full px-3 py-2 rounded-xl hover:bg-slate-800 flex items-center gap-2.5 transition text-left cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="flex-1">
                    <div className="font-semibold text-white">ISL Sign Guide</div>
                    <div className="text-[10px] text-slate-400">262 certified postures &amp; alphabet</div>
                  </div>
                </button>

                {/* Share Link */}
                <button
                  type="button"
                  onClick={() => {
                    openShareModal();
                    setShowHeaderMoreMenu(false);
                  }}
                  className="w-full px-3 py-2 rounded-xl hover:bg-slate-800 flex items-center gap-2.5 transition text-left cursor-pointer"
                >
                  <Share2 className="w-4 h-4 text-sky-400 shrink-0" />
                  <div className="flex-1">
                    <div className="font-semibold text-white">Share Meeting Link</div>
                    <div className="text-[10px] text-slate-400">Copy URL or invite colleagues</div>
                  </div>
                </button>

                {/* AI Model Settings */}
                <button
                  type="button"
                  onClick={() => {
                    setShowSettingsModal(true);
                    setShowHeaderMoreMenu(false);
                  }}
                  className="w-full px-3 py-2 rounded-xl hover:bg-slate-800 flex items-center gap-2.5 transition text-left cursor-pointer"
                >
                  <Sliders className="w-4 h-4 text-amber-400 shrink-0" />
                  <div className="flex-1">
                    <div className="font-semibold text-white">Model &amp; API Settings</div>
                    <div className="text-[10px] text-slate-400">Custom Gemini key &amp; parameters</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ─── Participant Roster Dropdown Modal ────────────────────────────── */}
      {showParticipantList && (
        <div className="fixed bottom-24 right-4 sm:right-6 z-50 bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-3xl p-5 shadow-2xl w-80 sm:w-88 text-white animate-in fade-in slide-in-from-bottom-3 duration-150 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h4 className="font-bold text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-orange-400" />
              <span>Participants ({1 + remoteParticipants.size})</span>
            </h4>
            <button
              onClick={() => setShowParticipantList(false)}
              className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {/* You (Host) */}
            <div className="p-2.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-xs" suppressHydrationWarning>
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span suppressHydrationWarning>{displayName}</span>
                    <span className="text-[10px] text-orange-400 font-mono">(You)</span>
                  </div>
                  <div className="text-[10px] text-slate-400 capitalize">
                    {userRole === 'deaf_signer' ? 'Deaf Signer' : 'Voice Speaker'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                {isMicOn ? <Mic className="w-3.5 h-3.5 text-emerald-400" /> : <MicOff className="w-3.5 h-3.5 text-rose-400" />}
                {isVideoOn ? <Video className="w-3.5 h-3.5 text-slate-200" /> : <VideoOff className="w-3.5 h-3.5 text-rose-400" />}
              </div>
            </div>

            {/* Remote Peers */}
            {Array.from(remoteParticipants.values()).map((p) => (
              <div
                key={p.socketId}
                className="p-2.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center font-bold text-xs">
                    {p.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white truncate max-w-[130px]">
                      {p.displayName}
                    </div>
                    <div className="text-[10px] text-slate-400 capitalize">
                      {p.role === 'deaf_signer' ? 'Deaf Signer' : 'Voice Speaker'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  {p.isMuted ? <MicOff className="w-3.5 h-3.5 text-rose-400" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
                  {p.isVideoOff ? <VideoOff className="w-3.5 h-3.5 text-rose-400" /> : <Video className="w-3.5 h-3.5 text-slate-200" />}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-800">
            <button
              onClick={copyMeetingLink}
              className="w-full py-2 px-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Invite More People</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── 2. Main Stage (Google Meet Layout with WebRTC Peers & ISL Hologram) ── */}
      <div className="flex-1 flex overflow-hidden relative">
        {(() => {
          const remoteList = Array.from(remoteParticipants.values());
          const activePresenter = isScreenSharing
            ? {
                id: 'local',
                name: `${displayName} (You)`,
                isLocal: true,
                stream: screenStreamRef.current || localStreamRef.current,
              }
            : remoteList.find((p) => p.isScreenSharing)
            ? {
                id: remoteList.find((p) => p.isScreenSharing)!.socketId,
                name: remoteList.find((p) => p.isScreenSharing)!.displayName,
                isLocal: false,
                stream: remoteList.find((p) => p.isScreenSharing)!.stream,
              }
            : null;

          const isPresenting = Boolean(activePresenter) || viewMode === 'presentation';

          // Helper: Render Local User Camera Tile
          const renderLocalTile = (isCompact = false, isFloating = false) => {
            return (
              <div
                key="local-user-tile"
                className={`flex flex-col rounded-3xl bg-slate-900 border border-slate-800/80 overflow-hidden relative shadow-2xl transition-all ${
                  isFloating
                    ? 'w-56 sm:w-64 h-36 sm:h-40 absolute bottom-20 right-6 z-30 shadow-2xl border-orange-500/60 ring-2 ring-orange-500/30 hover:scale-105'
                    : isCompact
                    ? 'h-44 sm:h-52 w-full shrink-0'
                    : 'flex-1 w-full h-full min-h-[240px]'
                }`}
              >
                {/* Minimal Top-Right Status Badge (Unobstructed View) */}
                <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 pointer-events-auto">
                  {isVirtualCameraActive ? (
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-950/80 backdrop-blur-md border border-indigo-500/40 text-indigo-300 text-[10px] font-mono shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                      <span>Virtual Cam</span>
                    </div>
                  ) : null}

                  {isSignToSpeechActive && isVideoOn ? (
                    <div className="flex items-center gap-1 bg-slate-950/85 backdrop-blur-md rounded-full px-2 py-0.5 border border-slate-700/80 shadow-md">
                      <button
                        type="button"
                        onClick={() => handleToggleSigningMode(signingInputMode === 'word' ? 'fingerspell' : 'word')}
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold transition flex items-center gap-1 cursor-pointer ${
                          signingInputMode === 'word' ? 'bg-orange-500 text-white' : 'bg-amber-400 text-slate-950'
                        }`}
                        title="Click to toggle between Words and Fingerspelling"
                      >
                        <Hand className="w-3 h-3" />
                        <span>{signingInputMode === 'word' ? 'Words' : 'Spelling'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowSignGuideModal(true)}
                        className="p-1 rounded-full text-slate-400 hover:text-white transition cursor-pointer"
                        title="Open ISL Sign Postures Guide"
                      >
                        <BookOpen className="w-3 h-3 text-orange-400" />
                      </button>
                    </div>
                  ) : null}

                  {!isSignToSpeechActive ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/85 backdrop-blur-md border border-sky-500/30 text-sky-300 text-[10px] font-mono shadow-sm">
                      <Mic className="w-3 h-3 text-sky-400" />
                      <span>Voice</span>
                    </div>
                  ) : null}

                  {isFloating ? (
                    <button
                      onClick={() => setIsLocalPiPDocked(true)}
                      className="px-2.5 py-1 rounded-full bg-slate-900/90 hover:bg-slate-800 text-xs font-mono text-slate-300 border border-slate-700 cursor-pointer"
                      title="Dock to side"
                    >
                      Dock
                    </button>
                  ) : null}
                </div>

              {/* Video Viewport Container */}
              <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden">
                <video
                  ref={(el) => {
                    localVideoRef.current = el;
                    if (el && localStreamRef.current && el.srcObject !== localStreamRef.current) {
                      el.srcObject = localStreamRef.current;
                      el.play().then(() => {
                        setIsCameraStreamActive(true);
                      }).catch(() => {});
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  onLoadedMetadata={() => {
                    setIsCameraStreamActive(true);
                  }}
                  onPlay={() => {
                    setIsCameraStreamActive(true);
                  }}
                  onPlaying={() => {
                    setIsCameraStreamActive(true);
                  }}
                  className={`w-full h-full ${
                    isScreenSharing || isVirtualCameraActive ? 'object-contain' : 'object-cover scale-x-[-1]'
                  }`}
                />

                {/* Hands 21-Joint Landmarks Wireframe Overlay Canvas */}
                <canvas
                  ref={(el) => {
                    landmarksCanvasRef.current = el;
                    if (el && canvasReady === 0) {
                      setCanvasReady(1);
                    }
                  }}
                  width={640}
                  height={480}
                  className={`absolute inset-0 w-full h-full pointer-events-none z-10 scale-x-[-1] object-cover transition-opacity duration-300 ${
                    isSignToSpeechActive && isVideoOn && !isScreenSharing ? 'opacity-100' : 'opacity-0'
                  }`}
                />

                {/* Floating 3D Sign Emoji Reaction Overlay */}
                {floatingReaction && (
                  <div className="absolute top-16 right-4 z-30 pointer-events-none animate-in fade-in zoom-in-75 slide-in-from-top-4 duration-300">
                    <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-slate-950/90 backdrop-blur-xl border border-amber-500/60 text-white shadow-2xl shadow-amber-500/30 ring-2 ring-amber-400/30">
                      <span className="text-2xl animate-bounce">{floatingReaction.icon}</span>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-mono font-bold tracking-wider text-amber-400 uppercase">3D SIGN REACTION</span>
                        <span className="text-xs font-black text-white">{floatingReaction.name}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── Non-Intrusive Signer Zone Cue (Bottom-Centered Toast - Never Obstructs Face/Chest) ─── */}
                {isSignToSpeechActive && isVideoOn && !isScreenSharing && framingStatus.zoneState !== 'optimal' && framingStatus.zoneState !== 'no_hands' && (
                  <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none animate-in fade-in duration-200">
                    <div className="px-3.5 py-1.5 rounded-full bg-slate-950/90 backdrop-blur-md border border-amber-500/50 text-[11px] font-mono text-amber-300 flex items-center gap-2 shadow-xl">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>{framingStatus.message}</span>
                    </div>
                  </div>
                )}

                {/* Hand Moving Settle Indicator */}
                {isSignToSpeechActive && isHandMoving && isVideoOn && !isScreenSharing && (
                  <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 pointer-events-none animate-in fade-in duration-100">
                    <div className="px-3.5 py-1.5 rounded-full bg-slate-900/90 backdrop-blur-md border border-amber-500/40 text-[11px] font-mono text-amber-300 flex items-center gap-2 shadow-xl">
                      <Hand className="w-3.5 h-3.5 text-amber-400" />
                      <span>Hand moving... Hold pose to sign</span>
                    </div>
                  </div>
                )}

                {/* Live Hold-to-Confirm Radial Meter & Candidate Badge */}
                {isSignToSpeechActive && detectedSignCandidate && (!isHandMoving || holdProgress >= 1) && (
                  <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                    <div className={`px-4 py-2 rounded-2xl backdrop-blur-xl border flex items-center gap-3 shadow-2xl transition-all ${
                      holdProgress >= 1
                        ? 'bg-emerald-950/95 border-emerald-400 text-emerald-200 ring-2 ring-emerald-500/30 scale-105'
                        : 'bg-slate-900/95 border-orange-500/60 text-white shadow-orange-950/40'
                    }`}>
                      {/* Circular SVG Radial Meter */}
                      <div className="relative w-7 h-7 flex items-center justify-center shrink-0">
                        <svg className="w-7 h-7 -rotate-90" viewBox="0 0 32 32">
                          <circle
                            cx="16"
                            cy="16"
                            r="13"
                            stroke="currentColor"
                            strokeWidth="3.5"
                            fill="none"
                            className="text-slate-800"
                          />
                          <circle
                            cx="16"
                            cy="16"
                            r="13"
                            stroke="currentColor"
                            strokeWidth="3.5"
                            fill="none"
                            strokeDasharray={2 * Math.PI * 13}
                            strokeDashoffset={(2 * Math.PI * 13) * (1 - Math.min(1, Math.max(0, holdProgress)))}
                            strokeLinecap="round"
                            className={holdProgress >= 1 ? 'text-emerald-400' : 'text-orange-500 transition-all duration-75'}
                          />
                        </svg>
                        {holdProgress >= 1 ? (
                          <Check className="w-3.5 h-3.5 text-emerald-300 absolute" />
                        ) : (
                          <span className="text-[9px] font-mono font-bold text-orange-400 absolute">
                            {Math.round(holdProgress * 100)}%
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold tracking-wide text-white uppercase">
                            {detectedSignCandidate.displayLabel || detectedSignCandidate.token}
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold ${
                            detectedSignCandidate.type === 'letter'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                              : 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                          }`}>
                            {detectedSignCandidate.type === 'letter' ? 'Letter' : 'ISL Word'}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-300 font-mono">
                          {holdProgress >= 1 ? 'Confirmed' : 'Hold gesture to confirm...'}
                        </span>
                        {detectedSignCandidate.topK && detectedSignCandidate.topK.length > 1 && (
                          <div className="flex items-center gap-1 mt-0.5 text-[9px] font-mono text-slate-400">
                            <span className="text-slate-500">Alt:</span>
                            {detectedSignCandidate.topK.slice(1, 4).map((alt, aIdx) => (
                              <span key={aIdx} className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-slate-300">
                                {alt.token} ({Math.round(alt.confidence * 100)}%)
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Sentence Construction Buffer Bar & Live Grammatical Expansion */}
                {bufferedSignTokens.length > 0 && (
                  <div className="absolute bottom-12 left-2 right-2 z-20 pointer-events-auto animate-in slide-in-from-bottom-2 duration-150 flex flex-col gap-1.5">
                    {/* Active Fingerspelling Word Assembly & Completion Pill */}
                    {activeSpelledWord.length > 0 && (
                      <div className="bg-slate-900/95 backdrop-blur-xl border border-amber-500/40 rounded-2xl px-3.5 py-2.5 shadow-xl flex items-center justify-between gap-2 animate-in fade-in duration-150 flex-wrap">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="text-[10px] uppercase font-mono font-bold text-amber-400 shrink-0">
                            Spelled:
                          </span>
                          <span className="text-xs font-mono font-black text-amber-300 tracking-wider bg-amber-500/20 px-2.5 py-1 rounded-lg border border-amber-500/40">
                            {activeSpelledWord}
                          </span>
                          {activePredictions.length > 0 && activeSpelledWord.length >= 2 && (
                            <span className="hidden sm:inline text-[10px] text-amber-400/90 font-mono animate-pulse">
                              (Pause 1.2s to auto-commit)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                          {activePredictions.length > 0 && (
                            <button
                              type="button"
                              onClick={() => handleAcceptPrediction(activePredictions[0])}
                              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg transition hover:scale-105 cursor-pointer ring-1 ring-white/30"
                              title={`Accept top prediction: ${activePredictions[0]} (Hands-Free auto-commits on pause)`}
                            >
                              <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                              <span>{activePredictions[0]}</span>
                            </button>
                          )}
                          {activePredictions.slice(1, 3).map((pred) => (
                            <button
                              key={pred}
                              type="button"
                              onClick={() => handleAcceptPrediction(pred)}
                              className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-medium transition border border-slate-700 cursor-pointer"
                              title={`Accept prediction: ${pred}`}
                            >
                              {pred}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => handleAcceptPrediction(activeSpelledWord)}
                            className="px-2 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition border border-slate-700 cursor-pointer"
                            title="Commit exact spelled letters as-is"
                          >
                            <span>Commit as-is</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Live AI Grammatical Sentence Preview */}
                    {livePredictedSentence && (
                      <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl px-3.5 py-2 shadow-xl flex items-center justify-between gap-2 animate-in fade-in duration-150">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <Sparkles className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                          <span className="text-[10px] uppercase font-mono font-bold text-slate-400 shrink-0">
                            Spoken Sentence:
                          </span>
                          <span className="text-xs font-semibold text-white font-sans truncate">
                            &ldquo;{livePredictedSentence}&rdquo;
                          </span>
                        </div>
                        <span className="text-[10px] text-emerald-400 font-mono shrink-0 font-bold hidden sm:inline">
                          Ready to speak
                        </span>
                      </div>
                    )}

                    {/* Main Token Sequence Bar */}
                    <div className="bg-slate-950/95 backdrop-blur-xl border border-slate-800 rounded-2xl p-2.5 shadow-2xl flex items-center justify-between gap-2">
                      {/* Token sequence scroll */}
                      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5 flex-1 max-w-[calc(100%-140px)]">
                        <span className="text-[11px] uppercase font-mono font-bold text-slate-400 shrink-0">
                          Tokens:
                        </span>
                        {bufferedSignTokens.map((item) => (
                          <span
                            key={item.id}
                            className={`group relative px-2.5 py-1 rounded-xl font-mono text-xs font-bold shrink-0 shadow-sm flex items-center gap-1.5 border animate-in zoom-in-95 duration-100 ${
                              item.type === 'letter'
                                ? 'bg-amber-950/70 border-amber-600/60 text-amber-200 ring-1 ring-amber-400/20'
                                : 'bg-slate-900 border-slate-700 text-slate-100 ring-1 ring-white/10'
                            }`}
                            title={item.type === 'letter' ? `Letter: ${item.token}` : `Word: ${item.displayLabel || item.token}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${item.type === 'letter' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                            <span>{item.token}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setBufferedSignTokens((prev) => prev.filter((t) => t.id !== item.id));
                              }}
                              className="w-4 h-4 rounded-full bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white flex items-center justify-center text-xs leading-none transition-all ml-1 cursor-pointer"
                              title="Remove this token"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>

                      {/* Actions: Speak to Meeting, Backspace, Clear */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setBufferedSignTokens((prev) => prev.slice(0, -1))}
                          disabled={isSpeakingSign}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs transition cursor-pointer"
                          title="Backspace"
                        >
                          ⌫
                        </button>
                        <button
                          type="button"
                          onClick={() => setBufferedSignTokens([])}
                          disabled={isSpeakingSign}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-700 text-xs transition cursor-pointer"
                          title="Clear tokens"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setAutoSpeakSigns(!autoSpeakSigns)}
                          className={`px-3 py-2 rounded-xl text-xs font-mono font-medium transition cursor-pointer flex items-center gap-1.5 border ${
                            autoSpeakSigns
                              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                          }`}
                          title={autoSpeakSigns ? 'Auto-Voice to Speaker is ON: When you finish signing, your voice automatically broadcasts to the speaker' : 'Auto-Voice is OFF: Click Speak manually'}
                        >
                          <span className={`w-2 h-2 rounded-full ${autoSpeakSigns ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                          <span className="hidden sm:inline">Voice: {autoSpeakSigns ? 'Auto' : 'Manual'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => executeSignToSpeech()}
                          disabled={isSpeakingSign}
                          className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-orange-500/25 transition hover:scale-105 disabled:opacity-50 cursor-pointer"
                          title="Speak to Meeting"
                        >
                          {isSpeakingSign ? (
                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <Volume2 className="w-3.5 h-3.5" />
                          )}
                          <span>{isSpeakingSign ? 'Speaking...' : 'Speak'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {(!isVideoOn || !isCameraStreamActive || !localStreamRef.current?.getVideoTracks().some((t) => t.enabled)) && !isScreenSharing && (
                  <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-3 z-10 text-slate-300 p-4 text-center">
                    <div className="relative">
                      <div className={`w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-2xl border-2 ${
                        activeRole === 'deaf_signer'
                          ? 'bg-gradient-to-tr from-amber-600 to-orange-500 border-orange-400/50 shadow-orange-950/50'
                          : 'bg-gradient-to-tr from-sky-600 to-indigo-600 border-sky-400/50 shadow-sky-950/50'
                      }`}>
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                      {isMicOn && (
                        <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-950 flex items-center justify-center">
                          <Mic className="w-3 h-3 text-white" />
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col items-center">
                      <span className="text-base font-bold text-white tracking-wide" suppressHydrationWarning>{displayName}</span>
                      <span className="text-xs text-slate-400 mt-1">
                        {cameraError ? cameraError : 'Camera is turned off'}
                      </span>
                    </div>

                    {cameraError && (
                      <div className="flex items-center gap-2 mt-2 bg-slate-900/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-700/80 shadow-lg">
                        <button
                          type="button"
                          onClick={retryCamera}
                          className="px-3 py-1 rounded-lg bg-orange-500 hover:bg-orange-400 text-white font-semibold text-xs transition cursor-pointer flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Retry Camera</span>
                        </button>
                        <button
                          type="button"
                          onClick={startVirtualCamera}
                          className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
                          title="Simulate webcam video for multi-tab testing"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                          <span>Virtual Cam</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Speaking Waveform Indicator */}
                {isListening && (
                  <div className="absolute bottom-12 left-3 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-emerald-500/40 flex items-center gap-1.5 shadow-lg animate-pulse z-20">
                    <Mic className="w-3 h-3 text-emerald-400" />
                    <span className="text-[10px] font-mono font-bold text-emerald-300">Speaking...</span>
                  </div>
                )}

                {!isListening && activeRole === 'speaking_interviewer' && isMicOn && (
                  <button
                    type="button"
                    onClick={() => toggleListening()}
                    className="absolute bottom-12 left-3 bg-black/85 backdrop-blur-md px-3 py-1.5 rounded-full border border-sky-500/50 flex items-center gap-1.5 shadow-lg text-[10px] font-mono font-bold text-sky-300 hover:bg-sky-950/60 transition cursor-pointer z-20"
                    title="Click to activate live voice speech recognition"
                  >
                    <Mic className="w-3.5 h-3.5 text-sky-400" />
                    <span>Click to Speak (Speech-to-Sign)</span>
                  </button>
                )}

                {!isMicOn && (
                  <div className="absolute top-2.5 right-12 z-20 bg-rose-600/90 text-white p-1 rounded-full border border-rose-400 shadow-md">
                    <MicOff className="w-3 h-3" />
                  </div>
                )}
              </div>

              {/* Google Meet Style Bottom Name Pill */}
              <div className="absolute bottom-3 left-3 z-20 flex items-center pointer-events-auto">
                <div className="px-3 py-1.5 rounded-full bg-black/65 backdrop-blur-md border border-white/10 text-xs font-semibold text-white flex items-center gap-2 shadow-lg">

                  <span suppressHydrationWarning>{displayName} (You)</span>
                  {isMicOn ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Microphone Active" />
                  ) : (
                    <span title="Microphone Muted" className="flex items-center">
                      <MicOff className="w-3 h-3 text-rose-400" />
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        };

        // Helper: Render 3D Holographic Sign Interpreter Tile
        const renderHologramTile = (customClass = 'w-full lg:w-1/2') => {
          return (
            <div
              key="hologram-sign-tile"
              className={`flex flex-col rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden relative shadow-xl backdrop-blur-md ${customClass}`}
            >
              {/* Top Tab Bar inside Panel */}
              <div className="px-3.5 py-2.5 bg-slate-950/90 border-b border-slate-800/80 flex items-center justify-between z-20 shrink-0">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setAvatarMode('hologram');
                      setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                      avatarMode === 'hologram'
                        ? 'bg-orange-500 text-white shadow-xs'
                        : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>ISL Hologram</span>
                  </button>
                  <button
                    onClick={() => setAvatarMode('3d_avatar')}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                      avatarMode === '3d_avatar'
                        ? 'bg-orange-500 text-white shadow-xs'
                        : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>3D Avatar</span>
                  </button>
                  <button
                    onClick={() => setAvatarMode('emojis')}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                      avatarMode === 'emojis'
                        ? 'bg-orange-500 text-white shadow-xs'
                        : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60'
                    }`}
                  >
                    <Smile className="w-3.5 h-3.5" />
                    <span>Sign Gestures</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setGuideActiveTab('dataset');
                      setShowSignGuideModal(true);
                    }}
                    className="px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 text-slate-200 hover:text-white text-[11px] font-mono font-medium cursor-pointer transition flex items-center gap-1"
                    title="Browse and demo all 262 words in the ISL Parquet Dataset"
                  >
                    <BookOpen className="w-3 h-3 text-orange-400" />
                    <span>{avatarMode === 'hologram' ? '262 Dataset' : 'Humanoid 3D'}</span>
                  </button>
                  {avatarMode === 'hologram' && (
                    <button
                      onClick={() => {
                        if (controlsRef.current && cameraRef.current) {
                          cameraRef.current.position.set(0, 1.05, 2.3);
                          controlsRef.current.target.set(0, 0.95, 0);
                          controlsRef.current.update();
                        }
                      }}
                      className="p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                      title="Reset Camera"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Header inside Panel */}
              <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800/60 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-200 font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                  {avatarMode === 'hologram'
                    ? 'ISL Hologram Interpreter'
                    : avatarMode === '3d_avatar'
                    ? '3D Humanoid Avatar'
                    : 'Sign Gesture Expressions'}
                </span>

                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/70 text-slate-300 text-[10px] font-medium">
                    {avatarMode === 'hologram'
                      ? '60 FPS • Real-time'
                      : avatarMode === '3d_avatar'
                      ? '65-Bone Kinematics'
                      : 'WebGL PBR'}
                  </span>
                  {activeToken ? (
                    <span className="px-3 py-0.5 rounded-full bg-orange-500 text-white font-bold text-[11px] shadow-sm animate-pulse">
                      {currentAction?.source === 'fingerspell_letter' || currentAction?.type === 'letter'
                        ? `Spelling: [${activeToken.toUpperCase()}]`
                        : `Signing: ${activeToken.toUpperCase()}`}
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-800/60 border border-slate-700/60 text-slate-400 text-[10px]">
                      Standby
                    </span>
                  )}
                </div>
              </div>

              {/* When 3D Avatar is active: Model Switcher & Appearance Bar */}
              {avatarMode === '3d_avatar' && (
                <div className="px-3.5 py-1.5 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between gap-2 text-xs flex-wrap z-20">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-slate-400">Model:</span>
                    <select
                      value={selected3DModelUrl}
                      onChange={(e) => setSelected3DModelUrl(e.target.value)}
                      className="bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1 text-[11px] text-slate-200 font-medium focus:outline-none focus:border-orange-500 cursor-pointer"
                    >
                      {available3DModels.length > 0 ? (
                        available3DModels.map((m) => (
                          <option key={m.url} value={m.url}>
                            {m.name} ({m.sizeMb})
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="/api/avatar-model?file=mans.fbx">Mans (Primary 65-Bone FBX)</option>
                          <option value="/api/avatar-model?file=passive_marker_man.fbx">Passive Marker Man (Studio FBX)</option>
                          <option value="/model/man.glb">Standard Humanoid (GLB)</option>
                        </>
                      )}
                    </select>

                    <label
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/70 text-[10px] font-medium cursor-pointer transition flex items-center gap-1"
                      title="Upload custom .fbx or .glb model from your computer"
                    >
                      <span>+ Upload Model</span>
                      <input
                        type="file"
                        accept=".fbx,.glb,.gltf"
                        onChange={handleUploadCustomModel}
                        className="hidden"
                        disabled={isUploadingModel}
                      />
                    </label>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAvatarColorMode((prev) => (prev === 'natural' ? 'original' : 'natural'))}
                      className={`px-2.5 py-1 rounded-lg border text-[10px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                        avatarColorMode === 'natural'
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                          : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white'
                      }`}
                      title="Switch between Natural Human palette (warm skin + navy suit) and Original Model textures"
                    >
                      <span>Color: {avatarColorMode === 'natural' ? 'Natural Skin & Suit' : 'Original Textures'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Viewport: Three.js Canvas Container (Hologram) vs 3D Avatar Model Container */}
              <div className="flex-1 w-full h-full relative min-h-[180px] overflow-hidden bg-gradient-to-b from-slate-950 to-slate-900">
                {/* 1. Hologram Skeleton */}
                <div
                  ref={(el) => {
                    mountRef.current = el;
                    setHologramMountEl(el);
                  }}
                  className={`w-full h-full cursor-grab active:cursor-grabbing ${
                    avatarMode === 'hologram' ? 'block' : 'hidden'
                  }`}
                >
                  <div className="absolute bottom-3 right-3 pointer-events-none text-[10px] font-mono text-slate-400 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800">
                    Drag to Orbit • Scroll to Zoom
                  </div>
                </div>

                {/* 2. Realistic 3D Humanoid Avatar */}
                <div
                  className={`w-full h-full relative ${
                    avatarMode === '3d_avatar' ? 'block' : 'hidden'
                  }`}
                >
                  <AvatarModel
                    isSpeaking={isListening}
                    signWord={activeToken}
                    isVisible={avatarMode === '3d_avatar'}
                    modelUrl={selected3DModelUrl}
                    colorMode={avatarColorMode}
                    className="w-full h-full"
                  />
                </div>

                {/* 3. 3D Animated Volumetric Sign Emoji System */}
                <div
                  className={`w-full h-full relative flex flex-col ${
                    avatarMode === 'emojis' ? 'block' : 'hidden'
                  }`}
                >
                  <div className="flex-1 w-full relative min-h-[220px]">
                    <SignEmoji3DViewer
                      emojiId={selectedSignEmojiId}
                      interactive={true}
                      autoRotate={false}
                      className="w-full h-full"
                    />
                  </div>

                  {/* Sign Emoji Carousel Strip */}
                  <div className="p-2.5 bg-slate-950/95 border-t border-slate-800/80 shrink-0">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold">
                        Select 3D Sign Emoji:
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const emoji = SIGN_EMOJIS_LIST.find((e) => e.id === selectedSignEmojiId);
                          if (emoji) triggerSignReaction(emoji);
                        }}
                        className="px-2.5 py-0.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold flex items-center gap-1 transition cursor-pointer"
                      >
                        <Send className="w-3 h-3" />
                        <span>Send to Call</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin pb-1">
                      {SIGN_EMOJIS_LIST.map((emoji) => (
                        <button
                          key={emoji.id}
                          type="button"
                          onClick={() => {
                            setSelectedSignEmojiId(emoji.id);
                            triggerSignReaction(emoji);
                          }}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs whitespace-nowrap transition cursor-pointer border ${
                            selectedSignEmojiId === emoji.id
                              ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-md shadow-amber-500/30'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700/80'
                          }`}
                        >
                          <span className="text-sm">{emoji.icon}</span>
                          <span className="font-mono text-[11px]">{emoji.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Clean Live Speech Subtitle Strip (Only shown when speaking or processing) */}
              {(currentSentence || interimTranscript || isProcessing) && (
                <div className="px-4 py-2.5 bg-slate-950/95 border-t border-slate-800/80 flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <span className="text-xs font-medium text-slate-200 truncate">
                      {interimTranscript
                        ? `"${interimTranscript}"`
                        : isProcessing
                        ? `Translating: "${currentSentence}"...`
                        : `"${currentSentence}"`}
                    </span>
                  </div>
                  {activeToken && (
                    <span className="px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/40 text-[10px] font-mono font-bold shrink-0">
                      {activeToken.toUpperCase()}
                    </span>
                  )}
                </div>
              )}

              {/* Input Bar inside Right Panel */}
              <div className="p-2.5 bg-slate-950 border-t border-slate-800/80 flex items-center gap-2 shrink-0">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={chatInputText}
                    onChange={(e) => setChatInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && chatInputText.trim()) {
                        executeTranslateAndSign(chatInputText);
                        setChatInputText('');
                      }
                    }}
                    placeholder={
                      activeRole === 'speaking_interviewer'
                        ? 'Speak into mic or type English to interpret into ISL...'
                        : 'Type words to sign or fingerspell...'
                    }
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-full pl-4 pr-10 py-2 text-xs text-white placeholder-slate-500 font-medium focus:outline-none focus:border-orange-500 transition"
                  />
                  {chatInputText.trim() && (
                    <button
                      onClick={() => {
                        executeTranslateAndSign(chatInputText);
                        setChatInputText('');
                      }}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-orange-500 text-white font-bold hover:bg-orange-400 transition cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        };

        return (
            <main className="flex-1 flex overflow-hidden p-3 sm:p-4 gap-3 sm:gap-4 relative bg-slate-950">
              {/* LAYOUT 1: SCREEN SHARING ACTIVE (Google Meet Presentation Mode) */}
              {isPresenting && activePresenter ? (
                <div className="flex-1 flex flex-col lg:flex-row gap-3 sm:gap-4 w-full h-full overflow-hidden">
                  {/* Main Presentation Stage */}
                  <PresentationView
                    stream={activePresenter.stream}
                    presenterName={activePresenter.name}
                    isLocal={activePresenter.isLocal}
                  />

                  {/* Side Filmstrip */}
                  <div className="w-full lg:w-80 sm:w-96 flex flex-col gap-3 overflow-y-auto shrink-0 h-full scrollbar-thin">
                    {/* 3D Hologram Sign Companion */}
                    {renderHologramTile('h-64 sm:h-72 w-full shrink-0')}

                    {/* Remote Participant(s) Live Face Cam */}
                    {remoteList.map((p) => (
                      <RemoteParticipantTile key={p.socketId} participant={p} isCompact />
                    ))}

                    {/* Local User Cam */}
                    {renderLocalTile(true)}
                  </div>
                </div>
              ) : viewMode === 'signer_focus' ? (
                /* LAYOUT 2: SIGNER FOCUS MODE */
                <div className="flex-1 flex flex-col lg:flex-row gap-3 sm:gap-4 w-full h-full overflow-hidden">
                  {/* Left Column: Participant Cameras */}
                  <div className="w-full lg:w-80 sm:w-96 flex flex-col gap-3 overflow-y-auto shrink-0 h-full scrollbar-thin">
                    {renderLocalTile(true)}
                    {remoteList.map((p) => (
                      <RemoteParticipantTile key={p.socketId} participant={p} isCompact />
                    ))}
                  </div>

                  {/* Right Stage: Large 3D Signer Hologram */}
                  {renderHologramTile('flex-1 w-full h-full')}
                </div>
              ) : (
                /* LAYOUT 3: GOOGLE MEET GRID MODE */
                <div className="flex-1 flex flex-col lg:flex-row w-full h-full overflow-hidden gap-3 sm:gap-4 relative">
                  {/* Adaptive Google Meet Video Grid for all human participants */}
                  <div className="flex-1 w-full h-full overflow-hidden relative flex flex-col">
                    {remoteList.length === 0 ? (
                      /* Only Local User: Adaptive stage tile + Ready Card */
                      <div className="w-full h-full flex-1 relative flex items-center justify-center">
                        {renderLocalTile(false)}

                        {/* Google Meet Style Ready Card */}
                        {showReadyCard && (
                          <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-50 bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-3xl p-5 shadow-2xl max-w-xs sm:max-w-sm pointer-events-auto animate-in fade-in zoom-in-95 duration-150">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                                <Users className="w-4 h-4 text-orange-400" />
                                <span>Your meeting is ready</span>
                              </h4>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setShowReadyCard(false);
                                }}
                                className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                                title="Close"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed mb-3">
                              Share this link with others to join this video meeting.
                            </p>
                            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-2xl p-1.5 mb-3">
                              <span className="text-[11px] font-mono text-slate-300 truncate flex-1 px-2 select-all" suppressHydrationWarning>
                                {joinUrl || (typeof window !== 'undefined' ? window.location.href : `/room/${roomId}`)}
                              </span>
                              <button
                                type="button"
                                onClick={copyMeetingLink}
                                className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-semibold text-xs flex items-center gap-1 transition shrink-0 shadow-sm cursor-pointer"
                              >
                                {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                <span>{isCopied ? 'Copied!' : 'Copy'}</span>
                              </button>
                            </div>

                            {/* Footer & Close */}
                            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                              <span className="text-[10px] text-slate-500">Auto-closes in a few seconds</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setShowReadyCard(false);
                                }}
                                className="text-xs text-slate-400 hover:text-white transition font-medium px-2.5 py-1 rounded-lg hover:bg-slate-800 cursor-pointer"
                              >
                                Close
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* 1 to 30+ Participants: Intelligent Adaptive Paginated Grid */
                      (() => {
                        const TILES_PER_PAGE = 12;
                        const totalParticipants = 1 + remoteList.length;
                        const totalPages = Math.max(1, Math.ceil(totalParticipants / TILES_PER_PAGE));
                        const activePage = Math.min(gridPage, totalPages);

                        // If on Page 1, slot 1 is local user, remaining 11 slots are remotes
                        // If on Page 2+, all 12 slots are remotes
                        const remotesOnThisPage = activePage === 1
                          ? remoteList.slice(0, TILES_PER_PAGE - 1)
                          : remoteList.slice((activePage - 1) * TILES_PER_PAGE - 1, activePage * TILES_PER_PAGE - 1);

                        const totalTilesOnThisPage = (activePage === 1 ? 1 : 0) + remotesOnThisPage.length;

                        return (
                          <div className="w-full h-full flex flex-col justify-between overflow-hidden">
                            <div
                              className={`w-full flex-1 grid gap-2.5 sm:gap-3.5 p-2 sm:p-3 overflow-hidden ${
                                totalTilesOnThisPage === 1
                                  ? 'grid-cols-1 auto-rows-fr'
                                  : totalTilesOnThisPage === 2
                                  ? 'grid-cols-1 md:grid-cols-2 auto-rows-fr'
                                  : totalTilesOnThisPage <= 4
                                  ? 'grid-cols-2 grid-rows-2 auto-rows-fr'
                                  : totalTilesOnThisPage <= 6
                                  ? 'grid-cols-2 sm:grid-cols-3 grid-rows-2 sm:grid-rows-2 auto-rows-fr'
                                  : totalTilesOnThisPage <= 9
                                  ? 'grid-cols-3 grid-rows-3 auto-rows-fr'
                                  : 'grid-cols-3 sm:grid-cols-4 grid-rows-3 sm:grid-rows-3 auto-rows-fr'
                              }`}
                            >
                              {/* Local User Tile (Visible on Page 1) */}
                              {activePage === 1 && (
                                <div className="w-full h-full min-h-0 flex flex-col">
                                  {renderLocalTile(false)}
                                </div>
                              )}

                              {/* Remote Participants for Active Page */}
                              {remotesOnThisPage.map((p) => (
                                <div key={p.socketId} className="w-full h-full min-h-0 flex flex-col">
                                  <RemoteParticipantTile key={p.socketId} participant={p} />
                                </div>
                              ))}
                            </div>

                            {/* Pagination Dock for Large 12 to 30+ Person Meetings */}
                            {totalPages > 1 && (
                              <div className="py-2 px-4 flex items-center justify-between shrink-0 bg-slate-950/90 border-t border-slate-800 text-xs no-print">
                                <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
                                  <Users className="w-3.5 h-3.5 text-orange-400" />
                                  <span>{totalParticipants} People in Meeting</span>
                                </div>

                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    disabled={activePage === 1}
                                    onClick={() => setGridPage((p) => Math.max(1, p - 1))}
                                    className="px-3 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-white font-mono text-xs border border-slate-700 transition cursor-pointer"
                                  >
                                    ◀ Previous
                                  </button>
                                  <span className="font-mono text-slate-300 text-xs">
                                    Page <strong className="text-orange-400">{activePage}</strong> of <strong>{totalPages}</strong>
                                  </span>
                                  <button
                                    type="button"
                                    disabled={activePage === totalPages}
                                    onClick={() => setGridPage((p) => Math.min(totalPages, p + 1))}
                                    className="px-3 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-white font-mono text-xs border border-slate-700 transition cursor-pointer"
                                  >
                                    Next ▶
                                  </button>
                                </div>

                                <div className="hidden sm:block text-[11px] font-mono text-emerald-400">
                                  <span>● Auto-Optimized Grid</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()
                    )}
                  </div>

                  {/* 3D Sign Interpreter Companion Panel (Docked to the Right) */}
                  {showSignCompanion && (
                    <aside className="w-full lg:w-96 shrink-0 h-72 lg:h-full flex flex-col animate-in slide-in-from-right duration-200">
                      {renderHologramTile('w-full h-full')}
                    </aside>
                  )}
                </div>
              )}

              {/* Google Meet Live Subtitles Floating Overlay Banner */}
              {showCaptions && (interimTranscript || currentSentence) && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none max-w-2xl w-[92%] sm:w-auto px-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
                  <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl px-5 py-3 shadow-2xl flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-400 animate-pulse shrink-0 shadow-lg shadow-orange-400/50" />
                    <div className="text-xs sm:text-sm font-medium text-slate-100 leading-snug">
                      {interimTranscript ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                            LIVE SPEECH
                          </span>
                          <span className="text-emerald-300 font-semibold">&quot;{interimTranscript}&quot;</span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/40">
                              ISL CAPTION
                            </span>
                            <span className="text-slate-100 font-medium">&quot;{currentSentence}&quot;</span>

                            {/* Dynamic 3D Sign Emoji Badge */}
                            {(() => {
                              const lower = (currentSentence || '').toLowerCase();
                              const matchedEmoji = SIGN_EMOJIS_LIST.find((e) =>
                                lower.includes(e.id) || lower.includes(e.name.toLowerCase().split(' ')[0])
                              );
                              if (!matchedEmoji) return null;
                              return (
                                <span
                                  key={matchedEmoji.id}
                                  className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-300 font-mono text-[10px] font-bold shadow-xs animate-in zoom-in-90 duration-200"
                                >
                                  <span>{matchedEmoji.icon}</span>
                                  <span>3D Sign: {matchedEmoji.name}</span>
                                </span>
                              );
                            })()}
                          </div>
                          {currentAction && (currentAction.source === 'fingerspell_letter' || currentAction.type === 'letter') && (
                            <div className="flex items-center gap-1.5 flex-wrap font-mono text-xs pt-0.5">
                              <span className="text-amber-400 font-bold text-[11px] flex items-center gap-1">
                                <Hand className="w-3 h-3 text-amber-400" /> Fingerspelling:
                              </span>
                              <span className="text-white font-extrabold">
                                {(currentAction.originalWord || currentAction.token).toUpperCase()}:
                              </span>
                              {(currentAction.originalWord || currentAction.token).toUpperCase().split('').map((char, cIdx) => {
                                const isActive = char === currentAction.token.toUpperCase();
                                return (
                                  <span
                                    key={cIdx}
                                    className={`px-1.5 py-0.5 rounded text-xs font-black transition-all ${
                                      isActive
                                        ? 'bg-amber-400 text-slate-950 ring-1 ring-amber-300 scale-105 shadow-sm shadow-amber-400/40'
                                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                                    }`}
                                  >
                                    {char}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </main>
          );
        })()}

        {/* ─── 3. In-Call Messages Side Drawer ───────────────────────────────── */}
        {showChatDrawer && (
          <aside className="w-80 sm:w-96 bg-slate-900 border-l border-slate-800 flex flex-col z-50 shrink-0 h-full animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-orange-400" />
                In-call messages
              </h3>
              <button
                onClick={() => {
                  setShowChatDrawer(false);
                  setUnreadChatCount(0);
                }}
                className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-950 border-b border-slate-800 text-[11px] text-slate-400">
              Messages can be seen only by people in this call.
            </div>

            {/* Message List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
              {chatMessages.length === 0 ? (
                <div className="text-center py-16 text-slate-500 text-xs">
                  No messages yet. Send a message to everyone in the call.
                </div>
              ) : (
                chatMessages.map((msg) => (
                  <div key={msg.id} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-300">
                        {msg.isSelf ? 'You' : msg.sender}
                        <span className="ml-1 text-[10px] font-normal text-slate-500 font-mono">
                          ({msg.role})
                        </span>
                      </span>
                      <span className="text-slate-500 text-[10px] font-mono">{msg.time}</span>
                    </div>
                    <div
                      className={`p-3 rounded-2xl text-xs leading-relaxed max-w-[90%] break-words ${
                        msg.isSelf
                          ? 'bg-orange-500/20 border border-orange-500/30 text-orange-100 ml-auto'
                          : 'bg-slate-800/80 border border-slate-700/60 text-slate-200 mr-auto'
                      }`}
                    >
                      {msg.text}
                      {msg.isSigned && (
                        <span className="block mt-1 text-[10px] font-mono text-orange-400 font-medium">
                          Signed in 3D
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Chat Input Bar */}
            <div className="p-3 border-t border-slate-800 bg-slate-950 space-y-2">
              {/* Quick 3D Sign Emoji Sticker Strip */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin px-1 py-0.5">
                <span className="text-[10px] font-mono text-amber-400 font-bold uppercase shrink-0">
                  Stickers:
                </span>
                {SIGN_EMOJIS_LIST.map((emoji) => (
                  <button
                    key={emoji.id}
                    type="button"
                    onClick={() => {
                      setChatDrawerInput(`[${emoji.icon} ${emoji.name}]`);
                      triggerSignReaction(emoji);
                    }}
                    className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-[11px] flex items-center gap-1 shrink-0 transition cursor-pointer"
                    title={`Send ${emoji.name} sticker`}
                  >
                    <span>{emoji.icon}</span>
                    <span className="font-mono text-[10px]">{emoji.name.split(' ')[0]}</span>
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-1.5 cursor-pointer px-1">
                <input
                  type="checkbox"
                  checked={autoSignChat}
                  onChange={(e) => setAutoSignChat(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-orange-500 focus:ring-0 w-3.5 h-3.5"
                />
                <span className="text-[11px] font-medium text-slate-300">Auto-Sign in 3D (ISL)</span>
              </label>

              <div className="relative">
                <input
                  type="text"
                  value={chatDrawerInput}
                  onChange={(e) => setChatDrawerInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      sendChatMessage();
                    }
                  }}
                  placeholder="Send a message to everyone..."
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-full pl-4 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
                <button
                  onClick={() => sendChatMessage()}
                  disabled={!chatDrawerInput.trim()}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white transition cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* ─── 4. Quick-Sentence Drawer (Signer Daily Voice & 1-Click Tests) ─────── */}
      {showPresetDrawer && (
        <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800 flex flex-col gap-2 shrink-0 z-30 shadow-xl animate-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center justify-between pb-1 border-b border-slate-800/80">
            <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5 font-mono">
              <Sparkles className="w-3.5 h-3.5 text-orange-400" />
              <span>Voice Shortcuts &amp; Avatar Motion Tests</span>
            </span>
            <button
              type="button"
              onClick={() => setShowPresetDrawer(false)}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Close Drawer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Row 1: Deaf Signer Quick Spoken Responses */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none no-scrollbar">
            <span className="text-[11px] font-mono font-semibold text-slate-400 uppercase shrink-0 flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-orange-400" />
              <span>Voice Shortcuts:</span>
            </span>
            {DAILY_QUICK_REACTIONS.map((reaction) => (
              <button
                key={reaction.label}
                onClick={() => executeSignToSpeech(reaction.tokens)}
                className="px-3 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 text-xs font-medium whitespace-nowrap transition cursor-pointer shadow-xs"
                title={`Speak aloud: "${reaction.spoken}"`}
              >
                <span>{reaction.label}</span>
              </button>
            ))}
          </div>

          {/* Row 2: 1-Click Tests for 3D Interpreter Avatar */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none no-scrollbar">
            <span className="text-[11px] font-mono font-semibold text-slate-400 uppercase shrink-0 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-orange-400" />
              <span>Avatar Tests:</span>
            </span>
            {CURATED_PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => executeTranslateAndSign(preset.text)}
                className="px-3 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-mono whitespace-nowrap transition cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── 5. Google Meet Full-Width Bottom Navigation Bar ─────────────────────── */}
      <footer className="h-20 bg-[#202124] border-t border-[#3c4043]/80 px-4 sm:px-6 flex items-center justify-between z-30 shrink-0 w-full select-none">
        {/* Left: Meeting Time & Room Code (Google Meet Standard) */}
        <div className="flex items-center gap-3 min-w-[160px] sm:min-w-[190px]">
          <span className="text-sm font-medium text-white tracking-normal font-sans" suppressHydrationWarning>
            {clockTime || formatTime(meetingDurationSec)}
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-sm font-medium text-slate-300 tracking-wide font-mono" suppressHydrationWarning>
            {roomId}
          </span>
          <span className="text-slate-600 hidden sm:inline">|</span>
          <button
            type="button"
            onClick={() => openRechargeModal()}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200 border border-slate-700/80 transition cursor-pointer"
            title="Wallet Balance — Click to recharge"
          >
            <Zap className="w-3 h-3 text-orange-400" />
            <span className="font-bold text-white font-mono">{credits}</span>
            <span className="text-slate-400 text-[10px]">Cr</span>
          </button>
        </div>

        {/* Center: Primary In-Call Meeting Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Microphone Button */}
          <button
            onClick={toggleMic}
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              isMicOn
                ? 'bg-[#3c4043] hover:bg-[#474a4e] text-white'
                : 'bg-[#ea4335] hover:bg-[#d93025] text-white shadow-md shadow-red-950/40'
            }`}
            title={isMicOn ? 'Turn Off Microphone (Mute)' : 'Turn On Microphone (Live Speech)'}
          >
            {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5 text-white" />}
          </button>

          {/* Camera Button */}
          <button
            onClick={toggleVideo}
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              isVideoOn
                ? 'bg-[#3c4043] hover:bg-[#474a4e] text-white'
                : 'bg-[#ea4335] hover:bg-[#d93025] text-white shadow-md shadow-red-950/40'
            }`}
            title={isVideoOn ? 'Turn Off Camera' : 'Turn On Camera'}
          >
            {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5 text-white" />}
          </button>

          {/* Subtitles / CC Button */}
          <button
            onClick={() => setShowCaptions(!showCaptions)}
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              showCaptions
                ? 'bg-orange-500 hover:bg-orange-400 text-white font-black shadow-md shadow-orange-500/30'
                : 'bg-[#3c4043] hover:bg-[#474a4e] text-white'
            }`}
            title={showCaptions ? 'Turn Off Live Subtitles' : 'Turn On Live Subtitles'}
          >
            <span className="font-mono text-xs font-black">CC</span>
          </button>

          {/* Sign-to-Speech (ISL Camera Recognizer) Toggle */}
          <button
            onClick={() => setIsSignToSpeechActive(!isSignToSpeechActive)}
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              isSignToSpeechActive
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-500/30 ring-2 ring-emerald-400/40'
                : 'bg-[#3c4043] hover:bg-[#474a4e] text-slate-300'
            }`}
            title={
              isSignToSpeechActive
                ? 'ISL Camera Tracking is Active'
                : 'Turn On ISL Camera Tracking'
            }
          >
            <Activity className="w-5 h-5" />
          </button>

          {/* Screen Share Button */}
          <button
            onClick={toggleScreenShare}
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              isScreenSharing
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/30'
                : 'bg-[#3c4043] hover:bg-[#474a4e] text-white'
            }`}
            title={isScreenSharing ? 'Stop Screen Sharing' : 'Share Screen'}
          >
            {isScreenSharing ? <ScreenShareOff className="w-5 h-5" /> : <ScreenShare className="w-5 h-5" />}
          </button>

          {/* Hand Raise / Greet Button */}
          <button
            onClick={() => executeTranslateAndSign('hello')}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all cursor-pointer bg-[#3c4043] hover:bg-[#474a4e] text-white"
            title="Raise Hand"
          >
            <Hand className="w-5 h-5" />
          </button>

          {/* Emoji Reaction Button with 3D Sign Reactions Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSignEmojiPicker((prev) => !prev)}
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                showSignEmojiPicker
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/40 ring-2 ring-amber-400/50'
                  : 'bg-[#3c4043] hover:bg-[#474a4e] text-white'
              }`}
              title="Send 3D Sign Reaction"
            >
              <Smile className="w-5 h-5" />
            </button>

            {/* WhatsApp / Apple Style Quick 3D Sign Reaction Popover */}
            {showSignEmojiPicker && (
              <div className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-slate-900/98 backdrop-blur-2xl border border-slate-700/90 rounded-2xl p-2.5 shadow-2xl z-50 flex items-center gap-2 min-w-max animate-in fade-in zoom-in-95 duration-150">
                <div className="text-[10px] font-mono text-amber-400 font-bold px-2 border-r border-slate-700 uppercase">
                  3D Signs
                </div>
                {SIGN_EMOJIS_LIST.map((emoji) => (
                  <button
                    key={emoji.id}
                    type="button"
                    onClick={() => {
                      triggerSignReaction(emoji);
                      setShowSignEmojiPicker(false);
                    }}
                    className="group relative flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-slate-800 hover:scale-110 active:scale-95 transition-all cursor-pointer"
                    title={`${emoji.name}: ${emoji.description}`}
                  >
                    <span className="text-2xl filter drop-shadow-md group-hover:scale-110 transition-transform">
                      {emoji.icon}
                    </span>
                    <span className="text-[10px] font-medium text-slate-300 group-hover:text-amber-300">
                      {emoji.name.split(' ')[0]}
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setAvatarMode('emojis');
                    setShowSignEmojiPicker(false);
                  }}
                  className="ml-1 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <span>Full 3D</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* End Meeting Button (Google Meet Red Rounded Pill) */}
          <button
            onClick={handleLeaveMeeting}
            className="bg-[#ea4335] hover:bg-[#d93025] text-white px-5 sm:px-6 h-10 sm:h-11 rounded-full flex items-center justify-center gap-2 font-medium shadow-md shadow-red-950/40 transition hover:scale-105 ml-1 sm:ml-2 cursor-pointer"
            title="Leave Call"
          >
            <PhoneOff className="w-4 h-4" />
            <span className="hidden sm:inline">End Call</span>
          </button>
        </div>

        {/* Right: Google Meet Utility Drawers & Options */}
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-[160px] sm:min-w-[190px] justify-end">
          {/* 1. Meeting Info / Share (Google Meet "i" button) */}
          <button
            onClick={openShareModal}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all cursor-pointer bg-[#3c4043] hover:bg-[#474a4e] text-white"
            title="Meeting Details & Joining Info"
          >
            <Info className="w-5 h-5" />
          </button>

          {/* 2. Participants List Toggle */}
          <button
            type="button"
            onClick={() => setShowParticipantList(!showParticipantList)}
            className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              showParticipantList
                ? 'bg-orange-500 text-white shadow-md'
                : 'bg-[#3c4043] hover:bg-[#474a4e] text-white'
            }`}
            title="People in call"
          >
            <Users className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 bg-slate-700 text-slate-200 font-mono text-[10px] w-4 h-4 rounded-full flex items-center justify-center border border-slate-900">
              {1 + remoteParticipants.size}
            </span>
          </button>

          {/* 3. In-Call Chat Drawer Toggle */}
          <button
            onClick={() => {
              setShowChatDrawer(!showChatDrawer);
              setUnreadChatCount(0);
            }}
            className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              showChatDrawer
                ? 'bg-orange-500 text-white shadow-md'
                : 'bg-[#3c4043] hover:bg-[#474a4e] text-white'
            }`}
            title="Chat with everyone"
          >
            <MessageSquare className="w-5 h-5" />
            {unreadChatCount > 0 && !showChatDrawer && (
              <span className="absolute -top-1 -right-1 bg-orange-500 text-white font-extrabold text-[10px] w-4 h-4 rounded-full flex items-center justify-center animate-bounce">
                {unreadChatCount}
              </span>
            )}
          </button>

          {/* 4. 3D Sign Interpreter Companion Panel Toggle (Activities) */}
          <button
            onClick={() => setShowSignCompanion(!showSignCompanion)}
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              showSignCompanion
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25 ring-2 ring-orange-400/40'
                : 'bg-[#3c4043] hover:bg-[#474a4e] text-white'
            }`}
            title={showSignCompanion ? 'Hide 3D Sign Avatar' : 'Show 3D Sign Avatar'}
          >
            <HandMetal className="w-5 h-5" />
          </button>

          {/* 5. AI Key & Settings */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              customApiKey
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'bg-[#3c4043] hover:bg-[#474a4e] text-white'
            }`}
            title={customApiKey ? `Custom Model Active (${customModel})` : 'AI Settings & API Key'}
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </footer>

      {/* ─── 5a. Meeting Biography & AI Topic Context Modal ────────────────── */}
      {showContextModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150 pointer-events-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-lg w-full text-white space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Meeting Biography &amp; AI Context</h3>
                  <p className="text-xs text-slate-400">Primes AI predictions with your profile and meeting scenario.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowContextModal(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile summary */}
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-950 rounded-xl border border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Participant:</span>
                <span className="font-bold text-white font-mono">{effectiveDisplayNameRef.current}</span>
                <span className="text-[10px] text-slate-500">({age} y/o)</span>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-orange-500/20 text-orange-300 font-mono text-[10px] uppercase font-semibold">
                {activeRole === 'deaf_signer' ? 'Deaf Signer' : 'Voice Speaker'}
              </span>
            </div>

            {/* Context Textarea */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 font-mono flex items-center justify-between">
                <span>Meeting Topic &amp; Context Details</span>
                <span className="text-[10px] text-slate-500">Live Fed to Gemini</span>
              </label>
              <textarea
                value={meetingContext}
                onChange={(e) => setMeetingContext(e.target.value)}
                placeholder="e.g. Patient: Bhushan Poojary, 22. Medical checkup for high fever, headache, and throat pain for 2 days."
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-orange-500 transition resize-none placeholder:text-slate-600"
              />
              <p className="text-[10px] text-slate-400 leading-relaxed">
                When the speaker asks &quot;What is your name?&quot; or &quot;What are your symptoms?&quot;, the AI word bar immediately offers your name and context keywords.
              </p>
            </div>

            {/* 1-Click Scenario Preset Chips */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400 font-mono">1-Click Scenario Presets:</span>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  {
                    icon: <Stethoscope className="w-3.5 h-3.5 text-emerald-400" />,
                    title: 'Doctor Checkup',
                    desc: `Patient: ${effectiveDisplayNameRef.current}, age ${age}. Medical consultation regarding high fever, throat pain, and headache for 2 days.`,
                  },
                  {
                    icon: <Briefcase className="w-3.5 h-3.5 text-sky-400" />,
                    title: 'Job Interview',
                    desc: `Candidate: ${effectiveDisplayNameRef.current}. Technical software engineering interview discussing Next.js, AI, and TypeScript.`,
                  },
                  {
                    icon: <GraduationCap className="w-3.5 h-3.5 text-amber-400" />,
                    title: 'College & Project',
                    desc: `Student: ${effectiveDisplayNameRef.current}. University engineering review of Indian Sign Language AI translation system.`,
                  },
                  {
                    icon: <HeartHandshake className="w-3.5 h-3.5 text-rose-400" />,
                    title: 'Casual Catchup',
                    desc: `Friendly conversation catching up on daily life, family, and hobbies.`,
                  },
                ].map((preset) => (
                  <button
                    key={preset.title}
                    type="button"
                    onClick={() => {
                      setMeetingContext(preset.desc);
                      try {
                        if (typeof window !== 'undefined') {
                          sessionStorage.setItem('sanket_meeting_context', preset.desc);
                        }
                      } catch {}
                    }}
                    className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-orange-500/50 text-left transition text-xs group cursor-pointer"
                  >
                    <div className="font-semibold text-slate-200 group-hover:text-orange-400 flex items-center gap-2">
                      {preset.icon}
                      <span>{preset.title}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  try {
                    if (typeof window !== 'undefined') {
                      sessionStorage.setItem('sanket_meeting_context', meetingContext.trim());
                    }
                  } catch {}
                  setToastMessage('Meeting Biography & AI Context Updated!');
                  setTimeout(() => setToastMessage(null), 3000);
                  setShowContextModal(false);
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-bold text-xs transition shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Save &amp; Apply to AI</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMeetingContext('');
                  try {
                    if (typeof window !== 'undefined') {
                      sessionStorage.removeItem('sanket_meeting_context');
                    }
                  } catch {}
                  setShowContextModal(false);
                }}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 5b. Custom AI Key & Model Settings Modal (BYOK) ────────────────── */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150 pointer-events-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-lg w-full text-white space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
                  <Sliders className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">AI Model &amp; API Key Settings</h3>
                  <p className="text-xs text-slate-400">Bring Your Own Key (BYOK) for customized inference.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Custom Gemini API Key */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 font-mono flex items-center justify-between">
                <span>Google Gemini API Key</span>
                <span className="text-[10px] text-slate-500">Stored safely in browser</span>
              </label>
              <input
                type="password"
                value={customApiKey}
                onChange={(e) => setCustomApiKey(e.target.value)}
                placeholder="AIzaSy... (Leave blank to use Platform Key)"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-orange-500 transition"
              />
              <p className="text-[10px] text-slate-400 leading-relaxed">
                If provided, your personal Gemini API key will be used for Speech-to-ISL grammar translation and Sign-to-Speech fluent reconstruction.
              </p>
            </div>

            {/* Model Name Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 font-mono">
                Model Name / Version
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setCustomModel(m)}
                    className={`py-2 px-2 rounded-xl text-xs font-mono text-center border transition cursor-pointer ${
                      customModel === m
                        ? 'bg-orange-500/20 border-orange-500 text-orange-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                placeholder="Or custom model string..."
                className="w-full px-4 py-2 mt-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-orange-500 transition"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => saveAiSettings(customApiKey, customModel)}
                className="flex-1 py-3 px-4 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-bold text-xs transition shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Save &amp; Apply Settings</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  saveAiSettings('', 'gemini-2.0-flash');
                  setCustomApiKey('');
                  setCustomModel('gemini-2.0-flash');
                }}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                Reset to Default
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 6. Share Meeting Invite Modal (Dialog) ─────────────────────────── */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-150 pointer-events-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl text-white space-y-5 relative">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Share Meeting Invite</h3>
                  <p className="text-xs text-slate-400">Anyone with this link can join this call</p>
                </div>
              </div>
              <button
                onClick={() => setShowShareModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Direct Join Link Section */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-mono text-slate-300 font-semibold uppercase tracking-wider">
                Direct Joining Link:
              </label>
              <div className="flex items-center gap-2 p-1.5 bg-slate-950 border border-slate-800 rounded-2xl">
                <input
                  type="text"
                  readOnly
                  value={joinUrl || `/room/${roomId}`}
                  suppressHydrationWarning
                  className="bg-transparent text-xs text-slate-200 px-3 py-1 flex-1 font-mono focus:outline-none select-all overflow-hidden text-ellipsis whitespace-nowrap"
                />
                <button
                  onClick={copyMeetingLink}
                  className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-semibold text-xs transition flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer"
                >
                  {isLinkCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isLinkCopied ? 'Copied!' : 'Copy Link'}</span>
                </button>
              </div>
            </div>

            {/* Meeting Room Code Section */}
            <div className="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800 rounded-2xl">
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase block font-semibold">
                  Meeting Code:
                </span>
                <span className="text-lg font-mono font-black text-orange-400 tracking-wider">
                  {roomId}
                </span>
              </div>
              <button
                onClick={copyOnlyCode}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition flex items-center gap-1.5 cursor-pointer"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                <span>{isCopied ? 'Copied' : 'Copy Code'}</span>
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setShowShareModal(false);
                  setShowQrInviteModal(true);
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-orange-500/20 to-amber-500/20 hover:from-orange-500/30 hover:to-amber-500/30 border border-orange-500/40 text-orange-300 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition shadow-sm"
              >
                <QrCode className="w-4 h-4 text-orange-400" />
                <span>Show QR Code</span>
              </button>

              <button
                onClick={handleNativeShare}
                className="flex-1 py-3 px-4 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-bold text-xs transition shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>Share via Apps</span>
              </button>

              <button
                onClick={() => setShowShareModal(false)}
                className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 7. Interactive ISL Visual Sign Posture Guide Modal ──────────────── */}
      {showSignGuideModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-2xl w-full text-white space-y-4 max-h-[88vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    <span>Indian Sign Language (ISL) Visual Guide</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                      262 Dataset Active
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    See exact hand positioning &amp; explore all 262 authentic Indian Sign Language motions. Tap <strong className="text-orange-400">&quot;Watch 3D Demo&quot;</strong> on any word!
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSignGuideModal(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Top-Level Mode Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setGuideActiveTab('camera');
                  setGuideActiveCategory('All');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  guideActiveTab === 'camera'
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Core Camera Gestures</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setGuideActiveTab('dataset');
                  setGuideActiveCategory('All');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  guideActiveTab === 'dataset'
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>All 262 Dataset Signs</span>
              </button>
            </div>

            {/* Search Input Filter */}
            <div className="relative shrink-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={guideSearchQuery}
                onChange={(e) => setGuideSearchQuery(e.target.value)}
                placeholder={
                  guideActiveTab === 'camera'
                    ? 'Filter gestures: hello, good morning, doctor, help...'
                    : 'Search 262 dataset words: doctor, hospital, family, car, bus, bicycle, table...'
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 font-medium focus:outline-none focus:border-orange-500"
              />
              {guideSearchQuery && (
                <button
                  type="button"
                  onClick={() => setGuideSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Category Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0 py-1">
              {(guideActiveTab === 'camera'
                ? ['All', 'Greetings', 'Medical', 'Daily', 'Basics']
                : [
                    'All',
                    'Greetings & Basics',
                    'Jobs & Health',
                    'Family & People',
                    'Places & Transport',
                    'Time & Days',
                    'Home & Electronics',
                    'Adjectives',
                    'Clothes & Colours',
                    'Animals & Nature',
                    'Society & Communication',
                  ]
              ).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setGuideActiveCategory(cat)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-mono font-medium transition cursor-pointer shrink-0 ${
                    guideActiveCategory === cat
                      ? 'bg-orange-500 text-white font-semibold shadow-xs'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Content List Area */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
              {guideActiveTab === 'camera' ? (
                // TAB 1: Core Camera Gestures
                ISL_SIGN_GUIDE_ITEMS.filter((item) => {
                  const matchesCat = guideActiveCategory === 'All' || item.category === guideActiveCategory;
                  const matchesQuery =
                    !guideSearchQuery.trim() ||
                    item.token.toLowerCase().includes(guideSearchQuery.toLowerCase()) ||
                    item.actionSummary.toLowerCase().includes(guideSearchQuery.toLowerCase());
                  return matchesCat && matchesQuery;
                }).map((item) => (
                  <div
                    key={item.token}
                    className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-100">
                          {item.displayLabel}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                          {item.recommendedHand}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800/80 text-orange-400 border border-orange-500/30">
                          {item.category}
                        </span>
                      </div>

                      <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <span className="text-orange-400">Position:</span>
                        <span>{item.actionSummary}</span>
                      </div>

                      <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                        {item.detailedGuide}
                      </p>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowSignGuideModal(false);
                          const targetWord = item.datasetWord || item.token.toLowerCase();
                          executeTranslateAndSign(targetWord);
                          setToastMessage(`Playing ISL Motion for "${item.token}" on 3D Hologram`);
                          setTimeout(() => setToastMessage(null), 3000);
                        }}
                        className="w-full sm:w-auto px-3.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-white font-mono text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                        title="Watch the 3D Hologram act out this sign from the authentic ISL dataset"
                      >
                        <Play className="w-3 h-3 fill-white" />
                        <span>Watch 3D Demo</span>
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                // TAB 2: All 262 Dataset Signs
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ALL_262_DATASET_WORDS.filter((item) => {
                    const matchesCat = guideActiveCategory === 'All' || item.category === guideActiveCategory;
                    const matchesQuery =
                      !guideSearchQuery.trim() ||
                      item.word.toLowerCase().includes(guideSearchQuery.toLowerCase()) ||
                      item.category.toLowerCase().includes(guideSearchQuery.toLowerCase());
                    return matchesCat && matchesQuery;
                  }).map((item) => (
                    <div
                      key={item.word}
                      className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition flex items-center justify-between gap-2"
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-white uppercase tracking-wide">
                          {item.displayLabel}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {item.category}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setShowSignGuideModal(false);
                          executeTranslateAndSign(item.word);
                          setToastMessage(`Playing ISL Motion for "${item.displayLabel}" on 3D Hologram`);
                          setTimeout(() => setToastMessage(null), 3000);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-orange-500 hover:bg-orange-400 text-white font-mono text-[10px] font-semibold flex items-center gap-1 transition shadow-xs cursor-pointer shrink-0"
                        title={`Play authentic ISL motion for "${item.word}" from .parquet dataset`}
                      >
                        <Play className="w-2.5 h-2.5 fill-white" />
                        <span>3D Demo</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer Note */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
              <span>Hold posture steadily in the camera zone for ~380ms until the meter fills.</span>
              <button
                type="button"
                onClick={() => setShowSignGuideModal(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Automated Bilingual Clinical & Meeting Minutes Generator Modal ─── */}
      {showMeetingNotesModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <style>{`
            @media print {
              @page {
                size: A4 portrait;
                margin: 12mm 15mm;
              }
              body * {
                visibility: hidden !important;
              }
              #clinical-record-print-root, #clinical-record-print-root * {
                visibility: visible !important;
              }
              #clinical-record-print-root {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                background: #ffffff !important;
                color: #0f172a !important;
                padding: 12px 16px !important;
                font-family: ui-sans-serif, system-ui, -apple-system, sans-serif !important;
                box-shadow: none !important;
                border: none !important;
              }
              #clinical-record-print-root div,
              #clinical-record-print-root p,
              #clinical-record-print-root span,
              #clinical-record-print-root h1,
              #clinical-record-print-root h2,
              #clinical-record-print-root h3,
              #clinical-record-print-root h4 {
                color: #0f172a !important;
                background-color: transparent !important;
                border-color: #cbd5e1 !important;
              }
              .no-print {
                display: none !important;
              }
              .print-border {
                border: 1px solid #cbd5e1 !important;
              }
              .print-bg-slate {
                background-color: #f8fafc !important;
              }
            }
          `}</style>
          
          <div className="bg-white/98 backdrop-blur-2xl border border-slate-200/90 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-800">
            {/* Modal Header (Matching Platform Theme) */}
            <div className="p-4 sm:p-5 border-b border-slate-200/80 flex items-center justify-between gap-3 shrink-0 bg-slate-50/90 no-print">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-400 text-white flex items-center justify-center font-black shadow-md shadow-orange-500/20 shrink-0">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                    <span>Bilingual Meeting Minutes &amp; Clinical Record (MOM)</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-600 font-mono text-[10px] font-bold">
                      Live Ledger
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Certified Clinical Notes bridging Deaf Signers (ISL) &amp; Hearing Practitioners (Voice)
                  </p>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-2">
                {/* 1-Click Print / Save PDF (Signature Primary Theme Style) */}
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold text-xs flex items-center gap-1.5 transition shadow-md shadow-orange-500/25 cursor-pointer active:scale-95"
                  title="Print or Save as PDF (A4 Clinical Format)"
                >
                  <Printer className="w-4 h-4" />
                  <span className="hidden sm:inline">Print / Save PDF (A4)</span>
                </button>

                {/* Copy Markdown */}
                <button
                  type="button"
                  onClick={() => {
                    const formatNotesAsMarkdown = () => {
                      let md = `# Bilingual Meeting Minutes & Clinical Record (MOM)\n\n`;
                      md += `- **Room ID**: ${roomId}\n`;
                      md += `- **Date**: ${new Date().toLocaleDateString()}\n`;
                      md += `- **Session Duration**: ${formatTime(meetingDurationSec)}\n`;
                      md += `- **Deaf Signer**: ${effectiveDisplayNameRef.current || displayName || 'Signer'}\n`;
                      md += `- **Speaker / Doctor**: ${remoteParticipants.values().next().value?.displayName || 'Healthcare Practitioner / Doctor'}\n`;
                      md += `- **Total Exchanges Logged**: ${meetingNotesLog.length}\n\n`;

                      const prescriptions = meetingNotesLog.filter((e) => e.category === 'prescription');
                      const medical = meetingNotesLog.filter((e) => e.category === 'medical');
                      const actionItems = meetingNotesLog.filter((e) => e.category === 'action_item');

                      if (prescriptions.length > 0 || medical.length > 0 || actionItems.length > 0) {
                        md += `## Key Clinical Takeaways & Prescriptions\n\n`;
                        if (prescriptions.length > 0) {
                          md += `### Prescriptions & Dosages\n`;
                          prescriptions.forEach((p) => {
                            md += `- [${p.timestamp}] **${p.speaker}**: ${p.translatedContent || p.originalContent}\n`;
                          });
                          md += `\n`;
                        }
                        if (medical.length > 0) {
                          md += `### Medical Notes & Symptoms\n`;
                          medical.forEach((m) => {
                            md += `- [${m.timestamp}] **${m.speaker}**: ${m.translatedContent || m.originalContent}\n`;
                          });
                          md += `\n`;
                        }
                        if (actionItems.length > 0) {
                          md += `### Action Items & Follow-ups\n`;
                          actionItems.forEach((a) => {
                            md += `- [${a.timestamp}] **${a.speaker}**: ${a.translatedContent || a.originalContent}\n`;
                          });
                          md += `\n`;
                        }
                      }

                      md += `## Chronological Bilingual Dialogue Ledger\n\n`;
                      md += `| Timestamp | Speaker | Modality | Spoken English Content | Articulated ISL Signs |\n`;
                      md += `|---|---|---|---|---|\n`;
                      meetingNotesLog.forEach((e) => {
                        const spoken = e.role === 'hearing_speaker' ? e.originalContent : e.translatedContent;
                        const isl = e.role === 'hearing_speaker' ? e.translatedContent : e.originalContent;
                        const mod = e.sourceType === 'speech' ? 'Voice -> ISL' : 'ISL -> Speech';
                        md += `| ${e.timestamp} | ${e.speaker} | ${mod} | ${spoken.replace(/\|/g, '/')} | ${isl.replace(/\|/g, '/')} |\n`;
                      });
                      return md;
                    };

                    const md = formatNotesAsMarkdown();
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(md);
                      setToastMessage('Copied Minutes Markdown to Clipboard!');
                      setTimeout(() => setToastMessage(null), 3000);
                    }
                  }}
                  className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition border border-slate-200 shadow-xs cursor-pointer"
                  title="Copy formatted Markdown to Clipboard"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Copy Markdown</span>
                </button>

                {/* Download Text */}
                <button
                  type="button"
                  onClick={() => {
                    let text = `============================================================\n`;
                    text += `   BILINGUAL MEETING MINUTES & CLINICAL RECORD (MOM)\n`;
                    text += `   Sanket AI Accessible Telehealth & Meeting Network\n`;
                    text += `============================================================\n\n`;
                    text += `Room Code:         ${roomId}\n`;
                    text += `Date:              ${new Date().toLocaleDateString()}\n`;
                    text += `Duration:          ${formatTime(meetingDurationSec)}\n`;
                    text += `Signer:            ${effectiveDisplayNameRef.current || displayName || 'Signer'}\n`;
                    text += `Speaker / Doctor:  ${remoteParticipants.values().next().value?.displayName || 'Healthcare Practitioner'}\n`;
                    text += `Exchanges Logged:  ${meetingNotesLog.length}\n\n`;

                    const prescriptions = meetingNotesLog.filter((e) => e.category === 'prescription');
                    const medical = meetingNotesLog.filter((e) => e.category === 'medical');
                    const actionItems = meetingNotesLog.filter((e) => e.category === 'action_item');

                    if (prescriptions.length > 0 || medical.length > 0 || actionItems.length > 0) {
                      text += `------------------------------------------------------------\n`;
                      text += `KEY CLINICAL TAKEAWAYS & ACTION ITEMS\n`;
                      text += `------------------------------------------------------------\n`;
                      if (prescriptions.length > 0) {
                        text += `[Prescriptions & Dosages]\n`;
                        prescriptions.forEach((p) => {
                          text += ` - ${p.timestamp} (${p.speaker}): ${p.translatedContent || p.originalContent}\n`;
                        });
                        text += `\n`;
                      }
                      if (medical.length > 0) {
                        text += `[Medical Notes & Symptoms]\n`;
                        medical.forEach((m) => {
                          text += ` - ${m.timestamp} (${m.speaker}): ${m.translatedContent || m.originalContent}\n`;
                        });
                        text += `\n`;
                      }
                      if (actionItems.length > 0) {
                        text += `[Action Items & Follow-ups]\n`;
                        actionItems.forEach((a) => {
                          text += ` - ${a.timestamp} (${a.speaker}): ${a.translatedContent || a.originalContent}\n`;
                        });
                        text += `\n`;
                      }
                    }

                    text += `------------------------------------------------------------\n`;
                    text += `CHRONOLOGICAL BILINGUAL TRANSCRIPT LEDGER\n`;
                    text += `------------------------------------------------------------\n`;
                    meetingNotesLog.forEach((e, idx) => {
                      const spoken = e.role === 'hearing_speaker' ? e.originalContent : e.translatedContent;
                      const isl = e.role === 'hearing_speaker' ? e.translatedContent : e.originalContent;
                      text += `[${idx + 1}] ${e.timestamp} | ${e.speaker} (${e.role === 'deaf_signer' ? 'ISL Signer' : 'Voice Speaker'})\n`;
                      text += `    Spoken English: ${spoken}\n`;
                      text += `    ISL Notation:   ${isl}\n\n`;
                    });

                    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `Meeting_Minutes_${roomId}_${new Date().toISOString().slice(0, 10)}.txt`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    setToastMessage('Downloaded Meeting Minutes (.txt)');
                    setTimeout(() => setToastMessage(null), 3000);
                  }}
                  className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition border border-slate-200 shadow-xs cursor-pointer"
                  title="Download Raw .txt Document"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Export .txt</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowMeetingNotesModal(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Root */}
            <div id="clinical-record-print-root" className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6 scrollbar-thin bg-white text-slate-900">
              {/* Document Letterhead (Formatted for Official PDF Export) */}
              <div className="border-b border-slate-200 pb-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center text-white font-black text-xs shadow-sm">
                        S
                      </div>
                      <span className="font-extrabold text-base tracking-tight text-slate-900">
                        Sanket<span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block ml-0.5" />
                      </span>
                      <span className="text-[10px] font-mono text-slate-600 border border-slate-200 bg-slate-50 rounded px-2 py-0.5">
                        RPWD Compliant Dual-Stream
                      </span>
                    </div>
                    <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                      <Stethoscope className="w-5 h-5 text-emerald-600" />
                      <span>Clinical Consultation Minutes &amp; Transcript (MOM)</span>
                    </h2>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      Certified Dual-Stream Transcript &bull; Indian Sign Language (ISL) &bull; Vocal Speech
                    </p>
                  </div>
                  <div className="text-right font-mono text-xs text-slate-500 space-y-0.5">
                    <div>Session ID: <strong className="text-slate-900 font-bold">{roomId}</strong></div>
                    <div>Date: <span className="text-slate-700">{new Date().toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span></div>
                    <div className="text-[10px] text-emerald-600 font-bold">STATUS: OFFICIAL RECORD</div>
                  </div>
                </div>
              </div>

              {/* 4 Metadata Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-mono">
                    <Clock className="w-3 h-3 text-orange-500" />
                    <span>Duration</span>
                  </div>
                  <div className="text-base font-extrabold text-slate-900 font-mono">
                    {formatTime(meetingDurationSec)}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-mono">
                    <Hand className="w-3 h-3 text-orange-500" />
                    <span>Deaf Signer</span>
                  </div>
                  <div className="text-sm font-bold text-orange-600 truncate">
                    {effectiveDisplayNameRef.current || displayName || 'Signer'}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-mono">
                    <Mic className="w-3 h-3 text-sky-500" />
                    <span>Speaker / Doctor</span>
                  </div>
                  <div className="text-sm font-bold text-sky-600 truncate">
                    {remoteParticipants.values().next().value?.displayName || 'Practitioner'}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-mono">
                    <Activity className="w-3 h-3 text-emerald-500" />
                    <span>Exchanges</span>
                  </div>
                  <div className="text-base font-extrabold text-emerald-600 font-mono">
                    {meetingNotesLog.length} items
                  </div>
                </div>
              </div>

              {/* Extracted Key Clinical Takeaways & Prescriptions */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Key Clinical Takeaways &amp; Prescriptions</span>
                </h4>

                {(() => {
                  const prescriptions = meetingNotesLog.filter((e) => e.category === 'prescription');
                  const medical = meetingNotesLog.filter((e) => e.category === 'medical');
                  const actionItems = meetingNotesLog.filter((e) => e.category === 'action_item');

                  if (prescriptions.length === 0 && medical.length === 0 && actionItems.length === 0) {
                    return (
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2.5">
                        <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>
                          General dialogue recorded. As medication names (tablets, dosages), symptoms, or follow-up plans are spoken or signed, they will automatically be categorized here.
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {prescriptions.length > 0 && (
                        <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 space-y-2">
                          <div className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span>Prescriptions &amp; Dosages ({prescriptions.length})</span>
                          </div>
                          <ul className="space-y-1.5 text-xs text-slate-800">
                            {prescriptions.map((p) => (
                              <li key={p.id} className="flex items-start gap-2">
                                <span className="text-emerald-600 font-mono font-bold">&bull;</span>
                                <div>
                                  <span className="font-semibold text-slate-900">{p.translatedContent || p.originalContent}</span>
                                  <span className="text-[10px] text-slate-500 ml-2 font-mono">[{p.timestamp} &bull; {p.speaker}]</span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {medical.length > 0 && (
                        <div className="p-4 rounded-2xl bg-sky-50/80 border border-sky-200 space-y-2">
                          <div className="text-xs font-bold text-sky-800 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-sky-500" />
                            <span>Symptoms &amp; Clinical Notes ({medical.length})</span>
                          </div>
                          <ul className="space-y-1.5 text-xs text-slate-800">
                            {medical.map((m) => (
                              <li key={m.id} className="flex items-start gap-2">
                                <span className="text-sky-600 font-mono font-bold">&bull;</span>
                                <div>
                                  <span className="font-semibold text-slate-900">{m.translatedContent || m.originalContent}</span>
                                  <span className="text-[10px] text-slate-500 ml-2 font-mono">[{m.timestamp} &bull; {m.speaker}]</span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {actionItems.length > 0 && (
                        <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-2 md:col-span-2">
                          <div className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            <span>Action Items &amp; Next Steps ({actionItems.length})</span>
                          </div>
                          <ul className="space-y-1.5 text-xs text-slate-800">
                            {actionItems.map((a) => (
                              <li key={a.id} className="flex items-start gap-2">
                                <span className="text-amber-600 font-mono font-bold">&bull;</span>
                                <div>
                                  <span className="font-semibold text-slate-900">{a.translatedContent || a.originalContent}</span>
                                  <span className="text-[10px] text-slate-500 ml-2 font-mono">[{a.timestamp} &bull; {a.speaker}]</span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Chronological Bilingual Transcript Ledger */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-600" />
                    <span>Chronological Bilingual Transcript Ledger</span>
                  </h4>
                  <span className="text-[11px] font-mono text-slate-500">
                    {meetingNotesLog.length} Recorded Exchanges
                  </span>
                </div>

                {meetingNotesLog.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
                    <FileText className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="text-sm font-semibold text-slate-800">No Dialogue Recorded Yet</p>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Speak into the microphone or sign in front of the camera. The system will automatically build your structured bilingual clinical record here in real time.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {meetingNotesLog.map((entry, idx) => {
                      const isSigner = entry.role === 'deaf_signer';
                      const spoken = isSigner ? entry.translatedContent : entry.originalContent;
                      const isl = isSigner ? entry.originalContent : entry.translatedContent;

                      return (
                        <div
                          key={entry.id || idx}
                          className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition flex flex-col sm:flex-row sm:items-start justify-between gap-3 shadow-xs"
                        >
                          <div className="space-y-1.5 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                                {entry.timestamp}
                              </span>
                              <span className="font-bold text-xs text-slate-900">
                                {entry.speaker}
                              </span>
                              <span
                                className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold ${
                                  isSigner
                                    ? 'bg-orange-50 text-orange-700 border border-orange-200'
                                    : 'bg-sky-50 text-sky-700 border border-sky-200'
                                }`}
                              >
                                {isSigner ? 'ISL Signer' : 'Voice Speaker'}
                              </span>
                              {entry.category && entry.category !== 'general' && (
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase font-semibold">
                                  {entry.category.replace('_', ' ')}
                                </span>
                              )}
                            </div>

                            <div className="space-y-1 pt-0.5">
                              <div className="text-sm font-semibold text-slate-900 leading-relaxed">
                                {spoken}
                              </div>
                              <div className="text-xs font-mono text-orange-900 bg-orange-50/80 px-2.5 py-1 rounded-lg border border-orange-200 inline-block">
                                <span className="text-orange-700 font-semibold mr-1.5">ISL Articulation:</span>
                                <span>{isl}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Official Verification Sign-off Block for Print / Download */}
              <div className="mt-8 pt-6 border-t border-slate-200 space-y-4">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
                  Document Sign-off &amp; Compliance Verification
                </div>
                <div className="grid grid-cols-2 gap-8 text-xs">
                  <div className="space-y-1">
                    <p className="text-slate-500 font-mono text-[11px] uppercase">
                      Attending Clinician / Doctor
                    </p>
                    <div className="h-10 border-b border-dashed border-slate-400 flex items-end pb-1 font-cursive text-base text-slate-800">
                      {remoteParticipants.values().next().value?.displayName || 'Practitioner / Doctor'}
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono">Signature &amp; Verification Date</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-slate-500 font-mono text-[11px] uppercase">
                      Deaf Signer / Patient
                    </p>
                    <div className="h-10 border-b border-dashed border-slate-400 flex items-end justify-end pb-1 font-cursive text-base text-orange-600">
                      {effectiveDisplayNameRef.current || displayName || 'Signer'}
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono">Dual-Stream ISL Verified Record</p>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 font-mono text-center pt-2">
                  Generated by Sanket AI On-Device Neural Translation System &bull; Cryptographically Bound to Room {roomId}
                </p>
              </div>

            </div>

            {/* Modal Footer Note */}
            <div className="p-3 sm:p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0 bg-slate-50/90 no-print">
              <span>Ready for EHR, Hospital Management, or Meeting Archives.</span>
              <button
                type="button"
                onClick={() => setShowMeetingNotesModal(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Instant QR Code Invite & Direct Phone Scan Modal ─────────────── */}
      <QrInviteModal
        isOpen={showQrInviteModal}
        onClose={() => setShowQrInviteModal(false)}
        roomId={roomId}
      />
    </div>
  );
}

export default function MeetingRoomPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3 text-orange-400 font-mono text-sm">
          <div className="w-8 h-8 rounded-full border-2 border-orange-500/30 border-t-orange-500 animate-spin" />
          <span>Entering Accessible Meeting Room...</span>
        </div>
      }
    >
      <AuthGuard featureName="Accessible Video Room">
        <MeetingRoomContent />
      </AuthGuard>
    </React.Suspense>
  );
}

