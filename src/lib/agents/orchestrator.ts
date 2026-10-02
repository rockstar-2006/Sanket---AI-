/**
 * Master Meeting Orchestrator Agent (Google ADK Pattern)
 * Coordinates sub-agents, synchronizes meeting turns, and produces verified meeting state.
 */

import { contextPredictorAgent } from './contextPredictorAgent';
import { translatorAgent } from './translatorAgent';
import {
  MeetingContext,
  DialogueTurn,
  ParticipantRole,
  AutocompletePrediction,
  SignTranslationResponse,
  MeetingSummaryState,
} from './types';

export class MeetingOrchestrator {
  private meetings: Map<string, MeetingContext> = new Map();
  private summaries: Map<string, MeetingSummaryState> = new Map();

  /**
   * Initializes or fetches an active meeting room context
   */
  getOrCreateMeeting(roomId: string): MeetingContext {
    if (!this.meetings.has(roomId)) {
      this.meetings.set(roomId, {
        roomId,
        candidateSkills: ['React', 'TypeScript', 'Kubernetes', 'Docker', 'Python', 'WebRTC'],
        recentDialogue: [],
      });
      this.summaries.set(roomId, {
        roomId,
        agendaItems: [
          { id: 1, text: 'Candidate introduction & background', done: true },
          { id: 2, text: 'Review ISL sign language responses', done: true },
          { id: 3, text: 'Discuss technical skills & experience', done: false },
          { id: 4, text: 'Live Q&A with real-time speech captions', done: false },
        ],
        verifiedSkills: [],
        keyDiscussionPoints: [],
      });
    }
    return this.meetings.get(roomId)!;
  }

  /**
   * Configures Candidate Resume & Job Description for the Context Engine
   */
  setContextDocuments(roomId: string, resume?: string, jobDescription?: string) {
    const meeting = this.getOrCreateMeeting(roomId);
    if (resume) meeting.candidateResume = resume;
    if (jobDescription) meeting.jobDescription = jobDescription;

    contextPredictorAgent.updateContext(resume, jobDescription);
  }

  /**
   * Event 1: Deaf candidate fingerspells a prefix
   * Routes to ContextPredictor Sub-Agent
   */
  async handleFingerspellPrefix(roomId: string, prefix: string): Promise<AutocompletePrediction[]> {
    const meeting = this.getOrCreateMeeting(roomId);
    const result = await contextPredictorAgent.predict({
      prefix,
      candidateResume: meeting.candidateResume,
      jobDescription: meeting.jobDescription,
      recentDialogue: meeting.recentDialogue,
    });
    return result.predictions;
  }

  /**
   * Event 2: Speaking interviewer speaks (Speech-to-Text captured)
   * Routes to Translator Sub-Agent to generate 3D Avatar actions & updates dialogue history
   */
  handleInterviewerSpeech(roomId: string, text: string, senderName: string = 'Interviewer'): {
    dialogueTurn: DialogueTurn;
    translation: SignTranslationResponse;
  } {
    const meeting = this.getOrCreateMeeting(roomId);
    const turn: DialogueTurn = {
      id: `turn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      senderRole: 'speaking_interviewer',
      senderName,
      text,
      timestamp: Date.now(),
    };

    meeting.recentDialogue.push(turn);
    if (meeting.recentDialogue.length > 20) {
      meeting.recentDialogue.shift();
    }

    const translation = translatorAgent.translateSpeechToSigns(text);
    turn.signTokens = translation.matchedVocabTokens;

    return { dialogueTurn: turn, translation };
  }

  /**
   * Event 3: Deaf candidate completes a word/sentence via sign or autocomplete
   * Updates dialogue history & verifies technical skills discussed
   */
  handleCandidateSigned(roomId: string, text: string, senderName: string = 'Candidate', isAutoCompleted: boolean = false): {
    dialogueTurn: DialogueTurn;
    verifiedSkill?: string;
  } {
    const meeting = this.getOrCreateMeeting(roomId);
    const summary = this.summaries.get(roomId)!;

    const turn: DialogueTurn = {
      id: `turn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      senderRole: 'deaf_signer',
      senderName,
      text,
      timestamp: Date.now(),
      isAutoCompleted,
    };

    meeting.recentDialogue.push(turn);
    if (meeting.recentDialogue.length > 20) {
      meeting.recentDialogue.shift();
    }

    // Check if a technical skill was verified
    let verifiedSkill: string | undefined;
    const cleanLower = text.toLowerCase();
    for (const skill of meeting.candidateSkills) {
      if (cleanLower.includes(skill.toLowerCase()) && !summary.verifiedSkills.includes(skill)) {
        summary.verifiedSkills.push(skill);
        verifiedSkill = skill;
      }
    }

    return { dialogueTurn: turn, verifiedSkill };
  }

  /**
   * Returns current meeting summary & verified skills
   */
  getMeetingSummary(roomId: string): MeetingSummaryState {
    this.getOrCreateMeeting(roomId);
    return this.summaries.get(roomId)!;
  }
}

// Global Singleton Orchestrator
export const meetingOrchestrator = new MeetingOrchestrator();
