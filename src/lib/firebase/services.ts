import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  getDocs,
  updateDoc
} from "firebase/firestore";
import { db } from "./config";
import { UserProfile, MeetingSession, ChatMessage, UserRole } from "@/types";

// Save or update user profile
export async function createOrUpdateUserProfile(user: {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role?: UserRole;
}): Promise<UserProfile> {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    const newProfile: UserProfile = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || user.email?.split('@')[0] || "Health User",
      photoURL: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
      role: user.role || 'patient',
      createdAt: new Date().toISOString(),
    };
    await setDoc(userRef, newProfile);
    return newProfile;
  }

  return snap.data() as UserProfile;
}

// Create new consultation meeting session
export async function createMeetingSession(data: {
  title: string;
  description?: string;
  hostUid: string;
  hostName: string;
  consultationType: 'urgent' | 'specialist' | 'general' | 'followup';
  maxParticipants?: number;
}): Promise<MeetingSession> {
  const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const meetingRef = doc(collection(db, "meetings"));
  
  const meeting: MeetingSession = {
    id: meetingRef.id,
    title: data.title,
    description: data.description || "Secure medical video consultation session",
    hostUid: data.hostUid,
    hostName: data.hostName,
    roomCode: roomCode,
    createdAt: serverTimestamp(),
    status: 'active',
    consultationType: data.consultationType,
    maxParticipants: data.maxParticipants || 4,
  };

  await setDoc(meetingRef, meeting);
  return { ...meeting, id: meetingRef.id };
}

// Get meeting session by ID or Room Code with fast direct lookup & timeout protection
export async function getMeetingSession(idOrCode: string): Promise<MeetingSession | null> {
  const clean = String(idOrCode || '').trim();
  if (!clean) return null;

  try {
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1800));

    const fetchPromise = (async (): Promise<MeetingSession | null> => {
      // 1. Direct query by roomCode (most common)
      const q = query(collection(db, "meetings"), where("roomCode", "==", clean.toUpperCase()));
      const querySnap = await getDocs(q);
      if (!querySnap.empty) {
        const firstDoc = querySnap.docs[0];
        return { id: firstDoc.id, ...firstDoc.data() } as MeetingSession;
      }

      // 2. Fallback query by document ID
      const docRef = doc(db, "meetings", clean);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as MeetingSession;
      }

      return null;
    })();

    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (err) {
    console.warn('Session query note:', err);
    return null;
  }
}

// Fetch meeting history for a user
export async function getUserMeetingHistory(hostUid: string): Promise<MeetingSession[]> {
  try {
    const q = query(
      collection(db, "meetings"), 
      where("hostUid", "==", hostUid)
    );
    const snap = await getDocs(q);
    const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MeetingSession));

    // Sort in-memory by createdAt desc to avoid composite index requirements & delays
    return docs.sort((a, b) => {
      const timeA = (a.createdAt as any)?.seconds || 0;
      const timeB = (b.createdAt as any)?.seconds || 0;
      return timeB - timeA;
    });
  } catch (err) {
    console.error("Error in getUserMeetingHistory:", err);
    return [];
  }
}

async function resolveMeetingId(idOrCode: string): Promise<string | null> {
  const meeting = await getMeetingSession(idOrCode);
  return meeting?.id || null;
}

// Send chat message in meeting
export async function sendChatMessage(roomId: string, message: ChatMessage) {
  const meetingId = await resolveMeetingId(roomId);
  if (!meetingId) {
    throw new Error(`Meeting not found for room "${roomId}"`);
  }

  const messageRef = doc(collection(db, "meetings", meetingId, "messages"), message.id);
  await setDoc(messageRef, {
    ...message,
    roomId,
    timestamp: message.timestamp || Date.now(),
  });
}

// Subscribe to real-time chat messages
export function subscribeToChatMessages(roomId: string, callback: (messages: ChatMessage[]) => void) {
  let unsubscribeSnapshot = () => {};
  let isActive = true;

  resolveMeetingId(roomId)
    .then((meetingId) => {
      if (!isActive || !meetingId) {
        callback([]);
        return;
      }

      const q = query(collection(db, "meetings", meetingId, "messages"), orderBy("timestamp", "asc"));
      unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        const messages: ChatMessage[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as ChatMessage));
        callback(messages);
      });
    })
    .catch((error) => {
      console.error("Failed to subscribe to chat messages:", error);
      callback([]);
    });

  return () => {
    isActive = false;
    unsubscribeSnapshot();
  };
}

// End meeting session
export async function endMeetingSession(roomId: string) {
  const docRef = doc(db, "meetings", roomId);
  await updateDoc(docRef, {
    status: 'ended',
    endedAt: serverTimestamp(),
  });
}
