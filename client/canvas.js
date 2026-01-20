/**
 * Canvas Drawing Manager
 * Handles all canvas operations, path optimization, and rendering
 */
class CanvasManager {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d', { willReadFrequently: false });
    
    // Drawing state
    this.isDrawing = false;
    this.currentPath = [];
    this.tool = 'brush';
    this.color = '#000000';
    this.strokeWidth = 5;

    // Performance optimization
    this.pathBuffer = [];
    this.lastPoint = null;

    // Initialize canvas size
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Setup canvas rendering
    this.setupCanvas();
  }
  
  setupCanvas() {
    // Enable smooth lines
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    
    // Set initial drawing properties
    this.ctx.strokeStyle = this.color;
    this.ctx.lineWidth = this.strokeWidth;
  }
  
  resizeCanvas() {
    // Save current canvas content (with error handling for empty canvas)
    let imageData = null;
    try {
      if (this.canvas.width > 0 && this.canvas.height > 0) {
        imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      }
    } catch (e) {
      console.warn('Could not save canvas content during resize:', e);
    }

    // Resize canvas to fit container while maintaining aspect ratio
    const container = this.canvas.parentElement;
    const maxWidth = container.clientWidth - 40;
    const maxHeight = container.clientHeight - 40;

    // Ensure minimum dimensions
    if (maxWidth <= 0 || maxHeight <= 0) return;

    // Use a 16:9 aspect ratio
    let width = maxWidth;
    let height = width * 9 / 16;

    if (height > maxHeight) {
      height = maxHeight;
      width = height * 16 / 9;
    }

    // Ensure valid dimensions
    width = Math.max(1, Math.floor(width));
    height = Math.max(1, Math.floor(height));

    this.canvas.width = width;
    this.canvas.height = height;

    // Restore canvas content if we had any
    if (imageData) {
      try {
        this.ctx.putImageData(imageData, 0, 0);
      } catch (e) {
        console.warn('Could not restore canvas content during resize:', e);
      }
    }
    this.setupCanvas();
  }
  
  setTool(tool) {
    this.tool = tool;
  }
  
  setColor(color) {
    this.color = color;
    this.ctx.strokeStyle = color;
  }
  
  setStrokeWidth(width) {
    this.strokeWidth = width;
    this.ctx.lineWidth = width;
  }
  
  getCanvasCoordinates(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  /**
   * Clamp coordinates to canvas bounds
   */
  clampToCanvas(x, y) {
    return {
      x: Math.max(0, Math.min(x, this.canvas.width)),
      y: Math.max(0, Math.min(y, this.canvas.height))
    };
  }
  
  startDrawing(x, y) {
    // Clamp coordinates to canvas bounds
    const clamped = this.clampToCanvas(x, y);
    x = clamped.x;
    y = clamped.y;

    this.isDrawing = true;
    this.currentPath = [{ x, y }];
    this.lastPoint = { x, y };

    // Set up drawing style before starting path
    if (this.tool === 'eraser') {
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.strokeStyle = this.color;
    }
    this.ctx.lineWidth = this.strokeWidth;

    // Begin a new path
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
  }
  
  draw(x, y) {
    if (!this.isDrawing) return null;

    // Clamp coordinates to canvas bounds
    const clamped = this.clampToCanvas(x, y);
    x = clamped.x;
    y = clamped.y;

    // Add point to current path
    this.currentPath.push({ x, y });

    // Apply tool-specific drawing
    if (this.tool === 'eraser') {
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.strokeStyle = this.color;
    }

    this.ctx.lineWidth = this.strokeWidth;

    // Draw line segment from last point to current point
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastPoint.x, this.lastPoint.y);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();

    this.lastPoint = { x, y };

    // Return path data for network transmission
    return {
      points: [this.currentPath[this.currentPath.length - 2], { x, y }],
      tool: this.tool,
      color: this.color,
      strokeWidth: this.strokeWidth
    };
  }

  stopDrawing() {
    if (!this.isDrawing) return null;

    this.isDrawing = false;

    // Return complete path data
    const pathData = {
      points: this.currentPath,
      tool: this.tool,
      color: this.color,
      strokeWidth: this.strokeWidth
    };

    this.currentPath = [];
    this.lastPoint = null;

    // Reset composite operation
    this.ctx.globalCompositeOperation = 'source-over';

    return pathData;
  }
  
  /**
   * Draw a complete path (used for remote drawing and redo)
   */
  drawPath(pathData) {
    if (!pathData || !pathData.points || pathData.points.length === 0) {
      return;
    }

    // Save current state
    const prevComposite = this.ctx.globalCompositeOperation;
    const prevStroke = this.ctx.strokeStyle;
    const prevWidth = this.ctx.lineWidth;

    // Apply path settings
    if (pathData.tool === 'eraser') {
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.strokeStyle = pathData.color;
    }

    this.ctx.lineWidth = pathData.strokeWidth;

    // Draw the path
    this.ctx.beginPath();
    this.ctx.moveTo(pathData.points[0].x, pathData.points[0].y);

    for (let i = 1; i < pathData.points.length; i++) {
      this.ctx.lineTo(pathData.points[i].x, pathData.points[i].y);
    }

    this.ctx.stroke();

    // Restore previous state
    this.ctx.globalCompositeOperation = prevComposite;
    this.ctx.strokeStyle = prevStroke;
    this.ctx.lineWidth = prevWidth;
  }
  
  /**
   * Redraw all operations (used after undo)
   */
  redrawAll(operations) {
    // Clear canvas
    this.clear();
    
    // Draw all operations in order
    operations.forEach(op => {
      this.drawPath(op);
    });
  }
  
  /**
   * Clear the canvas
   */
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
  
  /**
   * Get canvas as data URL (for persistence)
   */
  toDataURL() {
    return this.canvas.toDataURL('image/png');
  }
  
  /**
   * Load canvas from data URL
   */
  fromDataURL(dataURL) {
    const img = new Image();
    img.onload = () => {
      this.ctx.drawImage(img, 0, 0);
    };
    img.src = dataURL;
  }
}
