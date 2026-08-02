'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Room, RoomEvent, Participant, RemoteParticipant, LocalParticipant, Track, ConnectionState } from 'livekit-client';
import { ParticipantState, UserRole } from '@/types';

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
  isSelf: boolean;
}

interface UseWebRTCOptions {
  roomId: string;
  user: {
    uid: string;
    displayName: string;
    photoURL?: string | null;
    role?: UserRole;
  };
  initialAudioMuted?: boolean;
  initialVideoOff?: boolean;
}

export function useWebRTC({
  roomId,
  user,
  initialAudioMuted = false,
  initialVideoOff = false,
}: UseWebRTCOptions) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [participants, setParticipants] = useState<Map<string, ParticipantState>>(new Map());
  const [isAudioMuted, setIsAudioMuted] = useState(initialAudioMuted);
  const [isVideoOff, setIsVideoOff] = useState(initialVideoOff);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRoomFull, setIsRoomFull] = useState(false);
  const [roomFullMessage, setRoomFullMessage] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  
  // Real-time Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'Sanket AI System',
      text: 'Welcome to the call! Encrypted LiveKit room initialized.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSelf: false,
    },
  ]);

  const roomRef = useRef<Room | null>(null);

  // Helper to compile all tracks of a participant into a standard MediaStream
  const updateRemoteStream = useCallback((participant: RemoteParticipant) => {
    const tracks: MediaStreamTrack[] = [];
    
    // Prefer screen share track if published, otherwise camera track
    let screenTrack: MediaStreamTrack | null = null;
    let cameraTrack: MediaStreamTrack | null = null;

    participant.videoTrackPublications.forEach((pub) => {
      if (pub.track?.mediaStreamTrack) {
        if (pub.source === Track.Source.ScreenShare || pub.trackName === 'screen') {
          screenTrack = pub.track.mediaStreamTrack;
        } else {
          cameraTrack = pub.track.mediaStreamTrack;
        }
      }
    });

    // If participant is sharing screen, use screen track first
    if (screenTrack) {
      tracks.push(screenTrack);
    } else if (cameraTrack) {
      tracks.push(cameraTrack);
    }

    participant.audioTrackPublications.forEach((pub) => {
      if (pub.track?.mediaStreamTrack) {
        tracks.push(pub.track.mediaStreamTrack);
      }
    });

    setRemoteStreams((prev) => {
      const next = new Map(prev);
      if (tracks.length > 0) {
        next.set(participant.sid, new MediaStream(tracks));
      } else {
        next.delete(participant.sid);
      }
      return next;
    });
  }, []);

  // Update local stream representation
  const updateLocalStream = useCallback((room: Room) => {
    const localParticipant = room.localParticipant;
    const tracks: MediaStreamTrack[] = [];

    let screenTrack: MediaStreamTrack | null = null;
    let cameraTrack: MediaStreamTrack | null = null;

    localParticipant.videoTrackPublications.forEach((pub) => {
      if (pub.track?.mediaStreamTrack) {
        if (pub.source === Track.Source.ScreenShare || pub.trackName === 'screen') {
          screenTrack = pub.track.mediaStreamTrack;
        } else {
          cameraTrack = pub.track.mediaStreamTrack;
        }
      }
    });

    if (screenTrack) {
      tracks.push(screenTrack);
    } else if (cameraTrack) {
      tracks.push(cameraTrack);
    }

    localParticipant.audioTrackPublications.forEach((pub) => {
      if (pub.track?.mediaStreamTrack) {
        tracks.push(pub.track.mediaStreamTrack);
      }
    });

    setLocalStream(tracks.length > 0 ? new MediaStream(tracks) : null);
    setIsAudioMuted(!localParticipant.isMicrophoneEnabled);
    setIsVideoOff(!localParticipant.isCameraEnabled);
    setIsScreenSharing(localParticipant.isScreenShareEnabled);
  }, []);

  // Sync Remote Participant States to the UI
  const syncParticipantStates = useCallback((room: Room) => {
    const nextParticipants = new Map<string, ParticipantState>();

    room.remoteParticipants.forEach((p) => {
      nextParticipants.set(p.sid, {
        uid: p.identity,
        socketId: p.sid,
        displayName: p.name || p.identity,
        photoURL: null,
        role: 'patient', // fallback
        isMuted: !p.isMicrophoneEnabled,
        isVideoOff: !p.isCameraEnabled,
        isScreenSharing: p.isScreenShareEnabled,
        joinedAt: Date.now(),
      });
      updateRemoteStream(p);
    });

    setParticipants(nextParticipants);
  }, [updateRemoteStream]);

  // Primary Connect Logic
  useEffect(() => {
    let isMounted = true;
    let room: Room | null = null;

    async function initLiveKit() {
      try {
        setConnectionStatus('connecting');

        // 1. Fetch token and LiveKit URL from server API
        const tokenRes = await fetch(
          `/api/livekit/token?room=${encodeURIComponent(roomId)}&identity=${encodeURIComponent(user.uid)}&name=${encodeURIComponent(user.displayName)}`
        );
        if (!tokenRes.ok) {
          throw new Error("Failed to retrieve authentication token.");
        }
        const { token, url } = await tokenRes.json();

        if (!isMounted) return;

        // 2. Initialize LiveKit Room instance
        room = new Room({
          adaptiveStream: true,
          dynacast: true,
          videoCaptureDefaults: {
            resolution: { width: 1280, height: 720 },
            frameRate: 30,
          },
          publishDefaults: {
            simulcast: true,
            videoCodec: 'vp8',
            screenShareEncoding: {
              maxBitrate: 1_500_000,
              maxFramerate: 15,
            },
          },
        });
        roomRef.current = room;

        // 3. Bind Room Events
        room.on(RoomEvent.ConnectionStateChanged, (state) => {
          if (!isMounted) return;
          if (state === ConnectionState.Connected) {
            setConnectionStatus('connected');
          } else if (state === ConnectionState.Disconnected) {
            setConnectionStatus('error');
          }
        });

        room.on(RoomEvent.ParticipantConnected, (p: RemoteParticipant) => {
          console.log(`[LiveKit] Participant connected: ${p.name || p.identity}`);
          syncParticipantStates(room!);
        });

        room.on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
          console.log(`[LiveKit] Participant disconnected: ${p.name || p.identity}`);
          syncParticipantStates(room!);
          setRemoteStreams((prev) => {
            const next = new Map(prev);
            next.delete(p.sid);
            return next;
          });
        });

        room.on(RoomEvent.TrackSubscribed, (_, pub, participant: RemoteParticipant) => {
          updateRemoteStream(participant);
          syncParticipantStates(room!);
        });

        room.on(RoomEvent.TrackUnsubscribed, (_, pub, participant: RemoteParticipant) => {
          updateRemoteStream(participant);
          syncParticipantStates(room!);
        });

        room.on(RoomEvent.TrackMuted, (_, participant: Participant) => {
          if (participant instanceof RemoteParticipant) {
            updateRemoteStream(participant);
          } else {
            updateLocalStream(room!);
          }
          syncParticipantStates(room!);
        });

        room.on(RoomEvent.TrackUnmuted, (_, participant: Participant) => {
          if (participant instanceof RemoteParticipant) {
            updateRemoteStream(participant);
          } else {
            updateLocalStream(room!);
          }
          syncParticipantStates(room!);
        });

        room.on(RoomEvent.LocalTrackPublished, () => {
          if (room) updateLocalStream(room);
        });

        room.on(RoomEvent.LocalTrackUnpublished, () => {
          if (room) updateLocalStream(room);
        });

        // 4. Handle Incoming Data / Real-time Chat Messages
        room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: RemoteParticipant) => {
          try {
            const textDecoder = new TextDecoder();
            const decoded = JSON.parse(textDecoder.decode(payload));
            if (decoded && decoded.text) {
              setChatMessages((prev) => [
                ...prev,
                {
                  id: Math.random().toString(),
                  sender: decoded.sender || participant?.name || participant?.identity || 'Participant',
                  text: decoded.text,
                  timestamp: decoded.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  isSelf: false,
                },
              ]);
            }
          } catch (err) {
            console.error("[LiveKit] Error parsing data packet:", err);
          }
        });

        // 5. Connect to LiveKit SFU server
        await room.connect(url, token);

        if (!isMounted) {
          room.disconnect();
          return;
        }

        // 6. Publish initial tracks
        await room.localParticipant.setMicrophoneEnabled(!initialAudioMuted);
        await room.localParticipant.setCameraEnabled(!initialVideoOff);

        updateLocalStream(room);
        syncParticipantStates(room);

      } catch (err) {
        console.error("[LiveKit] Connection error:", err);
        if (isMounted) {
          setConnectionStatus('error');
        }
      }
    }

    initLiveKit();

    return () => {
      isMounted = false;
      if (room) {
        room.disconnect();
      }
    };
  }, [roomId, user.uid, user.displayName, initialAudioMuted, initialVideoOff, syncParticipantStates, updateLocalStream, updateRemoteStream]);

  // Audio Toggle Action
  const toggleAudio = useCallback(async () => {
    const room = roomRef.current;
    if (room?.localParticipant) {
      const targetState = !room.localParticipant.isMicrophoneEnabled;
      await room.localParticipant.setMicrophoneEnabled(targetState);
      updateLocalStream(room);
    }
  }, [updateLocalStream]);

  // Video Toggle Action
  const toggleVideo = useCallback(async () => {
    const room = roomRef.current;
    if (room?.localParticipant) {
      const targetState = !room.localParticipant.isCameraEnabled;
      await room.localParticipant.setCameraEnabled(targetState);
      updateLocalStream(room);
    }
  }, [updateLocalStream]);

  // Screen Share Toggle Action
  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (room?.localParticipant) {
      const targetState = !room.localParticipant.isScreenShareEnabled;
      await room.localParticipant.setScreenShareEnabled(targetState, { audio: false });
      updateLocalStream(room);
    }
  }, [updateLocalStream]);

  // Send Real-Time Chat Message to All Room Participants
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msgObj = {
      sender: user.displayName,
      text: text.trim(),
      timestamp: timestampStr,
    };

    // 1. Append locally
    setChatMessages((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        sender: user.displayName,
        text: text.trim(),
        timestamp: timestampStr,
        isSelf: true,
      },
    ]);

    // 2. Broadcast data message to all remote participants via LiveKit
    const room = roomRef.current;
    if (room && room.localParticipant) {
      try {
        const textEncoder = new TextEncoder();
        const payload = textEncoder.encode(JSON.stringify(msgObj));
        await room.localParticipant.publishData(payload, { reliable: true });
      } catch (err) {
        console.error("[LiveKit] Error sending chat message:", err);
      }
    }
  }, [user.displayName]);

  return {
    localStream,
    remoteStreams,
    participants,
    chatMessages,
    isAudioMuted,
    isVideoOff,
    isScreenSharing,
    isRoomFull,
    roomFullMessage,
    connectionStatus,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    sendMessage,
  };
}
