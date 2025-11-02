// Settings Menu System - Handles settings functionality across all levels
/**
 * SettingsMenu - Manages settings menu state and functionality
 */
export class SettingsMenu {
    constructor() {
        this.settingsReturnContext = null; // Track where settings was accessed from ('pause' or 'main')
        this.onReturnFromSettings = null;
        
        // Settings state
        this.settings = {
            masterVolume: 100,
            musicVolume: 50,
            mouseSensitivity: 1,
            fullscreen: false,
            soundEffects: true
        };
        
        // Callbacks for when settings change
        this.onVolumeChange = null;
        this.onMusicVolumeChange = null;
        this.onSensitivityChange = null;
        this.onFullscreenChange = null;
        this.onSoundEffectsChange = null;
    }
    
    /**
     * Initializes the settings menu system
     */
    init() {
        // Make methods globally available for HTML onclick handlers
        window.showSettings = () => this.show();
        window.returnFromSettings = () => this.return();
        window.toggleFullscreen = () => this.toggleFullscreen();
        window.toggleSoundEffects = () => this.toggleSoundEffects();
        
        // Load saved settings
        this.loadSettings();
        
        // Setup settings handlers
        this.setupHandlers();
    }
    
    /**
     * Shows the settings menu
     */
    show() {
        // Track where settings was accessed from
        if (window.isGamePaused && window.isGamePaused()) {
            this.settingsReturnContext = 'pause';
        } else {
            this.settingsReturnContext = 'main';
        }
        
        // Hide all other menus
        if (window.hideAllMenuScreens) {
            window.hideAllMenuScreens();
        }
        
        // Show settings menu
        const settings = document.getElementById('settings');
        if (settings) {
            settings.classList.remove('hidden');
            if (window.createMenuParticles) {
                window.createMenuParticles();
            }
            
            // Setup handlers when menu is shown
            this.setupHandlers();
            
            // Update UI to reflect current settings
            this.updateUI();
        }
    }
    
    /**
     * Returns from settings to the previous screen
     */
    return() {
        // Hide settings menu
        const settings = document.getElementById('settings');
        if (settings) {
            settings.classList.add('hidden');
        }
        
        // Return to appropriate screen based on context
        if (this.onReturnFromSettings) {
            this.onReturnFromSettings(this.settingsReturnContext);
        } else {
            // Fallback logic
            if (this.settingsReturnContext === 'pause') {
                // Return to pause menu
                const pausedLevel = window.isGamePaused && window.isGamePaused() ? 
                    (window.pauseMenu?.getCurrentLevel?.() || null) : null;
                if (window.showPauseMenu) {
                    window.showPauseMenu(pausedLevel);
                }
            } else {
                // Return to main menu
                if (window.showMainMenu) {
                    window.showMainMenu();
                }
            }
        }
        
        // Reset context
        this.settingsReturnContext = null;
    }
    
    /**
     * Sets up event handlers for settings controls
     */
    setupHandlers() {
        // Volume slider
        const volumeSlider = document.getElementById('master-volume');
        const volumeDisplay = document.getElementById('volume-display');
        if (volumeSlider && volumeDisplay) {
            // Remove old listener if exists
            const newSlider = volumeSlider.cloneNode(true);
            volumeSlider.parentNode.replaceChild(newSlider, volumeSlider);
            
            newSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                volumeDisplay.textContent = value + '%';
                this.settings.masterVolume = value;
                this.saveSettings();
                
                // Call callback if set
                if (this.onVolumeChange) {
                    this.onVolumeChange(value);
                }
            });
            
            // Set initial value
            newSlider.value = this.settings.masterVolume;
            volumeDisplay.textContent = this.settings.masterVolume + '%';
        }
        
        // Music volume slider
        const musicVolumeSlider = document.getElementById('music-volume');
        const musicVolumeDisplay = document.getElementById('music-volume-display');
        if (musicVolumeSlider && musicVolumeDisplay) {
            // Remove old listener if exists
            const newMusicSlider = musicVolumeSlider.cloneNode(true);
            musicVolumeSlider.parentNode.replaceChild(newMusicSlider, musicVolumeSlider);
            
            newMusicSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                musicVolumeDisplay.textContent = value + '%';
                this.settings.musicVolume = value;
                this.saveSettings();
                
                // Call callback if set
                if (this.onMusicVolumeChange) {
                    this.onMusicVolumeChange(value);
                }
            });
            
            // Set initial value
            newMusicSlider.value = this.settings.musicVolume;
            musicVolumeDisplay.textContent = this.settings.musicVolume + '%';
        }
        
        // Mouse sensitivity slider
        const sensitivitySlider = document.getElementById('mouse-sensitivity');
        const sensitivityDisplay = document.getElementById('sensitivity-display');
        if (sensitivitySlider && sensitivityDisplay) {
            // Remove old listener if exists
            const newSlider = sensitivitySlider.cloneNode(true);
            sensitivitySlider.parentNode.replaceChild(newSlider, sensitivitySlider);
            
            newSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                sensitivityDisplay.textContent = value;
                this.settings.mouseSensitivity = value;
                this.saveSettings();
                
                // Call callback if set
                if (this.onSensitivityChange) {
                    this.onSensitivityChange(value);
                }
            });
            
            // Set initial value
            newSlider.value = this.settings.mouseSensitivity;
            sensitivityDisplay.textContent = this.settings.mouseSensitivity;
        }
    }
    
    /**
     * Updates UI elements to reflect current settings
     */
    updateUI() {
        // Update volume slider
        const volumeSlider = document.getElementById('master-volume');
        if (volumeSlider) {
            volumeSlider.value = this.settings.masterVolume;
        }
        const volumeDisplay = document.getElementById('volume-display');
        if (volumeDisplay) {
            volumeDisplay.textContent = this.settings.masterVolume + '%';
        }
        
        // Update music volume slider
        const musicVolumeSlider = document.getElementById('music-volume');
        if (musicVolumeSlider) {
            musicVolumeSlider.value = this.settings.musicVolume;
        }
        const musicVolumeDisplay = document.getElementById('music-volume-display');
        if (musicVolumeDisplay) {
            musicVolumeDisplay.textContent = this.settings.musicVolume + '%';
        }
        
        // Update sensitivity slider
        const sensitivitySlider = document.getElementById('mouse-sensitivity');
        if (sensitivitySlider) {
            sensitivitySlider.value = this.settings.mouseSensitivity;
        }
        const sensitivityDisplay = document.getElementById('sensitivity-display');
        if (sensitivityDisplay) {
            sensitivityDisplay.textContent = this.settings.mouseSensitivity;
        }
        
        // Update fullscreen toggle button
        const fullscreenButton = document.querySelector('[onclick*="toggleFullscreen"]');
        if (fullscreenButton) {
            fullscreenButton.textContent = this.settings.fullscreen ? 'ON' : 'OFF';
            fullscreenButton.style.background = this.settings.fullscreen 
                ? 'rgba(0, 255, 0, 0.3)' 
                : 'rgba(255, 0, 0, 0.3)';
        }
        
        // Update sound effects toggle button
        const soundEffectsButton = document.querySelector('[onclick*="toggleSoundEffects"]');
        if (soundEffectsButton) {
            soundEffectsButton.textContent = this.settings.soundEffects ? 'ON' : 'OFF';
            soundEffectsButton.style.background = this.settings.soundEffects 
                ? 'rgba(0, 255, 0, 0.3)' 
                : 'rgba(255, 0, 0, 0.3)';
        }
    }
    
    /**
     * Toggles fullscreen mode
     */
    toggleFullscreen() {
        // Get button from event if available, or find it in the DOM
        let button;
        if (typeof event !== 'undefined' && event && event.target) {
            button = event.target;
        } else {
            // Try to find the fullscreen button in the settings menu
            const settingsMenu = document.getElementById('settings');
            if (settingsMenu) {
                button = settingsMenu.querySelector('[onclick*="toggleFullscreen"]');
            }
        }
        
        if (!button) {
            // Create a temporary button object if we can't find one
            button = { textContent: this.settings.fullscreen ? 'ON' : 'OFF' };
        }
        
        this.settings.fullscreen = !this.settings.fullscreen;
        
        if (this.settings.fullscreen) {
            if (button.textContent !== undefined) button.textContent = 'ON';
            if (button.style) button.style.background = 'rgba(0, 255, 0, 0.3)';
            // Enable fullscreen
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(err => {
                    console.error('Error enabling fullscreen:', err);
                });
            }
        } else {
            if (button.textContent !== undefined) button.textContent = 'OFF';
            if (button.style) button.style.background = 'rgba(255, 0, 0, 0.3)';
            // Disable fullscreen
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(err => {
                    console.error('Error disabling fullscreen:', err);
                });
            }
        }
        
        this.saveSettings();
        
        // Call callback if set
        if (this.onFullscreenChange) {
            this.onFullscreenChange(this.settings.fullscreen);
        }
    }
    
    /**
     * Toggles sound effects
     */
    toggleSoundEffects() {
        // Get button from event if available, or find it in the DOM
        let button;
        if (typeof event !== 'undefined' && event && event.target) {
            button = event.target;
        } else {
            // Try to find the sound effects button in the settings menu
            const settingsMenu = document.getElementById('settings');
            if (settingsMenu) {
                button = settingsMenu.querySelector('[onclick*="toggleSoundEffects"]');
            }
        }
        
        if (!button) {
            // Create a temporary button object if we can't find one
            button = { textContent: this.settings.soundEffects ? 'ON' : 'OFF' };
        }
        
        this.settings.soundEffects = !this.settings.soundEffects;
        
        if (this.settings.soundEffects) {
            if (button.textContent !== undefined) button.textContent = 'ON';
            if (button.style) button.style.background = 'rgba(0, 255, 0, 0.3)';
        } else {
            if (button.textContent !== undefined) button.textContent = 'OFF';
            if (button.style) button.style.background = 'rgba(255, 0, 0, 0.3)';
        }
        
        this.saveSettings();
        
        // Call callback if set
        if (this.onSoundEffectsChange) {
            this.onSoundEffectsChange(this.settings.soundEffects);
        }
    }
    
    /**
     * Gets the current settings
     * @returns {Object} - Settings object
     */
    getSettings() {
        return { ...this.settings };
    }
    
    /**
     * Sets a specific setting value
     * @param {string} key - Setting key
     * @param {*} value - Setting value
     */
    setSetting(key, value) {
        if (this.settings.hasOwnProperty(key)) {
            this.settings[key] = value;
            this.saveSettings();
        }
    }
    
    /**
     * Saves settings to localStorage
     */
    saveSettings() {
        try {
            localStorage.setItem('gameSettings', JSON.stringify(this.settings));
        } catch (err) {
            console.warn('Could not save settings to localStorage:', err);
        }
    }
    
    /**
     * Loads settings from localStorage
     */
    loadSettings() {
        try {
            const saved = localStorage.getItem('gameSettings');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Merge with defaults
                this.settings = { ...this.settings, ...parsed };
                // Always default fullscreen to false (don't restore saved fullscreen state)
                this.settings.fullscreen = false;
            }
        } catch (err) {
            console.warn('Could not load settings from localStorage:', err);
        }
    }
    
    /**
     * Sets callback for return from settings
     * @param {Function} callback - Callback function (receives context: 'pause' or 'main')
     */
    setOnReturn(callback) {
        this.onReturnFromSettings = callback;
    }
    
    /**
     * Sets callback for volume change
     * @param {Function} callback - Callback function (receives volume: 0-100)
     */
    setOnVolumeChange(callback) {
        this.onVolumeChange = callback;
    }
    
    /**
     * Sets callback for music volume change
     * @param {Function} callback - Callback function (receives volume: 0-100)
     */
    setOnMusicVolumeChange(callback) {
        this.onMusicVolumeChange = callback;
    }
    
    /**
     * Sets callback for sensitivity change
     * @param {Function} callback - Callback function (receives sensitivity: number)
     */
    setOnSensitivityChange(callback) {
        this.onSensitivityChange = callback;
    }
    
    /**
     * Sets callback for fullscreen change
     * @param {Function} callback - Callback function (receives isFullscreen: boolean)
     */
    setOnFullscreenChange(callback) {
        this.onFullscreenChange = callback;
    }
    
    /**
     * Sets callback for sound effects change
     * @param {Function} callback - Callback function (receives enabled: boolean)
     */
    setOnSoundEffectsChange(callback) {
        this.onSoundEffectsChange = callback;
    }
    
    /**
     * Cleans up the settings menu system
     */
    cleanup() {
        // Remove global references
        delete window.showSettings;
        delete window.returnFromSettings;
        delete window.toggleFullscreen;
        delete window.toggleSoundEffects;
        
        this.settingsReturnContext = null;
    }
}

