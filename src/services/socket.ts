import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

function getSignalingUrl() {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_SIGNALING_SERVER_URL || 'http://localhost:3005';
  }

  const configuredUrl = process.env.NEXT_PUBLIC_SIGNALING_SERVER_URL;
  if (configuredUrl) {
    try {
      const parsed = new URL(configuredUrl);
      const currentIsLocal = LOCAL_HOSTS.has(window.location.hostname);
      const configuredIsLocal = LOCAL_HOSTS.has(parsed.hostname);

      if (!configuredIsLocal || currentIsLocal) {
        return configuredUrl;
      }
    } catch {
      return configuredUrl;
    }
  }

  return window.location.origin;
}

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(getSignalingUrl(), {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });
  }
  return socket;
};
