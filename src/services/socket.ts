import { io, Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;

export function getSocket(): Socket {
  if (!socketInstance) {
    // Conectar al mismo host donde corre la app (Vite proxy / o localhost:3001)
    socketInstance = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketInstance.on('connect', () => {
      // Conexión establecida con éxito
    });

    socketInstance.on('disconnect', () => {
      // Desconectado
    });
  }

  return socketInstance;
}
