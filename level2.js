// level2.js - Arcade Racing Game Integration
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
let collidersVisible = true;

// Boost effect tracking
let wasBoostingLastFrame = false;

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
    
    // Initialize Lighting System
    lightingSystem = new LightingSystem(scene, uiSystem);
    lightingSystem.init();
    
    // Expose toggleDayNight globally for the UI button
    window.toggleDayNight = () => {
        if (lightingSystem) {
            lightingSystem.toggleDayNight();
        }
    };
    
    // Initialize Car Physics System
    carPhysicsSystem = new CarPhysicsSystem(scene, world);
    
    // Initialize Environment System
    environmentSystem = new EnvironmentSystem(scene, world);
    environmentSystem.setOnModelLoadedCallback(onEnvironmentModelLoaded);
    
    // Load the car model
    environmentSystem.loadModel('./level2/Car.glb');
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
            <div>Direction: <span id="wheel-direction">Straight</span></div>
            <div>Heading: <span id="car-heading">0°</span></div>
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
    
    // Create day/night toggle button if it doesn't exist
    if (!document.getElementById('toggle-daynight')) {
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'toggle-daynight';
        toggleBtn.className = 'toggle-btn game-ui';
        toggleBtn.textContent = 'Toggle Day/Night (H)';
        toggleBtn.onclick = () => { if(window.toggleDayNight) window.toggleDayNight(); };
        toggleBtn.style.display = 'block';
        document.body.appendChild(toggleBtn);
        console.log('✅ Created toggle-daynight');
    } else {
        document.getElementById('toggle-daynight').style.display = 'block';
        console.log('✅ Showed existing toggle-daynight');
    }
    
    // Create collider toggle button if it doesn't exist
    if (!document.getElementById('toggle-colliders')) {
        const toggleCollidersBtn = document.createElement('button');
        toggleCollidersBtn.id = 'toggle-colliders';
        toggleCollidersBtn.className = 'toggle-btn game-ui';
        toggleCollidersBtn.textContent = `Colliders: ${collidersVisible ? 'ON' : 'OFF'} (C)`;
        toggleCollidersBtn.style.display = 'block';
        toggleCollidersBtn.style.top = '120px';
        toggleCollidersBtn.onclick = toggleColliders;
        document.body.appendChild(toggleCollidersBtn);
        console.log('✅ Created toggle-colliders');
    } else {
        const btn = document.getElementById('toggle-colliders');
        btn.style.display = 'block';
        btn.textContent = `Colliders: ${collidersVisible ? 'ON' : 'OFF'} (C)`;
        console.log('✅ Showed existing toggle-colliders');
    }
    
    // Create minimap container if it doesn't exist
    if (!document.getElementById('minimap-container')) {
        const minimapContainer = document.createElement('div');
        minimapContainer.id = 'minimap-container';
        minimapContainer.className = 'game-ui';
        
        const minimapCanvas = document.createElement('canvas');
        minimapCanvas.id = 'minimap';
        minimapCanvas.width = 200;
        minimapCanvas.height = 200;
        
        const minimapOverlay = document.createElement('canvas');
        minimapOverlay.id = 'minimap-overlay';
        minimapOverlay.width = 200;
        minimapOverlay.height = 200;
        
        minimapContainer.appendChild(minimapCanvas);
        minimapContainer.appendChild(minimapOverlay);
        minimapContainer.style.display = 'block';
        document.body.appendChild(minimapContainer);
        console.log('✅ Created minimap-container with canvases');
    } else {
        document.getElementById('minimap-container').style.display = 'block';
        console.log('✅ Showed existing minimap-container');
    }
    
    // Create mobile controls if they don't exist
    if (!document.getElementById('mobile-controls')) {
        const mobileControls = document.createElement('div');
        mobileControls.id = 'mobile-controls';
        mobileControls.className = 'game-ui';
        mobileControls.innerHTML = `
            <div id="joystick-container">
                <div id="joystick-base"></div>
                <div id="joystick-stick"></div>
            </div>
            <div id="mobile-buttons">
                <div class="mobile-btn" id="mobile-boost">⚡</div>
                <div class="mobile-btn" id="mobile-camera">📷</div>
            </div>
        `;
        document.body.appendChild(mobileControls);
        console.log('✅ Created mobile-controls');
    }
    
    console.log('✅ All Level 2 UI elements ready');
}

function hideLevel2UI() {
    console.log('🎮 Hiding Level 2 UI elements...');
    
    const uiElements = [
        'direction-info',
        'toggle-daynight',
        'toggle-colliders',
        'minimap-container',
        'mobile-controls'
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
    
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
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
        if (data.pickupZones && data.pickupZones.length > 0 && 
            data.dropoffZones && data.dropoffZones.length > 0) {
            console.log('✅ Using imported pickup and dropoff zones from model');
            deliverySystem.init({
                pickupZones: data.pickupZones,
                dropoffZones: data.dropoffZones
            });
        } else {
            console.log('ℹ No zones found in model, creating default zones');
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
        carPhysicsOffset = carPhysicsSystem.getPhysicsOffset();
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
        if (window.showPauseMenu) {
            window.showPauseMenu(2);
        } else {
            returnToMainCallback();
        } 
        }
    });
}

function toggleColliders() {
    collidersVisible = !collidersVisible;
    
    console.log(`🔲 Colliders ${collidersVisible ? 'visible' : 'hidden'}`);
    
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
    
    // Update button text to show current state
    const toggleBtn = document.getElementById('toggle-colliders');
    if (toggleBtn) {
        toggleBtn.textContent = `Colliders: ${collidersVisible ? 'ON' : 'OFF'} (C)`;
    }
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

// Cleanup function
export function cleanupLevel() {
    // Hide Level 2 UI elements
    hideLevel2UI();
    
    // Remove global functions
    delete window.toggleDayNight;
    
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
    
    // Reset boost tracking
    wasBoostingLastFrame = false;
}
