const http = require('http');
const next = require('next');
const { parse } = require('url');
const { Server } = require('socket.io');

const dev = process.argv.includes('--dev');
const hostname = '0.0.0.0';
const port = Number(process.env.PORT || 3005);

const nextApp = next({ dev, hostname, port });
const handle = nextApp.getRequestHandler();

// Map of roomId -> Map(socketId => participantData)
const rooms = new Map();

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
  console.log(`[Socket.IO] User ${socket.id} left room ${roomId}. Remaining: ${roomParticipants.size}`);
}

nextApp.prepare().then(() => {
  const server = http.createServer(async (req, res) => {
    const parsedUrl = parse(req.url, true);

    if (parsedUrl.pathname === '/health') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'ok', activeRooms: rooms.size, mode: dev ? 'development' : 'production' }));
      return;
    }

    await handle(req, res, parsedUrl);
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
      const normalizedRoomId = String(roomId || '').trim().toUpperCase();
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
      const normalizedRoomId = String(roomId || '').trim().toUpperCase();
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
      const normalizedRoomId = String(roomId || '').trim().toUpperCase();
      if (normalizedRoomId === currentRoomId) {
        io.to(normalizedRoomId).emit('chat-message', message);
      }
    });

    socket.on('leave-room', ({ roomId }) => {
      handleUserDisconnect(io, socket, roomId || currentRoomId);
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
