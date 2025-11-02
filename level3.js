import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as CANNON from 'cannon-es';

// Store level-specific variables
let scene, camera, renderer, labelRenderer;
let world;
let returnCallback;
let rainbowCubes = [];
let secondDoorOpenable = false;
let platesOccupied = {
    plate13: false,
    plate11: false, 
    plate1: false
};
let plateTimers = {
    plate13: null,
    plate11: null,
    plate1: null
};
let firstDoorOpenable = false;
let lavaTime = 0;
const lavaMaterials = []; // Store lava materials for animation
let floor4Mesh, floor8Mesh, floor9Mesh;
let numberPlatesOccupied = {
    four: false,
    five: false,
    six: false,
    seven: false
};
let numberPlateTimers = {
    four: null,
    five: null,
    six: null,
    seven: null
};
let door7Openable = false;

// Add new variables for door 8 plates
let numberPlates2Occupied = {
    four2: false,
    five2: false,
    one2: false
};
let numberPlate2Timers = {
    four2: null,
    five2: null,
    one2: null
};
let door8Openable = false;

// Add new variables for door 9 plates
let numberPlates3Occupied = {
    one3: false,
    two3: false,
    three3: false,
    four3: false,
    five3: false,
    six3: false,
    seven3: false
};
let numberPlate3Timers = {
    one3: null,
    two3: null,
    three3: null,
    four3: null,
    five3: null,
    six3: null,
    seven3: null
};
let door9Openable = false;

// Add color mapping for rainbow cubes
const rainbowColorMapping = {
    'violet': 'one3',
    'indigo': 'two3', 
    'blue': 'three3',
    'green': 'four3',
    'yellow': 'five3',
    'orange': 'six3',
    'red': 'seven3'
};

let cubeOnPlateTimer = null;

// ADD THIS LINE - Define platePositions at module level
let platePositions = {
    plate1: new THREE.Vector3(38.5, 5, 45),     // Model 1 position
    plate11: new THREE.Vector3(43.9, 3, 10),    // Model 11 position  
    plate13: new THREE.Vector3(43.9, 3, 15)     // Model 13 position
};

let doorBodies = []; // Array to store door physics bodies

// ── GOAL CONDITION VARIABLE ─────────────────────────────────────
let goalReached = false; //

// ── DEATH CONDITION VARIABLES ─────────────────────────────────────
const DEADLY_FLOOR_Y = -2;  // Top surface Y for all deadly floors
const deadlyFloors = [
    { centerX: 31.25, halfX: 6.25, centerZ: 15.35, halfZ: 14.65 },  // floor4 (magenta)
    { centerX:  6.25, halfX: 6.25, centerZ:  0.2,  halfZ: 37.5  },  // floor8 (red)
    { centerX: -6.25, halfX: 6.25, centerZ: -3.0675, halfZ: 46.9325 }  // floor9 (lime)
];
let playerDied = false;  // Prevent spam logging

// ── UI & INPUT ───────────────────────────────────────────────────────
const DOOR_INTERACT_DISTANCE = 5;          // max distance to interact
const MOUSE_SENS = 0.002;                  // mouse look sensitivity
const PI_2 = Math.PI / 2;
// ── FIRST PERSON CAMERA SETUP ───────────────────────────────────────
const EYE_HEIGHT = 1;                // Player eye height
const PITCH_CLAMP = Math.PI / 2 - 0.01; // Prevent flipping
// ── Update these globals for FPS mouse look ─────────────────────────
let yaw = 0;
let pitch = 0;
let doorPromptDiv = null;                  // UI element
const raycaster = new THREE.Raycaster();  // reused for door & camera

let player = null;                         // reference to the physics box mesh
let gunModel = null;

// ── BULLETS & MOVABLE CUBES ───────────────────────────────────────
const BULLET_SPEED = 60;               // units/second
const BULLET_MAX_DISTANCE = 100;       // units
const BOX_SIZE = 1.3;                    // size of the sci-fi cube model (scale later)

let bullets = [];                      // active Bullet instances
let movableBoxes = [];                 // all sci-fi cubes
let selectedBox = null;                // currently dragged cube
let dragDistance = 8;                  // distance from camera
const MIN_CUBE_DISTANCE = 5;           // Minimum distance between cube and player
const MAX_CUBE_DISTANCE = 30;          // Maximum distance for cube dragging
const SCROLL_SENSITIVITY = 10;        // How fast scroll changes distance
let lastValidBoxPos = new THREE.Vector3();

// Add these variables at the top with your other module-level variables
let walkingSound = null;
let isWalking = false;
let walkSoundInterval = null;

let doorLockedSound = null;

let doorOpenSound = null;

// Add this function to initialize the walking sound
function initWalkingSound() {
    // Create audio listener and sound
    const listener = new THREE.AudioListener();
    camera.add(listener);
    
    walkingSound = new THREE.Audio(listener);
    
    // Create audio loader
    const audioLoader = new THREE.AudioLoader();
    
    // Load walking sound
    audioLoader.load('./walking.mp3', (buffer) => {
        walkingSound.setBuffer(buffer);
        walkingSound.setLoop(true);
        walkingSound.setVolume(0.3); // Adjust volume as needed
        console.log("Walking sound loaded successfully");
    }, undefined, (error) => {
        console.error('Error loading walking sound:', error);
    });

    // Load door locked sound
    audioLoader.load('./door locked.mp3', (buffer) => {
        doorLockedSound = new THREE.Audio(listener);
        doorLockedSound.setBuffer(buffer);
        doorLockedSound.setLoop(false); // No loop for effect sound
        doorLockedSound.setVolume(0.5); // Adjust volume as needed
        console.log("Door locked sound loaded successfully");
    }, undefined, (error) => {
        console.error('Error loading door locked sound:', error);
    });

    // Load door open sound
    audioLoader.load('./door.mp3', (buffer) => {
        doorOpenSound = new THREE.Audio(listener);
        doorOpenSound.setBuffer(buffer);
        doorOpenSound.setLoop(false); // No loop for effect sound
        doorOpenSound.setVolume(1); // Adjust volume as needed
        console.log("Door open sound loaded successfully");
    }, undefined, (error) => {
        console.error('Error loading door open sound:', error);
    });
}

// Add this function to handle walking sound state
function updateWalkingSound() {
    const isMoving = keys['KeyW'] || keys['KeyS'] || keys['KeyA'] || keys['KeyD'];
    const isGrounded = isPlayerOnFloor();
    
    // Start walking sound if moving and grounded, but not already walking
    if (isMoving && isGrounded && !isWalking) {
        isWalking = true;
        if (walkingSound && !walkingSound.isPlaying) {
            walkingSound.play();
            console.log("Walking sound started");
        }
    }
    // Stop walking sound if not moving or not grounded, but currently walking
    else if ((!isMoving || !isGrounded) && isWalking) {
        isWalking = false;
        if (walkingSound && walkingSound.isPlaying) {
            walkingSound.stop();
            console.log("Walking sound stopped");
        }
    }
}

// ── CHECK FOR DEATH ON DEADLY FLOORS ──────────────────────────────
function checkForDeath() {
    if (!boxBody || goalReached || playerDied) return;
    
    const playerPos = boxBody.position;
    const playerBottomY = playerPos.y - 0.5;  // Player bottom
    
    // Quick Y filter: must be near deadly floor height
    if (Math.abs(playerBottomY - DEADLY_FLOOR_Y) > 0.4) return;
    
    const px = playerPos.x;
    const pz = playerPos.z;
    
    // Check overlap with each deadly floor
    for (const floor of deadlyFloors) {
        if (Math.abs(px - floor.centerX) < floor.halfX + 0.5 &&
            Math.abs(pz - floor.centerZ) < floor.halfZ + 0.5) {
            
            playerDied = true;
            showDeathMessage();
            
            // 🔥 TODO: Add full restart logic here later
            // - Reset player position: boxBody.position.set(47.3, 3, 0);
            // - Reset yaw/pitch, velocities, clear selectedBox, etc.
            // - Reset playerDied = false;
            // - Maybe show "You Died!" UI and restart after 2s
            
            return;
        }
    }
}
// ── **DEATH UI** ───────────────────────────────────────────────────
function showDeathMessage() {
    // 1. CREATE DEATH SCREEN
    const deathDiv = document.createElement('div');
    deathDiv.className = "game-ui";
    deathDiv.innerHTML = `
        <h1 style="margin: 0 0 30px 0; font-size: 36px;">💀 YOU DIED! 💀</h1>
        <button id="restart-death-btn">🔄 RESTART LEVEL</button>
        <button id="menu-death-btn">🏠 MAIN MENU</button>
        <p style="margin-top: 25px; font-size: 16px; opacity: 0.8;">Press buttons to continue</p>
    `;
    deathDiv.style.cssText = `
        position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
        color: #ff4444; text-align: center; z-index: 1001;
        background: rgba(20, 20, 40, 0.95); padding: 50px; border-radius: 25px;
        border: 4px solid #ff0000; box-shadow: 0 20px 60px rgba(255,0,0,0.4);
        font-family: Arial, sans-serif; font-weight: bold; min-width: 350px;
        button {
            display: block; margin: 20px auto; padding: 18px 40px;
            font-size: 22px; font-weight: bold; border: none; border-radius: 15px;
            cursor: pointer; transition: all 0.3s; min-width: 250px;
        }
        #restart-death-btn {
            background: linear-gradient(145deg, #ffaa00, #ff7700); color: white;
            box-shadow: 0 10px 30px rgba(255,170,0,0.4);
        }
        #restart-death-btn:hover { transform: scale(1.05); box-shadow: 0 15px 40px rgba(255,170,0,0.6); }
        #menu-death-btn {
            background: linear-gradient(145deg, #666, #444); color: white;
            box-shadow: 0 10px 30px rgba(0,0,0,0.4);
        }
        #menu-death-btn:hover { transform: scale(1.05); box-shadow: 0 15px 40px rgba(0,0,0,0.6); }
    `;
    document.body.appendChild(deathDiv);

    // 2. **RESTART BUTTON** → Reload level 3 (full reset!)
    document.getElementById('restart-death-btn').onclick = () => {
        deathDiv.remove();
        if (window.loadLevel) {
            window.loadLevel(3);  // 🔥 Full level restart (calls initLevel + cleanup)
        }
    };

    // 3. **MAIN MENU BUTTON** → Return to hub
    document.getElementById('menu-death-btn').onclick = () => {
        deathDiv.remove();
        cleanupLevel();  // Quick cleanup
        if (returnCallback) returnCallback();  // → main.js returnToMainMenu
    };

    // 4. **PAUSE GAME** (like victory)
    safePauseGameLoop();
    document.exitPointerLock().catch(() => {});
    
    console.log("💀 DEATH SCREEN SHOWN");
}

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
    
    update(delta) {
        if (!this.active) return;
        const move = this.velocity.clone().multiplyScalar(delta);
        this.mesh.position.add(move);
        this.distanceTraveled += move.length();
        
        if (this.distanceTraveled >= BULLET_MAX_DISTANCE) this.destroy();
    }
    
    destroy() {
        scene.remove(this.mesh);
        this.active = false;
    }
}

// ── **WIN CONDITION** ───────────────────────────────────────────────────
function checkGoalCondition() {
    if (!boxBody || goalReached) return;
    
    const playerPos = boxBody.position;
    const goalPos = new CANNON.Vec3(-54, 6, 0.6997);
    const distance = playerPos.distanceTo(goalPos);
    
    if (distance < 2) {
        goalReached = true;
        console.log("✅ LEVEL 3 COMPLETED!");

        // 🔥 **FIX: Use a single, safe approach**
        // 1. Show victory message first
        showVictoryMessage();

        // 2. Exit pointer lock safely
        if (document.pointerLockElement) {
            document.exitPointerLock().catch(e => console.log('Pointer lock already released'));
        }

        // 3. Stop physics updates but keep rendering
        safePauseGameLoop();

        // 4. Return after a delay, ensuring all cleanup happens
        setTimeout(() => {
            console.log("Returning to main menu from Level 3...");
            if (returnCallback) {
                // Make sure we're completely cleaned up before returning
                cleanupLevel();
                returnCallback();
            }
        }, 3000);
    }
}

// Add this function to show victory message
function showVictoryMessage() {
    const victoryDiv = document.createElement('div');
    victoryDiv.id = 'victory-message';
    victoryDiv.className = "game-ui";
    victoryDiv.textContent = 'LEVEL 3 COMPLETED! Returning to main menu...';
    victoryDiv.style.cssText = `
        color: #00ff00; font-size: 32px; font-weight: bold; position: absolute; 
        top: 40%; left: 50%; transform: translate(-50%, -50%); 
        text-shadow: 2px 2px 4px black; z-index: 1000; 
        pointer-events: none; text-align: center;
        background: rgba(0, 0, 0, 0.7); padding: 20px; border-radius: 10px;
        border: 2px solid #00ff00;
    `;
    document.body.appendChild(victoryDiv);
}

// -------------------------------------------------------------------
//  MOVABLE SCI-FI CUBES – now with CANNON bodies (weightless)
// -------------------------------------------------------------------
function createMovableBox(position) {
    const loader = new GLTFLoader();
    loader.load(
        './the_sci-fi_cube2.glb',
        (gltf) => {
            const cube = gltf.scene.clone();
            cube.position.copy(position);
            cube.scale.set(BOX_SIZE, BOX_SIZE, BOX_SIZE);
            cube.userData.isMovable = true;

            

            scene.add(cube);
            movableBoxes.push(cube);

            // ── CANNON BODY (weightless, kinematic) ─────────────────────
            const shape = new CANNON.Box(
                new CANNON.Vec3(BOX_SIZE / 2, BOX_SIZE / 2, BOX_SIZE / 2)
            );

            const body = new CANNON.Body({
                mass: 200,                     
                shape,
                linearDamping: 0.9,
                angularDamping: 0.9,
                material: world.materials.cube  // Use the cube material
            });
            body.position.copy(cube.position);
            world.addBody(body);

            // link mesh ↔ body
            if (cube && body) {
                cube.userData.physicsBody = body;
                body.userData = body.userData || {};
                body.userData.mesh = cube;      // optional, handy for debugging
            }
        },
        undefined,
        err => console.error('Failed to load sci-fi_cube.glb', err)
    );
}

function createPuzzleElements() {
    createMovableBox(new THREE.Vector3(47.3, 1, 5));

    // hall 1
    createMovableBox(new THREE.Vector3(40, 1, -30));
    createMovableBox(new THREE.Vector3( 40, 1, 0));
    createMovableBox(new THREE.Vector3( 40, 1, 10));
    // hall 2
    createMovableBox(new THREE.Vector3(27, 1, -30));
    createMovableBox(new THREE.Vector3( 27, 1, 0));
    createMovableBox(new THREE.Vector3( 27, 1, -20));
    createMovableBox(new THREE.Vector3(27, 1, -10));
    // hall 3
    createMovableBox(new THREE.Vector3(14, 1, -30));
    createMovableBox(new THREE.Vector3( 20, 1, 0));
    createMovableBox(new THREE.Vector3( 19, 1, 10));
    // hall 4
    createMovableBox(new THREE.Vector3(9, 1, -45));
    createMovableBox(new THREE.Vector3( 8, 1, -40));
    // hall 5
    createMovableBox(new THREE.Vector3(-9, 1, 44.5));
    createMovableBox(new THREE.Vector3( -8, 1, 45));
    createMovableBox(new THREE.Vector3(-9, 1, 47));
    createMovableBox(new THREE.Vector3( -8, 1, 40));
    // hall 6
    createMovableBox(new THREE.Vector3(-20, 1, -30));
    createMovableBox(new THREE.Vector3( -20, 1, 0));
    createMovableBox(new THREE.Vector3( -20, 1, -20));
    createMovableBox(new THREE.Vector3(-20, 1, -10));
    // hall 7
    createMovableBox(new THREE.Vector3(-30, 1, -30));
    createMovableBox(new THREE.Vector3( -30, 1, 0));
    createMovableBox(new THREE.Vector3( -30, 1, -20));
}

// Update the initLevel function to initialize the walking sound
export function initLevel(levelScene, levelCamera, levelRenderer, levelLabelRenderer, callback) {
    // Store references to the passed parameters
    scene = levelScene;
    camera = levelCamera;
    renderer = levelRenderer;
    labelRenderer = levelLabelRenderer;
    returnCallback = callback;

    // Set up the scene
    setupScene();
    
    // Position the camera
    camera.position.set(0, 5, 10);
    camera.lookAt(0, 0, 0);

    // **RESET FPS CAMERA TO FACE POSITIVE Z**
    yaw = Math.PI;    // 180 degrees - facing positive Z
    pitch = 0;        // Level view
    
    // **START LOOKING TOWARD POSITIVE Z**
    camera.rotation.set(0, Math.PI, 0); // Y rotation = PI (180 degrees)
    
    // **INITIALIZE WALKING SOUND**
    initWalkingSound();
}

// Add this array to store floor bodies at the module level
let floorBodies = [];

function setupScene() {
    // Clear the scene
    while(scene.children.length > 0) {
        scene.remove(scene.children[0]);
    }

    // Create physics world
    world = new CANNON.World({
        gravity: new CANNON.Vec3(0, -9.81, 0)
    });

    // Set up contact materials
    setupContactMaterials();

    // Initialize floor bodies array
    floorBodies = [];

    createGridLights();

    // ADD CEILING PHYSICS BODY
    const ceilingBody = new CANNON.Body({
        shape: new CANNON.Box(new CANNON.Vec3(50, 50, 0.1)), // Large ceiling covering the level
        mass: 0
    });
    ceilingBody.position.set(0, 10, 0); // Position at Y=10
    ceilingBody.quaternion.setFromEuler(Math.PI / 2, 0, 0); // Rotate 90 degrees along X axis
    world.addBody(ceilingBody);
    floorBodies.push(ceilingBody);
    console.log("Ceiling physics body added at position (0, 10, 0)");

    // Add silver thin box at (18, 2.5, -46)
const silverBoxGeo = new THREE.BoxGeometry(2, 2, 0.1);
const silverBoxMat = new THREE.MeshStandardMaterial({ 
    color: 0xC0C0C0, // Silver color
    metalness: 0.8,
    roughness: 0.2,
    friction: 0.7
});
const silverBoxMesh = new THREE.Mesh(silverBoxGeo, silverBoxMat);
silverBoxMesh.position.set(17.4, 3.3, -46);
silverBoxMesh.rotation.x = -Math.PI / 2; // Rotate to make it horizontal
scene.add(silverBoxMesh);

// Create physics body for the silver box
const silverBoxBody = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(1, 1, 0.05)), // 2x2x0.1 dimensions
    mass: 0 // Static object
});
silverBoxBody.position.copy(silverBoxMesh.position);
silverBoxBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Match the rotation
world.addBody(silverBoxBody);
silverBoxMesh.userData.physicsBody = silverBoxBody;

// Add to floor bodies array so player can jump from it
floorBodies.push(silverBoxBody);

console.log("Silver thin box added at position (18, 2.5, -46)");

// Add silver thin box at (18, 2.5, -46)
const silver2BoxGeo = new THREE.BoxGeometry(2, 2, 0.1);
const silver2BoxMat = new THREE.MeshStandardMaterial({ 
    color: 0xC0C0C0, // Silver color
    metalness: 0.8,
    roughness: 0.2,
    friction: 0.7
});
const silver2BoxMesh = new THREE.Mesh(silver2BoxGeo, silver2BoxMat);
silver2BoxMesh.position.set(-10.4, 3.3, -46);
silver2BoxMesh.rotation.x = -Math.PI / 2; // Rotate to make it horizontal
scene.add(silver2BoxMesh);

// Create physics body for the silver box
const silver2BoxBody = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(1, 1, 0.05)), // 2x2x0.1 dimensions
    mass: 0 // Static object
});
silver2BoxBody.position.copy(silver2BoxMesh.position);
silver2BoxBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Match the rotation
world.addBody(silver2BoxBody);
silver2BoxMesh.userData.physicsBody = silver2BoxBody;

// Add to floor bodies array so player can jump from it
floorBodies.push(silver2BoxBody);

// Add silver thin box at (18, 2.5, -46)
const silver3BoxGeo = new THREE.BoxGeometry(2, 2, 0.1);
const silver3BoxMat = new THREE.MeshStandardMaterial({ 
    color: 0xC0C0C0, // Silver color
    metalness: 0.8,
    roughness: 0.2,
    friction: 0.7
});
const silver3BoxMesh = new THREE.Mesh(silver3BoxGeo, silver3BoxMat);
silver3BoxMesh.position.set(-8, 1.3, -46);
silver3BoxMesh.rotation.x = -Math.PI / 2; // Rotate to make it horizontal
scene.add(silver3BoxMesh);

// Create physics body for the silver box
const silver3BoxBody = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(1, 1, 0.05)), // 2x2x0.1 dimensions
    mass: 0 // Static object
});
silver3BoxBody.position.copy(silver3BoxMesh.position);
silver3BoxBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Match the rotation
world.addBody(silver3BoxBody);
silver3BoxMesh.userData.physicsBody = silver3BoxBody;

// Add to floor bodies array so player can jump from it
floorBodies.push(silver3BoxBody);

    // Create platform 1 (green)
    const floor1Body = new CANNON.Body({
        shape: new CANNON.Box(new CANNON.Vec3(12.5 / 2, 100 / 2, 0.1)),
        mass: 0
    });
    floor1Body.position.set(43.75, 0.05, 0);
    floor1Body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(floor1Body);
    floorBodies.push(floor1Body);

    // Create platform 2 (yellow)
    const floor2Body = new CANNON.Body({
        shape: new CANNON.Box(new CANNON.Vec3(12.5 / 2, 50.7 / 2, 0.1)),
        mass: 0
    });
    floor2Body.position.set(31.25, 0.05, -24.65);
    floor2Body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(floor2Body);
    floorBodies.push(floor2Body);

    // Create platform 3 (cyan)
    const floor3Body = new CANNON.Body({
        shape: new CANNON.Box(new CANNON.Vec3(12.5 / 2, 20 / 2, 0.1)),
        mass: 0
    });
    floor3Body.position.set(31.25, 0.05, 40);
    floor3Body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(floor3Body);
    floorBodies.push(floor3Body);

    // Create platform 4 (lava - KEEP VISUAL MESH)
    const floor4Geo = new THREE.PlaneGeometry(12.5, 29.3);
    const floor4Mat = new THREE.MeshStandardMaterial({
        color: 0xff2200,
        emissive: 0xff2200,
        emissiveIntensity: 0.8,
        roughness: 0.9,
        metalness: 0.1
    });
    floor4Mesh = new THREE.Mesh(floor4Geo, floor4Mat);
    floor4Mesh.rotation.x = -Math.PI / 2;
    floor4Mesh.position.set(31.25, -2, 15.35);
    scene.add(floor4Mesh);

    const floor4Body = new CANNON.Body({
        shape: new CANNON.Box(new CANNON.Vec3(12.5 / 2, 29.3 / 2, 0.1)),
        mass: 0
    });
    floor4Body.position.set(31.25, -1.95, 15.35);
    floor4Body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(floor4Body);
    floorBodies.push(floor4Body);
    floor4Mesh.userData.physicsBody = floor4Body;

    // Create platform 5 (orange)
    const floor5Body = new CANNON.Body({
        shape: new CANNON.Box(new CANNON.Vec3(12.5 / 2, 100 / 2, 0.1)),
        mass: 0
    });
    floor5Body.position.set(18.75, 0.05, 0);
    floor5Body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(floor5Body);
    floorBodies.push(floor5Body);

    // Create platform 6 (purple)
    const floor6Body = new CANNON.Body({
        shape: new CANNON.Box(new CANNON.Vec3(12.5 / 2, 12.7 / 2, 0.1)),
        mass: 0
    });
    floor6Body.position.set(6.25, 0.05, -43.65);
    floor6Body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(floor6Body);
    floorBodies.push(floor6Body);

    // Create platform 7 (white)
    const floor7Body = new CANNON.Body({
        shape: new CANNON.Box(new CANNON.Vec3(12.5 / 2, 12.3 / 2, 0.1)),
        mass: 0
    });
    floor7Body.position.set(6.25, 0.05, 43.85);
    floor7Body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(floor7Body);
    floorBodies.push(floor7Body);

    // Create platform 8 (lava - KEEP VISUAL MESH)
    const floor8Geo = new THREE.PlaneGeometry(12.5, 75);
    const floor8Mat = new THREE.MeshStandardMaterial({
        color: 0xff2200,
        emissive: 0xff2200,
        emissiveIntensity: 0.8,
        roughness: 0.9,
        metalness: 0.1
    });
    floor8Mesh = new THREE.Mesh(floor8Geo, floor8Mat);
    floor8Mesh.rotation.x = -Math.PI / 2;
    floor8Mesh.position.set(6.25, -2, 0.2);
    scene.add(floor8Mesh);

    const floor8Body = new CANNON.Body({
        shape: new CANNON.Box(new CANNON.Vec3(12.5 / 2, 75 / 2, 0.1)),
        mass: 0
    });
    floor8Body.position.set(6.25, -1.95, 0.2);
    floor8Body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(floor8Body);
    floorBodies.push(floor8Body);
    floor8Mesh.userData.physicsBody = floor8Body;

    // Create platform 9 (lava - KEEP VISUAL MESH)
    const floor9Geo = new THREE.PlaneGeometry(12.5, 93.865);
    const floor9Mat = new THREE.MeshStandardMaterial({
        color: 0xff2200,
        emissive: 0xff2200,
        emissiveIntensity: 0.8,
        roughness: 0.9,
        metalness: 0.1
    });
    floor9Mesh = new THREE.Mesh(floor9Geo, floor9Mat);
    floor9Mesh.rotation.x = -Math.PI / 2;
    floor9Mesh.position.set(-6.25, -2, -3.0675);
    scene.add(floor9Mesh);

    const floor9Body = new CANNON.Body({
        shape: new CANNON.Box(new CANNON.Vec3(12.5 / 2, 93.865 / 2, 0.1)),
        mass: 0
    });
    floor9Body.position.set(-6.25, -1.95, -3.0675);
    floor9Body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(floor9Body);
    floorBodies.push(floor9Body);
    floor9Mesh.userData.physicsBody = floor9Body;

    // Create platform 10 (teal)
    const floor10Body = new CANNON.Body({
        shape: new CANNON.Box(new CANNON.Vec3(12.5 / 2, 6.135 / 2, 0.1)),
        mass: 0
    });
    floor10Body.position.set(-6.25, 0.05, 46.9325);
    floor10Body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(floor10Body);
    floorBodies.push(floor10Body);

    // Create platform 11 (pink)
    const floor11Body = new CANNON.Body({
        shape: new CANNON.Box(new CANNON.Vec3(37.5 / 2, 100 / 2, 0.1)),
        mass: 0
    });
    floor11Body.position.set(-31.25, 0.05, 0);
    floor11Body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(floor11Body);
    floorBodies.push(floor11Body);

    // Create walls (physics bodies only - no visual meshes)
    const walls = [
        // Wall 12 (blue, at x=50)
        { shape: [100 / 2, 10 / 2, 0.1], position: [50, 5, 0], rotation: [0, -Math.PI / 2, 0] },
        // Wall 13 (silver, at z=50)
        { shape: [100 / 2, 12 / 2, 0.1], position: [0, 4, 50], rotation: [0, 0, 0] },
        // Wall 15 (brown, at z=-50)
        { shape: [100 / 2, 12 / 2, 0.1], position: [0, 4, -50], rotation: [0, 0, 0] },
        // Wall 16 (coral, at z=-1.5)
        { shape: [5 / 2, 5 / 2, 0.1], position: [47.5, 2.5, -1.5], rotation: [0, 0, 0] },
        // Wall 17 (violet, at x=45)
        { shape: [30/2, 5 / 2, 0.1], position: [45, 2.5, 13.5], rotation: [0, -Math.PI / 2, 0] },
        // Wall 18 (olive, at y=5)
        { shape: [30 / 2, 5 / 2, 0.1], position: [47.5, 5, 13.5], rotation: [-Math.PI / 2, 0, -Math.PI / 2] },
        // Wall 19 (maroon, at z=28.5)
        { shape: [5 / 2, 2.5 / 2, 0.1], position: [47.5, 3.75, 28.5], rotation: [0, 0, 0] },
        // Wall 20 (turquoise, at z=28.5)
        { shape: [1.875 / 2, 2.5 / 2, 0.1 / 2], position: [45.9375, 1.25, 28.5], rotation: [0, 0, 0] },
        // Wall 21 (indigo, at z=28.5)
        { shape: [1.875 / 2, 2.5 / 2, 0.1 / 2], position: [49.0625, 1.25, 28.5], rotation: [0, 0, 0] },
        // Wall 22 (navy, at x=37.475)
        { shape: [14.159/2,12/2,0.1], position: [37.475, 4, -42.9205], rotation: [0, -Math.PI / 2, 0] },
        // Wall 23 (aqua, at x=37.475)
        { shape: [82.642 / 2, 12 / 2, 0.1], position: [37.475, 4, 8.679], rotation: [0, -Math.PI / 2, 0] },
        // Wall 24 (chartreuse, at x=37.475)
        { shape: [3.199 / 2, 5/2,0.1], position: [37.475, 7.5, -34.2415], rotation: [0, -Math.PI / 2, 0] },
        // Wall 25 (sienna, at x=24.95)
        { shape: [89.218 / 2, 12/2, 0.1], position: [24.95, 4, -5.391], rotation: [0, -Math.PI / 2, 0] },
        // Wall 26 (teal, at x=24.95)
        { shape: [3.081 / 2, 5/2, 0.1], position: [24.95, 7.5, 40.7585], rotation: [0, -Math.PI / 2, 0] },
        // Wall 27 (orchid, at x=24.95)
        { shape: [7.701 / 2, 12/2, 0.1], position: [24.95, 4, 46.1495], rotation: [0, -Math.PI / 2, 0] },
        // Wall 28 (deepskyblue)
        { shape: [95.218/2, 12/2,0.1], position: [12.425, 4, 2.391], rotation: [0, -Math.PI / 2, 0] },
        // Wall 29 (firebrick)
        { shape: [1.594/2, 12/2, 0.1], position: [12.425, 4, -49.203], rotation: [0, -Math.PI / 2, 0] },
        // Wall 30 (crimson)
        { shape: [95.379/2, 12/2, 0.1], position: [0, 4, -2.3105], rotation: [0, -Math.PI / 2, 0] },
        // Wall 31 (darkorange)
        { shape: [3.081/2, 5/2, 0.1], position: [0, 7.5, 46.9195], rotation: [0, -Math.PI / 2, 0] },
        // Wall 32 (mediumseagreen)
        { shape: [1.54/2, 12/2, 0.1], position: [0, 4, 49.23], rotation: [0, -Math.PI / 2, 0] },
        // Wall 33 (slateblue)
        { shape: [1.585/2, 12/2, 0.1], position: [-12.5, 4, -49.2075], rotation: [0, -Math.PI / 2, 0] },
        // Wall 34 (goldenrod)
        { shape: [95.246/2, 12/2, 0.1], position: [-12.5, 4, 2.377], rotation: [0, -Math.PI / 2, 0] },
        // Wall 35 (crimson)
        { shape: [95.379/2, 12/2, 0.1], position: [-25, 4, -2.3105], rotation: [0, -Math.PI / 2, 0] },
        // Wall 36 (darkorange)
        { shape: [3.081/2, 5/2, 0.1], position: [-25, 7.5, 46.9195], rotation: [0, -Math.PI / 2, 0] },
        // Wall 37 (mediumseagreen)
        { shape: [1.54/2, 12/2, 0.1], position: [-25, 4, 49.23], rotation: [0, -Math.PI / 2, 0] },
        // Wall 38 (darkviolet)
        { shape: [3.17/2, 12/2, 0.1], position: [-37.5, 4, -48.415], rotation: [0, -Math.PI / 2, 0] },
        // Wall 39 (tomato)
        { shape: [3.169/2, 5/2, 0.1], position: [-37.5, 7.5, -45.2455], rotation: [0, -Math.PI / 2, 0] },
        // Wall 40 (steelblue)
        { shape: [93.661/2, 12/2, 0.1], position: [-37.5, 4, 3.1695], rotation: [0, -Math.PI / 2, 0] },
        // Wall 41 (peru)
        { shape: [12.5/2, 1, 0.1], position: [31.25, -1, 0.71252], rotation: [0, 0, 0] },
        // Wall 42 (saddlebrown)
        { shape: [12.5/2, 1, 0.1], position: [31.25, -1, 29.977 + 0.35626], rotation: [0, 0, 0] },
        // Wall 44 (royalblue)
        { shape: [4/2, 5/2, 0.1], position: [12.425, 2.5, -43.718], rotation: [0, 0, 0] },
        // Wall 45 (cornflowerblue)
        { shape: [6.282/2, 5/2, 0.1], position: [10.425, 2.5, -46.859], rotation: [0, -Math.PI / 2, 0] },
        // Wall 46 (lightskyblue)
        { shape: [6.282/2, 5/2, 0.1], position: [14.425, 2.5, -46.859], rotation: [0, -Math.PI / 2, 0] },
        // Wall 50 (mediumblue)
        { shape: [3.169/2, 7/2, 0.1], position: [-12.5, 1.5, -46.8305], rotation: [0, -Math.PI / 2, 0] },
        // Wall 52 (navy)
        { shape: [6.254/2, 1/2, 0.1], position: [-14.5, 4.5, -46.873], rotation: [0, -Math.PI / 2, 0] },
        // Wall 53 (darkblue)
        { shape: [6.254/2, 1/2, 0.1], position: [-10.5, 4.5, -46.873], rotation: [0, -Math.PI / 2, 0] },
        // Wall 56 (darkred)
        { shape: [100/2, 5/2, 0.1], position: [-50, 2.5, 0], rotation: [0, -Math.PI / 2, 0] },
        // Wall 57 (maroon)
        { shape: [100/2, 1.25/2, 0.1], position: [-50, 9.375, 0], rotation: [0, -Math.PI / 2, 0] },
        // Wall 58 (crimson)
        { shape: [49.12775/2, 3.75/2, 0.1], position: [-50, 6.875, -25.436125], rotation: [0, -Math.PI / 2, 0] },
        // Wall 59 (firebrick)
        { shape: [47.7473/2, 3.75/2, 0.1], position: [-50, 6.875, 26.12635], rotation: [0, -Math.PI / 2, 0] },
        // Wall 60 (darkmagenta)
        { shape: [3.25/2, 3.75/2, 0.1], position: [-51.5, 6.875, 2.2527], rotation: [0, 0, 0] },
        // Wall 61 (purple)
        { shape: [3.25/2, 3.75/2, 0.1], position: [-51.5, 6.875, -0.87225], rotation: [0, 0, 0] }
    ];

    walls.forEach(wall => {
        const body = new CANNON.Body({
            shape: new CANNON.Box(new CANNON.Vec3(...wall.shape)),
            mass: 0
        });
        body.position.set(...wall.position);
        if (wall.rotation) {
            body.quaternion.setFromEuler(...wall.rotation);
        }
        world.addBody(body);
    });

    // Additional platform bodies
    const additionalPlatforms = [
        // Platform 12 (dodgerblue)
        { shape: [4/2, 6.282/2, 0.1], position: [12.425, 5, -46.859], rotation: [-Math.PI / 2, 0, 0] },
        // Platform 13 (darkslategray)
        { shape: [12.5/2, 1, 0.1], position: [6.25, -1, -37.322], rotation: [-Math.PI / 2, 0, 0] },
        // Platform 14 (dimgray)
        { shape: [12.5/2, 1, 0.1], position: [6.25, -1, 37.678], rotation: [-Math.PI / 2, 0, 0] },
        // Platform 15 (slategray)
        { shape: [12.5/2, 1, 0.1], position: [-6.25, -1, 43.839], rotation: [-Math.PI / 2, 0, 0] },
        // Platform 16 (midnightblue)
        { shape: [4/2, 1/2, 0.1], position: [-12.5, 4.5, -43.746], rotation: [-Math.PI / 2, 0, 0] },
        // Platform 17 (indigo)
        { shape: [4/2, 6.254/2, 0.1], position: [-12.5, 5, -46.873], rotation: [-Math.PI / 2, 0, 0] },
        // Platform 18 (darkslateblue)
        { shape: [4/2, 6.254/2, 0.1], position: [-12.5, 4, -46.873], rotation: [-Math.PI / 2, 0, 0] },
        // Platform 19 (mediumvioletred)
        { shape: [3.25/2, 3.125/2, 0.1], position: [-51.5, 5, 0.690225], rotation: [-Math.PI / 2, 0, 0] },
        // Platform 20 (deeppink)
        { shape: [3.25/2, 3.125/2, 0.1], position: [-51.5, 8.75, 0.690225], rotation: [-Math.PI / 2, 0, 0] }
    ];

    additionalPlatforms.forEach(platform => {
        const body = new CANNON.Body({
            shape: new CANNON.Box(new CANNON.Vec3(...platform.shape)),
            mass: 0
        });
        body.position.set(...platform.position);
        body.quaternion.setFromEuler(...platform.rotation);
        world.addBody(body);
        floorBodies.push(body);
    });

    const lavaMats = updateDeadlyFloorsWithLava();
    lavaMaterials.push(...lavaMats);

    // Rest of your existing setupScene code continues...
    // Define positions for the 13 models
    const modelPositions = [
        new THREE.Vector3(38.5, 3, 45),   // Model 1
        new THREE.Vector3(43.9, 3, 0),   // Model 2
        new THREE.Vector3(39.5, 3.5, -48.9),   // Model 3
        new THREE.Vector3(38.5, 1, 0),   // Model 4
        new THREE.Vector3(38.5, 2, 38),     // Model 5
        new THREE.Vector3(39.5, 4, 48.9),    // Model 6
        new THREE.Vector3(48, 4, -48.9),    // Model 7
        new THREE.Vector3(38.5, 1.5, 20),    // Model 8
        new THREE.Vector3(43.5, 3, -48.9),    // Model 9
        new THREE.Vector3(48.9, 3, -4.2),   // Model 10
        new THREE.Vector3(43.9, 3, 10),    // Model 11
        new THREE.Vector3(44, 3.5, 48.9),   // Model 12
        new THREE.Vector3(43.9, 3, 15)     // Model 13
    ];

    const modelNames = [
        'one', 'two', 'three', 'four', 'five', 'six', 'seven', 
        'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen'
    ];

    // Load and place the 13 models
    for (let i = 0; i < 13; i++) {
        const loader = new GLTFLoader();
        const modelName = modelNames[i];
    
        loader.load(
            `./${modelName}.glb`,
            (gltf) => {
                const model = gltf.scene;
                model.position.copy(modelPositions[i]);
                model.scale.set(2, 2, 2);
            
                if (modelName === 'six' || modelName === 'twelve') {
                    model.rotation.y = Math.PI;
                } else if (modelName === 'one' || modelName === 'four' || modelName === 'five' || modelName === 'eight') {
                    model.rotation.y = Math.PI / 2;
                } else if (modelName === 'ten' || modelName === 'two' || modelName === 'eleven' || modelName === 'thirteen') {
                    model.rotation.y = -Math.PI / 2;
                } else if (modelName === 'three' || modelName === 'nine' || modelName === 'seven') {
                    model.rotation.y = 0;
                }
                
               
                
                scene.add(model);

                // Create physics body for ALL models
                const plate = new CANNON.Body({
                    shape: new CANNON.Box(new CANNON.Vec3(1, 1, 0.1)),
                    mass: 0
                });
                plate.position.copy(modelPositions[i]);
                plate.quaternion.setFromEuler(-Math.PI/2, 0, 0);
                world.addBody(plate);
                
                console.log(`Model ${modelName}.glb loaded at position:`, modelPositions[i]);
            },
            undefined,
            (error) => {
                console.error(`Error loading model ${modelName}.glb:`, error);
            }
        );
    }

    // Night sky background
    scene.background = new THREE.Color(0x001133);
    
    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
    directionalLight.position.set(0, 20, 0);
    directionalLight.target.position.set(0, 0, 0);
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    directionalLight.shadow.camera.near = 1;
    directionalLight.shadow.camera.far = 120;
    
    scene.add(directionalLight);
    scene.add(directionalLight.target);

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 20);
    scene.add(ambientLight);

    // Add clock model
    const clockLoader = new GLTFLoader();
    clockLoader.load(
        './clock.glb',
        (gltf) => {
            const clock = gltf.scene;
            clock.position.set(-18.8, 5, 49.9);
            clock.scale.set(1, 1, 1);
            clock.rotation.y = Math.PI/2;
            

            
            scene.add(clock);
        },
        undefined,
        (error) => {
            console.error('Error loading clock.glb:', error);
        }
    );

    // Add some sample objects to test physics
    addPlayer();
    createBuilding();
    createPuzzleElements();
    createRainbowCubes();

    createUI();
    requestPointerLock();
    initInput();
    initShooting();
    loadSignModels();
    loadNumberModels();
    loadNumberModels2(); 
    loadNumberModels3();
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

    // Door interaction prompt
    doorPromptDiv = document.createElement('div');
    doorPromptDiv.className = "game-ui";
    doorPromptDiv.textContent = 'Press E to open';
    doorPromptDiv.style.cssText = `
        color: white; font-size: 18px; position: absolute; 
        top: 60%; left: 50%; transform: translate(-50%, -50%); 
        text-shadow: 1px 1px 2px black; z-index: 1000; 
        pointer-events: none; display: none;
    `;
    document.body.appendChild(doorPromptDiv);

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
function requestPointerLock() {
    renderer.domElement.addEventListener('click', () => {
        renderer.domElement.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', onPointerLockChange);
}
function onPointerLockChange() {
    if (document.pointerLockElement === renderer.domElement) {
        document.addEventListener('mousemove', onMouseMove);
    } else {
        document.removeEventListener('mousemove', onMouseMove);
    }
}

// ── FIRST PERSON MOUSE LOOK HANDLER ────────────────────────────────
function onMouseMove(e) {
    if (document.pointerLockElement !== renderer.domElement) return;
    
    yaw -= e.movementX * MOUSE_SENS;
    pitch -= e.movementY * MOUSE_SENS;
    
    // **CRITICAL: Clamp pitch to prevent camera flip**
    pitch = Math.max(-PITCH_CLAMP, Math.min(PITCH_CLAMP, pitch));
}
let boxBody, boxMesh;

// Key state tracking object
const keys = {};
let canJump = true; // Jump cooldown flag

// Add key event listeners at the module level (e.g., after imports)
document.addEventListener('keydown', (event) => {
    keys[event.code] = true;
    
    // Handle jump when space is pressed
    if (event.code === 'Space' && canJump) {
        jump();
    }
});
document.addEventListener('keyup', (event) => {
    keys[event.code] = false;
});

// Add this function to check if player is on any floor OR on a cube
function isPlayerOnFloor() {
    if (!boxBody) return false;
    
    const playerPos = boxBody.position;
    const playerHalfHeight = 0.5; // Half of player height (1 unit total)
    
    // Check each floor body
    for (const floorBody of floorBodies) {
        const floorPos = floorBody.position;
        const floorHalfExtents = floorBody.shapes[0].halfExtents;
        
        // Calculate floor surface height (position + half thickness)
        const floorSurfaceY = floorPos.y + 0.1; // Assuming 0.1 thickness
        
        // Check if player is standing on this floor
        const isOnThisFloor = 
            playerPos.y - playerHalfHeight <= floorSurfaceY + 0.1 && // Player bottom near floor surface
            playerPos.y - playerHalfHeight >= floorSurfaceY - 0.1 && // Within small tolerance
            Math.abs(playerPos.x - floorPos.x) <= floorHalfExtents.x + 0.5 && // X overlap
            Math.abs(playerPos.z - floorPos.z) <= floorHalfExtents.y + 0.5;   // Z overlap
        
        if (isOnThisFloor) {
            return true;
        }
    }
    
    // NEW: Check if player is standing on any cube
    for (const cube of movableBoxes) {
        const cubeBody = cube.userData.physicsBody;
        if (!cubeBody) continue;
        
        const cubePos = cubeBody.position;
        const cubeHalfExtents = new CANNON.Vec3(BOX_SIZE / 2, BOX_SIZE / 2, BOX_SIZE / 2);
        
        // Calculate cube top surface height
        const cubeTopY = cubePos.y + cubeHalfExtents.y;
        
        // Check if player is standing on this cube
        const isOnThisCube = 
            playerPos.y - playerHalfHeight <= cubeTopY + 0.1 && // Player bottom near cube top
            playerPos.y - playerHalfHeight >= cubeTopY - 0.1 && // Within small tolerance
            Math.abs(playerPos.x - cubePos.x) <= cubeHalfExtents.x + 0.5 && // X overlap
            Math.abs(playerPos.z - cubePos.z) <= cubeHalfExtents.z + 0.5;   // Z overlap
        
        if (isOnThisCube) {
            console.log("Player standing on cube!");
            return true;
        }
    }
    
    return false;
}

function setupContactMaterials() {
    // Create materials for different object types
    const playerMaterial = new CANNON.Material("player");
    const cubeMaterial = new CANNON.Material("cube");
    const floorMaterial = new CANNON.Material("floor");

    // 🔥 **ADD THIS BLOCK (fixes crash instantly)**
    world.materials = {
        player: playerMaterial,
        cube: cubeMaterial,
        floor: floorMaterial
    };

    // Player-Cube contact material (high friction)
    const playerCubeContact = new CANNON.ContactMaterial(
        playerMaterial,
        cubeMaterial,
        {
            friction: 1.7,      // High friction between player and cubes
            restitution: 0.01,   // Low bounce
            contactEquationStiffness: 1e8,
            contactEquationRelaxation: 3
        }
    );

    // Player-Floor contact material
    const playerFloorContact = new CANNON.ContactMaterial(
        playerMaterial,
        floorMaterial,
        {
            friction: 0.4,      // Normal friction for floors
            restitution: 0.3,
            contactEquationStiffness: 1e8,
            contactEquationRelaxation: 3
        }
    );

    // // Cube-Floor contact material
    // const cubeFloorContact = new CANNON.ContactMaterial(
    //     cubeMaterial,
    //     floorMaterial,
    //     {
    //         friction: 0.5,
    //         restitution: 0.2,
    //         contactEquationStiffness: 1e8,
    //         contactEquationRelaxation: 3
    //     }
    // );

    // Add contact materials to world
    world.addContactMaterial(playerCubeContact);
    world.addContactMaterial(playerFloorContact);
    // world.addContactMaterial(cubeFloorContact);

    // Set default contact material (fallback)
    world.defaultContactMaterial = new CANNON.ContactMaterial(
        new CANNON.Material("default"),
        new CANNON.Material("default"),
        {
            friction: 0.0000001,
            restitution: 0
        }
    );
}

// Update the jump function to use floor contact detection
function jump() {
    if (isPlayerOnFloor() && canJump) {
        boxBody.velocity.y = 10; // Adjust this value for higher/lower jumps
        canJump = false;
        
        setTimeout(() => {
            canJump = true;
        }, 500);
    }
}

// Update the addPlayer function to include the gun
function addPlayer() {
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const boxMat = new THREE.MeshStandardMaterial({ color: 0xff5555 });
    boxMesh = new THREE.Mesh(boxGeo, boxMat);

    // SPAWN ON PLATFORM
    boxMesh.position.set(-9, 3, 48);  // Center of first green platform
    
    
    // 🔥 ROTATE PLAYER MESH TO FACE POSITIVE Z
    boxMesh.rotation.y = Math.PI; // 180 degrees to face positive Z
    
    scene.add(boxMesh);

    boxBody = new CANNON.Body({
        mass: 60,
        shape: new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)),
        linearDamping: 0.9,
        angularDamping: 1,
        material: world.materials.player  // Use the player material
    });
    boxBody.position.copy(boxMesh.position);
    
    // 🔥 ROTATE PHYSICS BODY TO MATCH
    boxBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI);
    
    world.addBody(boxBody);
    boxMesh.userData.physicsBody = boxBody;

    player = boxMesh;
    
    // 🔥 ALSO ROTATE THE CAMERA TO FACE POSITIVE Z
    yaw = Math.PI; // Set yaw to 180 degrees (facing positive Z)
    pitch = 0;     // Reset pitch to level
    
    console.log("Player spawned facing positive Z direction");

    // 🔥 ADD SCIFI GUN MODEL
    loadGunModel();
}

// Add this new function to load and position the gun
function loadGunModel() {
    const loader = new GLTFLoader();
    loader.load(
        './scifi_gun.glb',
        (gltf) => {
            gunModel = gltf.scene;
            
            // Scale the gun to appropriate size
            gunModel.scale.set(0.1, 0.1, 0.1);
            
           
            
            // Add the gun to the scene
            scene.add(gunModel);
            
            console.log("Sci-fi gun loaded and positioned for first-person view");
        },
        undefined,
        (error) => {
            console.error('Failed to load scifi_gun.glb', error);
        }
    );
}

function checkBulletCollisions(bullet, i) {
    const bb = new THREE.Box3().setFromObject(bullet.mesh);
    for (const box of movableBoxes) {
        if (bb.intersectsBox(new THREE.Box3().setFromObject(box))) {
            // If we're deselecting a cube, clear its velocity
            if (selectedBox === box) {
                const body = box.userData.physicsBody;
                body.velocity.set(0, body.velocity.y, 0); // Clear X/Z velocity, keep Y for gravity
            }
            
            selectedBox = (selectedBox === box) ? null : box;
            if (selectedBox) dragDistance = 8;
            bullet.destroy();
            bullets.splice(i, 1);
            return;
        }
    }
}
// Remove the old document.addEventListener('keydown') block entirely

// Inside updateLevel() - add movement logic here for smooth updates
export function updateLevel() {
    const delta = 1 / 60;
    world.step(delta);

    // Animate lava
    animateLava(delta);
    // ADD THIS LINE - Check for goal condition
    checkGoalCondition();

    updateBullets(delta);

    // ── PERFORMANCE OPTIMIZATION: Hide distant objects ─────────────────
    const playerPos = boxBody ? boxBody.position : new CANNON.Vec3(0, 0, 0);
    
    // Optimize movable boxes visibility
    movableBoxes.forEach(box => {
        if (box.position.distanceTo(playerPos) > 50) {
            box.visible = false; // stop rendering it completely
        } else {
            box.visible = true;
        }
    });
    
    // Optimize rainbow cubes visibility
    rainbowCubes.forEach(cube => {
        if (cube.position.distanceTo(playerPos) > 40) {
            cube.visible = false;
        } else {
            cube.visible = true;
        }
    });
    
    // Optimize door visibility
    doors.forEach(door => {
        if (door.model.position.distanceTo(playerPos) > 30) {
            door.model.visible = false;
        } else {
            door.model.visible = true;
        }
    });
    // ── UPDATE WALKING SOUND ─────────────────────────────────────────
    updateWalkingSound();

// ── CHECK CUBE ON FIRST PLATE ──────────────────────────────────
if (!firstDoorOpenable) {
    let cubeOnPlate = false;
    
    for (const box of movableBoxes) {
        const boxPos = box.position;
        const platePos = new THREE.Vector3(47.5, 0, 15);
        
        // Check if cube is on the plate (within XZ range and close to plate height)
        const distanceXZ = Math.sqrt(
            Math.pow(boxPos.x - platePos.x, 2) + 
            Math.pow(boxPos.z - platePos.z, 2)
        );
        const heightDiff = Math.abs(boxPos.y - platePos.y);
        
        // If cube is within 2 units in XZ and resting on plate (height < 2)
        if (distanceXZ < 2 && heightDiff < 2 && box.userData.physicsBody.velocity.length() < 0.1) {
            cubeOnPlate = true;
            break;
        }
    }
    
    if (cubeOnPlate) {
        if (!cubeOnPlateTimer) {
            // Start timer when cube first lands on plate
            cubeOnPlateTimer = setTimeout(() => {
                firstDoorOpenable = true;
                console.log("First door is now openable!");
                cubeOnPlateTimer = null;
            }, 3000); // 3 seconds
        }
    } else {
        // Reset timer if cube leaves plate
        if (cubeOnPlateTimer) {
            clearTimeout(cubeOnPlateTimer);
            cubeOnPlateTimer = null;
        }
    }
}

// ── CHECK CUBES ON SECOND DOOR PLATES ──────────────────────────
if (!secondDoorOpenable) {
    // Reset all plate status first
    let anyPlateChanged = false;
    
    Object.keys(platePositions).forEach(plateKey => {
        const platePos = platePositions[plateKey];
        let cubeOnThisPlate = false;
        
        for (const box of movableBoxes) {
            const boxPos = box.position;
            const body = box.userData.physicsBody;
            
            // More precise plate detection
            const distanceXZ = Math.sqrt(
                Math.pow(boxPos.x - platePos.x, 2) + 
                Math.pow(boxPos.z - platePos.z, 2)
            );
            const heightDiff = Math.abs(boxPos.y - platePos.y);
            
            // Check if cube is centered on plate (tighter bounds) and at rest
            if (distanceXZ < 1.5 && heightDiff < 1.5 && body.velocity.length() < 0.5) {
                cubeOnThisPlate = true;
                break;
            }
        }
        
        // Handle plate timer logic
        if (cubeOnThisPlate) {
            if (!plateTimers[plateKey]) {
                // Start timer when cube first lands on plate
                plateTimers[plateKey] = setTimeout(() => {
                    platesOccupied[plateKey] = true;
                    console.log(`✅ Plate ${plateKey} is now occupied!`);
                    plateTimers[plateKey] = null;
                    checkSecondDoorUnlock();
                }, 2000); // 2 seconds for more responsive feel
            }
        } else {
            // Reset timer if cube leaves plate
            if (plateTimers[plateKey]) {
                clearTimeout(plateTimers[plateKey]);
                plateTimers[plateKey] = null;
                console.log(`⏱️ Timer reset for plate ${plateKey}`);
            }
            // Reset plate status if cube leaves
            if (platesOccupied[plateKey]) {
                platesOccupied[plateKey] = false;
                console.log(`❌ Plate ${plateKey} is no longer occupied`);
                secondDoorOpenable = false; // Door locks if any plate becomes unoccupied
            }
        }
    });
}

// ── DRAG SELECTED CUBE (now moves the CANNON body) ─────────────────
if (selectedBox && document.pointerLockElement === renderer.domElement) {
    const body = selectedBox.userData.physicsBody;

    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    
    // Calculate the target position with minimum distance constraint
    const playerPos = player.position.clone();
    const cubePos = new THREE.Vector3(body.position.x, body.position.y, body.position.z);
    const currentDistance = playerPos.distanceTo(cubePos);
    
    // Ensure minimum distance
    if (currentDistance < MIN_CUBE_DISTANCE) {
        // Push the cube away from the player
        const awayDirection = new THREE.Vector3().subVectors(cubePos, playerPos).normalize();
        const minDistancePos = playerPos.clone().add(awayDirection.multiplyScalar(MIN_CUBE_DISTANCE));
        dragDistance = camera.position.distanceTo(minDistancePos);
    }
    
    const target = camera.position.clone().add(dir.multiplyScalar(dragDistance));

    const current = new THREE.Vector3(body.position.x, body.position.y, body.position.z);
    const toTarget = new THREE.Vector3().subVectors(target, current);
    const dist = toTarget.length();

    if (dist > 0.05) {
        toTarget.normalize();
        const speed = Math.min(dist * 50, 25); // responsive but capped
        body.velocity.set(
            toTarget.x * speed,
            toTarget.y * speed,
            toTarget.z * speed
        );
    } else {
        body.velocity.set(0, 0, 0);
    }

    // Damp spin
    body.angularVelocity.scale(0.9);
}

    // ── PLAYER MOVEMENT (WASD) ───────────────────────────────────────
    const speed = 4;
    const move = new THREE.Vector3();
    if (keys['KeyW']) move.z += 2;
    if (keys['KeyS']) move.z -= 2;
    if (keys['KeyA']) move.x -= 2;
    if (keys['KeyD']) move.x += 2;
    if (move.lengthSq() > 0) {
        move.normalize().multiplyScalar(speed);
        // apply in world space (rotate by yaw)
        const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0,1,0), yaw);
        const right   = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0,1,0), yaw);
        const vel = new CANNON.Vec3(
            right.x * move.x + forward.x * move.z,
            boxBody.velocity.y,
            right.z * move.x + forward.z * move.z
        );
        boxBody.velocity.x = vel.x;
        boxBody.velocity.z = vel.z;
    }

    // ── JUMP (space) ─────────────────────────────────────────────────
    if (keys['Space'] && canJump && isPlayerOnFloor()) { // Changed condition here
        boxBody.velocity.y = 16;
        canJump = false;
        setTimeout(() => canJump = true, 500);
    }

    // ── SYNC PLAYER ─────────────────────────────────────────────────
if (boxMesh && boxBody) {
    boxMesh.position.copy(boxBody.position);
    boxMesh.quaternion.copy(boxBody.quaternion);
}

checkForDeath();

// ── SYNC STATIC OBJECTS ─────────────────────────────────────────
scene.traverse(obj => {
    if (obj.userData.physicsBody && obj !== boxMesh) {
        const b = obj.userData.physicsBody;
        obj.position.copy(b.position);
        obj.quaternion.copy(b.quaternion);
    }
});

    // ── DOOR ANIMATION (half-open) ───────────────────────────────────
    doors.forEach(door => {
        if (door.mixer && door.action && door.isOpen && !door.animationCompleted) {
            if (door.action.time >= door.model.userData.halfDuration) {
                door.action.paused = true;
                door.animationCompleted = true;
            } else {
                door.mixer.update(delta);
            }
        } else if (door.mixer) {
            door.mixer.update(delta);
        }
    });

    // ── UI PROMPT ─────────────────────────────────────────────────────
   // ── UI PROMPT ─────────────────────────────────────────────────────
const targeted = getTargetedDoor();

if (targeted) {
    const doorIndex = doors.indexOf(targeted);

    if (doorIndex === 0) {
        // First door logic
        if (firstDoorOpenable) {
            doorPromptDiv.textContent = 'Press E to open';
            doorPromptDiv.style.display = 'block';
        } else {
            doorPromptDiv.textContent = 'Place cube on plate to unlock';
            doorPromptDiv.style.display = 'block';
        }
    } else if (doorIndex === 1) {
        // Second door logic
        if (secondDoorOpenable) {
            doorPromptDiv.textContent = 'Press E to open';
            doorPromptDiv.style.display = 'block';
        } else {
            const occupiedCount = Object.values(platesOccupied).filter(Boolean).length;
            doorPromptDiv.textContent = `Place cubes on plates (${occupiedCount}/3 occupied)`;
            doorPromptDiv.style.display = 'block';
        }
    } else if (doorIndex === 6) {
        // Door 7 logic (four, five, six, seven puzzle)
        if (door7Openable) {
            doorPromptDiv.textContent = 'Press E to open';
            doorPromptDiv.style.display = 'block';
        } else {
            const occupiedCount = Object.values(numberPlatesOccupied).filter(Boolean).length;
            doorPromptDiv.textContent = `Place cubes on number plates 4, 5, 6, 7 (${occupiedCount}/4 occupied)`;
            doorPromptDiv.style.display = 'block';
        }
    } else if (doorIndex === 7) {
        // Door 8 logic (four, five, one puzzle)
        if (door8Openable) {
            doorPromptDiv.textContent = 'Press E to open';
            doorPromptDiv.style.display = 'block';
        } else {
            const occupiedCount = Object.values(numberPlates2Occupied).filter(Boolean).length;
            doorPromptDiv.textContent = `Place cubes on plates 4, 5, and 1 (${occupiedCount}/3 occupied)`;
            doorPromptDiv.style.display = 'block';
        }
    } else if (doorIndex === 8) {
        // Door 9 logic (rainbow puzzle)
        if (door9Openable) {
            doorPromptDiv.textContent = 'Press E to open';
            doorPromptDiv.style.display = 'block';
        } else {
            const occupiedCount = Object.values(numberPlates3Occupied).filter(Boolean).length;
            doorPromptDiv.textContent = `Place rainbow cubes on correct number plates (${occupiedCount}/7 correct)`;
            doorPromptDiv.style.display = 'block';
        }
    } else {
        // Other doors (always openable)
        doorPromptDiv.textContent = 'Press E to open';
        doorPromptDiv.style.display = 'block';
    }
} else {
    doorPromptDiv.style.display = 'none';
}

// Add the number plate check to the updateLevel function
// In the updateLevel function, add this after the other plate checks:
// In updateLevel() function, add this after the other plate checks:
checkNumberPlates();
checkNumberPlates2();
checkNumberPlates3(); // Add this line

    // ── CAMERA ───────────────────────────────────────────────────────
    updateCamera();
}

let doors = []; // Array to store door objects and their mixers
// Update the door positions array to match the correct indices
function createBuilding() {
    const loader = new GLTFLoader();
    loader.load(
        './official_map.glb',
        (gltf) => {
            const model = gltf.scene;
            scene.add(model);

            // CORRECTED DOOR POSITIONS WITH PROPER INDEXING
            const doorPositions = [
                new THREE.Vector3(47.5, 0.01, 28.5),     // Door 0: First door (cube on plate)
                new THREE.Vector3(37.5, 0.01, -34.25),   // Door 1: Second door (3 plates)
                new THREE.Vector3(25, 0.01, 40.75),      // Door 2: Always openable
                new THREE.Vector3(12.40625, 5.01, -47.25), // Door 3: Always openable
                new THREE.Vector3(0, 0.01, 47),          // Door 4: Always openable
                new THREE.Vector3(-12.59375, 5.01, -47.25), // Door 5: Always openable
                new THREE.Vector3(-25, 0.01, 47),        // Door 6: Four, five, six, seven puzzle
                new THREE.Vector3(-37.5, 0.01, -45.25),  // Door 7: Four, five, one puzzle
                new THREE.Vector3(-51.5, 5.01, 0.6997)   // Door 8: Rainbow puzzle
            ];

            doorPositions.forEach((position, index) => {
                loader.load(
                    './sc-fi_door.glb',
                    (doorGltf) => {
                        const door = doorGltf.scene;
                        door.position.copy(position);
                        door.name = `door_${index}`;
                        
                        // Apply scaling and rotation to doors 1-8
                        if (index >= 1 && index <= 8) {
                            door.scale.set(2, 2, 2);
                            door.rotation.y = Math.PI / 2;
                            console.log(`Door ${index} scaled by 2 and rotated 90 degrees`);
                        }
                        
                        scene.add(door);

                        // Create physics bodies for all doors (NO DEBUG MESHES)
                        if (index >= 1 && index <= 8) {
                            // Door 1-8 physics body (larger doors)
                            const doorBody = new CANNON.Body({
                                shape: new CANNON.Box(new CANNON.Vec3(3.2/2, 5/2, 0.1)),
                                mass: 0
                            });
                            doorBody.position.set(
                                door.position.x,
                                door.position.y + 5/2,
                                door.position.z
                            );
                            doorBody.quaternion.setFromEuler(0, -Math.PI / 2, 0);
                            world.addBody(doorBody);
                            doorBodies[index] = doorBody;
                        } else {
                            // Door 0 physics body (smaller door)
                            const doorBody = new CANNON.Body({
                                shape: new CANNON.Box(new CANNON.Vec3(1.25/2, 2.5/2, 0.1)),
                                mass: 0
                            });
                            doorBody.position.set(
                                door.position.x,
                                door.position.y + 2.5/2,
                                door.position.z
                            );
                            world.addBody(doorBody);
                            doorBodies[index] = doorBody;
                        }

                        // Set up animation
                        const mixer = new THREE.AnimationMixer(door);
                        const animations = doorGltf.animations;
                        const openAction = animations.find(anim => anim.name.toLowerCase().includes('open'));
                        if (openAction) {
                            const action = mixer.clipAction(openAction);
                            action.setLoop(THREE.LoopOnce);
                            action.clampWhenFinished = true;
                            
                            const originalDuration = openAction.duration;
                            const halfDuration = originalDuration / 2;
                            
                            action.time = 0;
                            action.setEffectiveTimeScale(1);
                            action.setEffectiveWeight(1);
                            
                            door.userData.halfDuration = halfDuration;
                            
                            doors.push({ model: door, mixer, action, isOpen: false, animationCompleted: false });
                            console.log(`Door ${index} loaded at (${position.x}, ${position.y}, ${position.z}) with half-open animation`);
                        } else {
                            console.warn(`No "open" animation found for door ${index}`);
                            doors.push({ model: door, mixer, action: null, isOpen: false, animationCompleted: false });
                        }
                    },
                    (xhr) => {
                        console.log(`Door ${index}: ${(xhr.loaded / xhr.total * 100)}% loaded`);
                    },
                    (error) => {
                        console.error(`Error loading sci-fi_door.glb for door ${index}:`, error);
                    }
                );
            });

            console.log('map.glb loaded and collision boxes added');
        },
        (xhr) => {
            console.log((xhr.loaded / xhr.total * 100) + '% loaded');
        },
        (error) => {
            console.error('Error loading map.glb:', error);
        }
    );
    // CREATE VISIBLE BLUE PLATE FOR DOOR 0
    const firstPlateGeo = new THREE.BoxGeometry(3, 0.2, 3); // Larger size for visibility
    const firstPlateMat = new THREE.MeshStandardMaterial({
        color: 0x808080,          
        roughness: 0.2,
        metalness: 0.8,
        side: THREE.DoubleSide,
    });
    const firstPlateMesh = new THREE.Mesh(firstPlateGeo, firstPlateMat);
    firstPlateMesh.position.set(47.5, 0.1, 15); // Slightly above ground
    firstPlateMesh.rotation.x = -Math.PI / 2; // Make it horizontal
    scene.add(firstPlateMesh); 
    // Physics body for the plate
    const firstPlateBody = new CANNON.Body({
        shape: new CANNON.Box(new CANNON.Vec3(1.5, 0.1, 1.5)),
        mass: 0
    });
    firstPlateBody.position.set(47.5, 0, 15);
    world.addBody(firstPlateBody);
    firstPlateMesh.userData.physicsBody = firstPlateBody;
    
    console.log("Blue pressure plate created at position (47.5, 0, 15)");
}


function getTargetedDoor() {
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    raycaster.set(camera.position, direction);
    raycaster.far = DOOR_INTERACT_DISTANCE;

    for (const door of doors) {
        const hits = raycaster.intersectObject(door.model, true);
        if (hits.length > 0) {
            const dist = camera.position.distanceTo(door.model.position);
            if (dist <= DOOR_INTERACT_DISTANCE && !door.isOpen) {
                const doorIndex = doors.indexOf(door);
                
                // Door 0: First door (cube on plate)
                if (doorIndex === 0 && !firstDoorOpenable) {
                    return null;
                }
                
                // Door 1: Second door (3 plates)
                if (doorIndex === 1 && !secondDoorOpenable) {
                    return null;
                }
                
                // Door 6: Four, five, six, seven puzzle
                if (doorIndex === 6 && !door7Openable) {
                    return null;
                }
                
                // Door 7: Four, five, one puzzle  
                if (doorIndex === 7 && !door8Openable) {
                    return null;
                }
                
                // Door 8: Rainbow puzzle
                if (doorIndex === 8 && !door9Openable) {
                    return null;
                }
                
                return door;
            }
        }
    }
    return null;
}


function initInput() {
    document.addEventListener('keydown', e => {
        if (e.code === 'KeyE') {
            const door = getLookedAtDoor();
            if (door) {
                const doorIndex = doors.indexOf(door);
                let isOpenable = true;

                // Check openable status for specified doors
                if (doorIndex === 0) isOpenable = firstDoorOpenable;
                else if (doorIndex === 1) isOpenable = secondDoorOpenable;
                else if (doorIndex === 6) isOpenable = door7Openable;
                else if (doorIndex === 7) isOpenable = door8Openable;
                else if (doorIndex === 8) isOpenable = door9Openable;

                if (!isOpenable && [0, 1, 6, 7, 8].includes(doorIndex)) {
                    // Play locked sound for specified doors
                    if (doorLockedSound && !doorLockedSound.isPlaying) {
                        doorLockedSound.play();
                        console.log(`Door ${doorIndex} is locked - playing sound`);
                    }
                } else if (door.action && !door.isOpen) {
                    door.action.reset().play();
                    door.isOpen = true;
                    
                    // Remove the physics body for this door
                    if (doorBodies[doorIndex]) {
                        world.removeBody(doorBodies[doorIndex]);
                        doorBodies[doorIndex] = null;
                        console.log(`Door ${doorIndex} physics body removed`);
                    }
                    // Play open sound
    if (doorOpenSound && !doorOpenSound.isPlaying) {
        doorOpenSound.play();
        console.log(`Door ${doorIndex} opening - playing sound`);
    }
                }
            }
        }
    });
}
// ── Shooting ────────────────────────────────────────────────────
function initShooting() {
    renderer.domElement.addEventListener('click', e => {
        if (e.button !== 0 || document.pointerLockElement !== renderer.domElement) return;
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        const start = camera.position.clone().add(dir.clone().multiplyScalar(1));
        bullets.push(new Bullet(start, dir));
    });
    renderer.domElement.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (selectedBox) { 
        // Clear velocity when deselecting via right-click
        const body = selectedBox.userData.physicsBody;
        body.velocity.set(0, body.velocity.y, 0); // Clear X/Z velocity, keep Y for gravity
        selectedBox = null; 
        console.log('Deselected'); 
    }
});
    
    // Add mouse wheel event listener for cube distance control
    renderer.domElement.addEventListener('wheel', handleMouseWheel);
}

// ── Mouse wheel handler for cube distance control ───────────────
function handleMouseWheel(event) {
    if (!selectedBox || document.pointerLockElement !== renderer.domElement) return;
    
    event.preventDefault();
    
    // Scroll down (negative delta) brings cube closer
    // Scroll up (positive delta) pushes cube away
    const delta = -event.deltaY * 0.001; // Normalize and invert for intuitive control
    
    // Update drag distance with scroll sensitivity
    dragDistance += delta * SCROLL_SENSITIVITY;
    
    // Clamp the distance to min and max values
    dragDistance = Math.max(MIN_CUBE_DISTANCE, Math.min(MAX_CUBE_DISTANCE, dragDistance));
    
    console.log(`Cube distance: ${dragDistance.toFixed(2)}`);
}

// ── Bullet update & collision ───────────────────────────────────
function updateBullets(delta) {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        if (!b.active) { bullets.splice(i, 1); continue; }
        b.update(delta);
        checkBulletCollisions(b, i);
    }
}


// Also add goal cleanup in the cleanupLevel function
export function cleanupLevel() {
    console.log("Level 3 cleanup started");
    
    // Stop walking sound if playing
    if (walkingSound && walkingSound.isPlaying) {
        walkingSound.stop();
    }
    walkingSound = null;
    isWalking = false;

    // Stop and cleanup door locked sound
    if (doorLockedSound && doorLockedSound.isPlaying) {
        doorLockedSound.stop();
    }
    doorLockedSound = null;

    // Stop and cleanup door open sound
    if (doorOpenSound && doorOpenSound.isPlaying) {
        doorOpenSound.stop();
    }
    doorOpenSound = null;
    
    // Remove the audio listener from camera
    if (camera) {
        const listener = camera.children.find(child => child instanceof THREE.AudioListener);
        if (listener) {
            camera.remove(listener);
        }
    }console.log("Level 3 cleanup started");
    
    // Replace the UI removal block:
    document.querySelectorAll('.game-ui').forEach(el => {
        if (el.id !== 'victory-message') {  // 🔥 Keep victory, remove ALL else (incl. death)
            el.remove();
        }
    });

    // Clear lava materials
    lavaMaterials.length = 0;
    
    // Clear rainbow cubes and make them visible again
    rainbowCubes.forEach(cube => {
        cube.visible = true; // Reset visibility
        if (cube.userData.physicsBody) {
            world.removeBody(cube.userData.physicsBody);
        }
        scene.remove(cube);
    });
    rainbowCubes = [];
    
    // Reset floor mesh references
    floor4Mesh = null;
    floor8Mesh = null;
    floor9Mesh = null;

    // 5. Reset puzzle state
    secondDoorOpenable = false;
    firstDoorOpenable = false;
    goalReached = false;
    door7Openable = false;  // Door 6: four, five, six, seven puzzle
    door8Openable = false;  // Door 7: four, five, one puzzle
    door9Openable = false;  // Door 8: rainbow puzzle

    // 2. Remove event listeners
    document.removeEventListener('pointerlockchange', onPointerLockChange);
    document.removeEventListener('mousemove', onMouseMove);
    renderer.domElement.removeEventListener('wheel', handleMouseWheel);

    // 3. Clear all timeouts to prevent delayed executions
    Object.keys(plateTimers).forEach(plateKey => {
        if (plateTimers[plateKey]) {
            clearTimeout(plateTimers[plateKey]);
            plateTimers[plateKey] = null;
        }
    });
    
    Object.keys(numberPlateTimers).forEach(plateKey => {
        if (numberPlateTimers[plateKey]) {
            clearTimeout(numberPlateTimers[plateKey]);
            numberPlateTimers[plateKey] = null;
        }
    });
    
    Object.keys(numberPlate2Timers).forEach(plateKey => {
        if (numberPlate2Timers[plateKey]) {
            clearTimeout(numberPlate2Timers[plateKey]);
            numberPlate2Timers[plateKey] = null;
        }
    });
    
    if (cubeOnPlateTimer) {
        clearTimeout(cubeOnPlateTimer);
        cubeOnPlateTimer = null;
    }

    // 4. Remove door bodies and reset door visibility
    doorBodies.forEach((body, index) => {
        if (body && world) {
            world.removeBody(body);
        }
    });
    
    // Reset door visibility
    doors.forEach(door => {
        door.model.visible = true;
    });

    // In cleanupLevel(), add these reset lines:
    door9Openable = false;

    numberPlates3Occupied = {
        one3: false,
        two3: false,
        three3: false,
        four3: false,
        five3: false,
        six3: false,
        seven3: false
    };

    Object.keys(numberPlate3Timers).forEach(plateKey => {
        if (numberPlate3Timers[plateKey]) {
            clearTimeout(numberPlate3Timers[plateKey]);
            numberPlate3Timers[plateKey] = null;
        }
    });

    // 5. Reset puzzle state
    secondDoorOpenable = false;
    firstDoorOpenable = false;
    goalReached = false;
    door7Openable = false;
    door8Openable = false; // 🔥 ADD THIS LINE
    
    platesOccupied = {
        plate13: false,
        plate11: false, 
        plate1: false
    };
    
    numberPlatesOccupied = {
        four: false,
        five: false,
        six: false,
        seven: false
    };

    numberPlates2Occupied = { // 🔥 ADD THIS BLOCK
        four2: false,
        five2: false,
        one2: false
    };

    doorBodies = [];
    
    // 6. Clear bullets and boxes, reset box visibility
    bullets.forEach(b => b.destroy());
    bullets = [];
    
    // Reset box visibility before clearing
    movableBoxes.forEach(box => {
        box.visible = true;
    });
    movableBoxes = [];
    selectedBox = null;

    // 8. Clear physics world
    if (world) {
        // Remove all bodies except the static ones that will be recreated
        const bodiesToRemove = [...world.bodies];
        bodiesToRemove.forEach(body => {
            world.removeBody(body);
        });
    }

    // Reset death flag
    playerDied = false;
    console.log("Level 3 cleanup completed");
}

// Add this function to level3.js to handle game loop pausing more safely
function safePauseGameLoop() {
    try {
        if (window.pauseGameLoop) {
            window.pauseGameLoop();
        }
        // Also stop the renderer's animation loop
        if (renderer) {
            renderer.setAnimationLoop(null);
        }
    } catch (error) {
        console.warn('Error pausing game loop:', error);
    }
}

function updateCamera() {
    if (!player) return;
    
    // **HIDE PLAYER MESH** (run once)
    if (player.visible !== false) {
        player.visible = false;
        player.traverse((child) => {
            if (child.isMesh) child.visible = false;
        });
        console.log('Player mesh hidden for first-person view');
    }
    
    // **SIMPLE FPS POSITIONING**
    camera.position.copy(player.position);
    camera.position.y += EYE_HEIGHT;
    
    // **DIRECT ROTATION** (using the yaw and pitch that now start at PI)
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw;    // This should be PI (180 degrees) initially
    camera.rotation.x = pitch;  // This should be 0 initially
    
    // 🔥 UPDATE GUN POSITION AND ROTATION TO FOLLOW CAMERA
    if (gunModel) {
        // Make the gun follow the camera exactly
        gunModel.position.copy(camera.position);
        gunModel.rotation.copy(camera.rotation);
        
        // Apply additional rotation to make the gun point forward
        // Adjust these values based on how your gun model is oriented
        gunModel.rotateY(Math.PI/2); // 180 degrees to face forward
        
        // Apply the offset to position it in front of the camera
        const offset = new THREE.Vector3(0.3, -0.2, -0.5);
        offset.applyQuaternion(camera.quaternion);
        gunModel.position.add(offset);
    }
}

// Make functions available for the main game loop
window.returnToMainMenuFromLevel3 = returnCallback;
function checkSecondDoorUnlock() {
    const allPlatesOccupied = platesOccupied.plate1 && platesOccupied.plate11 && platesOccupied.plate13;
    
    if (allPlatesOccupied && !secondDoorOpenable) {
        secondDoorOpenable = true;
        console.log("🎉 SECOND DOOR UNLOCKED! All three plates are occupied!");
        
        // Visual feedback - you can add some effect here
        // For example, change the color of the second door or add a sound
    }
}
// Add this function to load and place the sign models
function loadSignModels() {
    const signPositions = [
        { model: 'sixSign', position: new THREE.Vector3(31.25, 5, -49.9) },
        { model: 'sevenSign', position: new THREE.Vector3(18.5, 5, 49.9) },
        { model: 'fourSign', position: new THREE.Vector3(6.25, 5, -49.9) },
        { model: 'fiveSign', position: new THREE.Vector3(-6.25, 5, 49.9) }
    ];

    signPositions.forEach(signData => {
        const loader = new GLTFLoader();
        loader.load(
            `./${signData.model}.glb`,
            (gltf) => {
                const sign = gltf.scene;
                sign.position.copy(signData.position);
                
                // Scale the sign appropriately (adjust as needed)
                sign.scale.set(1, 1, 1);
                
                // Rotate signs to face the appropriate direction
                if (signData.model === 'sixSign' || signData.model === 'fourSign') {
                    // Signs at negative Z positions - face positive Z
                    sign.rotation.y = -Math.PI/2;
                } else if (signData.model === 'sevenSign' || signData.model === 'fiveSign') {
                    // Signs at positive Z positions - face negative Z
                    sign.rotation.y = Math.PI/2;
                }
              
                
                scene.add(sign);
                console.log(`${signData.model}.glb loaded at position:`, signData.position);
            },
            undefined,
            (error) => {
                console.error(`Error loading ${signData.model}.glb:`, error);
            }
        );
    });
}

// Add this function to load and place the number models
function loadNumberModels() {
    const numberPositions = [
        { model: 'one', position: new THREE.Vector3(-24, 7, 42), plateKey: 'one' },
        { model: 'two', position: new THREE.Vector3(-24, 7, 39), plateKey: 'two' },
        { model: 'three', position: new THREE.Vector3(-24, 7, 36), plateKey: 'three' },
        { model: 'four', position: new THREE.Vector3(-24, 4, 42), plateKey: 'four' },
        { model: 'five', position: new THREE.Vector3(-24, 4, 39), plateKey: 'five' },
        { model: 'six', position: new THREE.Vector3(-24, 4, 36), plateKey: 'six' },
        { model: 'seven', position: new THREE.Vector3(-24, 1, 42), plateKey: 'seven' },
        { model: 'eight', position: new THREE.Vector3(-24, 1, 39), plateKey: 'eight' },
        { model: 'nine', position: new THREE.Vector3(-24, 1, 36), plateKey: 'nine' }
    ];

    numberPositions.forEach(numberData => {
        const loader = new GLTFLoader();
        loader.load(
            `./${numberData.model}.glb`,
            (gltf) => {
                const number = gltf.scene;
                number.position.copy(numberData.position);
                
                // Scale the number models appropriately (adjust as needed)
                number.scale.set(2, 2, 2);
                
                // Rotate numbers to face positive Z direction (towards the center)
                number.rotation.y = Math.PI/2;
                
                
                
                scene.add(number);

                // Create physics body for the number
                const plate = new CANNON.Body({
                    shape: new CANNON.Box(new CANNON.Vec3(1, 1, 0.1)),
                    mass: 0
                });
                plate.position.copy(numberData.position);
                plate.quaternion.setFromEuler(-Math.PI/2, 0, 0);
                world.addBody(plate);
                
                // Store plate data for detection
                plate.userData.isNumberPlate = true;
                plate.userData.plateKey = numberData.plateKey;
                plate.userData.platePosition = numberData.position.clone();
                
                console.log(`${numberData.model}.glb loaded at position:`, numberData.position);
            },
            undefined,
            (error) => {
                console.error(`Error loading ${numberData.model}.glb:`, error);
            }
        );
    });
}

function checkNumberPlates() {
    if (door7Openable) return; // Skip if door is already openable
    
    // Reset all number plate status first
    let anyPlateChanged = false;
    
    // Check each required number plate (four, five, six, seven)
    const requiredPlates = ['four', 'five', 'six', 'seven'];
    
    requiredPlates.forEach(plateKey => {
        const plateData = getPlateData(plateKey);
        if (!plateData) return;
        
        let cubeOnThisPlate = false;
        
        for (const box of movableBoxes) {
            const boxPos = box.position;
            const body = box.userData.physicsBody;
            
            // Check if cube is on the plate
            const distanceXZ = Math.sqrt(
                Math.pow(boxPos.x - plateData.position.x, 2) + 
                Math.pow(boxPos.z - plateData.position.z, 2)
            );
            const heightDiff = Math.abs(boxPos.y - plateData.position.y);
            
            // Check if cube is centered on plate and at rest
            if (distanceXZ < 1.5 && heightDiff < 1.5 && body.velocity.length() < 0.5) {
                cubeOnThisPlate = true;
                break;
            }
        }
        
        // Handle plate timer logic
        if (cubeOnThisPlate) {
            if (!numberPlateTimers[plateKey]) {
                // Start timer when cube first lands on plate
                numberPlateTimers[plateKey] = setTimeout(() => {
                    numberPlatesOccupied[plateKey] = true;
                    console.log(`✅ Number Plate ${plateKey} is now occupied!`);
                    numberPlateTimers[plateKey] = null;
                    checkDoor7Unlock();
                }, 2000);
            }
        } else {
            // Reset timer if cube leaves plate
            if (numberPlateTimers[plateKey]) {
                clearTimeout(numberPlateTimers[plateKey]);
                numberPlateTimers[plateKey] = null;
                console.log(`⏱️ Timer reset for number plate ${plateKey}`);
            }
            // Reset plate status if cube leaves
            if (numberPlatesOccupied[plateKey]) {
                numberPlatesOccupied[plateKey] = false;
                console.log(`❌ Number Plate ${plateKey} is no longer occupied`);
                door7Openable = false; // Door locks if any plate becomes unoccupied
            }
        }
    });
}

function getPlateData(plateKey) {
    const platePositions = {
        'one': new THREE.Vector3(-24, 7, 42),
        'two': new THREE.Vector3(-24, 7, 39),
        'three': new THREE.Vector3(-24, 7, 36),
        'four': new THREE.Vector3(-24, 4, 42),
        'five': new THREE.Vector3(-24, 4, 39),
        'six': new THREE.Vector3(-24, 4, 36),
        'seven': new THREE.Vector3(-24, 1, 42),
        'eight': new THREE.Vector3(-24, 1, 39),
        'nine': new THREE.Vector3(-24, 1, 36)
    };
    
    return {
        position: platePositions[plateKey],
        key: plateKey
    };
}

function checkDoor7Unlock() {
    const allRequiredPlatesOccupied = numberPlatesOccupied.four && 
                                    numberPlatesOccupied.five && 
                                    numberPlatesOccupied.six && 
                                    numberPlatesOccupied.seven;
    
    if (allRequiredPlatesOccupied && !door7Openable) {
        door7Openable = true;
        console.log("🎉 DOOR 7 UNLOCKED! Plates 4, 5, 6, and 7 are occupied!");
        
        // Visual feedback - you can add some effect here
        // For example, change the color of door 7 or add a sound
    }
}
// Add this function to load the number models at the new positions
function loadNumberModels2() {
    const numberPositions2 = [
        { model: 'one', position: new THREE.Vector3(-36.5, 7, -31), plateKey: 'one2' },
        { model: 'two', position: new THREE.Vector3(-36.5, 7, -34), plateKey: 'two2' },
        { model: 'three', position: new THREE.Vector3(-36.5, 7, -37), plateKey: 'three2' },
        { model: 'four', position: new THREE.Vector3(-36.5, 4, -31), plateKey: 'four2' },
        { model: 'five', position: new THREE.Vector3(-36.5, 4, -34), plateKey: 'five2' },
        { model: 'six', position: new THREE.Vector3(-36.5, 4, -37), plateKey: 'six2' },
        { model: 'seven', position: new THREE.Vector3(-36.5, 1, -31), plateKey: 'seven2' },
        { model: 'eight', position: new THREE.Vector3(-36.5, 1, -34), plateKey: 'eight2' },
        { model: 'nine', position: new THREE.Vector3(-36.5, 1, -37), plateKey: 'nine2' }
    ];

    numberPositions2.forEach(numberData => {
        const loader = new GLTFLoader();
        loader.load(
            `./${numberData.model}.glb`,
            (gltf) => {
                const number = gltf.scene;
                number.position.copy(numberData.position);
                
                // Scale the number models appropriately (adjust as needed)
                number.scale.set(2, 2, 2);
                
                // Rotate numbers to face positive Z direction (towards the center)
                number.rotation.y = Math.PI/2;
                
                
                
                scene.add(number);

                // Create physics body for the number
                const plate = new CANNON.Body({
                    shape: new CANNON.Box(new CANNON.Vec3(1, 1, 0.1)),
                    mass: 0
                });
                plate.position.copy(numberData.position);
                plate.quaternion.setFromEuler(-Math.PI/2, 0, 0);
                world.addBody(plate);
                
                // Store plate data for detection
                plate.userData.isNumberPlate = true;
                plate.userData.plateKey = numberData.plateKey;
                plate.userData.platePosition = numberData.position.clone();
                
                console.log(`${numberData.model}.glb loaded at position:`, numberData.position);
            },
            undefined,
            (error) => {
                console.error(`Error loading ${numberData.model}.glb:`, error);
            }
        );
    });
}
function checkNumberPlates2() {
    if (door8Openable) return; // Skip if door is already openable
    
    // Reset all number plate status first
    let anyPlateChanged = false;
    
    // Check each required number plate (four2, five2, one2)
    const requiredPlates = ['four2', 'five2', 'one2'];
    
    requiredPlates.forEach(plateKey => {
        const plateData = getPlate2Data(plateKey);
        if (!plateData) return;
        
        let cubeOnThisPlate = false;
        
        for (const box of movableBoxes) {
            const boxPos = box.position;
            const body = box.userData.physicsBody;
            
            // Check if cube is on the plate
            const distanceXZ = Math.sqrt(
                Math.pow(boxPos.x - plateData.position.x, 2) + 
                Math.pow(boxPos.z - plateData.position.z, 2)
            );
            const heightDiff = Math.abs(boxPos.y - plateData.position.y);
            
            // Check if cube is centered on plate and at rest
            if (distanceXZ < 1.5 && heightDiff < 1.5 && body.velocity.length() < 0.5) {
                cubeOnThisPlate = true;
                break;
            }
        }
        
        // Handle plate timer logic
        if (cubeOnThisPlate) {
            if (!numberPlate2Timers[plateKey]) {
                // Start timer when cube first lands on plate
                numberPlate2Timers[plateKey] = setTimeout(() => {
                    numberPlates2Occupied[plateKey] = true;
                    console.log(`✅ Number Plate ${plateKey} is now occupied!`);
                    numberPlate2Timers[plateKey] = null;
                    checkDoor8Unlock();
                }, 2000);
            }
        } else {
            // Reset timer if cube leaves plate
            if (numberPlate2Timers[plateKey]) {
                clearTimeout(numberPlate2Timers[plateKey]);
                numberPlate2Timers[plateKey] = null;
                console.log(`⏱️ Timer reset for number plate ${plateKey}`);
            }
            // Reset plate status if cube leaves
            if (numberPlates2Occupied[plateKey]) {
                numberPlates2Occupied[plateKey] = false;
                console.log(`❌ Number Plate ${plateKey} is no longer occupied`);
                door8Openable = false; // Door locks if any plate becomes unoccupied
            }
        }
    });
}

function getPlate2Data(plateKey) {
    const platePositions = {
        'one2': new THREE.Vector3(-36.5, 7, -31),
        'two2': new THREE.Vector3(-36.5, 7, -34),
        'three2': new THREE.Vector3(-36.5, 7, -37),
        'four2': new THREE.Vector3(-36.5, 4, -31),
        'five2': new THREE.Vector3(-36.5, 4, -34),
        'six2': new THREE.Vector3(-36.5, 4, -37),
        'seven2': new THREE.Vector3(-36.5, 1, -31),
        'eight2': new THREE.Vector3(-36.5, 1, -34),
        'nine2': new THREE.Vector3(-36.5, 1, -37)
    };
    
    return {
        position: platePositions[plateKey],
        key: plateKey
    };
}

function checkDoor8Unlock() {
    const allRequiredPlatesOccupied = numberPlates2Occupied.four2 && 
                                    numberPlates2Occupied.five2 && 
                                    numberPlates2Occupied.one2;
    
    if (allRequiredPlatesOccupied && !door8Openable) {
        door8Openable = true;
        console.log("🎉 DOOR 8 UNLOCKED! Plates 4, 5, and 1 are occupied!");
        
        // Visual feedback - you can add some effect here
        // For example, change the color of door 8 or add a sound
    }
}

function createRainbowCubes() {
    const rainbowColors = [
        0xff0000, // Red
        0xff7f00, // Orange
        0xffff00, // Yellow
        0x00ff00, // Green
        0x0000ff, // Blue
        0x4b0082, // Indigo
        0x8b00ff  // Violet
    ];

    const cubePositions = [
        new THREE.Vector3(-40, 1,-20),   // Red
        new THREE.Vector3(-40, 1, -10),   // Orange
        new THREE.Vector3(-40, 1, 0),   // Yellow
        new THREE.Vector3(-40, 1, 10),   // Green
        new THREE.Vector3(-40, 1, 20),   // Blue
        new THREE.Vector3(-40, 1, 30),   // Indigo
        new THREE.Vector3(-40, 1, 40)    // Violet
    ];

    rainbowColors.forEach((color, index) => {
        // Create visual cube
        const cubeGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
        const cubeMaterial = new THREE.MeshStandardMaterial({ color: color });
        const cubeMesh = new THREE.Mesh(cubeGeometry, cubeMaterial);
        cubeMesh.position.copy(cubePositions[index]);
        cubeMesh.userData.isMovable = true;
        cubeMesh.userData.isRainbowCube = true;
        
        scene.add(cubeMesh);
        movableBoxes.push(cubeMesh);

        // Create physics body
        const cubeBody = new CANNON.Body({
            mass: 200,
            shape: new CANNON.Box(new CANNON.Vec3(1.5 / 2, 1.5 / 2, 1.5 / 2)),
            linearDamping: 0.9,
            angularDamping: 0.9,
            material: world.materials.cube
        });
        cubeBody.position.copy(cubePositions[index]);
        world.addBody(cubeBody);

        // Link mesh and physics body
        cubeMesh.userData.physicsBody = cubeBody;
        cubeBody.userData = cubeBody.userData || {};
        cubeBody.userData.mesh = cubeMesh;

        rainbowCubes.push(cubeMesh);
        
        console.log(`Rainbow cube ${index + 1} (${getColorName(color)}) created at:`, cubePositions[index]);
    });
}

// Helper function to get color name
function getColorName(color) {
    const colorMap = {
        0xff0000: 'Red',
        0xff7f00: 'Orange', 
        0xffff00: 'Yellow',
        0x00ff00: 'Green',
        0x0000ff: 'Blue',
        0x4b0082: 'Indigo',
        0x8b00ff: 'Violet'
    };
    return colorMap[color] || 'Unknown';
}
// Add this function to load the third set of number models
function loadNumberModels3() {
    const numberPositions3 = [
        { model: 'one', position: new THREE.Vector3(-48.9, 3, 44), plateKey: 'one3', rotation: Math.PI/2 }, // 90 degrees
        { model: 'two', position: new THREE.Vector3(-38.6, 3, -30), plateKey: 'two3', rotation: -Math.PI/2 }, // -90 degrees
        { model: 'three', position: new THREE.Vector3(-43, 4, 48.9), plateKey: 'three3', rotation: Math.PI }, // -90 degrees (default from your original condition)
        { model: 'four', position: new THREE.Vector3(-48.9, 2, -44), plateKey: 'four3', rotation: Math.PI/2 }, // 90 degrees
        { model: 'five', position: new THREE.Vector3(-38.6, 4, 0), plateKey: 'five3', rotation: -Math.PI/2 }, // -90 degrees
        { model: 'six', position: new THREE.Vector3(-43, 1, -48.9), plateKey: 'six3', rotation: 0 }, // 180 degrees
        { model: 'seven', position: new THREE.Vector3(-38.6, 2, 30), plateKey: 'seven3', rotation: -Math.PI/2 } // -90 degrees
    ];

    numberPositions3.forEach(numberData => {
        const loader = new GLTFLoader();
        loader.load(
            `./${numberData.model}.glb`,
            (gltf) => {
                const number = gltf.scene;
                number.position.copy(numberData.position);
                
                // Scale the number models appropriately (same as others)
                number.scale.set(2, 2, 2);
                
                // Apply specific rotations based on the rotation property
                number.rotation.y = numberData.rotation;
                
                scene.add(number);

                // Create physics body for the number
                const plate = new CANNON.Body({
                    shape: new CANNON.Box(new CANNON.Vec3(1, 1, 0.1)),
                    mass: 0
                });
                plate.position.copy(numberData.position);
                plate.quaternion.setFromEuler(-Math.PI/2, 0, 0);
                world.addBody(plate);
                
                // Store plate data for detection
                plate.userData.isNumberPlate = true;
                plate.userData.plateKey = numberData.plateKey;
                plate.userData.platePosition = numberData.position.clone();
                
                console.log(`${numberData.model}.glb loaded at position:`, numberData.position, `with rotation: ${numberData.rotation} radians`);
            },
            undefined,
            (error) => {
                console.error(`Error loading ${numberData.model}.glb:`, error);
            }
        );
    });
}
// Update the checkNumberPlates3 function with better debugging
function checkNumberPlates3() {
    if (door9Openable) return;
    
    console.log("Checking Door 9 rainbow puzzle...");
    
    const requiredPlates = ['one3', 'two3', 'three3', 'four3', 'five3', 'six3', 'seven3'];
    let correctCount = 0;
    
    requiredPlates.forEach(plateKey => {
        const plateData = getPlate3Data(plateKey);
        if (!plateData) return;
        
        let correctCubeOnThisPlate = false;
        const requiredColor = getRequiredColorForPlate(plateKey);
        
        for (const box of movableBoxes) {
            if (!box.userData.isRainbowCube) continue;
            
            const boxPos = box.position;
            const body = box.userData.physicsBody;
            
            // Check if cube is on the plate
            const distanceXZ = Math.sqrt(
                Math.pow(boxPos.x - plateData.position.x, 2) + 
                Math.pow(boxPos.z - plateData.position.z, 2)
            );
            const heightDiff = Math.abs(boxPos.y - plateData.position.y);
            
            if (distanceXZ < 1.5 && heightDiff < 1.5 && body.velocity.length() < 0.5) {
                const cubeColor = getCubeColor(box);
                console.log(`Cube ${cubeColor} found on plate ${plateKey}, required: ${requiredColor}`);
                
                if (cubeColor === requiredColor) {
                    correctCubeOnThisPlate = true;
                    break;
                }
            }
        }
        
        // Timer logic
        if (correctCubeOnThisPlate) {
            if (!numberPlate3Timers[plateKey]) {
                numberPlate3Timers[plateKey] = setTimeout(() => {
                    numberPlates3Occupied[plateKey] = true;
                    console.log(`✅ CORRECT! Plate ${plateKey} has ${requiredColor} cube!`);
                    numberPlate3Timers[plateKey] = null;
                    checkDoor9Unlock();
                }, 2000);
            }
        } else {
            if (numberPlate3Timers[plateKey]) {
                clearTimeout(numberPlate3Timers[plateKey]);
                numberPlate3Timers[plateKey] = null;
                console.log(`⏱️ Timer reset for plate ${plateKey}`);
            }
            if (numberPlates3Occupied[plateKey]) {
                numberPlates3Occupied[plateKey] = false;
                console.log(`❌ Plate ${plateKey} lost correct cube`);
                door9Openable = false;
            }
        }
        
        if (numberPlates3Occupied[plateKey]) correctCount++;
    });
    
    console.log(`Door 9 progress: ${correctCount}/7 correct placements`);
}
function getPlate3Data(plateKey) {
    const platePositions = {
        'one3': new THREE.Vector3(-48.9, 6, 44),
        'two3': new THREE.Vector3(-38.6, 3, -30),
        'three3': new THREE.Vector3(-43, 7, 48.9),
        'four3': new THREE.Vector3(-48.9, 2, -44),
        'five3': new THREE.Vector3(-38.6, 4, 0),
        'six3': new THREE.Vector3(-43, 1, -48.9),
        'seven3': new THREE.Vector3(-38.6, 5, 30)
    };
    
    return {
        position: platePositions[plateKey],
        key: plateKey
    };
}

// Also fix the getRequiredColorForPlate function to ensure proper mapping
function getRequiredColorForPlate(plateKey) {
    const colorMapping = {
        'one3': 'violet',    // Plate 1 should have violet cube
        'two3': 'indigo',    // Plate 2 should have indigo cube  
        'three3': 'blue',    // Plate 3 should have blue cube
        'four3': 'green',    // Plate 4 should have green cube
        'five3': 'yellow',   // Plate 5 should have yellow cube
        'six3': 'orange',    // Plate 6 should have orange cube
        'seven3': 'red'      // Plate 7 should have red cube
    };
    
    const requiredColor = colorMapping[plateKey];
    console.log(`Plate ${plateKey} requires color: ${requiredColor}`);
    return requiredColor;
}

// Fix the getCubeColor function to properly identify rainbow cube colors
function getCubeColor(cubeMesh) {
    const colorValue = cubeMesh.material.color.getHex();
    const colorMap = {
        0xff0000: 'red',        // Red
        0xff7f00: 'orange',     // Orange  
        0xffff00: 'yellow',     // Yellow
        0x00ff00: 'green',      // Green
        0x0000ff: 'blue',       // Blue
        0x4b0082: 'indigo',     // Indigo
        0x8b00ff: 'violet'      // Violet
    };
    
    const colorName = colorMap[colorValue];
    console.log(`Cube color detected: ${colorName} (hex: ${colorValue.toString(16)})`);
    return colorName || 'unknown';
}
// Also add better logging to the door unlock function
function checkDoor9Unlock() {
    const allRequiredPlatesOccupied = numberPlates3Occupied.one3 && 
                                    numberPlates3Occupied.two3 && 
                                    numberPlates3Occupied.three3 && 
                                    numberPlates3Occupied.four3 && 
                                    numberPlates3Occupied.five3 && 
                                    numberPlates3Occupied.six3 && 
                                    numberPlates3Occupied.seven3;
    
    console.log(`Door 9 unlock check: ${Object.values(numberPlates3Occupied).filter(Boolean).length}/7 plates occupied`);
    
    // FIX: Changed 'allRequiredPlacesOccupied' to 'allRequiredPlatesOccupied'
    if (allRequiredPlatesOccupied && !door9Openable) {
        door9Openable = true;
        console.log("🎉 DOOR 9 UNLOCKED! All rainbow cubes are on their correct number plates!");
        
        // You could add visual/audio feedback here
    }
}
// Add this function to create lava materials
function createLavaMaterial() {
    // Create a canvas for generating chunky lava texture
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256; // Smaller canvas for chunkier look
    canvas.height = 256;
    
    // Fill with base dark red color
    ctx.fillStyle = '#8b0000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Create chunky lava blobs
    const blobSize = 20; // Size of lava blobs
    const intensityVariation = 0.6; // How much brightness varies
    
    for (let x = 0; x < canvas.width; x += blobSize) {
        for (let y = 0; y < canvas.height; y += blobSize) {
            // Random offset for more organic look
            const offsetX = Math.random() * blobSize * 0.5;
            const offsetY = Math.random() * blobSize * 0.5;
            
            const actualX = x + offsetX;
            const actualY = y + offsetY;
            
            // Random size for each blob
            const size = blobSize * (0.7 + Math.random() * 0.6);
            
            // Create gradient for each blob
            const gradient = ctx.createRadialGradient(
                actualX, actualY, 0,
                actualX, actualY, size
            );
            
            // Bright center with dark edges
            const brightness = 0.7 + Math.random() * intensityVariation;
            gradient.addColorStop(0, `hsl(0, 100%, ${brightness * 100}%)`);
            gradient.addColorStop(0.3, `hsl(10, 100%, ${brightness * 70}%)`);
            gradient.addColorStop(1, 'rgba(139, 0, 0, 0.3)');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(actualX, actualY, size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Add some bright hot spots
    const hotSpotCount = 15;
    for (let i = 0; i < hotSpotCount; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const size = blobSize * (0.3 + Math.random() * 0.4);
        
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
        gradient.addColorStop(0, 'hsl(60, 100%, 90%)'); // Bright yellow-white center
        gradient.addColorStop(0.5, 'hsl(30, 100%, 70%)'); // Orange middle
        gradient.addColorStop(1, 'rgba(255, 100, 0, 0)'); // Fade out
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2); // Fewer repeats for larger, chunkier patterns
    
    // Create material with more roughness for chunkier look
    const material = new THREE.MeshStandardMaterial({
        map: texture,
        emissive: new THREE.Color(0xff4400), // Brighter emissive
        emissiveIntensity: 1.2, // Higher intensity
        roughness: 0.95, // More rough for less reflection
        metalness: 0.05, // Less metallic
        emissiveMap: texture // Use the same texture for emission
    });
    
    return { material, texture, canvas, ctx };
}
function updateDeadlyFloorsWithLava() {
    // Store lava materials for animation
    const lavaMaterials = [];
    
    // Check if floor meshes exist before updating them
    if (floor4Mesh) {
        const floor4Lava = createLavaMaterial();
        floor4Mesh.material = floor4Lava.material;
        lavaMaterials.push(floor4Lava);
    }
    
    if (floor8Mesh) {
        const floor8Lava = createLavaMaterial();
        floor8Mesh.material = floor8Lava.material;
        lavaMaterials.push(floor8Lava);
    }
    
    if (floor9Mesh) {
        const floor9Lava = createLavaMaterial();
        floor9Mesh.material = floor9Lava.material;
        lavaMaterials.push(floor9Lava);
    }
    
    return lavaMaterials;
}
function animateLava(delta) {
    lavaTime += delta * 1.5; // Slightly slower animation for chunkier look
    
    lavaMaterials.forEach((lava, index) => {
        if (!lava.texture) return;
        
        // Slower, more dramatic movement for chunkier lava
        lava.texture.offset.x = Math.sin(lavaTime * 0.3 + index) * 0.2;
        lava.texture.offset.y = Math.cos(lavaTime * 0.2 + index) * 0.15;
        
        // More dramatic pulsing
        const pulse = Math.sin(lavaTime * 2 + index) * 0.3 + 1.0;
        lava.material.emissiveIntensity = pulse;
        
        // Less frequent updates for chunkier look
        if (Math.random() < 0.008) { // Reduced frequency
            const ctx = lava.ctx;
            
            // Clear and redraw with slight variations
            ctx.fillStyle = '#8b0000';
            ctx.fillRect(0, 0, lava.canvas.width, lava.canvas.height);
            
            // Redraw lava blobs with slight position shifts
            const blobSize = 20;
            const shiftX = (Math.random() - 0.5) * 5; // Small position shift
            const shiftY = (Math.random() - 0.5) * 5;
            
            for (let x = 0; x < lava.canvas.width; x += blobSize) {
                for (let y = 0; y < lava.canvas.height; y += blobSize) {
                    const offsetX = Math.random() * blobSize * 0.5 + shiftX;
                    const offsetY = Math.random() * blobSize * 0.5 + shiftY;
                    
                    const actualX = x + offsetX;
                    const actualY = y + offsetY;
                    const size = blobSize * (0.7 + Math.random() * 0.6);
                    
                    const gradient = ctx.createRadialGradient(
                        actualX, actualY, 0,
                        actualX, actualY, size
                    );
                    
                    const brightness = 0.7 + Math.random() * 0.6;
                    gradient.addColorStop(0, `hsl(${Math.random() * 10}, 100%, ${brightness * 100}%)`);
                    gradient.addColorStop(0.3, `hsl(${10 + Math.random() * 10}, 100%, ${brightness * 70}%)`);
                    gradient.addColorStop(1, 'rgba(139, 0, 0, 0.3)');
                    
                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.arc(actualX, actualY, size, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            
            // Update hot spots occasionally
            if (Math.random() < 0.3) {
                const hotSpotCount = 8 + Math.floor(Math.random() * 8);
                for (let i = 0; i < hotSpotCount; i++) {
                    const x = Math.random() * lava.canvas.width;
                    const y = Math.random() * lava.canvas.height;
                    const size = blobSize * (0.2 + Math.random() * 0.5);
                    
                    const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
                    gradient.addColorStop(0, `hsl(${50 + Math.random() * 20}, 100%, 85%)`);
                    gradient.addColorStop(0.7, `hsl(${30 + Math.random() * 20}, 100%, 60%)`);
                    gradient.addColorStop(1, 'rgba(255, 100, 0, 0)');
                    
                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.arc(x, y, size, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            
            lava.texture.needsUpdate = true;
        }
    });
}
// Add this function to create the grid of point lights
function createGridLights() {
    const xValues = [-43.75, -31.25, -18.75, -6.25, 6.25, 18.75, 31.25, 43.75];
    const zValues = [0];
    const yValue = 9.8;
    
    let lightCount = 0;
    
    xValues.forEach(x => {
        zValues.forEach(z => {
            const pointLight = new THREE.PointLight(0xffffff, 500, 25); // Color, intensity, distance
            pointLight.position.set(x, yValue, z);
            
            // Configure shadow properties for better performance/quality
            pointLight.shadow.mapSize.width = 1024;
            pointLight.shadow.mapSize.height = 1024;
            pointLight.shadow.camera.near = 0.5;
            pointLight.shadow.camera.far = 50;
            pointLight.shadow.bias = -0.001;
            
            scene.add(pointLight);
            lightCount++;
            
            console.log(`Point light ${lightCount} added at (${x}, ${yValue}, ${z})`);
        });
    });
    
    console.log(`Total point lights created: ${lightCount}`);
}

function getLookedAtDoor() {
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    raycaster.set(camera.position, direction);
    raycaster.far = DOOR_INTERACT_DISTANCE;

    for (const door of doors) {
        const hits = raycaster.intersectObject(door.model, true);
        if (hits.length > 0) {
            const dist = camera.position.distanceTo(door.model.position);
            if (dist <= DOOR_INTERACT_DISTANCE && !door.isOpen) {
                return door;
            }
        }
    }
    return null;
}