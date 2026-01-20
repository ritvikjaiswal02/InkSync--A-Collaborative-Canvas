const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const RoomManager = require('./rooms');
const DrawingStateManager = require('./drawing-state');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

/**
 * Validate incoming drawing data to prevent malformed operations
 */
function validateDrawingData(data) {
  // Check required fields exist
  if (!data || typeof data !== 'object') return false;
  if (!Array.isArray(data.points) || data.points.length === 0) return false;
  if (typeof data.tool !== 'string') return false;
  if (typeof data.strokeWidth !== 'number') return false;

  // Validate tool type
  const validTools = ['brush', 'eraser'];
  if (!validTools.includes(data.tool)) return false;

  // Validate stroke width (1-50)
  if (data.strokeWidth < 1 || data.strokeWidth > 50) return false;

  // Validate color format for non-eraser tools
  if (data.tool !== 'eraser') {
    if (typeof data.color !== 'string') return false;
    if (!/^#[0-9A-Fa-f]{6}$/.test(data.color)) return false;
  }

  // Validate points have valid coordinates
  for (const point of data.points) {
    if (typeof point.x !== 'number' || typeof point.y !== 'number') return false;
    if (!isFinite(point.x) || !isFinite(point.y)) return false;
  }

  return true;
}

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '../client')));

// Initialize managers
const roomManager = new RoomManager();
const stateManager = new DrawingStateManager();

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`New client connected: ${socket.id}`);
  
  // User joins a room (default room for this assignment)
  socket.on('join-room', (data) => {
    const roomId = data.roomId || 'default-room';
    const username = data.username || `User-${socket.id.substring(0, 5)}`;
    
    // Join the room
    socket.join(roomId);
    
    // Add user to room manager
    const userColor = roomManager.addUser(roomId, socket.id, username);
    
    // Send current drawing state to the new user
    const currentState = stateManager.getState(roomId);
    socket.emit('initial-state', {
      operations: currentState.operations,
      users: roomManager.getUsers(roomId),
      userColor: userColor
    });
    
    // Notify other users about new user
    socket.to(roomId).emit('user-joined', {
      userId: socket.id,
      username: username,
      color: userColor
    });
    
    console.log(`${username} joined room ${roomId}`);
  });
  
  // Handle drawing events
  socket.on('draw', (data) => {
    const rooms = Array.from(socket.rooms);
    const roomId = rooms.find(room => room !== socket.id) || 'default-room';

    // Validate incoming drawing data
    if (!validateDrawingData(data)) {
      console.warn(`Invalid drawing data from ${socket.id}`);
      return;
    }

    // Add operation to state
    const operation = {
      ...data,
      userId: socket.id,
      timestamp: Date.now(),
      id: `${socket.id}-${Date.now()}-${Math.random()}`
    };

    stateManager.addOperation(roomId, operation);

    // Broadcast to all other users in the room
    socket.to(roomId).emit('draw', operation);
  });
  
  // Handle cursor movement
  socket.on('cursor-move', (data) => {
    const rooms = Array.from(socket.rooms);
    const roomId = rooms.find(room => room !== socket.id) || 'default-room';
    
    // Broadcast cursor position to other users
    socket.to(roomId).emit('cursor-move', {
      userId: socket.id,
      x: data.x,
      y: data.y
    });
  });
  
  // Handle undo operation
  socket.on('undo', () => {
    const rooms = Array.from(socket.rooms);
    const roomId = rooms.find(room => room !== socket.id) || 'default-room';
    
    const undoneOperation = stateManager.undo(roomId);
    
    if (undoneOperation) {
      // Broadcast undo to all users including sender
      io.to(roomId).emit('undo', {
        operationId: undoneOperation.id
      });
    }
  });
  
  // Handle redo operation
  socket.on('redo', () => {
    const rooms = Array.from(socket.rooms);
    const roomId = rooms.find(room => room !== socket.id) || 'default-room';
    
    const redoneOperation = stateManager.redo(roomId);
    
    if (redoneOperation) {
      // Broadcast redo to all users including sender
      io.to(roomId).emit('redo', {
        operation: redoneOperation
      });
    }
  });
  
  // Handle clear canvas
  socket.on('clear-canvas', () => {
    const rooms = Array.from(socket.rooms);
    const roomId = rooms.find(room => room !== socket.id) || 'default-room';
    
    stateManager.clearState(roomId);
    
    // Broadcast clear to all users
    io.to(roomId).emit('clear-canvas');
  });
  
  // Handle ping for latency measurement
  socket.on('ping', (callback) => {
    if (typeof callback === 'function') {
      callback();
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const rooms = Array.from(socket.rooms);
    const roomId = rooms.find(room => room !== socket.id) || 'default-room';
    
    if (roomId) {
      const user = roomManager.removeUser(roomId, socket.id);
      
      // Notify other users
      socket.to(roomId).emit('user-left', {
        userId: socket.id,
        username: user?.username
      });
      
      console.log(`User ${socket.id} disconnected from ${roomId}`);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
