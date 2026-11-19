
import {
  collection,
  doc,
  getDocs,
  writeBatch,
  query,
  where,
} from "firebase/firestore";

import { db, auth } from "./firebase";

export interface SignPoint {
  x: number;
  y: number;
  z: number;
}

export interface SignFrame {
  timestamp: number;
  hands: SignPoint[][];
}

// Firestore storage format: hands are stored in an object,
// because Firestore does not support nested arrays.
interface StoredSignFrame {
  timestamp: number;
  hands: Record<string, SignPoint[]>;
}

const CHUNK_SIZE = 30;

// Check whether the current user is authenticated
function verifyUser(uid: string) {
  const currentUser = auth.currentUser;

  if (!currentUser || currentUser.uid !== uid) {
    throw new Error("Please log in to access your sign library.");
  }

  return currentUser;
}

// Convert recorded frames into Firestore-compatible data
function convertForFirestore(frames: SignFrame[]): StoredSignFrame[] {
  return frames.map((frame) => {
    const hands: Record<string, SignPoint[]> = {};

    frame.hands.forEach((hand, index) => {
      hands[`hand${index}`] = hand;
    });

    return {
      timestamp: frame.timestamp,
      hands,
    };
  });
}

// Convert Firestore data back into the recording format
function convertFromFirestore(
  frames: StoredSignFrame[]
): SignFrame[] {
  return frames.map((frame) => ({
    timestamp: frame.timestamp,
    hands: Object.keys(frame.hands || {})
      .sort()
      .map((key) => frame.hands[key]),
  }));
}

// Save a custom sign
export async function saveSign(
  uid: string,
  sign: {
    id: number;
    name: string;
    frames: SignFrame[];
    frameCount: number;
    createdAt: string;
  }
) {
  verifyUser(uid);

  const signRef = doc(
    db,
    "users",
    uid,
    "customSigns",
    String(sign.id)
  );

  const convertedFrames = convertForFirestore(sign.frames);
  const batch = writeBatch(db);

  const chunks: StoredSignFrame[][] = [];

  for (let i = 0; i < convertedFrames.length; i += CHUNK_SIZE) {
    chunks.push(convertedFrames.slice(i, i + CHUNK_SIZE));
  }

  batch.set(signRef, {
    name: sign.name,
    ownerUid: uid,
    frameCount: sign.frameCount,
    chunkCount: chunks.length,
    createdAt: sign.createdAt,
  });

  chunks.forEach((frames, index) => {
    const chunkRef = doc(
      collection(signRef, "frames"),
      String(index)
    );

    batch.set(chunkRef, {
      frames,
      index,
    });
  });

  await batch.commit();
}

// Get saved signs belonging to the logged-in user
export async function getSigns(uid: string) {
  verifyUser(uid);

  const signsRef = collection(db, "users", uid, "customSigns");

  // This filter allows Firestore rules to verify ownership.
  const signsQuery = query(
    signsRef,
    where("ownerUid", "==", uid)
  );

  const snapshot = await getDocs(signsQuery);

  const signs = await Promise.all(
    snapshot.docs.map(async (signDoc) => {
      const framesRef = collection(signDoc.ref, "frames");
      const framesSnapshot = await getDocs(framesRef);

      const sortedChunks = [...framesSnapshot.docs].sort(
        (a, b) =>
          Number(a.data().index) - Number(b.data().index)
      );

      const storedFrames: StoredSignFrame[] =
        sortedChunks.flatMap((chunk) => {
          return chunk.data().frames as StoredSignFrame[];
        });

      const frames = convertFromFirestore(storedFrames);
      const data = signDoc.data();

      return {
        id: Number(signDoc.id),
        name: String(data.name),
        ownerUid: uid,
        frames,
        frameCount: Number(data.frameCount),
        createdAt: String(data.createdAt),
      };
    })
  );

  // Newest signs first
  signs.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() -
      new Date(a.createdAt).getTime()
  );

  return signs;
}

// Delete a saved sign
export async function deleteSign(uid: string, signId: number) {
  verifyUser(uid);

  const signRef = doc(
    db,
    "users",
    uid,
    "customSigns",
    String(signId)
  );

  const framesSnapshot = await getDocs(
    collection(signRef, "frames")
  );

  const batch = writeBatch(db);

  framesSnapshot.docs.forEach((frameDoc) => {
    batch.delete(frameDoc.ref);
  });

  batch.delete(signRef);

  await batch.commit();
}
