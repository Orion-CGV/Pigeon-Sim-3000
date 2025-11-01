// Input System - Handles keyboard input and provides input state
/**
 * InputSystem - Manages keyboard input for the game
 */
export class InputSystem {
    constructor() {
        // Object to track which keys are currently pressed
        this.keys = {};
        
        // Callbacks for special key actions
        this.onEscape = null;      // Callback for ESC key (pause menu)
        this.onF2 = null;          // Callback for F2 key (collision helpers toggle)
        
        // Bound event handlers (for cleanup)
        this.boundKeyDown = null;
        this.boundKeyUp = null;
    }
    
    /**
     * Initializes the input system and sets up event listeners
     */
    init() {
        // Bind handlers so we can remove them later
        this.boundKeyDown = this.handleKeyDown.bind(this);
        this.boundKeyUp = this.handleKeyUp.bind(this);
        
        // Add event listeners for keyboard input
        document.addEventListener("keydown", this.boundKeyDown);
        document.addEventListener("keyup", this.boundKeyUp);
    }
    
    /**
     * Handles key press events
     * @param {KeyboardEvent} e - Keyboard event
     */
    handleKeyDown(e) {
        // Check for ESC key to show pause menu
        if (e.code === "Escape") {
            // Prevent default browser behavior
            e.preventDefault();
            if (this.onEscape) {
                this.onEscape();
            }
            return;
        }
        
        if (e.code === "F2") {
            // Toggle collision visualization (F2 key)
            if (this.onF2) {
                this.onF2();
            }
            return;
        }
        
        // Store any other key in keys object using lowercase key name
        this.keys[e.key.toLowerCase()] = true;
    }
    
    /**
     * Handles key release events
     * @param {KeyboardEvent} e - Keyboard event
     */
    handleKeyUp(e) {
        // Remove key from keys object when released
        this.keys[e.key.toLowerCase()] = false;
    }
    
    /**
     * Gets the current input state
     * @returns {Object} - Object containing current key states
     */
    getInputState() {
        return {
            keys: this.keys
        };
    }
    
    /**
     * Gets the current keys object directly
     * @returns {Object} - Keys object
     */
    getKeys() {
        return this.keys;
    }
    
    /**
     * Sets callback for ESC key press
     * @param {Function} callback - Callback function
     */
    setOnEscape(callback) {
        this.onEscape = callback;
    }
    
    /**
     * Sets callback for F2 key press
     * @param {Function} callback - Callback function
     */
    setOnF2(callback) {
        this.onF2 = callback;
    }
    
    /**
     * Cleans up the input system by removing event listeners
     */
    cleanup() {
        if (this.boundKeyDown) {
            document.removeEventListener("keydown", this.boundKeyDown);
            this.boundKeyDown = null;
        }
        if (this.boundKeyUp) {
            document.removeEventListener("keyup", this.boundKeyUp);
            this.boundKeyUp = null;
        }
        
        // Clear keys state
        this.keys = {};
    }
}

