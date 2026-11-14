export type UserRole = 'doctor' | 'patient' | 'admin' | 'guest';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  specialty?: string;
  licenseNumber?: string;
  createdAt: string;
}

export type ConsultationType = 'urgent' | 'specialist' | 'general' | 'followup';

export interface MeetingSession {
  id: string;
  title: string;
  description?: string;
  hostUid: string;
  hostName: string;
  roomCode: string;
  createdAt: any;
  endedAt?: any;
  status: 'scheduled' | 'active' | 'ended';
  consultationType: ConsultationType;
  maxParticipants: number;
}

export interface ParticipantState {
  uid: string;
  socketId: string;
  displayName: string;
  photoURL?: string | null;
  role?: UserRole;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isSpeaking?: boolean;
  isHandRaised?: boolean;
  joinedAt: number;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderUid: string;
  senderName: string;
  senderRole?: UserRole;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export interface DeviceOptions {
  audioInputs: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
  selectedAudioId: string;
  selectedVideoId: string;
}

export interface SignalingOfferPayload {
  targetSocketId: string;
  callerSocketId: string;
  offer: RTCSessionDescriptionInit;
  user: ParticipantState;
}

export interface SignalingAnswerPayload {
  targetSocketId: string;
  callerSocketId: string;
  answer: RTCSessionDescriptionInit;
}

export interface SignalingIcePayload {
  targetSocketId: string;
  callerSocketId: string;
  candidate: RTCIceCandidateInit;
}

export interface MediaToggleState {
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
}

export function normalizeRoomCode(val: string): string {
  const trimmed = decodeURIComponent(String(val || '')).trim();
  if (!trimmed) return '';
  if (trimmed.includes('/')) {
    const parts = trimmed.split('?')[0].split('/');
    const lastPart = parts.filter(Boolean).pop() || '';
    return lastPart.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  }
  return trimmed.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}
