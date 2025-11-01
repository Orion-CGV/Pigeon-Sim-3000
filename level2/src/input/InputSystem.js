/**
 * ========================================
 * INPUT SYSTEM
 * ========================================
 * 
 * Manages all input handling in the game:
 * - Keyboard controls (WASD, arrows, spacebar, etc.)
 * - Input state management
 * 
 * This module decouples input handling from game logic
 * through callbacks.
 * ========================================
 */

export class InputSystem {
    constructor() {
        // Keyboard state
        this.keys = {};
        
        // Callbacks (to be set by game)
        this.callbacks = {
            onSpeedChange: null,          // (speed) => void
            onDirectionChange: null,      // (direction) => void
            onBoostStart: null,           // () => void
            onBoostEnd: null,             // () => void
            onCameraToggle: null,         // () => void
            onHeadlightsToggle: null,     // () => void
            onCollidersToggle: null,      // () => void
        };
        
        // Bound event handlers (for cleanup)
        this.boundHandlers = {
            keyDown: null,
            keyUp: null
        };
    }
    
    /**
     * Set callback functions for input actions
     * @param {Object} callbacks - Object containing callback functions
     */
    setCallbacks(callbacks) {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }
    
    /**
     * Initialize input system
     */
    init() {
        // Setup keyboard listeners
        this.setupKeyboardControls();
    }
    
    /**
     * Setup keyboard event listeners
     */
    setupKeyboardControls() {
        this.boundHandlers.keyDown = (e) => this.handleKeyDown(e);
        this.boundHandlers.keyUp = (e) => this.handleKeyUp(e);
        
        window.addEventListener('keydown', this.boundHandlers.keyDown);
        window.addEventListener('keyup', this.boundHandlers.keyUp);
    }
    
    /**
     * Handle keyboard key down
     * @param {KeyboardEvent} event
     */
    handleKeyDown(event) {
        this.keys[event.code] = true;
        
        // Camera toggle (Q key)
        if (event.code === 'KeyQ') {
            if (this.callbacks.onCameraToggle) {
                this.callbacks.onCameraToggle();
            }
        }
        
        // Headlights toggle (L key) - callback should check if night mode
        if (event.code === 'KeyL') {
            if (this.callbacks.onHeadlightsToggle) {
                this.callbacks.onHeadlightsToggle();
            }
        }
        
        // Colliders toggle (C key)
        if (event.code === 'KeyC') {
            if (this.callbacks.onCollidersToggle) {
                this.callbacks.onCollidersToggle();
            }
        }
        
        // Pause/Menu (ESC key)
        if (event.code === 'Escape') {
            if (this.callbacks.onPause) {
                this.callbacks.onPause();
            }
        }
        
        // Boost (Spacebar)
        if (event.code === 'Space') {
            event.preventDefault(); // Prevent page scroll
            if (this.callbacks.onBoostStart) {
                this.callbacks.onBoostStart();
            }
        }
        
        this.updateCarControls();
    }
    
    /**
     * Handle keyboard key up
     * @param {KeyboardEvent} event
     */
    handleKeyUp(event) {
        this.keys[event.code] = false;
        
        // Boost release
        if (event.code === 'Space') {
            if (this.callbacks.onBoostEnd) {
                this.callbacks.onBoostEnd();
            }
        }
        
        this.updateCarControls();
    }
    
    /**
     * Update car controls based on keyboard state
     */
    updateCarControls() {
        let speed = 0;
        let direction = 0;
        
        // Forward/backward
        if (this.keys['KeyW'] || this.keys['ArrowUp']) {
            speed = 10;
        }
        if (this.keys['KeyS'] || this.keys['ArrowDown']) {
            speed = -10;
        }
        
        // Left/right
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) {
            direction = -1;
        }
        if (this.keys['KeyD'] || this.keys['ArrowRight']) {
            direction = 1;
        }
        
        // Call callbacks
        if (this.callbacks.onSpeedChange) {
            this.callbacks.onSpeedChange(speed);
        }
        if (this.callbacks.onDirectionChange) {
            this.callbacks.onDirectionChange(direction);
        }
    }
    
    /**
     * Main update function - call this every frame
     */
    update() {
        // No updates needed
    }
    
    /**
     * Cleanup input system
     */
    cleanup() {
        // Remove keyboard listeners
        if (this.boundHandlers.keyDown) {
            window.removeEventListener('keydown', this.boundHandlers.keyDown);
        }
        if (this.boundHandlers.keyUp) {
            window.removeEventListener('keyup', this.boundHandlers.keyUp);
        }
    }
}

