// level2.js - Speed Delivery Game Integration
import * as THREE from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Make THREE and related classes available globally for the Arcade game modules
// (The Arcade systems expect these to be global variables)
if (!window.THREE) window.THREE = THREE;
if (!window.OrbitControls) window.OrbitControls = OrbitControls;
if (!window.GLTFLoader) window.GLTFLoader = GLTFLoader;

// Import Arcade game systems
import { EffectsSystem } from './level2/src/effects/EffectsSystem.js';
import { UISystem } from './level2/src/ui/UISystem.js';
import { InputSystem } from './level2/src/input/InputSystem.js';
import { DeliverySystem } from './level2/src/delivery/DeliverySystem.js';
import { LightingSystem } from './level2/src/lighting/LightingSystem.js';
import { CameraSystem } from './level2/src/camera/CameraSystem.js';
import { CarPhysicsSystem } from './level2/src/physics/CarPhysicsSystem.js';
import { EnvironmentSystem } from './level2/src/environment/EnvironmentSystem.js';
import { GameRestartSystem } from './level2/src/game/GameRestartSystem.js';
import { FailureSystem } from './level2/src/game/FailureSystem.js';

let scene, camera, renderer, labelRenderer;
let returnToMainCallback;

// Modular Systems
let effectsSystem = null;
let uiSystem = null;
let inputSystem = null;
let deliverySystem = null;
let lightingSystem = null;
let cameraSystem = null;
let carPhysicsSystem = null;
let environmentSystem = null;

// Game objects
let carWrapper = null;
let frontWheelsGroup = null;
let groundObject = null;
let environmentObjects = [];
let carBody = null;
let carHelper = null;
let carPhysicsOffset = null;
let controls = null;

// Physics
let world;
let groundBody;
let groundHelper;
let timeStep = 1 / 60;
let collidersVisible = false; // Start with colliders off

// Boost effect tracking
let wasBoostingLastFrame = false;

// Game Restart System
let gameRestartSystem = null;
let failureSystem = null;

// Resize handler
let resizeHandler = null;

// Music will be handled by AudioManager (accessible via window.audioManager)

export function initLevel(sceneRef, cameraRef, rendererRef, labelRendererRef, callback) {
    if (!sceneRef || !cameraRef || !rendererRef || !labelRendererRef) {
        console.error('Missing required references!');
        return;
    }
    
    scene = sceneRef;
    camera = cameraRef;
    renderer = rendererRef;
    labelRenderer = labelRendererRef;
    returnToMainCallback = callback;

    // Clear the scene
    while(scene.children.length > 0) { 
        scene.remove(scene.children[0]); 
    }
    
    setupLevel();
}

function setupLevel() {
    // Initialize physics world
    initPhysics();
    
    // Setup renderer for shadows
    setupRenderer();
    
    // Setup shadow ground
    setupShadowGround();
    
    // Show Level 2 UI elements
    showLevel2UI();
    
    // Initialize Game Restart System (systems will be set when initialized)
    gameRestartSystem = new GameRestartSystem(
        scene,
        null, // carWrapper - will be set when car loads
        null, // carBody - will be set when car loads
        null, // carPhysicsSystem - will be set when initialized
        null, // deliverySystem - will be set when initialized
        null, // cameraSystem - will be set when initialized
        null, // uiSystem - will be set when initialized
        null  // lightingSystem - will be set when initialized
    );
    
    // Initialize Failure System (deliverySystem will be set when initialized)
    failureSystem = new FailureSystem(
        scene,
        null, // deliverySystem - will be set when initialized
        gameRestartSystem
    );
    failureSystem.init();
    window.failureSystem = failureSystem; // Make globally accessible for collision handler
    
    // Initialize Camera System (pass existing camera from main.js)
    cameraSystem = new CameraSystem(scene, renderer, camera);
    cameraSystem.init();
    // camera is already set from initLevel, just get controls
    controls = cameraSystem.getControls();
    
    // Initialize Effects System
    effectsSystem = new EffectsSystem(scene, camera);
    effectsSystem.init();
    
    // Initialize UI System
    uiSystem = new UISystem(scene);
    uiSystem.init();
    
    // Initialize Input System
    inputSystem = new InputSystem();
    setupInputCallbacks();
    inputSystem.init();
    
    // Initialize Delivery System (will be initialized later with zones from model)
    deliverySystem = new DeliverySystem(scene, uiSystem);
    
    // Update failure system with delivery system
    if (failureSystem) {
        failureSystem.deliverySystem = deliverySystem;
    }
    
    // Update restart system references with initialized systems
    if (gameRestartSystem) {
        gameRestartSystem.updateReferences(
            null, // carWrapper - will be set when car loads
            null, // carBody - will be set when car loads
            carPhysicsSystem,
            deliverySystem,
            cameraSystem,
            uiSystem,
            null  // lightingSystem - will be set when initialized
        );
    }
    
    // Get Story Mode status from scene.userData (set by main.js)
    const isInStoryMode = scene && scene.userData && scene.userData.isInStoryMode === true;
    
    // Set completion callback for when level is completed
    deliverySystem.setOnComplete(() => {
        console.log('🎉 Level 2 completed! Returning to hub world...');
        console.log('   returnToMainCallback available:', !!returnToMainCallback);
        if (returnToMainCallback) {
            console.log('   Calling returnToMainCallback()...');
            returnToMainCallback();
        } else {
            console.error('⚠️ returnToMainCallback is null! Cannot return to hub.');
        }
    }, isInStoryMode); // Pass Story Mode status to hide button if in Story Mode
    
    // Initialize Lighting System
    lightingSystem = new LightingSystem(scene, uiSystem);
    lightingSystem.init();
    
    // Update restart system with lighting system
    if (gameRestartSystem) {
        gameRestartSystem.updateReferences(
            null, // carWrapper - will be set when car loads
            null, // carBody - will be set when car loads
            carPhysicsSystem,
            deliverySystem,
            cameraSystem,
            uiSystem,
            lightingSystem
        );
    }
    
    // Initialize Car Physics System
    carPhysicsSystem = new CarPhysicsSystem(scene, world);
    
    // Initialize Environment System
    environmentSystem = new EnvironmentSystem(scene, world);
    environmentSystem.setOnModelLoadedCallback(onEnvironmentModelLoaded);
    
    // Start level 2 music via AudioManager
    if (window.audioManager) {
        // Register level 2 music if not already registered (mono: true to play same in both ears)
        if (!window.audioManager.musicTracks['level2']) {
            window.audioManager.registerMusic('level2', 'assets/audio/music/The Sluts With Nuts - Mike and Ron Jam.mp3', true, true);
        }
        window.audioManager.playMusic('level2');
        
        // Register sound effects for Level 2 if not already registered
        if (!window.audioManager.soundEffects['complete']) {
            window.audioManager.registerSoundEffect('complete', 'assets/audio/effects/Complete.wav', 0.3);
        }
        if (!window.audioManager.soundEffects['carEngine']) {
            window.audioManager.registerSoundEffect('carEngine', 'assets/audio/cars/Car2_Engine_Loop.ogg', 0.01);
        }
        if (!window.audioManager.soundEffects['pop']) {
            window.audioManager.registerSoundEffect('pop', 'assets/audio/effects/pop.wav', 0.5);
        }
        
        // Start car engine sound (looping)
        window.audioManager.playSoundEffect('carEngine', { loop: true });
    }
    
    // Load the car model
    environmentSystem.loadModel('./level2/Car.glb');
    
    // Set up window resize handler
    setupResizeHandler();
}

/**
 * Sets up window resize handler for Level 2
 */
function setupResizeHandler() {
    // Remove existing handler if any
    if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
    }
    
    // Create new resize handler
    resizeHandler = () => {
        if (!renderer || !camera || !labelRenderer) return;
        
        // Update camera aspect ratio
        if (camera.isPerspectiveCamera) {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
        }
        
        // Update renderer size
        renderer.setSize(window.innerWidth, window.innerHeight);
        
        // Update label renderer size
        labelRenderer.setSize(window.innerWidth, window.innerHeight);
        
        // Update camera system if available
        if (cameraSystem && cameraSystem.handleResize) {
            cameraSystem.handleResize();
        }
    };
    
    // Add event listener
    window.addEventListener('resize', resizeHandler);
    
    console.log('✅ Level 2 resize handler set up');
}

/**
 * Creates and shows Level 2 UI elements
 * Elements are created dynamically to avoid conflicts with main.js cleanup
 * that removes .game-ui elements when returning to menu
 */
function showLevel2UI() {
    console.log('🎮 Creating/Showing Level 2 UI elements...');
    
    // Create impact flash if it doesn't exist
    if (!document.getElementById('impact-flash')) {
        const impactFlash = document.createElement('div');
        impactFlash.id = 'impact-flash';
        document.body.appendChild(impactFlash);
        console.log('✅ Created impact-flash');
    }
    
    // Create direction info panel if it doesn't exist
    if (!document.getElementById('direction-info')) {
        const directionInfo = document.createElement('div');
        directionInfo.id = 'direction-info';
        directionInfo.className = 'game-ui';
        directionInfo.innerHTML = `
            <div>FPS: <span id="fps">60</span></div>
            <div>Speed: <span id="car-speed">0.0</span></div>
            <div id="headlights-ui" style="display: none;">Headlights: <span id="headlights-status">OFF</span></div>
            <div>
                Boost: <span id="boost-status">OFF</span>
                <div class="boost-bar-container">
                    <div class="boost-bar-fill" id="boost-bar-fill"></div>
                </div>
                <span id="boost-percentage">100%</span>
            </div>
            <div>Camera: <span id="camera-mode">Behind Car</span></div>
            <div>Delivery: <span id="delivery-status">Find Yellow Zone</span></div>
        `;
        directionInfo.style.display = 'block';
        document.body.appendChild(directionInfo);
        console.log('✅ Created direction-info');
    } else {
        document.getElementById('direction-info').style.display = 'block';
        console.log('✅ Showed existing direction-info');
    }
    
    // Create keybinds display in bottom left
    if (!document.getElementById('keybinds-display')) {
        const keybindsDisplay = document.createElement('div');
        keybindsDisplay.id = 'keybinds-display';
        keybindsDisplay.className = 'game-ui';
        keybindsDisplay.innerHTML = `
            <div style="font-family: 'Jersey 10', sans-serif; font-size: 14px; font-weight: normal; color: #fff; background: rgba(0,0,0,0.7); padding: 10px; border-radius: 5px;">
                <div style="font-size: 16px; font-weight: normal; margin-bottom: 8px; color: #00ff00;">KEYBINDS</div>
                <div>W/S: Accelerate/Reverse</div>
                <div>A/D: Steer</div>
                <div>Space: Boost</div>
                <div>Q: Camera Mode</div>
                <div>L: Headlights</div>
                <div>ESC: Pause</div>
            </div>
        `;
        keybindsDisplay.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            z-index: 1000;
            pointer-events: none;
        `;
        document.body.appendChild(keybindsDisplay);
        console.log('✅ Created keybinds display');
    } else {
        document.getElementById('keybinds-display').style.display = 'block';
        console.log('✅ Showed existing keybinds display');
    }
    
    // Create minimap container if it doesn't exist
    if (!document.getElementById('minimap-container')) {
        const minimapContainer = document.createElement('div');
        minimapContainer.id = 'minimap-container';
        minimapContainer.className = 'game-ui';
        
        const minimapCanvas = document.createElement('canvas');
        minimapCanvas.id = 'minimap';
        minimapCanvas.width = 240;
        minimapCanvas.height = 240;
        
        const minimapOverlay = document.createElement('canvas');
        minimapOverlay.id = 'minimap-overlay';
        minimapOverlay.width = 240;
        minimapOverlay.height = 240;
        
        minimapContainer.appendChild(minimapCanvas);
        minimapContainer.appendChild(minimapOverlay);
        minimapContainer.style.display = 'block';
        document.body.appendChild(minimapContainer);
        console.log('✅ Created minimap-container with canvases');
    } else {
        document.getElementById('minimap-container').style.display = 'block';
        console.log('✅ Showed existing minimap-container');
    }
    
    console.log('✅ All Level 2 UI elements ready');
}

function hideLevel2UI() {
    console.log('🎮 Hiding Level 2 UI elements...');
    
    const uiElements = [
        'direction-info',
        'keybinds-display',
        'minimap-container'
    ];
    
    uiElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.style.display = 'none';
            console.log(`✅ Hid ${id}`);
        }
    });
}

function initPhysics() {
    // Create CANNON.js physics world
    world = new CANNON.World();
    world.gravity.set(0, -9.8, 0); // Match Arcade: Lower gravity
    world.broadphase = new CANNON.NaiveBroadphase();
    world.solver.iterations = 10;
    
    // Trackmania-style: Low friction for sliding (from Arcade)
    world.defaultContactMaterial.friction = 0.05;
    world.defaultContactMaterial.restitution = 0;
    
    // Create ground physics body with low friction (from Arcade)
    const groundShape = new CANNON.Plane();
    groundBody = new CANNON.Body({
        mass: 0,
        shape: groundShape,
        material: new CANNON.Material({ friction: 0.05, restitution: 0 })
    });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    groundBody.position.y = 0;
    world.addBody(groundBody);
    
    // Create visual helper for ground collision plane
    const helperGeometry = new THREE.PlaneGeometry(200, 200);
    const helperMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00ff00, 
        wireframe: true,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
    });
    groundHelper = new THREE.Mesh(helperGeometry, helperMaterial);
    groundHelper.rotation.x = -Math.PI / 2;
    groundHelper.position.y = 0;
    groundHelper.visible = collidersVisible;
    scene.add(groundHelper);
}

function setupRenderer() {
    if (!renderer) return;
    
    // Save original renderer settings before modifying them
    originalRendererSettings.toneMapping = renderer.toneMapping;
    originalRendererSettings.toneMappingExposure = renderer.toneMappingExposure;
    // Use outputColorSpace instead of deprecated outputEncoding
    originalRendererSettings.outputColorSpace = renderer.outputColorSpace || null;
    originalRendererSettings.logarithmicDepthBuffer = renderer.logarithmicDepthBuffer;
    
    console.log('💾 Saved original renderer settings:', originalRendererSettings);
    
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    
    const maxPixelRatio = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(maxPixelRatio);
    
    renderer.logarithmicDepthBuffer = true;
}

function setupShadowGround() {
    const shadowGroundGeometry = new THREE.PlaneGeometry(200, 200);
    const shadowGroundMaterial = new THREE.ShadowMaterial({
        opacity: 0.3,
        side: THREE.DoubleSide
    });
    const shadowGround = new THREE.Mesh(shadowGroundGeometry, shadowGroundMaterial);
    shadowGround.rotation.x = -Math.PI / 2;
    shadowGround.position.y = 0;
    shadowGround.receiveShadow = true;
    shadowGround.renderOrder = -1;
    shadowGroundMaterial.depthWrite = false;
    shadowGroundMaterial.polygonOffset = true;
    shadowGroundMaterial.polygonOffsetFactor = -1;
    shadowGroundMaterial.polygonOffsetUnits = -1;
    
    scene.add(shadowGround);
    window.shadowGroundPlane = shadowGround;
}

function onEnvironmentModelLoaded(data) {
    carWrapper = data.carWrapper;
    groundObject = data.groundObject;
    environmentObjects = data.environmentObjects;
    frontWheelsGroup = data.frontWheelsGroup;
    
    // Initialize delivery zones with imported zones if available
    if (deliverySystem) {
        // Set lighting system reference for day/night transitions
        if (lightingSystem) {
            deliverySystem.setLightingSystem(lightingSystem);
        }
        
        if (data.pickupZones && data.pickupZones.length > 0 && 
            data.dropoffZones && data.dropoffZones.length > 0) {
            deliverySystem.init({
                pickupZones: data.pickupZones,
                dropoffZones: data.dropoffZones,
                refuelZones: data.refuelZones || []
            });
        } else {
            deliverySystem.init();
        }
    }
    
    const groundBBox = environmentSystem.setupGround();
    if (groundBBox) {
        const groundTopY = groundBBox.max.y;
        const groundLevel = groundTopY + 1.5;
        
        if (cameraSystem) {
            cameraSystem.setGroundLevel(groundLevel);
        }
        
        groundBody.position.y = groundTopY;
        
        if (groundHelper) {
            groundHelper.position.y = groundTopY;
        }
        
        if (window.shadowGroundPlane) {
            window.shadowGroundPlane.position.y = groundTopY + 0.02;
        }
        
        if (deliverySystem) {
            deliverySystem.updateZonePositions(groundTopY);
        }
    } else {
        console.warn('⚠ Could not calculate ground bounding box - using default Y=0');
        const groundLevel = 1.5;
        if (cameraSystem) {
            cameraSystem.setGroundLevel(groundLevel);
        }
    }
    
    if (lightingSystem) {
        lightingSystem.createHeadlights(carWrapper);
        
        // Create gas station lights if any were detected
        if (data.gasStationLights) {
            lightingSystem.createGasStationLights(data.gasStationLights);
        }
    }
    
    if (carPhysicsSystem) {
        carPhysicsSystem.createPhysicsBody(carWrapper);
        carBody = carPhysicsSystem.getPhysicsBody();
        carHelper = carPhysicsSystem.getCollisionHelper();
        // Car helper is created with visible = false in CarPhysicsSystem
        carPhysicsOffset = carPhysicsSystem.getPhysicsOffset();
        
        // Store initial car position and rotation for restart
        if (carWrapper && gameRestartSystem) {
            const box = new THREE.Box3().setFromObject(carWrapper);
            const center = box.getCenter(new THREE.Vector3());
            const initialPosition = center.clone();
            const initialRotation = carWrapper.quaternion.clone();
            gameRestartSystem.setInitialCarState(initialPosition, initialRotation);
        }
        
        // Update restart system references with loaded car
        if (gameRestartSystem) {
            gameRestartSystem.updateReferences(
                carWrapper,
                carBody,
                carPhysicsSystem,
                deliverySystem,
                cameraSystem,
                uiSystem,
                lightingSystem
            );
        }
    }
    
    environmentSystem.createEnvironmentPhysics(collidersVisible);
    setupCollisionListeners();
    
    if (cameraSystem) {
        cameraSystem.setEnvironmentObjects(environmentObjects);
    }
}

function setupCollisionListeners() {
    if (!carBody) {
        console.warn('Car body not ready for collision listeners');
        return;
    }
    
    let lastCollisionTime = 0;
    const collisionCooldown = 200; // milliseconds between counting collisions
    
    carBody.addEventListener('collide', function(event) {
        const otherBody = event.body;
        
        if (otherBody === groundBody) {
            return;
        }
        
        const contact = event.contact;
        const collisionPoint = new THREE.Vector3(
            contact.bi.position.x,
            contact.bi.position.y,
            contact.bi.position.z
        );
        
        const velocity = new THREE.Vector3(
            carBody.velocity.x,
            carBody.velocity.y,
            carBody.velocity.z
        );
        
        const speed = velocity.length();
        
        if (speed > 3) {
            let color = 0xffaa00;
            if (speed > 8) {
                color = 0xff0000;
            } else if (speed > 5) {
                color = 0xff6600;
            }
            
            // Play pop sound effect for collision
            if (window.audioManager) {
                window.audioManager.playSoundEffect('pop');
            }
            
            // Record collision for scoring (with debounce to prevent double-counting)
            const currentTime = performance.now();
            if (deliverySystem && (currentTime - lastCollisionTime) > collisionCooldown) {
                deliverySystem.recordCollision();
                lastCollisionTime = currentTime;
                
                // Check for failure condition
                if (window.failureSystem) {
                    window.failureSystem.checkFailure();
                }
            }
            
            if (effectsSystem) {
                effectsSystem.createCollisionParticles(collisionPoint, velocity, color);
                const shakeIntensity = Math.min(speed / 10, 1.5);
                effectsSystem.triggerScreenShake(shakeIntensity);
                effectsSystem.triggerImpactFlash(speed);
            }
        }
    });
}

function setupInputCallbacks() {
    inputSystem.setCallbacks({
        onSpeedChange: (speed) => {
            if (carPhysicsSystem) {
                carPhysicsSystem.setSpeed(speed);
            }
        },
        onDirectionChange: (direction) => {
            if (carPhysicsSystem) {
                carPhysicsSystem.setDirection(direction);
            }
        },
        onBoostStart: () => {
            if (carPhysicsSystem) {
                carPhysicsSystem.startBoost();
            }
        },
        onBoostEnd: () => {
            if (carPhysicsSystem) {
                carPhysicsSystem.stopBoost();
            }
        },
        onCameraToggle: () => {
            if (cameraSystem) {
                const newMode = cameraSystem.toggleCameraMode();
                if (uiSystem) {
                    uiSystem.updateCameraModeDisplay(newMode);
                }
            }
        },
        onHeadlightsToggle: () => {
            if (lightingSystem && lightingSystem.isNight()) {
                lightingSystem.toggleHeadlights();
            }
        },
        onCollidersToggle: () => {
            toggleColliders();
        },
        onPause: () => {
            // Always try to show pause menu - don't fall back to returning to main menu
            if (window.showPauseMenu && typeof window.showPauseMenu === 'function') {
                window.showPauseMenu('level2');
            } else if (window.pauseMenu && window.pauseMenu.show) {
                // Fallback: try to show pause menu via main.js pauseMenu instance
                window.pauseMenu.show(2);
            } else {
                // Only if pause menu truly doesn't exist, log a warning (don't return to menu)
                console.warn('⚠️ Pause menu not available - window.showPauseMenu:', !!window.showPauseMenu, 'window.pauseMenu:', !!window.pauseMenu);
            }
        }
    });
}

function toggleColliders() {
    collidersVisible = !collidersVisible;
    
    console.log(`🔲 Colliders ${collidersVisible ? 'visible' : 'hidden'} (F2)`);
    
    if (carHelper) {
        carHelper.visible = collidersVisible;
    }
    
    if (groundHelper) {
        groundHelper.visible = collidersVisible;
    }
    
    environmentObjects.forEach(envObj => {
        if (envObj.object.userData.physicsHelper) {
            envObj.object.userData.physicsHelper.visible = collidersVisible;
        }
    });
}

// Level update function called by main.js animation loop
export function updateLevel() {
    const currentTime = performance.now();
    const deltaTime = (currentTime - (uiSystem ? uiSystem.lastFrameTime : performance.now())) / 1000;
    if (uiSystem) {
        uiSystem.lastFrameTime = currentTime;
    }
    
    if (cameraSystem && carWrapper) {
        cameraSystem.update(deltaTime, carWrapper, carPhysicsOffset);
    }
    
    if (world) {
        world.step(timeStep);
    }
    
    if (carPhysicsSystem && carWrapper) {
        carPhysicsSystem.update(carWrapper, frontWheelsGroup);
        
        if (lightingSystem) {
            lightingSystem.updateShadowCamera(carWrapper);
        }
    }
    
    if (inputSystem) {
        inputSystem.update();
    }
    
    if (carPhysicsSystem) {
        carPhysicsSystem.updateBoost(deltaTime);
    }
    
    if (deliverySystem) {
        deliverySystem.update(deltaTime, carWrapper);
    }
    
    if (effectsSystem && carPhysicsSystem && carWrapper) {
        const isBoosting = carPhysicsSystem.getIsBoosting();
        
        // Trigger boost activation effect when boost starts
        if (isBoosting && !wasBoostingLastFrame) {
            effectsSystem.triggerBoostActivation(carWrapper.position, carWrapper.quaternion);
        }
        
        wasBoostingLastFrame = isBoosting;
        
        // Update effects with boost trail particles and wheel swoosh
        effectsSystem.update(deltaTime, {
            isBoosting: isBoosting,
            carPosition: carWrapper.position,
            carRotation: carWrapper.quaternion,
            carWrapper: carWrapper
        });
    }
    
    if (uiSystem && deliverySystem && cameraSystem && carPhysicsSystem) {
        const gameState = {
            carDirection: carPhysicsSystem.getDirection(),
            carWrapper: carWrapper,
            carBody: carPhysicsSystem.getPhysicsBody(),
            boostAmount: carPhysicsSystem.getBoostAmount(),
            maxBoost: carPhysicsSystem.getMaxBoost(),
            isBoosting: carPhysicsSystem.getIsBoosting(),
            cameraAngle: cameraSystem.getCameraMode(),
            isUserControllingCamera: cameraSystem.isUserControlling(),
            cameraResetInProgress: cameraSystem.isResettingCamera(),
            deliveryState: deliverySystem.getState(),
            pickupLocation: deliverySystem.getPickupLocation(),
            deliveryLocation: deliverySystem.getDeliveryLocation()
        };
        uiSystem.update(deltaTime, gameState);
    }
}

/**
 * Restart Level 2 - Resets all game state to initial conditions
 */
export function restartLevel() {
    // Defer restart to next event loop tick to avoid animation loop conflicts
    // This prevents the FPS doubling issue (see BUG.md)
    setTimeout(() => {
        if (gameRestartSystem) {
            gameRestartSystem.restart();
            // Reset boost effect tracking
            wasBoostingLastFrame = false;
        } else {
            console.warn('⚠️ GameRestartSystem not initialized - cannot restart level');
        }
    }, 0);
}

// Expose restartLevel globally for failure system and other systems
window.restartLevel = restartLevel;

// Store original renderer settings before level 2 modifies them
let originalRendererSettings = {
    toneMapping: null,
    toneMappingExposure: null,
    outputColorSpace: null, // Use outputColorSpace instead of deprecated outputEncoding
    logarithmicDepthBuffer: null
};

// Cleanup function
export function cleanupLevel() {
    // Hide Level 2 UI elements
    hideLevel2UI();
    
    // Restore original renderer settings
    if (renderer && originalRendererSettings.toneMapping !== null) {
        renderer.toneMapping = originalRendererSettings.toneMapping;
        renderer.toneMappingExposure = originalRendererSettings.toneMappingExposure;
        if (originalRendererSettings.outputColorSpace !== null) {
            renderer.outputColorSpace = originalRendererSettings.outputColorSpace;
        }
        if (originalRendererSettings.logarithmicDepthBuffer !== null) {
            renderer.logarithmicDepthBuffer = originalRendererSettings.logarithmicDepthBuffer;
        }
        console.log('✅ Restored renderer settings:', {
            toneMapping: renderer.toneMapping,
            toneMappingExposure: renderer.toneMappingExposure
        });
    }
    
    // Clean up systems
    if (effectsSystem) effectsSystem.cleanup();
    if (uiSystem) uiSystem.cleanup();
    if (inputSystem) inputSystem.cleanup();
    if (deliverySystem) deliverySystem.cleanup();
    if (lightingSystem) lightingSystem.cleanup();
    if (cameraSystem) cameraSystem.cleanup();
    if (carPhysicsSystem) carPhysicsSystem.cleanup();
    if (environmentSystem) environmentSystem.cleanup();
    
    // Clear references
    effectsSystem = null;
    uiSystem = null;
    inputSystem = null;
    deliverySystem = null;
    lightingSystem = null;
    cameraSystem = null;
    carPhysicsSystem = null;
    environmentSystem = null;
    carWrapper = null;
    frontWheelsGroup = null;
    groundObject = null;
    environmentObjects = [];
    carBody = null;
    carHelper = null;
    carPhysicsOffset = null;
    controls = null;
    world = null;
    groundBody = null;
    groundHelper = null;
    
    // Cleanup restart system
    if (gameRestartSystem) {
        gameRestartSystem = null;
    }
    
    // Cleanup failure system
    if (failureSystem) {
        failureSystem.cleanup();
        failureSystem = null;
        window.failureSystem = null;
    }
    
    // Reset boost tracking
    wasBoostingLastFrame = false;
    
    // Stop level 2 music and car engine sound via AudioManager
    if (window.audioManager) {
        window.audioManager.stopMusic('level2');
        window.audioManager.stopSoundEffect('carEngine');
    }
    
    // Remove resize handler
    if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
        resizeHandler = null;
        console.log('✅ Level 2 resize handler removed');
    }
}

