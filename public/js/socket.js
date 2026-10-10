/**
 * TaskFlow Socket.IO Client Manager
 * Manages WebSocket connection, project rooms, and event distribution
 */

const SocketManager = {
  socket: null,
  currentProjectId: null,
  isConnected: false,

  init() {
    const token = API.getToken();
    const user = API.getCurrentUser();

    if (this.socket) {
      this.socket.disconnect();
    }

    // Connect to Socket.IO backend
    if (typeof io !== 'undefined') {
      this.socket = io({
        auth: { token: token || '' },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 10
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        console.log('[Socket] Connected to server, ID:', this.socket.id);
        this.updateStatusBadge(true);

        if (user && user._id) {
          this.joinUser(user._id);
        }

        if (this.currentProjectId) {
          this.joinProject(this.currentProjectId);
        }
      });

      this.socket.on('disconnect', () => {
        this.isConnected = false;
        console.log('[Socket] Disconnected from server');
        this.updateStatusBadge(false);
      });

      this.socket.on('connect_error', (err) => {
        console.warn('[Socket] Connection warning:', err.message);
        this.updateStatusBadge(false);
      });

      // Forward server socket events to DOM CustomEvents
      const events = [
        'taskCreated',
        'taskUpdated',
        'taskDeleted',
        'taskMoved',
        'taskAssigned',
        'commentAdded',
        'commentDeleted',
        'memberAdded',
        'memberRemoved',
        'projectUpdated',
        'projectDeleted',
        'notificationCreated',
        'userTyping',
        'userStoppedTyping'
      ];

      events.forEach(eventName => {
        this.socket.on(eventName, (data) => {
          console.log(`[Socket Received: ${eventName}]`, data);
          window.dispatchEvent(new CustomEvent(`socket:${eventName}`, { detail: data }));
        });
      });
    } else {
      console.warn('[Socket] Socket.IO library not loaded yet.');
    }
  },

  joinProject(projectId) {
    if (!projectId) return;
    if (this.currentProjectId && this.currentProjectId !== projectId) {
      this.leaveProject(this.currentProjectId);
    }
    this.currentProjectId = projectId;
    if (this.socket && this.isConnected) {
      this.socket.emit('joinProject', projectId);
      console.log(`[Socket] Joined project room: project_${projectId}`);
    }
  },

  leaveProject(projectId) {
    const target = projectId || this.currentProjectId;
    if (target && this.socket && this.isConnected) {
      this.socket.emit('leaveProject', target);
      console.log(`[Socket] Left project room: project_${target}`);
    }
    if (this.currentProjectId === target) {
      this.currentProjectId = null;
    }
  },

  joinUser(userId) {
    if (userId && this.socket && this.isConnected) {
      this.socket.emit('joinUser', userId);
      console.log(`[Socket] Joined user room: user_${userId}`);
    }
  },

  emitTyping(projectId, taskId, userName) {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing', { projectId, taskId, userName });
    }
  },

  emitStopTyping(projectId, taskId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('stopTyping', { projectId, taskId });
    }
  },

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.isConnected = false;
      this.updateStatusBadge(false);
    }
  },

  updateStatusBadge(connected) {
    const badge = document.getElementById('socket-status-badge');
    if (badge) {
      if (connected) {
        badge.className = 'status-indicator live';
        badge.title = 'Real-time sync: Connected';
        badge.innerHTML = '<span class="status-dot"></span><span>Live Sync</span>';
      } else {
        badge.className = 'status-indicator offline';
        badge.title = 'Real-time sync: Reconnecting...';
        badge.innerHTML = '<span class="status-dot"></span><span>Connecting</span>';
      }
    }
  }
};
