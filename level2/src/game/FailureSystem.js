/**
 * ========================================
 * FAILURE SYSTEM
 * ========================================
 * 
 * Manages game failure conditions for Level 2:
 * - Tracks collision count
 * - Triggers failure when collision limit (10) is reached
 * - Displays failure UI with restart option
 * - Pauses game on failure
 * 
 * This module provides failure detection and handling.
 * ========================================
 */

export class FailureSystem {
    constructor(scene, deliverySystem, gameRestartSystem) {
        this.scene = scene;
        this.deliverySystem = deliverySystem;
        this.gameRestartSystem = gameRestartSystem;
        
        // Configuration
        this.maxCollisions = 10;
        this.isFailed = false;
        this.failurePopup = null;
    }
    
    /**
     * Initialize the failure system
     */
    init() {
        console.log('✅ FailureSystem initialized - Max collisions:', this.maxCollisions);
    }
    
    /**
     * Check if collision count has reached the failure threshold
     * Called after each collision is recorded
     */
    checkFailure() {
        if (this.isFailed) {
            return; // Already failed, don't check again
        }
        
        if (!this.deliverySystem) {
            console.warn('⚠️ FailureSystem: deliverySystem not available');
            return;
        }
        
        const collisionCount = this.deliverySystem.getCollisionCount();
        
        if (collisionCount >= this.maxCollisions) {
            this.triggerFailure();
        }
    }
    
    /**
     * Trigger failure state - pause game and show failure UI
     */
    triggerFailure() {
        if (this.isFailed) {
            return; // Already failed
        }
        
        this.isFailed = true;
        console.log('❌ Game failed - Too many collisions!');
        
        // Pause the game loop
        if (window.pauseGameLoop) {
            window.pauseGameLoop();
        }
        
        // Show failure UI
        this.showFailurePopup();
    }
    
    /**
     * Show failure popup with restart option
     */
    showFailurePopup() {
        // Remove any existing popups
        if (this.failurePopup) {
            this.failurePopup.remove();
        }
        
        // Create failure popup
        this.failurePopup = document.createElement('div');
        this.failurePopup.className = 'failure-popup game-ui';
        this.failurePopup.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            font-family: 'Jersey 10', sans-serif;
            color: white;
            opacity: 0;
            transition: opacity 0.3s ease-in-out;
        `;
        
        const collisionCount = this.deliverySystem ? this.deliverySystem.getCollisionCount() : this.maxCollisions;
        
        this.failurePopup.innerHTML = `
            <div style="text-align: center; max-width: 600px; padding: 20px;">
                <h1 style="font-size: 2.5em; color: #ff4444; margin-bottom: 20px; text-shadow: 3px 3px 0px rgba(0,0,0,0.5);">
                    GAME OVER
                </h1>
                <p style="font-size: 1.5em; margin-bottom: 30px; line-height: 1.6;">
                    Too many collisions!
                </p>
                <p style="font-size: 1.2em; margin-bottom: 20px; color: #ffaa00;">
                    Collisions: ${collisionCount} / ${this.maxCollisions}
                </p>
                <p style="font-size: 1em; margin-bottom: 40px; color: #cccccc; line-height: 1.5;">
                    You've exceeded the collision limit. Drive more carefully!
                </p>
                <button 
                    id="failure-restart-btn" 
                    style="
                        font-family: 'Jersey 10', sans-serif;
                        font-size: 1.2em;
                        padding: 15px 30px;
                        background: #ff4444;
                        color: white;
                        border: 3px solid #ffffff;
                        border-radius: 5px;
                        cursor: pointer;
                        transition: all 0.2s;
                        box-shadow: 0 4px 8px rgba(0,0,0,0.3);
                    "
                    onmouseover="this.style.background='#ff6666'; this.style.transform='scale(1.05)'"
                    onmouseout="this.style.background='#ff4444'; this.style.transform='scale(1)'"
                >
                    RESTART LEVEL
                </button>
            </div>
        `;
        
        document.body.appendChild(this.failurePopup);
        
        // Fade in popup
        setTimeout(() => {
            if (this.failurePopup) {
                this.failurePopup.style.opacity = '1';
            }
        }, 100);
        
        // Setup restart button
        const restartBtn = this.failurePopup.querySelector('#failure-restart-btn');
        if (restartBtn) {
            restartBtn.onclick = () => {
                this.restartGame();
            };
        }
        
        // Also allow ESC or Enter to restart
        const keyHandler = (e) => {
            if (e.key === 'Escape' || e.key === 'Enter') {
                document.removeEventListener('keydown', keyHandler);
                this.restartGame();
            }
        };
        document.addEventListener('keydown', keyHandler);
        this.keyHandler = keyHandler;
    }
    
    /**
     * Restart the game after failure
     */
    restartGame() {
        console.log('🔄 Restarting game after failure...');
        
        // Remove failure popup
        if (this.failurePopup) {
            this.failurePopup.style.opacity = '0';
            setTimeout(() => {
                if (this.failurePopup && this.failurePopup.parentNode) {
                    this.failurePopup.parentNode.removeChild(this.failurePopup);
                }
                this.failurePopup = null;
            }, 300);
        }
        
        // Remove key handler
        if (this.keyHandler) {
            document.removeEventListener('keydown', this.keyHandler);
            this.keyHandler = null;
        }
        
        // Reset failure state
        this.isFailed = false;
        
        // Restart the game using the same mechanism as pause menu restart
        // Call restartLevel() directly (same as what pause menu does for level 2)
        // This is already deferred internally, so we don't need another setTimeout
        if (window.restartLevel && typeof window.restartLevel === 'function') {
            // Use the same restart function that pause menu uses for level 2
            window.restartLevel();
        } else if (this.gameRestartSystem) {
            // Fallback: direct restart (shouldn't normally happen)
            setTimeout(() => {
                this.gameRestartSystem.restart();
            }, 0);
        } else {
            console.error('❌ No restart system available!');
        }
    }
    
    /**
     * Check if game has failed
     * @returns {boolean} True if game has failed
     */
    hasFailed() {
        return this.isFailed;
    }
    
    /**
     * Reset failure state (called when game restarts)
     */
    reset() {
        this.isFailed = false;
        
        // Remove failure popup if it exists
        if (this.failurePopup) {
            if (this.failurePopup.parentNode) {
                this.failurePopup.parentNode.removeChild(this.failurePopup);
            }
            this.failurePopup = null;
        }
        
        // Remove key handler
        if (this.keyHandler) {
            document.removeEventListener('keydown', this.keyHandler);
            this.keyHandler = null;
        }
        
        console.log('✅ FailureSystem reset');
    }
    
    /**
     * Cleanup failure system
     */
    cleanup() {
        this.reset();
        this.deliverySystem = null;
        this.gameRestartSystem = null;
    }
}
