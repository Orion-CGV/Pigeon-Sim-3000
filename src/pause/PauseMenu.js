// Pause Menu System - Handles pause menu functionality across all levels
/**
 * PauseMenu - Manages pause menu state and UI
 */
export class PauseMenu {
    constructor() {
        this.isGamePaused = false;
        this.currentPausedLevel = null;
        this.onResume = null;
        this.onRestart = null;
        this.onReturnToMenu = null;
    }
    
    /**
     * Initializes the pause menu system
     */
    init() {
        // Make methods globally available for HTML onclick handlers
        window.showPauseMenu = (levelNumber = null) => this.show(levelNumber);
        window.resumeGame = () => this.resume();
        window.restartLevel = () => this.restart();
        window.returnToMainMenuFromPause = () => this.returnToMenu();
        window.isGamePaused = () => this.isPaused();
    }
    
    /**
     * Shows the pause menu
     * @param {string|number|null} levelNumber - Current level identifier
     */
    show(levelNumber = null) {
        this.isGamePaused = true;
        this.currentPausedLevel = levelNumber;
        
        // Hide all other menus
        if (window.hideAllMenuScreens) {
            window.hideAllMenuScreens();
        }
        
        // Show pause menu
        const pauseMenu = document.getElementById('pause-menu');
        if (pauseMenu) {
            pauseMenu.classList.remove('hidden');
            if (window.createMenuParticles) {
                window.createMenuParticles();
            }
        }
        
        // Pause the game loop
        if (window.pauseGameLoop) {
            window.pauseGameLoop();
        }
    }
    
    /**
     * Resumes the game
     */
    resume() {
        this.isGamePaused = false;
        
        // Hide pause menu
        const pauseMenu = document.getElementById('pause-menu');
        if (pauseMenu) {
            pauseMenu.classList.add('hidden');
        }
        
        // Resume the game loop
        if (window.resumeGameLoop) {
            window.resumeGameLoop();
        }
        
        // Call custom resume callback if set
        if (this.onResume) {
            this.onResume();
        }
        
        // Clear paused level reference
        this.currentPausedLevel = null;
    }
    
    /**
     * Restarts the current level
     */
    restart() {
        if (this.currentPausedLevel) {
            // Resume first to clean up
            this.resume();
            
            // Call restart callback
            if (this.onRestart) {
                this.onRestart(this.currentPausedLevel);
            } else if (window.loadLevel) {
                // Fallback to global loadLevel function
                window.loadLevel(this.currentPausedLevel);
            }
        } else {
            // If no specific level, just resume
            this.resume();
        }
    }
    
    /**
     * Returns to main menu from pause
     */
    returnToMenu() {
        // Resume first to clean up
        this.resume();
        
        // Call return callback
        if (this.onReturnToMenu) {
            this.onReturnToMenu(this.currentPausedLevel);
        } else {
            // Fallback logic
            if (this.currentPausedLevel === 'main') {
                // If we were in Story Mode, use the special return function
                if (window.returnToMainMenuFromStory) {
                    window.returnToMainMenuFromStory();
                } else if (window.showMainMenu) {
                    window.showMainMenu();
                }
            } else {
                // If we were in a level, use the normal return function
                if (window.returnToMainMenu) {
                    window.returnToMainMenu();
                } else if (window.showMainMenu) {
                    window.showMainMenu();
                }
            }
        }
    }
    
    /**
     * Checks if game is currently paused
     * @returns {boolean} - True if game is paused
     */
    isPaused() {
        return this.isGamePaused;
    }
    
    /**
     * Gets the current paused level
     * @returns {string|number|null} - Current level identifier
     */
    getCurrentLevel() {
        return this.currentPausedLevel;
    }
    
    /**
     * Sets callback for resume action
     * @param {Function} callback - Callback function
     */
    setOnResume(callback) {
        this.onResume = callback;
    }
    
    /**
     * Sets callback for restart action
     * @param {Function} callback - Callback function (receives levelNumber)
     */
    setOnRestart(callback) {
        this.onRestart = callback;
    }
    
    /**
     * Sets callback for return to menu action
     * @param {Function} callback - Callback function (receives levelNumber)
     */
    setOnReturnToMenu(callback) {
        this.onReturnToMenu = callback;
    }
    
    /**
     * Cleans up the pause menu system
     */
    cleanup() {
        // Remove global references
        delete window.showPauseMenu;
        delete window.resumeGame;
        delete window.restartLevel;
        delete window.returnToMainMenuFromPause;
        
        this.isGamePaused = false;
        this.currentPausedLevel = null;
    }
}

