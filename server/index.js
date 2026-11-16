const http = require('http');
const next = require('next');
const { parse } = require('url');
const { Server } = require('socket.io');

const fs = require('fs');
const path = require('path');

// Auto-detect production build: If .next/BUILD_ID does not exist, run in development mode!
const hasProductionBuild = fs.existsSync(path.join(__dirname, '..', '.next', 'BUILD_ID'));
const dev = process.argv.includes('--dev') || !hasProductionBuild;
const hostname = '0.0.0.0';
const port = Number(process.env.PORT || 3000);

// Auto-cleanup conflicting duplicate dynamic route slug ('roomCode' !== 'roomId')
function cleanDuplicateSlugs(dir) {
  if (!fs.existsSync(dir)) return;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '[roomCode]') {
          console.log('[Auto-Cleanup] Found and removing duplicate slug folder:', fullPath);
          fs.rmSync(fullPath, { recursive: true, force: true });
        } else {
          cleanDuplicateSlugs(fullPath);
        }
      }
    }
  } catch (err) {
    console.error('[Auto-Cleanup] Scan error:', err);
  }
}

// Auto-cleanup corrupt or empty (0-byte) JSON cache files in .next that cause "Unexpected end of JSON input"
function cleanCorruptCache(dir) {
  if (!fs.existsSync(dir)) return;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        cleanCorruptCache(fullPath);
      } else if (entry.name.endsWith('.json')) {
        try {
          const stats = fs.statSync(fullPath);
          if (stats.size === 0) {
            console.log('[Auto-Cleanup] Removing 0-byte corrupt JSON file:', fullPath);
            fs.unlinkSync(fullPath);
          } else {
            const raw = fs.readFileSync(fullPath, 'utf8').trim();
            if (!raw) {
              console.log('[Auto-Cleanup] Removing empty JSON file:', fullPath);
              fs.unlinkSync(fullPath);
            } else {
              JSON.parse(raw);
            }
          }
        } catch {
          console.warn('[Auto-Cleanup] Removing corrupt JSON file:', fullPath);
          try { fs.unlinkSync(fullPath); } catch {}
        }
      }
    }
  } catch (err) {
    // Ignore scan errors
  }
}

cleanDuplicateSlugs(path.join(__dirname, '..', 'src', 'app'));
cleanCorruptCache(path.join(__dirname, '..', '.next'));

// Next.js application setup
console.log(`[Next.js Server] Starting in ${dev ? 'DEVELOPMENT' : 'PRODUCTION'} mode...`);
const nextApp = next({ dev, hostname, port });
const handle = nextApp.getRequestHandler();

// Map of roomId -> Map(socketId => participantData)
const rooms = new Map();

function normalizeRoomCode(val) {
  return decodeURIComponent(String(val || ''))
    .trim()
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
}

function handleUserDisconnect(io, socket, roomId) {
  if (!roomId || !rooms.has(roomId)) {
    return;
  }

  const roomParticipants = rooms.get(roomId);
  if (!roomParticipants.has(socket.id)) {
    return;
  }

  roomParticipants.delete(socket.id);
  socket.leave(roomId);

  if (roomParticipants.size === 0) {
    rooms.delete(roomId);
    console.log(`[Socket.IO] Room ${roomId} cleaned up (0 active participants)`);
    return;
  }

  io.to(roomId).emit('user-disconnected', {
    socketId: socket.id,
  });
  io.to(roomId).emit('room-participants', {
    count: roomParticipants.size,
    participants: Array.from(roomParticipants.values()),
  });
  console.log(`[Socket.IO] User ${socket.id} left room ${roomId}. Remaining: ${roomParticipants.size}`);
}

nextApp.prepare().then(() => {
  // Synchronize D:/Matri/model/mans.fbx to public/model/mans.fbx on server boot
  try {
    const fs = require('fs');
    const path = require('path');
    const directModel = path.join(__dirname, '..', 'model', 'mans.fbx');
    const destDir = path.join(__dirname, '..', 'public', 'model');
    if (fs.existsSync(directModel)) {
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
      const dest = path.join(destDir, 'mans.fbx');
      if (!fs.existsSync(dest) || fs.statSync(dest).size !== fs.statSync(directModel).size) {
        fs.copyFileSync(directModel, dest);
        console.log(`[Startup-Sync] Synced D:/Matri/model/mans.fbx -> public/model/mans.fbx (${(fs.statSync(dest).size / 1024 / 1024).toFixed(2)} MB)`);
      }
    }
  } catch (err) {
    console.warn('[Startup-Sync Warning]', err);
  }

  const server = http.createServer(async (req, res) => {
    const parsedUrl = parse(req.url, true);

    if (parsedUrl.pathname === '/health') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'ok', activeRooms: rooms.size, mode: dev ? 'development' : 'production' }));
      return;
    }

    if (parsedUrl.pathname && parsedUrl.pathname.startsWith('/model/')) {
      const rel = parsedUrl.pathname.replace(/^\/model\//, '');
      const fs = require('fs');
      const path = require('path');
      const p1 = path.join(__dirname, '..', 'public', 'model', rel);
      const p2 = path.join(__dirname, '..', 'model', rel);
      const p3 = 'C:/Users/User/Downloads/passive_marker_man.fbx';
      const p4 = path.join('C:/Users/User/Downloads', rel);

      let target = null;
      // Prioritize D:/Matri/model/mans.fbx when requested
      if (rel === 'mans.fbx') {
        const directModel = path.join(__dirname, '..', 'model', 'mans.fbx');
        if (fs.existsSync(directModel)) {
          target = directModel;
          try {
            const destDir = path.join(__dirname, '..', 'public', 'model');
            if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
            const dest = path.join(destDir, 'mans.fbx');
            if (!fs.existsSync(dest) || fs.statSync(dest).size !== fs.statSync(directModel).size) {
              fs.copyFileSync(directModel, dest);
              console.log(`[Auto-Sync] Synced D:/Matri/model/mans.fbx -> public/model/mans.fbx (${(fs.statSync(dest).size / 1024 / 1024).toFixed(2)} MB)`);
            }
          } catch (e) {
            console.warn('[Sync Notice]', e);
          }
        }
      }
      if (!target && fs.existsSync(p2)) target = p2;
      else if (!target && fs.existsSync(p1)) target = p1;
      else if (!target && (rel === 'mans.fbx' || rel === 'passive_marker_man.fbx') && fs.existsSync(p3)) target = p3;
      else if (!target && fs.existsSync(p4)) target = p4;

      if (target) {
        const ext = path.extname(target).toLowerCase();
        const mime = ext === '.fbx' ? 'application/octet-stream' : (ext === '.glb' ? 'model/gltf-binary' : 'application/octet-stream');
        res.setHeader('Content-Type', mime);
        fs.createReadStream(target).pipe(res);
        return;
      }
    }

    try {
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('[Next.js Handle Error]', err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    }
  });

  const io = new Server(server, {
    cors: {
      origin: true,
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    let currentRoomId = null;

    socket.on('join-room', ({ roomId, user }) => {
      const normalizedRoomId = normalizeRoomCode(roomId);
      console.log(`[Socket.IO] ${user?.displayName || socket.id} attempting to join room: ${normalizedRoomId}`);

      if (!normalizedRoomId) {
        socket.emit('room-full', { message: 'Room code is missing.' });
        return;
      }

      if (currentRoomId && currentRoomId !== normalizedRoomId) {
        handleUserDisconnect(io, socket, currentRoomId);
      }

      if (!rooms.has(normalizedRoomId)) {
        rooms.set(normalizedRoomId, new Map());
      }

      const roomParticipants = rooms.get(normalizedRoomId);

      if (roomParticipants.size >= 4 && !roomParticipants.has(socket.id)) {
        console.warn(`[Socket.IO] Room ${normalizedRoomId} is full (max 4 participants). Denying ${socket.id}`);
        socket.emit('room-full', { message: 'Room has reached the maximum capacity of 4 participants.' });
        return;
      }

      currentRoomId = normalizedRoomId;
      socket.join(normalizedRoomId);

      const participantData = {
        uid: user?.uid || socket.id,
        socketId: socket.id,
        displayName: user?.displayName || 'Guest User',
        photoURL: user?.photoURL || null,
        role: user?.role || 'patient',
        isMuted: Boolean(user?.isMuted),
        isVideoOff: Boolean(user?.isVideoOff),
        isScreenSharing: Boolean(user?.isScreenSharing),
        joinedAt: Date.now(),
      };

      roomParticipants.set(socket.id, participantData);

      const existingParticipants = Array.from(roomParticipants.values()).filter(
        (participant) => participant.socketId !== socket.id
      );

      socket.emit('room-joined', {
        socketId: socket.id,
        existingParticipants,
        roomCode: normalizedRoomId,
      });

      socket.to(normalizedRoomId).emit('user-joined', {
        participant: participantData,
      });

      io.to(normalizedRoomId).emit('room-participants', {
        count: roomParticipants.size,
        participants: Array.from(roomParticipants.values()),
      });

      console.log(`[Socket.IO] Room ${normalizedRoomId} total members: ${roomParticipants.size}`);
    });

    socket.on('offer', ({ targetSocketId, offer, callerUser }) => {
      if (!currentRoomId || !rooms.get(currentRoomId)?.has(targetSocketId)) return;
      console.log(`[WebRTC] Offer from ${socket.id} to ${targetSocketId}`);
      io.to(targetSocketId).emit('offer', {
        callerSocketId: socket.id,
        offer,
        callerUser,
      });
    });

    socket.on('answer', ({ targetSocketId, answer }) => {
      if (!currentRoomId || !rooms.get(currentRoomId)?.has(targetSocketId)) return;
      console.log(`[WebRTC] Answer from ${socket.id} to ${targetSocketId}`);
      io.to(targetSocketId).emit('answer', {
        callerSocketId: socket.id,
        answer,
      });
    });

    socket.on('ice-candidate', ({ targetSocketId, candidate }) => {
      if (!currentRoomId || !rooms.get(currentRoomId)?.has(targetSocketId)) return;
      io.to(targetSocketId).emit('ice-candidate', {
        callerSocketId: socket.id,
        candidate,
      });
    });

    socket.on('toggle-media', ({ roomId, state }) => {
      const normalizedRoomId = normalizeRoomCode(roomId);
      if (normalizedRoomId !== currentRoomId) return;

      if (rooms.has(normalizedRoomId)) {
        const roomParticipants = rooms.get(normalizedRoomId);
        const participant = roomParticipants.get(socket.id);
        if (participant) {
          Object.assign(participant, state);
        }
      }

      socket.to(normalizedRoomId).emit('user-media-toggled', {
        socketId: socket.id,
        state,
      });
    });

    socket.on('chat-message', ({ roomId, message }) => {
      const targetRoom = normalizeRoomCode(roomId || currentRoomId);
      if (targetRoom) {
        io.to(targetRoom).emit('chat-message', message);
      }
    });

    socket.on('live-transcript', ({ roomId, transcript }) => {
      const targetRoom = normalizeRoomCode(roomId || currentRoomId);
      if (targetRoom) {
        socket.to(targetRoom).emit('live-transcript', { transcript });
      }
    });

    socket.on('sign-speech-event', ({ roomId, data }) => {
      const targetRoom = normalizeRoomCode(roomId || currentRoomId);
      if (targetRoom) {
        socket.to(targetRoom).emit('sign-speech-event', data);
      }
    });

    socket.on('signer-speech-event', ({ roomId, data }) => {
      const targetRoom = normalizeRoomCode(roomId || currentRoomId);
      if (targetRoom) {
        socket.to(targetRoom).emit('signer-speech-event', data);
      }
    });

    socket.on('leave-room', ({ roomId }) => {
      handleUserDisconnect(io, socket, normalizeRoomCode(roomId) || currentRoomId);
      currentRoomId = null;
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
      handleUserDisconnect(io, socket, currentRoomId);
      currentRoomId = null;
    });
  });

  server.listen(port, hostname, () => {
    console.log(`⚡ MATRI server running at http://${hostname}:${port} (${dev ? 'dev' : 'prod'})`);
  });
}).catch((error) => {
  console.error('Failed to start MATRI server:', error);
  process.exit(1);
});
