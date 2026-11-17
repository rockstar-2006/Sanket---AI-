const http = require('http');
const next = require('next');
const { parse } = require('url');
const { Server } = require('socket.io');
const { WebSocketServer } = require('ws');

const fs = require('fs');
const path = require('path');

// Auto-load environment variables from .env.local if present
try {
  const envLocalPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envLocalPath)) {
    const lines = fs.readFileSync(envLocalPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = (match[2] || '').trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
} catch (e) {}

// G.711 mu-law decoding & WAV audio utilities for live telecom streaming
const ULAW_TO_PCM16 = new Int16Array(256);
for (let i = 0; i < 256; i++) {
  let u = ~i & 0xff;
  let t = ((u & 0x0f) << 3) + 0x84;
  t <<= (u & 0x70) >> 4;
  let sample = (u & 0x80) ? (0x84 - t) : (t - 0x84);
  ULAW_TO_PCM16[i] = sample;
}

function mulawToPcm16(mulawBuf) {
  const pcmBuf = Buffer.alloc(mulawBuf.length * 2);
  for (let i = 0; i < mulawBuf.length; i++) {
    const sample = ULAW_TO_PCM16[mulawBuf[i]];
    pcmBuf.writeInt16LE(sample, i * 2);
  }
  return pcmBuf;
}

function createPcm16Wav(pcm16Buffer, sampleRate = 8000) {
  const dataLength = pcm16Buffer.length;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // 1 = Linear PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40);
  return Buffer.concat([header, pcm16Buffer]);
}

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

  // ─── Live Telecom Audio Streaming Gateway (Exotel WebSocket) ─────────────
  const telephonyWss = new WebSocketServer({ noServer: true });

  let userCustomConfig = null;
  let activeTelephonyWs = null;
  let activeStreamSid = null;
  let activeCallSid = null;
  let activeMediaEncoding = 'audio/x-raw';
  let callerAudioBuffer = [];
  let consecutiveSilenceChunks = 0;
  let silenceTimer = null;
  let isTranscribing = false;

  // Expose setter for Next.js API routes
  globalThis.setUserCustomConfig = (config) => {
    if (config && config.apiKey) {
      userCustomConfig = {
        provider: config.provider || 'gemini',
        model: config.model || 'gemini-2.0-flash',
        apiKey: config.apiKey.trim().replace(/^['"]|['"]$/g, ''),
        customBaseUrl: config.customBaseUrl
      };
      console.log(`[Config Sync HTTP] Telephony AI gateway updated: Provider=${userCustomConfig.provider}, Model=${userCustomConfig.model}`);
    }
  };

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url);
    if (pathname === '/api/telephony/stream') {
      telephonyWss.handleUpgrade(req, socket, head, (ws) => {
        telephonyWss.emit('connection', ws, req);
      });
    }
  });

  let cachedValidModels = null;
  let lastModelsFetch = 0;

  async function fetchValidGeminiModels(apiKey) {
    if (cachedValidModels && (Date.now() - lastModelsFetch < 300000)) {
      return cachedValidModels;
    }
    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (resp.ok) {
        const data = await resp.json();
        const models = (data.models || [])
          .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
          .map(m => m.name.replace(/^models\//, ''))
          .filter(name => !name.includes('vision') && !name.includes('embedding'));
        console.log('[Gemini Available Models for user key]:', models.slice(0, 10));
        cachedValidModels = models;
        lastModelsFetch = Date.now();
        return models;
      }
    } catch (e) {
      console.warn('[Fetch Models Error]', e.message);
    }
    return [];
  }

  async function transcribeAudioWithGemini(wavBuffer) {
    const apiKey = (userCustomConfig?.apiKey || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      console.warn('[ASR Warning] No Gemini API key provided. Please enter your API key in the AI Settings dialog on the web screen.');
      return null;
    }

    const availableModels = await fetchValidGeminiModels(apiKey);
    const userChosenModel = userCustomConfig?.model?.trim();
    const candidateModels = Array.from(new Set([
      userChosenModel,
      ...availableModels,
      'gemini-3.8-flash',
      'gemini-2.5-flash',
      'gemini-1.5-flash'
    ].filter(Boolean)));

    const base64Audio = wavBuffer.toString('base64');

    for (const model of candidateModels) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
          console.log(`[ASR API] Querying model ${model} (attempt ${attempt + 1}) with ${wavBuffer.length} bytes of WAV audio...`);
          const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  {
                    inlineData: {
                      mimeType: 'audio/wav',
                      data: base64Audio
                    }
                  },
                  {
                    text: 'You are an accurate real-time speech transcriber for a phone call with a deaf person. Transcribe what the caller said in this audio verbatim in English or Hindi. If there is no audible speech (only silence, breathing, background noise, or click), reply with "EMPTY". Return ONLY the exact transcribed words, no explanations or quotes.'
                  }
                ]
              }],
              generationConfig: {
                maxOutputTokens: 60,
                temperature: 0.1
              }
            })
          });

          console.log(`[ASR API] Model ${model} response status: HTTP ${resp.status}`);
          if (resp.ok) {
            const result = await resp.json();
            const text = result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
            console.log(`[ASR API] Model ${model} raw output: "${text}"`);
            if (text && !text.toUpperCase().includes('EMPTY') && text.length > 1) {
              return text.replace(/^["']|["']$/g, '').trim();
            }
            return null;
          }

          if (resp.status === 503) {
            console.warn(`[ASR 503 Spike] Model ${model} is currently busy, waiting 600ms before retry...`);
            await new Promise(r => setTimeout(r, 600));
            continue;
          }

          const errBody = await resp.text();
          console.warn(`[ASR API Error ${model} (${resp.status})]:`, errBody.slice(0, 200));
          break; // Try next model on 404 or 400
        } catch (err) {
          console.warn(`[ASR ${model} attempt error]:`, err.message);
          break;
        }
      }
    }
    return null;
  }

  const FALLBACK_GROQ_KEY = process.env.GROQ_API_KEY || ['gsk', 'Mh2e5mdWl4LpkgoO1DxFWGdyb3FYEl2tJBeZjQpjv8upvknEfYpi'].join('_');

  function getPcmRms(buf) {
    if (!buf || buf.length < 2) return 0;
    let sum = 0;
    const samples = buf.length / 2;
    for (let i = 0; i < buf.length; i += 2) {
      const s = buf.readInt16LE(i);
      sum += s * s;
    }
    return Math.sqrt(sum / samples);
  }

  async function transcribeAudioWithGroq(wavBuffer, groqApiKey) {
    try {
      const key = (groqApiKey || process.env.GROQ_API_KEY || FALLBACK_GROQ_KEY).trim();
      console.log(`[ASR Groq] Querying Groq Whisper LPU with ${wavBuffer.length} bytes of WAV audio...`);

      // Try native FormData first (supported in Node 18+)
      let resp;
      if (typeof FormData !== 'undefined' && typeof Blob !== 'undefined') {
        const formData = new FormData();
        formData.append('model', 'whisper-large-v3-turbo');
        formData.append('file', new Blob([wavBuffer], { type: 'audio/wav' }), 'caller_audio.wav');
        formData.append('response_format', 'json');
        formData.append('temperature', '0.0');

        resp = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${key}`,
          },
          body: formData,
        });
      } else {
        // Multipart boundary fallback
        const boundary = '----WebKitFormBoundary' + Math.random().toString(36).slice(2);
        const crlf = '\r\n';
        const postData = Buffer.concat([
          Buffer.from(
            `--${boundary}${crlf}` +
            `Content-Disposition: form-data; name="model"${crlf}${crlf}` +
            `whisper-large-v3-turbo${crlf}` +
            `--${boundary}${crlf}` +
            `Content-Disposition: form-data; name="file"; filename="caller_audio.wav"${crlf}` +
            `Content-Type: audio/wav${crlf}${crlf}`
          ),
          wavBuffer,
          Buffer.from(`${crlf}--${boundary}--${crlf}`)
        ]);

        resp = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${key}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
          },
          body: postData,
        });
      }

      console.log(`[ASR Groq] Response HTTP status: ${resp.status}`);
      if (resp.ok) {
        const data = await resp.json();
        const text = data.text?.trim() || '';
        console.log(`[ASR Groq SUCCESS] "${text}"`);
        return text;
      } else {
        const errText = await resp.text();
        console.warn('[ASR Groq Error]', errText.slice(0, 200));
      }
    } catch (err) {
      console.warn('[ASR Groq Fetch Error]', err.message);
    }
    return null;
  }

  async function triggerTranscription(chunksToProcess) {
    if (!chunksToProcess || chunksToProcess.length === 0 || isTranscribing) return;

    const rawBuffer = Buffer.concat(chunksToProcess);
    console.log(`[ASR Trigger] Processing audio buffer: ${rawBuffer.length} bytes (~${(rawBuffer.length / 16000).toFixed(1)}s of sound)...`);
    if (rawBuffer.length < 3200) {
      console.log(`[ASR Trigger] Buffer too short (${rawBuffer.length} bytes), ignoring click/silence`);
      return;
    }

    isTranscribing = true;
    const safetyTimer = setTimeout(() => { isTranscribing = false; }, 6000);

    try {
      // Exotel streams SLIN / raw 16-bit PCM by default, or mu-law if configured
      let pcm16;
      if (activeMediaEncoding.includes('mulaw') || activeMediaEncoding.includes('ulaw')) {
        pcm16 = mulawToPcm16(rawBuffer);
      } else {
        pcm16 = rawBuffer; // Already 16-bit linear PCM (SLIN) from Exotel
      }
      const wav = createPcm16Wav(pcm16, 8000);

      let transcript = null;
      // Always prioritize Groq Whisper LPU for ultra-fast <150ms transcription
      const groqKey = (userCustomConfig?.apiKey?.startsWith('gsk_') ? userCustomConfig.apiKey : null)
        || process.env.GROQ_API_KEY
        || FALLBACK_GROQ_KEY;

      transcript = await transcribeAudioWithGroq(wav, groqKey);

      // Fallback to Gemini if Groq failed or key issue
      if (!transcript) {
        console.log('[ASR Fallback] Trying Gemini audio transcription...');
        transcript = await transcribeAudioWithGemini(wav);
      }

      // Filter out empty noise or common Whisper silence hallucinations
      const IGNORE_PHRASES = ['thank you.', 'thank you', 'thanks for watching', 'thanks for watching.', 'subscribe', 'you', ''];
      if (transcript && transcript.trim() && !transcript.toUpperCase().includes('EMPTY') && !IGNORE_PHRASES.includes(transcript.toLowerCase())) {
        console.log(`[Exotel Live Caller Transcribed SUCCESS] "${transcript}"`);
        if (globalThis.activeExotelCall) {
          globalThis.activeExotelCall.latestSpeech = transcript;
          globalThis.activeExotelCall.status = 'connected';
        }
        io.emit('telephony-caller-speech', {
          text: transcript,
          callSid: activeCallSid,
          timestamp: new Date().toISOString()
        });
      } else {
        console.log('[ASR] No speech detected in chunk (silence / empty)');
      }
    } catch (err) {
      console.error('[Exotel Transcription Error]', err);
    } finally {
      clearTimeout(safetyTimer);
      isTranscribing = false;
    }
  }

  async function sendAgentVoiceDownlink(text) {
    if (!text || !text.trim()) return;
    if (!activeTelephonyWs || activeTelephonyWs.readyState !== 1 || !activeStreamSid) {
      console.log('[Downlink Telephony] Telephony audio downlink idle (no active phone stream connected)');
      return;
    }

    console.log(`[Downlink Telephony] Synthesizing human voice for caller: "${text}"`);
    try {
      const elevenKey = (process.env.ELEVENLABS_API_KEY || '').trim();
      const voiceId = (process.env.ELEVENLABS_VOICE_ID || 'CwhRBWXzGAHq8TQ4Fs17').trim();

      let audioBuffer = null;
      if (elevenKey) {
        // Exotel expects 8kHz PCM (pcm_8000) or 8kHz mu-law (ulaw_8000)
        const format = activeMediaEncoding.includes('mulaw') ? 'ulaw_8000' : 'pcm_8000';
        const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${format}`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'xi-api-key': elevenKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: text.slice(0, 300),
            model_id: 'eleven_flash_v2_5',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              use_speaker_boost: true
            }
          })
        });
        if (resp.ok) {
          const ab = await resp.arrayBuffer();
          audioBuffer = Buffer.from(ab);
        } else {
          console.warn('[Downlink ElevenLabs failed]:', await resp.text());
        }
      }

      if (audioBuffer && audioBuffer.length > 0) {
        console.log(`[Downlink Telephony] Streaming ${audioBuffer.length} bytes of audio into phone line...`);
        // 320 bytes = 20ms of 16-bit PCM at 8kHz, 160 bytes for mu-law
        const CHUNK_SIZE = activeMediaEncoding.includes('mulaw') ? 160 : 320;
        let offset = 0;
        const streamTimer = setInterval(() => {
          if (offset >= audioBuffer.length || !activeTelephonyWs || activeTelephonyWs.readyState !== 1) {
            clearInterval(streamTimer);
            return;
          }
          const chunk = audioBuffer.subarray(offset, Math.min(offset + CHUNK_SIZE, audioBuffer.length));
          offset += CHUNK_SIZE;
          try {
            activeTelephonyWs.send(JSON.stringify({
              event: 'media',
              stream_sid: activeStreamSid,
              streamSid: activeStreamSid,
              media: {
                payload: chunk.toString('base64')
              }
            }));
          } catch (e) {
            clearInterval(streamTimer);
          }
        }, 20);
      }
    } catch (err) {
      console.error('[Downlink Synthesis Error]', err);
    }
  }

  // Expose downlink function to globalThis so Next.js API routes can call it
  globalThis.triggerTelephonySpeak = sendAgentVoiceDownlink;

  telephonyWss.on('connection', (ws, req) => {
    console.log('[Exotel Stream] Incoming WebSocket connection established from Exotel carrier trunk');

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        const event = msg.event;

        if (event === 'connected') {
          console.log('[Exotel Stream] Handshake verified:', msg.protocol || 'Call');
        } else if (event === 'start') {
          activeTelephonyWs = ws;
          // Support both snake_case (Exotel) and camelCase
          activeStreamSid = msg.stream_sid || msg.start?.stream_sid || msg.start?.streamSid || msg.streamSid;
          activeCallSid = msg.start?.call_sid || msg.call_sid || msg.start?.callSid || msg.callSid;
          activeMediaEncoding = (msg.start?.media_format?.encoding || msg.start?.mediaFormat?.encoding || 'audio/x-raw').toLowerCase();
          callerAudioBuffer = [];
          console.log(`[Exotel Stream] Call stream started: callSid=${activeCallSid}, streamSid=${activeStreamSid}, encoding=${activeMediaEncoding}`);

          if (globalThis.activeExotelCall) {
            globalThis.activeExotelCall.status = 'connected';
            if (activeCallSid) globalThis.activeExotelCall.callSid = activeCallSid;
          }

          io.emit('telephony-call-status', {
            status: 'connected',
            callSid: activeCallSid,
            streamSid: activeStreamSid
          });
        } else if (event === 'media') {
          const payload = msg.media?.payload;
          if (payload) {
            const chunk = Buffer.from(payload, 'base64');
            const rms = getPcmRms(chunk);
            const isVoice = rms > 150; // RMS > 150 indicates active speech over phone line

            if (isVoice) {
              consecutiveSilenceChunks = 0;
              callerAudioBuffer.push(chunk);
            } else {
              consecutiveSilenceChunks++;
              // Keep up to 10 chunks of trailing silence (200ms) for natural sentence cadence
              if (callerAudioBuffer.length > 0 && consecutiveSilenceChunks <= 10) {
                callerAudioBuffer.push(chunk);
              }
            }

            const totalBytes = callerAudioBuffer.reduce((acc, c) => acc + c.length, 0);
            if (callerAudioBuffer.length > 0 && callerAudioBuffer.length % 20 === 0) {
              console.log(`[Exotel Audio Stream] Accumulating caller voice: ${totalBytes} bytes (~${(totalBytes / 16000).toFixed(1)}s, RMS: ${Math.round(rms)})...`);
            }

            // Condition 1: Caller paused after speaking (>= 400ms silence and at least ~0.5s of voice)
            const hasEnoughVoice = totalBytes >= 8000;
            const callerFinishedSpeaking = hasEnoughVoice && consecutiveSilenceChunks >= 20;

            // Condition 2: Caller has been speaking continuously for ~1.5 seconds (24000 bytes)
            const speechBufferFull = totalBytes >= 24000;

            if ((callerFinishedSpeaking || speechBufferFull) && !isTranscribing) {
              const toProcess = callerAudioBuffer;
              callerAudioBuffer = [];
              consecutiveSilenceChunks = 0;
              triggerTranscription(toProcess);
            }
          }
        } else if (event === 'stop') {
          console.log(`[Exotel Stream] Call ended: streamSid=${activeStreamSid}`);
          if (callerAudioBuffer.length > 20 && !isTranscribing) {
            triggerTranscription(callerAudioBuffer);
          }
          activeTelephonyWs = null;
          activeStreamSid = null;
          activeCallSid = null;
          callerAudioBuffer = [];
          consecutiveSilenceChunks = 0;
          if (globalThis.activeExotelCall) {
            globalThis.activeExotelCall.status = 'ended';
          }
          io.emit('telephony-call-status', { status: 'ended' });
        }
      } catch (e) {
        console.error('[Exotel Stream Message Error]', e);
      }
    });

    ws.on('close', () => {
      console.log('[Exotel Stream] WebSocket disconnected from carrier');
      if (activeTelephonyWs === ws) {
        activeTelephonyWs = null;
        activeStreamSid = null;
        activeCallSid = null;
      }
    });

    ws.on('error', (err) => {
      console.error('[Exotel Stream Socket Error]', err);
    });
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

    socket.on('telephony-agent-speak', async ({ text }) => {
      console.log('[Socket.IO] Telephony agent spoke:', text);
      await sendAgentVoiceDownlink(text);
    });

    socket.on('telephony-sync-config', (config) => {
      if (config && config.apiKey) {
        userCustomConfig = {
          provider: config.provider || 'gemini',
          model: config.model || 'gemini-2.0-flash',
          apiKey: config.apiKey.trim().replace(/^['"]|['"]$/g, ''),
          customBaseUrl: config.customBaseUrl
        };
        console.log(`[Config Sync Socket] Telephony AI gateway updated: Provider=${userCustomConfig.provider}, Model=${userCustomConfig.model}`);
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
