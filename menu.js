// Legacy Arcade - Menu Navigation System

// ---------- Menu Navigation ----------
let currentMenuScreen = 'intro';

// Function to show main menu
window.showMainMenu = function() {
    hideAllMenuScreens();
    const mainMenu = document.getElementById('main-menu');
    if (mainMenu) {
        mainMenu.classList.remove('hidden');
        currentMenuScreen = 'main';
        createMenuParticles();
    }
};

// Function to show play submenu
window.showPlaySubmenu = function() {
    hideAllMenuScreens();
    const playSubmenu = document.getElementById('play-submenu');
    if (playSubmenu) {
        playSubmenu.classList.remove('hidden');
        currentMenuScreen = 'play-submenu';
        createMenuParticles();
    }
};

// Function to show level select
window.showLevelSelect = function() {
    hideAllMenuScreens();
    const levelSelect = document.getElementById('level-select');
    if (levelSelect) {
        levelSelect.classList.remove('hidden');
        currentMenuScreen = 'level-select';
        createMenuParticles();
    }
};

// Function to show settings
window.showSettings = function() {
    // Track where settings was accessed from
    if (isGamePaused) {
        settingsReturnContext = 'pause';
    } else {
        settingsReturnContext = 'main';
    }
    
    hideAllMenuScreens();
    const settings = document.getElementById('settings');
    if (settings) {
        settings.classList.remove('hidden');
        currentMenuScreen = 'settings';
        createMenuParticles();
        setupSettingsHandlers();
    }
};

// Function to show credits
window.showCredits = function() {
    hideAllMenuScreens();
    const credits = document.getElementById('credits');
    if (credits) {
        credits.classList.remove('hidden');
        currentMenuScreen = 'credits';
        createMenuParticles();
    }
};

// Function to show instructions
window.showInstructions = function() {
    hideAllMenuScreens();
    const instructions = document.getElementById('instructions');
    if (instructions) {
        instructions.classList.remove('hidden');
        currentMenuScreen = 'instructions';
        createMenuParticles();
    }
};

// Function to start story mode
window.startStoryMode = function() {
    console.log('Starting Story Mode...');
    hideAllMenuScreens();
    
    // Wait for main.js to be ready, then start the story mode
    const waitForMain = () => {
        if (window.initMainMenu) {
            console.log('Calling initMainMenu...');
            window.initMainMenu();
            
            // Ensure the canvas is visible after initialization
            setTimeout(() => {
                console.log('Making canvas visible...');
                console.log('window.renderer:', window.renderer);
                console.log('window.labelRenderer:', window.labelRenderer);
                
                // Try to find the renderer in the DOM if not available globally
                let canvas = null;
                if (window.renderer && window.renderer.domElement) {
                    canvas = window.renderer.domElement;
                    console.log('Using global renderer');
                } else {
                    // Try to find canvas in DOM
                    canvas = document.querySelector('canvas[data-engine*="three"]');
                    console.log('Found canvas in DOM:', canvas);
                }
                
                if (canvas) {
                    console.log('Canvas found, making visible...');
                    canvas.style.display = 'block';
                    canvas.style.visibility = 'visible';
                    canvas.style.zIndex = '1';
                    canvas.style.position = 'absolute';
                    canvas.style.top = '0px';
                    canvas.style.left = '0px';
                    canvas.style.width = '100%';
                    canvas.style.height = '100%';
                    
                    console.log('Canvas should be visible now');
                    console.log('Canvas final display:', canvas.style.display);
                    console.log('Canvas final visibility:', canvas.style.visibility);
                } else {
                    console.error('No canvas found!');
                }
                
                // Try to find label renderer
                let labelCanvas = null;
                if (window.labelRenderer && window.labelRenderer.domElement) {
                    labelCanvas = window.labelRenderer.domElement;
                } else {
                    // Try to find label canvas in DOM
                    labelCanvas = document.querySelector('div[style*="position: absolute"][style*="top: 0px"]');
                }
                
                if (labelCanvas) {
                    labelCanvas.style.display = 'block';
                    labelCanvas.style.zIndex = '2';
                    console.log('Label renderer made visible');
                } else {
                    console.log('Label renderer not found');
                }
            }, 100);
        } else {
            console.log('Waiting for main.js to load...');
            setTimeout(waitForMain, 100);
        }
    };
    
    waitForMain();
};

// Function to hide all menu screens
function hideAllMenuScreens() {
    const menuScreens = ['main-menu', 'play-submenu', 'level-select', 'settings', 'credits', 'instructions', 'pause-menu'];
    menuScreens.forEach(screenId => {
        const screen = document.getElementById(screenId);
        if (screen) {
            screen.classList.add('hidden');
        }
    });
}

// ---------- Pause Menu Functions ----------
let isGamePaused = false;
let currentPausedLevel = null;
let settingsReturnContext = null; // Track where settings was accessed from

// Function to show pause menu
window.showPauseMenu = function(levelNumber = null) {
    console.log('showPauseMenu called with levelNumber:', levelNumber);
    isGamePaused = true;
    currentPausedLevel = levelNumber;
    
    // Hide all other menus
    hideAllMenuScreens();
    
    // Show pause menu
    const pauseMenu = document.getElementById('pause-menu');
    console.log('Pause menu element found:', !!pauseMenu);
    if (pauseMenu) {
        pauseMenu.classList.remove('hidden');
        console.log('Pause menu should be visible now');
        createMenuParticles();
    } else {
        console.error('Pause menu element not found!');
    }
    
    // Pause the game loop if it exists
    if (window.pauseGameLoop) {
        console.log('Pausing game loop...');
        window.pauseGameLoop();
    } else {
        console.log('pauseGameLoop function not available');
    }
};

// Function to resume game
window.resumeGame = function() {
    isGamePaused = false;
    
    // Hide pause menu
    const pauseMenu = document.getElementById('pause-menu');
    if (pauseMenu) {
        pauseMenu.classList.add('hidden');
    }
    
    // Resume the game loop if it exists
    if (window.resumeGameLoop) {
        window.resumeGameLoop();
    }
    
    // Clear paused level reference
    currentPausedLevel = null;
};

// Function to restart current level
window.restartLevel = function() {
    if (currentPausedLevel) {
        // Resume first to clean up
        window.resumeGame();
        
        // Restart the level
        if (window.loadLevel) {
            window.loadLevel(currentPausedLevel);
        }
    } else {
        // If no specific level, just resume
        window.resumeGame();
    }
};

// Function to return to main menu from pause
window.returnToMainMenuFromPause = function() {
    // Resume first to clean up
    window.resumeGame();
    
    // Return to main menu - use appropriate function based on context
    if (currentPausedLevel === 'main') {
        // If we were in Story Mode, use the special return function
        if (window.returnToMainMenuFromStory) {
            window.returnToMainMenuFromStory();
        } else {
            window.showMainMenu();
        }
    } else {
        // If we were in a level, use the normal return function
        if (window.returnToMainMenu) {
            window.returnToMainMenu();
        } else {
            window.showMainMenu();
        }
    }
};

// Function to check if game is paused
window.isGamePaused = function() {
    return isGamePaused;
};

// Function to return from settings to the appropriate screen
window.returnFromSettings = function() {
    if (settingsReturnContext === 'pause') {
        // Return to pause menu
        showPauseMenu(currentPausedLevel);
    } else {
        // Return to main menu
        showMainMenu();
    }
    settingsReturnContext = null; // Reset context
};

// Function to create floating particles for menu screens
function createMenuParticles() {
    const currentScreen = document.querySelector('.menu-screen:not(.hidden)');
    if (!currentScreen) return;
    
    const particlesContainer = currentScreen.querySelector('.menu-particles');
    if (!particlesContainer) return;
    
    // Clear existing particles
    particlesContainer.innerHTML = '';
    
    // Create new particles
    for (let i = 0; i < 15; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 6 + 's';
        particle.style.animationDuration = (4 + Math.random() * 4) + 's';
        particlesContainer.appendChild(particle);
    }
}

// Function to start a level
window.startLevel = function(levelNumber) {
    hideAllMenuScreens();
    
    // Start the level - loadLevel will handle showing the canvas
    if (window.loadLevel) {
        window.loadLevel(levelNumber);
    } else {
        console.error('loadLevel function not available');
        alert('Error: Cannot load level. Please refresh the page.');
    }
};

// ---------- Settings Functions ----------
function setupSettingsHandlers() {
    // Volume slider
    const volumeSlider = document.getElementById('master-volume');
    const volumeDisplay = document.getElementById('volume-display');
    if (volumeSlider && volumeDisplay) {
        volumeSlider.addEventListener('input', (e) => {
            volumeDisplay.textContent = e.target.value + '%';
            // Here you would apply the volume setting to the game
        });
    }
    
    // Mouse sensitivity slider
    const sensitivitySlider = document.getElementById('mouse-sensitivity');
    const sensitivityDisplay = document.getElementById('sensitivity-display');
    if (sensitivitySlider && sensitivityDisplay) {
        sensitivitySlider.addEventListener('input', (e) => {
            sensitivityDisplay.textContent = e.target.value;
            // Here you would apply the sensitivity setting to the game
        });
    }
}

// Toggle functions for settings
window.toggleFullscreen = function() {
    const button = event.target;
    if (button.textContent === 'OFF') {
        button.textContent = 'ON';
        button.style.background = 'rgba(0, 255, 0, 0.3)';
        // Here you would enable fullscreen
    } else {
        button.textContent = 'OFF';
        button.style.background = 'rgba(255, 0, 0, 0.3)';
        // Here you would disable fullscreen
    }
};

window.toggleSoundEffects = function() {
    const button = event.target;
    if (button.textContent === 'ON') {
        button.textContent = 'OFF';
        button.style.background = 'rgba(255, 0, 0, 0.3)';
        // Here you would disable sound effects
    } else {
        button.textContent = 'ON';
        button.style.background = 'rgba(0, 255, 0, 0.3)';
        // Here you would enable sound effects
    }
};

// ---------- Intro Screen Management ----------
let introCompleted = false;
let introTimeout = null;

// Function to skip intro (called from HTML button)
window.skipIntro = function() {
    if (!introCompleted) {
        introCompleted = true;
        if (introTimeout) {
            clearTimeout(introTimeout);
        }
        hideIntroScreen();
    }
};

// Function to hide intro screen and start main menu
function hideIntroScreen() {
    const introScreen = document.getElementById('intro-screen');
    if (introScreen) {
        introScreen.classList.add('fade-out');
        // Wait for fade animation to complete, then remove element and show main menu
        setTimeout(() => {
            introScreen.remove();
            showMainMenu();
        }, 1000);
    } else {
        // If intro screen is already gone, just show main menu
        showMainMenu();
    }
}

// Function to show intro screen
function showIntroScreen() {
    const introScreen = document.getElementById('intro-screen');
    if (introScreen) {
        // Create floating particles for ambiance
        createFloatingParticles();
        
        // Auto-hide intro after 6 seconds (allows loading bar to complete)
        introTimeout = setTimeout(() => {
            if (!introCompleted) {
                introCompleted = true;
                hideIntroScreen();
            }
        }, 6000);
    } else {
        // If no intro screen found, start game immediately
        showMainMenu();
    }
}

// Function to create floating particles for intro
function createFloatingParticles() {
    const introScreen = document.getElementById('intro-screen');
    if (!introScreen) return;
    
    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 6 + 's';
        particle.style.animationDuration = (4 + Math.random() * 4) + 's';
        introScreen.appendChild(particle);
    }
}

// Initialize intro screen when page loads
document.addEventListener('DOMContentLoaded', function() {
    showIntroScreen();
});
