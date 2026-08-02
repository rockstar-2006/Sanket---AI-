'use client';

import React, { useState } from 'react';
import { VideoTile } from './VideoTile';
import { ParticipantState } from '@/types';

interface VideoGridProps {
  localStream: MediaStream | null;
  localUser: ParticipantState;
  remoteStreams: Map<string, MediaStream>;
  participants: Map<string, ParticipantState>;
}

export const VideoGrid: React.FC<VideoGridProps> = ({
  localStream,
  localUser,
  remoteStreams,
  participants,
}) => {
  const [pinnedId, setPinnedId] = useState<string | null>(null);

  // Compile list of all participants (Local + Remote)
  const allParticipantsList = [
    { id: 'local', user: localUser, stream: localStream, isLocal: true },
    ...Array.from(participants.entries()).map(([sid, user]) => ({
      id: sid,
      user,
      stream: remoteStreams.get(sid) || null,
      isLocal: false,
    })),
  ];

  // Auto-spotlight screen share or pinned user
  const screenSharingParticipant = allParticipantsList.find(p => p.user.isScreenSharing);
  const spotlightItem = pinnedId 
    ? allParticipantsList.find(p => p.id === pinnedId) || allParticipantsList[0]
    : screenSharingParticipant || allParticipantsList[0];

  const thumbnailItems = allParticipantsList.filter(p => p.id !== spotlightItem?.id);

  return (
    <div className="w-full h-full flex flex-col gap-3 overflow-hidden p-1 sm:p-2">
      
      {/* Primary Spotlight View (Top) - Image 2 Style */}
      <div className="flex-1 w-full min-h-[320px] relative overflow-hidden">
        {spotlightItem && (
          <VideoTile
            stream={spotlightItem.stream}
            participant={spotlightItem.user}
            isLocal={spotlightItem.isLocal}
            isPinned={spotlightItem.id === pinnedId}
            isSpotlight={true}
            onPinToggle={() => setPinnedId(pinnedId === spotlightItem.id ? null : spotlightItem.id)}
          />
        )}
      </div>

      {/* Horizontal Participant Tiles Row (Bottom) - Image 2 Style */}
      {thumbnailItems.length > 0 && (
        <div className="h-32 sm:h-36 w-full flex items-center gap-3 overflow-x-auto pb-1 shrink-0 scrollbar-none">
          {thumbnailItems.map((item) => (
            <div key={item.id} className="h-full aspect-video shrink-0 min-w-[180px] sm:min-w-[220px]">
              <VideoTile
                stream={item.stream}
                participant={item.user}
                isLocal={item.isLocal}
                isPinned={item.id === pinnedId}
                isSpotlight={false}
                onPinToggle={() => setPinnedId(pinnedId === item.id ? null : item.id)}
              />
            </div>
          ))}
        </div>
      )}

    </div>
  );
};
