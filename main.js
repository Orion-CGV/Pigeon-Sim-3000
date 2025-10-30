// Import the Three.js library for 3D graphics
import * as THREE from 'three';
// Import CSS2D renderer for HTML labels that stay facing the camera
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
// Import GLTFLoader for loading GLB files
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ---------- Scene / Camera / Renderer ----------
// Global variables to store our 3D environment components
let scene;     // The 3D scene that contains all objects
let camera;    // The virtual camera that defines our view
let renderer;  // The WebGL renderer that draws the 3D scene
let labelRenderer; // Special renderer for HTML text labels
const clock = new THREE.Clock(); // Clock for tracking time between frames
// Performance HUD (stats.js)
let stats = null; // Stats.js object for performance monitoring

// Create the stats HUD if available (loaded via CDN in index.html)
function ensureStats() {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') return;

    // If already created, nothing to do
    if (stats) return;

    // If Stats is available, create it now
    if (window.Stats) {
        // Create new Stats object
        stats = new window.Stats();
        // Show FPS panel (0: FPS, 1: MS, 2: MB)
        stats.showPanel(0); 
        // Add stats DOM element to document body
        document.body.appendChild(stats.dom);
        // Position stats in top-left corner
        stats.dom.style.position = 'fixed';
        stats.dom.style.left = '0px';
        stats.dom.style.top = '0px';
        // Set high z-index to ensure it's on top
        stats.dom.style.zIndex = '2002';
        // Expose globally for access from levels
        window.__stats = stats; 
        return;
    }

    // Fallback: try to load from an alternate CDN once
    if (!window.__statsLoadAttempted) {
        // Mark that we've attempted to load stats
        window.__statsLoadAttempted = true;
        // Create script element for stats.js
        const script = document.createElement('script');
        // Set CDN URL for stats.js
        script.src = 'https://unpkg.com/stats.js@0.17.0/build/stats.min.js';
        // Load script asynchronously
        script.async = true;
        // On successful load, try to create stats again
        script.onload = () => {
            // Try again after script loads
            try { ensureStats(); } catch (e) { /* noop */ }
        };
        // Handle loading errors
        script.onerror = () => {
            console.warn('Failed to load stats.js from fallback CDN');
        };
        // Add script to document head
        document.head.appendChild(script);
    }
}

// ---------- Game State ----------
// Tracks which level we're currently in
let currentLevel = 'main'; // Can be 'main', 'level1', 'level2', 'level3'
// Tracks whether we're in Story Mode (3D hub world)
let isInStoryMode = false; // Flag for 3D hub world vs HTML menu

// Initializes the main menu/hub world where player selects levels
function initMainMenu() {
    // Set Story Mode flag to true (we're entering 3D hub world)
    isInStoryMode = true;
    
    // Clean up any existing scene first
    if (scene) {
        // Clear all objects from the scene
        while(scene.children.length > 0) {
            // Remove each child object from scene
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
        // Enable shadow mapping for realistic shadows
        renderer.shadowMap.enabled = true;
        // Use soft shadow mapping for better quality shadows
        renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
        // Add the renderer's canvas element to the webpage
        document.body.appendChild(renderer.domElement);
        // Ensure stats HUD is created
        ensureStats();
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
    // Make sure stats HUD exists and is visible
    ensureStats();
    
    // Debug logging
    console.log('initMainMenu completed');
    console.log('Scene children count:', scene.children.length);
    console.log('Scene children:', scene.children.map(child => child.name || child.type));
    console.log('Renderer canvas:', renderer.domElement);
    console.log('Game loop active:', gameLoopActive);

    // ---------- Lighting ----------
    console.log('Creating lighting...');
    try {
        // Add ambient light for soft, even illumination
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); // White light, 40% intensity
        // Name the light for easy identification
        ambientLight.name = 'ambientLight';
        // Add ambient light to scene
        scene.add(ambientLight);

        // Add directional light to simulate sunlight
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6); // White light, 60% intensity
        // Position light above and to the side
        directionalLight.position.set(10, 20, 10); 
        // Name the light for easy identification
        directionalLight.name = 'directionalLight';
        // Enable shadows for directional light
        directionalLight.castShadow = true;
        // Configure shadow properties for better quality
        directionalLight.shadow.mapSize.width = 1024; // Shadow map resolution
        directionalLight.shadow.mapSize.height = 1024;
        // Set shadow camera bounds
        directionalLight.shadow.camera.left = -20;
        directionalLight.shadow.camera.right = 20;
        directionalLight.shadow.camera.top = 20;
        directionalLight.shadow.camera.bottom = -20;
        // Set shadow camera near and far planes
        directionalLight.shadow.camera.near = 0.1;
        directionalLight.shadow.camera.far = 50;
        // Add directional light to scene
        scene.add(directionalLight);

        console.log('Lighting created and added to scene');
    } catch (error) {
        console.error('Error creating lighting:', error);
    }

    // ---------- Resize ----------
    // Add event listener to handle browser window resizing
    window.addEventListener("resize", onWindowResize);

    // ---------- Player ----------
    console.log('Creating player...');
    try {
        // Create GLTF loader for 3D models
        const loader = new GLTFLoader();

        // Load the idle model (base character model)
        loader.load(
            // Path to character idle animation model
            './character_idle.glb',
            // Success callback
            (gltf) => {
                // Get the 3D scene from loaded GLTF
                const player = gltf.scene;

                // Name the player object for easy access
                player.name = 'player';
                // Position player so bottom is on ground (y = height/2)
                player.position.set(3, 0.5, -9); 
                // Set initial scale
                player.scale.set(1.5, 1.5, 1.5); 
                // Enable shadows for all meshes in player model
                player.traverse((child) => {
                    // Check if child is a mesh
                    if (child.isMesh) {
                        // Enable mesh to cast shadows
                        child.castShadow = true;
                        // Enable mesh to receive shadows
                        child.receiveShadow = true;
                    }
                });

                // Add BoxHelper to visualize player bounding box
                const playerBoxHelper = new THREE.BoxHelper(player, 0xffff00); // Yellow color
                playerBoxHelper.name = 'playerBoxHelper';
                scene.add(playerBoxHelper);
        
                // Store reference to box helper for updates
                scene.userData.playerBoxHelper = playerBoxHelper;

                // Add player to scene
                scene.add(player);

                // Set up animation mixer if animations exist
                if (gltf.animations.length > 0) {
                    // Create animation mixer for player
                    const playerMixer = new THREE.AnimationMixer(player);
                    // Store mixer in scene userData for access
                    scene.userData.playerMixer = playerMixer;

                    // Store idle animation
                    const idleAction = playerMixer.clipAction(gltf.animations[0]);
                    // Play idle animation
                    idleAction.play();
                    // Store current and idle actions
                    scene.userData.currentAction = idleAction;
                    scene.userData.idleAction = idleAction;

                    // Load walk animation separately
                    loader.load(
                        // Path to character walk animation model
                        './character_walk.glb',
                        // Success callback for walk animation
                        (walkGltf) => {
                            // Check if walk animations exist
                            if (walkGltf.animations.length > 0) {
                                // Create walk animation action
                                const walkAction = playerMixer.clipAction(walkGltf.animations[0]);
                                // Set walk animation to loop repeatedly
                                walkAction.setLoop(THREE.LoopRepeat);
                                // Store walk action in scene userData
                                scene.userData.walkAction = walkAction;
                            }
                        },
                        // Progress callback (undefined - not used)
                        undefined,
                        // Error callback
                        (error) => {
                            console.error('Error loading walk animation:', error);
                        }
                    );
                }

                console.log('Player model and animations loaded');
            },
            // Progress callback
            (xhr) => {
                // Log loading progress
                console.log('Loading character: ' + (xhr.loaded / xhr.total) * 100 + '% loaded');
            },
            // Error callback
            (error) => {
                console.error('Error loading character_idle.glb:', error);
            }
        );

        console.log('Player creation initiated (loading async)');
    } catch (error) {
        console.error('Error setting up player:', error);
    }

    // ---------- Ground (now a GLB model) ----------
console.log('Loading basement GLB as ground...');
try {
    const loader = new GLTFLoader();

    // Load the basement model that will act as the floor / environment
    loader.load(
        './the_basement.glb',               // <-- your model
        (gltf) => {
            const basement = gltf.scene;

            // Give it a name for debugging / future reference
            basement.name = 'basement';

            // OPTIONAL: scale / position tweaks
            basement.scale.set(1, 1, 1);
            basement.position.set(0, 0, 0);

            // Enable shadows for every mesh inside the model
            basement.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;

                    // Fix possible missing .layers (same as arcades)
                    if (child.layers === undefined) {
                        child.layers = new THREE.Layers();
                    }
                }
            });

            // Also set layers on the root object
            if (basement.layers === undefined) {
                basement.layers = new THREE.Layers();
            }

            // Add to the scene
            scene.add(basement);

            // ---------- Debug BoxHelper ----------
            const basementBoxHelper = new THREE.BoxHelper(basement, 0xffff00); // yellow
            basementBoxHelper.name = 'basementBoxHelper';
            scene.add(basementBoxHelper);
            scene.userData.groundBoxHelper = basementBoxHelper;   // keep reference

            // ---------- Collision Box ----------
            const groundBox = new THREE.Box3().setFromObject(basement);
            // Shrink a tiny bit so the player doesn’t “stick” on edges
            groundBox.expandByVector(new THREE.Vector3(-0.05, -0.05, -0.05));
            groundBox.name = 'groundBox';
            scene.userData.groundBox = groundBox;

            console.log('Basement GLB loaded and added as ground');
        },
        (xhr) => {
            console.log(`Loading the_basement.glb: ${(xhr.loaded / xhr.total * 100).toFixed(2)}%`);
        },
        (error) => {
            console.error('Error loading the_basement.glb:', error);
        }
    );

    console.log('Basement GLB loading initiated');
} catch (error) {
    console.error('Error setting up basement ground:', error);
}

   // ---------- Arcade placeholders ----------
console.log('Creating arcade machines...');
try {
    // Arrays to store arcade machines and their labels
    const arcades = [];
    const arcadeLabels = [];
    // Names to display on each machine
    const arcadeNames = ["Level 1", "Level 2", "Level 3"];
    // Color names for interaction prompts
    const arcadeColorNames = ["Red", "Blue", "Yellow"];
    // GLB file names (must be placed in the same folder as this script)
    const arcadeGLB = ["./arcade_1.glb", "./arcade_2.glb", "./arcade_3.glb"];

    const loader = new GLTFLoader();

    // Create three arcade machines by loading the GLB files
    for (let i = 0; i < 3; i++) {
        loader.load(
            arcadeGLB[i],
            (gltf) => {
                const arcade = gltf.scene;

                // Position arcades in a row: (-3,0,-10), (0,0,-10), (3,0,-10)
                arcade.position.set(i * 3 - 3, 0, -10);

                // Store level number (1, 2, or 3) in userData
                arcade.userData.level = i + 1;
                arcade.userData.colorName = arcadeColorNames[i];

                // Give each arcade a unique name
                arcade.name = `arcade-${i + 1}`;

                // Enable shadows for all meshes inside the model
               // Inside loader.load() success callback, after `const arcade = gltf.scene;`
arcade.traverse((child) => {
    if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        // Fix: Ensure layers exists
        if (child.layers === undefined) {
            child.layers = new THREE.Layers();
        }
    }
});

// Also set on root
if (arcade.layers === undefined) {
    arcade.layers = new THREE.Layers();
}

                // Add to scene
                scene.add(arcade);
                arcades[i] = arcade;               // keep reference in correct order
                scene.userData.arcades = arcades; // update scene reference

                // ---------- BoxHelper (visual debug) ----------
                const arcadeBoxHelper = new THREE.BoxHelper(arcade, 0x00ff00);
                arcadeBoxHelper.name = `arcadeBoxHelper-${i + 1}`;
                scene.add(arcadeBoxHelper);

                scene.userData.arcadeBoxHelpers = scene.userData.arcadeBoxHelpers || [];
                scene.userData.arcadeBoxHelpers[i] = arcadeBoxHelper;

                // ---------- Label ----------
                const textDiv = document.createElement('div');
                textDiv.className = 'arcade-label';
                textDiv.textContent = arcadeNames[i];
                textDiv.style.color = 'white';
                textDiv.style.fontFamily = 'Arial, sans-serif';
                textDiv.style.fontSize = '16px';
                textDiv.style.fontWeight = 'bold';
                textDiv.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
                textDiv.style.pointerEvents = 'none';
                textDiv.style.textAlign = 'center';
                textDiv.style.whiteSpace = 'nowrap';

                const label = new CSS2DObject(textDiv);
                label.position.set(0, 1.5, 0);               // adjust if model height differs
                arcade.add(label);
                arcadeLabels[i] = label;

                // ---------- Collision Box ----------
                const arcadeBox = new THREE.Box3().setFromObject(arcade, false);
                arcadeBox.expandByVector(new THREE.Vector3(-0.05, -0.05, -0.05));
                scene.userData.arcadeBoxes = scene.userData.arcadeBoxes || [];
                scene.userData.arcadeBoxes[i] = arcadeBox;
            },
            (xhr) => {
                console.log(`Loading ${arcadeGLB[i]}: ` + (xhr.loaded / xhr.total * 100) + '%');
            },
            (error) => {
                console.error(`Error loading ${arcadeGLB[i]}:`, error);
            }
        );
    }

    console.log('Arcade GLB loading initiated');
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
        // Ensure stats HUD exists
        ensureStats();
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
    
    // 3. Update game state to track current level
    currentLevel = `level${levelNumber}`;
    
    // 4. Hide HTML menu screens when loading a level (so level UI is visible)
    if (window.hideAllMenuScreens) {
        // Call global function to hide menus
        window.hideAllMenuScreens();
    }
    
    // 5. Show the canvas elements
    if (renderer && renderer.domElement) {
        // Show WebGL canvas
        renderer.domElement.style.display = 'block';
    }
    if (labelRenderer && labelRenderer.domElement) {
        // Show label canvas
        labelRenderer.domElement.style.display = 'block';
    }
    
    // Ensure stats HUD exists and is visible in levels too
    ensureStats();

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
    
    // Show main menu
    if (window.showMainMenu) {
        // Call global function to show main menu
        window.showMainMenu();
    }
}

// Returns player from Story Mode back to main menu (without hiding canvas)
function returnToMainMenuFromStory() {
    // Clean up the current level
    cleanupCurrentLevel();
    // Update game state to main menu
    currentLevel = 'main';
    // Keep Story Mode flag set (we're staying in 3D hub world)
    
    // Don't call showMainMenu() - we want to stay in the 3D hub world
    // The 3D scene should already be visible and the hub world should be active
}

// Cleans up resources when leaving a level or the game
function cleanupCurrentLevel() {
    // Stop and clear animation mixer
    if (scene.userData.playerMixer) {
        // Stop all animations
        scene.userData.playerMixer.stopAllAction();
        // Clear mixer reference
        scene.userData.playerMixer = null;
    }
    // Clear animation references
    scene.userData.playerAnimations = null;
    scene.userData.currentAnimation = null;
    scene.userData.currentAction = null;

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
    
    // 3. Remove all event listeners
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("keyup", handleKeyUp);
    document.removeEventListener("pointerlockchange", onPointerLockChange);
    document.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("resize", onWindowResize);

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
    const uiElements = document.querySelectorAll('.game-ui');
    // Loop through all game UI elements
    uiElements.forEach(el => {
        // Check if element is part of main menu (not level-specific)
        const isMainMenuElement = el.closest('#main-menu, #play-submenu, #level-select, #settings, #credits, #instructions, #pause-menu');
        if (!isMainMenuElement) {
            // Remove level-specific UI elements
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
    // Add class for easy identification and cleanup
    interactionPrompt.className = "game-ui";
    // Style the prompt with CSS text for better performance
    interactionPrompt.style.cssText = `
        position: absolute; top: 60%; left: 50%; transform: translate(-50%, -50%); 
        color: white; font-family: Arial, sans-serif; font-size: 20px; font-weight: bold; 
        text-shadow: 2px 2px 4px rgba(0,0,0,0.8); pointer-events: none; z-index: 10; 
        text-align: center; opacity: 0; transition: opacity 0.3s ease;
    `;
    // Set default prompt text
    interactionPrompt.textContent = "E to interact";
    // Add prompt to document
    document.body.appendChild(interactionPrompt);

    // Crosshair (className 'game-ui' for easy cleanup)
    const crosshair = document.createElement("div");
    // Add class for easy identification and cleanup
    crosshair.className = "game-ui";
    // Style crosshair
    crosshair.style.cssText = `
        position: absolute; top: 50%; left: 50%; width: 20px; height: 20px; 
        margin-left: -10px; margin-top: -10px; pointer-events: none; z-index: 10;
    `;
    // Create crosshair using HTML divs
    crosshair.innerHTML = `
        <div style="position:absolute;top:9px;left:0;width:20px;height:2px;background:white"></div>
        <div style="position:absolute;top:0;left:9px;width:2px;height:20px;background:white"></div>
    `;
    // Add crosshair to document
    document.body.appendChild(crosshair);

    // Store interaction system data in scene for easy access
    scene.userData.interactionPrompt = interactionPrompt;
    scene.userData.currentInteractable = currentInteractable;
    scene.userData.raycaster = raycaster;
    scene.userData.mouse = mouse;
}

// Checks if player is looking at an interactive object and close enough to interact
// Checks if player is looking at an interactive object and close enough to interact
function checkInteractions() {
    // Only check interactions in main menu, not during levels
    if (currentLevel !== 'main') return;
    
    const { raycaster, mouse, interactionPrompt } = scene.userData;
    
    // SAFETY: Ensure arcades array exists
    const arcades = scene.userData.arcades;
    if (!arcades || arcades.length === 0) {
        interactionPrompt.style.opacity = "0";
        scene.userData.currentInteractable = null;
        return;
    }
    
    // Raycast from center of screen
    raycaster.setFromCamera(mouse, camera);

    // SAFE: Filter out objects without .layers to prevent Three.js crash
    const validArcades = arcades.filter(arcade => arcade.layers !== undefined);
    
    // If no valid arcades, skip raycast
    if (validArcades.length === 0) {
        interactionPrompt.style.opacity = "0";
        scene.userData.currentInteractable = null;
        return;
    }

    // Perform raycast (recursive = true)
    const intersects = raycaster.intersectObjects(validArcades, true);

    const player = scene.getObjectByName('player');
    
    if (intersects.length > 0 && player) {
        const hitObject = intersects[0].object;
        
        // Traverse up to find root arcade (named arcade-1, arcade-2, etc.)
        let arcade = hitObject;
        while (arcade && !arcade.name.startsWith('arcade-')) {
            arcade = arcade.parent;
        }
        
        if (!arcade || !arcade.userData.level) return;

        const distance = player.position.distanceTo(arcade.position);
        
        if (distance <= 3) {
            interactionPrompt.textContent = `E to interact with ${arcade.userData.colorName} machine`;
            interactionPrompt.style.opacity = "1";
            scene.userData.currentInteractable = arcade;
            return;
        }
    }
    
    // No interaction
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
            // Request pointer lock on renderer canvas
            renderer.domElement.requestPointerLock();
        }
    });
}

// Handles key press events
function handleKeyDown(e) {
    // Check for ESC key to show pause menu
    if (e.code === "Escape") {
        // Prevent default browser behavior
        e.preventDefault();
        // Debug logging
        console.log('ESC key pressed, currentLevel:', currentLevel);
        console.log('isGamePaused function available:', !!window.isGamePaused);
        console.log('showPauseMenu function available:', !!window.showPauseMenu);
        
        // Check if game is already paused
        if (window.isGamePaused && window.isGamePaused()) {
            // If already paused, resume
            console.log('Resuming game...');
            window.resumeGame();
        } else {
            // Show pause menu
            console.log('Showing pause menu...');
            // Determine which type of pause menu to show based on current level
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
        // Set space held flag
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
        // Clear space held flag
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
let velocityY = -1;         // Current vertical velocity

// Animation state management
function setAnimation(action) {
    // Get animation components from scene
    const { playerMixer, currentAction } = scene.userData;
    // Return if no mixer or same action already playing
    if (!playerMixer || currentAction === action) return;

    // Fade out current animation if exists
    if (currentAction) {
        currentAction.fadeOut(0.2);
    }

    // Fade in and play new animation
    action.reset().fadeIn(0.2).play();
    // Store new current action
    scene.userData.currentAction = action;
}

// Plays the specified animation if it's not already playing
function playAnimation(state) {
    // Get animation components from scene
    const { playerMixer, idleAction, walkAction, currentAnimation } = scene.userData;
    // Return if no mixer
    if (!playerMixer) return;

    // Only change animation if the state is different
    if (currentAnimation !== state) {
        // Check for walk state and walk action exists
        if (state === 'walk' && walkAction) {
            // Set walk animation
            setAnimation(walkAction);
            // Store current animation state
            scene.userData.currentAnimation = 'walk';
        } else {
            // Set idle animation as default
            setAnimation(idleAction);
            // Store current animation state
            scene.userData.currentAnimation = 'idle';
        }
    }
}

// Updates player position, physics, and animations
function updatePlayer() {
    // Only update player in main menu, not during levels
    if (currentLevel !== 'main') return;

    // Get player object from scene
    const player = scene.getObjectByName('player');
    // Return if no player found
    if (!player) return;

    // Get delta time for frame-rate-independent movement
    const delta = clock.getDelta();

    // Update animation mixer
    if (scene.userData.playerMixer) {
        // Update animation mixer with delta time
        scene.userData.playerMixer.update(delta);
    }

    // Update BoxHelper to match player's current position and rotation
    if (scene.userData.playerBoxHelper) {
        scene.userData.playerBoxHelper.update();
    }

    if (scene.userData.arcadeBoxHelpers) {
        scene.userData.arcadeBoxHelpers.forEach(helper => {
            helper.update();
        });
    }

    // Movement vectors
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    const moveDir = new THREE.Vector3();

    // Calculate forward and right vectors based on yaw
    forward.set(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    // Compute movement direction
    moveDir.set(0, 0, 0);
    // Add forward movement for W or up arrow
    if (keys["w"] || keys["arrowup"]) moveDir.add(forward);
    // Add backward movement for S or down arrow
    if (keys["s"] || keys["arrowdown"]) moveDir.sub(forward);
    // Add right movement for D or right arrow
    if (keys["d"] || keys["arrowright"]) moveDir.add(right);
    // Add left movement for A or left arrow
    if (keys["a"] || keys["arrowleft"]) moveDir.sub(right);

    // Determine player state for animations
    let playerState = 'idle';
    // Check if player is moving
    const isMoving = moveDir.lengthSq() > 0;
    if (isMoving) {
        // Set state to walk if moving
        playerState = 'walk';
    }
    // Check for jump input and conditions
    if (spaceHeld && !spaceLocked && player.position.y <= 0.5) {
        // Set state to jump if jumping
        playerState = 'jump';
    }

    // Play appropriate animation
    playAnimation(playerState);

    // Store previous position for collision detection
    const prevPos = player.position.clone();

    // Apply movement if moving
    const moveSpeed = 500; // Match reference code
    if (isMoving) {
        // Normalize movement direction
        moveDir.normalize();
        // Calculate movement in x and z directions
        const moveX = moveDir.x * moveSpeed * delta;
        const moveZ = moveDir.z * moveSpeed * delta;

        // Test movement in x and z separately for directional collision
        const playerBox = new THREE.Box3().setFromObject(player);
        // Shrink playerBox slightly to add tolerance
        playerBox.expandByVector(new THREE.Vector3(-0.1, -0.1, -0.1));

        // Test x movement
        player.position.x += moveX;
        let collisionDetected = false;
        const { arcadeBoxes} = scene.userData;
        
        // Check collision with arcade boxes
        if (arcadeBoxes) {
            for (let box of arcadeBoxes) {
                // Update player box and check intersection
                if (playerBox.setFromObject(player).intersectsBox(box)) {
                    // Log collision details
                    console.log(`Collision with arcade box at (${box.min.x.toFixed(2)}, ${box.min.y.toFixed(2)}, ${box.min.z.toFixed(2)}) to (${box.max.x.toFixed(2)}, ${box.max.y.toFixed(2)}, ${box.max.z.toFixed(2)})`);
                    // Revert x position on collision
                    player.position.x = prevPos.x;
                    player.position.z = prevPos.z;
                    collisionDetected = true;
                    break;
                }
            }
        }

        // Test z movement (only if x movement didn't collide, or test independently)
        if (!collisionDetected) {
            // Apply z movement
            player.position.z += moveZ;
            // Update player box for new position
            playerBox.setFromObject(player); 
            // Check collision with arcade boxes
            if (arcadeBoxes) {
                for (let box of arcadeBoxes) {
                    if (playerBox.intersectsBox(box)) {
                        // Log collision details
                        console.log(`Collision with arcade box at (${box.min.x.toFixed(2)}, ${box.min.y.toFixed(2)}, ${box.min.z.toFixed(2)}) to (${box.max.x.toFixed(2)}, ${box.max.y.toFixed(2)}, ${box.max.z.toFixed(2)})`);
                        // Revert z position on collision
                        player.position.z = prevPos.z;
                        break;
                    }
                }
            }
        }

        // Rotate character to face movement direction
        if (moveDir.length() > 0.001) {
            // Calculate target angle from movement direction
            const targetAngle = Math.atan2(moveDir.x, moveDir.z);
            // Set player rotation to face movement direction
            player.rotation.y = targetAngle;
        }
    }

    // Apply gravity to vertical velocity
    // velocityY += gravity;
    // Apply vertical velocity to player position
    player.position.y = player.position.y + velocityY;
    console.log(velocityY);


    // Check collision with ground
    const { groundBox } = scene.userData;
    const playerBox = new THREE.Box3().setFromObject(player);
    let collisionDetected = false;
        if (groundBox) {
                // Update player box and check intersection
                if (playerBox.setFromObject(player).intersectsBox(groundBox)) {
                    // Log collision details
                    console.log(`Collision with ground`);
                    // Revert x position on collision
                    player.position.y = prevPos.y;
                    collisionDetected = true;
                }
        }


    // Ground collision and jump
    if (player.position.y <= 0.01) {
        // Snap player to ground
        player.position.y = 0.01;
        // Reset vertical velocity
        velocityY = 0;
        // Check for jump input
        if (spaceHeld && !spaceLocked) {
            // Apply jump strength to vertical velocity
            velocityY = jumpStrength;
            // Lock jump to prevent auto-repeat
            spaceLocked = true;
        }
    }

    // Update camera to follow player
    updateCamera(player);
}

// Updates camera position to follow player with third-person view
function updateCamera(player) {
    const cameraDistance = 3;        // How far behind player the camera stays
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
    // Begin stats measurement
    if (stats) stats.begin();
    // Check if game loop is active and game is not paused
    if (gameLoopActive && !window.isGamePaused()) {
        // Update animation mixer if exists
        if (scene.userData.playerMixer) {
            scene.userData.playerMixer.update(clock.getDelta());
        }

        // Update main menu specific logic
        if (currentLevel === 'main') {
            updatePlayer();
            checkInteractions();
            handleInteraction();
        }
        
        // Update level-specific logic if exists
        if (currentLevelModule && currentLevelModule.updateLevel) {
            currentLevelModule.updateLevel();
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
    // End stats measurement
    if (stats) stats.end();
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
    // Set game loop active
    gameLoopActive = true;
    // Restart animation loop
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