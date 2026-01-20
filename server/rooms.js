/**
 * RoomManager handles user management across different rooms
 * Assigns unique colors to users and tracks active users per room
 */
class RoomManager {
  constructor() {
    // Store rooms with their users
    this.rooms = new Map();
    
    // Available colors for users
    this.availableColors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
      '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
      '#F8B739', '#52B788', '#E63946', '#A8DADC'
    ];
  }
  
  /**
   * Add a user to a room and assign them a color
   */
  addUser(roomId, userId, username) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Map());
    }
    
    const room = this.rooms.get(roomId);
    const colorIndex = room.size % this.availableColors.length;
    const userColor = this.availableColors[colorIndex];
    
    room.set(userId, {
      username: username,
      color: userColor,
      joinedAt: Date.now()
    });
    
    return userColor;
  }
  
  /**
   * Remove a user from a room
   */
  removeUser(roomId, userId) {
    if (!this.rooms.has(roomId)) {
      return null;
    }
    
    const room = this.rooms.get(roomId);
    const user = room.get(userId);
    room.delete(userId);
    
    // Clean up empty rooms
    if (room.size === 0) {
      this.rooms.delete(roomId);
    }
    
    return user;
  }
  
  /**
   * Get all users in a room
   */
  getUsers(roomId) {
    if (!this.rooms.has(roomId)) {
      return [];
    }
    
    const room = this.rooms.get(roomId);
    const users = [];
    
    room.forEach((userData, userId) => {
      users.push({
        userId: userId,
        username: userData.username,
        color: userData.color
      });
    });
    
    return users;
  }
  
  /**
   * Get a specific user's information
   */
  getUser(roomId, userId) {
    if (!this.rooms.has(roomId)) {
      return null;
    }
    
    return this.rooms.get(roomId).get(userId);
  }
  
  /**
   * Check if a user exists in a room
   */
  userExists(roomId, userId) {
    if (!this.rooms.has(roomId)) {
      return false;
    }
    
    return this.rooms.get(roomId).has(userId);
  }
}

module.exports = RoomManager;
