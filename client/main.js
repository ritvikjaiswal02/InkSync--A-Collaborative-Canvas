/**
 * Main Application
 * Initializes canvas and websocket managers, sets up event listeners
 */

// Initialize managers
const canvas = document.getElementById('drawing-canvas');
const canvasManager = new CanvasManager(canvas);
const wsManager = new WebSocketManager(canvasManager);

// Tool selection
const brushTool = document.getElementById('brush-tool');
const eraserTool = document.getElementById('eraser-tool');

function setActiveTool(tool, activeButton) {
  canvasManager.setTool(tool);
  [brushTool, eraserTool].forEach(btn => btn.classList.remove('active'));
  activeButton.classList.add('active');
}

brushTool.addEventListener('click', () => setActiveTool('brush', brushTool));
eraserTool.addEventListener('click', () => setActiveTool('eraser', eraserTool));

// Color presets
const colorPresets = document.querySelectorAll('.color-preset');
const colorPickerBtn = document.getElementById('color-picker-btn');
const colorPickerDropdown = document.getElementById('color-picker-dropdown');
const colorGradient = document.getElementById('color-gradient');
const hueSlider = document.getElementById('hue-slider');
const colorPreview = document.getElementById('color-preview');
const hexInput = document.getElementById('hex-input');
const currentColorDisplay = document.getElementById('current-color-display');

let currentHue = 0;
let currentColor = '#000000';

function setColor(color) {
  currentColor = color;
  canvasManager.setColor(color);
  // Update displays
  currentColorDisplay.style.background = color;
  colorPreview.style.background = color;
  hexInput.value = color.toUpperCase();
  // Update active state on presets
  colorPresets.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.color.toLowerCase() === color.toLowerCase());
  });
}

// Color preset click handlers
colorPresets.forEach(btn => {
  btn.addEventListener('click', () => {
    setColor(btn.dataset.color);
  });
});

// Custom color picker toggle
colorPickerBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  colorPickerDropdown.classList.toggle('hidden');
  if (!colorPickerDropdown.classList.contains('hidden')) {
    drawGradient(currentHue);
  }
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (!colorPickerDropdown.contains(e.target) && e.target !== colorPickerBtn) {
    colorPickerDropdown.classList.add('hidden');
  }
});

// Draw the saturation/lightness gradient
function drawGradient(hue) {
  const ctx = colorGradient.getContext('2d');
  const width = colorGradient.width;
  const height = colorGradient.height;

  // Create gradient: white to hue color (horizontal)
  const gradientH = ctx.createLinearGradient(0, 0, width, 0);
  gradientH.addColorStop(0, '#ffffff');
  gradientH.addColorStop(1, `hsl(${hue}, 100%, 50%)`);
  ctx.fillStyle = gradientH;
  ctx.fillRect(0, 0, width, height);

  // Overlay: transparent to black (vertical)
  const gradientV = ctx.createLinearGradient(0, 0, 0, height);
  gradientV.addColorStop(0, 'rgba(0,0,0,0)');
  gradientV.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = gradientV;
  ctx.fillRect(0, 0, width, height);
}

// Handle hue slider
hueSlider.addEventListener('input', (e) => {
  currentHue = parseInt(e.target.value);
  drawGradient(currentHue);
});

// Handle gradient click
colorGradient.addEventListener('click', (e) => {
  const rect = colorGradient.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const ctx = colorGradient.getContext('2d');
  const pixel = ctx.getImageData(x, y, 1, 1).data;
  const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(v => v.toString(16).padStart(2, '0')).join('');
  setColor(hex);
});

// Handle gradient drag
let isDraggingGradient = false;
colorGradient.addEventListener('mousedown', () => { isDraggingGradient = true; });
document.addEventListener('mouseup', () => { isDraggingGradient = false; });
colorGradient.addEventListener('mousemove', (e) => {
  if (!isDraggingGradient) return;
  const rect = colorGradient.getBoundingClientRect();
  const x = Math.max(0, Math.min(e.clientX - rect.left, colorGradient.width - 1));
  const y = Math.max(0, Math.min(e.clientY - rect.top, colorGradient.height - 1));
  const ctx = colorGradient.getContext('2d');
  const pixel = ctx.getImageData(x, y, 1, 1).data;
  const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(v => v.toString(16).padStart(2, '0')).join('');
  setColor(hex);
});

// Handle hex input
hexInput.addEventListener('input', (e) => {
  let val = e.target.value;
  if (!val.startsWith('#')) val = '#' + val;
  if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
    setColor(val);
  }
});

// Set initial color (black preset active)
setColor('#000000');
drawGradient(0);

// Stroke width
const strokeWidth = document.getElementById('stroke-width');
const strokeWidthValue = document.getElementById('stroke-width-value');

strokeWidth.addEventListener('input', (e) => {
  const width = parseInt(e.target.value);
  canvasManager.setStrokeWidth(width);
  strokeWidthValue.textContent = width;
});

// Action buttons
const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');
const clearBtn = document.getElementById('clear-btn');

undoBtn.addEventListener('click', () => {
  wsManager.sendUndo();
});

redoBtn.addEventListener('click', () => {
  wsManager.sendRedo();
});

clearBtn.addEventListener('click', () => {
  if (confirm('Are you sure you want to clear the canvas? This will affect all users.')) {
    wsManager.sendClearCanvas();
  }
});

// Canvas drawing events
let isDrawing = false;
let drawingThrottleTimer = null;

canvas.addEventListener('mousedown', (e) => {
  const coords = canvasManager.getCanvasCoordinates(e.clientX, e.clientY);
  canvasManager.startDrawing(coords.x, coords.y);
  isDrawing = true;
});

canvas.addEventListener('mousemove', (e) => {
  const coords = canvasManager.getCanvasCoordinates(e.clientX, e.clientY);
  
  // Send cursor position (throttled)
  if (!drawingThrottleTimer) {
    wsManager.sendCursorMove(coords.x, coords.y);
    drawingThrottleTimer = setTimeout(() => {
      drawingThrottleTimer = null;
    }, 50); // Update every 50ms
  }
  
  if (isDrawing) {
    const pathData = canvasManager.draw(coords.x, coords.y);
    // We'll send complete path on mouseup for better performance
  }
});

canvas.addEventListener('mouseup', (e) => {
  if (isDrawing) {
    const pathData = canvasManager.stopDrawing();
    
    // Send complete path to server
    if (pathData && pathData.points.length > 0) {
      wsManager.sendDraw(pathData);
    }
    
    isDrawing = false;
  }
});

canvas.addEventListener('mouseleave', (e) => {
  if (isDrawing) {
    const pathData = canvasManager.stopDrawing();
    
    // Send complete path to server
    if (pathData && pathData.points.length > 0) {
      wsManager.sendDraw(pathData);
    }
    
    isDrawing = false;
  }
});

// Touch support for mobile
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  const coords = canvasManager.getCanvasCoordinates(touch.clientX, touch.clientY);
  canvasManager.startDrawing(coords.x, coords.y);
  isDrawing = true;
});

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (isDrawing) {
    const touch = e.touches[0];
    const coords = canvasManager.getCanvasCoordinates(touch.clientX, touch.clientY);
    canvasManager.draw(coords.x, coords.y);
  }
});

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  if (isDrawing) {
    const pathData = canvasManager.stopDrawing();
    
    // Send complete path to server
    if (pathData && pathData.points.length > 0) {
      wsManager.sendDraw(pathData);
    }
    
    isDrawing = false;
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Ctrl+Z or Cmd+Z for undo
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    wsManager.sendUndo();
  }
  
  // Ctrl+Y or Cmd+Shift+Z for redo
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
    e.preventDefault();
    wsManager.sendRedo();
  }
  
  // B for brush
  if (e.key === 'b' || e.key === 'B') {
    brushTool.click();
  }
  
  // E for eraser
  if (e.key === 'e' || e.key === 'E') {
    eraserTool.click();
  }
});

// Prevent context menu on canvas
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});

// FPS Counter
let frameCount = 0;
let lastFpsUpdate = performance.now();
const fpsDisplay = document.getElementById('fps-value');

function updateFPS() {
  frameCount++;
  const now = performance.now();
  const elapsed = now - lastFpsUpdate;

  if (elapsed >= 1000) {
    const fps = Math.round((frameCount * 1000) / elapsed);
    fpsDisplay.textContent = fps;
    frameCount = 0;
    lastFpsUpdate = now;
  }

  requestAnimationFrame(updateFPS);
}

requestAnimationFrame(updateFPS);

console.log('Collaborative Canvas initialized');
console.log('Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Y (redo), B (brush), E (eraser)');
