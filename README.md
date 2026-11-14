# 🇮🇳 Sanket AI (संकेत AI) — Accessible Video Meeting Platform

> **Real-Time Indian Sign Language (ISL) Translation, 3D Realistic Signing Avatar, and Accessible Multi-User Telehealth Video Conferencing.**

---

## 🌟 Highlights & Capabilities

- **Zero-Latency In-Browser AI Recognition**: Runs a 262-vocabulary ISL temporal sequence model locally in WebGL/WebAssembly via ONNX Runtime Web. No raw video is sent to any server.
- **3D Interactive Signing Avatar**: Realistic 3D character powered by Three.js, React Three Fiber, and FBX skeletal animation for speech-to-sign rendering.
- **WebRTC Peer-to-Peer Calling & Signaling**: Low-latency multi-participant video and audio conferencing powered by an integrated Node.js Express & Socket.IO server.
- **Camera Signing Zone Framing HUD**: Real-time bounding perimeter and reticles that guide users to position their hands, wrists, and upper torso optimally for sign recognition.
- **Hands-Free Gesture Mode Switching**: Kinematic gestures (e.g. Index Finger Touch, Double Thumbs Up, Open Palm Hold, Namaste) allowing users to switch communication modes without touching mouse or keyboard.
- **Bilingual Clinical & Meeting Minutes Generator**: Automatic transcript categorization (Prescriptions, Medical Observations, Action Items, General Discussion) with 1-click A4 PDF Print/Export and Markdown copy.
- **Token & Word Anti-Repetition Deduplication**: Real-time filtering against jitter, webcam frame drops, and duplicate tokens.

---

## 🚀 Quick Start (For Developers & Collaborators)

### 1. Prerequisites
- **Node.js**: v18.18+ or v20+ recommended
- **npm** or **pnpm**
- **Git** with [Git LFS](https://git-lfs.com/) (recommended for 3D model assets):
  ```bash
  git lfs install
  ```

### 2. Clone & Install
```bash
# Clone the repository
git clone https://github.com/rockstar-2006/Sanket---AI-.git
cd Sanket---AI-

# Install dependencies
npm install
```

### 3. Run Locally (Development)
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser. Both the Next.js frontend and the Socket.IO signaling server start automatically on port 3000!

---

## 🌐 Production Deployment Guide

The application combines Next.js 15 with an integrated Socket.IO server in `server/index.js`. 

### Option A: Railway / Render / DigitalOcean / VPS (Recommended)
These platforms support persistent WebSocket connections required by Socket.IO:

1. **Build Command**:
   ```bash
   npm run build
   ```
2. **Start Command**:
   ```bash
   npm start
   ```
   *(This launches `node server/index.js` in production mode, serving Next.js pages and Socket.IO real-time signaling on `process.env.PORT || 3000`).*

### Option B: Docker
```dockerfile
FROM node:20-alpine AS runner
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

---

## 📁 Repository Structure

```
├── public/
│   ├── model/
│   │   └── mans.fbx              # 3D Skeletal Avatar model
│   └── models/
│       ├── isl_model.onnx        # 262-class trained ONNX neural network
│       └── isl_labels.json       # Vocabulary token mapping dictionary
├── server/
│   └── index.js                  # Custom HTTP server running Next.js + Socket.IO signaling
├── src/
│   ├── app/                      # Next.js App Router pages & API routes
│   │   ├── room/[roomId]/        # Live consultation video call room
│   │   ├── consultation/create/  # Room creation wizard & lobby
│   │   └── layout.tsx            # Global app layout & font configurations
│   ├── components/
│   │   └── meeting/              # AvatarModel, video tiles, chat, controls
│   └── lib/
│       ├── islCameraRecognizer.ts# MediaPipe landmark extractor & framing HUD
│       ├── islOnnxRecognizer.ts  # In-browser ONNX WebAssembly inference
│       └── agents/               # Sign-to-Speech and Speech-to-Sign translation logic
├── model_training/               # PyTorch training & ONNX export pipeline
├── package.json
└── README.md
```

---

## 🔒 Privacy & Safety
All camera sign recognition operates **100% on the client's device** using MediaPipe and WebAssembly. No video frames, camera feeds, or raw facial landmarks are ever transmitted or stored on external servers.

---

## 📄 License
Private & Proprietary. All rights reserved.
