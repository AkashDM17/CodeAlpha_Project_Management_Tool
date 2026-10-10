const jwt = require('jsonwebtoken');

/**
 * Socket.IO Handler
 * Manages project rooms, user notification rooms, and connection life-cycle
 */
const socketHandler = (io) => {
  // Middleware for optional socket authentication
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.id;
      } catch (err) {
        // Allow unauthenticated connection or proceed without userId
      }
    }
    next();
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id} (User: ${socket.userId || 'anonymous'})`);

    // Automatically join user-specific notification room if authenticated
    if (socket.userId) {
      socket.join(`user_${socket.userId}`);
    }

    // Join user notification room explicitly
    socket.on('joinUser', (userId) => {
      if (userId) {
        socket.join(`user_${userId}`);
        console.log(`[Socket] ${socket.id} joined user_${userId}`);
      }
    });

    // Join project room for real-time board updates
    socket.on('joinProject', (projectId) => {
      if (projectId) {
        socket.join(`project_${projectId}`);
        console.log(`[Socket] ${socket.id} joined project_${projectId}`);
      }
    });

    // Leave project room
    socket.on('leaveProject', (projectId) => {
      if (projectId) {
        socket.leave(`project_${projectId}`);
        console.log(`[Socket] ${socket.id} left project_${projectId}`);
      }
    });

    // Real-time typing indicators in task comments
    socket.on('typing', ({ projectId, taskId, userName }) => {
      if (projectId) {
        socket.to(`project_${projectId}`).emit('userTyping', { taskId, userName });
      }
    });

    socket.on('stopTyping', ({ projectId, taskId }) => {
      if (projectId) {
        socket.to(`project_${projectId}`).emit('userStoppedTyping', { taskId });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);
    });
  });
};

module.exports = socketHandler;
