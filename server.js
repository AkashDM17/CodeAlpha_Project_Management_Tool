const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
require('dotenv').config();

const socketHandler = require('./sockets/socketHandler');
const { errorHandler, notFound } = require('./middleware/errorMiddleware');

// Route imports
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const projectRoutes = require('./routes/projectRoutes');
const taskRoutes = require('./routes/taskRoutes');
const commentRoutes = require('./routes/commentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Attach io to express app so controllers can emit events
app.set('io', io);
socketHandler(io);

// Core Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Static Frontend Assets
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'TaskFlow API is operational',
    timestamp: new Date(),
    mongoStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/notifications', notificationRoutes);

// Client-side SPA routing fallback
app.get('*', (req, res, next) => {
  if (req.originalUrl.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middlewares
app.use(notFound);
app.use(errorHandler);

// Database Connection & Server Boot
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/taskflow';

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log(`[Database] MongoDB connected successfully to ${MONGODB_URI}`);
    server.listen(PORT, () => {
      console.log(`===============================================`);
      console.log(`🚀 TaskFlow Server running at http://localhost:${PORT}`);
      console.log(`📡 WebSocket ready for real-time collaboration`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`===============================================`);
    });
  })
  .catch((err) => {
    console.error(`[Database Error] Failed to connect to MongoDB: ${err.message}`);
    console.log(`[Info] Starting server in fallback mode so frontend can load...`);
    server.listen(PORT, () => {
      console.log(`⚠️ TaskFlow server started on http://localhost:${PORT} without active MongoDB connection.`);
      console.log(`Please ensure MongoDB is running: mongod or check MONGODB_URI in .env`);
    });
  });

module.exports = { app, server };
