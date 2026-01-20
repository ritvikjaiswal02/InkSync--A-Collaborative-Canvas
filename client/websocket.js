/**
 * WebSocket Manager
 * Handles all real-time communication with the server
 */
class WebSocketManager {
  constructor(canvasManager) {
    this.canvasManager = canvasManager;
    this.socket = null;
    this.roomId = 'default-room';
    this.userId = null;
    this.username = null;
    this.userColor = null;
    
    // Store operations for undo/redo
    this.operations = [];
    this.operationIndex = {};
    
    // Remote cursors
    this.cursors = {};

    // Connection status
    this.connected = false;

    // Latency tracking
    this.latency = 0;
    this.latencyDisplay = document.getElementById('latency-value');

    // Cursor cleanup interval (remove stale cursors after 5 seconds)
    this.cursorTimeout = 5000;
    this.startCursorCleanup();

    this.connect();
  }

  /**
   * Start interval to clean up stale cursors
   */
  startCursorCleanup() {
    setInterval(() => {
      const now = Date.now();
      Object.keys(this.cursors).forEach(userId => {
        const cursor = this.cursors[userId];
        if (now - cursor.lastUpdate > this.cursorTimeout) {
          this.removeCursor(userId);
        }
      });
    }, 1000);
  }

  /**
   * Measure latency using ping/pong
   */
  startLatencyMeasurement() {
    // Measure latency every 2 seconds
    setInterval(() => {
      if (!this.connected) return;

      const start = performance.now();
      this.socket.emit('ping', () => {
        this.latency = Math.round(performance.now() - start);
        if (this.latencyDisplay) {
          this.latencyDisplay.textContent = this.latency;
        }
      });
    }, 2000);

    // Initial measurement
    const start = performance.now();
    this.socket.emit('ping', () => {
      this.latency = Math.round(performance.now() - start);
      if (this.latencyDisplay) {
        this.latencyDisplay.textContent = this.latency;
      }
    });
  }
  
  connect() {
    // Connect to Socket.io server
    this.socket = io();
    
    // Connection events
    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.connected = true;
      this.userId = this.socket.id;
      this.updateConnectionStatus('connected');

      // Start latency measurement
      this.startLatencyMeasurement();

      // Join room
      this.joinRoom();
    });
    
    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      this.connected = false;
      this.updateConnectionStatus('disconnected');
    });
    
    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      this.updateConnectionStatus('disconnected');
    });
    
    // Drawing events
    this.socket.on('draw', (data) => {
      this.handleRemoteDraw(data);
    });
    
    // Initial state when joining
    this.socket.on('initial-state', (data) => {
      this.handleInitialState(data);
    });
    
    // User events
    this.socket.on('user-joined', (data) => {
      this.handleUserJoined(data);
    });
    
    this.socket.on('user-left', (data) => {
      this.handleUserLeft(data);
    });
    
    // Cursor events
    this.socket.on('cursor-move', (data) => {
      this.handleCursorMove(data);
    });
    
    // Undo/Redo events
    this.socket.on('undo', (data) => {
      this.handleUndo(data);
    });
    
    this.socket.on('redo', (data) => {
      this.handleRedo(data);
    });
    
    // Clear canvas event
    this.socket.on('clear-canvas', () => {
      this.handleClearCanvas();
    });
  }
  
  joinRoom() {
    // Generate or get username
    this.username = this.getOrCreateUsername();
    
    // Join the room
    this.socket.emit('join-room', {
      roomId: this.roomId,
      username: this.username
    });
  }
  
  getOrCreateUsername() {
    let username = localStorage.getItem('canvas-username');
    if (!username) {
      username = `User-${Math.floor(Math.random() * 10000)}`;
      localStorage.setItem('canvas-username', username);
    }
    return username;
  }
  
  handleInitialState(data) {
    console.log('Received initial state:', data);
    
    // Set user color
    this.userColor = data.userColor;
    this.updateUserDisplay();
    
    // Draw all existing operations
    this.operations = data.operations || [];
    this.operations.forEach(op => {
      this.canvasManager.drawPath(op);
      this.operationIndex[op.id] = op;
    });
    
    // Update users list
    this.updateUsersList(data.users || []);
  }
  
  handleRemoteDraw(data) {
    // Add to operations list
    this.operations.push(data);
    this.operationIndex[data.id] = data;
    
    // Draw on canvas
    this.canvasManager.drawPath(data);
  }
  
  handleUserJoined(data) {
    console.log(`${data.username} joined`);
    this.addUserToList(data);
    this.showNotification(`${data.username} joined`, 'success');
  }
  
  handleUserLeft(data) {
    console.log(`${data.username} left`);
    this.removeUserFromList(data.userId);
    this.removeCursor(data.userId);
    this.showNotification(`${data.username} left`, 'info');
  }
  
  handleCursorMove(data) {
    this.updateCursor(data.userId, data.x, data.y);
  }
  
  handleUndo(data) {
    // Remove the operation from our list
    const index = this.operations.findIndex(op => op.id === data.operationId);
    if (index !== -1) {
      this.operations.splice(index, 1);
      delete this.operationIndex[data.operationId];
    }
    
    // Redraw canvas
    this.canvasManager.redrawAll(this.operations);
  }
  
  handleRedo(data) {
    // Add the operation back
    this.operations.push(data.operation);
    this.operationIndex[data.operation.id] = data.operation;
    
    // Draw the operation
    this.canvasManager.drawPath(data.operation);
  }
  
  handleClearCanvas() {
    this.operations = [];
    this.operationIndex = {};
    this.canvasManager.clear();
    this.showNotification('Canvas cleared', 'info');
  }
  
  // Send drawing data to server
  sendDraw(pathData) {
    if (!this.connected || !pathData) return;
    
    this.socket.emit('draw', pathData);
  }
  
  // Send cursor position
  sendCursorMove(x, y) {
    if (!this.connected) return;
    
    this.socket.emit('cursor-move', { x, y });
  }
  
  // Send undo request
  sendUndo() {
    if (!this.connected) return;
    
    this.socket.emit('undo');
  }
  
  // Send redo request
  sendRedo() {
    if (!this.connected) return;
    
    this.socket.emit('redo');
  }
  
  // Send clear canvas request
  sendClearCanvas() {
    if (!this.connected) return;
    
    this.socket.emit('clear-canvas');
  }
  
  // UI Updates
  updateConnectionStatus(status) {
    const statusEl = document.getElementById('connection-status');
    const statusText = statusEl.querySelector('.status-text');
    
    statusEl.className = `status-indicator ${status}`;
    
    if (status === 'connected') {
      statusText.textContent = 'Connected';
    } else if (status === 'disconnected') {
      statusText.textContent = 'Disconnected';
    } else {
      statusText.textContent = 'Connecting...';
    }
  }
  
  updateUserDisplay() {
    const usernameEl = document.getElementById('username-display');
    const colorEl = document.getElementById('user-color-indicator');
    
    usernameEl.textContent = this.username;
    colorEl.style.backgroundColor = this.userColor;
  }
  
  updateUsersList(users) {
    const usersList = document.getElementById('users-list');
    const userCount = document.getElementById('user-count');
    
    usersList.innerHTML = '';
    userCount.textContent = users.length;
    
    users.forEach(user => {
      this.addUserToList(user);
    });
  }
  
  addUserToList(user) {
    const usersList = document.getElementById('users-list');
    const userCount = document.getElementById('user-count');
    
    // Check if user already exists
    if (document.getElementById(`user-${user.userId}`)) {
      return;
    }
    
    const li = document.createElement('li');
    li.className = 'user-item';
    li.id = `user-${user.userId}`;
    li.innerHTML = `
      <div class="user-color-dot" style="background-color: ${user.color}"></div>
      <span>${user.username}</span>
    `;
    
    usersList.appendChild(li);
    userCount.textContent = parseInt(userCount.textContent) + 1;
  }
  
  removeUserFromList(userId) {
    const userEl = document.getElementById(`user-${userId}`);
    if (userEl) {
      userEl.remove();
      
      const userCount = document.getElementById('user-count');
      userCount.textContent = Math.max(0, parseInt(userCount.textContent) - 1);
    }
  }
  
  updateCursor(userId, x, y) {
    let cursor = this.cursors[userId];
    
    if (!cursor) {
      // Create new cursor
      cursor = this.createCursor(userId);
      this.cursors[userId] = cursor;
    }
    
    // Update position
    cursor.element.style.left = `${x}px`;
    cursor.element.style.top = `${y}px`;
    cursor.lastUpdate = Date.now();
  }
  
  createCursor(userId) {
    const container = document.getElementById('cursors-container');
    const userEl = document.getElementById(`user-${userId}`);
    
    // Get user info
    let username = 'Anonymous';
    let color = '#999';
    
    if (userEl) {
      username = userEl.querySelector('span').textContent;
      color = userEl.querySelector('.user-color-dot').style.backgroundColor;
    }
    
    const cursorEl = document.createElement('div');
    cursorEl.className = 'remote-cursor';
    cursorEl.style.backgroundColor = color;
    cursorEl.innerHTML = `<div class="cursor-label">${username}</div>`;
    
    container.appendChild(cursorEl);
    
    return {
      element: cursorEl,
      lastUpdate: Date.now()
    };
  }
  
  removeCursor(userId) {
    const cursor = this.cursors[userId];
    if (cursor) {
      cursor.element.remove();
      delete this.cursors[userId];
    }
  }
  
  showNotification(message, type = 'info') {
    // Simple console notification for now
    // You can implement a toast notification system here
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
}
