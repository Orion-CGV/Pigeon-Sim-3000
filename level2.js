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
    
    // Initialize Delivery System
    deliverySystem = new DeliverySystem(scene, uiSystem);
    deliverySystem.init();
    
    // Initialize Lighting System
    lightingSystem = new LightingSystem(scene, uiSystem);
    lightingSystem.init();
    
    // Initialize Car Physics System
    carPhysicsSystem = new CarPhysicsSystem(scene, world);
    
    // Initialize Environment System
    environmentSystem = new EnvironmentSystem(scene, world);
    environmentSystem.setOnModelLoadedCallback(onEnvironmentModelLoaded);
    
    // Load the car model
    environmentSystem.loadModel('./level2/Car.glb');
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
    if (window.__stats) window.__stats.begin();
    
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
    
    if (effectsSystem) {
        effectsSystem.update(deltaTime);
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
    
    if (window.__stats) window.__stats.end();
}

// Cleanup function
export function cleanupLevel() {
    // Remove level-specific UI elements
    const uiElements = document.querySelectorAll('.game-ui');
    uiElements.forEach(el => {
        const isMainMenuElement = el.closest('#main-menu, #play-submenu, #level-select, #settings, #credits, #instructions, #pause-menu');
        if (!isMainMenuElement) {
            el.remove();
        }
    });
    
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
}
