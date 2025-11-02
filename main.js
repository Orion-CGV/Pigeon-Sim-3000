// Import the Three.js library for 3D graphics
import * as THREE from 'three';
// Import CSS2D renderer for HTML labels that stay facing the camera
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
// Import player system
import { PlayerSystem } from './src/player/PlayerSystem.js';
// Import environment loader
import { EnvironmentLoader } from './src/environment/EnvironmentLoader.js';
// Import lighting system
import { LightingSystem } from './src/lighting/LightingSystem.js';
// Import interaction system
import { InteractionSystem } from './src/interaction/InteractionSystem.js';
// Import camera control system
import { CameraControl } from './src/camera/CameraControl.js';
// Import input system
import { InputSystem } from './src/input/InputSystem.js';
// Import pause menu system
import { PauseMenu } from './src/pause/PauseMenu.js';
// Import settings menu system
import { SettingsMenu } from './src/settings/SettingsMenu.js';
// Import story system
import { StorySystem } from './src/story/StorySystem.js';
// Import story UI
import { StoryUI } from './src/story/StoryUI.js';
// Import treasure interaction system
import { TreasureInteractionSystem } from './src/interaction/TreasureInteractionSystem.js';
// Import second chest interaction system
import { SecondChestInteractionSystem } from './src/interaction/SecondChestInteractionSystem.js';
// Import inventory system
import { InventorySystem } from './src/inventory/InventorySystem.js';
// Import mirror system
import { MirrorSystem } from './src/environment/MirrorSystem.js';
// Import audio manager
import { AudioManager } from './src/audio/AudioManager.js';
// Import warp effect system
import { WarpEffectSystem } from './src/effects/WarpEffectSystem.js';
// Import subtitle system
import { SubtitleSystem } from './src/ui/SubtitleSystem.js';
// Import loading spinner
import { LoadingSpinner } from './src/ui/LoadingSpinner.js';

// ---------- Scene / Camera / Renderer ----------
// Global variables to store our 3D environment components
let scene;     // The 3D scene that contains all objects
let camera;    // The virtual camera that defines our view
let renderer;  // The WebGL renderer that draws the 3D scene
let labelRenderer; // Special renderer for HTML text labels
const clock = new THREE.Clock(); // Clock for tracking time between frames

// ---------- Game State ----------
// Tracks which level we're currently in
let currentLevel = 'main'; // Can be 'main', 'level1', 'level2', 'level3'
// Tracks whether we're in Story Mode (3D hub world)
let isInStoryMode = false; // Flag for 3D hub world vs HTML menu

// ---------- Player System ----------
let playerSystem = null; // Player system instance

// ---------- Environment Loader ----------
let environmentLoader = null; // Environment loader instance
let showCollisionHelpers = false; // Toggle for collision visualization

// ---------- Lighting System ----------
let lightingSystem = null; // Lighting system instance

// ---------- Mirror System ----------
let mirrorSystem = null; // Mirror system instance

// ---------- Interaction System ----------
let interactionSystem = null; // Interaction system instance

// ---------- Camera Control System ----------
let cameraControl = null; // Camera control system instance

// ---------- Pause Menu System ----------
let pauseMenu = null; // Pause menu system instance

// ---------- Settings Menu System ----------
let settingsMenu = null; // Settings menu system instance

// ---------- Story System ----------
let storySystem = null; // Story system instance
let storyUI = null; // Story UI instance

// ---------- Inventory System ----------
let inventorySystem = null; // Inventory system instance

// ---------- Treasure Interaction System ----------
let treasureInteractionSystem = null; // Treasure interaction system instance

// ---------- Second Chest Interaction System ----------
let secondChestInteractionSystem = null; // Second chest interaction system instance

// ---------- Audio Manager ----------
let audioManager = null; // Audio manager instance

// ---------- Warp Effect System ----------
let warpEffectSystem = null; // Warp effect system instance

// ---------- Subtitle System ----------
let subtitleSystem = null; // Subtitle system instance

// ---------- Loading Spinner ----------
let loadingSpinner = null; // Loading spinner instance

// ---------- Intro Animation ----------
let hasPlayedIntroAnimation = false; // Track if intro animation has played

// ---------- Loading State ----------
let isPlayerLoaded = false; // Track if player has finished loading
let isEnvironmentLoaded = false; // Track if environment has finished loading

// Initializes the main menu/hub world where player selects levels
function initMainMenu() {
    // Set Story Mode flag to true (we're entering 3D hub world)
    isInStoryMode = true;
    
    // Clean up any existing systems first (but don't clear scene if it doesn't exist)
    // Only cleanup if we have systems that need cleaning
    if (inputSystem || cameraControl || interactionSystem || lightingSystem || playerSystem || environmentLoader) {
        // Stop animation loop first
        if (renderer) {
            renderer.setAnimationLoop(null);
        }
        
        // Cleanup systems individually to avoid errors
        if (interactionSystem) {
            interactionSystem.cleanup();
            interactionSystem = null;
        }
        if (cameraControl) {
            cameraControl.cleanup();
            cameraControl = null;
        }
        if (inputSystem) {
            inputSystem.cleanup();
            inputSystem = null;
        }
        if (lightingSystem) {
            lightingSystem.cleanup();
            lightingSystem = null;
        }
        playerSystem = null;
        environmentLoader = null;
        
        // Reset loading flags
        isPlayerLoaded = false;
        isEnvironmentLoaded = false;
    }
    
    // Clean up any existing scene first
    if (scene) {
        // Stop and clear animation mixer if it exists
        if (scene.userData.playerMixer) {
            scene.userData.playerMixer.stopAllAction();
            scene.userData.playerMixer = null;
        }
        // Clear all objects from the scene
        while(scene.children.length > 0) {
            // Remove each child object from scene
            scene.remove(scene.children[0]);
        }
        // Clear userData
        scene.userData = {};
    }
    
    // If returning from a level, the scene/renderer might be null, so recreate them
    // Check if WebGL renderer doesn't exist yet
    if (!renderer) {
        // Create WebGL renderer with antialiasing for smoother edges
        renderer = new THREE.WebGLRenderer({ antialias: true });
        // Set renderer size to match browser window
        renderer.setSize(window.innerWidth, window.innerHeight);
        // Enable shadow mapping for realistic shadows
        renderer.shadowMap.enabled = true;
        // Use soft shadow mapping for better quality shadows
        renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
        // Add the renderer's canvas element to the webpage
        document.body.appendChild(renderer.domElement);
    }
    // Check if CSS label renderer doesn't exist yet
    if (!labelRenderer) {
        // Create renderer for HTML-based text labels
        labelRenderer = new CSS2DRenderer();
        // Set label renderer size to match window
        labelRenderer.setSize(window.innerWidth, window.innerHeight);
        // Style the label container to overlay on top of 3D scene
        labelRenderer.domElement.style.position = 'absolute';
        labelRenderer.domElement.style.top = '0px';
        // Prevent labels from blocking mouse events
        labelRenderer.domElement.style.pointerEvents = 'none';
        // Add label container to webpage
        document.body.appendChild(labelRenderer.domElement);
    }

    // Create a new 3D scene (container for all 3D objects)
    scene = new THREE.Scene();
    // Create perspective camera (mimics human vision with perspective distortion)
    camera = new THREE.PerspectiveCamera(
        75, // Field of view in degrees (wider = more visible)
        window.innerWidth / window.innerHeight, // Aspect ratio (width/height)
        0.1, // Near clipping plane (objects closer than this are invisible)
        1000 // Far clipping plane (objects farther than this are invisible)
    );

    // Start the animation loop that updates and renders the scene continuously
    gameLoopActive = true;
    // Set animation loop to our animate function
    renderer.setAnimationLoop(animate);

    // ---------- Lighting ----------
    // Initialize lighting system
    lightingSystem = new LightingSystem(scene);
    lightingSystem.init();

    // ---------- Resize ----------
    // Add event listener to handle browser window resizing
    window.addEventListener("resize", onWindowResize);

    // ---------- Player ----------
    // Initialize player system
    playerSystem = new PlayerSystem(scene, camera, clock);
    
    // Reset loading state
    isPlayerLoaded = false;
    isEnvironmentLoaded = false;
    
    // ---------- Loading Spinner ----------
    // Initialize loading spinner
    if (!loadingSpinner) {
        loadingSpinner = new LoadingSpinner();
        loadingSpinner.init();
    }
    // Expose loading spinner globally
    window.loadingSpinner = loadingSpinner;
    
    // Show loading spinner when starting to load models
    loadingSpinner.show();
    
    // Load player with callback
    playerSystem.loadPlayer(() => {
        isPlayerLoaded = true;
        checkIfEverythingLoaded();
    });

    // ---------- Environment Loading ----------
    // Initialize environment loader
    environmentLoader = new EnvironmentLoader(scene, labelRenderer);
    
           // Set callback to setup model lights and mark environment as loaded after basement loads
           environmentLoader.setOnBasementLoaded(() => {
               if (lightingSystem) {
                   lightingSystem.setupModelLights();
               }
               // Calculate room bounds for camera after walls are loaded
               if (cameraControl) {
                   cameraControl.calculateRoomBounds();
               }
               // Reinitialize treasure system now that basement (and treasure) has loaded
               if (treasureInteractionSystem) {
                   treasureInteractionSystem.scene = scene; // Ensure scene reference is current
                   treasureInteractionSystem.init();
               }
               // Reinitialize mirror system now that basement (and mirror) has loaded
               if (mirrorSystem) {
                   mirrorSystem.init();
               }
               isEnvironmentLoaded = true;
               checkIfEverythingLoaded();
           });
    
    // Load basement (includes arcades within it)
    environmentLoader.loadBasement(null, showCollisionHelpers);

    // ---------- Camera Control ----------
    // Ensure pointer lock is unlocked before reinitializing
    if (document.pointerLockElement) {
        document.exitPointerLock();
    }
    
    // Initialize camera control system
    cameraControl = new CameraControl(scene, camera, renderer);
    cameraControl.init();
    
    // Ensure renderer canvas is visible and ready for pointer lock
    if (renderer && renderer.domElement) {
        renderer.domElement.style.display = 'block';
        renderer.domElement.style.pointerEvents = 'auto';
    }
    
    // Ensure player is unlocked when returning from a level
    if (scene) {
        scene.userData.playerLocked = false;
        scene.userData.lockedPlayerPosition = null;
    }

    // ---------- Story System ----------
    // Initialize story system (or reuse existing one in Story Mode)
    if (!storySystem) {
        storySystem = new StorySystem(scene);
        storySystem.init();
    } else {
        // Reuse existing story system, just update scene reference
        storySystem.scene = scene;
        if (scene) {
            scene.userData.storySystem = storySystem;
        }
    }
    
    // Initialize story UI (or reuse existing one in Story Mode)
    if (!storyUI) {
        storyUI = new StoryUI();
        storyUI.init();
        storyUI.setStorySystem(storySystem);
        storyUI.show(); // Show story objectives by default
    } else {
        // Reuse existing story UI - ensure UI is created and visible
        if (!storyUI.uiElement || !storyUI.uiElement.parentNode) {
            storyUI.init(); // Recreate UI if it was removed
        }
        storyUI.setStorySystem(storySystem);
        storyUI.update();
        storyUI.show(); // Ensure it's visible when returning from a level
    }
    
    // ---------- Warp Effect System ----------
    // Initialize warp effect system
    warpEffectSystem = new WarpEffectSystem(scene, camera, playerSystem);
    warpEffectSystem.init();
    
    // ---------- Interaction System ----------
    // Initialize interaction system
    interactionSystem = new InteractionSystem(scene, camera);
    interactionSystem.init();
    
    // Set callback for when player interacts with an arcade machine
    interactionSystem.setOnInteract((level) => {
        // Get the arcade object for warp target
        const arcadeObject = interactionSystem.getCurrentInteractable();
        
        // Start warp animation, then load level when complete
        if (warpEffectSystem && !warpEffectSystem.isWarpActive()) {
            warpEffectSystem.startWarp(() => {
                // Warp complete - now load the level
                loadLevel(level);
            }, arcadeObject);
        } else {
            // Fallback: load immediately if warp system not available
            loadLevel(level);
        }
    });
    
    // ---------- Inventory System ----------
    // Initialize inventory system (or reuse existing one in Story Mode)
    if (!inventorySystem) {
        inventorySystem = new InventorySystem();
        inventorySystem.init();
    } else {
        // Reuse existing inventory system - ensure UI is created and visible
        if (!inventorySystem.uiElement || !inventorySystem.uiElement.parentNode) {
            inventorySystem.createUI();
        }
        inventorySystem.updateUI(); // Update to show any preserved items
    }
    // Always show inventory UI (even if reusing existing one)
    if (inventorySystem) {
        inventorySystem.show(); // Show inventory UI
    }
    
    // ---------- Treasure Interaction System ----------
    // Initialize treasure interaction system (or reuse existing one in Story Mode)
    if (!treasureInteractionSystem) {
        treasureInteractionSystem = new TreasureInteractionSystem(
            scene, 
            camera, 
            cameraControl, 
            storySystem, 
            storyUI,
            inventorySystem // Pass inventory system
        );
        treasureInteractionSystem.init();
    } else {
        // Reuse existing system, update scene reference and reinitialize
        treasureInteractionSystem.scene = scene; // Update scene reference (important after level return)
        treasureInteractionSystem.camera = camera; // Update camera reference
        treasureInteractionSystem.cameraControl = cameraControl; // Update camera control reference
        treasureInteractionSystem.inventorySystem = inventorySystem; // Update inventory reference
        treasureInteractionSystem.init();
    }
    
    // Store treasure system in scene for easy access
    scene.userData.treasureInteractionSystem = treasureInteractionSystem;
    
    // Set callback for when player interacts with treasure chest
    interactionSystem.setOnTreasureInteract(() => {
        if (treasureInteractionSystem) {
            treasureInteractionSystem.handleInteraction();
        }
    });
    
    // ---------- Second Chest Interaction System ----------
    // Initialize second chest interaction system (or reuse existing one in Story Mode)
    if (!secondChestInteractionSystem) {
        secondChestInteractionSystem = new SecondChestInteractionSystem(
            scene, 
            camera, 
            cameraControl, 
            storySystem, 
            storyUI
        );
        secondChestInteractionSystem.init();
    } else {
        // Reuse existing system, update scene reference and reinitialize
        secondChestInteractionSystem.scene = scene;
        secondChestInteractionSystem.camera = camera;
        secondChestInteractionSystem.cameraControl = cameraControl;
        secondChestInteractionSystem.storySystem = storySystem;
        secondChestInteractionSystem.storyUI = storyUI;
        secondChestInteractionSystem.init();
    }
    
    // Store second chest system in scene for easy access
    scene.userData.secondChestInteractionSystem = secondChestInteractionSystem;

    // ---------- Mirror System ----------
    // Initialize mirror system (finds Mirror_Face object and sets up render-to-texture)
    if (!mirrorSystem) {
        mirrorSystem = new MirrorSystem(scene, camera, renderer);
        mirrorSystem.init();
    } else {
        // Reuse existing mirror system, update references
        mirrorSystem.scene = scene;
        mirrorSystem.mainCamera = camera;
        mirrorSystem.renderer = renderer;
        mirrorSystem.init(); // Reinitialize to find mirror in new scene
    }
    
    // ---------- Pause Menu System ----------
    // Only create pause menu if it doesn't exist (preserve across level loads)
    if (!pauseMenu) {
        pauseMenu = new PauseMenu();
        pauseMenu.init();
    }
    // Make pauseMenu globally accessible for levels
    window.pauseMenu = pauseMenu;
    
    // Set callbacks for pause menu actions
    pauseMenu.setOnResume(() => {
        // Resume callback - game loop will resume automatically
    });
    
    pauseMenu.setOnRestart((levelNumber) => {
        // Restart callback
        if (levelNumber === 'main') {
            cleanupCurrentLevel();
            initMainMenu();
        } else {
            // Extract level number from "level2" format to just "2"
            // Handle both string "level2" and number 2
            let levelNum;
            if (typeof levelNumber === 'string' && levelNumber.startsWith('level')) {
                levelNum = parseInt(levelNumber.replace('level', ''));
            } else if (typeof levelNumber === 'number') {
                levelNum = levelNumber;
            } else {
                // Fallback: try to parse as number
                levelNum = parseInt(levelNumber);
            }
            console.log(`🔄 Restarting level: ${levelNumber} -> ${levelNum}`);
            
            // Special handling for level 2 - use its restart function (deferred to avoid animation loop conflicts)
            if (levelNum === 2 && currentLevelModule && currentLevelModule.restartLevel) {
                console.log('🔄 Using level 2 restart function');
                // Defer restart to prevent FPS doubling (see BUG.md)
                setTimeout(() => {
                    currentLevelModule.restartLevel();
                }, 0);
            } else if (levelNum && !isNaN(levelNum)) {
                // For other levels, reload completely (loadLevel already defers internally)
                loadLevel(levelNum);
            } else {
                console.error('⚠️ Invalid level number for restart:', levelNumber);
            }
        }
    });
    
    pauseMenu.setOnReturnToMenu((levelNumber) => {
        // Return to menu callback
        if (levelNumber === 'main') {
            returnToMainMenuFromStory();
        } else {
            returnToMainMenu();
        }
    });
    
    // ---------- Settings Menu System ----------
    // Only create new settings menu if one doesn't exist
    // (It may have been initialized early for HTML main menu access)
    if (!settingsMenu) {
        settingsMenu = new SettingsMenu();
        settingsMenu.init();
    } else {
        // Re-initialize to ensure handlers are set up
        settingsMenu.init();
    }
    
    // Expose settings menu globally for menu.js access
    window.settingsMenu = settingsMenu;
    
    // ---------- Audio Manager ----------
    // Only create new audio manager if one doesn't exist
    // (It may have been initialized early for direct level loading)
    if (!audioManager) {
        audioManager = new AudioManager();
        audioManager.init(settingsMenu);
    } else {
        // Re-initialize to ensure handlers are set up
        audioManager.init(settingsMenu);
    }
    
    // Register music tracks (idempotent - won't re-register if already registered)
    audioManager.registerMusic('basement', 'assets/audio/music/Fabian Measures - Did you know_ (Curiouser and curiouser).mp3', true);
    audioManager.registerMusic('mainmenu', 'assets/audio/music/SalmonLikeTheFish - Glacier.mp3', true);
    audioManager.registerMusic('credits', 'assets/audio/music/Grzegorz Rusin - The end.mp3', true);
    
    // Register sound effects (idempotent - won't re-register if already registered)
    audioManager.registerSoundEffect('chestOpen', 'assets/audio/effects/ChestOpen.mp3', 0.5);
    audioManager.registerSoundEffect('footstep', 'assets/audio/effects/footstep.wav', 0.1);
    audioManager.registerSoundEffect('warp', 'assets/audio/effects/warp.wav', 0.3);
    
    // Expose audio manager globally
    window.audioManager = audioManager;
    
    // Set callback for returning from settings
    settingsMenu.setOnReturn((context) => {
        if (context === 'pause') {
            // Return to pause menu
            const pausedLevel = pauseMenu.getCurrentLevel();
            pauseMenu.show(pausedLevel);
        } else {
            // Return to main menu
            if (window.showMainMenu) {
                window.showMainMenu();
            }
        }
    });
    
    // Set callback for sensitivity changes to update camera control
    settingsMenu.setOnSensitivityChange((sensitivity) => {
        if (cameraControl) {
            // Update camera control sensitivity
            cameraControl.setMouseSensitivity(sensitivity);
        }
    });
    
    // Apply saved sensitivity setting on initialization
    const savedSettings = settingsMenu.getSettings();
    if (cameraControl && savedSettings.mouseSensitivity) {
        cameraControl.setMouseSensitivity(savedSettings.mouseSensitivity);
    }
    
    // ---------- Input System ----------
    // Initialize input system
    inputSystem = new InputSystem();
    inputSystem.init();
    
    // Set callback for ESC key (pause menu)
    inputSystem.setOnEscape(() => {
        // Check if game is already paused
        if (pauseMenu && pauseMenu.isPaused()) {
            // If already paused, resume
            pauseMenu.resume();
        } else {
            // Show pause menu
            // Determine which type of pause menu to show based on current level
            if (currentLevel === 'main') {
                pauseMenu.show('main');
            } else if (currentLevelModule) {
                // Extract level number from currentLevel (e.g., 'level1' -> 1)
                const levelNumber = currentLevel.replace('level', '');
                pauseMenu.show(parseInt(levelNumber));
            } else {
                pauseMenu.show();
            }
        }
    });

    // Set callback for F2 key (collision helpers toggle)
    inputSystem.setOnF2(() => {
        if (environmentLoader) {
            showCollisionHelpers = !showCollisionHelpers;
            environmentLoader.toggleCollisionHelpers(showCollisionHelpers);
        }
    });
    
    // Add global E key handler for treasure viewing mode exit
    // This allows pressing E to exit viewing mode even when not looking at treasure
    document.addEventListener('keydown', (e) => {
        if (currentLevel === 'main' && e.key.toLowerCase() === 'e' && !e.repeat) {
            // Check if we're in treasure viewing mode
            if (treasureInteractionSystem && treasureInteractionSystem.isViewingMode()) {
                treasureInteractionSystem.exitViewingMode();
                e.preventDefault();
            }
        }
    });
    
    // Add global F3 key handler for cheat - complete current level
    document.addEventListener('keydown', (e) => {
        // F3 key cheat: Complete current level and advance story
        if (e.key === 'F3' || e.keyCode === 114) {
            e.preventDefault();
            
            // Only work when in a level (not in main menu)
            if (currentLevel !== 'main' && currentLevelReturnCallback) {
                const levelMatch = currentLevel.match(/level(\d+)/);
                if (levelMatch) {
                    const levelNum = parseInt(levelMatch[1]);
                    console.log(`🎮 F3 Cheat: Completing Level ${levelNum}...`);
                    
                    // Call the return callback which will mark level as complete and return to main
                    currentLevelReturnCallback();
                }
            }
        }
    });

    // ---------- Camera ----------
    // Position camera above and behind player
    camera.position.set(0, 5, 10);
    
    // ---------- Music ----------
    // Stop ALL music first to prevent any overlap (especially mainmenu music)
    // Then start playing basement music on loop
    if (audioManager) {
        // Stop all music (including mainmenu) to ensure clean state before entering basement
        audioManager.stopMusic();
        // Small delay to ensure stop completes before starting new music
        setTimeout(() => {
            audioManager.playMusic('basement');
        }, 100);
    }
    
    // ---------- Subtitle System ----------
    // Initialize subtitle system
    if (!subtitleSystem) {
        subtitleSystem = new SubtitleSystem();
        subtitleSystem.init();
    }
    // Expose subtitle system globally for easy access from anywhere
    window.subtitleSystem = subtitleSystem;
}

/**
 * Checks if everything has finished loading and enables player movement
 */
function checkIfEverythingLoaded() {
    if (isPlayerLoaded && isEnvironmentLoaded) {
        // Everything is loaded, player can now move
        scene.userData.gameReady = true;
        
        // Hide loading spinner before playing intro animation
        if (loadingSpinner) {
            loadingSpinner.hide();
        }
        
        // Play intro animation on first spawn in basement
        if (!hasPlayedIntroAnimation && isInStoryMode) {
            // Small delay to ensure spinner fade-out completes
            setTimeout(() => {
                playIntroAnimation();
                hasPlayedIntroAnimation = true;
            }, 300);
        }
    }
}

/**
 * Plays the intro camera animation when first spawning in the basement
 * Camera spins around the character showing the basement behind him
 */
function playIntroAnimation() {
    const player = scene.getObjectByName('player');
    if (!player || !camera || typeof gsap === 'undefined') {
        console.warn('⚠️ Cannot play intro animation - missing player, camera, or GSAP');
        return;
    }
    
    // Lock player during animation so they don't move
    scene.userData.playerLocked = true;
    scene.userData.lockedPlayerPosition = player.position.clone();
    
    // Temporarily disable pointer lock to prevent camera control during animation
    if (document.pointerLockElement) {
        document.exitPointerLock();
    }
    
    // Show subtitle
    if (window.subtitleSystem) {
        console.log('📝 Showing subtitle via subtitleSystem...');
        window.subtitleSystem.show("So this is where grandpa hid his treasure?", 7);
    } else {
        console.warn('⚠️ window.subtitleSystem is not available for intro animation');
    }
    
    // Store initial camera position (normal starting position)
    const startCameraPos = new THREE.Vector3(0, 5, 10);
    const playerPos = player.position.clone();
    playerPos.y += 1.5; // Look at player's head height
    
    // Set initial camera position
    camera.position.copy(startCameraPos);
    camera.lookAt(playerPos);
    
    // Animation parameters
    const animationDuration = 4; // 4 seconds
    const orbitRadius = 4; // Distance from player
    const orbitHeight = 5; // Height of camera
    
    // Calculate start angle from initial camera position
    const startAngle = Math.atan2(startCameraPos.x - playerPos.x, startCameraPos.z - playerPos.z);
    
    // Create animation object to track angle
    const animObj = { angle: 0 };
    
    // Create animation timeline
    const tl = gsap.timeline({
        onComplete: () => {
            // Ensure camera ends at the correct starting position
            camera.position.copy(startCameraPos);
            camera.lookAt(playerPos);
            
            // Unlock player after animation
            scene.userData.playerLocked = false;
            scene.userData.lockedPlayerPosition = null;
            
            console.log('✅ Intro animation complete');
        }
    });
    
    // Animate camera orbiting around player (360 degrees)
    tl.to(animObj, {
        duration: animationDuration,
        angle: Math.PI * 2, // Full 360 degree rotation
        ease: "power2.inOut",
        onUpdate: function() {
            const currentAngle = startAngle + animObj.angle;
            // Calculate camera position in orbit around player
            camera.position.x = playerPos.x + Math.sin(currentAngle) * orbitRadius;
            camera.position.z = playerPos.z + Math.cos(currentAngle) * orbitRadius;
            camera.position.y = orbitHeight;
            // Always look at player
            camera.lookAt(playerPos);
        }
    });
    
    console.log('🎬 Starting intro camera animation');
}

// ---------- Level Management ----------
let currentLevelModule = null; // Store reference to the level module for cleanup
let currentLevelReturnCallback = null; // Store return callback for cheat key


// Loads a specific level by number (1, 2, or 3)
function loadLevel(levelNumber) {
    // Stop ALL music when entering a level (basement and mainmenu)
    if (audioManager) {
        audioManager.stopMusic();
    }
    
    // Hide inventory when entering a level
    if (inventorySystem) {
        inventorySystem.hide();
    }
    
    // Initialize pause menu if it doesn't exist (needed when loading from main menu, not Story Mode)
    if (!pauseMenu) {
        console.log('📋 Initializing pause menu for level...');
        pauseMenu = new PauseMenu();
        pauseMenu.init();
        // Make pauseMenu globally accessible for levels
        window.pauseMenu = pauseMenu;
        
        // Set callbacks for pause menu actions
        pauseMenu.setOnResume(() => {
            // Resume callback - game loop will resume automatically
        });
        
        pauseMenu.setOnRestart((levelNum) => {
            // Restart callback
            // Handle null case - try to get level from currentLevel
            if (!levelNum && currentLevel && currentLevel !== 'main') {
                const levelMatch = currentLevel.match(/level(\d+)/);
                if (levelMatch) {
                    levelNum = parseInt(levelMatch[1]);
                    console.log(`🔄 Restart: Got level number from currentLevel: ${levelNum}`);
                }
            }
            
            if (!levelNum) {
                console.warn('⚠️ No level number provided for restart, and currentLevel not available');
                return;
            }
            
            if (levelNum === 'main') {
                cleanupCurrentLevel();
                initMainMenu();
            } else {
                // Extract level number from "level2" format to just "2"
                let num;
                if (typeof levelNum === 'string' && levelNum.startsWith('level')) {
                    num = parseInt(levelNum.replace('level', ''));
                } else if (typeof levelNum === 'number') {
                    num = levelNum;
                } else {
                    num = parseInt(levelNum);
                }
                console.log(`🔄 Restarting level: ${levelNum} -> ${num}`);
                
                // Special handling for level 2 - use its restart function
                if (num === 2 && currentLevelModule && currentLevelModule.restartLevel) {
                    console.log('🔄 Using level 2 restart function');
                    currentLevelModule.restartLevel();
                } else if (num && !isNaN(num)) {
                    // For other levels, reload completely
                    loadLevel(num);
                } else {
                    console.error('⚠️ Invalid level number for restart:', levelNum);
                }
            }
        });
        
        pauseMenu.setOnReturnToMenu((levelNum) => {
            // Return to menu callback
            if (levelNum === 'main') {
                returnToMainMenuFromStory();
            } else {
                returnToMainMenu();
            }
        });
    }
    
    // Hide StoryUI when entering a level (but keep it in DOM for later)
    if (storyUI) {
        storyUI.hide();
        console.log('📖 StoryUI hidden (entering level)');
    }
    
    // 1. Clean up current scene before loading new one
    cleanupCurrentLevel();
    
    // 2. Ensure animation loop is fully stopped before proceeding
    if (renderer) {
        renderer.setAnimationLoop(null);
    } 
    
    // 3. Ensure scene, camera, and renderers are properly initialized
    if (!scene) {
        // Create new scene if it doesn't exist
        scene = new THREE.Scene();
    }
    if (!camera) {
        // Create new camera if it doesn't exist
        camera = new THREE.PerspectiveCamera(
            75, // Field of view in degrees
            window.innerWidth / window.innerHeight, // Aspect ratio
            0.1, // Near clipping plane
            1000 // Far clipping plane
        );
    }
    if (!renderer) {
        // Create new WebGL renderer if it doesn't exist
        renderer = new THREE.WebGLRenderer({ antialias: true });
        // Set renderer size to window size
        renderer.setSize(window.innerWidth, window.innerHeight);
        // Enable shadow mapping
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        // Add renderer canvas to document
        document.body.appendChild(renderer.domElement);
    }
    if (!labelRenderer) {
        // Create new CSS2D renderer if it doesn't exist
        labelRenderer = new CSS2DRenderer();
        // Set label renderer size to window size
        labelRenderer.setSize(window.innerWidth, window.innerHeight);
        // Style label renderer DOM element
        labelRenderer.domElement.style.position = 'absolute';
        labelRenderer.domElement.style.top = '0px';
        labelRenderer.domElement.style.pointerEvents = 'none';
        // Add label renderer DOM to document
        document.body.appendChild(labelRenderer.domElement);
    }
    
    // 4. Update game state to track current level
    currentLevel = `level${levelNumber}`;
    
    // 5. Hide HTML menu screens when loading a level (so level UI is visible)
    if (window.hideAllMenuScreens) {
        // Call global function to hide menus
        window.hideAllMenuScreens();
    }
    
    // 6. Show the canvas elements
    if (renderer && renderer.domElement) {
        // Show WebGL canvas
        renderer.domElement.style.display = 'block';
    }
    if (labelRenderer && labelRenderer.domElement) {
        // Show label canvas
        labelRenderer.domElement.style.display = 'block';
    }
    

    // 7. Dynamically import the level module (separate JavaScript file)
    import(`./level${levelNumber}.js`)
        .then(levelModule => {
            // Store the module reference for later cleanup
            currentLevelModule = levelModule;
            
            // Initialize the level, passing scene, camera, and callback function
            // Use different callback based on whether we're in Story Mode or direct level selection
            const returnCallback = () => {
                console.log(`🔄 Return callback called - isInStoryMode: ${isInStoryMode}, currentLevel: ${currentLevel}`);
                if (isInStoryMode) {
                    // We're in Story Mode (3D hub world), use Story Mode return
                    console.log('📖 Returning to Story Mode hub world...');
                    returnToMainMenuFromStory();
                } else {
                    // We're in direct level selection, use normal return
                    console.log('🏠 Returning to main menu...');
                    returnToMainMenu();
                }
            };
            
            // Store return callback for F3 cheat
            currentLevelReturnCallback = returnCallback;
            
            // Pass Story Mode info to level (store in scene.userData for level to access)
            if (scene) {
                scene.userData.isInStoryMode = isInStoryMode;
                // Make StoryUI and StorySystem accessible to levels (for future use)
                if (storyUI) {
                    scene.userData.storyUI = storyUI;
                }
                if (storySystem) {
                    scene.userData.storySystem = storySystem;
                }
            }
            
            // Call level initialization function with required parameters
            levelModule.initLevel(scene, camera, renderer, labelRenderer, returnCallback);
            
            // Start the animation loop for the level
            gameLoopActive = true;
            renderer.setAnimationLoop(animate);
        })
        .catch(err => {
            // Handle errors if level fails to load
            console.error(`Failed to load level ${levelNumber}:`, err);
            // Show error message to user
            alert(`Level ${levelNumber} failed to load. Check console for details.`);
            // Return to main menu on error
            returnToMainMenu();
        });
}

// Returns player from level back to main menu
function returnToMainMenu() {
    // Stop all music (we're leaving Story Mode)
    if (audioManager) {
        audioManager.stopMusic();
    }
    
    // Clean up the current level
    cleanupCurrentLevel();
    // Update game state to main menu
    currentLevel = 'main';
    // Reset Story Mode flag (we're going back to HTML menu)
    isInStoryMode = false;
    
    // Hide the canvas elements
    if (renderer && renderer.domElement) {
        // Hide WebGL canvas
        renderer.domElement.style.display = 'none';
    }
    if (labelRenderer && labelRenderer.domElement) {
        // Hide label canvas
        labelRenderer.domElement.style.display = 'none';
    }
    
    // Check if main menu elements exist
    const mainMenu = document.getElementById('main-menu');
    
    // Show main menu (will play main menu music)
    if (window.showMainMenu) {
        // Call global function to show main menu
        window.showMainMenu();
    }
}

// Returns player from Story Mode back to main menu (without hiding canvas)
function returnToMainMenuFromStory() {
    // Get level number before cleanup to mark it as completed
    const levelNumber = currentLevel.replace('level', '');
    const completedLevelNum = parseInt(levelNumber);
    
    // Mark level as completed in story system BEFORE cleanup (if we have one and it's a valid level)
    if (storySystem && completedLevelNum && completedLevelNum >= 1 && completedLevelNum <= 3) {
        storySystem.completeLevel(completedLevelNum);
    }
    
    // Clean up the current level (story system will be preserved since isInStoryMode is true)
    cleanupCurrentLevel();
    
    // Update game state to main menu
    currentLevel = 'main';
    // Keep Story Mode flag set (we're staying in 3D hub world)
    
    // Re-initialize everything from scratch to avoid state issues
    // Story system and UI will be preserved and reused by initMainMenu
    // Music will be started by initMainMenu
    initMainMenu();
}

// Cleans up resources when leaving a level or the game
function cleanupCurrentLevel() {
    // Clear return callback
    currentLevelReturnCallback = null;
    // Stop and clear animation mixer
    if (scene && scene.userData.playerMixer) {
        // Stop all animations
        scene.userData.playerMixer.stopAllAction();
        // Clear mixer reference
        scene.userData.playerMixer = null;
    }
    // Clear animation references
    if (scene) {
    scene.userData.playerAnimations = null;
    scene.userData.currentAnimation = null;
    scene.userData.currentAction = null;
        scene.userData.gameReady = false;
    }

    // Cleanup interaction system
    if (interactionSystem) {
        interactionSystem.cleanup();
        interactionSystem = null;
    }
    
    // Hide any visible subtitles when leaving level
    if (window.subtitleSystem) {
        window.subtitleSystem.hide();
    }

    // 1. Call level-specific cleanup (if it exists)
    if (currentLevelModule && currentLevelModule.cleanupLevel) {
        // Call level's cleanup function
        currentLevelModule.cleanupLevel();
        // Clear module reference
        currentLevelModule = null; 
    }

    // 2. Stop the current animation loop
    if (renderer) {
        // Clear animation loop
        renderer.setAnimationLoop(null);
    }
    
    // Cleanup camera control system
    if (cameraControl) {
        cameraControl.cleanup();
        cameraControl = null;
    }
    
    // Unlock pointer lock if it's still active (important for returning from levels)
    if (document.pointerLockElement) {
        document.exitPointerLock();
    }

    // Cleanup input system
    if (inputSystem) {
        inputSystem.cleanup();
        inputSystem = null;
    }
    
    // Cleanup lighting system
    if (lightingSystem) {
        lightingSystem.cleanup();
        lightingSystem = null;
    }
    
    // Cleanup player system (no cleanup method, just null reference)
    playerSystem = null;
    
    // Cleanup environment loader (no cleanup method, just null reference)
    environmentLoader = null;
    
    // Cleanup mirror system
    if (mirrorSystem) {
        mirrorSystem.cleanup();
        mirrorSystem = null;
    }
    
    // Cleanup story system and UI (but preserve if in Story Mode)
    // Only cleanup if we're leaving Story Mode entirely
    if (!isInStoryMode) {
        if (treasureInteractionSystem) {
            treasureInteractionSystem.cleanup();
            treasureInteractionSystem = null;
        }
        if (secondChestInteractionSystem) {
            secondChestInteractionSystem.cleanup();
            secondChestInteractionSystem = null;
        }
        if (storyUI) {
            storyUI.cleanup();
            storyUI = null;
        }
        if (storySystem) {
            storySystem.cleanup();
            storySystem = null;
        }
    } else {
        // In Story Mode - just save progress, don't destroy
        if (storySystem) {
            storySystem.saveProgress();
        }
        // Don't null references - we'll reuse them
    }
    
    // 3. Remove all event listeners
    window.removeEventListener("resize", onWindowResize);
    
    // Reset loading flags
    isPlayerLoaded = false;
    isEnvironmentLoaded = false;

    // 4. Clear the CSS2D Renderer's DOM
    if (labelRenderer) {
        // Get label renderer DOM element
        const domElement = labelRenderer.domElement;
        // Remove all child elements from label DOM
        while (domElement.firstChild) {
            domElement.removeChild(domElement.firstChild);
        }
    }
    
    // 5. Clear the THREE.js scene
    if (scene) {
        // Remove all objects from scene
        while(scene.children.length > 0) { 
            scene.remove(scene.children[0]); 
        }
    }
    
    // 6. Clear any level-specific UI elements with class 'game-ui'
    // BUT preserve Story UI, Inventory UI, Subtitle UI, and Loading Spinner (they should persist in Story Mode)
    const uiElements = document.querySelectorAll('.game-ui');
    // Loop through all game UI elements
    uiElements.forEach(el => {
        // Check if element is part of main menu (not level-specific)
        const isMainMenuElement = el.closest('#main-menu, #play-submenu, #level-select, #settings, #credits, #instructions, #pause-menu');
        // Preserve Story UI, Inventory UI, Subtitle UI, and Loading Spinner (they have special classes and should persist)
        const isStoryUI = el.classList.contains('story-ui');
        const isInventoryUI = el.classList.contains('inventory-ui');
        const isSubtitleUI = el.classList.contains('subtitle-display');
        const isLoadingSpinner = el.classList.contains('loading-spinner');
        
        if (!isMainMenuElement && !isStoryUI && !isInventoryUI && !isSubtitleUI && !isLoadingSpinner) {
            // Remove level-specific UI elements only
            el.remove();
        }
    });
    
    // Hide loading spinner if it's visible when leaving level
    if (loadingSpinner) {
        loadingSpinner.hide();
    }
}

// ---------- Input System ----------
let inputSystem = null;

// Updates player position, physics, and animations
function updatePlayer() {
    // Only update player in main menu, not during levels
    if (currentLevel !== 'main' || !playerSystem) return;

    // Check if player is locked (e.g., during treasure interaction)
    if (scene.userData.playerLocked) {
        // Still update animations and camera, but prevent movement
        const player = scene.getObjectByName('player');
        if (player && scene.userData.lockedPlayerPosition) {
            // Lock player position
            player.position.copy(scene.userData.lockedPlayerPosition);
        }
        // Update animations only
        const delta = playerSystem.clock.getDelta();
        if (scene.userData.playerMixer) {
            scene.userData.playerMixer.update(delta);
        }
        return;
    }

    // Update arcade box helpers if they exist
    if (scene.userData.arcadeBoxHelpers) {
        scene.userData.arcadeBoxHelpers.forEach(helper => {
            helper.update();
        });
    }

    // Update collision helpers if they're visible
    if (environmentLoader && showCollisionHelpers) {
        const collisionHelper = environmentLoader.getCollisionHelper();
        // Update all collision helpers (includes Ground object, arcades, and all meshes)
        collisionHelper.updateAll();
    }

    // Update player system with current input and camera state
    const inputState = inputSystem ? inputSystem.getInputState() : { keys: {} };
    
    // Get camera state from camera control system
    const cameraState = cameraControl ? cameraControl.getCameraState() : { yaw: 0, pitch: 0 };

    // Update player with camera control for collision detection
    playerSystem.update(inputState, cameraState, cameraControl);
}

// ---------- Window Resize ----------
function onWindowResize() {
    // Update camera aspect ratio to match new window dimensions
    camera.aspect = window.innerWidth / window.innerHeight;
    // Apply the new aspect ratio to camera
    camera.updateProjectionMatrix();
    // Resize both renderers to match new window size
    renderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
}

// ---------- Animation Loop ----------
function animate() {
    // Check if game loop is active and game is not paused
    if (gameLoopActive && (!pauseMenu || !pauseMenu.isPaused())) {
        // Update main menu specific logic
        if (currentLevel === 'main') {
            // Only update player if not locked (e.g., during treasure viewing)
            if (!scene.userData.playerLocked) {
                updatePlayer();
            } else {
                // Still update animations even when locked
                if (playerSystem && scene.userData.playerMixer) {
                    const delta = playerSystem.clock.getDelta();
                    scene.userData.playerMixer.update(delta);
                }
            }
            
            if (interactionSystem) {
                const keys = inputSystem ? inputSystem.getKeys() : {};
                // Always update interactions (so E key works even in viewing mode)
                interactionSystem.update(currentLevel, keys);
            }
            // Update story UI periodically (every few seconds or on demand)
            if (storyUI && Math.random() < 0.01) { // Update ~1% of frames (~0.6 times per second at 60fps)
                storyUI.update();
            }
            
                    // Update treasure interaction system (pass keys for F key detection)
                    if (treasureInteractionSystem) {
                        const keys = inputSystem ? inputSystem.getKeys() : {};
                        treasureInteractionSystem.update(keys);
                    }
                    
                    // Update second chest interaction system (pass keys for F key detection)
                    if (secondChestInteractionSystem) {
                        const keys = inputSystem ? inputSystem.getKeys() : {};
                        secondChestInteractionSystem.update(keys);
                    }
        }
        
        // Update level-specific logic if exists
        if (currentLevelModule && currentLevelModule.updateLevel) {
            currentLevelModule.updateLevel();
        }
        
        // Update mirror system (before main render, but only in main menu)
        if (currentLevel === 'main' && mirrorSystem) {
            mirrorSystem.update();
        }
        
        // Render the 3D scene
        renderer.render(scene, camera);
        // Render labels if label renderer exists
        if (labelRenderer) {
            labelRenderer.render(scene, camera);
        }
    } else {
        // Still render scene even when paused (for pause menu background)
        renderer.render(scene, camera);
        // Render labels even when paused
        if (labelRenderer) {
            labelRenderer.render(scene, camera);
        }
    }
}

// ---------- Pause System ----------
let gameLoopActive = false; // Flag to control animation loop

// Function to pause the game loop
window.pauseGameLoop = function() {
    // Set game loop inactive
    gameLoopActive = false;
    // Stop animation loop
    if (renderer) {
        renderer.setAnimationLoop(null);
    }
};

// Function to resume the game loop
window.resumeGameLoop = function() {
    // Only resume if not already active (prevents duplicate loops)
    if (gameLoopActive === true) {
        console.warn('⚠️ resumeGameLoop called but game loop already active - skipping');
        return;
    }
    // Set game loop active
    gameLoopActive = true;
    // Restart animation loop
    if (renderer) {
        renderer.setAnimationLoop(animate);
    }
};

// Expose gameLoopActive globally so restart system can check it
window.gameLoopActive = gameLoopActive;
Object.defineProperty(window, 'gameLoopActive', {
    get: () => gameLoopActive,
    enumerable: true,
    configurable: true
});

// Make functions available globally for menu.js
window.loadLevel = loadLevel;
window.initMainMenu = initMainMenu;
window.returnToMainMenu = returnToMainMenu;
window.returnToMainMenuFromStory = returnToMainMenuFromStory;
window.renderer = renderer;
window.labelRenderer = labelRenderer;

// Make currentLevel accessible globally for pause menu restart fallback
Object.defineProperty(window, 'currentLevel', {
    get: () => currentLevel,
    enumerable: true,
    configurable: true
});

// ---------- Initialize Game ----------
// The menu.js will handle the intro screen and main menu
// This file focuses on the 3D game logic

// Initialize settings menu early so it's available from HTML main menu
// This will be re-initialized in initMainMenu() for full functionality
if (!window.settingsMenu) {
    settingsMenu = new SettingsMenu();
    settingsMenu.init();
    window.settingsMenu = settingsMenu;
}

// Initialize audio manager early so it's available when loading levels directly from main menu
// This will be re-initialized in initMainMenu() for full functionality
if (!window.audioManager) {
    audioManager = new AudioManager();
    audioManager.init(settingsMenu);
    // Register main menu and credits music early so they can play when needed
    audioManager.registerMusic('mainmenu', 'assets/audio/music/SalmonLikeTheFish - Glacier.mp3', true);
    audioManager.registerMusic('credits', 'assets/audio/music/Grzegorz Rusin - The end.mp3', true);
    window.audioManager = audioManager;
    console.log('✅ AudioManager initialized early');
}

// Initialize subtitle system early so it's available from anywhere
if (!window.subtitleSystem) {
    subtitleSystem = new SubtitleSystem();
    subtitleSystem.init();
    window.subtitleSystem = subtitleSystem;
    console.log('✅ SubtitleSystem initialized early');
}

// Initialize loading spinner early so it's available from anywhere
if (!window.loadingSpinner) {
    loadingSpinner = new LoadingSpinner();
    loadingSpinner.init();
    window.loadingSpinner = loadingSpinner;
    console.log('✅ LoadingSpinner initialized early');
}