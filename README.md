# InkSync- A Collaborative Drawing Canvas

A real-time multi-user drawing application where multiple people can draw simultaneously on the same canvas with instant synchronization.

## 🎯 Features

- **Real-time Drawing**: See other users' drawings as they draw, not after they finish
- **Multiple Tools**: Brush and eraser with adjustable stroke width
- **Color Selection**: Choose from any color for your drawings
- **User Presence**: See who's online with assigned colors and cursor positions
- **Global Undo/Redo**: Synchronized undo/redo operations across all users
- **Touch Support**: Works on mobile devices with touch drawing
- **Keyboard Shortcuts**: Quick access to common operations

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Installation

1. Clone or download this repository
2. Install dependencies:

```bash
npm install
```

3. Start the server:

```bash
npm start
```

4. Open your browser and navigate to:

```
http://localhost:3000
```

5. To test with multiple users, open the same URL in multiple browser tabs or different devices on the same network.

## 🧪 Testing with Multiple Users

### Local Testing

1. Open `http://localhost:3000` in multiple browser tabs
2. Each tab represents a different user
3. Draw in one tab and see it appear in real-time in other tabs

### Network Testing

1. Find your local IP address:
   - Windows: `ipconfig`
   - Mac/Linux: `ifconfig` or `ip addr`
2. Other devices on the same network can access: `http://YOUR_IP:3000`
3. Draw on different devices and see real-time synchronization

### Testing Scenarios

- **Simultaneous Drawing**: Have multiple users draw at the same time
- **Undo/Redo**: Test global undo/redo with multiple users
- **User Join/Leave**: Watch users join and leave the session
- **Cursor Tracking**: Move your cursor to see it appear on other users' screens
- **Conflict Resolution**: Draw in overlapping areas to test rendering

## ⌨️ Keyboard Shortcuts

- `Ctrl+Z` / `Cmd+Z` - Undo
- `Ctrl+Y` / `Cmd+Y` / `Cmd+Shift+Z` - Redo
- `B` - Switch to Brush tool
- `E` - Switch to Eraser tool

## 📁 Project Structure

```
collaborative-canvas/
├── client/                 # Frontend files
│   ├── index.html         # Main HTML structure
│   ├── style.css          # Styling and layout
│   ├── canvas.js          # Canvas drawing logic
│   ├── websocket.js       # WebSocket client communication
│   └── main.js            # Application initialization
├── server/                # Backend files
│   ├── server.js          # Express + Socket.io server
│   ├── rooms.js           # Room and user management
│   └── drawing-state.js   # Canvas state and undo/redo logic
├── package.json           # Project dependencies
├── README.md              # This file
└── ARCHITECTURE.md        # Technical architecture documentation
```

## 🔧 Technologies Used

- **Frontend**: Vanilla JavaScript, HTML5 Canvas API, CSS3
- **Backend**: Node.js, Express.js
- **Real-time**: Socket.io for WebSocket communication
- **No External Drawing Libraries**: All canvas operations implemented from scratch

## 🐛 Known Limitations

1. **Canvas Persistence**: Drawings are not persisted to a database. Refreshing the page will lose your drawing history (but other connected users maintain the state).

2. **Scalability**: Current implementation uses in-memory storage. For production use with many concurrent users, consider adding Redis for state management.

3. **Drawing Performance**: With very complex drawings (1000+ operations), redraw performance may slow down. Consider implementing operation batching or canvas snapshots.

4. **Network Latency**: On slow connections, there may be a slight delay in seeing other users' drawings. Client-side prediction could improve perceived performance.

5. **Browser Compatibility**: Tested primarily on Chrome, Firefox, and Safari. Some older browsers may not support all features.

## ⏱️ Time Spent

Total development time:  11 hours

- Planning and architecture: 1 hour
- Server implementation: 2 hours
- Canvas rendering and optimization: 3 hours
- WebSocket communication: 2 hours
- UI/UX and styling: 1.5 hours
- Testing and debugging: 1.5 hours

## 🎯 Future Improvements

- [ ] Add more drawing tools (rectangle, circle, line, text)
- [ ] Add user authentication

## 📝 License

MIT License - feel free to use this project for learning and experimentation.

## 🤝 Contributing

This is an assignment submission, but feedback and suggestions are welcome!

## 📧 Contact
Ritvik Jaiswal- ritvikjaiswal020203@gmail.com

For questions or issues, please open an issue in the repository.
