// Timmy's Lost Treasure - Menu Navigation System

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
        
        // Play main menu music
        if (window.audioManager) {
            // Register main menu music if not already registered
            if (!window.audioManager.musicTracks['mainmenu']) {
                window.audioManager.registerMusic('mainmenu', 'assets/audio/music/SalmonLikeTheFish - Glacier.mp3', true);
            }
            window.audioManager.playMusic('mainmenu');
        }
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

// Function to show settings (now handled by SettingsMenu module)
// This is kept for backwards compatibility but will be handled by the SettingsMenu module
window.showSettings = function() {
    // The SettingsMenu module will handle this
    if (window.settingsMenu && window.settingsMenu.show) {
        window.settingsMenu.show();
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

// Function to show cinematic credits
window.showCinematicCredits = function() {
    hideAllMenuScreens();
    const cinematicCredits = document.getElementById('cinematic-credits');
    if (cinematicCredits) {
        cinematicCredits.classList.remove('hidden');
        currentMenuScreen = 'cinematic-credits';
        window.creditsStartTime = Date.now(); // Track start time
        
        // Stop all other music (especially mainmenu) and play credits music
        if (window.audioManager) {
            // Explicitly stop mainmenu music first to ensure it stops
            window.audioManager.stopMusic('mainmenu');
            // Stop all music to ensure clean state
            window.audioManager.stopMusic();
            // Register credits music if not already registered
            if (!window.audioManager.musicTracks['credits']) {
                window.audioManager.registerMusic('credits', 'assets/audio/music/Grzegorz Rusin - The end.mp3', true);
            }
            // Small delay to ensure mainmenu music fully stops before playing credits music
            setTimeout(() => {
                window.audioManager.playMusic('credits');
            }, 100);
        }
        
        // Initialize speed display
        const speedSlider = document.getElementById('credits-speed-slider');
        if (speedSlider) {
            updateCreditsSpeed(speedSlider.value);
        }
        
        startCinematicCredits();
    }
};

// Global variable to store credits timeout
let creditsTimeout = null;
let currentCreditsSpeed = 55; // Default speed in seconds (100 - 45 = 55, so slider at 45 gives 55s duration)

// Function to start cinematic credits animation
function startCinematicCredits() {
    const creditsContainer = document.querySelector('.credits-container');
    if (creditsContainer) {
        // Reset animation
        creditsContainer.style.animation = 'none';
        creditsContainer.offsetHeight; // Trigger reflow
        creditsContainer.style.animation = `creditsScroll ${currentCreditsSpeed}s linear forwards`;
        
        // Clear any existing timeout
        if (creditsTimeout) {
            clearTimeout(creditsTimeout);
        }
        
        // Auto-return to main menu after credits finish
        creditsTimeout = setTimeout(() => {
            if (currentMenuScreen === 'cinematic-credits') {
                // Stop credits music before skipping
                if (window.audioManager) {
                    window.audioManager.stopMusic('credits');
                }
                skipCinematicCredits();
            }
        }, currentCreditsSpeed * 1000); // Convert seconds to milliseconds
    }
}

// Function to update credits speed
window.updateCreditsSpeed = function(speed) {
    const sliderValue = parseInt(speed);
    // Invert the speed: lower slider values = faster scroll (shorter duration)
    // 10 = 10s (very fast), 90 = 10s (very slow)
    currentCreditsSpeed = 100 - sliderValue;
    
    const speedDisplay = document.getElementById('speed-display');
    const creditsContainer = document.querySelector('.credits-container');
    
    // Update speed display text (flipped logic: lower values = slower, higher values = faster)
    if (speedDisplay) {
        if (sliderValue <= 20) {
            speedDisplay.textContent = 'Very Slow';
        } else if (sliderValue <= 30) {
            speedDisplay.textContent = 'Slow';
        } else if (sliderValue <= 50) {
            speedDisplay.textContent = 'Normal';
        } else if (sliderValue <= 70) {
            speedDisplay.textContent = 'Fast';
        } else {
            speedDisplay.textContent = 'Very Fast';
        }
    }
    
    // Update animation if credits are currently playing
    if (creditsContainer && currentMenuScreen === 'cinematic-credits') {
        // Get current animation progress
        const computedStyle = window.getComputedStyle(creditsContainer);
        const animationName = computedStyle.animationName;
        
        if (animationName === 'creditsScroll') {
            // Calculate how much of the animation has already completed
            const elapsed = (Date.now() - (window.creditsStartTime || Date.now())) / 1000;
            const oldDuration = parseFloat(computedStyle.animationDuration) || 45;
            const progressRatio = Math.min(elapsed / oldDuration, 1); // Cap at 1.0
            
            // Restart animation with new speed
            creditsContainer.style.animation = 'none';
            creditsContainer.offsetHeight; // Trigger reflow
            creditsContainer.style.animation = `creditsScroll ${currentCreditsSpeed}s linear forwards`;
            
            // Update timeout - calculate remaining time based on new duration and current progress
            if (creditsTimeout) {
                clearTimeout(creditsTimeout);
            }
            
            // Calculate remaining time: new duration minus the time that would have passed at new speed
            const remainingTime = currentCreditsSpeed * (1 - progressRatio);
            
            creditsTimeout = setTimeout(() => {
                if (currentMenuScreen === 'cinematic-credits') {
                    // Stop credits music before skipping
                    if (window.audioManager) {
                        window.audioManager.stopMusic('credits');
                    }
                    skipCinematicCredits();
                }
            }, remainingTime * 1000);
        }
    }
};

// Function to skip cinematic credits
window.skipCinematicCredits = function() {
    const cinematicCredits = document.getElementById('cinematic-credits');
    if (cinematicCredits) {
        // Clear timeout
        if (creditsTimeout) {
            clearTimeout(creditsTimeout);
            creditsTimeout = null;
        }
        
        // Stop credits music
        if (window.audioManager) {
            window.audioManager.stopMusic('credits');
        }
        
        cinematicCredits.classList.add('hidden');
        showMainMenu();
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

// Function to start story mode (WITH CUTSCENE)
// -------------------------------------------------------------------
//  STORY MODE – CUTSCENE WITH SOUND
// -------------------------------------------------------------------
window.startStoryMode = function () {
    hideAllMenuScreens();
    
    // Stop any playing music when cutscene starts
    if (window.audioManager) {
        window.audioManager.stopMusic();
    }

    const screen   = document.getElementById('story-cutscene');
    const video    = document.getElementById('cutscene-video');
    const progress = document.getElementById('cutscene-progress-bar');
    const skipBtn  = document.getElementById('skip-cutscene');
    const unmuteBtn= document.getElementById('unmute-cutscene');

    if (!screen || !video) {
        console.warn('Cutscene elements missing – loading 3D directly');
        window.initMainMenu?.();
        return;
    }

    // ---- 0. CLEANUP: Remove any existing event listeners and reset state ----
    // Pause and reset video first
    video.pause();
    video.currentTime = 0;
    
    // Remove all event listeners by cloning handlers we can't easily remove
    // We'll use a flag to prevent old handlers from running
    if (video._cutsceneActive) {
        // Remove old listeners if they exist
        video.removeEventListener('timeupdate', video._cutsceneUpdate);
        video.onended = null;
        video.onclick = null;
    }
    
    // Clear any existing button handlers
    if (skipBtn) {
        skipBtn.onclick = null;
    }
    if (unmuteBtn) {
        unmuteBtn.onclick = null;
    }
    
    // Remove any existing keydown handlers (we'll track the current one)
    // Store reference to remove later
    
    // Remove 'ended' class from screen if it exists
    screen.classList.remove('ended', 'hidden');

    // ---- 1. Show the cutscene ------------------------------------------------
    screen.classList.remove('hidden');

    // ---- 2. Reset + start unmuted --------------------------------------------
    video.currentTime = 0;
    video.muted = false;
    video.load(); // Reload the video to reset state
    
    if (progress) {
        progress.style.width = '0%';
    }
    
    // Reset button states (video starts unmuted, so button shows "Mute")
    if (unmuteBtn) {
        unmuteBtn.textContent = 'Mute';
        unmuteBtn.disabled = false;
        unmuteBtn.style.opacity = '1';
    }

    // ---- 3. Progress bar ----------------------------------------------------
    const update = () => {
        if (video.duration && progress) {
            const pct = (video.currentTime / video.duration) * 100;
            progress.style.width = `${pct}%`;
        }
    };
    // Store reference for cleanup
    video._cutsceneUpdate = update;
    video._cutsceneActive = true;
    video.addEventListener('timeupdate', update);

    // ---- 4. UNMUTE/MUTE BUTTON (toggle functionality) ----------------------
    const toggleMute = () => {
        video.muted = !video.muted;
        if (unmuteBtn) {
            if (video.muted) {
                unmuteBtn.textContent = 'Unmute';
                unmuteBtn.style.opacity = '1';
            } else {
                unmuteBtn.textContent = 'Mute';
                unmuteBtn.style.opacity = '1';
            }
            // Button is always enabled so user can toggle
            unmuteBtn.disabled = false;
        }
    };
    if (unmuteBtn) {
        unmuteBtn.onclick = (e) => {
            e.stopPropagation(); // Prevent triggering screen click handler
            toggleMute();
        };
    }
    // Click on video to skip cutscene
    const videoClickHandler = (e) => {
        e.stopPropagation(); // Prevent triggering screen click handler
        finish();
    };
    video.onclick = videoClickHandler;

    // ---- 5. SKIP (any click, S key, button) ---------------------------------
    const finish = () => {
        // Clean up handlers
        video._cutsceneActive = false;
        screen.classList.add('ended', 'hidden');
        
        // Hide the cutscene overlay as well
        const overlay = document.querySelector('.cutscene-overlay');
        if (overlay) {
            overlay.style.display = 'none';
            overlay.style.opacity = '0';
        }
        
        // Hide the entire cutscene screen container
        const cutsceneScreen = document.querySelector('.cutscene-screen');
        if (cutsceneScreen) {
            cutsceneScreen.style.display = 'none';
            cutsceneScreen.classList.add('hidden');
        }
        
        video.pause();
        video.removeEventListener('timeupdate', update);
        video.onended = null;
        video.onclick = null;
        if (document._cutsceneKeyHandler) {
            document.removeEventListener('keydown', document._cutsceneKeyHandler);
            document._cutsceneKeyHandler = null;
        }
        // Stop all music before starting 3D hub world (basement music will start in initMainMenu)
        if (window.audioManager) {
            window.audioManager.stopMusic();
        }
        
        // → start the 3D hub world
        window.initMainMenu?.();
    };

    if (skipBtn) {
        skipBtn.onclick = (e) => {
            e.stopPropagation(); // Prevent triggering screen click handler
            finish();
        };
    }
    
    // Click anywhere on screen to skip (video click handled separately)
    const screenClickHandler = (e) => {
        // Skip if clicking on screen background or elements that aren't buttons
        const target = e.target;
        const isButton = target.closest('button');
        const isProgressBar = target.id === 'cutscene-progress-bar' || target.closest('#cutscene-progress-bar');
        
        // Skip if clicking directly on screen or non-interactive elements (video is handled by its own handler)
        if (!isButton && !isProgressBar) {
            finish();
        }
    };
    screen.onclick = screenClickHandler;
    
    // Also allow clicking on the progress bar area to skip
    if (progress) {
        progress.onclick = (e) => {
            e.stopPropagation(); // Prevent screen click handler
            finish();
        };
    }

    const keyHandler = (e) => { if (e.key.toLowerCase() === 's') finish(); };
    document._cutsceneKeyHandler = keyHandler; // Store reference for cleanup
    document.addEventListener('keydown', keyHandler);

    // ---- 6. Auto-finish when video ends ------------------------------------
    video.onended = () => setTimeout(finish, 400);
    
    // ---- 7. Start playing ------------------------------------
    // Wait a moment for video to load, then play
    video.addEventListener('loadeddata', () => {
        const playPromise = video.play();
        if (playPromise) {
            playPromise.catch((err) => {
                console.log('Video autoplay blocked or error:', err);
            });
        }
    }, { once: true });
    
    // Fallback: try to play after a short delay
    setTimeout(() => {
        if (video.readyState >= 2) { // HAVE_CURRENT_DATA or higher
            const playPromise = video.play();
            if (playPromise) {
                playPromise.catch((err) => {
                    console.log('Video play failed:', err);
                });
            }
        }
    }, 200);
};

// Function to hide all menu screens
function hideAllMenuScreens() {
    const menuScreens = ['main-menu', 'play-submenu', 'level-select', 'settings', 'credits', 'cinematic-credits', 'instructions', 'pause-menu', 'story-cutscene'];
    menuScreens.forEach(screenId => {
        const screen = document.getElementById(screenId);
        if (screen) {
            screen.classList.add('hidden');
        }
    });
}

// Make hideAllMenuScreens available globally
window.hideAllMenuScreens = hideAllMenuScreens;

// ---------- Pause Menu Functions ----------
// Pause menu functionality has been moved to src/pause/PauseMenu.js
// The PauseMenu module will create these global functions

// Backwards compatibility - these functions are now handled by PauseMenu module
// They will be overridden when PauseMenu.init() is called in main.js

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
// Settings functionality has been moved to src/settings/SettingsMenu.js
// The SettingsMenu module will create these global functions

// Backwards compatibility - these functions are now handled by SettingsMenu module
// They will be overridden when SettingsMenu.init() is called in main.js

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
    
    // Add keyboard event listener for skipping cinematic credits
    document.addEventListener('keydown', function(event) {
        if (currentMenuScreen === 'cinematic-credits' && event.key === 'Escape') {
            skipCinematicCredits();
        }
    });
});
