"use client";

import { useEffect, useRef, useState } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../lib/firebase";

import {
  saveSign as saveSignToFirestore,
  getSigns as getSignsFromFirestore,
  deleteSign as deleteSignFromFirestore,
} from "../../lib/signs";

import {
  recognizeSign,
  type RecognitionResult,
} from "../../lib/recognition";

type HandPoint = {
  x: number;
  y: number;
  z: number;
};

type SignFrame = {
  timestamp: number;
  hands: HandPoint[][];
};

type SavedSign = {
  id: number;
  name: string;
  frames: SignFrame[];
  frameCount: number;
  createdAt: string;
};

const CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

export default function RecordPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const playbackCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const animationRef = useRef<number | null>(null);
  const recordingRef = useRef(false);

const framesRef = useRef<SignFrame[]>([]);
const recognitionFramesRef = useRef<SignFrame[]>([]);
const savedSignsRef = useRef<SavedSign[]>([]);
const recognitionFrameCounterRef = useRef(0);
const lastVideoTimeRef = useRef(-1);

  // Cumulative recording statistics
  const oneHandFramesRef = useRef(0);
  const twoHandFramesRef = useRef(0);
  const maxHandsInRecordingRef = useRef(0);

  const [cameraOn, setCameraOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [handsDetected, setHandsDetected] = useState(0);
  const [error, setError] = useState("");

  const [isRecording, setIsRecording] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [signName, setSignName] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [savedSigns, setSavedSigns] = useState<SavedSign[]>([]);
  const [uid, setUid] = useState<string | null>(null);
const [authLoading, setAuthLoading] = useState(true);
const [isSaving, setIsSaving] = useState(false);
  const [captureCheck, setCaptureCheck] = useState(
    "Waiting for recording..."
  );

  // Library controls
  const [librarySearch, setLibrarySearch] = useState("");
  const [librarySort, setLibrarySort] = useState("newest");

  // Playback states
  const [selectedSign, setSelectedSign] = useState<SavedSign | null>(null);
  const [playbackFrameIndex, setPlaybackFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Live recognition states
  const [recognitionCount, setRecognitionCount] = useState(0);
  const [recognitionResult, setRecognitionResult] =
    useState<RecognitionResult | null>(null);
  const [recognitionMessage, setRecognitionMessage] = useState("");

// Load saved signs after Firebase login
useEffect(() => {
  let active = true;

  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (!active) return;

    setAuthLoading(true);

    if (!user) {
      setUid(null);
      setSavedSigns([]);
      savedSignsRef.current = [];
      setSelectedSign(null);
      setSaveMessage("Please log in to access your sign library.");
      setAuthLoading(false);
      return;
    }

    setUid(user.uid);

    try {
      const signs = await getSignsFromFirestore(user.uid);

      if (active && auth.currentUser?.uid === user.uid) {
        setSavedSigns(signs as SavedSign[]);
      }
    } catch (err) {
      console.error("Error loading signs:", err);

      if (active && auth.currentUser?.uid === user.uid) {
        setSaveMessage("Could not load your signs.");
      }
    } finally {
      if (active && auth.currentUser?.uid === user.uid) {
        setAuthLoading(false);
      }
    }
  });

  return () => {
    active = false;
    unsubscribe();
  };
}, []);

  // Keep the latest saved signs available to recognition
  useEffect(() => {
    savedSignsRef.current = savedSigns;
  }, [savedSigns]);

  
const finishRecognition = () => {
  const recentFrames = recognitionFramesRef.current.slice(-120);

  if (
    recentFrames.length >= 120 &&
    savedSignsRef.current.length > 0
  ) {
    const match = recognizeSign(
      recentFrames,
      savedSignsRef.current
    );

    setRecognitionResult(match);

    setRecognitionMessage(
      match
        ? `Closest matching sign: ${match.name}`
        : "No matching sign found."
    );
  }

 
  recognitionFramesRef.current = [];
  recognitionFrameCounterRef.current = 0;

  // Do not reset recognitionCount here.
  // Keep the final progress visible until the next recording starts.
};

  // Update the final recording summary
  const updateCaptureSummary = () => {
    setCaptureCheck(
      `Total frames: ${framesRef.current.length} | One-hand frames: ${oneHandFramesRef.current} | Two-hand frames: ${twoHandFramesRef.current} | Maximum hands detected: ${maxHandsInRecordingRef.current}`
    );
  };

  // Start camera and MediaPipe detection
  const startCamera = async () => {
    try {
      setError("");
      setLoading(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });

      streamRef.current = stream;

      const video = videoRef.current;

      if (!video) {
        throw new Error("Video element not found.");
      }

      video.srcObject = stream;
      await video.play();

      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm"
      );

      const landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
      });

      landmarkerRef.current = landmarker;
      lastVideoTimeRef.current = -1;
      setCameraOn(true);

      
const detect = () => {
  const currentVideo = videoRef.current;
  const canvas = canvasRef.current;
  const currentLandmarker = landmarkerRef.current;

  if (!currentVideo || !canvas || !currentLandmarker) {
    return;
  }

  const context = canvas.getContext("2d");

  if (
    !context ||
    currentVideo.readyState < 2 ||
    currentVideo.videoWidth === 0
  ) {
    animationRef.current = requestAnimationFrame(detect);
    return;
  }

  // Process each actual camera frame only once.
  if (currentVideo.currentTime === lastVideoTimeRef.current) {
    animationRef.current = requestAnimationFrame(detect);
    return;
  }

  lastVideoTimeRef.current = currentVideo.currentTime;

  if (
    canvas.width !== currentVideo.videoWidth ||
    canvas.height !== currentVideo.videoHeight
  ) {
    canvas.width = currentVideo.videoWidth;
    canvas.height = currentVideo.videoHeight;
  }

  const timestamp = performance.now();

  const results = currentLandmarker.detectForVideo(
    currentVideo,
    timestamp
  );

  const hasHands =
    results.landmarks.length >= 1 &&
    results.landmarks.length <= 2;

  if (hasHands) {
    const newFrame: SignFrame = {
      timestamp,
      hands: results.landmarks.map((hand) =>
        hand.map(({ x, y, z }) => ({ x, y, z }))
      ),
    };

    if (newFrame.hands.every((hand) => hand.length === 21)) {

      // RECORDING: collect every valid camera frame.
      if (
        recordingRef.current &&
        framesRef.current.length < 600
      ) {
        framesRef.current.push(newFrame);

        const detectedHands = newFrame.hands.length;

        if (detectedHands === 1) {
          oneHandFramesRef.current++;
        }

        if (detectedHands === 2) {
          twoHandFramesRef.current++;
        }

        maxHandsInRecordingRef.current = Math.max(
          maxHandsInRecordingRef.current,
          detectedHands
        );

        // Update the frame number instead of jumping by five.
        setFrameCount(framesRef.current.length);

        if (framesRef.current.length % 30 === 0) {
          setCaptureCheck(
            `Frames: ${framesRef.current.length} | One-hand frames: ${oneHandFramesRef.current} | Two-hand frames: ${twoHandFramesRef.current}`
          );
        }
      }

      // LIVE RECOGNITION.
      // Count every valid hand frame, whether or not signs are saved.
      recognitionFramesRef.current.push(newFrame);

      // Keep only the latest 120 valid hand frames.
      if (recognitionFramesRef.current.length > 120) {
        recognitionFramesRef.current.shift();
      }

      const currentCount = recognitionFramesRef.current.length;

      // Update progress for every valid frame.
      setRecognitionCount(currentCount);

      recognitionFrameCounterRef.current++;

      // Compare only when 120 frames are available and saved signs exist.
      if (
  currentCount === 120 &&
  savedSignsRef.current.length > 0 &&
  recognitionFrameCounterRef.current % 3 === 0
) {
        const recentFrames =
          recognitionFramesRef.current.slice(-120);

        const match = recognizeSign(
          recentFrames,
          savedSignsRef.current
        );

        setRecognitionResult(match);

        setRecognitionMessage(
          match
            ? `Closest matching sign: ${match.name}`
            : "No matching sign found in your library."
        );
      }

      }
  }

  // Stop automatically at 600 recorded frames.
  if (
    framesRef.current.length >= 600 &&
    recordingRef.current
  ) {
    recordingRef.current = false;
    setIsRecording(false);
    setFrameCount(600);
    updateCaptureSummary();
    finishRecognition();
  }

  // Draw hand connections and landmarks.
  context.clearRect(0, 0, canvas.width, canvas.height);

  results.landmarks.forEach((hand) => {
    context.strokeStyle = "#22d3ee";
    context.lineWidth = 3;

    CONNECTIONS.forEach(([start, end]) => {
      const startPoint = hand[start];
      const endPoint = hand[end];

      if (!startPoint || !endPoint) return;

      context.beginPath();
      context.moveTo(
        startPoint.x * canvas.width,
        startPoint.y * canvas.height
      );
      context.lineTo(
        endPoint.x * canvas.width,
        endPoint.y * canvas.height
      );
      context.stroke();
    });

    hand.forEach((point) => {
      context.beginPath();
      context.arc(
        point.x * canvas.width,
        point.y * canvas.height,
        5,
        0,
        2 * Math.PI
      );
      context.fillStyle = "#facc15";
      context.fill();
    });
  });

  setHandsDetected(results.landmarks.length);
  animationRef.current = requestAnimationFrame(detect);
};

      detect();
    } catch (err) {
      console.error("Camera error:", err);

      setError(
        "Could not start camera or hand detection. Please check camera permission and try again."
      );

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;

      landmarkerRef.current?.close();
      landmarkerRef.current = null;
      lastVideoTimeRef.current = -1;

      setCameraOn(false);
    } finally {
      setLoading(false);
    }
  };

  

// Start recording
const startRecording = () => {
  if (!cameraOn) {
    setError("Please start the camera first.");
    return;
  }

  // Clear previous recognition result
  setRecognitionResult(null);
  setRecognitionMessage("");

  framesRef.current = [];
  setFrameCount(0);
  setSaveMessage("");
  setError("");
  setCaptureCheck("Waiting for one or two hands...");

  oneHandFramesRef.current = 0;
  twoHandFramesRef.current = 0;
  maxHandsInRecordingRef.current = 0;

  recognitionFramesRef.current = [];
recognitionFrameCounterRef.current = 0;
setRecognitionCount(0);

  recordingRef.current = true;
  setIsRecording(true);
};


  // Stop recording
  const stopRecording = () => {
    recordingRef.current = false;
    setIsRecording(false);

    finishRecognition();

    setFrameCount(framesRef.current.length);
    updateCaptureSummary();
  };

  // Save sign to Firestore
  const saveSign = async () => {
    const currentUser = auth.currentUser;

if (!currentUser || !uid || currentUser.uid !== uid) {
  setSaveMessage("Please log in to save signs.");
  return;
}

    if (!signName.trim()) {
      setSaveMessage("Please enter a sign name.");
      return;
    }

    if (framesRef.current.length === 0) {
      setSaveMessage("Please record a sign first.");
      return;
    }

    try {
      setIsSaving(true);
      setSaveMessage("Saving sign...");

      const newSign: SavedSign = {
        id: Date.now(),
        name: signName.trim(),
        frames: framesRef.current,
        frameCount: framesRef.current.length,
        createdAt: new Date().toISOString(),
      };

      await saveSignToFirestore(currentUser.uid, newSign);

const updatedSigns = await getSignsFromFirestore(currentUser.uid);
      setSavedSigns(updatedSigns as SavedSign[]);

      setSaveMessage("Sign saved successfully!");
      setSignName("");
      framesRef.current = [];
      setFrameCount(0);
      setCaptureCheck("Sign saved to your library.");
    } catch (err) {
      console.error("Error saving sign:", err);
      setSaveMessage("Could not save sign. Please check the console.");
    } finally {
      setIsSaving(false);
    }
  };

  // Open sign playback popup
  const playSign = (sign: SavedSign) => {
    if (!sign.frames || sign.frames.length === 0) {
      setSaveMessage("This sign has no recorded frames.");
      return;
    }

    setSelectedSign(sign);
    setPlaybackFrameIndex(0);
    setIsPlaying(true);
  };

  // Close playback popup
  const closePlayback = () => {
    setIsPlaying(false);
    setSelectedSign(null);
    setPlaybackFrameIndex(0);
  };

  // Stop playback
  const stopPlayback = () => {
    setIsPlaying(false);
    setPlaybackFrameIndex(0);
  };

  // Close playback popup using Escape key
  useEffect(() => {
    if (!selectedSign) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePlayback();
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [selectedSign]);

  // Animate saved frames at approximately 10 FPS
  useEffect(() => {
    if (!isPlaying || !selectedSign) {
      return;
    }

    const interval = window.setInterval(() => {
      setPlaybackFrameIndex((currentIndex) => {
        if (currentIndex >= selectedSign.frames.length - 1) {
          setIsPlaying(false);
          return currentIndex;
        }

        return currentIndex + 1;
      });
    }, 100);

    return () => window.clearInterval(interval);
  }, [isPlaying, selectedSign]);

  // Draw selected saved frame
  useEffect(() => {
    const canvas = playbackCanvasRef.current;

    if (!canvas || !selectedSign) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    canvas.width = 640;
    canvas.height = 360;

    context.fillStyle = "#020617";
    context.fillRect(0, 0, canvas.width, canvas.height);

    const frame = selectedSign.frames[playbackFrameIndex];

    if (!frame) return;

    const handColors = ["#22d3ee", "#facc15"];

    frame.hands.forEach((hand, handIndex) => {
      const color = handColors[handIndex % handColors.length];

      context.strokeStyle = color;
      context.lineWidth = 4;
      context.lineCap = "round";

      CONNECTIONS.forEach(([start, end]) => {
        const startPoint = hand[start];
        const endPoint = hand[end];

        if (!startPoint || !endPoint) return;

        context.beginPath();
        context.moveTo(
          startPoint.x * canvas.width,
          startPoint.y * canvas.height
        );
        context.lineTo(
          endPoint.x * canvas.width,
          endPoint.y * canvas.height
        );
        context.stroke();
      });

      hand.forEach((point) => {
        context.beginPath();
        context.arc(
          point.x * canvas.width,
          point.y * canvas.height,
          5,
          0,
          Math.PI * 2
        );
        context.fillStyle = color;
        context.fill();
      });
    });
  }, [selectedSign, playbackFrameIndex]);

  // Delete a saved sign
  const deleteSign = async (id: number) => {
  const currentUser = auth.currentUser;

  if (!currentUser || !uid || currentUser.uid !== uid) {
    setSaveMessage("Please log in first.");
    return;
  }

    const confirmed = window.confirm(
      "Are you sure you want to delete this saved sign?"
    );

    if (!confirmed) return;

    try {
      await deleteSignFromFirestore(currentUser.uid, id);

const updatedSigns = await getSignsFromFirestore(currentUser.uid);
      setSavedSigns(updatedSigns as SavedSign[]);

      if (selectedSign?.id === id) {
        closePlayback();
      }

      setSaveMessage("Sign deleted successfully!");
    } catch (err) {
      console.error("Error deleting sign:", err);
      setSaveMessage("Could not delete sign. Please check the console.");
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (recordingRef.current) {
      recordingRef.current = false;
      setIsRecording(false);
      setFrameCount(framesRef.current.length);
      updateCaptureSummary();
    }

    finishRecognition();

    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    landmarkerRef.current?.close();
    landmarkerRef.current = null;

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (context && canvas) {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }

    setCameraOn(false);
    setHandsDetected(0);
  };

  // Clean up camera when leaving the page
  useEffect(() => {
    return () => {
      recordingRef.current = false;

      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }

      landmarkerRef.current?.close();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  // Filter and sort library items
  const filteredSigns = savedSigns
    .filter((sign) =>
      sign.name.toLowerCase().includes(librarySearch.toLowerCase())
    )
    .sort((a, b) => {
      if (librarySort === "oldest") {
        return (
          new Date(a.createdAt).getTime() -
          new Date(b.createdAt).getTime()
        );
      }

      if (librarySort === "name") {
        return a.name.localeCompare(b.name);
      }

      return (
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime()
      );
    });

  const playbackProgress = selectedSign
    ? ((playbackFrameIndex + 1) / selectedSign.frames.length) * 100
    : 0;

  return (
    

<main className="min-h-screen overflow-hidden bg-[#c4d7ed] px-4 py-8 text-[#173B57] sm:px-6 lg:px-8">

  {/* Background decoration */}
  <div className="pointer-events-none fixed inset-0 overflow-hidden">
    <div className="absolute -left-40 top-20 h-96 w-96 rounded-full bg-[#9bb8cf]/60 blur-[120px]" />
    <div className="absolute -right-40 top-[500px] h-96 w-96 rounded-full bg-[#433f82]/70 blur-[120px]" />
    <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-[#7ea5b3]/80 blur-[120px]" />
  </div>

  <div className="relative mx-auto max-w-7xl">

    {/* Page heading */}
    <header className="mb-9 flex flex-col gap-5 border-b border-[#031520] pb-7">
      <div>
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#000101] bg-[#b2ddec] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#0c5053]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#2A9D8F]" />
          Sanket AI · Open-Source Sign Library
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-[#173B57] sm:text-4xl lg:text-5xl">
          Sign Language{" "}
          <span className="text-[#1922db]">Collection</span>
        </h1>

        <p className="mt-3 max-w-xl text-sm leading-6 text-[#60798B] sm:text-base">
          Record, recognize and build your own collection of sign
          language gestures.
        </p>
      </div>
    </header>

    {/* Main camera and recognition layout */}
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.85fr)]">

      {/* Camera capture panel */}
      <section className="overflow-hidden rounded-3xl border border-[#5a7e98] bg-[#afc0cd]  shadow-lg shadow-[#173B57] /5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE7EF] bg-[#ffffff] px-5 py-5 sm:px-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#2A9D8F]" />
              <h2 className="text-lg font-bold text-[#173B57]">Record a Sign</h2>
            </div>
            <p className="mt-1 text-xs text-[#718797]">
              Camera preview and hand landmark detection
            </p>
          </div>

          <span
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
              isRecording
                ? "border-[#F2D6C9] bg-[#FFF3ED] text-[#B85D3D]"
                : cameraOn
                ? "border-[#BFE5DC] bg-[#E7F5F2] text-[#287C75]"
                : "border-[#DCE7EF] bg-white text-[#718797]"
            }`}
          >
            {isRecording
              ? "● RECORDING"
              : cameraOn
              ? "● CAMERA ON"
              : "● STANDBY"}
          </span>
        </div>

        <div className="p-4 sm:p-6">
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-[#DCE7EF] bg-gradient-to-br from-[#F5FAFD] via-[#EAF3F8] to-[#DDF3EF] shadow-inner">

            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 h-full w-full scale-x-[-1] object-cover"
            />

            <canvas
              ref={canvasRef}
              className="absolute inset-0 h-full w-full scale-x-[-1]"
            />

            {/* Camera information overlay */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-4 top-4 flex items-center gap-2 rounded-lg border border-[#DCE7EF] bg-white/90 px-3 py-2 text-[10px] font-semibold tracking-widest text-[#173B57] backdrop-blur-md">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    cameraOn ? "animate-pulse bg-[#1a7b70]" : "bg-[#25475e]"
                  }`}
                />
                {cameraOn ? "LIVE CAMERA" : "CAMERA PREVIEW"}
              </div>

              <div className="absolute right-4 top-4 rounded-lg border border-[#DCE7EF] bg-white/90 px-3 py-2 text-[10px] tracking-wider text-[#173B57] backdrop-blur-md">
                {handsDetected} HAND(S) DETECTED
              </div>

              <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                <div className="rounded-lg border border-[#DCE7EF] bg-white/90 px-3 py-2 text-xs text-[#36566D] backdrop-blur-md">
                  {isRecording
                    ? "Capturing hand movements..."
                    : "Hand tracking preview"}
                </div>
                <span className="text-[10px] font-semibold tracking-widest text-[#287C75]">
                  SANKET AI
                </span>
              </div>
            </div>

            {!cameraOn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-white via-[#F0F6FA] to-[#DDF3EF] px-5 text-center">
                <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border border-[#C8E7E2] bg-[#E7F5F2] shadow-lg shadow-[#2A9D8F]/10">
                  <svg
                    width="38"
                    height="38"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    className="text-[#287C75]"
                  >
                    <rect x="3" y="6" width="13" height="12" rx="2" />
                    <path d="m16 10 5-3v10l-5-3" />
                    <path d="M8 10h3M9.5 8.5v3" />
                  </svg>
                </div>

                <h3 className="text-lg font-semibold text-[#173B57]">
                  Camera is ready
                </h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-[#718797]">
                  Start your camera to see your hands, track landmarks
                  and record sign language gestures.
                </p>
              </div>
            )}
          </div>

          {/* Camera controls */}
          <div className="mt-5 flex flex-wrap gap-3">
            {!cameraOn ? (
              <button
                onClick={startCamera}
                disabled={loading}
                className="flex-1 rounded-xl bg-[#2A9D8F] px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#2A9D8F]/15 transition hover:bg-[#258B80] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Initializing camera..." : "Start Camera"}
              </button>
            ) : (
              <>
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    className="flex-1 rounded-xl bg-[#2A9D8F] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#258B80]"
                  >
                    <span className="mr-2">●</span>
                    Start Recording
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="flex-1 rounded-xl bg-[#D98262] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#C87355]"
                  >
                    <span className="mr-2">⨀</span>
                    Stop Recording
                  </button>
                )}

                <button
                  onClick={stopCamera}
                  className="rounded-xl border border-[#C8DCE8] bg-[#F0F6FA] px-5 py-3.5 text-sm font-semibold text-[#36566D] transition hover:bg-[#E3EEF5]"
                >
                  Stop Camera
                </button>
              </>
            )}
          </div>

          {/* Camera statistics */}
          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-[#DCE7EF] bg-[#F0F6FA] p-3">
              <p className="text-[10px] uppercase tracking-wider text-[#718797]">
                Hands
              </p>
              <p className="mt-1 text-xl font-bold text-[#287C75]">
                {handsDetected}
              </p>
            </div>

            <div className="rounded-xl border border-[#DCE7EF] bg-[#EAF3F8] p-3">
              <p className="text-[10px] uppercase tracking-wider text-[#718797]">
                Landmarks
              </p>
              <p className="mt-1 text-xl font-bold text-[#287C75]">
                {handsDetected > 0 ? "21" : "—"}
              </p>
            </div>

            <div className="rounded-xl border border-[#C8E7E2] bg-[#E7F5F2] p-3">
              <p className="text-[10px] uppercase tracking-wider text-[#718797]">
                Frames
              </p>
              <p className="mt-1 text-xl font-bold text-[#287C75]">
                {frameCount}
              </p>
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-xl border border-[#F2D6C9] bg-[#FFF3ED] px-4 py-3 text-sm text-[#B85D3D]">
              {error}
            </p>
          )}
        </div>
      </section>

      {/* Live recognition panel */}
      <aside className="flex flex-col overflow-hidden rounded-3xl border border-[#DCE7EF] bg-[#b0c2d0] shadow-lg shadow-[#173B57]/5">
        <div className="border-b border-[#DCE7EF] bg-[#F0F6FA] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <svg
                  width="23"
                  height="23"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-[#061312]"
                >
                  <path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11" />
                  <path d="M11 10V4.5a1.5 1.5 0 0 1 3 0V11" />
                  <path d="M14 10V6a1.5 1.5 0 0 1 3 0v7" />
                  <path d="M8 11 6.8 9.8a1.7 1.7 0 0 0-2.4 2.4l4.1 6.1A4 4 0 0 0 11.8 20h3.4a4 4 0 0 0 4-4v-3a1.5 1.5 0 0 0-3 0" />
                </svg>

                <h2 className="text-lg font-bold text-[#173B57]">
                  Live Sign Recognition
                </h2>
              </div>
              <p className="mt-2 text-xs leading-5 text-[#718797]">
                AI analysis of your hand movements
              </p>
            </div>

            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                cameraOn
                  ? "bg-[#E7F5F2] text-[#0b3632]"
                  : "bg-[#EAF3F8] text-[#000000]"
              }`}
            >
              {cameraOn ? "ACTIVE" : "PROCESSING"}
            </span>
          </div>
        </div>

        <div className="flex flex-1 flex-col p-5 sm:p-6">
          <div className="mt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#0e3048]">
                Recognition analysis
              </span>
              <span className="font-semibold text-[#42307b]">
                {recognitionCount}/120 frames
              </span>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#def4f2]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#9ADBD0] to-[#2A9D8F] transition-all duration-300"
                style={{
                  width: `${Math.min((recognitionCount / 120) * 100, 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Recognition result */}
          <div className="mt-6 flex-1 rounded-2xl border border-[#DCE7EF] bg-[#F7FAFC] p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#718797]">
              Recognition result
            </p>

            {recognitionResult ? (
              <>
                <div className="mt-4 flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#C8E7E2] bg-[#E7F5F2] text-xl text-[#287C75]">
                    ✓
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-[#718797]">
                      Closest matching sign
                    </p>
                    <h3 className="mt-1 break-words text-2xl font-bold text-[#173B57]">
                      {recognitionResult.name}
                    </h3>
                  </div>
                </div>

                <div className="mt-5 border-t border-[#DCE7EF] pt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#718797]">
                      Similarity estimate
                    </span>
                    <span className="font-bold text-[#287C75]">
                      {recognitionResult.confidence.toFixed(1)}%
                    </span>
                  </div>

                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#DDECEB]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#9ADBD0] to-[#2A9D8F]"
                      style={{
                        width: `${Math.min(
                          Math.max(recognitionResult.confidence, 0),
                          100
                        )}%`,
                      }}
                    />
                  </div>

                  <p className="mt-3 text-[10px] leading-5 text-[#718797]">
                    Similarity is an estimate from the current matching
                    method, not a calibrated accuracy score.
                  </p>
                </div>
              </>
            ) : recognitionMessage ? (
              <p className="mt-4 text-sm leading-6 text-[#60798B]">
                {recognitionMessage}
              </p>
            ) : (
              <div className="py-6 text-center">
                <p className="text-sm font-medium text-[#36566D]">
                  Waiting for a sign
                </p>
                <p className="mt-2 text-xs leading-5 text-[#718797]">
                  Recognition results will appear here after analyzing
                  your hand movements.
                </p>
              </div>
            )}
          </div>

          {savedSigns.length === 0 && (
            <p className="mt-4 rounded-xl border border-[#DCE7EF] bg-[#F0F6FA] p-3 text-xs leading-5 text-[#60798B]">
              Save your first sign to enable automatic library recognition.
            </p>
          )}

          <div className="mt-5 flex items-center justify-between border-t border-[#DCE7EF] pt-4 text-xs">
            <span className="text-[#06141d]">
              Available library signs
            </span>
            <span className="font-bold text-[#287C75]">
              {savedSigns.length}
            </span>
          </div>
        </div>
      </aside>
    </div>

    {/* Save sign section */}
    <section className="mt-6 overflow-hidden rounded-3xl border border-[#324c5c] bg-[#eaf2f7]">
      <div className="grid gap-6 p-6 md:grid-cols-[0.85fr_1.15fr]">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#2A9D8F]" />
            <h2 className="text-lg font-bold text-[#173B57]">
              Add Sign to Library
            </h2>
          </div>

          <p className="mt-2 text-sm leading-6 text-[#60798B]">
            Give your captured movement a name and add it to your personal
            sign collection.
          </p>

          <p className="mt-3 text-xs text-[#718797]">
            {frameCount} recorded frames ·{" "}
            {uid ? "Account connected" : "Login required"}
          </p>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#60798B]">
            Sign name
          </label>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={signName}
              onChange={(e) => setSignName(e.target.value)}
              placeholder="Example: Hello, Thank You..."
              className="min-w-0 flex-1 rounded-xl border border-[#C8DCE8] bg-white px-4 py-3.5 text-sm text-[#173B57] outline-none transition placeholder:text-[#91A5B3] focus:border-[#2A9D8F]"
            />

            <button
              onClick={saveSign}
              disabled={
                authLoading ||
                isRecording ||
                frameCount === 0 ||
                isSaving ||
                !uid ||
                !auth.currentUser ||
                auth.currentUser.uid !== uid
              }
              className="rounded-xl bg-[#2A9D8F] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#258B80] disabled:cursor-not-allowed disabled:opacity-35"
            >
              {authLoading
                ? "Checking login..."
                : isSaving
                ? "Saving..."
                : !uid || !auth.currentUser || auth.currentUser.uid !== uid
                ? "Login Required"
                : "Save to Library"}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-[#718797]">
              {captureCheck}
            </p>

            {saveMessage && (
              <p className="text-xs font-medium text-[#287C75]">
                {saveMessage}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>

    {/* My Sign Library */}
    <section className="mt-8">
      <div className="mb-7 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#4264bc]">
            <span className="h-px w-6 bg-[#2c2395]" />
            Your collection
          </div>

          <h2 className="text-3xl font-bold tracking-tight text-[#173B57] sm:text-4xl">
            My Sign{" "}
            <span className="text-[#3b47b4]">Library</span>
          </h2>

          <p className="mt-2 text-sm text-[#60798B]">
            Your recorded signs, organized in one collection.
          </p>
        </div>

        <div className="rounded-xl border border-[#DCE7EF] bg-white px-4 py-2.5 shadow-sm">
          <p className="text-[10px] uppercase tracking-wider text-[#718797]">
            Total signs
          </p>
          <p className="text-xl font-bold text-[#287C75]">
            {savedSigns.length.toString().padStart(2, "0")}
          </p>
        </div>
      </div>

      {/* Library search and sorting */}
      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-[#C8E7E2] bg-[#E7F5F2] p-3 sm:flex-row">
        <div className="relative flex-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#287C75]">
            ⌕
          </span>

          <input
            type="text"
            value={librarySearch}
            onChange={(e) => setLibrarySearch(e.target.value)}
            placeholder="Search your sign library..."
            className="w-full rounded-xl border border-[#DCE7EF] bg-white py-3 pl-11 pr-4 text-sm text-[#173B57] outline-none placeholder:text-[#91A5B3] focus:border-[#2A9D8F]"
          />
        </div>

        <select
          value={librarySort}
          onChange={(e) => setLibrarySort(e.target.value)}
          className="rounded-xl border border-[#DCE7EF] bg-white px-4 py-3 text-sm text-[#36566D] outline-none focus:border-[#2A9D8F]"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>

      {savedSigns.length === 0 ? (
        <div className="overflow-hidden rounded-3xl border border-dashed border-[#C8DCE8] bg-white px-5 py-16 text-center">
          <div className="mx-auto h-1 w-16 rounded-full bg-gradient-to-r from-[#9ADBD0] to-[#2A9D8F]" />

          <h3 className="mt-5 text-xl font-bold text-[#173B57]">
            Your library is waiting
          </h3>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#718797]">
            Record your first sign and save it. Your personal sign
            collection will appear here.
          </p>
        </div>
      ) : filteredSigns.length === 0 ? (
        <div className="rounded-2xl border border-[#DCE7EF] bg-white p-10 text-center">
          <p className="font-semibold text-[#173B57]">
            No matching signs found
          </p>
          <p className="mt-2 text-sm text-[#718797]">
            Try another search term.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {filteredSigns.map((sign, index) => (
            <article
              key={sign.id}
              className="group relative overflow-hidden rounded-3xl border border-[#DCE7EF] bg-white transition duration-300 hover:-translate-y-1 hover:border-[#0b342e] hover:shadow-xl hover:shadow-[#173B57]/8"
            >
              {/* Sign card header */}
              <div className="relative h-32 overflow-hidden border-b border-[#246559] bg-gradient-to-r from-[#03050e] via-[#4975b3] to-[#b9cff1] px-5">

                {/* Decorative circles */}
                <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full border border-[#064E4A]/40" />
                <div className="absolute -right-4 -top-10 h-36 w-36 rounded-full border border-[#064E4A]/40" />
                <div className="absolute -bottom-16 left-10 h-36 w-36 rounded-full bg-[#064E4A]/50 blur-3xl" />

                <div className="absolute left-5 top-5">
                  <span className="rounded-md border border-[#B8DED7] bg-white/75 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-[#287C75]">
                    SAVED SIGN
                  </span>
                </div>

                <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between">
                  <p className="text-xs font-medium text-[#e2e5e8]">
                    Collection entry
                  </p>
                </div>
              </div>

              {/* Sign details */}
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words text-xl font-bold text-[#173B57] transition group-hover:text-[#287C75]">
                      {sign.name}
                    </h3>

                    <p className="mt-1 text-xs text-[#718797]">
                      Personal sign recording
                    </p>
                  </div>

                  <span className="shrink-0 rounded-lg border border-[#DCE7EF] bg-[#F0F6FA] px-2.5 py-1.5 text-[10px] font-semibold text-[#60798B]">
                    {sign.frameCount} FRAMES
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[#DCE7EF] bg-[#F0F6FA] p-3">
                    <p className="text-[9px] uppercase tracking-wider text-[#718797]">
                      Duration
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#173B57]">
                      {sign.frameCount > 0
                        ? `${(sign.frameCount / 30).toFixed(1)} sec`
                        : "—"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#DCE7EF] bg-[#EAF3F8] p-3">
                    <p className="text-[9px] uppercase tracking-wider text-[#718797]">
                      Created
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#173B57]">
                      {new Date(sign.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex gap-3">
                  <button
                    onClick={() => playSign(sign)}
className="flex-1 rounded-xl bg-gradient-to-r from-[#bac3e5] via-[#4176a4] to-[#152253] px-4 py-3 text-sm font-bold text-[#eaf4f3] transition hover:from-[#8497D5] hover:to-[#55AFA2]"                  >
                    ▶ Play Sign
                  </button>

                  <button
                    onClick={() => deleteSign(sign.id)}
                    title="Delete sign"
                    className="rounded-xl border border-[#F0D5CA] bg-[#FFF5F0] px-4 py-3 text-sm font-semibold text-[#B85D3D] transition hover:border-[#E8BBAA] hover:bg-[#FCEBE3]"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>

    <footer className="mt-14 border-t border-[#D8E5ED] py-6 text-center text-xs text-[#718797]">
      SANKET AI · Open-Source Sign Library
    </footer>
  </div>

  {/* Sign playback popup */}
  {selectedSign && (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#173B57]/35 p-3 backdrop-blur-md sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closePlayback();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="playback-title"
        className="relative max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-[#DCE7EF] bg-white shadow-2xl shadow-[#173B57]/15"
      >
        {/* Popup header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[#DCE7EF] bg-[#F0F6FA]/95 px-5 py-4 backdrop-blur-xl sm:px-7">
          <div className="min-w-0">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#287C75]">
              Sign playback
            </p>

            <h2
              id="playback-title"
              className="break-words text-xl font-bold text-[#173B57] sm:text-2xl"
            >
              {selectedSign.name}
            </h2>
          </div>

          <button
            onClick={closePlayback}
            aria-label="Close playback"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#DCE7EF] bg-white text-xl text-[#60798B] transition hover:border-[#E8BBAA] hover:bg-[#FFF5F0] hover:text-[#B85D3D]"
          >
            ×
          </button>
        </div>

        <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(220px,0.65fr)]">

          {/* Playback display */}
          <div className="min-w-0">
            <div className="relative overflow-hidden rounded-2xl border border-[#DCE7EF] bg-[#EAF3F8]">
              <canvas
                ref={playbackCanvasRef}
                className="aspect-video w-full"
              />

              <div className="pointer-events-none absolute left-4 top-4 rounded-lg border border-[#DCE7EF] bg-white/90 px-3 py-2 text-[10px] tracking-widest text-[#173B57]">
                {isPlaying ? "PLAYING SIGN" : "PLAYBACK PAUSED"}
              </div>
            </div>

            {/* Playback progress */}
            <div className="mt-5">
              <div className="flex justify-between text-xs text-[#718797]">
                <span>Frame progress</span>
                <span>
                  {playbackFrameIndex + 1} / {selectedSign.frames.length}
                </span>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#DDECEB]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#9ADBD0] to-[#2A9D8F] transition-all"
                  style={{ width: `${playbackProgress}%` }}
                />
              </div>
            </div>

            {/* Playback controls */}
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={() => playSign(selectedSign)}
                className="rounded-xl bg-[#2A9D8F] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#258B80]"
              >
                ↻ Replay
              </button>

              <button
                onClick={stopPlayback}
                disabled={!isPlaying}
                className="rounded-xl border border-[#DCE7EF] bg-[#F0F6FA] px-6 py-3 text-sm font-semibold text-[#36566D] transition hover:bg-[#E3EEF5] disabled:cursor-not-allowed disabled:opacity-40"
              >
                ■ Stop
              </button>

              <button
                onClick={closePlayback}
                className="rounded-xl border border-[#DCE7EF] bg-white px-6 py-3 text-sm font-semibold text-[#36566D] transition hover:bg-[#F0F6FA]"
              >
                Close
              </button>
            </div>

            {!isPlaying &&
              playbackFrameIndex === selectedSign.frames.length - 1 && (
                <p className="mt-4 text-sm font-medium text-[#287C75]">
                  Playback completed
                </p>
              )}
          </div>

          {/* Playback information */}
          <aside className="rounded-2xl border border-[#DCE7EF] bg-[#F0F6FA] p-5">
            <h3 className="text-sm font-bold text-[#173B57]">
              Sign information
            </h3>

            <p className="mt-1 text-xs text-[#718797]">
              Details of this saved sign
            </p>

            <div className="mt-6 space-y-4">
              <div className="border-b border-[#DCE7EF] pb-4">
                <p className="text-[10px] uppercase tracking-wider text-[#718797]">
                  Sign name
                </p>
                <p className="mt-1 break-words font-semibold text-[#287C75]">
                  {selectedSign.name}
                </p>
              </div>

              <div className="border-b border-[#DCE7EF] pb-4">
                <p className="text-[10px] uppercase tracking-wider text-[#718797]">
                  Total frames
                </p>
                <p className="mt-1 font-semibold text-[#173B57]">
                  {selectedSign.frameCount}
                </p>
              </div>

              <div className="border-b border-[#DCE7EF] pb-4">
                <p className="text-[10px] uppercase tracking-wider text-[#718797]">
                  Estimated duration
                </p>
                <p className="mt-1 font-semibold text-[#173B57]">
                  {(selectedSign.frameCount / 10).toFixed(1)} seconds
                </p>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#718797]">
                  Recorded on
                </p>
                <p className="mt-1 font-semibold text-[#173B57]">
                  {new Date(selectedSign.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  )}
</main>
  )}
