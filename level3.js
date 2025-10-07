import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// Bullet class
class Bullet {
    constructor(position, direction) {
        this.geometry = new THREE.SphereGeometry(0.1, 8, 8);
        this.material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.position.copy(position);
        
        this.velocity = direction.clone().multiplyScalar(BULLET_SPEED);
        this.distanceTraveled = 0;
        this.active = true;
        
        scene.add(this.mesh);
    }
    
    update() {
        if (!this.active) return;
        
        this.mesh.position.add(this.velocity);
        this.distanceTraveled += this.velocity.length();
        
        if (this.distanceTraveled >= BULLET_MAX_DISTANCE) {
            this.destroy();
        }
    }
    
    destroy() {
        scene.remove(this.mesh);
        this.active = false;
    }
}

// Variables
let scene, camera, renderer, labelRenderer;
let returnToMainCallback;

// Player controls variables
let keys = {};
let spaceHeld = false;
let spaceLocked = false;
let yaw = 0;
let pitch = 0;
const PI_2 = Math.PI / 2;
const MOUSE_SENS = 0.0025;

// Physics variables
const speed = 0.15;
const gravity = -0.03;
const jumpStrength = 0.45;
let velocityY = 0;
const GROUND_TOLERANCE = 0;

// Player reference
let player;
let prevPlayerPos = new THREE.Vector3();

// Raycaster for camera collision and dragging
const raycaster = new THREE.Raycaster();
const cameraVector = new THREE.Vector3();

// Building dimensions
const BUILDING_WIDTH = 30;
const BUILDING_DEPTH = 30;
const WALL_THICKNESS = 0.3;
const SHORT_WALL_HEIGHT = 4;
const HALLWAY_LENGTH = 10;
const HALLWAY_HEIGHT = 8;

// Collision boxes array
let collisionBoxes = [];

// Movable boxes
let movableBoxes = [];
const BOX_SIZE = 2;
let dragDistance = 8; // Default distance for dragging

// Bullets
let bullets = [];
const BULLET_SPEED = 1.0;
const BULLET_MAX_DISTANCE = 50;

// Selected box for dragging
let selectedBox = null;
let lastValidBoxPos = new THREE.Vector3();

// Gap parameters for bridge puzzle
const GAP_WIDTH = 10;
const GAP_DEPTH = 8;
const GAP_CENTER_X = 0;
const GAP_CENTER_Z = -BUILDING_DEPTH / 2 + HALLWAY_LENGTH;

// UI element for completion message
let completionDiv;

export function initLevel(sceneRef, cameraRef, rendererRef, labelRendererRef, callback) {
    scene = sceneRef;
    camera = cameraRef;
    renderer = rendererRef;
    labelRenderer = labelRendererRef;
    returnToMainCallback = callback;

    // Clear the scene
    while(scene.children.length > 0) { 
        scene.remove(scene.children[0]); 
    }
    
    // Reset control state
    keys = {};
    spaceHeld = false;
    spaceLocked = false;
    velocityY = 0;
    yaw = 0;
    pitch = 0;
    selectedBox = null;
    dragDistance = 8;
    prevPlayerPos.set(0, 1, BUILDING_DEPTH / 2 - 5); // Match initial player position
    lastValidBoxPos.set(0, 0, 0);

    setupLevel3();
    setupLevelInput();
}

function setupLevel3() {
    collisionBoxes = [];
    movableBoxes = [];
    bullets = [];
    
    // Night sky background
    scene.background = new THREE.Color(0x001133);
    
    // Create the building
    createBuilding();

    // Create player
    const playerGeometry = new THREE.BoxGeometry(1, 1, 1);
    const playerMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    player = new THREE.Mesh(playerGeometry, playerMaterial);
    player.position.set(0, 1, BUILDING_DEPTH / 2 - 5); // Center, facing north
    player.name = 'player';
    scene.add(player);

    // UI
    createUI();
    
    // Set initial camera position/orientation
    yaw = Math.PI; // Facing north (toward short wall)
    pitch = -0.1;
    updateCamera();
}

function createBuilding() {
    const wallMaterial = new THREE.MeshBasicMaterial({ color: 0x8B4513 });
    const shortWallMaterial = new THREE.MeshBasicMaterial({ color: 0x808080 }); // Gray for short wall
    const floorMaterial = new THREE.MeshBasicMaterial({ color: 0x696969, side: THREE.DoubleSide });

    // Ground floor
    const floorGeometry = new THREE.PlaneGeometry(BUILDING_WIDTH, BUILDING_DEPTH + HALLWAY_LENGTH);
    const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = 0;
    floorMesh.position.z = -HALLWAY_LENGTH / 2; // Center floor with hallway extension
    scene.add(floorMesh);
    addCollisionBox(floorMesh);

    // Create gap by adding floor segments around it
    createFloorWithGap(0, floorMaterial);

    // Outer walls
    // West wall (includes hallway)
    createWall(-BUILDING_WIDTH/2, HALLWAY_HEIGHT/2, 0, WALL_THICKNESS, HALLWAY_HEIGHT, BUILDING_DEPTH + HALLWAY_LENGTH, wallMaterial);
    // East wall (includes hallway)
    createWall(BUILDING_WIDTH/2, HALLWAY_HEIGHT/2, 0, WALL_THICKNESS, HALLWAY_HEIGHT, BUILDING_DEPTH + HALLWAY_LENGTH, wallMaterial);
    // South wall (full height)
    createWall(0, HALLWAY_HEIGHT/2, BUILDING_DEPTH/2, BUILDING_WIDTH, HALLWAY_HEIGHT, WALL_THICKNESS, wallMaterial);
    // North wall (short, climbable, now gray)
    createWall(0, SHORT_WALL_HEIGHT/2, -BUILDING_DEPTH/2, BUILDING_WIDTH, SHORT_WALL_HEIGHT, WALL_THICKNESS, shortWallMaterial);
    // North wall extension for hallway
    createWall(0, HALLWAY_HEIGHT/2, -BUILDING_DEPTH/2 - HALLWAY_LENGTH, BUILDING_WIDTH, HALLWAY_HEIGHT, WALL_THICKNESS, wallMaterial);

    // Create puzzle elements
    createPuzzleElements();
    
    // Create goal door
    createGoalDoor();
}

function createFloorWithGap(floorY, floorMaterial) {
    const halfWidth = BUILDING_WIDTH / 2;
    const halfDepth = (BUILDING_DEPTH + HALLWAY_LENGTH) / 2;
    
    // Gap boundaries
    const gapMinX = GAP_CENTER_X - GAP_WIDTH / 2;
    const gapMaxX = GAP_CENTER_X + GAP_WIDTH / 2;
    const gapMinZ = GAP_CENTER_Z - GAP_DEPTH / 2;
    const gapMaxZ = GAP_CENTER_Z + GAP_DEPTH / 2;

    // Create floor segments around the gap
    // South of gap (including hallway start)
    const southDepth = gapMinZ - (-halfDepth);
    if (southDepth > 0) {
        const southGeometry = new THREE.PlaneGeometry(BUILDING_WIDTH, southDepth);
        const southMesh = new THREE.Mesh(southGeometry, floorMaterial);
        southMesh.rotation.x = -Math.PI / 2;
        southMesh.position.set(0, floorY, -halfDepth + southDepth / 2);
        scene.add(southMesh);
        addCollisionBox(southMesh);
    }

    // North of gap
    const northDepth = halfDepth - gapMaxZ;
    if (northDepth > 0) {
        const northGeometry = new THREE.PlaneGeometry(BUILDING_WIDTH, northDepth);
        const northMesh = new THREE.Mesh(northGeometry, floorMaterial);
        northMesh.rotation.x = -Math.PI / 2;
        northMesh.position.set(0, floorY, halfDepth - northDepth / 2);
        scene.add(northMesh);
        addCollisionBox(northMesh);
    }

    // West of gap
    const westWidth = gapMinX - (-halfWidth);
    if (westWidth > 0) {
        const westGeometry = new THREE.PlaneGeometry(westWidth, BUILDING_DEPTH + HALLWAY_LENGTH);
        const westMesh = new THREE.Mesh(westGeometry, floorMaterial);
        westMesh.rotation.x = -Math.PI / 2;
        westMesh.position.set(-halfWidth + westWidth / 2, floorY, 0);
        scene.add(westMesh);
        addCollisionBox(westMesh);
    }

    // East of gap
    const eastWidth = halfWidth - gapMaxX;
    if (eastWidth > 0) {
        const eastGeometry = new THREE.PlaneGeometry(eastWidth, BUILDING_DEPTH + HALLWAY_LENGTH);
        const eastMesh = new THREE.Mesh(eastGeometry, floorMaterial);
        eastMesh.rotation.x = -Math.PI / 2;
        eastMesh.position.set(halfWidth - eastWidth / 2, floorY, 0);
        scene.add(eastMesh);
        addCollisionBox(eastMesh);
    }
}

function createPuzzleElements() {
    const boxMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 }); // Black boxes
    
    // Box for staircase on ground floor (in front of player, toward north wall)
    for (let i = 0; i < 1; i++) {
        createMovableBox(-4, 1, 0, boxMaterial);
    }
    
    // Boxes for bridge on ground floor (near gap)
    for (let i = 0; i < 2; i++) {
        createMovableBox(-4 + i * 6, BOX_SIZE/2, GAP_CENTER_Z - GAP_DEPTH/2 - 2, boxMaterial);
    }
}

function createGoalDoor() {
    const goalGeometry = new THREE.BoxGeometry(3, 4, 0.2);
    const goalMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const goal = new THREE.Mesh(goalGeometry, goalMaterial);
    goal.position.set(0, 1, -BUILDING_DEPTH/2 - HALLWAY_LENGTH + 2); // Lowered to y=1
    goal.name = 'goal';
    scene.add(goal);
    console.log(`Goal door created at (${goal.position.x}, ${goal.position.y}, ${goal.position.z})`);
}

function createMovableBox(x, y, z, material) {
    const boxGeometry = new THREE.BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE);
    const box = new THREE.Mesh(boxGeometry, material);
    box.position.set(x, y, z);
    box.userData.isMovable = true;
    scene.add(box);
    movableBoxes.push(box);
    return box;
}

function createWall(x, y, z, width, height, depth, material) {
    const wallGeometry = new THREE.BoxGeometry(width, height, depth);
    const wall = new THREE.Mesh(wallGeometry, material);
    wall.position.set(x, y, z);
    scene.add(wall);
    addCollisionBox(wall);
    return wall;
}

function addCollisionBox(mesh) {
    const boundingBox = new THREE.Box3().setFromObject(mesh);
    // Add small tolerance by shrinking the collision box slightly
    const tolerance = 0.05;
    boundingBox.expandByVector(new THREE.Vector3(-tolerance, -tolerance, -tolerance));
    collisionBoxes.push(boundingBox);
}

function createUI() {
    // Title
    const titleDiv = document.createElement('div');
    titleDiv.className = "game-ui";
    titleDiv.textContent = 'LEVEL 3 - Gravity Puzzle';
    titleDiv.style.cssText = `
        color: white; font-size: 24px; font-weight: bold; position: absolute; 
        top: 20px; left: 50%; transform: translateX(-50%); text-shadow: 2px 2px 4px black;
        z-index: 1000; pointer-events: none;
    `;
    document.body.appendChild(titleDiv);

    // Instructions
    const instructionsDiv = document.createElement('div');
    instructionsDiv.className = "game-ui";
    instructionsDiv.innerHTML = `
        Climb the short wall, traverse the hallway, and cross the gap to reach the green door!<br>
        Left-click to shoot and select a box, then drag with mouse to move it.<br>
        Press F to increase distance, E to decrease, left-click or right-click to deselect and leave the box in place.<br>
        Use boxes to form a staircase to climb the short wall, then a bridge across the gap.<br>
        WASD: Move, Mouse: Look, Space: Jump, ESC: Pause Menu
    `;
    instructionsDiv.style.cssText = `
        color: white; font-size: 16px; position: absolute; top: 60px; left: 50%; 
        transform: translateX(-50%); text-align: center; text-shadow: 2px 2px 4px black;
        z-index: 1000; pointer-events: none;
    `;
    document.body.appendChild(instructionsDiv);

    // Completion message
    completionDiv = document.createElement('div');
    completionDiv.className = "game-ui";
    completionDiv.textContent = 'Level Completed!';
    completionDiv.style.cssText = `
        color: white; font-size: 24px; font-weight: bold; position: absolute; 
        top: 50%; left: 50%; transform: translate(-50%, -50%); text-shadow: 2px 2px 4px black;
        z-index: 1000; pointer-events: none; display: none;
    `;
    document.body.appendChild(completionDiv);
    console.log('completionDiv created');

    // Crosshair
    const crosshair = document.createElement('div');
    crosshair.className = "game-ui";
    crosshair.style.position = "absolute";
    crosshair.style.top = "50%";
    crosshair.style.left = "50%";
    crosshair.style.width = "20px";
    crosshair.style.height = "20px";
    crosshair.style.marginLeft = "-10px";
    crosshair.style.marginTop = "-10px";
    crosshair.style.pointerEvents = "none";
    crosshair.style.zIndex = "10";
    crosshair.innerHTML = `
        <div style="position:absolute;top:9px;left:0;width:20px;height:2px;background:white"></div>
        <div style="position:absolute;top:0;left:9px;width:2px;height:20px;background:white"></div>
    `;
    document.body.appendChild(crosshair);
}

function shootBullet() {
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    const startPosition = camera.position.clone().add(direction.clone().multiplyScalar(1));
    const bullet = new Bullet(startPosition, direction);
    bullets.push(bullet);
    console.log('Bullet fired');
}

function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        if (!bullet.active) {
            bullets.splice(i, 1);
            continue;
        }
        bullet.update();
        checkBulletCollisions(bullet, i);
    }
}

function checkBulletCollisions(bullet, bulletIndex) {
    const bulletBox = new THREE.Box3().setFromObject(bullet.mesh);
    
    for (const box of movableBoxes) {
        const boxBox = new THREE.Box3().setFromObject(box);
        if (bulletBox.intersectsBox(boxBox)) {
            if (selectedBox === box) {
                // Deselect if clicking the same box
                selectedBox = null;
                console.log('Box deselected');
            } else {
                selectedBox = box;
                dragDistance = 8; // Reset to default distance
                lastValidBoxPos.copy(box.position);
                console.log('Box selected for dragging');
            }
            bullet.destroy();
            bullets.splice(bulletIndex, 1);
            break;
        }
    }
}

function updateBoxPhysics() {
    if (!selectedBox) return;

    // Update previous player position and calculate delta
    const playerDelta = player.position.clone().sub(prevPlayerPos);

    // Get camera direction
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    
    // Compute target position
    const basePosition = player.position.clone().add(direction.multiplyScalar(dragDistance));
    const targetPosition = basePosition.add(playerDelta);

    // Clamp to level bounds
    const MIN_HEIGHT = BOX_SIZE / 2;
    const CEILING_HEIGHT = HALLWAY_HEIGHT + BOX_SIZE / 2;
    const HALF_WIDTH = BUILDING_WIDTH / 2;
    const HALF_DEPTH = (BUILDING_DEPTH + HALLWAY_LENGTH) / 2;
    targetPosition.x = Math.max(-HALF_WIDTH + BOX_SIZE / 2, Math.min(HALF_WIDTH - BOX_SIZE / 2, targetPosition.x));
    targetPosition.y = Math.max(MIN_HEIGHT, Math.min(CEILING_HEIGHT, targetPosition.y));
    targetPosition.z = Math.max(-HALF_DEPTH + BOX_SIZE / 2, Math.min(HALF_DEPTH - BOX_SIZE / 2, targetPosition.z));

    // Move box directly to target position (no collision checks during dragging)
    selectedBox.position.copy(targetPosition);
    lastValidBoxPos.copy(targetPosition);
    console.log(`Box dragged to: (${targetPosition.x.toFixed(2)}, ${targetPosition.y.toFixed(2)}, ${targetPosition.z.toFixed(2)}) at distance ${dragDistance.toFixed(2)}, player delta: (${playerDelta.x.toFixed(2)}, ${playerDelta.y.toFixed(2)}, ${playerDelta.z.toFixed(2)})`);

    // Update prevPlayerPos
    prevPlayerPos.copy(player.position);
}

function updateBoxCollision(box) {
    if (!box) return;
    const newCollisionBox = new THREE.Box3().setFromObject(box);
    const index = collisionBoxes.findIndex(b => {
        const boxPos = new THREE.Vector3();
        box.getWorldPosition(boxPos);
        return b.min.distanceTo(boxPos) < 0.1;
    });
    
    if (index > -1) {
        collisionBoxes[index] = newCollisionBox;
    } else {
        collisionBoxes.push(newCollisionBox);
    }
}

function setupLevelInput() {
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("keyup", handleKeyUp);
    document.removeEventListener("pointerlockchange", onPointerLockChange);
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mousedown", onMouseDown);
    
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    document.addEventListener("pointerlockchange", onPointerLockChange);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mousedown", onMouseDown);
    
    if (document.pointerLockElement === renderer.domElement) {
        document.addEventListener("mousemove", onMouseMove);
    }
    
    scene.userData.keyDownHandler = handleKeyDown;
    scene.userData.keyUpHandler = handleKeyUp;
    scene.userData.pointerLockHandler = onPointerLockChange;
    scene.userData.mouseMoveHandler = onMouseMove;
    scene.userData.mouseDownHandler = onMouseDown;

    // Ensure pointer lock is requested
    renderer.domElement.addEventListener("click", requestLock);
}

function requestLock() {
    if (document.pointerLockElement !== renderer.domElement) {
        renderer.domElement.requestPointerLock();
    }
}

function onMouseDown(e) {
    if (e.button === 0 && document.pointerLockElement === renderer.domElement) { // Left click
        if (selectedBox) {
            // Deselect and update collision box
            console.log('Box deselected');
            updateBoxCollision(selectedBox);
            selectedBox = null;
        } else {
            shootBullet();
        }
    } else if (e.button === 2 && document.pointerLockElement === renderer.domElement) { // Right click
        if (selectedBox) {
            // Deselect and update collision box
            console.log('Box deselected');
            updateBoxCollision(selectedBox);
            selectedBox = null;
        }
    }
}

function handleKeyDown(e) {
    if (e.code === "Space") {
        spaceHeld = true;
    } else if (e.code === "Escape") {
        if (window.showPauseMenu) {
            window.showPauseMenu(3);
        } else {
            returnToMainCallback();
        }
    } else if ((e.code === "KeyF" || e.code === "KeyE") && selectedBox) {
        keys[e.code] = true;
    } else {
        keys[e.key.toLowerCase()] = true;
    }
}

function handleKeyUp(e) {
    if (e.code === "Space") {
        spaceHeld = false;
        spaceLocked = false;
    } else {
        keys[e.code] = false;
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

function updatePlayer() {
    if (!player) return;

    const _forward = new THREE.Vector3();
    const _right = new THREE.Vector3();
    const _moveDir = new THREE.Vector3();
    const STEP_UP_HEIGHT = 0.5;

    _forward.set(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
    _right.crossVectors(_forward, new THREE.Vector3(0, 1, 0)).normalize();

    _moveDir.set(0, 0, 0);
    if (keys["w"] || keys["arrowup"]) _moveDir.add(_forward);
    if (keys["s"] || keys["arrowdown"]) _moveDir.sub(_forward);
    if (keys["d"] || keys["arrowright"]) _moveDir.add(_right);
    if (keys["a"] || keys["arrowleft"]) _moveDir.sub(_right);

    if (_moveDir.lengthSq() > 0) _moveDir.normalize();

    const prevPos = player.position.clone();
    const groundHeight = findGroundHeight(prevPos);
    const isGrounded = Math.abs(player.position.y - groundHeight) <= GROUND_TOLERANCE + 0.1;

    if (isGrounded) {
        velocityY = 0;
        player.position.y = groundHeight;
        if (spaceHeld && !spaceLocked) {
            velocityY = jumpStrength;
            spaceLocked = true;
        }
    }

    velocityY += gravity;
    
    const moveX = _moveDir.x * speed;
    const moveZ = _moveDir.z * speed;
    const targetX = player.position.x + moveX;
    const targetZ = player.position.z + moveZ;

    const newHorizontalPos = new THREE.Vector3(targetX, player.position.y, targetZ);
    if (!checkCollision(newHorizontalPos)) {
        player.position.x = newHorizontalPos.x;
        player.position.z = newHorizontalPos.z;
    } else {
        const testUpPos = new THREE.Vector3(targetX, player.position.y + STEP_UP_HEIGHT, targetZ);
        if (!checkCollision(testUpPos)) {
            player.position.x = targetX;
            player.position.z = targetZ;
            player.position.y += STEP_UP_HEIGHT;
        } else {
            const tryX = new THREE.Vector3(targetX, player.position.y, player.position.z);
            if (!checkCollision(tryX)) {
                player.position.x = tryX.x;
            }
            const tryZ = new THREE.Vector3(player.position.x, player.position.y, targetZ);
            if (!checkCollision(tryZ)) {
                player.position.z = tryZ.z;
            }
        }
    }

    const newVerticalPos = player.position.y + velocityY;
    const testPos = new THREE.Vector3(player.position.x, newVerticalPos, player.position.z);
    
    if (!checkCollision(testPos)) {
        player.position.y = Math.max(0.5, newVerticalPos); // Clamp to prevent falling through ground
    } else {
        if (velocityY > 0) {
            velocityY = 0;
        } else {
            const landedHeight = findGroundHeight(player.position);
            player.position.y = landedHeight;
            velocityY = 0;
            console.log(`Player landed at y=${player.position.y.toFixed(2)}, ground height=${landedHeight.toFixed(2)}`);
        }
    }

    updateCamera();
}

function findGroundHeight(position) {
    const playerHeight = 1;
    const halfPlayerHeight = playerHeight / 2;
    const rayDown = new THREE.Vector3(0, -1, 0);
    const origin = new THREE.Vector3(position.x, position.y - halfPlayerHeight + 0.1, position.z);
    raycaster.set(origin, rayDown);
    raycaster.far = 5.0; // Increased to detect floor from box height

    // Include all scene objects for raycasting (floor and boxes)
    const intersects = raycaster.intersectObjects(scene.children.filter(obj => obj !== player && obj.name !== 'goal'), true);
    if (intersects.length > 0) {
        let highestGround = intersects[0];
        for (const intersect of intersects) {
            if (intersect.point.y > highestGround.point.y) {
                highestGround = intersect;
            }
        }
        const groundY = highestGround.point.y + halfPlayerHeight;
        console.log(`Raycast hit at y=${groundY.toFixed(2)} on ${highestGround.object.userData.isMovable ? 'box' : 'floor'}`);
        return groundY;
    }

    // Fallback: check boxes and floor explicitly
    const testPos = position.clone();
    for (let y = position.y; y >= 0; y -= 0.1) {
        testPos.y = y;
        const testBox = new THREE.Box3().setFromCenterAndSize(
            testPos,
            new THREE.Vector3(0.9, playerHeight, 0.9)
        );
        
        for (const box of movableBoxes) {
            const boxBox = new THREE.Box3().setFromObject(box);
            if (testBox.intersectsBox(boxBox)) {
                const groundY = boxBox.max.y + halfPlayerHeight;
                console.log(`Fallback ground at y=${groundY.toFixed(2)} on box`);
                return groundY;
            }
        }
        
        // Check floor
        for (const collisionBox of collisionBoxes) {
            if (testBox.intersectsBox(collisionBox)) {
                const groundY = collisionBox.max.y + halfPlayerHeight;
                console.log(`Fallback ground at y=${groundY.toFixed(2)} on floor`);
                return groundY;
            }
        }
        
        if (y <= halfPlayerHeight) {
            console.log('No ground detected, clamping to y=0.5');
            return halfPlayerHeight; // Clamp to ground level
        }
    }
    
    console.log('No ground detected, clamping to y=0.5');
    return halfPlayerHeight;
}

function checkCollision(position) {
    const testBox = new THREE.Box3().setFromCenterAndSize(
        position,
        new THREE.Vector3(0.9, 0.9, 0.9)
    );
    
    // Check collisions with walls, floor, and all boxes
    for (const box of collisionBoxes) {
        if (testBox.intersectsBox(box)) {
            console.log('Player movement blocked by collision box');
            return true;
        }
    }
    return false;
}

function updateCamera() {
    const cameraDistance = 8;
    const cameraHeightOffset = 1.8;
    const aimHeightOffset = 1.5;
    const cosPitch = Math.cos(pitch);

    const targetPos = new THREE.Vector3(
        player.position.x - Math.sin(yaw) * cameraDistance * cosPitch,
        player.position.y + Math.sin(pitch) * cameraDistance + cameraHeightOffset,
        player.position.z - Math.cos(yaw) * cameraDistance * cosPitch
    );

    const playerCenterWithOffset = player.position.clone().setY(player.position.y + aimHeightOffset);
    cameraVector.subVectors(targetPos, playerCenterWithOffset).normalize();
    
    raycaster.set(playerCenterWithOffset, cameraVector);
    raycaster.far = targetPos.distanceTo(playerCenterWithOffset);
    const obstacles = scene.children.filter(obj => obj.name !== 'player' && obj.name !== 'goal');
    const intersects = raycaster.intersectObjects(obstacles, true);

    if (intersects.length > 0) {
        const intersection = intersects[0];
        const actualDistance = intersection.distance - 0.2;
        camera.position.copy(playerCenterWithOffset);
        camera.position.addScaledVector(cameraVector, actualDistance);
    } else {
        camera.position.copy(targetPos);
    }

    camera.lookAt(
        player.position.x,
        player.position.y + aimHeightOffset,
        player.position.z
    );
}

function checkGoal() {
    const playerBox = new THREE.Box3().setFromObject(player);
    const goal = scene.getObjectByName('goal');
    
    if (goal) {
        console.log('Goal found');
        const goalBox = new THREE.Box3().setFromObject(goal);
        goalBox.expandByVector(new THREE.Vector3(0.1, 0.1, 0.1)); // Add tolerance
        console.log(`Player box: min=(${playerBox.min.x.toFixed(2)}, ${playerBox.min.y.toFixed(2)}, ${playerBox.min.z.toFixed(2)}), max=(${playerBox.max.x.toFixed(2)}, ${playerBox.max.y.toFixed(2)}, ${playerBox.max.z.toFixed(2)})`);
        console.log(`Goal box: min=(${goalBox.min.x.toFixed(2)}, ${goalBox.min.y.toFixed(2)}, ${goalBox.min.z.toFixed(2)}), max=(${goalBox.max.x.toFixed(2)}, ${goalBox.max.y.toFixed(2)}, ${goalBox.max.z.toFixed(2)})`);
        if (playerBox.intersectsBox(goalBox)) {
            console.log('Intersection: true, displaying completion message');
            completionDiv.style.display = 'block';
            setTimeout(() => {
                console.log('Returning to main menu');
                returnToMainCallback();
            }, 2000); // Return to main menu after 2 seconds
        } else {
            console.log('Intersection: false');
        }
    } else {
        console.log('Goal not found in scene');
    }
}

export function updateLevel() {
    if (window.__stats) window.__stats.begin();
    // Update drag distance if F or E is pressed
    if (selectedBox) {
        if (keys["KeyF"]) {
            dragDistance = Math.min(dragDistance + 0.5, 12);
            console.log(`Drag distance increased to: ${dragDistance.toFixed(2)}`);
        } else if (keys["KeyE"]) {
            dragDistance = Math.max(dragDistance - 0.5, 2);
            console.log(`Drag distance decreased to: ${dragDistance.toFixed(2)}`);
        }
    }
    
    // Rebuild collisionBoxes with walls, floor, and all movable boxes
    collisionBoxes = [];
    scene.children.forEach(obj => {
        const isWall = (
            (obj.geometry?.parameters.width <= WALL_THICKNESS ||
             obj.geometry?.parameters.depth <= WALL_THICKNESS) &&
            (obj.geometry?.parameters.height === HALLWAY_HEIGHT ||
             obj.geometry?.parameters.height === SHORT_WALL_HEIGHT)
        );
        const isFloor = obj.geometry?.parameters.width === BUILDING_WIDTH && 
                       obj.geometry?.parameters.height === undefined &&
                       obj.geometry?.parameters.depth >= BUILDING_DEPTH;
        if (isWall || isFloor) {
            addCollisionBox(obj);
        }
    });
    // Add all movable boxes to collisionBoxes
    movableBoxes.forEach(box => {
        addCollisionBox(box);
    });
    
    updatePlayer();
    updateBullets();
    updateBoxPhysics();
    checkGoal();
    if (window.__stats) window.__stats.end();
}

export function cleanupLevel() {
    const uiElements = document.querySelectorAll('.game-ui');
    uiElements.forEach(el => {
        const isMainMenuElement = el.closest('#main-menu, #play-submenu, #level-select, #settings, #credits, #instructions, #pause-menu');
        if (!isMainMenuElement) {
            el.remove();
        }
    });
    
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("keyup", handleKeyUp);
    document.removeEventListener("pointerlockchange", onPointerLockChange);
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mousedown", onMouseDown);
    
    if (renderer && renderer.domElement) {
        renderer.domElement.removeEventListener("click", requestLock);
    }
    
    collisionBoxes = [];
    movableBoxes = [];
    bullets = [];
    selectedBox = null;
    dragDistance = 8;
}