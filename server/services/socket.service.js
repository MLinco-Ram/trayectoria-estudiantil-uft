import { Server } from 'socket.io';

let ioInstance = null;

export function initSocket(server) {
  ioInstance = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
    transports: ['websocket', 'polling'],
  });

  ioInstance.on('connection', (socket) => {
    // Escuchar si el cliente se une a una sala de su rol o email
    socket.on('join_room', (room) => {
      if (room) {
        socket.join(room);
      }
    });

    socket.on('disconnect', () => {
      // Desconectado
    });
  });

  return ioInstance;
}

export function getIO() {
  return ioInstance;
}

// Helper para emitir eventos a todos o a salas específicas
export function emitEvent(event, data, room = null) {
  if (!ioInstance) return;
  if (room) {
    ioInstance.to(room).emit(event, data);
  } else {
    ioInstance.emit(event, data);
  }
}
