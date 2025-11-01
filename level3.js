import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as CANNON from 'cannon-es';

// Store level-specific variables
let scene, camera, renderer, labelRenderer;
let world;
let returnCallback;

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
let cubeOnPlateTimer = null;

// ADD THIS LINE - Define platePositions at module level
let platePositions = {
    plate1: new THREE.Vector3(38.5, 5, 45),     // Model 1 position
    plate11: new THREE.Vector3(43.9, 3, 10),    // Model 11 position  
    plate13: new THREE.Vector3(43.9, 3, 15)     // Model 13 position
};

let cubeMixers = [];   // { cube, mixer, action, wasPlaying }
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
    const goalPos = new CANNON.Vec3(-51.39, 6, 0.6997);
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

            cube.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

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

            // ── ANIMATION SETUP (unchanged) ───────────────────────────
            const mixer = new THREE.AnimationMixer(cube);
            const anim = gltf.animations[0];
            if (anim) {
                const action = mixer.clipAction(anim);
                action.setLoop(THREE.LoopOnce);
                action.clampWhenFinished = true;

                cubeMixers.push({
                    cube,
                    mixer,
                    action,
                    wasPlaying: false
                });
                console.log('Sci-fi cube animation loaded');
            } else {
                console.warn('No animation found in sci-fi_cube.glb');
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
}

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

    // ADD THIS LINE - Set up contact materials
    setupContactMaterials();

    // Initialize floor bodies array
    floorBodies = [];
    // Create platform mesh
    const floor1Geo = new THREE.PlaneGeometry(12.5, 100); // Width=12.5, Depth=100
    const floor1Mat = new THREE.MeshBasicMaterial({
        color: 0x00ff00, // Green to distinguish from blue ground
        side: THREE.DoubleSide
    });
    const floor1Mesh = new THREE.Mesh(floor1Geo, floor1Mat);
    floor1Mesh.position.set(43.75, 0.05, 0); // Center at (43.75, 0.05, 0)
    floor1Mesh.receiveShadow = true; // Match ground settings
    scene.add(floor1Mesh);

    // Create physics platform body
    const floor1Body = new CANNON.Body({
        shape: new CANNON.Box(new CANNON.Vec3(12.5 / 2, 100 / 2, 0.1)), // Half-extents: width/2, height/2, depth/2
        mass: 0 // Static body
    });
    floor1Body.position.set(43.75, 0.05, 0); // Center matches mesh
    floor1Body.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Rotate to be horizontal
    world.addBody(floor1Body);
    floorBodies.push(floor1Body); // Add to floor bodies array

    // Store reference for synchronization
    floor1Mesh.userData.physicsBody = floor1Body;

// Create new platform mesh
const floor2Geo = new THREE.PlaneGeometry(12.5, 50.7); // Width=12.5, Depth=50.7
const floor2Mat = new THREE.MeshBasicMaterial({
    color: 0xffff00, // Yellow to distinguish from green platform and blue ground
    side: THREE.DoubleSide
});
const floor2Mesh = new THREE.Mesh(floor2Geo, floor2Mat);
floor2Mesh.rotation.x = -Math.PI / 2; // Rotate to lie flat (like ground)
floor2Mesh.position.set(31.25, 0.05, -24.65); // Center at (31.25, 0.05, -24.65)
floor2Mesh.receiveShadow = true; // Match ground and platform settings
scene.add(floor2Mesh);

// Create new physics platform body
const floor2Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(12.5 / 2, 50.7 / 2, 0.1)), // Half-extents: width/2, height/2, depth/2
    mass: 0 // Static body
});
floor2Body.position.set(31.25, 0.05, -24.65); // Center matches mesh
floor2Body.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Rotate to be horizontal
world.addBody(floor2Body);
floorBodies.push(floor2Body); // Add to floor bodies array

// Store reference for synchronization
floor2Mesh.userData.physicsBody = floor2Body;

// Inside setupScene(), after the yellow platform creation
// Create third platform mesh (cyan)
const floor3Geo = new THREE.PlaneGeometry(12.5, 20); // Width=12.5, Depth=20
const floor3Mat = new THREE.MeshBasicMaterial({
    color: 0x00ffff, // Cyan to distinguish from green platform, yellow platform, and blue ground
    side: THREE.DoubleSide
});
const floor3Mesh = new THREE.Mesh(floor3Geo, floor3Mat);
floor3Mesh.rotation.x = -Math.PI / 2; // Rotate to lie flat (like ground)
floor3Mesh.position.set(31.25, 0.05, 40); // Center at (31.25, 0.05, 40)
floor3Mesh.receiveShadow = true; // Match ground and platform settings
scene.add(floor3Mesh);

// Create third physics platform body
const floor3Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(12.5 / 2, 20 / 2, 0.1)), // Half-extents: width/2, height/2, depth/2
    mass: 0 // Static body
});
floor3Body.position.set(31.25, 0.05, 40); // Center matches mesh
floor3Body.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Rotate to be horizontal
world.addBody(floor3Body);
floorBodies.push(floor3Body); // Add to floor bodies array

// Store reference for synchronization
floor3Mesh.userData.physicsBody = floor3Body;

// Inside setupScene(), after the cyan platform creation
// Create fourth platform mesh (magenta)
const floor4Geo = new THREE.PlaneGeometry(12.5, 29.3); // Width=12.5, Depth=29.3
const floor4Mat = new THREE.MeshBasicMaterial({
    color: 0xff00ff, // Magenta gonna die if touched
    side: THREE.DoubleSide
});
const floor4Mesh = new THREE.Mesh(floor4Geo, floor4Mat);
floor4Mesh.rotation.x = -Math.PI / 2; // Rotate to lie flat (like ground)
floor4Mesh.position.set(31.25, -2, 15.35); // Center at (31.25, -2, 15.35)
floor4Mesh.receiveShadow = true; // Match ground and platform settings
scene.add(floor4Mesh);

// Create fourth physics platform body
const floor4Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(12.5 / 2, 29.3 / 2, 0.1)), // Half-extents: width/2, height/2, depth/2
    mass: 0 // Static body
});
floor4Body.position.set(31.25, -1.95, 15.35); // Center matches mesh, y=-1.95 for top surface at y=-2
floor4Body.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Rotate to be horizontal
world.addBody(floor4Body);
floorBodies.push(floor4Body); // Add to floor bodies array

// Store reference for synchronization
floor4Mesh.userData.physicsBody = floor4Body;

// Inside setupScene(), after the magenta platform creation
// Create fifth platform mesh (orange)
const floor5Geo = new THREE.PlaneGeometry(12.5, 100); // Width=12.5, Depth=100
const floor5Mat = new THREE.MeshBasicMaterial({
    color: 0xffa500, // Orange to distinguish from green, yellow, cyan, magenta platforms, and blue ground
    side: THREE.DoubleSide
});
const floor5Mesh = new THREE.Mesh(floor5Geo, floor5Mat);
floor5Mesh.rotation.x = -Math.PI / 2; // Rotate to lie flat (like ground)
floor5Mesh.position.set(18.75, 0.05, 0); // Center at (18.75, 0.05, 0)
floor5Mesh.receiveShadow = true; // Match ground and platform settings
scene.add(floor5Mesh);

// Create fifth physics platform body
const floor5Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(12.5 / 2, 100 / 2, 0.1)), // Half-extents: width/2, height/2, depth/2
    mass: 0 // Static body
});
floor5Body.position.set(18.75, 0.05, 0); // Center matches mesh
floor5Body.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Rotate to be horizontal
world.addBody(floor5Body);
floorBodies.push(floor5Body); // Add to floor bodies array

// Store reference for synchronization
floor5Mesh.userData.physicsBody = floor5Body;


// Inside setupScene(), after the orange platform creation
// Create sixth platform mesh (purple)
const floor6Geo = new THREE.PlaneGeometry(12.5, 12.7); // Width=12.5, Depth=12.7
const floor6Mat = new THREE.MeshBasicMaterial({
    color: 0x800080, // Purple to distinguish from other platforms and ground
    side: THREE.DoubleSide
});
const floor6Mesh = new THREE.Mesh(floor6Geo, floor6Mat);
floor6Mesh.rotation.x = -Math.PI / 2; // Rotate to lie flat (like ground)
floor6Mesh.position.set(6.25, 0.05, -43.65); // Center at (6.25, 0.05, -43.65)
floor6Mesh.receiveShadow = true; // Match ground and platform settings
scene.add(floor6Mesh);

// Create sixth physics platform body
const floor6Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(12.5 / 2, 12.7 / 2, 0.1)), // Half-extents: width/2, height/2, depth/2
    mass: 0 // Static body
});
floor6Body.position.set(6.25, 0.05, -43.65); // Center matches mesh
floor6Body.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Rotate to be horizontal
world.addBody(floor6Body);
floorBodies.push(floor6Body); // Add to floor bodies array

// Store reference for synchronization
floor6Mesh.userData.physicsBody = floor6Body;

// Create seventh platform mesh (white)
const floor7Geo = new THREE.PlaneGeometry(12.5, 12.3); // Width=12.5, Depth=12.3
const floor7Mat = new THREE.MeshBasicMaterial({
    color: 0xffffff, // White to distinguish from other platforms and ground
    side: THREE.DoubleSide
});
const floor7Mesh = new THREE.Mesh(floor7Geo, floor7Mat);
floor7Mesh.rotation.x = -Math.PI / 2; // Rotate to lie flat (like ground)
floor7Mesh.position.set(6.25, 0.05, 43.85); // Center at (6.25, 0.05, 43.85)
floor7Mesh.receiveShadow = true; // Match ground and platform settings
scene.add(floor7Mesh);

// Create seventh physics platform body
const floor7Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(12.5 / 2, 12.3 / 2, 0.1)), // Half-extents: width/2, height/2, depth/2
    mass: 0 // Static body
});
floor7Body.position.set(6.25, 0.05, 43.85); // Center matches mesh
floor7Body.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Rotate to be horizontal
world.addBody(floor7Body);
floorBodies.push(floor7Body); // Add to floor bodies array

// Store reference for synchronization
floor7Mesh.userData.physicsBody = floor7Body;

// Create eighth platform mesh (red)
const floor8Geo = new THREE.PlaneGeometry(12.5, 75); // Width=12.5, Depth=75
const floor8Mat = new THREE.MeshBasicMaterial({
    color: 0xff0000, // Red gonna die if touch
    side: THREE.DoubleSide
});
const floor8Mesh = new THREE.Mesh(floor8Geo, floor8Mat);
floor8Mesh.rotation.x = -Math.PI / 2; // Rotate to lie flat (like ground)
floor8Mesh.position.set(6.25, -2, 0.2); // Center at (6.25, -2, 0.2)
floor8Mesh.receiveShadow = true; // Match ground and platform settings
scene.add(floor8Mesh);

// Create eighth physics platform body
const floor8Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(12.5 / 2, 75 / 2, 0.1)), // Half-extents: width/2, height/2, depth/2
    mass: 0 // Static body
});
floor8Body.position.set(6.25, -1.95, 0.2); // Center matches mesh, y=-1.95 for top surface at y=-2
floor8Body.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Rotate to be horizontal
world.addBody(floor8Body);
floorBodies.push(floor8Body); // Add to floor bodies array

// Store reference for synchronization
floor8Mesh.userData.physicsBody = floor8Body;

// Inside setupScene(), after the red platform creation
// Create ninth platform mesh (lime)
const floor9Geo = new THREE.PlaneGeometry(12.5, 93.865); // Width=12.5, Depth=93.865
const floor9Mat = new THREE.MeshBasicMaterial({
    color: 0x00ff00, // Lime gonna die
    side: THREE.DoubleSide
});
const floor9Mesh = new THREE.Mesh(floor9Geo, floor9Mat);
floor9Mesh.rotation.x = -Math.PI / 2; // Rotate to lie flat (like ground)
floor9Mesh.position.set(-6.25, -2, -3.0675); // Center at (-6.25, -2, -3.0675)
floor9Mesh.receiveShadow = true; // Match ground and platform settings
scene.add(floor9Mesh);

// Create ninth physics platform body
const floor9Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(12.5 / 2, 93.865 / 2, 0.1)), // Half-extents: width/2, height/2, depth/2
    mass: 0 // Static body
});
floor9Body.position.set(-6.25, -1.95, -3.0675); // Center matches mesh, y=-1.95 for top surface at y=-2
floor9Body.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Rotate to be horizontal
world.addBody(floor9Body);
floorBodies.push(floor9Body); // Add to floor bodies array

// Store reference for synchronization
floor9Mesh.userData.physicsBody = floor9Body;

// Create tenth platform mesh (teal)
const floor10Geo = new THREE.PlaneGeometry(12.5, 6.135); // Width=12.5, Depth=6.135
const floor10Mat = new THREE.MeshBasicMaterial({
    color: 0x008080, // Teal to distinguish from other platforms and ground
    side: THREE.DoubleSide
});
const floor10Mesh = new THREE.Mesh(floor10Geo, floor10Mat);
floor10Mesh.rotation.x = -Math.PI / 2; // Rotate to lie flat (like ground)
floor10Mesh.position.set(-6.25, 0.05, 46.9325); // Center at (-6.25, 0.05, 46.9325)
floor10Mesh.receiveShadow = true; // Match ground and platform settings
scene.add(floor10Mesh);

// Create tenth physics platform body
const floor10Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(12.5 / 2, 6.135 / 2, 0.1)),
    mass: 0 // Static body
});
floor10Body.position.set(-6.25, 0.05, 46.9325); // Center matches mesh
floor10Body.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Rotate to be horizontal
world.addBody(floor10Body);
floorBodies.push(floor10Body); // Add to floor bodies array

// Store reference for synchronization
floor10Mesh.userData.physicsBody = floor10Body;

// Inside setupScene(), after the teal platform creation
// Create eleventh platform mesh (pink)
const floor11Geo = new THREE.PlaneGeometry(37.5, 100); // Width=37.5, Depth=100
const floor11Mat = new THREE.MeshBasicMaterial({
    color: 0xff69b4, // Pink to distinguish from other platforms and ground
    side: THREE.DoubleSide
});
const floor11Mesh = new THREE.Mesh(floor11Geo, floor11Mat);
floor11Mesh.rotation.x = -Math.PI / 2; // Rotate to lie flat (like ground)
floor11Mesh.position.set(-31.25, 0.05, 0); // Center at (-31.25, 0.05, 0)
floor11Mesh.receiveShadow = true; // Match ground and platform settings
scene.add(floor11Mesh);

// Create eleventh physics platform body
const floor11Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(37.5 / 2, 100 / 2, 0.1)), // Half-extents: width/2, height/2, depth/2
    mass: 0 // Static body
});
floor11Body.position.set(-31.25, 0.05, 0); // Center matches mesh
floor11Body.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Rotate to be horizontal
world.addBody(floor11Body);
floorBodies.push(floor11Body); // Add to floor bodies array

// Store reference for synchronization
floor11Mesh.userData.physicsBody = floor11Body;

// Inside setupScene(), after the pink platform creation
// Create twelfth wall mesh (blue, at x=50, YZ plane)
const twelfthWallGeo = new THREE.PlaneGeometry(100, 10); // Width=Z=100, Height=Y=10
const twelfthWallMat = new THREE.MeshBasicMaterial({
    color: 0x0000ff, // Blue (distinct in context, as ground is at y=0)
    side: THREE.DoubleSide,
    wireframe: true
});
const twelfthWallMesh = new THREE.Mesh(twelfthWallGeo, twelfthWallMat);
twelfthWallMesh.position.set(50, 5, 0); // Center at (50, 5, 0)
twelfthWallMesh.receiveShadow = true; // Match platform settings
scene.add(twelfthWallMesh);

// Create twelfth physics wall body
const twelfthWallBody = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(100 / 2, 10 / 2, 0.1)), // Half-extents: thickness/2, height/2, depth/2
    mass: 0 // Static body
});
twelfthWallBody.position.set(50, 5, 0); // Center matches mesh
twelfthWallBody.quaternion.setFromEuler(0, -Math.PI / 2, 0);
world.addBody(twelfthWallBody);

// Store reference for synchronization
twelfthWallMesh.userData.physicsBody = twelfthWallBody;

// Create thirteenth wall mesh (silver, at z=50, XY plane)
const thirteenthWallGeo = new THREE.PlaneGeometry(100, 12); // Width=X=100, Height=Y=10
const thirteenthWallMat = new THREE.MeshBasicMaterial({
    color: 0xc0c0c0, // Silver to distinguish from other platforms and walls
    side: THREE.DoubleSide,
    wireframe: true
});
const thirteenthWallMesh = new THREE.Mesh(thirteenthWallGeo, thirteenthWallMat);
thirteenthWallMesh.rotation.x = Math.PI / 2; // Rotate to align with XY plane (vertical at z=50)
thirteenthWallMesh.position.set(0, 4, 50); // Center at (0, 5, 50)
thirteenthWallMesh.receiveShadow = true; // Match platform settings
scene.add(thirteenthWallMesh);

// Create thirteenth physics wall body
const thirteenthWallBody = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(100 / 2, 12 / 2, 0.1 )), // Half-extents: width/2, height/2, thickness/2
    mass: 0 // Static body
});
thirteenthWallBody.position.set(0, 4, 50); // Center matches mesh
world.addBody(thirteenthWallBody);

// Store reference for synchronization
thirteenthWallMesh.userData.physicsBody = thirteenthWallBody;

// Create fifteenth wall mesh (brown, at z=-50, XY plane)
const fifteenthWallGeo = new THREE.PlaneGeometry(100, 12); // Width=X=100, Height=Y=10
const fifteenthWallMat = new THREE.MeshBasicMaterial({
    color: 0x8b4513, // Brown to distinguish from other platforms and walls
    side: THREE.DoubleSide,
    wireframe: true
});
const fifteenthWallMesh = new THREE.Mesh(fifteenthWallGeo, fifteenthWallMat);
fifteenthWallMesh.rotation.x = Math.PI / 2; // Rotate to align with XY plane (vertical at z=-50)
fifteenthWallMesh.position.set(0, 4, -50); // Center at (0, 5, -50)
fifteenthWallMesh.receiveShadow = true; // Match platform settings
scene.add(fifteenthWallMesh);

// Create fifteenth physics wall body
const fifteenthWallBody = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(100 / 2, 12 / 2, 0.1)), // Half-extents: width/2, height/2, thickness/2
    mass: 0 // Static body
});
fifteenthWallBody.position.set(0, 4, -50); // Center matches mesh
world.addBody(fifteenthWallBody);

// Store reference for synchronization
fifteenthWallMesh.userData.physicsBody = fifteenthWallBody;

// Inside setupScene(), after the fifteenth wall creation
// Create sixteenth wall mesh (coral, at z=-1.5, XY plane)
const sixteenthWallGeo = new THREE.PlaneGeometry(5, 5); // Width=X=5, Height=Y=5
const sixteenthWallMat = new THREE.MeshBasicMaterial({
    color: 0xff7f50, // Coral to distinguish from other platforms and walls
    side: THREE.DoubleSide,
    wireframe: true
});
const sixteenthWallMesh = new THREE.Mesh(sixteenthWallGeo, sixteenthWallMat);
sixteenthWallMesh.position.set(47.5, 2.5, -1.5); // Center at (47.5, 2.5, -1.5)
sixteenthWallMesh.receiveShadow = true; // Match platform settings
scene.add(sixteenthWallMesh);

// Create sixteenth physics wall body
const sixteenthWallBody = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(5 / 2, 5 / 2, 0.1)), // Half-extents: width/2, height/2, thickness/2
    mass: 0 // Static body
});
sixteenthWallBody.position.set(47.5, 2.5, -1.5); // Center matches mesh
world.addBody(sixteenthWallBody);

// Store reference for synchronization
sixteenthWallMesh.userData.physicsBody = sixteenthWallBody;

// Create seventeenth wall mesh (violet, at x=45, YZ plane)
const seventeenthWallGeo = new THREE.PlaneGeometry(30, 5); // Width=Z=30, Height=Y=5
const seventeenthWallMat = new THREE.MeshBasicMaterial({
    color: 0xee82ee, // Violet to distinguish from other platforms and walls
    side: THREE.DoubleSide,
    wireframe: true
});
const seventeenthWallMesh = new THREE.Mesh(seventeenthWallGeo, seventeenthWallMat);
seventeenthWallMesh.position.set(45, 2.5, 13.5); // Center at (45, 2.5, 13.5)
seventeenthWallMesh.receiveShadow = true; // Match platform settings
scene.add(seventeenthWallMesh);

// Create seventeenth physics wall body
const seventeenthWallBody = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(30/2, 5 / 2, 0.1)), // Half-extents: thickness/2, height/2, depth/2
    mass: 0 // Static body
});
seventeenthWallBody.position.set(45, 2.5, 13.5); // Center matches mesh
seventeenthWallBody.quaternion.setFromEuler(0, -Math.PI / 2, 0);
world.addBody(seventeenthWallBody);

// Store reference for synchronization
seventeenthWallMesh.userData.physicsBody = seventeenthWallBody;

// Create eighteenth wall mesh (olive, at y=5, XZ plane)
const eighteenthWallGeo = new THREE.PlaneGeometry(30, 5); // Width=X=5, Depth=Z=30
const eighteenthWallMat = new THREE.MeshBasicMaterial({
    color: 0x808000, // Olive to distinguish from other platforms and walls
    side: THREE.DoubleSide,
    wireframe: true
});
const eighteenthWallMesh = new THREE.Mesh(eighteenthWallGeo, eighteenthWallMat);
eighteenthWallMesh.position.set(47.5, 5, 13.5); // Center at (47.5, 5, 13.5)
eighteenthWallMesh.receiveShadow = true; // Match platform settings
scene.add(eighteenthWallMesh);

// Create eighteenth physics wall body
const eighteenthWallBody = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(30 / 2, 5 / 2, 0.1)), // Half-extents: width/2, thickness/2, depth/2
    mass: 0 // Static body
});
eighteenthWallBody.position.set(47.5, 5, 13.5); // Center matches mesh
eighteenthWallBody.quaternion.setFromEuler(-Math.PI / 2, 0, -Math.PI / 2); // Rotate to align with XZ plane
world.addBody(eighteenthWallBody);

// Store reference for synchronization
eighteenthWallMesh.userData.physicsBody = eighteenthWallBody;

// Inside setupScene(), after the eighteenth wall creation
// Create nineteenth wall mesh (maroon, at z=28.5, XY plane)
const nineteenthWallGeo = new THREE.PlaneGeometry(5, 2.5); // Width=X=5, Height=Y=2.5
const nineteenthWallMat = new THREE.MeshBasicMaterial({
    color: 0x800000, // Maroon to distinguish from other platforms and walls
    side: THREE.DoubleSide,
    wireframe: true
});
const nineteenthWallMesh = new THREE.Mesh(nineteenthWallGeo, nineteenthWallMat);
nineteenthWallMesh.position.set(47.5, 3.75, 28.5); // Center at (47.5, 3.75, 28.5)
nineteenthWallMesh.receiveShadow = true; // Match platform settings
scene.add(nineteenthWallMesh);

// Create nineteenth physics wall body
const nineteenthWallBody = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(5 / 2, 2.5 / 2, 0.1)), // Half-extents: width/2, height/2, thickness/2
    mass: 0 // Static body
});
nineteenthWallBody.position.set(47.5, 3.75, 28.5); // Center matches mesh
world.addBody(nineteenthWallBody);

// Store reference for synchronization
nineteenthWallMesh.userData.physicsBody = nineteenthWallBody;

// Create twentieth wall mesh (turquoise, at z=28.5, XY plane)
const twentiethWallGeo = new THREE.PlaneGeometry(1.875, 2.5); // Width=X=1.875, Height=Y=2.5
const twentiethWallMat = new THREE.MeshBasicMaterial({
    color: 0x40e0d0, // Turquoise to distinguish from other platforms and walls
    side: THREE.DoubleSide,
    wireframe: true
});
const twentiethWallMesh = new THREE.Mesh(twentiethWallGeo, twentiethWallMat);
twentiethWallMesh.position.set(45.9375, 1.25, 28.5); // Center at (45.9375, 1.25, 28.5)
twentiethWallMesh.receiveShadow = true; // Match platform settings
scene.add(twentiethWallMesh);

// Create twentieth physics wall body
const twentiethWallBody = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(1.875 / 2, 2.5 / 2, 0.1 / 2)), // Half-extents: width/2, height/2, thickness/2
    mass: 0 // Static body
});
twentiethWallBody.position.set(45.9375, 1.25, 28.5); // Center matches mesh
world.addBody(twentiethWallBody);

// Store reference for synchronization
twentiethWallMesh.userData.physicsBody = twentiethWallBody;

// Create twenty-first wall mesh (indigo, at z=28.5, XY plane)
const twentyFirstWallGeo = new THREE.PlaneGeometry(1.875, 2.5); // Width=X=1.875, Height=Y=2.5
const twentyFirstWallMat = new THREE.MeshBasicMaterial({
    color: 0x4b0082, // Indigo to distinguish from other platforms and walls
    side: THREE.DoubleSide,
    wireframe: true
});
const twentyFirstWallMesh = new THREE.Mesh(twentyFirstWallGeo, twentyFirstWallMat);
twentyFirstWallMesh.position.set(49.0625, 1.25, 28.5); // Center at (49.0625, 1.25, 28.5)
twentyFirstWallMesh.receiveShadow = true; // Match platform settings
scene.add(twentyFirstWallMesh);

// Create twenty-first physics wall body
const twentyFirstWallBody = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(1.875 / 2, 2.5 / 2, 0.1 / 2)), // Half-extents: width/2, height/2, thickness/2
    mass: 0 // Static body
});
twentyFirstWallBody.position.set(49.0625, 1.25, 28.5); // Center matches mesh
world.addBody(twentyFirstWallBody);

// Store reference for synchronization
twentyFirstWallMesh.userData.physicsBody = twentyFirstWallBody;

// Inside setupScene(), after the twenty-first wall creation
// Create twenty-second wall mesh (navy, at x=37.475, YZ plane)
const twentySecondWallGeo = new THREE.PlaneGeometry(14.159, 12); // Width=Z=14.159, Height=Y=12
const twentySecondWallMat = new THREE.MeshBasicMaterial({
    color: 0x000080, // Navy to distinguish from other platforms and walls
    side: THREE.DoubleSide,
    wireframe: true
});
const twentySecondWallMesh = new THREE.Mesh(twentySecondWallGeo, twentySecondWallMat);
twentySecondWallMesh.position.set(37.475, 4, -42.9205); // Center at (37.475, 4, -42.9205)
twentySecondWallMesh.receiveShadow = true; // Match platform settings
scene.add(twentySecondWallMesh);

// Create twenty-second physics wall body
const twentySecondWallBody = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(14.159/2,12/2,0.1)), // Half-extents: thickness/2, height/2, depth/2
    mass: 0 // Static body
});
twentySecondWallBody.position.set(37.475, 4, -42.9205); // Center matches mesh
twentySecondWallBody.quaternion.setFromEuler(0, -Math.PI / 2, 0);
world.addBody(twentySecondWallBody);

// Store reference for synchronization
twentySecondWallMesh.userData.physicsBody = twentySecondWallBody;

// Create twenty-third wall mesh (aqua, at x=37.475, YZ plane)
const twentyThirdWallGeo = new THREE.PlaneGeometry(82.642, 12); // Width=Z=82.642, Height=Y=12
const twentyThirdWallMat = new THREE.MeshBasicMaterial({
    color: 0x00ffcc, // Aqua (adjusted for distinction from cyan) to distinguish from other platforms and walls
    side: THREE.DoubleSide,
    wireframe: true
});
const twentyThirdWallMesh = new THREE.Mesh(twentyThirdWallGeo, twentyThirdWallMat);
twentyThirdWallMesh.position.set(37.475, 4, 8.679); // Center at (37.475, 4, 8.679)
twentyThirdWallMesh.receiveShadow = true; // Match platform settings
scene.add(twentyThirdWallMesh);

// Create twenty-third physics wall body
const twentyThirdWallBody = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3( 82.642 / 2, 12 / 2, 0.1)), // Half-extents: thickness/2, height/2, depth/2
    mass: 0 // Static body
});
twentyThirdWallBody.position.set(37.475, 4, 8.679); // Center matches mesh
twentyThirdWallBody.quaternion.setFromEuler(0, -Math.PI / 2, 0);
world.addBody(twentyThirdWallBody);

// Store reference for synchronization
twentyThirdWallMesh.userData.physicsBody = twentyThirdWallBody;

// Create twenty-fourth wall mesh (chartreuse, at x=37.475, YZ plane)
const twentyFourthWallGeo = new THREE.PlaneGeometry(3.199, 5); // Width=Z=3.199, Height=Y=5
const twentyFourthWallMat = new THREE.MeshBasicMaterial({
    color: 0x7fff00, // Chartreuse to distinguish from other platforms and walls
    side: THREE.DoubleSide,
    wireframe: true
});
const twentyFourthWallMesh = new THREE.Mesh(twentyFourthWallGeo, twentyFourthWallMat);
twentyFourthWallMesh.position.set(37.475, 7.5, -34.2415); // Center at (37.475, 7.5, -34.2415)
twentyFourthWallMesh.receiveShadow = true; // Match platform settings
scene.add(twentyFourthWallMesh);

// Create twenty-fourth physics wall body
const twentyFourthWallBody = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3( 3.199 / 2, 5/2,0.1)), // Half-extents: thickness/2, height/2, depth/2
    mass: 0 // Static body
});
twentyFourthWallBody.position.set(37.475, 7.5, -34.2415); // Center matches mesh
twentyFourthWallBody.quaternion.setFromEuler(0, -Math.PI / 2, 0);
world.addBody(twentyFourthWallBody);

// Store reference for synchronization
twentyFourthWallMesh.userData.physicsBody = twentyFourthWallBody;

// Inside setupScene(), after the twenty-fourth wall creation
// Create twenty-fifth wall mesh (sienna, at x=24.95, YZ plane)
const twentyFifthWallGeo = new THREE.PlaneGeometry(89.218, 12); // Width=Z=89.218, Height=Y=12
const twentyFifthWallMat = new THREE.MeshBasicMaterial({
    color: 0xa0522d, // Sienna to distinguish from other platforms and walls
    side: THREE.DoubleSide,
    wireframe: true
});
const twentyFifthWallMesh = new THREE.Mesh(twentyFifthWallGeo, twentyFifthWallMat);
twentyFifthWallMesh.position.set(24.95, 4, -5.391); // Center at (24.95, 4, -5.391)
twentyFifthWallMesh.receiveShadow = true; // Match platform settings
scene.add(twentyFifthWallMesh);

// Create twenty-fifth physics wall body
const twentyFifthWallBody = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3( 89.218 / 2, 12/2, 0.1)), // Half-extents: thickness/2, height/2, depth/2
    mass: 0 // Static body
});
twentyFifthWallBody.position.set(24.95, 4, -5.391); // Center matches mesh
twentyFifthWallBody.quaternion.setFromEuler(0, -Math.PI / 2, 0);
world.addBody(twentyFifthWallBody);

// Store reference for synchronization
twentyFifthWallMesh.userData.physicsBody = twentyFifthWallBody;

// Create twenty-sixth wall mesh (teal, at x=24.95, YZ plane)
const twentySixthWallGeo = new THREE.PlaneGeometry(3.081, 5); // Width=Z=3.081, Height=Y=5
const twentySixthWallMat = new THREE.MeshBasicMaterial({
    color: 0x008b8b, // Teal (adjusted for distinction from platform teal) to distinguish from other platforms and walls
    side: THREE.DoubleSide,
    wireframe: true
});
const twentySixthWallMesh = new THREE.Mesh(twentySixthWallGeo, twentySixthWallMat);
twentySixthWallMesh.position.set(24.95, 7.5, 40.7585); // Center at (24.95, 7.5, 40.7585)
twentySixthWallMesh.receiveShadow = true; // Match platform settings
scene.add(twentySixthWallMesh);

// Create twenty-sixth physics wall body
const twentySixthWallBody = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3( 3.081 / 2, 5/2, 0.1)), // Half-extents: thickness/2, height/2, depth/2
    mass: 0 // Static body
});
twentySixthWallBody.position.set(24.95, 7.5, 40.7585); // Center matches mesh
twentySixthWallBody.quaternion.setFromEuler(0, -Math.PI / 2, 0);
world.addBody(twentySixthWallBody);

// Store reference for synchronization
twentySixthWallMesh.userData.physicsBody = twentySixthWallBody;

// Create twenty-seventh wall mesh (orchid, at x=24.95, YZ plane)
const twentySeventhWallGeo = new THREE.PlaneGeometry(7.701, 12); // Width=Z=7.701, Height=Y=12
const twentySeventhWallMat = new THREE.MeshBasicMaterial({
    color: 0xda70d6, // Orchid to distinguish from other platforms and walls
    side: THREE.DoubleSide,
    wireframe: true
});
const twentySeventhWallMesh = new THREE.Mesh(twentySeventhWallGeo, twentySeventhWallMat);
twentySeventhWallMesh.position.set(24.95, 4, 46.1495); // Center at (24.95, 4, 46.1495)
twentySeventhWallMesh.receiveShadow = true; // Match platform settings
scene.add(twentySeventhWallMesh);

// Create twenty-seventh physics wall body
const twentySeventhWallBody = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3( 7.701 / 2, 12/2, 0.1)), // Half-extents: thickness/2, height/2, depth/2
    mass: 0 // Static body
});
twentySeventhWallBody.position.set(24.95, 4, 46.1495); // Center matches mesh
twentySeventhWallBody.quaternion.setFromEuler(0, -Math.PI / 2, 0);
world.addBody(twentySeventhWallBody);

// Store reference for synchronization
twentySeventhWallMesh.userData.physicsBody = twentySeventhWallBody;

// ---------------------------------------------------------------
//  28th wall – Wall 1 (deepskyblue)
//  Corners: (12.425,10,-45.218), (12.425,-2,-45.218),
//           (12.425,-2,50),      (12.425,10,50)
// ---------------------------------------------------------------
const wall28Geo = new THREE.PlaneGeometry(95.218, 12); // Z = 95.218, Y = 12
const wall28Mat = new THREE.MeshBasicMaterial({
    color: 0x00bfff,          // deepskyblue – distinct from every other colour
    side: THREE.DoubleSide,
    wireframe: true
});
const wall28Mesh = new THREE.Mesh(wall28Geo, wall28Mat);
wall28Mesh.position.set(12.425, 4, 2.391);   // centre: y = (10-2)/2 = 4, z = (-45.218+50)/2 = 2.391
wall28Mesh.receiveShadow = true;
scene.add(wall28Mesh);

const wall28Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(95.218/2, 12/2,0.1)), // half-extents
    mass: 0
});
wall28Body.position.set(12.425, 4, 2.391);
wall28Body.quaternion.setFromEuler(0, -Math.PI / 2, 0);
world.addBody(wall28Body);
wall28Mesh.userData.physicsBody = wall28Body;

// ---------------------------------------------------------------
//  29th wall – Wall 2 (firebrick)
//  Corners: (12.425,10,-50), (12.425,-2,-50),
//           (12.425,-2,-48.406), (12.425,10,-48.406)
// ---------------------------------------------------------------
const wall29Geo = new THREE.PlaneGeometry(1.594, 12); // Z = 1.594, Y = 12
const wall29Mat = new THREE.MeshBasicMaterial({
    color: 0xb22222,          // firebrick – distinct
    side: THREE.DoubleSide,
    wireframe: true
});
const wall29Mesh = new THREE.Mesh(wall29Geo, wall29Mat);
wall29Mesh.position.set(12.425, 4, -49.203); // centre: z = (-50 + -48.406)/2 = -49.203
wall29Mesh.receiveShadow = true;
scene.add(wall29Mesh);

const wall29Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3( 1.594/2, 12/2, 0.1)), // half-extents
    mass: 0
});
wall29Body.position.set(12.425, 4, -49.203);
wall29Body.quaternion.setFromEuler(0, -Math.PI / 2, 0);
world.addBody(wall29Body);
wall29Mesh.userData.physicsBody = wall29Body;

// ---------------------------------------------------------------
//  30th wall – Wall 1 (crimson)
//  Corners: (0,10,-50), (0,-2,-50), (0,-2,45.379), (0,10,45.379)
// ---------------------------------------------------------------
const wall30Geo = new THREE.PlaneGeometry(95.379, 12); // Z = 95.379, Y = 12
const wall30Mat = new THREE.MeshBasicMaterial({
    color: 0xdc143c,          // crimson – distinct from every previous colour
    side: THREE.DoubleSide,
    wireframe: true
});
const wall30Mesh = new THREE.Mesh(wall30Geo, wall30Mat);
wall30Mesh.position.set(0, 4, -2.3105);   // y = (10-2)/2 = 4
                                         // z = (-50 + 45.379)/2 = -2.3105
wall30Mesh.receiveShadow = true;
scene.add(wall30Mesh);

const wall30Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3( 95.379/2, 12/2, 0.1)), // half-extents
    mass: 0
});
wall30Body.position.set(0, 4, -2.3105);
wall30Body.quaternion.setFromEuler(0, -Math.PI / 2, 0);
world.addBody(wall30Body);
wall30Mesh.userData.physicsBody = wall30Body;

// ---------------------------------------------------------------
//  31st wall – Wall 2 (darkorange)
//  Corners: (0,10,45.379), (0,5,45.379), (0,5,48.46), (0,10,48.46)
// ---------------------------------------------------------------
const wall31Geo = new THREE.PlaneGeometry(3.081, 5); // Z = 3.081, Y = 5
const wall31Mat = new THREE.MeshBasicMaterial({
    color: 0xff8c00,          // darkorange – distinct
    side: THREE.DoubleSide,
    wireframe: true
});
const wall31Mesh = new THREE.Mesh(wall31Geo, wall31Mat);
wall31Mesh.position.set(0, 7.5, 46.9195); // y = (10+5)/2 = 7.5
                                          // z = (45.379+48.46)/2 = 46.9195
wall31Mesh.receiveShadow = true;
scene.add(wall31Mesh);

const wall31Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3( 3.081/2, 5/2, 0.1)), // half-extents
    mass: 0
});
wall31Body.position.set(0, 7.5, 46.9195);
wall31Body.quaternion.setFromEuler(0, -Math.PI / 2, 0);
world.addBody(wall31Body);
wall31Mesh.userData.physicsBody = wall31Body;

// ---------------------------------------------------------------
//  32nd wall – Wall 3 (mediumseagreen)
//  Corners: (0,10,50), (0,10,48.46), (0,-2,48.46), (0,-2,50)
// ---------------------------------------------------------------
const wall32Geo = new THREE.PlaneGeometry(1.54, 12); // Z = 1.54, Y = 12
const wall32Mat = new THREE.MeshBasicMaterial({
    color: 0x3cb371,          // mediumseagreen – distinct
    side: THREE.DoubleSide,
    wireframe: true
});
const wall32Mesh = new THREE.Mesh(wall32Geo, wall32Mat);
wall32Mesh.position.set(0, 4, 49.23);    // y = (10-2)/2 = 4
                                         // z = (50+48.46)/2 = 49.23
wall32Mesh.receiveShadow = true;
scene.add(wall32Mesh);

const wall32Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(1.54/2, 12/2, 0.1)), // half-extents
    mass: 0
});
wall32Body.position.set(0, 4, 49.23);
wall32Body.quaternion.setFromEuler(0, -Math.PI / 2, 0);
world.addBody(wall32Body);
wall32Mesh.userData.physicsBody = wall32Body;

// ---------------------------------------------------------------
//  33rd wall – Wall 1 (slateblue)
//  Corners: (-12.5,10,-50), (-12.5,10,-48.415),
//           (-12.5,-2,-48.415), (-12.5,-2,-50)
// ---------------------------------------------------------------
const wall33Geo = new THREE.PlaneGeometry(1.585, 12); // Z = 1.585, Y = 12
const wall33Mat = new THREE.MeshBasicMaterial({
    color: 0x6a5acd,          // slateblue – distinct from every previous colour
    side: THREE.DoubleSide,
    wireframe: true
});
const wall33Mesh = new THREE.Mesh(wall33Geo, wall33Mat);
wall33Mesh.position.set(-12.5, 4, -49.2075);   // y = (10-2)/2 = 4
                                              // z = (-50 + -48.415)/2 = -49.2075
wall33Mesh.receiveShadow = true;
scene.add(wall33Mesh);

const wall33Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(1.585/2, 12/2, 0.1)), // half-extents
    mass: 0
});
wall33Body.position.set(-12.5, 4, -49.2075);
wall33Body.quaternion.setFromEuler(0, -Math.PI / 2, 0);
world.addBody(wall33Body);
wall33Mesh.userData.physicsBody = wall33Body;

// ---------------------------------------------------------------
//  34th wall – Wall 2 (goldenrod)
//  Corners: (-12.5,10,-45.246), (-12.5,-2,-45.246),
//           (-12.5,-2,50), (-12.5,10,50)
// ---------------------------------------------------------------
const wall34Geo = new THREE.PlaneGeometry(95.246, 12); // Z = 95.246, Y = 12
const wall34Mat = new THREE.MeshBasicMaterial({
    color: 0xdaa520,          // goldenrod – distinct
    side: THREE.DoubleSide,
    wireframe: true
});
const wall34Mesh = new THREE.Mesh(wall34Geo, wall34Mat);
wall34Mesh.position.set(-12.5, 4, 2.377);     // y = (10-2)/2 = 4
                                             // z = (-45.246 + 50)/2 = 2.377
wall34Mesh.receiveShadow = true;
scene.add(wall34Mesh);

const wall34Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3( 95.246/2, 12/2, 0.1)), // half-extents
    mass: 0
});
wall34Body.position.set(-12.5, 4, 2.377);
wall34Body.quaternion.setFromEuler(0, -Math.PI / 2, 0);
world.addBody(wall34Body);
wall34Mesh.userData.physicsBody = wall34Body;

const wall35Geo = new THREE.PlaneGeometry(95.379, 12); // Z = 95.379, Y = 12
const wall35Mat = new THREE.MeshBasicMaterial({
    color: 0xdc143c,          // crimson – distinct from every previous colour
    side: THREE.DoubleSide,
    wireframe: true
});
const wall35Mesh = new THREE.Mesh(wall35Geo, wall35Mat);
wall35Mesh.position.set(-25, 4, -2.3105);   // y = (10-2)/2 = 4
                                         // z = (-50 + 45.379)/2 = -2.3105
wall35Mesh.receiveShadow = true;
scene.add(wall35Mesh);

const wall35Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3( 95.379/2, 12/2, 0.1)), // half-extents
    mass: 0
});
wall35Body.position.set(-25, 4, -2.3105);
wall35Body.quaternion.setFromEuler(0, -Math.PI / 2, 0);
world.addBody(wall35Body);
wall35Mesh.userData.physicsBody = wall35Body;

// ---------------------------------------------------------------
//  31st wall – Wall 2 (darkorange)
//  Corners: (0,10,45.379), (0,5,45.379), (0,5,48.46), (0,10,48.46)
// ---------------------------------------------------------------
const wall36Geo = new THREE.PlaneGeometry(3.081, 5); // Z = 3.081, Y = 5
const wall36Mat = new THREE.MeshBasicMaterial({
    color: 0xff8c00,          // darkorange – distinct
    side: THREE.DoubleSide,
    wireframe: true
});
const wall36Mesh = new THREE.Mesh(wall36Geo, wall36Mat);
wall36Mesh.position.set(-25, 7.5, 46.9195); // y = (10+5)/2 = 7.5
                                          // z = (45.379+48.46)/2 = 46.9195
wall36Mesh.receiveShadow = true;
scene.add(wall36Mesh);

const wall36Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3( 3.081/2, 5/2, 0.1)), // half-extents
    mass: 0
});
wall36Body.position.set(-25, 7.5, 46.9195);
wall36Body.quaternion.setFromEuler(0, -Math.PI / 2, 0);
world.addBody(wall36Body);
wall36Mesh.userData.physicsBody = wall36Body;

// ---------------------------------------------------------------
//  32nd wall – Wall 3 (mediumseagreen)
//  Corners: (0,10,50), (0,10,48.46), (0,-2,48.46), (0,-2,50)
// ---------------------------------------------------------------
const wall37Geo = new THREE.PlaneGeometry(1.54, 12); // Z = 1.54, Y = 12
const wall37Mat = new THREE.MeshBasicMaterial({
    color: 0x3cb371,          // mediumseagreen – distinct
    side: THREE.DoubleSide,
    wireframe: true
});
const wall37Mesh = new THREE.Mesh(wall37Geo, wall37Mat);
wall37Mesh.position.set(-25, 4, 49.23);    // y = (10-2)/2 = 4
                                         // z = (50+48.46)/2 = 49.23
wall37Mesh.receiveShadow = true;
scene.add(wall37Mesh);

const wall37Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(1.54/2, 12/2, 0.1)), // half-extents
    mass: 0
});
wall37Body.position.set(-25, 4, 49.23);
wall37Body.quaternion.setFromEuler(0, -Math.PI / 2, 0);
world.addBody(wall37Body);
wall37Mesh.userData.physicsBody = wall37Body;

// ---------------------------------------------------------------
//  35th wall – Wall 1 (darkviolet)
//  Corners: (-37.5,10,-50), (-37.5,-2,-50),
//           (-37.5,-2,-46.83), (-37.5,10,-46.83)
// ---------------------------------------------------------------
const wall38Geo = new THREE.PlaneGeometry(3.17, 12); // Z = 3.17, Y = 12
const wall38Mat = new THREE.MeshBasicMaterial({
    color: 0x9400d3,          // darkviolet – distinct from all previous
    side: THREE.DoubleSide,
    wireframe: true
});
const wall38Mesh = new THREE.Mesh(wall38Geo, wall38Mat);
wall38Mesh.position.set(-37.5, 4, -48.415);   // y = (10-2)/2 = 4
                                             // z = (-50 + -46.83)/2 = -48.415
wall38Mesh.receiveShadow = true;
scene.add(wall38Mesh);

const wall38Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3( 3.17/2, 12/2, 0.1)), // half-extents
    mass: 0
});
wall38Body.position.set(-37.5, 4, -48.415);
wall38Body.quaternion.setFromEuler(0, -Math.PI / 2, 0);
world.addBody(wall38Body);
wall38Mesh.userData.physicsBody = wall38Body;

// ---------------------------------------------------------------
//  36th wall – Wall 2 (tomato)
//  Corners: (-37.5,10,-46.83), (-37.5,5,-46.83),
//           (-37.5,5,-43.661), (-37.5,10,-43.661)
// ---------------------------------------------------------------
const wall39Geo = new THREE.PlaneGeometry(3.169, 5); // Z = 3.169, Y = 5
const wall39Mat = new THREE.MeshBasicMaterial({
    color: 0xff6347,          // tomato – distinct
    side: THREE.DoubleSide,
    wireframe: true
});
const wall39Mesh = new THREE.Mesh(wall39Geo, wall39Mat);
wall39Mesh.position.set(-37.5, 7.5, -45.2455); // y = (10+5)/2 = 7.5
                                               // z = (-46.83 + -43.661)/2 = -45.2455
wall39Mesh.receiveShadow = true;
scene.add(wall39Mesh);

const wall39Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(3.169/2, 5/2, 0.1)), // half-extents
    mass: 0
});
wall39Body.position.set(-37.5, 7.5, -45.2455);
wall39Body.quaternion.setFromEuler(0, -Math.PI / 2, 0);
world.addBody(wall39Body);
wall39Mesh.userData.physicsBody = wall39Body;

// ---------------------------------------------------------------
//  37th wall – Wall 3 (steelblue)
//  Corners: (-37.5,10,-43.661), (-37.5,-2,-43.661),
//           (-37.5,-2,50), (-37.5,10,50)
// ---------------------------------------------------------------
const wall40Geo = new THREE.PlaneGeometry(93.661, 12); // Z = 93.661, Y = 12
const wall40Mat = new THREE.MeshBasicMaterial({
    color: 0x4682b4,          // steelblue – distinct
    side: THREE.DoubleSide,
    wireframe: true
});
const wall40Mesh = new THREE.Mesh(wall40Geo, wall40Mat);
wall40Mesh.position.set(-37.5, 4, 3.1695);     // y = (10-2)/2 = 4
                                              // z = (-43.661 + 50)/2 = 3.1695
wall40Mesh.receiveShadow = true;
scene.add(wall40Mesh);

const wall40Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(93.661/2, 12/2, 0.1)), // half-extents
    mass: 0
});
wall40Body.position.set(-37.5, 4, 3.1695);
wall40Body.quaternion.setFromEuler(0, -Math.PI / 2, 0);
world.addBody(wall40Body);
wall40Mesh.userData.physicsBody = wall40Body;

// ---------------------------------------------------------------
//  41st wall – Wall 1 (peru)
//  Corners: (37.5,0,0.71252), (37.5,-2,0.71252),
//           (25,-2,0.71252), (25,0,0.71252)
// ---------------------------------------------------------------
const wall41Geo = new THREE.PlaneGeometry(12.5, 2); // X = 12.5, Z = 0.71252
const wall41Mat = new THREE.MeshBasicMaterial({
    color: 0xcd853f,          // peru – distinct from all previous
    side: THREE.DoubleSide,
    wireframe: true
});
const wall41Mesh = new THREE.Mesh(wall41Geo, wall41Mat);                // horizontal XZ plane
wall41Mesh.position.set(31.25, -1, 0.71252);         // x = (37.5+25)/2 = 31.25
                                                     // y = (0 + -2)/2 = -1
                                                     // z = 0.71252 / 2 = 0.35626
wall41Mesh.receiveShadow = true;
scene.add(wall41Mesh);

const wall41Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(12.5/2, 1, 0.1)), // half-extents
    mass: 0
});
wall41Body.position.set(31.25, -1, 0.71252);
world.addBody(wall41Body);
wall41Mesh.userData.physicsBody = wall41Body;

// ---------------------------------------------------------------
//  42nd wall – Wall 2 (saddlebrown)
//  Corners: (37.5,0,29.977), (37.5,-2,29.977),
//           (25,-2,29.977), (25,0,29.977)
// ---------------------------------------------------------------
const wall42Geo = new THREE.PlaneGeometry(12.5, 2); // X = 12.5, Z = 0.71252
const wall42Mat = new THREE.MeshBasicMaterial({
    color: 0x8b4513,          // saddlebrown – distinct
    side: THREE.DoubleSide,
    wireframe: true
});
const wall42Mesh = new THREE.Mesh(wall42Geo, wall42Mat);                // horizontal XZ plane
wall42Mesh.position.set(31.25, -1, 29.977 + 0.35626); // x = 31.25
                                                     // y = -1
                                                     // z = 29.977 + 0.35626
wall42Mesh.receiveShadow = true;
scene.add(wall42Mesh);

const wall42Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(12.5/2, 1, 0.1)), // half-extents
    mass: 0
});
wall42Body.position.set(31.25, -1, 29.977 + 0.35626);
world.addBody(wall42Body);
wall42Mesh.userData.physicsBody = wall42Body;

// ---------------------------------------------------------------
//  43rd wall – Wall 1 (dodgerblue) – top face
//  Corners: (10.425,5,-43.718), (14.425,5,-43.718),
//           (14.425,5,-50), (10.425,5,-50)
// ---------------------------------------------------------------
const floor12Geo = new THREE.PlaneGeometry(4, 6.282); // X = 4, Z = 6.282
const floor12Mat = new THREE.MeshBasicMaterial({
    color: 0x1e90ff,          // dodgerblue – distinct
    side: THREE.DoubleSide
});
const floor12Mesh = new THREE.Mesh(floor12Geo, floor12Mat);               // horizontal XZ plane
floor12Mesh.position.set(12.425, 5, -46.859);         // x = (10.425+14.425)/2
                                                     // y = 5
                                                     // z = (-43.718 + -50)/2
floor12Mesh.receiveShadow = true;
scene.add(floor12Mesh);

// Create physics platform body
const floor12Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(4/2, 6.282/2, 0.1)), // half-extents
    mass: 0 // Static body
});
floor12Body.position.set(12.425, 5, -46.859); // Center matches mesh
floor12Body.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Rotate to be horizontal
world.addBody(floor12Body);
floorBodies.push(floor12Body); // Add to floor bodies array

// Store reference for synchronization
floor12Mesh.userData.physicsBody = floor12Body;

// ---------------------------------------------------------------
//  44th wall – Wall 2 (royalblue) – front face
//  Corners: (10.425,5,-43.718), (14.425,5,-43.718),
//           (14.425,0,-43.718), (10.425,0,-43.718)
// ---------------------------------------------------------------
const wall44Geo = new THREE.PlaneGeometry(4, 5); // X = 4, Y = 5
const wall44Mat = new THREE.MeshBasicMaterial({
    color: 0x4169e1,          // royalblue – distinct
    side: THREE.DoubleSide,
    wireframe: true
});
const wall44Mesh = new THREE.Mesh(wall44Geo, wall44Mat);
wall44Mesh.position.set(12.425, 2.5, -43.718);       // x = 12.425, y = (5+0)/2 = 2.5, z = -43.718
wall44Mesh.receiveShadow = true;
scene.add(wall44Mesh);

const wall44Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(4/2, 5/2, 0.1)), // half-extents
    mass: 0
});
wall44Body.position.set(12.425, 2.5, -43.718);
world.addBody(wall44Body);
wall44Mesh.userData.physicsBody = wall44Body;

// ---------------------------------------------------------------
//  45th wall – Wall 3 (cornflowerblue) – left face
//  Corners: (10.425,5,-43.718), (10.425,5,-50),
//           (10.425,0,-50), (10.425,0,-43.718)
// ---------------------------------------------------------------
const wall45Geo = new THREE.PlaneGeometry(6.282, 5); // Z = 6.282, Y = 5
const wall45Mat = new THREE.MeshBasicMaterial({
    color: 0x6495ed,          // cornflowerblue – distinct
    side: THREE.DoubleSide,
    wireframe: true
});
const wall45Mesh = new THREE.Mesh(wall45Geo, wall45Mat);
wall45Mesh.position.set(10.425, 2.5, -46.859);  
wall45Mesh.receiveShadow = true;
scene.add(wall45Mesh);

const wall45Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(6.282/2, 5/2, 0.1)), // half-extents
    mass: 0
});
wall45Body.position.set(10.425, 2.5, -46.859);
wall45Body.quaternion.setFromEuler(0, -Math.PI / 2, 0);
world.addBody(wall45Body);
wall45Mesh.userData.physicsBody = wall45Body;

// ---------------------------------------------------------------
//  46th wall – Wall 4 (lightskyblue) – right face
//  Corners: (14.425,5,-43.718), (14.425,0,-43.718),
//           (14.425,0,-50), (14.425,5,-50)
// ---------------------------------------------------------------
const wall46Geo = new THREE.PlaneGeometry(6.282, 5); // Z = 6.282, Y = 5
const wall46Mat = new THREE.MeshBasicMaterial({
    color: 0x87cefa,          // lightskyblue – distinct
    side: THREE.DoubleSide,
    wireframe: true
});
const wall46Mesh = new THREE.Mesh(wall46Geo, wall46Mat);
wall46Mesh.position.set(14.425, 2.5, -46.859);    
wall46Mesh.receiveShadow = true;
scene.add(wall46Mesh);

const wall46Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3( 6.282/2, 5/2, 0.1)), // half-extents
    mass: 0
});
wall46Body.position.set(14.425, 2.5, -46.859);
wall46Body.quaternion.setFromEuler(0, -Math.PI / 2, 0);
world.addBody(wall46Body);
wall46Mesh.userData.physicsBody = wall46Body;

// ---------------------------------------------------------------
//  47th wall – Wall 1 (darkslategray)
//  Corners: (0,0,-37.322), (0,-2,-37.322),
//           (12.5,-2,-37.322), (12.5,0,-37.322)
// ---------------------------------------------------------------
const floor13Geo = new THREE.PlaneGeometry(12.5, 2); // X = 12.5, Z = 0.71252 (same thickness as walls 41/42)
const floor13Mat = new THREE.MeshBasicMaterial({
    color: 0x2f4f4f,          // darkslategray – distinct
    side: THREE.DoubleSide
});
const floor13Mesh = new THREE.Mesh(floor13Geo, floor13Mat);                // horizontal XZ plane
floor13Mesh.position.set(6.25, -1, -37.322);           // x = (0+12.5)/2 = 6.25
                                                      // y = (0 + -2)/2 = -1
                                                      // z = -37.322 (center in Z)
floor13Mesh.receiveShadow = true;
scene.add(floor13Mesh);

// Create physics platform body
const floor13Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(12.5/2, 1, 0.1)), // half-extents: X/2, thickness/2, Z/2
    mass: 0 // Static body
});
floor13Body.position.set(6.25, -1, -37.322); // Center matches mesh
floor13Body.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Rotate to be horizontal
world.addBody(floor13Body);
floorBodies.push(floor13Body); // Add to floor bodies array

// Store reference for synchronization
floor13Mesh.userData.physicsBody = floor13Body;

// ---------------------------------------------------------------
//  48th wall – Wall 2 (dimgray)
//  Corners: (0,0,37.678), (0,-2,37.678),
//           (12.5,-2,37.678), (12.5,0,37.678)
// ---------------------------------------------------------------
const floor14Geo = new THREE.PlaneGeometry(12.5, 2); // X = 12.5, Z = 0.71252
const floor14Mat = new THREE.MeshBasicMaterial({
    color: 0x696969,          // dimgray – distinct
    side: THREE.DoubleSide
});
const floor14Mesh = new THREE.Mesh(floor14Geo, floor14Mat);               // horizontal XZ plane
floor14Mesh.position.set(6.25, -1, 37.678);            // x = 6.25, y = -1, z = 37.678
floor14Mesh.receiveShadow = true;
scene.add(floor14Mesh);

// Create physics platform body
const floor14Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(12.5/2, 1, 0.1)), // half-extents
    mass: 0 // Static body
});
floor14Body.position.set(6.25, -1, 37.678); // Center matches mesh
floor14Body.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Rotate to be horizontal
world.addBody(floor14Body);
floorBodies.push(floor14Body); // Add to floor bodies array

// Store reference for synchronization
floor14Mesh.userData.physicsBody = floor14Body;

// ---------------------------------------------------------------
//  49th wall – Wall 1 (slategray)
//  Corners: (0,0,43.839), (0,-2,43.839),
//           (-12.5,-2,43.839), (-12.5,0,43.839)
// ---------------------------------------------------------------
const floor15Geo = new THREE.PlaneGeometry(12.5, 2); // X = 12.5, Z = 0.71252 (consistent thickness)
const floor15Mat = new THREE.MeshBasicMaterial({
    color: 0x708090,          // slategray – distinct from all previous
    side: THREE.DoubleSide
});
const floor15Mesh = new THREE.Mesh(floor15Geo, floor15Mat);                // horizontal XZ plane
floor15Mesh.position.set(-6.25, -1, 43.839);           // x = (0 + -12.5)/2 = -6.25
                                                      // y = (0 + -2)/2 = -1
                                                      // z = 43.839 (center in Z)
floor15Mesh.receiveShadow = true;
scene.add(floor15Mesh);

// Create physics platform body
const floor15Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(12.5/2, 1, 0.1)), // half-extents: X/2, thickness/2, Z/2
    mass: 0 // Static body
});
floor15Body.position.set(-6.25, -1, 43.839); // Center matches mesh
floor15Body.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Rotate to be horizontal
world.addBody(floor15Body);
floorBodies.push(floor15Body); // Add to floor bodies array

// Store reference for synchronization
floor15Mesh.userData.physicsBody = floor15Body;

// ---------------------------------------------------------------
//  50th wall – Wall 1 (mediumblue)
//  Corners: (-12.5,-2,-45.246), (-12.5,-2,-48.415),
//           (-12.5,5,-48.415), (-12.5,5,-45.246)
// ---------------------------------------------------------------
const wall50Geo = new THREE.PlaneGeometry(3.169, 7); // Z = 3.169, Y = 7
const wall50Mat = new THREE.MeshBasicMaterial({
    color: 0x0000cd,          // mediumblue – distinct from all previous
    side: THREE.DoubleSide,
    wireframe: true
});
const wall50Mesh = new THREE.Mesh(wall50Geo, wall50Mat);
wall50Mesh.position.set(-12.5, 1.5, -46.8305);     // y = (-2 + 5)/2 = 1.5
                                                    // z = (-45.246 + -48.415)/2 = -46.8305
wall50Mesh.receiveShadow = true;
scene.add(wall50Mesh);

const wall50Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(3.169/2, 7/2, 0.1)), // half-extents: thickness/2, height/2, depth/2
    mass: 0
});
wall50Body.position.set(-12.5, 1.5, -46.8305);
wall50Body.quaternion.setFromEuler(0, -Math.PI / 2, 0);
world.addBody(wall50Body);
wall50Mesh.userData.physicsBody = wall50Body;

// ---------------------------------------------------------------
//  51st wall – Wall 1 (midnightblue) – top face
//  Corners: (-14.5,5,-43.746), (-14.5,4,-43.746),
//           (-10.5,4,-43.746), (-10.5,5,-43.746)
// ---------------------------------------------------------------
const floor16Geo = new THREE.PlaneGeometry(4, 1); // X = 4, Y = 1 (height)
const floor16Mat = new THREE.MeshBasicMaterial({
    color: 0x191970,          // midnightblue – distinct
    side: THREE.DoubleSide
});
const floor16Mesh = new THREE.Mesh(floor16Geo, floor16Mat);                // horizontal XZ plane
floor16Mesh.position.set(-12.5, 4.5, -43.746);         // x = (-14.5 + -10.5)/2 = -12.5
                                                      // y = (5 + 4)/2 = 4.5
                                                      // z = -43.746
floor16Mesh.receiveShadow = true;
scene.add(floor16Mesh);

// Create physics platform body
const floor16Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(4/2, 1/2, 0.1)), // half-extents: X/2, Y/2, thickness/2
    mass: 0 // Static body
});
floor16Body.position.set(-12.5, 4.5, -43.746); // Center matches mesh
floor16Body.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Rotate to be horizontal
world.addBody(floor16Body);
floorBodies.push(floor16Body); // Add to floor bodies array

// Store reference for synchronization
floor16Mesh.userData.physicsBody = floor16Body;

// ---------------------------------------------------------------
//  52nd wall – Wall 2 (navy) – left face
//  Corners: (-14.5,5,-43.746), (-14.5,4,-43.746),
//           (-14.5,4,-50), (-14.5,5,-50)
// ---------------------------------------------------------------
const wall52Geo = new THREE.PlaneGeometry(6.254, 1); // Z = 6.254, Y = 1
const wall52Mat = new THREE.MeshBasicMaterial({
    color: 0x000080,          // navy – distinct
    side: THREE.DoubleSide,
    wireframe: true
});
const wall52Mesh = new THREE.Mesh(wall52Geo, wall52Mat);
wall52Mesh.position.set(-14.5, 4.5, -46.873); // YZ plane
wall52Mesh.receiveShadow = true;
scene.add(wall52Mesh);

const wall52Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(6.254/2, 1/2, 0.1)), // half-extents
    mass: 0
});
wall52Body.position.set(-14.5, 4.5, -46.873);
wall52Body.quaternion.setFromEuler(0, -Math.PI / 2, 0);
world.addBody(wall52Body);
wall52Mesh.userData.physicsBody = wall52Body;

// ---------------------------------------------------------------
//  53rd wall – Wall 3 (darkblue) – right face
//  Corners: (-10.5,5,-43.746), (-10.5,4,-43.746),
//           (-10.5,4,-50), (-10.5,5,-50)
// ---------------------------------------------------------------
const wall53Geo = new THREE.PlaneGeometry(6.254, 1); // Z = 6.254, Y = 1
const wall53Mat = new THREE.MeshBasicMaterial({
    color: 0x00008b,          // darkblue – distinct
    side: THREE.DoubleSide,
    wireframe: true
});
const wall53Mesh = new THREE.Mesh(wall53Geo, wall53Mat);
wall53Mesh.position.set(-10.5, 4.5, -46.873);
wall53Mesh.receiveShadow = true;
scene.add(wall53Mesh);

const wall53Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(6.254/2, 1/2, 0.1)),
    mass: 0
});
wall53Body.position.set(-10.5, 4.5, -46.873);
wall53Body.quaternion.setFromEuler(0, -Math.PI / 2, 0);
world.addBody(wall53Body);
wall53Mesh.userData.physicsBody = wall53Body;

// ---------------------------------------------------------------
//  54th wall – Wall 4 (indigo) – top face (higher)
//  Corners: (-14.5,5,-43.746), (-10.5,5,-43.746),
//           (-10.5,5,-50), (-14.5,5,-50)
// ---------------------------------------------------------------
const floor17Geo = new THREE.PlaneGeometry(4, 6.254); // X = 4, Z = 6.254
const floor17Mat = new THREE.MeshBasicMaterial({
    color: 0x4b0082,          // indigo – distinct
    side: THREE.DoubleSide
});
const floor17Mesh = new THREE.Mesh(floor17Geo, floor17Mat);
floor17Mesh.position.set(-12.5, 5, -46.873);
floor17Mesh.receiveShadow = true;
scene.add(floor17Mesh);

// Create physics platform body
const floor17Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(4/2, 6.254/2, 0.1)),
    mass: 0 // Static body
});
floor17Body.position.set(-12.5, 5, -46.873); // Center matches mesh
floor17Body.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Rotate to be horizontal
world.addBody(floor17Body);
floorBodies.push(floor17Body); // Add to floor bodies array

// Store reference for synchronization
floor17Mesh.userData.physicsBody = floor17Body;

// ---------------------------------------------------------------
//  55th wall – Wall 5 (darkslateblue) – bottom face
//  Corners: (-14.5,4,-43.746), (-10.5,4,-43.746),
//           (-10.5,4,-50), (-14.5,4,-50)
// ---------------------------------------------------------------
const floor18Geo = new THREE.PlaneGeometry(4, 6.254); // X = 4, Z = 6.254
const floor18Mat = new THREE.MeshBasicMaterial({
    color: 0x483d8b,          // darkslateblue – distinct
    side: THREE.DoubleSide
});
const floor18Mesh = new THREE.Mesh(floor18Geo, floor18Mat);
floor18Mesh.position.set(-12.5, 4, -46.873);
floor18Mesh.receiveShadow = true;
scene.add(floor18Mesh);

// Create physics platform body
const floor18Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(4/2, 6.254/2, 0.1)),
    mass: 0 // Static body
});
floor18Body.position.set(-12.5, 4, -46.873); // Center matches mesh
floor18Body.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Rotate to be horizontal
world.addBody(floor18Body);
floorBodies.push(floor18Body); // Add to floor bodies array

// Store reference for synchronization
floor18Mesh.userData.physicsBody = floor18Body;

// ---------------------------------------------------------------
//  56th wall – Wall 1 (darkred)
//  Corners: (-50,5,50), (-50,5,-50), (-50,0,-50), (-50,0,50)
// ---------------------------------------------------------------
const wall56Geo = new THREE.PlaneGeometry(100, 5); // Z = 100, Y = 5
const wall56Mat = new THREE.MeshBasicMaterial({
    color: 0x8b0000,          // darkred – distinct from all previous
    side: THREE.DoubleSide,
    wireframe: true
});
const wall56Mesh = new THREE.Mesh(wall56Geo, wall56Mat);
wall56Mesh.position.set(-50, 2.5, 0);         // y = (5 + 0)/2 = 2.5, z = (50 + -50)/2 = 0
wall56Mesh.receiveShadow = true;
scene.add(wall56Mesh);

const wall56Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(100/2, 5/2, 0.1)), // half-extents: thickness/2, height/2, depth/2
    mass: 0
});
wall56Body.position.set(-50, 2.5, 0);
wall56Body.quaternion.setFromEuler(0, -Math.PI / 2, 0);
world.addBody(wall56Body);
wall56Mesh.userData.physicsBody = wall56Body;

// ---------------------------------------------------------------
//  57th wall – Wall 2 (maroon)
//  Corners: (-50,10,50), (-50,10,-50), (-50,8.75,-50), (-50,8.75,50)
// ---------------------------------------------------------------
const wall57Geo = new THREE.PlaneGeometry(100, 1.25); // Z = 100, Y = 1.25
const wall57Mat = new THREE.MeshBasicMaterial({
    color: 0x800000,          // maroon – distinct
    side: THREE.DoubleSide,
    wireframe: true
});
const wall57Mesh = new THREE.Mesh(wall57Geo, wall57Mat);
wall57Mesh.position.set(-50, 9.375, 0);       // y = (10 + 8.75)/2 = 9.375, z = 0
wall57Mesh.receiveShadow = true;
scene.add(wall57Mesh);

const wall57Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(100/2, 1.25/2, 0.1)), // half-extents
    mass: 0
});
wall57Body.position.set(-50, 9.375, 0);
wall57Body.quaternion.setFromEuler(0, -Math.PI / 2, 0);
world.addBody(wall57Body);
wall57Mesh.userData.physicsBody = wall57Body;

// ---------------------------------------------------------------
//  58th wall – Wall 1 (crimson)
//  Corners: (-50,8.75,-0.87225), (-50,8.75,-50),
//           (-50,5,-50), (-50,5,-0.87225)
// ---------------------------------------------------------------
const wall58Geo = new THREE.PlaneGeometry(49.12775, 3.75); // Z = 49.12775, Y = 3.75
const wall58Mat = new THREE.MeshBasicMaterial({
    color: 0xdc143c,          // crimson – distinct
    side: THREE.DoubleSide,
    wireframe: true
});
const wall58Mesh = new THREE.Mesh(wall58Geo, wall58Mat);
wall58Mesh.position.set(-50, 6.875, -25.436125);   // y = (8.75 + 5)/2 = 6.875
                                                   // z = (-0.87225 + -50)/2 = -25.436125
wall58Mesh.receiveShadow = true;
scene.add(wall58Mesh);

const wall58Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(49.12775/2, 3.75/2, 0.1)), // half-extents
    mass: 0
});
wall58Body.position.set(-50, 6.875, -25.436125);
wall58Body.quaternion.setFromEuler(0, -Math.PI / 2, 0);
world.addBody(wall58Body);
wall58Mesh.userData.physicsBody = wall58Body;

// ---------------------------------------------------------------
//  59th wall – Wall 2 (firebrick)
//  Corners: (-50,8.75,50), (-50,8.75,2.2527),
//           (-50,5,2.2527), (-50,5,50)
// ---------------------------------------------------------------
const wall59Geo = new THREE.PlaneGeometry(47.7473, 3.75); // Z = 47.7473, Y = 3.75
const wall59Mat = new THREE.MeshBasicMaterial({
    color: 0xb22222,          // firebrick – distinct
    side: THREE.DoubleSide,
    wireframe: true
});
const wall59Mesh = new THREE.Mesh(wall59Geo, wall59Mat);
wall59Mesh.position.set(-50, 6.875, 26.12635);     // y = 6.875
                                                   // z = (50 + 2.2527)/2 = 26.12635
wall59Mesh.receiveShadow = true;
scene.add(wall59Mesh);

const wall59Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(47.7473/2, 3.75/2, 0.1)), // half-extents
    mass: 0
});
wall59Body.position.set(-50, 6.875, 26.12635);
wall59Body.quaternion.setFromEuler(0, -Math.PI / 2, 0);
world.addBody(wall59Body);
wall59Mesh.userData.physicsBody = wall59Body;

// ---------------------------------------------------------------
//  60th wall – Wall 1 (darkmagenta)
//  Corners: (-53,5,2.2527), (-50,5,2.2527),
//           (-50,8.75,2.2527), (-53,8.75,2.2527)
// ---------------------------------------------------------------
const wall60Geo = new THREE.PlaneGeometry(3.25, 3.75); // X = 3, Z = 3.75 (but rotated)
const wall60Mat = new THREE.MeshBasicMaterial({
    color: 0x8b008b,          // darkmagenta – distinct
    side: THREE.DoubleSide,
    wireframe: true
});
const wall60Mesh = new THREE.Mesh(wall60Geo, wall60Mat);                  // rotate to XZ plane (vertical)
wall60Mesh.position.set(-51.5, 6.875, 2.2527);         // x = (-53 + -50)/2 = -51.5
                                                       // y = (5 + 8.75)/2 = 6.875
                                                       // z = 2.2527
wall60Mesh.receiveShadow = true;
scene.add(wall60Mesh);

const wall60Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(3.25/2, 3.75/2, 0.1)), // half-extents: depth/2, height/2, thickness/2
    mass: 0
});
wall60Body.position.set(-51.5, 6.875, 2.2527);
world.addBody(wall60Body);
wall60Mesh.userData.physicsBody = wall60Body;

// ---------------------------------------------------------------
//  61st wall – Wall 2 (purple)
//  Corners: (-53,5,-0.87225), (-50,5,-0.87225),
//           (-50,8.75,-0.87225), (-53,8.75,-0.87225)
// ---------------------------------------------------------------
const wall61Geo = new THREE.PlaneGeometry(3.25, 3.75);
const wall61Mat = new THREE.MeshBasicMaterial({
    color: 0x800080,          // purple – distinct
    side: THREE.DoubleSide,
    wireframe: true
});
const wall61Mesh = new THREE.Mesh(wall61Geo, wall61Mat);
wall61Mesh.position.set(-51.5, 6.875, -0.87225);
wall61Mesh.receiveShadow = true;
scene.add(wall61Mesh);

const wall61Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(3.25/2, 3.75/2, 0.1)),
    mass: 0
});
wall61Body.position.set(-51.5, 6.875, -0.87225);
world.addBody(wall61Body);
wall61Mesh.userData.physicsBody = wall61Body;

// ---------------------------------------------------------------
//  62nd wall – Wall 3 (mediumvioletred)
//  Corners: (-53,5,2.2527), (-50,5,2.2527),
//           (-50,5,-0.87225), (-53,5,-0.87225)
// ---------------------------------------------------------------
const floor19Geo = new THREE.PlaneGeometry(3.25, 3.125); // X = 3, Z = 3.125
const floor19Mat = new THREE.MeshBasicMaterial({
    color: 0xc71585,          // mediumvioletred – distinct
    side: THREE.DoubleSide
});
const floor19Mesh = new THREE.Mesh(floor19Geo, floor19Mat);                 // horizontal XZ plane
floor19Mesh.position.set(-51.5, 5, 0.690225);           // z = (2.2527 + -0.87225)/2 = 0.690225
floor19Mesh.receiveShadow = true;
scene.add(floor19Mesh);

// Create physics platform body
const floor19Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(3.25/2, 3.125/2, 0.1)),
    mass: 0 // Static body
});
floor19Body.position.set(-51.5, 5, 0.690225); // Center matches mesh
floor19Body.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Rotate to be horizontal
world.addBody(floor19Body);
floorBodies.push(floor19Body); // Add to floor bodies array

// Store reference for synchronization
floor19Mesh.userData.physicsBody = floor19Body;

// ---------------------------------------------------------------
//  63rd wall – Wall 4 (deeppink)
//  Corners: (-53,8.75,2.2527), (-50,8.75,2.2527),
//           (-50,8.75,-0.87225), (-53,8.75,-0.87225)
// ---------------------------------------------------------------
const floor20Geo = new THREE.PlaneGeometry(3.25, 3.125);
const floor20Mat = new THREE.MeshBasicMaterial({
    color: 0xff1493,          // deeppink – distinct
    side: THREE.DoubleSide
});
const floor20Mesh = new THREE.Mesh(floor20Geo, floor20Mat);
floor20Mesh.position.set(-51.5, 8.75, 0.690225);
floor20Mesh.receiveShadow = true;
scene.add(floor20Mesh);

// Create physics platform body
const floor20Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(3.25/2, 3.125/2, 0.1)),
    mass: 0 // Static body
});
floor20Body.position.set(-51.5, 8.75, 0.690225); // Center matches mesh
floor20Body.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Rotate to be horizontal
world.addBody(floor20Body);
floorBodies.push(floor20Body); // Add to floor bodies array

// Store reference for synchronization
floor20Mesh.userData.physicsBody = floor20Body;

    // Define positions for the 13 models (you can tweak these coordinates)
    const modelPositions = [
        new THREE.Vector3(38.5, 5, 45),   // Model 1
        new THREE.Vector3(43.9, 3, 0),   // Model 2
        new THREE.Vector3(39.5, 3.5, -48.9),   // Model 3
        new THREE.Vector3(38.5, 1, 0),   // Model 4
        new THREE.Vector3(38.5, 2, 38),     // Model 5
        new THREE.Vector3(39.5, 4, 48.9),    // Model 6
        new THREE.Vector3(48, 4, -48.9),    // Model 7
        new THREE.Vector3(38.5, 1.5, 20),    // Model 8
        new THREE.Vector3(43.5, 3, -48.9),    // Model 9
        new THREE.Vector3(48.9, 5, -4.2),   // Model 10
        new THREE.Vector3(43.9, 3, 10),    // Model 11
        new THREE.Vector3(44, 3.5, 48.9),   // Model 12
        new THREE.Vector3(43.9, 3, 15)     // Model 13
    ];

    // Array of model names
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
                // Double the scale of the model
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
                
                // Enable shadows
                model.traverse(child => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                
                scene.add(model);

                // Create physics body for ALL models
                let plate;
                if(modelName === 'six' || modelName === 'twelve'){
                    plate = new CANNON.Body({
                        shape: new CANNON.Box(new CANNON.Vec3(1, 1, 0.1)),
                        mass: 0
                    });
                    plate.position.copy(modelPositions[i]);
                    plate.quaternion.setFromEuler(-Math.PI/2, 0, 0);
                }
                if(modelName === 'one' || modelName === 'four' || modelName === 'five' || modelName === 'eight'){
                    // plate.position.copy(model.position);
                    // plate.quaternion.setFromEuler(0,Math.PI / 2, 0);
                    plate = new CANNON.Body({
                        shape: new CANNON.Box(new CANNON.Vec3(1, 1, 0.1)),
                        mass: 0
                    });
                    plate.position.copy(modelPositions[i]);
                    plate.quaternion.setFromEuler(-Math.PI/2, 0, 0);
                }
                if(modelName === 'ten' || modelName === 'two' || modelName === 'eleven' || modelName === 'thirteen'){
                    // plate.position.copy(model.position);
                    // plate.quaternion.setFromEuler(0,-Math.PI / 2, 0);
                    plate = new CANNON.Body({
                        shape: new CANNON.Box(new CANNON.Vec3(1, 1, 0.1)),
                        mass: 0
                    });
                    plate.position.copy(modelPositions[i]);
                    plate.quaternion.setFromEuler(-Math.PI/2, 0, 0);
                }
                if(modelName === 'three' || modelName === 'seven' || modelName === 'nine'){
                    // plate.position.copy(model.position);
                    // plate.quaternion.setFromEuler(0,-Math.PI / 2, 0);
                    plate = new CANNON.Body({
                        shape: new CANNON.Box(new CANNON.Vec3(1, 1, 0.1)),
                        mass: 0
                    });
                    plate.position.copy(modelPositions[i]);
                    plate.quaternion.setFromEuler(-Math.PI/2, 0, 0);
                }
                world.addBody(plate);
                // Store reference for synchronization
                // if (model && plate) {
                //     model.userData.physicsBody = plate;  // Link model to physics body
                //     plate.userData = plate.userData || {};
                //     plate.userData.mesh = model;         // Link physics body to model
                // }
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
    directionalLight.position.set(10, 20, 10);
    directionalLight.target.position.set(0, 0, 0);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    
    scene.add(directionalLight);
    scene.add(directionalLight.target);
    console.log('Directional light added at position (10, 20, 10)');

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.7); // Soft gray light with low intensity
    scene.add(ambientLight);
    console.log('Ambient light added with color 0x404040 and intensity 0.3');

    // Enable shadow receiving on the scene
    scene.traverse((child) => {
        if (child.isMesh) {
            child.receiveShadow = true;
        }
    });



    // Add some sample objects to test physics
    addPlayer();
    createBuilding();
    createPuzzleElements();

    createUI();                 // <── NEW
    requestPointerLock();
    initInput();
initShooting();   // ← NEW
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
    // world.defaultContactMaterial = new CANNON.ContactMaterial(
    //     new CANNON.Material("default"),
    //     new CANNON.Material("default"),
    //     {
    //         friction: 0.3,
    //         restitution: 0.3
    //     }
    // );
}

// Update the jump function to use floor contact detection
function jump() {
    if (isPlayerOnFloor() && canJump) {
        boxBody.velocity.y = 36; // Adjust this value for higher/lower jumps
        canJump = false;
        
        setTimeout(() => {
            canJump = true;
        }, 500);
    }
}

function addPlayer() {
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const boxMat = new THREE.MeshStandardMaterial({ color: 0xff5555 });
    boxMesh = new THREE.Mesh(boxGeo, boxMat);

    // SPAWN ON PLATFORM
    boxMesh.position.set(47.3, 3, 0);  // Center of first green platform
    boxMesh.castShadow = true;
    
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
    // ADD THIS LINE - Check for goal condition
    checkGoalCondition();

    updateBullets(delta);

// ── UPDATE CUBE ANIMATIONS ───────────────────────────────────────
cubeMixers.forEach(entry => {
    const isSelected = selectedBox === entry.cube;

    if (isSelected && !entry.wasPlaying) {
        // Start playing from beginning
        entry.action.reset().play();
        entry.wasPlaying = true;
    } else if (!isSelected && entry.wasPlaying) {
        // Reverse to start when deselected
        entry.action.timeScale = -1;
        entry.action.paused = false;
        entry.wasPlaying = false;
    } else if (!isSelected && entry.action.time > 0 && entry.action.timeScale === -1) {
        // Keep rewinding until time === 0
        if (entry.action.time <= 0) {
            entry.action.time = 0;
            entry.action.paused = true;
            entry.action.timeScale = 1;
        }
    } else if (isSelected) {
        // Normal forward play (already handled by reset().play())
        entry.action.timeScale = 1;
    }

    entry.mixer.update(delta);
});

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
    const targeted = getTargetedDoor();

    // Update door prompt based on current state
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
        } else {
            // Other doors (always openable)
            doorPromptDiv.textContent = 'Press E to open';
            doorPromptDiv.style.display = 'block';
        }
    } else {
        doorPromptDiv.style.display = 'none';
    }

    // ── CAMERA ───────────────────────────────────────────────────────
    updateCamera();
}

let doors = []; // Array to store door objects and their mixers
function createBuilding() {
    const loader = new GLTFLoader();
    loader.load(
        './updated_map.glb',
        (gltf) => {
            const model = gltf.scene;
            scene.add(model);

            // Traverse the model to enable shadows
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (!child.material) {
                        child.material = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
                    }
                }
            });

            // Load sci-fi doors
            const doorPositions = [
                new THREE.Vector3(47.5, 0.01, 28.5), // Door 0: Middle of hallway
                new THREE.Vector3(37.5, 0.01, -34.25), // Door 1: Near goal
                new THREE.Vector3(25, 0.01, 40.75), // Door 2: Near goal
                new THREE.Vector3(12.40625, 5.01, -47.25), // Door 3: Near goal
                new THREE.Vector3(0, 0.01, 47), // Door 4: Near goal
                new THREE.Vector3(-12.59375, 5.01, -47.25), // Door 5: Near goal
                new THREE.Vector3(-25, 0.01, 47), // Door 6: Near goal
                new THREE.Vector3(-37.5, 0.01, -45.25) // Door 7: Near goal
            ];

            doorPositions.forEach((position, index) => {
                loader.load(
                    './sc-fi_door.glb',
                    (doorGltf) => {
                        const door = doorGltf.scene;
                        door.position.copy(position);
                        door.name = `door_${index}`;
                        
                        // Apply scaling and rotation only to the second door (index 1)
                        if (index === 1 || index === 2 || index === 3 || index === 4 || index === 5 || index === 6 || index === 7) {
                            // Scale by 2
                            door.scale.set(2, 2, 2);
                            
                            // Rotate 90 degrees around Y axis
                            door.rotation.y = Math.PI / 2; // 90 degrees in radians
                            
                            console.log(`Door ${index} scaled by 2 and rotated 90 degrees`);
                        }
                        
                        scene.add(door);
                        if (index === 1 || index === 2 || index === 3 || index === 4 || index === 5 || index === 6 || index === 7) {
                            const doorgeo = new THREE.BoxGeometry(3.2, 5, 2); 
const doormat = new THREE.MeshBasicMaterial({
    color: 0x800000,          // maroon – distinct
    side: THREE.DoubleSide,
    wireframe: true
});
const doormesh = new THREE.Mesh(doorgeo, doormat);
doormesh.position.set(
        door.position.x,
        door.position.y + 5/2,  // Add half the height (2.5)
        door.position.z
    );      
doormesh.receiveShadow = true;
scene.add(doormesh);
                            const doorBody = new CANNON.Body({
                                shape: new CANNON.Box(new CANNON.Vec3(3.2/2, 5/2, 1)),
                                mass: 0
                            });
                            // Position physics body at the same height
    doorBody.position.set(
        door.position.x,
        door.position.y + 5/2,  // Add half the height (2.5)
        door.position.z
    );
                            doorBody.quaternion.setFromEuler(0, -Math.PI / 2, 0);
                            world.addBody(doorBody);
                            doormesh.userData.physicsBody = doorBody;

                            // Store reference in array
    doorBodies[index] = doorBody;
                        }
                        else{
                            const doorgeo = new THREE.BoxGeometry(1.25, 2.5, 2); 
const doormat = new THREE.MeshBasicMaterial({
    color: 0x800000,          // maroon – distinct
    side: THREE.DoubleSide,
    wireframe: true
});
const doormesh = new THREE.Mesh(doorgeo, doormat);
doormesh.position.set(
        door.position.x,
        door.position.y + 2.5/2,  // Add half the height (2.5)
        door.position.z
    );       
doormesh.receiveShadow = true;
scene.add(doormesh);
                            const doorBody = new CANNON.Body({
                                shape: new CANNON.Box(new CANNON.Vec3(1.25/2, 2.5/2, 1)),
                                mass: 0
                            });
                            // Position physics body at the same height
    doorBody.position.set(
        door.position.x,
        door.position.y + 2.5/2,  // Add half the height (2.5)
        door.position.z
    );
                            world.addBody(doorBody);
                            doormesh.userData.physicsBody = doorBody;

                            // Store reference in array
    doorBodies[index] = doorBody;
                        }

                        // Enable shadows for door meshes
                        door.traverse((child) => {
                            if (child.isMesh) {
                                child.castShadow = true;
                                child.receiveShadow = true;
                                if (!child.material) {
                                    child.material = new THREE.MeshStandardMaterial({ color: 0x888888 });
                                }
                            }
                        });

                        // Set up animation
                        const mixer = new THREE.AnimationMixer(door);
                        const animations = doorGltf.animations;
                        const openAction = animations.find(anim => anim.name.toLowerCase().includes('open'));
                        if (openAction) {
                            const action = mixer.clipAction(openAction);
                            action.setLoop(THREE.LoopOnce); // Play once
                            action.clampWhenFinished = true; // Stay open after animation
                            
                            // Create a custom animation that stops at halfway point
                            const originalDuration = openAction.duration;
                            const halfDuration = originalDuration / 2;
                            
                            // Set the animation to stop at halfway
                            action.time = 0;
                            action.setEffectiveTimeScale(1); // Normal speed
                            action.setEffectiveWeight(1);
                            
                            // Store the half duration for later use
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
    const firstPlateGeo = new THREE.BoxGeometry(1.5, 0.2, 1.5); 
    const firstPlateMat = new THREE.MeshStandardMaterial({
        color: 0x0000ff,          // blue
        side: THREE.DoubleSide,
    });
    const firstPlateMesh = new THREE.Mesh(firstPlateGeo, firstPlateMat);
    firstPlateMesh.position.set(47.5, 0, 15);      
    firstPlateMesh.receiveShadow = true;
    scene.add(firstPlateMesh);
    const firstPlateBody = new CANNON.Body({
        shape: new CANNON.Box(new CANNON.Vec3(1.5/2, 0.2/2, 1.5/2)),
        mass: 0
    });
    // Position physics body at the same height
    firstPlateBody.position.set(47.5, 0, 15);
    firstPlateBody.quaternion.setFromEuler(0, -Math.PI / 2, 0);
    world.addBody(firstPlateBody);
    firstPlateMesh.userData.physicsBody = firstPlateBody;
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
                
                // For first door (index 0), check if it's openable
                if (doorIndex === 0 && !firstDoorOpenable) {
                    return null; // First door not openable yet
                }
                
                // For second door (index 1), check if it's openable
                if (doorIndex === 1 && !secondDoorOpenable) {
                    return null; // Second door not openable yet
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
            const door = getTargetedDoor();
            if (door && door.action && !door.isOpen) {
                door.action.reset().play();
                door.isOpen = true;
                
                // Remove the physics body for this door
                const doorIndex = doors.indexOf(door);
                if (doorBodies[doorIndex]) {
                    world.removeBody(doorBodies[doorIndex]);
                    doorBodies[doorIndex] = null; // Clear the reference
                    console.log(`Door ${doorIndex} physics body removed`);
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
    
    // Replace the UI removal block:
document.querySelectorAll('.game-ui').forEach(el => {
    if (el.id !== 'victory-message') {  // 🔥 Keep victory, remove ALL else (incl. death)
        el.remove();
    }
});

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
    
    if (cubeOnPlateTimer) {
        clearTimeout(cubeOnPlateTimer);
        cubeOnPlateTimer = null;
    }

    // 4. Remove door bodies
    doorBodies.forEach((body, index) => {
        if (body && world) {
            world.removeBody(body);
        }
    });

    // 5. Reset puzzle state
    secondDoorOpenable = false;
    firstDoorOpenable = false;
    goalReached = false;
    
    platesOccupied = {
        plate13: false,
        plate11: false, 
        plate1: false
    };

    doorBodies = [];
    
    // 6. Clear bullets and boxes
    bullets.forEach(b => b.destroy());
    bullets = [];
    movableBoxes = [];
    selectedBox = null;

    // 7. Reset cube mixers
    cubeMixers.forEach(entry => {
        if (entry.mixer) {
            entry.mixer.stopAllAction();
        }
    });
    cubeMixers = [];

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

