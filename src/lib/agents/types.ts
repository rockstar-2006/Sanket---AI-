/**
 * Google GenAI / Agent Development Kit (ADK) Multi-Agent Architecture
 * Shared types for Meeting Orchestrator and Sub-Agents
 */

export type ParticipantRole = 'speaking_interviewer' | 'deaf_signer';

export interface MeetingContext {
  roomId: string;
  jobDescription?: string;
  candidateResume?: string;
  candidateSkills: string[];
  recentDialogue: DialogueTurn[];
}

export interface DialogueTurn {
  id: string;
  senderRole: ParticipantRole;
  senderName: string;
  text: string;
  timestamp: number;
  isAutoCompleted?: boolean;
  signTokens?: string[];
}

export interface AutocompletePrediction {
  word: string;
  confidence: number;
  category?: string;
  source: 'trie_instant' | 'llm_context';
  definitionOrContext?: string;
}

export interface ContextPredictorRequest {
  prefix: string;
  candidateResume?: string;
  jobDescription?: string;
  recentDialogue?: DialogueTurn[];
}

export interface ContextPredictorResponse {
  prefix: string;
  predictions: AutocompletePrediction[];
  latencyMs: number;
}

export interface SignTranslationRequest {
  text: string;
  direction: 'speech_to_signs' | 'signs_to_speech';
}

export interface SignTranslationResponse {
  originalText: string;
  matchedVocabTokens: string[]; // From 262 ISL vocabulary
  fingerspellLetters: string[]; // For words not in 262 vocabulary
  formattedSpeech?: string; // Naturalized text if signs_to_speech
  avatarKeyframeTimeline?: Array<{
    type: 'word' | 'letter';
    token: string;
    durationMs: number;
  }>;
}

export interface AgentAction {
  agentName: 'orchestrator' | 'context_engine' | 'translator' | 'copilot';
  actionType: 'predict' | 'translate' | 'summarize' | 'agenda_update' | 'clarify';
  payload: any;
}

export interface MeetingSummaryState {
  roomId: string;
  agendaItems: Array<{ id: number; text: string; done: boolean }>;
  verifiedSkills: string[];
  keyDiscussionPoints: string[];
  candidateScorecard?: {
    technicalProficiency: number;
    communicationClarity: number;
    notes: string;
  };
}
