/**
 * DrawingStateManager manages the canvas state for each room
 * Handles operation history, undo/redo stacks, and state synchronization
 */
class DrawingStateManager {
  constructor() {
    // Store state for each room
    this.roomStates = new Map();
  }
  
  /**
   * Initialize or get room state
   */
  _getRoomState(roomId) {
    if (!this.roomStates.has(roomId)) {
      this.roomStates.set(roomId, {
        operations: [],      // All drawing operations
        undoStack: [],       // Operations that have been undone
        operationIndex: {}   // Quick lookup for operations by ID
      });
    }
    return this.roomStates.get(roomId);
  }
  
  /**
   * Add a drawing operation to the state
   */
  addOperation(roomId, operation) {
    const state = this._getRoomState(roomId);
    
    // When a new operation is added, clear the undo stack
    // This is standard undo/redo behavior
    state.undoStack = [];
    
    // Add operation to the list
    state.operations.push(operation);
    state.operationIndex[operation.id] = state.operations.length - 1;
    
    return operation;
  }
  
  /**
   * Undo the last operation
   * Returns the undone operation or null if nothing to undo
   */
  undo(roomId) {
    const state = this._getRoomState(roomId);
    
    if (state.operations.length === 0) {
      return null;
    }
    
    // Remove the last operation
    const operation = state.operations.pop();
    
    // Add to undo stack for potential redo
    state.undoStack.push(operation);
    
    // Update index
    delete state.operationIndex[operation.id];
    
    return operation;
  }
  
  /**
   * Redo the last undone operation
   * Returns the redone operation or null if nothing to redo
   */
  redo(roomId) {
    const state = this._getRoomState(roomId);
    
    if (state.undoStack.length === 0) {
      return null;
    }
    
    // Get operation from undo stack
    const operation = state.undoStack.pop();
    
    // Add back to operations
    state.operations.push(operation);
    state.operationIndex[operation.id] = state.operations.length - 1;
    
    return operation;
  }
  
  /**
   * Get current state for a room
   */
  getState(roomId) {
    return this._getRoomState(roomId);
  }
  
  /**
   * Clear all operations for a room
   */
  clearState(roomId) {
    const state = this._getRoomState(roomId);
    state.operations = [];
    state.undoStack = [];
    state.operationIndex = {};
  }
  
  /**
   * Get operation by ID
   */
  getOperation(roomId, operationId) {
    const state = this._getRoomState(roomId);
    const index = state.operationIndex[operationId];
    
    if (index !== undefined) {
      return state.operations[index];
    }
    
    return null;
  }
  
  /**
   * Remove a specific operation (used for conflict resolution)
   */
  removeOperation(roomId, operationId) {
    const state = this._getRoomState(roomId);
    const index = state.operationIndex[operationId];
    
    if (index !== undefined) {
      state.operations.splice(index, 1);
      delete state.operationIndex[operationId];
      
      // Rebuild index after removal
      this._rebuildIndex(state);
    }
  }
  
  /**
   * Rebuild operation index after modifications
   */
  _rebuildIndex(state) {
    state.operationIndex = {};
    state.operations.forEach((op, index) => {
      state.operationIndex[op.id] = index;
    });
  }
}

module.exports = DrawingStateManager;
