// level1.js - City Level with Skyscrapers
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

let scene, camera, renderer, labelRenderer;
let returnToMainCallback;

// Player controls variables (same as main.js)
let keys = {};
let spaceHeld = false;
let spaceLocked = false;
let yaw = 0;
let pitch = 0;
const PI_2 = Math.PI / 2;
const MOUSE_SENS = 0.0025;

// Physics variables (same as main.js)
const speed = 0.15;
const gravity = -0.03;
const jumpStrength = 0.45;
let velocityY = 0;

// Player reference
let player;

// Flying system variables
let isFlying = false;
const FLY_HEIGHT = 10; // Height player floats to when starting to fly
const FLY_SPEED = 0.25; // Speed while flying (faster than walking)
let flyKeyLocked = false; // Prevent rapid toggling

// Dedicated array for collision objects (Optimization)
let collisionBoxes = []; 

export function initLevel(sceneRef, cameraRef, rendererRef, labelRendererRef, callback) {
    scene = sceneRef;
    camera = cameraRef;
    renderer = rendererRef;
    labelRenderer = labelRendererRef;
    returnToMainCallback = callback;

    // Clear the scene (main.js handles most cleanup, but this ensures a clean slate)
    while(scene.children.length > 0) { 
        scene.remove(scene.children[0]); 
    }
    
    // Reset control state for the level
    keys = {};
    spaceHeld = false;
    spaceLocked = false;
    velocityY = 0;
    isFlying = false;
    flyKeyLocked = false;
    
    // Reset camera orientation
    yaw = 0;
    pitch = 0;

    setupLevel1();
    setupLevelInput();
    
    // Start animation loop for this level (main.js loop was stopped by cleanupCurrentLevel)
    renderer.setAnimationLoop(animate);
}

function setupLevel1() {
    collisionBoxes = []; // Reset collision array
    
    // Sky background
    scene.background = new THREE.Color(0x87CEEB);
    
    // Large ground
    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    const groundMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x2d5a2d, 
        side: THREE.DoubleSide 
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    scene.add(ground);

    // Create player
    const PLAYER_SIZE = { x: 1, y: 1, z: 1 };
    const playerGeometry = new THREE.BoxGeometry(PLAYER_SIZE.x, PLAYER_SIZE.y, PLAYER_SIZE.z);
    const playerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    player = new THREE.Mesh(playerGeometry, playerMaterial);
    player.position.set(0, PLAYER_SIZE.y / 2, 0); // Player stands on ground (y=1)
    player.name = 'player';
    scene.add(player);

    // Generate skyscrapers and populate collisionBoxes
    generateSkyscrapers();

    // Create roads (no collision boxes needed)
    createRoads();

    // Goal area
    const goalGeometry = new THREE.BoxGeometry(4, 2, 4);
    const goalMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const goal = new THREE.Mesh(goalGeometry, goalMaterial);
    goal.position.set(80, 1, 80);
    goal.name = 'goal';
    scene.add(goal);

    // UI
    createUI();
    
    // Initial camera position (third-person view)
    camera.position.set(0, 10, 15);
    camera.lookAt(player.position);
    
    // Initialize yaw based on initial camera position
    yaw = Math.atan2(camera.position.x - player.position.x, camera.position.z - player.position.z);
}

function generateSkyscrapers() {
    const buildingColors = [
        0x666666, 0x777777, 0x888888, 0x999999, 
        0x555555, 0x444444, 0x333333, 0x222222
    ];
    
    for (let x = -80; x <= 80; x += 20) {
        for (let z = -80; z <= 80; z += 20) {
            if (Math.abs(x) < 30 && Math.abs(z) < 30) continue;
            
            const width = 8 + Math.random() * 6;
            const depth = 8 + Math.random() * 6;
            const height = 20 + Math.random() * 50; 
            const color = buildingColors[Math.floor(Math.random() * buildingColors.length)];
            
            createSkyscraper(x, 0, z, width, height, depth, color);
        }
    }
}

function createSkyscraper(x, y, z, width, height, depth, color) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshBasicMaterial({ color: color });
    const building = new THREE.Mesh(geometry, material);
    building.position.set(x, y + height/2, z);
    
    // Store collision box in dedicated array
    const boundingBox = new THREE.Box3().setFromObject(building);
    collisionBoxes.push(boundingBox);
    
    scene.add(building);
    return building;
}

function createRoads() {
    const roadMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x333333, 
        side: THREE.DoubleSide 
    });
    
    // Roads (for visual)
    for (let x = -90; x <= 90; x += 20) {
        const roadGeometry = new THREE.PlaneGeometry(4, 200);
        const road = new THREE.Mesh(roadGeometry, roadMaterial);
        road.rotation.x = -Math.PI / 2;
        road.position.set(x, 0.1, 0);
        scene.add(road);
    }
    
    for (let z = -90; z <= 90; z += 20) {
        const roadGeometry = new THREE.PlaneGeometry(200, 4);
        const road = new THREE.Mesh(roadGeometry, roadMaterial);
        road.rotation.x = -Math.PI / 2;
        road.position.set(0, 0.1, z);
        scene.add(road);
    }
}

function createUI() {
    // Re-use the 'game-ui' class for easy global cleanup
    const titleDiv = document.createElement('div');
    titleDiv.className = "game-ui"; 
    titleDiv.textContent = 'LEVEL 1 - City Exploration';
    titleDiv.style.cssText = `
        color: white; font-size: 24px; font-weight: bold; position: absolute; 
        top: 20px; left: 50%; transform: translateX(-50%); text-shadow: 2px 2px 4px black;
    `;
    document.body.appendChild(titleDiv);

    const instructionsDiv = document.createElement('div');
    instructionsDiv.className = "game-ui";
    instructionsDiv.innerHTML = 'Find the green goal building!<br>WASD: Move, Mouse: Look, Space: Jump, F: Toggle Fly, ESC: Main Menu';
    instructionsDiv.style.cssText = `
        color: white; font-size: 16px; position: absolute; top: 60px; left: 50%; 
        transform: translateX(-50%); text-align: center; text-shadow: 2px 2px 4px black;
    `;
    document.body.appendChild(instructionsDiv);

    // Flying status indicator
    const flyStatusDiv = document.createElement('div');
    flyStatusDiv.className = "game-ui";
    flyStatusDiv.id = "fly-status";
    flyStatusDiv.textContent = 'Fly Mode: OFF';
    flyStatusDiv.style.cssText = `
        color: white; font-size: 16px; position: absolute; top: 100px; left: 50%; 
        transform: translateX(-50%); text-align: center; text-shadow: 2px 2px 4px black;
    `;
    document.body.appendChild(flyStatusDiv);
}

function updateFlyStatus() {
    const flyStatusDiv = document.getElementById('fly-status');
    if (flyStatusDiv) {
        flyStatusDiv.textContent = `Fly Mode: ${isFlying ? 'ON' : 'OFF'}`;
        flyStatusDiv.style.color = isFlying ? '#00ff00' : 'white';
    }
}

// Input system
function setupLevelInput() {
    // Handlers defined below
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    document.addEventListener("pointerlockchange", onPointerLockChange);
    
    // Pointer lock on click
    renderer.domElement.addEventListener("click", requestLock);
    
    // If already pointer locked, attach the mousemove listener immediately
    if (document.pointerLockElement === renderer.domElement) {
        document.addEventListener("mousemove", onMouseMove);
    }
    
    // Store handlers for cleanup
    scene.userData.keyDownHandler = handleKeyDown;
    scene.userData.keyUpHandler = handleKeyUp;
    scene.userData.pointerLockHandler = onPointerLockChange;
    scene.userData.mouseMoveHandler = onMouseMove;
    scene.userData.lockClickHandler = requestLock;
}

// Helper to request lock
function requestLock() {
    if (document.pointerLockElement !== renderer.domElement) {
        renderer.domElement.requestPointerLock();
    }
}

function handleKeyDown(e) {
    if (e.code === "Space") {
        spaceHeld = true;
    } else if (e.code === "Escape") {
        // Exit level using ESC key
        returnToMainCallback(); 
    } else if (e.code === "KeyF" && !flyKeyLocked) {
        // Toggle flying mode
        toggleFlying();
        flyKeyLocked = true;
    } else {
        keys[e.key.toLowerCase()] = true;
    }
}

function handleKeyUp(e) {
    if (e.code === "Space") {
        spaceHeld = false;
        spaceLocked = false;
    } else if (e.code === "KeyF") {
        flyKeyLocked = false;
    } else {
        keys[e.key.toLowerCase()] = false;
    }
}

function onPointerLockChange() {
    if (document.pointerLockElement === renderer.domElement) {
        document.addEventListener("mousemove", onMouseMove);
    } else {
        document.removeEventListener("mousemove", onMouseMove);
    }
}

function onMouseMove(e) {
    yaw -= e.movementX * MOUSE_SENS;
    pitch += e.movementY * MOUSE_SENS;
    const maxPitch = PI_2 - 0.1;
    const minPitch = -maxPitch;
    pitch = Math.max(minPitch, Math.min(maxPitch, pitch));
}

// Flying system
function toggleFlying() {
    isFlying = !isFlying;

    if (isFlying) {
        velocityY = 0;
        targetFlyHeight = player.position.y + 10; // go 10 units higher than current
        isAscendingToFly = true;
    } else {
        velocityY = 0; // allow gravity to take over
    }

    updateFlyStatus();
}


// Player movement and physics
// Extra globals for flight transition
let isAscendingToFly = false;
let targetFlyHeight = 0;

function updatePlayer() {
    if (!player) return;

    const _forward = new THREE.Vector3();
    const _right = new THREE.Vector3();
    const _moveDir = new THREE.Vector3();

    // Calculate movement directions based on camera yaw
    _forward.set(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
    _right.crossVectors(_forward, new THREE.Vector3(0, 1, 0)).normalize();

    // Build move direction from inputs
    _moveDir.set(0, 0, 0);
    if (keys["w"] || keys["arrowup"]) _moveDir.add(_forward);
    if (keys["s"] || keys["arrowdown"]) _moveDir.sub(_forward);
    if (keys["d"] || keys["arrowright"]) _moveDir.add(_right);
    if (keys["a"] || keys["arrowleft"]) _moveDir.sub(_right);
    if (_moveDir.lengthSq() > 0) _moveDir.normalize();

    const prevPos = player.position.clone();

    // ----------------------------
    // FLYING MODE
    // ----------------------------
    if (isFlying) {
        const currentSpeed = FLY_SPEED;

        // Smooth ascent when flight is toggled on
        if (isAscendingToFly) {
            if (player.position.y < targetFlyHeight) {
                player.position.y += 0.2; // ascent speed
            } else {
                player.position.y = targetFlyHeight;
                isAscendingToFly = false;
            }
        }

        // Horizontal movement
        player.position.x += _moveDir.x * currentSpeed;
        player.position.z += _moveDir.z * currentSpeed;

        // Vertical movement via keys
        if (spaceHeld) player.position.y += currentSpeed; // ascend
        if (keys["control"] || keys["c"]) player.position.y -= currentSpeed; // descend

        // Collision detection (prevent clipping into buildings)
        const playerBox = new THREE.Box3().setFromObject(player);
        for (const box of collisionBoxes) {
            if (playerBox.intersectsBox(box)) {
                player.position.copy(prevPos);
                break;
            }
        }

    // ----------------------------
    // WALKING / JUMPING MODE
    // ----------------------------
    } else {
    const currentSpeed = speed;
    const halfHeight = 0.5; // player height = 1, so half is 0.5

    // Horizontal movement first
    const prevXZ = prevPos.clone();
    player.position.x += _moveDir.x * currentSpeed;
    player.position.z += _moveDir.z * currentSpeed;

    // Horizontal collisions (walls only)
    let playerBox = new THREE.Box3().setFromObject(player);
    for (const box of collisionBoxes) {
        if (playerBox.intersectsBox(box)) {
            const playerFeet = player.position.y - halfHeight;
            const buildingTop = box.max.y;

            if (playerFeet < buildingTop - 0.1) {
                // We're hitting the building side → block movement
                player.position.x = prevXZ.x;
                player.position.z = prevXZ.z;
            }
            break;
        }
    }

    // Apply gravity
    velocityY += gravity;
    player.position.y += velocityY;

    // Vertical collisions (landing on roofs or ground)
    playerBox.setFromObject(player);
    let onGround = false;

    for (const box of collisionBoxes) {
        if (playerBox.intersectsBox(box)) {
            if (velocityY <= 0) {
                // Land on top surface
                player.position.y = box.max.y + halfHeight;
                velocityY = 0;
                onGround = true;
            } else {
                // Hit ceiling while going up
                player.position.y = prevPos.y;
                velocityY = 0;
            }
            break;
        }
    }

    // Ground plane check (y=0.5 is base level)
    if (player.position.y <= halfHeight) {
        player.position.y = halfHeight;
        velocityY = 0;
        onGround = true;
    }

    // Jump
    if (onGround && spaceHeld && !spaceLocked) {
        velocityY = jumpStrength;
        spaceLocked = true;
    }
}


    // Update camera after movement
    updateCamera();
}



function updateCamera() {
    const cameraDistance = 8;
    const cameraHeightOffset = 1.8;
    const cosPitch = Math.cos(pitch);

    camera.position.x = player.position.x - Math.sin(yaw) * cameraDistance * cosPitch;
    camera.position.z = player.position.z - Math.cos(yaw) * cameraDistance * cosPitch;
    camera.position.y = player.position.y + Math.sin(pitch) * cameraDistance + cameraHeightOffset;

    const aimHeightOffset = 1.5;
    camera.lookAt(
        player.position.x,
        player.position.y + aimHeightOffset,
        player.position.z
    );
}

// Check for goal collision
function checkGoal() {
    const playerBox = new THREE.Box3().setFromObject(player);
    const goal = scene.getObjectByName('goal');
    
    if (goal) {
        const goalBox = new THREE.Box3().setFromObject(goal);
        if (playerBox.intersectsBox(goalBox)) {
            alert('Congratulations! You reached the goal!');
            returnToMainCallback();
        }
    }
}

// Animation loop
function animate() {
    updatePlayer();
    checkGoal();
    
    renderer.render(scene, camera);
    if (labelRenderer) {
        labelRenderer.render(scene, camera);
    }
}

// Cleanup function to be called by main.js
export function cleanupLevel() {
    // Remove all event listeners and DOM elements
    
    // Remove UI elements (using the global 'game-ui' class is safer)
    const uiElements = document.querySelectorAll('.game-ui');
    uiElements.forEach(el => el.remove());
    
    // Remove event listeners
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("keyup", handleKeyUp);
    document.removeEventListener("pointerlockchange", onPointerLockChange);
    document.removeEventListener("mousemove", onMouseMove);
    
    // Remove click handler from canvas
    if (renderer && renderer.domElement) {
         renderer.domElement.removeEventListener("click", requestLock);
    }
    
    // Clear collision data
    collisionBoxes = [];
    
    // The main.js cleanup will stop the animation loop and clear the scene.
}