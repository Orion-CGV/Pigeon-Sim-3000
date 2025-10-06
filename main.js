// Import the Three.js library for 3D graphics
import * as THREE from 'three';
// Import CSS2D renderer for HTML labels that stay facing the camera
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// ---------- Scene / Camera / Renderer ----------
// Global variables to store our 3D environment components
let scene,     // The 3D scene that contains all objects
    camera,    // The virtual camera that defines our view
    renderer,  // The WebGL renderer that draws the 3D scene
    labelRenderer; // Special renderer for HTML text labels

// ---------- Game State ----------
// Tracks which level we're currently in
let currentLevel = 'main'; // Can be 'main', 'level1', 'level2', 'level3'
// Tracks whether we're in Story Mode (3D hub world)
let isInStoryMode = false;

// Initializes the main menu/hub world where player selects levels
function initMainMenu() {
    // Set Story Mode flag
    isInStoryMode = true;
    
    // Clean up any existing scene first
    if (scene) {
        // Clear all objects from the scene
        while(scene.children.length > 0) {
            scene.remove(scene.children[0]);
        }
    }
    
    // If returning from a level, the scene/renderer might be null, so recreate them
    // Check if WebGL renderer doesn't exist yet
    if (!renderer) {
        // Create WebGL renderer with antialiasing for smoother edges
        renderer = new THREE.WebGLRenderer({ antialias: true });
        // Set renderer size to match browser window
        renderer.setSize(window.innerWidth, window.innerHeight);
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
    renderer.setAnimationLoop(animate);
    
    console.log('initMainMenu completed');
    console.log('Scene children count:', scene.children.length);
    console.log('Scene children:', scene.children.map(child => child.name || child.type));
    console.log('Renderer canvas:', renderer.domElement);
    console.log('Game loop active:', gameLoopActive);

    // ---------- Resize ----------
    // Add event listener to handle browser window resizing
    window.addEventListener("resize", onWindowResize);

    // ---------- Player ----------
    console.log('Creating player...');
    try {
        // Define player dimensions
        const PLAYER_SIZE = { x: 1, y: 1, z: 1 };
        // Create box geometry for player (width, height, depth)
        const playerGeometry = new THREE.BoxGeometry(PLAYER_SIZE.x, PLAYER_SIZE.y, PLAYER_SIZE.z);
        // Create green material for player
        const playerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        // Combine geometry and material into a mesh (visible 3D object)
        const player = new THREE.Mesh(playerGeometry, playerMaterial);
        // Position player so its bottom sits on ground (y = height/2)
        player.position.y = PLAYER_SIZE.y / 2;
        // Give player a name for easy reference later
        player.name = 'player';
        // Add player to the scene
        scene.add(player);
        console.log('Player created and added to scene');
    } catch (error) {
        console.error('Error creating player:', error);
    }

    // ---------- Ground ----------
    console.log('Creating ground...');
    try {
        // Create flat plane geometry for ground (width, height)
        const groundGeom = new THREE.PlaneGeometry(80, 80);
        // Create gray material that renders both sides of the plane
        const groundMat = new THREE.MeshBasicMaterial({ color: 0x808080, side: THREE.DoubleSide });
        // Create ground mesh
        const ground = new THREE.Mesh(groundGeom, groundMat);
        // Rotate plane 90 degrees to make it horizontal (default is vertical)
        ground.rotation.x = -Math.PI / 2;
        // Position ground at y=0
        ground.position.y = 0;
        // Add ground to scene
        scene.add(ground);
        console.log('Ground created and added to scene');
    } catch (error) {
        console.error('Error creating ground:', error);
    }

    // ---------- Arcade placeholders ----------
    console.log('Creating arcade machines...');
    try {
        // Arrays to store arcade machines and their labels
        const arcades = [];
        const arcadeLabels = [];
        // Colors for the three arcade machines (red, blue, yellow)
        const arcadeColors = [0xff0000, 0x0000ff, 0xffff00];
        // Names to display on each machine
        const arcadeNames = ["Level 1", "Level 2", "Level 3"];
        // Color names for interaction prompts
        const arcadeColorNames = ["Red", "Blue", "Yellow"];

        // Create three arcade machines
        for (let i = 0; i < 3; i++) {
        // Create taller box geometry for arcade machine (1x2x1 units)
        const g = new THREE.BoxGeometry(1, 2, 1);
        // Create colored material using current arcade color
        const m = new THREE.MeshBasicMaterial({ color: arcadeColors[i] });
        // Create arcade machine mesh
        const arcade = new THREE.Mesh(g, m);
        // Position arcades in a row: (-3,0,-10), (0,0,-10), (3,0,-10)
        arcade.position.set(i * 3 - 3, 1, -10);
        // Store level number (1, 2, or 3) in userData for easy access
        arcade.userData.level = i + 1;
        // Store color name for interaction prompts
        arcade.userData.colorName = arcadeColorNames[i];
        // Give each arcade a unique name
        arcade.name = `arcade-${i + 1}`;
        // Add arcade to scene
        scene.add(arcade);
        // Store arcade in array
        arcades.push(arcade);

        // Create text label for arcade machine
        const textDiv = document.createElement('div');
        // Add class for easy cleanup later
        textDiv.className = 'arcade-label';
        // Set text content to level name
        textDiv.textContent = arcadeNames[i];
        // Style the text label
        textDiv.style.color = 'white';
        textDiv.style.fontFamily = 'Arial, sans-serif';
        textDiv.style.fontSize = '16px';
        textDiv.style.fontWeight = 'bold';
        textDiv.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)'; // Add shadow for readability
        textDiv.style.pointerEvents = 'none'; // Don't block mouse events
        textDiv.style.textAlign = 'center';
        textDiv.style.whiteSpace = 'nowrap'; // Prevent text wrapping
        
        // Create CSS2D object from the div (will always face camera)
        const label = new CSS2DObject(textDiv);
        // Position label above the arcade machine
        label.position.set(0, 1.5, 0);
        // Attach label to arcade machine (moves with it)
        arcade.add(label);
        // Store label in array
        arcadeLabels.push(label);
    }

        // Store arcades in scene for easy access from other functions
        scene.userData.arcades = arcades;
        // Precompute collision boxes for all arcades (optimization)
        scene.userData.arcadeBoxes = arcades.map(a => new THREE.Box3().setFromObject(a));
        console.log('Arcade machines created and added to scene');
    } catch (error) {
        console.error('Error creating arcade machines:', error);
    }

    // ---------- Interaction System ----------
    // Set up system for detecting when player looks at arcade machines
    setupInteractionSystem();

    // ---------- Input System ----------
    // Set up keyboard and mouse input handling
    setupInputSystem();

    // ---------- Camera ----------
    // Position camera above and behind player
    camera.position.set(0, 5, 10);
    // Point camera at center of scene
    camera.lookAt(0, 0, 0);
}

// ---------- Level Management ----------
let currentLevelModule = null; // Store reference to the level module for cleanup

// Loads a specific level by number (1, 2, or 3)
function loadLevel(levelNumber) {
    // 1. Clean up current scene before loading new one
    cleanupCurrentLevel(); 
    
    // 2. Ensure scene, camera, and renderers are properly initialized
    if (!scene) {
        scene = new THREE.Scene();
    }
    if (!camera) {
        camera = new THREE.PerspectiveCamera(
            75, // Field of view in degrees
            window.innerWidth / window.innerHeight, // Aspect ratio
            0.1, // Near clipping plane
            1000 // Far clipping plane
        );
    }
    if (!renderer) {
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);
    }
    if (!labelRenderer) {
        labelRenderer = new CSS2DRenderer();
        labelRenderer.setSize(window.innerWidth, window.innerHeight);
        labelRenderer.domElement.style.position = 'absolute';
        labelRenderer.domElement.style.top = '0px';
        labelRenderer.domElement.style.pointerEvents = 'none';
        document.body.appendChild(labelRenderer.domElement);
    }
    
    // 3. Update game state to track current level
    currentLevel = `level${levelNumber}`;
    
    // 4. Hide HTML menu screens when loading a level (so level UI is visible)
    if (window.hideAllMenuScreens) {
        window.hideAllMenuScreens();
    }
    
    // 5. Show the canvas elements
    if (renderer && renderer.domElement) {
        renderer.domElement.style.display = 'block';
    }
    if (labelRenderer && labelRenderer.domElement) {
        labelRenderer.domElement.style.display = 'block';
    }
    
    // 6. Dynamically import the level module (separate JavaScript file)
    import(`./level${levelNumber}.js`)
        .then(levelModule => {
            // Store the module reference for later cleanup
            currentLevelModule = levelModule;
            
            // Initialize the level, passing scene, camera, and callback function
            // Use different callback based on whether we're in Story Mode or direct level selection
            const returnCallback = () => {
                if (isInStoryMode) {
                    // We're in Story Mode (3D hub world), use Story Mode return
                    returnToMainMenuFromStory();
                } else {
                    // We're in direct level selection, use normal return
                    returnToMainMenu();
                }
            };
            
            levelModule.initLevel(scene, camera, renderer, labelRenderer, returnCallback);
        })
        .catch(err => {
            // Handle errors if level fails to load
            console.error(`Failed to load level ${levelNumber}:`, err);
            alert(`Level ${levelNumber} failed to load. Check console for details.`);
            // Return to main menu on error
            returnToMainMenu();
        });
}

// Returns player from level back to main menu
function returnToMainMenu() {
    // Clean up the current level
    cleanupCurrentLevel();
    // Update game state
    currentLevel = 'main';
    // Reset Story Mode flag (we're going back to HTML menu)
    isInStoryMode = false;
    
    // Hide the canvas elements
    if (renderer && renderer.domElement) {
        renderer.domElement.style.display = 'none';
    }
    if (labelRenderer && labelRenderer.domElement) {
        labelRenderer.domElement.style.display = 'none';
    }
    
    // Check if main menu elements exist
    const mainMenu = document.getElementById('main-menu');
    
    // Show main menu
    if (window.showMainMenu) {
        window.showMainMenu();
    }
}

// Returns player from Story Mode back to main menu (without hiding canvas)
function returnToMainMenuFromStory() {
    // Clean up the current level
    cleanupCurrentLevel();
    // Update game state
    currentLevel = 'main';
    // Keep Story Mode flag set (we're staying in 3D hub world)
    
    // Don't call showMainMenu() - we want to stay in the 3D hub world
    // The 3D scene should already be visible and the hub world should be active
}

// Cleans up resources when leaving a level or the game
function cleanupCurrentLevel() {
    // 1. Call level-specific cleanup (if it exists)
    // Some levels might have custom cleanup logic
    if (currentLevelModule && currentLevelModule.cleanupLevel) {
        currentLevelModule.cleanupLevel();
        currentLevelModule = null; // Clear reference
    }

    // 2. Stop the current animation loop
    // Prevents multiple animation loops running simultaneously
    if (renderer) {
        renderer.setAnimationLoop(null);
    }
    
    // 3. Remove all event listeners (should be removed by the level's cleanup, but good to ensure)
    // Clean up any lingering input listeners
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("keyup", handleKeyUp);
    document.removeEventListener("pointerlockchange", onPointerLockChange);
    document.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("resize", onWindowResize); // Remove global listener

    // 4. Clear the CSS2D Renderer's DOM (Fix for persistent labels)
    // Remove any HTML labels left over from previous level
    if (labelRenderer) {
        const domElement = labelRenderer.domElement;
        // Remove all child elements from label container
        while (domElement.firstChild) {
            domElement.removeChild(domElement.firstChild);
        }
    }
    
    // 5. Clear the THREE.js scene
    // Remove all 3D objects from the scene
    if (scene) {
        while(scene.children.length > 0) { 
            scene.remove(scene.children[0]); 
        }
    }
    
    // 6. Clear any level-specific UI elements with class 'game-ui'
    // Only remove UI elements that are not part of the main menu system
    const uiElements = document.querySelectorAll('.game-ui');
    uiElements.forEach(el => {
        // Only remove elements that are not part of the main menu screens
        const isMainMenuElement = el.closest('#main-menu, #play-submenu, #level-select, #settings, #credits, #instructions, #pause-menu');
        if (!isMainMenuElement) {
            el.remove();
        }
    });
}

// ---------- Interaction System ----------
// Sets up system for detecting when player looks at interactive objects
function setupInteractionSystem() {
    const INTERACTION_DISTANCE = 3; // How close player needs to be to interact
    let currentInteractable = null; // Currently targeted interactive object
    const raycaster = new THREE.Raycaster(); // Casts rays to detect what player is looking at
    const mouse = new THREE.Vector2(0, 0); // Screen coordinates (center of screen)

    // Create interaction prompt (className 'game-ui' for easy cleanup)
    const interactionPrompt = document.createElement("div");
    interactionPrompt.className = "game-ui";
    // Style the prompt with CSS text for better performance
    interactionPrompt.style.cssText = `
        position: absolute; top: 60%; left: 50%; transform: translate(-50%, -50%); 
        color: white; font-family: Arial, sans-serif; font-size: 20px; font-weight: bold; 
        text-shadow: 2px 2px 4px rgba(0,0,0,0.8); pointer-events: none; z-index: 10; 
        text-align: center; opacity: 0; transition: opacity 0.3s ease;
    `;
    interactionPrompt.textContent = "E to interact";
    document.body.appendChild(interactionPrompt);

    // Crosshair (className 'game-ui' for easy cleanup)
    const crosshair = document.createElement("div");
    crosshair.className = "game-ui";
    crosshair.style.cssText = `
        position: absolute; top: 50%; left: 50%; width: 20px; height: 20px; 
        margin-left: -10px; margin-top: -10px; pointer-events: none; z-index: 10;
    `;
    // Create crosshair using HTML elements (horizontal and vertical lines)
    crosshair.innerHTML = `
        <div style="position:absolute;top:9px;left:0;width:20px;height:2px;background:white"></div>
        <div style="position:absolute;top:0;left:9px;width:2px;height:20px;background:white"></div>
    `;
    document.body.appendChild(crosshair);

    // Store interaction system data in scene for easy access
    scene.userData.interactionPrompt = interactionPrompt;
    scene.userData.currentInteractable = currentInteractable;
    scene.userData.raycaster = raycaster;
    scene.userData.mouse = mouse;
}

// Checks if player is looking at an interactive object and close enough to interact
function checkInteractions() {
    // Only check interactions in main menu, not during levels
    if (currentLevel !== 'main') return;
    
    // Get interaction system components from scene
    const { raycaster, mouse, interactionPrompt, arcades } = scene.userData;
    
    // Raycast from the center of the screen (where crosshair is)
    raycaster.setFromCamera(mouse, camera); 
    // Find all arcade machines that the ray intersects
    const intersects = raycaster.intersectObjects(arcades);
    
    // Get player object from scene
    const player = scene.getObjectByName('player');
    
    // Check if ray hit something and player exists
    if (intersects.length > 0 && player) {
        const closestArcade = intersects[0].object;
        // Check both raycast hit and proximity (player must be close enough)
        const distance = player.position.distanceTo(closestArcade.position);
        
        // If player is within interaction distance
        if (distance <= 3) {
            // Update prompt to show which machine player can interact with
            interactionPrompt.textContent = `E to interact with ${closestArcade.userData.colorName} machine`;
            // Make prompt visible
            interactionPrompt.style.opacity = "1";
            // Store current interactable for handling E key press
            scene.userData.currentInteractable = closestArcade;
            return;
        }
    }
    
    // No valid interactable found, hide prompt and clear current interactable
    interactionPrompt.style.opacity = "0";
    scene.userData.currentInteractable = null;
}

// Handles interaction when player presses E key while looking at interactable object
function handleInteraction() {
    // Only handle interactions in main menu
    if (currentLevel !== 'main') return;
    
    // Get current interactable from scene
    const { currentInteractable } = scene.userData;
    
    // Check if there's an interactable, E key is pressed, and not locked (anti-spam)
    if (currentInteractable && keys["e"] && !eKeyLocked) {
        // Lock E key to prevent rapid repeated interactions
        eKeyLocked = true;
        // Get level number from the arcade machine's userData
        const level = currentInteractable.userData.level;
        // Load the selected level
        loadLevel(level);
        
        // Reset key lock after a delay (1 second)
        setTimeout(() => {
            eKeyLocked = false;
        }, 1000);
    }
}

// ---------- Input System ----------
// Object to track which keys are currently pressed
let keys = {};
// Jumping variables
let spaceHeld = false;    // Is space bar currently held down?
let spaceLocked = false;  // Prevent auto-repeat jumping while holding space
// Interaction variables
let eKeyLocked = false;   // Prevent rapid E key presses
// Camera rotation variables
let yaw = 0;   // Horizontal rotation (left/right) in radians
let pitch = 0; // Vertical rotation (up/down) in radians
const PI_2 = Math.PI / 2; // 90 degrees in radians (used for pitch limits)
const MOUSE_SENS = 0.0025; // Mouse sensitivity multiplier

// Sets up keyboard and mouse input listeners
function setupInputSystem() {
    // Add event listeners for keyboard input
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    // Listen for pointer lock changes (when mouse is captured for looking around)
    document.addEventListener("pointerlockchange", onPointerLockChange);
    
    // Pointer lock on click - when user clicks canvas, capture mouse for looking
    renderer.domElement.addEventListener("click", () => {
        // Only request lock if not already locked
        if (document.pointerLockElement !== renderer.domElement) {
            renderer.domElement.requestPointerLock();
        }
    });
}

// Handles key press events
function handleKeyDown(e) {
    // Check for ESC key to show pause menu
    if (e.code === "Escape") {
        e.preventDefault();
        console.log('ESC key pressed, currentLevel:', currentLevel);
        console.log('isGamePaused function available:', !!window.isGamePaused);
        console.log('showPauseMenu function available:', !!window.showPauseMenu);
        
        if (window.isGamePaused && window.isGamePaused()) {
            // If already paused, resume
            console.log('Resuming game...');
            window.resumeGame();
        } else {
            // Show pause menu
            console.log('Showing pause menu...');
            if (currentLevel === 'main') {
                console.log('Pausing main menu');
                window.showPauseMenu('main');
            } else if (currentLevelModule) {
                // Extract level number from currentLevel (e.g., 'level1' -> 1)
                const levelNumber = currentLevel.replace('level', '');
                console.log('Pausing level:', levelNumber);
                window.showPauseMenu(parseInt(levelNumber));
            } else {
                console.log('No current level module, pausing anyway');
                window.showPauseMenu();
            }
        }
        return;
    }
    
    // Check for space bar specifically (for jumping)
    if (e.code === "Space") {
        spaceHeld = true;
    } else {
        // Store any other key in keys object using lowercase key name
        keys[e.key.toLowerCase()] = true;
    }
}

// Handles key release events
function handleKeyUp(e) {
    // Check for space bar release
    if (e.code === "Space") {
        spaceHeld = false;
        spaceLocked = false; // Reset jump lock when space is released
    } else {
        // Remove key from keys object when released
        keys[e.key.toLowerCase()] = false;
    }
}

// Handles pointer lock state changes (when mouse is captured/released)
function onPointerLockChange() {
    // Check if pointer is now locked to our canvas
    if (document.pointerLockElement === renderer.domElement) {
        // Add mouse movement listener for camera control
        document.addEventListener("mousemove", onMouseMove);
    } else {
        // Remove mouse movement listener when pointer is unlocked
        document.removeEventListener("mousemove", onMouseMove);
    }
}

// Handles mouse movement for camera control (only when pointer is locked)
function onMouseMove(e) {
    // Update yaw (horizontal rotation) based on mouse X movement
    yaw -= e.movementX * MOUSE_SENS;
    // Update pitch (vertical rotation) based on mouse Y movement
    pitch += e.movementY * MOUSE_SENS;
    // Define pitch limits to prevent camera from flipping over
    const maxPitch = PI_2 - 0.1; // Almost 90 degrees up
    const minPitch = -maxPitch;  // Almost 90 degrees down
    // Clamp pitch to prevent camera from going too far up or down
    pitch = Math.max(minPitch, Math.min(maxPitch, pitch));
}

// ---------- Physics ----------
// Movement and physics constants
const speed = 0.15;        // Horizontal movement speed (units per frame)
const gravity = -0.03;     // Gravity acceleration (units per frame squared)
const jumpStrength = 0.45; // Initial upward velocity when jumping
let velocityY = 0;         // Current vertical velocity

// Updates player position and physics
function updatePlayer() {
    // Only update player in main menu, not during levels
    if (currentLevel !== 'main') return;
    
    // Get player object from scene
    const player = scene.getObjectByName('player');
    if (!player) return;

    // Movement vectors (reused to avoid creating new objects every frame)
    const _forward = new THREE.Vector3();
    const _right = new THREE.Vector3();
    const _moveDir = new THREE.Vector3();

    // Calculate forward direction based on current yaw (horizontal rotation)
    _forward.set(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
    // Calculate right direction (perpendicular to forward)
    _right.crossVectors(_forward, new THREE.Vector3(0, 1, 0)).normalize();

    // Reset movement direction
    _moveDir.set(0, 0, 0);
    // Add movement based on key presses
    if (keys["w"] || keys["arrowup"]) _moveDir.add(_forward);    // Move forward
    if (keys["s"] || keys["arrowdown"]) _moveDir.sub(_forward);  // Move backward
    if (keys["d"] || keys["arrowright"]) _moveDir.add(_right);   // Strafe right
    if (keys["a"] || keys["arrowleft"]) _moveDir.sub(_right);    // Strafe left

    // Normalize movement vector if moving (prevents faster diagonal movement)
    if (_moveDir.lengthSq() > 0) _moveDir.normalize();

    // Store previous position for collision detection
    const prevPos = player.position.clone();
    // Apply horizontal movement
    player.position.x += _moveDir.x * speed;
    player.position.z += _moveDir.z * speed;

    // Simple collision detection
    // Create bounding box around player for collision testing
    const playerBox = new THREE.Box3().setFromObject(player);
    // Get arcade collision boxes from scene
    const { arcadeBoxes } = scene.userData;
    
    // Check collision with arcade machines if they exist
    if (arcadeBoxes) {
        for (let box of arcadeBoxes) {
            if (playerBox.intersectsBox(box)) {
                // Collision detected - revert horizontal movement
                player.position.x = prevPos.x;
                player.position.z = prevPos.z;
                break; // Only need to handle first collision
            }
        }
    }

    // Apply gravity to vertical velocity
    velocityY += gravity;
    // Apply vertical movement
    player.position.y += velocityY;

    // Ground collision detection
    if (player.position.y <= 0.5) {
        // Snap player to ground level
        player.position.y = 0.5;
        // Stop vertical movement
        velocityY = 0;
        
        // Handle jumping if space is pressed and not locked
        if (spaceHeld && !spaceLocked) {
            // Apply upward velocity for jump
            velocityY = jumpStrength;
            // Lock jumping to prevent auto-repeat
            spaceLocked = true;
        }
    }

    // Update camera to follow player
    updateCamera(player);
}

// Updates camera position to follow player with third-person view
function updateCamera(player) {
    const cameraDistance = 8;        // How far behind player the camera stays
    const cameraHeightOffset = 1.8;  // How high above player the camera is
    const cosPitch = Math.cos(pitch); // Used for vertical camera positioning

    // Calculate camera position behind player based on yaw and pitch
    camera.position.x = player.position.x - Math.sin(yaw) * cameraDistance * cosPitch;
    camera.position.z = player.position.z - Math.cos(yaw) * cameraDistance * cosPitch;
    camera.position.y = player.position.y + Math.sin(pitch) * cameraDistance + cameraHeightOffset;

    // Point camera slightly above player center for better view
    const aimHeightOffset = 1.5;
    camera.lookAt(
        player.position.x,
        player.position.y + aimHeightOffset,
        player.position.z
    );
}

// ---------- Window Resize ----------
// Handles browser window resizing to maintain proper aspect ratio
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
// Main game loop that runs continuously (called ~60 times per second)
function animate() {
    // Only continue if game is not paused
    if (gameLoopActive && !window.isGamePaused()) {
        // Only update player and interactions in main menu
        if (currentLevel === 'main') {
            updatePlayer();        // Update player position and physics
            checkInteractions();   // Check if player can interact with anything
            handleInteraction();   // Handle interaction if E key is pressed
        }
        
        // Update the current level (if it has an update function)
        if (currentLevelModule && currentLevelModule.updateLevel) {
            currentLevelModule.updateLevel();
        }
        
        // Render the 3D scene using WebGL
        renderer.render(scene, camera);
        // Render HTML labels on top of 3D scene
        if (labelRenderer) {
            labelRenderer.render(scene, camera);
        }
    } else {
        // Still render even when paused to maintain visual state
        renderer.render(scene, camera);
        if (labelRenderer) {
            labelRenderer.render(scene, camera);
        }
    }
}


// ---------- Pause System ----------
let gameLoopActive = false;

// Function to pause the game loop
window.pauseGameLoop = function() {
    gameLoopActive = false;
    if (renderer) {
        renderer.setAnimationLoop(null);
    }
};

// Function to resume the game loop
window.resumeGameLoop = function() {
    gameLoopActive = true;
    if (renderer) {
        renderer.setAnimationLoop(animate);
    }
};

// Make functions available globally for menu.js
window.loadLevel = loadLevel;
window.initMainMenu = initMainMenu;
window.returnToMainMenu = returnToMainMenu;
window.returnToMainMenuFromStory = returnToMainMenuFromStory;
window.renderer = renderer;
window.labelRenderer = labelRenderer;

// ---------- Initialize Game ----------
// The menu.js will handle the intro screen and main menu
// This file focuses on the 3D game logic