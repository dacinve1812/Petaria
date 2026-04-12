import { io } from 'socket.io-client';

let socketInstance = null;
let activeToken = '';
let activeApiBase = '';

export function initializeRealtimeSocket(apiBaseUrl, token) {
  if (!token) return null;

  const normalizedBase = String(apiBaseUrl || '').replace(/\/+$/, '');
  if (
    socketInstance &&
    activeToken === token &&
    activeApiBase === normalizedBase
  ) {
    return socketInstance;
  }

  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }

  socketInstance = io(normalizedBase, {
    transports: ['websocket', 'polling'],
    autoConnect: true,
    auth: { token },
  });
  activeToken = token;
  activeApiBase = normalizedBase;
  return socketInstance;
}

export function getRealtimeSocket() {
  return socketInstance;
}

export function disconnectRealtimeSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
  activeToken = '';
  activeApiBase = '';
}
