/**
 * ========================================
 * INPUT SYSTEM
 * ========================================
 * 
 * Manages all input handling in the game:
 * - Keyboard controls (WASD, arrows, spacebar, etc.)
 * - Mobile touch controls (joystick, buttons)
 * - Mobile/desktop detection
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
        
        // Mobile state
        this.isMobile = false;
        this.joystickActive = false;
        this.joystickData = { x: 0, y: 0 };
        this.mobileBoostActive = false;
        
        // Callbacks (to be set by game)
        this.callbacks = {
            onSpeedChange: null,          // (speed) => void
            onDirectionChange: null,      // (direction) => void
            onBoostStart: null,           // () => void
            onBoostEnd: null,             // () => void
            onCameraToggle: null,         // () => void
            onHeadlightsToggle: null,     // () => void
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
     * Initialize input system and detect platform
     */
    init() {
        // Detect mobile
        this.isMobile = this.detectMobile();
        
        if (this.isMobile) {
            this.setupMobileControls();
        } else {
        }
        
        // Setup keyboard listeners
        this.setupKeyboardControls();
    }
    
    /**
     * Detect if running on mobile device
     * @returns {boolean} True if mobile device
     */
    detectMobile() {
        const ua = navigator.userAgent;
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) || 
               ('ontouchstart' in window) || 
               (navigator.maxTouchPoints > 0);
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
        // Skip keyboard input on mobile
        if (this.isMobile) return;
        
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
        // Skip keyboard input on mobile
        if (this.isMobile) return;
        
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
        // Skip keyboard controls on mobile
        if (this.isMobile) return;
        
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
     * Setup mobile touch controls (joystick and buttons)
     */
    setupMobileControls() {




        
        if (!this.isMobile) {
            return;
        }
        
        const joystickContainer = document.getElementById('joystick-container');
        const joystickStick = document.getElementById('joystick-stick');
        const mobileBoost = document.getElementById('mobile-boost');
        const mobileCamera = document.getElementById('mobile-camera');
        const mobileControls = document.getElementById('mobile-controls');


        
        if (!joystickContainer || !joystickStick) {
            console.error('❌ Mobile controls not found in DOM');
            return;
        }
        
        // Force display mobile controls
        if (mobileControls) {
            mobileControls.style.display = 'block';
        }
        
        // Joystick touch handling
        let joystickTouchId = null;
        const joystickCenter = { x: 75, y: 75 }; // Half of 150px container
        const joystickMaxDistance = 40; // Max distance stick can move
        
        const updateJoystick = (touch) => {
            const rect = joystickContainer.getBoundingClientRect();
            const touchX = touch.clientX - rect.left;
            const touchY = touch.clientY - rect.top;
            
            // Calculate offset from center
            const deltaX = touchX - joystickCenter.x;
            const deltaY = touchY - joystickCenter.y;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            
            // Clamp to max distance
            const clampedDistance = Math.min(distance, joystickMaxDistance);
            const angle = Math.atan2(deltaY, deltaX);
            
            const stickX = Math.cos(angle) * clampedDistance;
            const stickY = Math.sin(angle) * clampedDistance;
            
            // Update visual position
            joystickStick.style.transform = `translate(calc(-50% + ${stickX}px), calc(-50% + ${stickY}px))`;
            
            // Update joystick data (-1 to 1 range)
            this.joystickData.x = stickX / joystickMaxDistance;
            this.joystickData.y = stickY / joystickMaxDistance;
            
            this.joystickActive = true;
        };
        
        const resetJoystick = () => {
            joystickStick.style.transform = 'translate(-50%, -50%)';
            this.joystickData.x = 0;
            this.joystickData.y = 0;
            this.joystickActive = false;
            joystickTouchId = null;
        };
        
        // Touch events for joystick
        joystickContainer.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (joystickTouchId === null) {
                joystickTouchId = e.changedTouches[0].identifier;
                updateJoystick(e.changedTouches[0]);
            }
        }, { passive: false });
        
        joystickContainer.addEventListener('touchmove', (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === joystickTouchId) {
                    updateJoystick(e.changedTouches[i]);
                    break;
                }
            }
        }, { passive: false });
        
        joystickContainer.addEventListener('touchend', (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === joystickTouchId) {
                    resetJoystick();
                    break;
                }
            }
        }, { passive: false });
        
        joystickContainer.addEventListener('touchcancel', (e) => {
            resetJoystick();
        });
        
        // Also add mouse events for desktop testing
        let mouseDown = false;
        joystickContainer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            mouseDown = true;
            updateJoystick({ clientX: e.clientX, clientY: e.clientY });
        });
        
        document.addEventListener('mousemove', (e) => {
            if (mouseDown) {
                updateJoystick({ clientX: e.clientX, clientY: e.clientY });
            }
        });
        
        document.addEventListener('mouseup', (e) => {
            if (mouseDown) {
                mouseDown = false;
                resetJoystick();
            }
        });
        
        // Boost button
        if (mobileBoost) {
            mobileBoost.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.mobileBoostActive = true;
                if (this.callbacks.onBoostStart) {
                    this.callbacks.onBoostStart();
                }
            }, { passive: false });
            
            mobileBoost.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.mobileBoostActive = false;
                if (this.callbacks.onBoostEnd) {
                    this.callbacks.onBoostEnd();
                }
            }, { passive: false });
        }
        
        // Camera button
        if (mobileCamera) {
            mobileCamera.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (this.callbacks.onCameraToggle) {
                    this.callbacks.onCameraToggle();
                }
            }, { passive: false });
        }
    }
    
    /**
     * Update mobile controls (call every frame)
     */
    updateMobileControls() {
        if (!this.isMobile || !this.joystickActive) return;
        
        // Joystick Y-axis controls forward/backward (inverted)
        const forwardBackward = -this.joystickData.y; // Negative because joystick Y is inverted
        
        let speed = 0;
        if (Math.abs(forwardBackward) > 0.2) {
            speed = forwardBackward * 10;
        }
        
        // Joystick X-axis controls steering
        let direction = 0;
        if (Math.abs(this.joystickData.x) > 0.2) {
            direction = this.joystickData.x;
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
        if (this.isMobile) {
            this.updateMobileControls();
        }
    }
    
    /**
     * Check if mobile device
     * @returns {boolean}
     */
    getIsMobile() {
        return this.isMobile;
    }
    
    /**
     * Get joystick state
     * @returns {Object} Joystick data {x, y}
     */
    getJoystickData() {
        return this.joystickData;
    }
    
    /**
     * Force mobile mode (for testing)
     */
    forceMobileMode() {
        this.isMobile = true;
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) {
            mobileControls.style.display = 'block';
        }
        this.setupMobileControls();
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

