# Architecture Documentation

## Overview

This document describes the technical architecture, design decisions, and implementation details of the Collaborative Drawing Canvas application.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Canvas.js   │  │ WebSocket.js │  │      Main.js         │  │
│  │  (Drawing)   │  │ (Real-time)  │  │  (Event Handling)    │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket (Socket.io)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Server Layer                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Server.js   │  │   Rooms.js   │  │  drawing-state.js    │  │
│  │  (Socket.io) │  │    (Users)   │  │   (Undo/Redo)        │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagram

### Drawing Event Flow

```
User Action (Mouse/Touch)
        │
        ▼
Canvas Manager (canvas.js)
  │ • Captures coordinates
  │ • Draws locally (immediate feedback)
  │ • Collects path points
        │
        ▼
WebSocket Manager (websocket.js)
  │ • Serializes path data
  │ • Sends to server via Socket.io
        │
        ▼
Server (server.js)
  │ • Receives drawing event
  │ • Adds to DrawingStateManager
  │ • Assigns unique ID and timestamp
        │
        ▼
Broadcast to Other Clients
  │ • Socket.io room broadcast
  │ • Excludes sender
        │
        ▼
Remote Clients
  │ • Receive drawing event
  │ • Draw on local canvas
  │ • Add to operation history
```

### Undo/Redo Flow

```
User Clicks Undo
        │
        ▼
WebSocket Manager
  │ • Sends 'undo' event
        │
        ▼
Server DrawingStateManager
  │ • Pops last operation
  │ • Moves to undo stack
  │ • Returns operation ID
        │
        ▼
Broadcast to ALL Clients (including sender)
  │ • Sends operation ID to remove
        │
        ▼
All Clients
  │ • Remove operation from history
  │ • Redraw entire canvas
  │ • Maintain consistency
```

## WebSocket Protocol

### Message Types

#### Client → Server

1. **join-room**
```javascript
{
  roomId: "default-room",
  username: "User-12345"
}
```

2. **draw**
```javascript
{
  points: [{x: 100, y: 150}, {x: 101, y: 151}, ...],
  tool: "brush" | "eraser",
  color: "#FF0000",
  strokeWidth: 5
}
```

3. **cursor-move**
```javascript
{
  x: 250,
  y: 300
}
```

4. **undo** (no payload)

5. **redo** (no payload)

6. **clear-canvas** (no payload)

#### Server → Client

1. **initial-state**
```javascript
{
  operations: [/* array of drawing operations */],
  users: [/* array of connected users */],
  userColor: "#FF6B6B"
}
```

2. **draw**
```javascript
{
  id: "socket-id-timestamp-random",
  userId: "socket-id",
  timestamp: 1234567890,
  points: [{x: 100, y: 150}, ...],
  tool: "brush",
  color: "#FF0000",
  strokeWidth: 5
}
```

3. **user-joined**
```javascript
{
  userId: "socket-id",
  username: "User-12345",
  color: "#4ECDC4"
}
```

4. **user-left**
```javascript
{
  userId: "socket-id",
  username: "User-12345"
}
```

5. **cursor-move**
```javascript
{
  userId: "socket-id",
  x: 250,
  y: 300
}
```

6. **undo**
```javascript
{
  operationId: "operation-id-to-remove"
}
```

7. **redo**
```javascript
{
  operation: {/* complete operation object */}
}
```

## Undo/Redo Strategy

### Global Undo/Redo Implementation

The implementation uses a **centralized operation history** managed on the server. This ensures all clients maintain consistent state.

#### Key Design Decisions

1. **Server as Source of Truth**
   - All operations are stored on the server
   - Server manages undo/redo stacks
   - Prevents client-side desynchronization

2. **Operation Structure**
```javascript
{
  id: "unique-operation-id",
  userId: "creator-socket-id",
  timestamp: 1234567890,
  points: [/* array of coordinates */],
  tool: "brush" | "eraser",
  color: "#hexcolor",
  strokeWidth: number
}
```

3. **Undo Process**
   - Server removes last operation from history
   - Moves operation to undo stack
   - Broadcasts operation ID to ALL clients
   - Clients remove operation and redraw canvas

4. **Redo Process**
   - Server pops from undo stack
   - Adds operation back to history
   - Broadcasts complete operation to ALL clients
   - Clients add operation and draw it

5. **Clear Undo Stack**
   - New drawing operations clear the undo stack
   - Standard behavior for undo/redo systems
   - Prevents redo after new content added

### Conflict Resolution

#### Simultaneous Drawing

**Problem**: Multiple users drawing in the same area at the same time.

**Solution**: 
- Each operation has a unique ID with timestamp
- Operations are applied in the order received by server
- Last operation "wins" in overlapping areas
- No complex conflict resolution needed due to canvas compositing

#### Simultaneous Undo

**Problem**: Multiple users clicking undo at the same time.

**Solution**:
- Server processes undo requests sequentially
- Each undo removes exactly one operation
- All clients receive the same undo broadcast
- Operations are idempotent (removing same ID multiple times is safe)

#### User Disconnection

**Problem**: User disconnects while drawing.

**Solution**:
- Incomplete paths are not sent to server
- Only complete paths (mouseup/touchend) are transmitted
- Disconnection triggers cleanup in RoomManager
- No orphaned operations left behind

## Canvas Operations Efficiency

### Path Optimization

1. **Incremental Drawing**
   - Draw line segments as user moves mouse
   - Immediate visual feedback
   - No need to redraw entire path each frame

2. **Canvas Context Settings**
```javascript
ctx.lineCap = 'round';      // Smooth line endings
ctx.lineJoin = 'round';     // Smooth corners
ctx.willReadFrequently = false;  // Optimize for writing
```

3. **Composite Operations**
   - Brush: `source-over` (normal drawing)
   - Eraser: `destination-out` (removes pixels)

### Redraw Strategy

**When to Redraw:**
- After undo operation
- After clear canvas
- Never during normal drawing (incremental only)

**How to Redraw:**
1. Clear entire canvas: `ctx.clearRect()`
2. Iterate through all operations in order
3. Draw each complete path
4. Apply correct tool settings for each operation

### Performance Optimizations

1. **Mouse Event Throttling**
   - Cursor position updates throttled to 50ms
   - Prevents flooding server with events
   - Reduces network bandwidth

2. **Complete Path Transmission**
   - Send entire path on mouseup, not individual points
   - Reduces number of WebSocket messages
   - Improves network efficiency

3. **Local Drawing First**
   - Draw locally immediately (no network delay)
   - Send to server asynchronously
   - Provides instant feedback

4. **Canvas Size Management**
   - Fixed aspect ratio (16:9)
   - Responsive to container size
   - Image data preserved on resize

## Performance Decisions

### Why Socket.io Over Native WebSockets?

**Chosen: Socket.io**

Advantages:
- Automatic reconnection handling
- Room management built-in
- Fallback to long-polling
- Simpler API for broadcasting
- Better browser compatibility

Trade-offs:
- Slightly larger bundle size
- Additional abstraction layer
- More opinionated

### Why Complete Paths Over Point Streaming?

**Chosen: Complete Paths**

Advantages:
- Fewer network messages (1 vs 100+)
- Reduced server load
- Easier to manage undo/redo
- Better for slow networks

Trade-offs:
- Very slight delay in remote rendering
- Cannot see partial strokes
- More data per message

### Why Server-Side Operation History?

**Chosen: Server-Side**

Advantages:
- Single source of truth
- Simplified client code
- Consistent undo/redo across users
- Easy to implement persistence later

Trade-offs:
- Server memory usage
- Cannot work offline
- Server becomes bottleneck

## State Synchronization

### Joining User Flow

```
New User Connects
       │
       ▼
Server Sends initial-state
  • All existing operations
  • All connected users
  • Assigned user color
       │
       ▼
Client Draws All Operations
  • Canvas starts in sync
  • User sees current state
       │
       ▼
User Can Start Drawing
```

### Maintaining Consistency

1. **Operation Order**
   - Server assigns timestamps
   - Operations stored in chronological order
   - All clients apply in same order

2. **Idempotent Operations**
   - Same operation applied multiple times = same result
   - Safe to handle duplicate messages
   - No need for deduplication

3. **Eventual Consistency**
   - Brief network delays acceptable
   - All clients converge to same state
   - No complex CRDTs needed for this use case

## Scaling Considerations

### Current Limitations

- In-memory storage (lost on server restart)
- Single server instance
- No database persistence
- Limited to ~50 concurrent users per room

### Scaling to 1000+ Users

**Recommended Architecture:**

1. **Horizontal Scaling**
   - Multiple server instances
   - Sticky sessions or shared state
   - Load balancer for WebSocket connections

2. **State Management**
   - Redis for shared state
   - Pub/sub for cross-server communication
   - Operation history in Redis lists

3. **Database Persistence**
   - PostgreSQL for operation history
   - S3 for canvas snapshots
   - Background job for cleanup

4. **Performance Optimizations**
   - Operation batching (aggregate multiple ops)
   - Canvas snapshots (reduce redraw operations)
   - Binary protocol instead of JSON
   - WebRTC for peer-to-peer in same room

5. **Room Sharding**
   - Distribute rooms across servers
   - Each room on one server instance
   - Cross-server communication via message queue

## Security Considerations

### Current Implementation

- No authentication (demo purposes)
- No input validation on drawing data
- No rate limiting
- Public rooms only

### Production Requirements

1. **Authentication**
   - User registration/login
   - JWT tokens for WebSocket auth
   - Session management

2. **Input Validation**
   - Validate coordinate ranges
   - Limit stroke width
   - Sanitize usernames
   - Rate limit drawing operations

3. **Access Control**
   - Private rooms
   - Permission system (read/write)
   - Room ownership

4. **Rate Limiting**
   - Limit operations per second
   - Prevent flooding
   - IP-based throttling

## Testing Strategy

### Manual Testing

1. **Single User**
   - All drawing tools work
   - Undo/redo functions correctly
   - UI updates properly

2. **Multiple Users**
   - Real-time synchronization
   - Cursor tracking
   - Global undo/redo
   - User join/leave events

3. **Edge Cases**
   - Network disconnection/reconnection
   - Rapid undo/redo clicking
   - Simultaneous drawing in same area
   - Very long drawing sessions

### Automated Testing (Future)

- Unit tests for state management
- Integration tests for WebSocket events
- End-to-end tests with multiple clients
- Performance/load testing

## Code Quality

### Separation of Concerns

- **canvas.js**: Pure canvas operations, no networking
- **websocket.js**: Pure networking, no canvas logic
- **main.js**: Event handling and glue code
- **server.js**: Request routing only
- **rooms.js**: User management only
- **drawing-state.js**: State management only

### Error Handling

- WebSocket connection errors
- Invalid operation data
- Network timeout handling
- Graceful degradation

### Documentation

- Inline comments for complex logic
- JSDoc comments for public methods
- README for users
- ARCHITECTURE for developers

## Conclusion

This architecture prioritizes:
1. **Simplicity**: Easy to understand and maintain
2. **Real-time**: Sub-100ms latency for drawing
3. **Consistency**: All users see the same canvas
4. **Scalability**: Clear path to production scale

The implementation successfully handles the core requirements while maintaining clean, readable code that can be extended with additional features.
