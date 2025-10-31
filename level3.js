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
    plate13: new THREE.Vector3(44.49, 3, 15),
    plate11: new THREE.Vector3(44.49, 4, 10),  
    plate1: new THREE.Vector3(38.01, 5, 48)
};

let cubeMixers = [];   // { cube, mixer, action, wasPlaying }
let doorBodies = []; // Array to store door physics bodies
// ── UI & INPUT ───────────────────────────────────────────────────────
const DOOR_INTERACT_DISTANCE = 5;          // max distance to interact
const MOUSE_SENS = 0.002;                  // mouse look sensitivity
const PI_2 = Math.PI / 2;

let yaw = 0, pitch = 0;                    // camera rotation
let doorPromptDiv = null;                  // UI element
const raycaster = new THREE.Raycaster();  // reused for door & camera

let player = null;                         // reference to the physics box mesh

// ── BULLETS & MOVABLE CUBES ───────────────────────────────────────
const BULLET_SPEED = 60;               // units/second
const BULLET_MAX_DISTANCE = 100;       // units
const BOX_SIZE = 1;                    // size of the sci-fi cube model (scale later)

let bullets = [];                      // active Bullet instances
let movableBoxes = [];                 // all sci-fi cubes
let selectedBox = null;                // currently dragged cube
let dragDistance = 8;                  // distance from camera
const MIN_CUBE_DISTANCE = 5;           // Minimum distance between cube and player
const MAX_CUBE_DISTANCE = 30;          // Maximum distance for cube dragging
const SCROLL_SENSITIVITY = 10;        // How fast scroll changes distance
let lastValidBoxPos = new THREE.Vector3();

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
                angularDamping: 0.9
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
    // Staircase cube (ground floor)
    createMovableBox(new THREE.Vector3(46, 5, 0));

    // hall 1
    createMovableBox(new THREE.Vector3(40, 1, -30));
    createMovableBox(new THREE.Vector3( 40, 1, 0));
    createMovableBox(new THREE.Vector3( 40, 1, 10));
    // hall 3
    createMovableBox(new THREE.Vector3(14, 1, -30));
    createMovableBox(new THREE.Vector3( 20, 1, 0));
    createMovableBox(new THREE.Vector3( 19, 1, 10));
}

// Initialize the level
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
}

function setupScene() {
    // Clear the scene
    while(scene.children.length > 0) {
        scene.remove(scene.children[0]);
    }

    // Create physics world
    world = new CANNON.World({
        gravity: new CANNON.Vec3(0, -9.81, 0)
    });

    // Create platform mesh
    const platformGeo = new THREE.PlaneGeometry(12.5, 100); // Width=12.5, Depth=100
    const platformMat = new THREE.MeshBasicMaterial({
        color: 0x00ff00, // Green to distinguish from blue ground
        side: THREE.DoubleSide,
        wireframe: true
    });
    const platformMesh = new THREE.Mesh(platformGeo, platformMat);
    platformMesh.position.set(43.75, 0.05, 0); // Center at (43.75, 0.05, 0)
    platformMesh.receiveShadow = true; // Match ground settings
    scene.add(platformMesh);

    // Create physics platform body
    const platformBody = new CANNON.Body({
        shape: new CANNON.Box(new CANNON.Vec3(12.5 / 2, 100 / 2, 0.1)), // Half-extents: width/2, height/2, depth/2
        mass: 0 // Static body
    });
    platformBody.position.set(43.75, 0.05, 0); // Center matches mesh
    platformBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Rotate to be horizontal
    world.addBody(platformBody);

    // Store reference for synchronization
    platformMesh.userData.physicsBody = platformBody;

    // Inside setupScene(), after existing platform creation
// Create new platform mesh
const newPlatformGeo = new THREE.PlaneGeometry(12.5, 50.7); // Width=12.5, Depth=50.7
const newPlatformMat = new THREE.MeshBasicMaterial({
    color: 0xffff00, // Yellow to distinguish from green platform and blue ground
    side: THREE.DoubleSide,
    wireframe: true
});
const newPlatformMesh = new THREE.Mesh(newPlatformGeo, newPlatformMat);
newPlatformMesh.rotation.x = -Math.PI / 2; // Rotate to lie flat (like ground)
newPlatformMesh.position.set(31.25, 0.05, -24.65); // Center at (31.25, 0.05, -24.65)
newPlatformMesh.receiveShadow = true; // Match ground and platform settings
scene.add(newPlatformMesh);

// Create new physics platform body
const newPlatformBody = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(12.5 / 2, 50.7 / 2, 0.1)), // Half-extents: width/2, height/2, depth/2
    mass: 0 // Static body
});
newPlatformBody.position.set(31.25, 0.05, -24.65); // Center matches mesh
newPlatformBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Rotate to be horizontal
world.addBody(newPlatformBody);

// Store reference for synchronization
newPlatformMesh.userData.physicsBody = newPlatformBody;

// Inside setupScene(), after the yellow platform creation
// Create third platform mesh (cyan)
const thirdPlatformGeo = new THREE.PlaneGeometry(12.5, 20); // Width=12.5, Depth=20
const thirdPlatformMat = new THREE.MeshBasicMaterial({
    color: 0x00ffff, // Cyan to distinguish from green platform, yellow platform, and blue ground
    side: THREE.DoubleSide,
    wireframe: true
});
const thirdPlatformMesh = new THREE.Mesh(thirdPlatformGeo, thirdPlatformMat);
thirdPlatformMesh.rotation.x = -Math.PI / 2; // Rotate to lie flat (like ground)
thirdPlatformMesh.position.set(31.25, 0.05, 40); // Center at (31.25, 0.05, 40)
thirdPlatformMesh.receiveShadow = true; // Match ground and platform settings
scene.add(thirdPlatformMesh);

// Create third physics platform body
const thirdPlatformBody = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(12.5 / 2, 20 / 2, 0.1)), // Half-extents: width/2, height/2, depth/2
    mass: 0 // Static body
});
thirdPlatformBody.position.set(31.25, 0.05, 40); // Center matches mesh
thirdPlatformBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Rotate to be horizontal
world.addBody(thirdPlatformBody);

// Store reference for synchronization
thirdPlatformMesh.userData.physicsBody = thirdPlatformBody;

// Inside setupScene(), after the cyan platform creation
// Create fourth platform mesh (magenta)
const fourthPlatformGeo = new THREE.PlaneGeometry(12.5, 29.3); // Width=12.5, Depth=29.3
const fourthPlatformMat = new THREE.MeshBasicMaterial({
    color: 0xff00ff, // Magenta to distinguish from green, yellow, cyan platforms, and blue ground
    side: THREE.DoubleSide,
    wireframe: true
});
const fourthPlatformMesh = new THREE.Mesh(fourthPlatformGeo, fourthPlatformMat);
fourthPlatformMesh.rotation.x = -Math.PI / 2; // Rotate to lie flat (like ground)
fourthPlatformMesh.position.set(31.25, -2, 15.35); // Center at (31.25, -2, 15.35)
fourthPlatformMesh.receiveShadow = true; // Match ground and platform settings
scene.add(fourthPlatformMesh);

// Create fourth physics platform body
const fourthPlatformBody = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(12.5 / 2, 29.3 / 2, 0.1)), // Half-extents: width/2, height/2, depth/2
    mass: 0 // Static body
});
fourthPlatformBody.position.set(31.25, -1.95, 15.35); // Center matches mesh, y=-1.95 for top surface at y=-2
fourthPlatformBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Rotate to be horizontal
world.addBody(fourthPlatformBody);

// Store reference for synchronization
fourthPlatformMesh.userData.physicsBody = fourthPlatformBody;

// Inside setupScene(), after the magenta platform creation
// Create fifth platform mesh (orange)
const fifthPlatformGeo = new THREE.PlaneGeometry(12.5, 100); // Width=12.5, Depth=100
const fifthPlatformMat = new THREE.MeshBasicMaterial({
    color: 0xffa500, // Orange to distinguish from green, yellow, cyan, magenta platforms, and blue ground
    side: THREE.DoubleSide,
    wireframe: true
});
const fifthPlatformMesh = new THREE.Mesh(fifthPlatformGeo, fifthPlatformMat);
fifthPlatformMesh.rotation.x = -Math.PI / 2; // Rotate to lie flat (like ground)
fifthPlatformMesh.position.set(18.75, 0.05, 0); // Center at (18.75, 0.05, 0)
fifthPlatformMesh.receiveShadow = true; // Match ground and platform settings
scene.add(fifthPlatformMesh);

// Create fifth physics platform body
const fifthPlatformBody = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(12.5 / 2, 100 / 2, 0.1)), // Half-extents: width/2, height/2, depth/2
    mass: 0 // Static body
});
fifthPlatformBody.position.set(18.75, 0.05, 0); // Center matches mesh
fifthPlatformBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Rotate to be horizontal
world.addBody(fifthPlatformBody);

// Store reference for synchronization
fifthPlatformMesh.userData.physicsBody = fifthPlatformBody;


// Inside setupScene(), after the orange platform creation
// Create sixth platform mesh (purple)
const sixthPlatformGeo = new THREE.PlaneGeometry(12.5, 12.7); // Width=12.5, Depth=12.7
const sixthPlatformMat = new THREE.MeshBasicMaterial({
    color: 0x800080, // Purple to distinguish from other platforms and ground
    side: THREE.DoubleSide,
    wireframe: true
});
const sixthPlatformMesh = new THREE.Mesh(sixthPlatformGeo, sixthPlatformMat);
sixthPlatformMesh.rotation.x = -Math.PI / 2; // Rotate to lie flat (like ground)
sixthPlatformMesh.position.set(6.25, 0.05, -43.65); // Center at (6.25, 0.05, -43.65)
sixthPlatformMesh.receiveShadow = true; // Match ground and platform settings
scene.add(sixthPlatformMesh);

// Create sixth physics platform body
const sixthPlatformBody = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(12.5 / 2, 12.7 / 2, 0.1)), // Half-extents: width/2, height/2, depth/2
    mass: 0 // Static body
});
sixthPlatformBody.position.set(6.25, 0.05, -43.65); // Center matches mesh
sixthPlatformBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Rotate to be horizontal
world.addBody(sixthPlatformBody);

// Store reference for synchronization
sixthPlatformMesh.userData.physicsBody = sixthPlatformBody;

// Create seventh platform mesh (white)
const seventhPlatformGeo = new THREE.PlaneGeometry(12.5, 12.3); // Width=12.5, Depth=12.3
const seventhPlatformMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, // White to distinguish from other platforms and ground
    side: THREE.DoubleSide,
    wireframe: true
});
const seventhPlatformMesh = new THREE.Mesh(seventhPlatformGeo, seventhPlatformMat);
seventhPlatformMesh.rotation.x = -Math.PI / 2; // Rotate to lie flat (like ground)
seventhPlatformMesh.position.set(6.25, 0.05, 43.85); // Center at (6.25, 0.05, 43.85)
seventhPlatformMesh.receiveShadow = true; // Match ground and platform settings
scene.add(seventhPlatformMesh);

// Create seventh physics platform body
const seventhPlatformBody = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(12.5 / 2, 12.3 / 2, 0.1)), // Half-extents: width/2, height/2, depth/2
    mass: 0 // Static body
});
seventhPlatformBody.position.set(6.25, 0.05, 43.85); // Center matches mesh
seventhPlatformBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Rotate to be horizontal
world.addBody(seventhPlatformBody);

// Store reference for synchronization
seventhPlatformMesh.userData.physicsBody = seventhPlatformBody;

// Create eighth platform mesh (red)
const eighthPlatformGeo = new THREE.PlaneGeometry(12.5, 75); // Width=12.5, Depth=75
const eighthPlatformMat = new THREE.MeshBasicMaterial({
    color: 0xff0000, // Red to distinguish from other platforms and ground
    side: THREE.DoubleSide,
    wireframe: true
});
const eighthPlatformMesh = new THREE.Mesh(eighthPlatformGeo, eighthPlatformMat);
eighthPlatformMesh.rotation.x = -Math.PI / 2; // Rotate to lie flat (like ground)
eighthPlatformMesh.position.set(6.25, -2, 0.2); // Center at (6.25, -2, 0.2)
eighthPlatformMesh.receiveShadow = true; // Match ground and platform settings
scene.add(eighthPlatformMesh);

// Create eighth physics platform body
const eighthPlatformBody = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(12.5 / 2, 75 / 2, 0.1)), // Half-extents: width/2, height/2, depth/2
    mass: 0 // Static body
});
eighthPlatformBody.position.set(6.25, -1.95, 0.2); // Center matches mesh, y=-1.95 for top surface at y=-2
eighthPlatformBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Rotate to be horizontal
world.addBody(eighthPlatformBody);

// Store reference for synchronization
eighthPlatformMesh.userData.physicsBody = eighthPlatformBody;

// Inside setupScene(), after the red platform creation
// Create ninth platform mesh (lime)
const ninthPlatformGeo = new THREE.PlaneGeometry(12.5, 93.865); // Width=12.5, Depth=93.865
const ninthPlatformMat = new THREE.MeshBasicMaterial({
    color: 0x00ff00, // Lime (using 0x00ff00, distinct in context) to distinguish from other platforms and ground
    side: THREE.DoubleSide,
    wireframe: true
});
const ninthPlatformMesh = new THREE.Mesh(ninthPlatformGeo, ninthPlatformMat);
ninthPlatformMesh.rotation.x = -Math.PI / 2; // Rotate to lie flat (like ground)
ninthPlatformMesh.position.set(-6.25, -2, -3.0675); // Center at (-6.25, -2, -3.0675)
ninthPlatformMesh.receiveShadow = true; // Match ground and platform settings
scene.add(ninthPlatformMesh);

// Create ninth physics platform body
const ninthPlatformBody = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(12.5 / 2, 93.865 / 2, 0.1)), // Half-extents: width/2, height/2, depth/2
    mass: 0 // Static body
});
ninthPlatformBody.position.set(-6.25, -1.95, -3.0675); // Center matches mesh, y=-1.95 for top surface at y=-2
ninthPlatformBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Rotate to be horizontal
world.addBody(ninthPlatformBody);

// Store reference for synchronization
ninthPlatformMesh.userData.physicsBody = ninthPlatformBody;

// Create tenth platform mesh (teal)
const tenthPlatformGeo = new THREE.PlaneGeometry(12.5, 6.135); // Width=12.5, Depth=6.135
const tenthPlatformMat = new THREE.MeshBasicMaterial({
    color: 0x008080, // Teal to distinguish from other platforms and ground
    side: THREE.DoubleSide,
    wireframe: true
});
const tenthPlatformMesh = new THREE.Mesh(tenthPlatformGeo, tenthPlatformMat);
tenthPlatformMesh.rotation.x = -Math.PI / 2; // Rotate to lie flat (like ground)
tenthPlatformMesh.position.set(-6.25, 0.05, 46.9325); // Center at (-6.25, 0.05, 46.9325)
tenthPlatformMesh.receiveShadow = true; // Match ground and platform settings
scene.add(tenthPlatformMesh);

// Create tenth physics platform body
const tenthPlatformBody = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(12.5 / 2, 6.135 / 2, 0.1)),
    mass: 0 // Static body
});
tenthPlatformBody.position.set(-6.25, 0.05, 46.9325); // Center matches mesh
tenthPlatformBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Rotate to be horizontal
world.addBody(tenthPlatformBody);

// Store reference for synchronization
tenthPlatformMesh.userData.physicsBody = tenthPlatformBody;

// Inside setupScene(), after the teal platform creation
// Create eleventh platform mesh (pink)
const eleventhPlatformGeo = new THREE.PlaneGeometry(37.5, 100); // Width=37.5, Depth=100
const eleventhPlatformMat = new THREE.MeshBasicMaterial({
    color: 0xff69b4, // Pink to distinguish from other platforms and ground
    side: THREE.DoubleSide,
    wireframe: true
});
const eleventhPlatformMesh = new THREE.Mesh(eleventhPlatformGeo, eleventhPlatformMat);
eleventhPlatformMesh.rotation.x = -Math.PI / 2; // Rotate to lie flat (like ground)
eleventhPlatformMesh.position.set(-31.25, 0.05, 0); // Center at (-31.25, 0.05, 0)
eleventhPlatformMesh.receiveShadow = true; // Match ground and platform settings
scene.add(eleventhPlatformMesh);

// Create eleventh physics platform body
const eleventhPlatformBody = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(37.5 / 2, 100 / 2, 0.1)), // Half-extents: width/2, height/2, depth/2
    mass: 0 // Static body
});
eleventhPlatformBody.position.set(-31.25, 0.05, 0); // Center matches mesh
eleventhPlatformBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Rotate to be horizontal
world.addBody(eleventhPlatformBody);

// Store reference for synchronization
eleventhPlatformMesh.userData.physicsBody = eleventhPlatformBody;

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
const wall43Geo = new THREE.PlaneGeometry(4, 6.282); // X = 4, Z = 6.282
const wall43Mat = new THREE.MeshBasicMaterial({
    color: 0x1e90ff,          // dodgerblue – distinct
    side: THREE.DoubleSide,
    wireframe: true
});
const wall43Mesh = new THREE.Mesh(wall43Geo, wall43Mat);               // horizontal XZ plane
wall43Mesh.position.set(12.425, 5, -46.859);         // x = (10.425+14.425)/2
                                                     // y = 5
                                                     // z = (-43.718 + -50)/2
wall43Mesh.receiveShadow = true;
scene.add(wall43Mesh);

const wall43Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(4/2, 6.282/2, 0.1)), // half-extents
    mass: 0
});
wall43Body.position.set(12.425, 5, -46.859);
wall43Body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(wall43Body);
wall43Mesh.userData.physicsBody = wall43Body;

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
const wall47Geo = new THREE.PlaneGeometry(12.5, 2); // X = 12.5, Z = 0.71252 (same thickness as walls 41/42)
const wall47Mat = new THREE.MeshBasicMaterial({
    color: 0x2f4f4f,          // darkslategray – distinct
    side: THREE.DoubleSide,
    wireframe: true
});
const wall47Mesh = new THREE.Mesh(wall47Geo, wall47Mat);                // horizontal XZ plane
wall47Mesh.position.set(6.25, -1, -37.322);           // x = (0+12.5)/2 = 6.25
                                                      // y = (0 + -2)/2 = -1
                                                      // z = -37.322 (center in Z)
wall47Mesh.receiveShadow = true;
scene.add(wall47Mesh);

const wall47Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(12.5/2, 1, 0.1)), // half-extents: X/2, thickness/2, Z/2
    mass: 0
});
wall47Body.position.set(6.25, -1, -37.322);
world.addBody(wall47Body);
wall47Mesh.userData.physicsBody = wall47Body;

// ---------------------------------------------------------------
//  48th wall – Wall 2 (dimgray)
//  Corners: (0,0,37.678), (0,-2,37.678),
//           (12.5,-2,37.678), (12.5,0,37.678)
// ---------------------------------------------------------------
const wall48Geo = new THREE.PlaneGeometry(12.5, 2); // X = 12.5, Z = 0.71252
const wall48Mat = new THREE.MeshBasicMaterial({
    color: 0x696969,          // dimgray – distinct
    side: THREE.DoubleSide,
    wireframe: true
});
const wall48Mesh = new THREE.Mesh(wall48Geo, wall48Mat);               // horizontal XZ plane
wall48Mesh.position.set(6.25, -1, 37.678);            // x = 6.25, y = -1, z = 37.678
wall48Mesh.receiveShadow = true;
scene.add(wall48Mesh);

const wall48Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(12.5/2, 1, 0.1)), // half-extents
    mass: 0
});
wall48Body.position.set(6.25, -1, 37.678);
world.addBody(wall48Body);
wall48Mesh.userData.physicsBody = wall48Body;

// ---------------------------------------------------------------
//  49th wall – Wall 1 (slategray)
//  Corners: (0,0,43.839), (0,-2,43.839),
//           (-12.5,-2,43.839), (-12.5,0,43.839)
// ---------------------------------------------------------------
const wall49Geo = new THREE.PlaneGeometry(12.5, 2); // X = 12.5, Z = 0.71252 (consistent thickness)
const wall49Mat = new THREE.MeshBasicMaterial({
    color: 0x708090,          // slategray – distinct from all previous
    side: THREE.DoubleSide,
    wireframe: true
});
const wall49Mesh = new THREE.Mesh(wall49Geo, wall49Mat);                // horizontal XZ plane
wall49Mesh.position.set(-6.25, -1, 43.839);           // x = (0 + -12.5)/2 = -6.25
                                                      // y = (0 + -2)/2 = -1
                                                      // z = 43.839 (center in Z)
wall49Mesh.receiveShadow = true;
scene.add(wall49Mesh);

const wall49Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(12.5/2, 1, 0.1)), // half-extents: X/2, thickness/2, Z/2
    mass: 0
});
wall49Body.position.set(-6.25, -1, 43.839);
world.addBody(wall49Body);
wall49Mesh.userData.physicsBody = wall49Body;

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
const wall51Geo = new THREE.PlaneGeometry(4, 1); // X = 4, Y = 1 (height)
const wall51Mat = new THREE.MeshBasicMaterial({
    color: 0x191970,          // midnightblue – distinct
    side: THREE.DoubleSide,
    wireframe: true
});
const wall51Mesh = new THREE.Mesh(wall51Geo, wall51Mat);                // horizontal XZ plane
wall51Mesh.position.set(-12.5, 4.5, -43.746);         // x = (-14.5 + -10.5)/2 = -12.5
                                                      // y = (5 + 4)/2 = 4.5
                                                      // z = -43.746
wall51Mesh.receiveShadow = true;
scene.add(wall51Mesh);

const wall51Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(4/2, 1/2, 0.1)), // half-extents: X/2, Y/2, thickness/2
    mass: 0
});
wall51Body.position.set(-12.5, 4.5, -43.746);
world.addBody(wall51Body);
wall51Mesh.userData.physicsBody = wall51Body;

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
const wall54Geo = new THREE.PlaneGeometry(4, 6.254); // X = 4, Z = 6.254
const wall54Mat = new THREE.MeshBasicMaterial({
    color: 0x4b0082,          // indigo – distinct
    side: THREE.DoubleSide,
    wireframe: true
});
const wall54Mesh = new THREE.Mesh(wall54Geo, wall54Mat);
wall54Mesh.position.set(-12.5, 5, -46.873);
wall54Mesh.receiveShadow = true;
scene.add(wall54Mesh);

const wall54Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(4/2, 6.254/2, 0.1)),
    mass: 0
});
wall54Body.position.set(-12.5, 5, -46.873);
wall54Body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(wall54Body);
wall54Mesh.userData.physicsBody = wall54Body;

// ---------------------------------------------------------------
//  55th wall – Wall 5 (darkslateblue) – bottom face
//  Corners: (-14.5,4,-43.746), (-10.5,4,-43.746),
//           (-10.5,4,-50), (-14.5,4,-50)
// ---------------------------------------------------------------
const wall55Geo = new THREE.PlaneGeometry(4, 6.254); // X = 4, Z = 6.254
const wall55Mat = new THREE.MeshBasicMaterial({
    color: 0x483d8b,          // darkslateblue – distinct
    side: THREE.DoubleSide,
    wireframe: true
});
const wall55Mesh = new THREE.Mesh(wall55Geo, wall55Mat);
wall55Mesh.position.set(-12.5, 4, -46.873);
wall55Mesh.receiveShadow = true;
scene.add(wall55Mesh);

const wall55Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(4/2, 6.254/2, 0.1)),
    mass: 0
});
wall55Body.position.set(-12.5, 4, -46.873);
wall55Body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(wall55Body);
wall55Mesh.userData.physicsBody = wall55Body;

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
const wall62Geo = new THREE.PlaneGeometry(3.25, 3.125); // X = 3, Z = 3.125
const wall62Mat = new THREE.MeshBasicMaterial({
    color: 0xc71585,          // mediumvioletred – distinct
    side: THREE.DoubleSide,
    wireframe: true
});
const wall62Mesh = new THREE.Mesh(wall62Geo, wall62Mat);                 // horizontal XZ plane
wall62Mesh.position.set(-51.5, 5, 0.690225);           // z = (2.2527 + -0.87225)/2 = 0.690225
wall62Mesh.receiveShadow = true;
scene.add(wall62Mesh);

const wall62Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(3.25/2, 3.125/2, 0.1)),
    mass: 0
});
wall62Body.position.set(-51.5, 5, 0.690225);
wall62Body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(wall62Body);
wall62Mesh.userData.physicsBody = wall62Body;

// ---------------------------------------------------------------
//  63rd wall – Wall 4 (deeppink)
//  Corners: (-53,8.75,2.2527), (-50,8.75,2.2527),
//           (-50,8.75,-0.87225), (-53,8.75,-0.87225)
// ---------------------------------------------------------------
const wall63Geo = new THREE.PlaneGeometry(3.25, 3.125);
const wall63Mat = new THREE.MeshBasicMaterial({
    color: 0xff1493,          // deeppink – distinct
    side: THREE.DoubleSide,
    wireframe: true
});
const wall63Mesh = new THREE.Mesh(wall63Geo, wall63Mat);
wall63Mesh.position.set(-51.5, 8.75, 0.690225);
wall63Mesh.receiveShadow = true;
scene.add(wall63Mesh);

const wall63Body = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(3.25/2, 3.125/2, 0.1)),
    mass: 0
});
wall63Body.position.set(-51.5, 8.75, 0.690225);
wall63Body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(wall63Body);
wall63Mesh.userData.physicsBody = wall63Body;

// Define positions for the 13 models (you can tweak these coordinates)
const modelPositions = [
    new THREE.Vector3(38.01, 5, 48),   // Model 1
    new THREE.Vector3(44.49, 3, 0),   // Model 2
    new THREE.Vector3(39.5, 3.5, -49.49),   // Model 3
    new THREE.Vector3(38.01, 1, 0),   // Model 4
    new THREE.Vector3(38.01, 2, 38),     // Model 5
    new THREE.Vector3(39.5, 4, 49.49),    // Model 6
    new THREE.Vector3(48, 4, -49.49),    // Model 7
    new THREE.Vector3(38.01, 1.5, 20),    // Model 8
    new THREE.Vector3(43.5, 3, -49.49),    // Model 9
    new THREE.Vector3(49.49, 5, -4.2),   // Model 10 (elevated)
    new THREE.Vector3(44.49, 4, 10),    // Model 11 (elevated)
    new THREE.Vector3(44, 3.5, 49.49),   // Model 12 (higher)
    new THREE.Vector3(44.49, 3, 15)     // Model 13 (higher)
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
            
            if(modelNames[i] === 'six' || modelNames[i] === 'twelve'){
                model.rotation.y = Math.PI;
            }
            if(modelNames[i] === 'one' || modelNames[i] === 'four' || modelNames[i] === 'five' || modelNames[i] === 'eight'){
                model.rotation.y = Math.PI/2;
            }
            if(modelNames[i] === 'ten' || modelNames[i] === 'two' || modelNames[i] === 'eleven' || modelNames[i] === 'thirteen'){
                model.rotation.y = -Math.PI/2;
            }
             
            // Enable shadows
            model.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            
            scene.add(model);
            const plate = new CANNON.Body({
                shape: new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.01)),
                mass: 0
            });
            if(modelNames[i] === 'six' || modelNames[i] === 'twelve'){
                plate.position.copy(model.position);
                plate.quaternion.setFromEuler(0,Math.PI, 0);
            }
            if(modelNames[i] === 'one' || modelNames[i] === 'four' || modelNames[i] === 'five' || modelNames[i] === 'eight'){
                plate.position.copy(model.position);
                plate.quaternion.setFromEuler(0,Math.PI / 2, 0);
            }
            if(modelNames[i] === 'ten' || modelNames[i] === 'two' || modelNames[i] === 'eleven' || modelNames[i] === 'thirteen'){
                plate.position.copy(model.position);
                plate.quaternion.setFromEuler(0,-Math.PI / 2, 0);
            }
            world.addBody(plate);
            // Store reference for synchronization
            if (model && plate) {
                model.userData.physicsBody = plate;  // Link model to physics body
                plate.userData = plate.userData || {};
                plate.userData.mesh = model;         // Link physics body to model
            }
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
    addTestObjects();
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

function onMouseMove(e) {
    yaw   -= e.movementX * MOUSE_SENS;
    pitch += e.movementY * MOUSE_SENS;
    const maxPitch = PI_2 - 0.1;
    const minPitch = -maxPitch;
    pitch = Math.max(minPitch, Math.min(maxPitch, pitch));
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

// Jump function
function jump() {
    // Check if the box is close to the ground (you can adjust this threshold)
    const isOnGround = boxBody.position.y <= 1.1; // Adjust based on your platform heights
    
    if (isOnGround) {
        // Apply upward impulse for jumping
        boxBody.velocity.y = 16; // Adjust this value for higher/lower jumps
        canJump = false;
        
        // Reset jump cooldown after a short delay
        setTimeout(() => {
            canJump = true;
        }, 500); // 500ms cooldown between jumps
    }
}

function addTestObjects() {
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const boxMat = new THREE.MeshStandardMaterial({ color: 0xff5555 });
    boxMesh = new THREE.Mesh(boxGeo, boxMat);

    // SPAWN ON PLATFORM
    boxMesh.position.set(46.5, 3, 0);  // Center of first green platform
    boxMesh.castShadow = true;
    scene.add(boxMesh);

    boxBody = new CANNON.Body({
        mass: 100,
        shape: new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)),
        linearDamping: 0.9,
        angularDamping: 1
    });
    boxBody.position.copy(boxMesh.position);
    world.addBody(boxBody);
    boxMesh.userData.physicsBody = boxBody;

    player = boxMesh;
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
    // Check each plate
    Object.keys(platePositions).forEach(plateKey => {
        const platePos = platePositions[plateKey];
        let cubeOnThisPlate = false;
        
        for (const box of movableBoxes) {
            const boxPos = box.position;
            
            // Check if cube is on the plate (within XZ range and close to plate height)
            const distanceXZ = Math.sqrt(
                Math.pow(boxPos.x - platePos.x, 2) + 
                Math.pow(boxPos.z - platePos.z, 2)
            );
            const heightDiff = Math.abs(boxPos.y - platePos.y);
            
            // If cube is within 2 units in XZ and resting on plate (height < 2)
            if (distanceXZ < 2 && heightDiff < 2 && box.userData.physicsBody.velocity.length() < 0.1) {
                cubeOnThisPlate = true;
                break;
            }
        }
        
        if (cubeOnThisPlate) {
            if (!plateTimers[plateKey]) {
                // Start timer when cube first lands on plate
                plateTimers[plateKey] = setTimeout(() => {
                    platesOccupied[plateKey] = true;
                    console.log(`Plate ${plateKey} is now occupied!`);
                    plateTimers[plateKey] = null;
                    
                    // Check if all plates are occupied
                    checkSecondDoorUnlock();
                }, 3000); // 3 seconds
            }
        } else {
            // Reset timer if cube leaves plate
            if (plateTimers[plateKey]) {
                clearTimeout(plateTimers[plateKey]);
                plateTimers[plateKey] = null;
            }
            // Reset plate status if cube leaves
            if (platesOccupied[plateKey]) {
                platesOccupied[plateKey] = false;
                console.log(`Plate ${plateKey} is no longer occupied`);
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
    const speed = 7;
    const move = new THREE.Vector3();
    if (keys['KeyW']) move.z -= 1;
    if (keys['KeyS']) move.z += 1;
    if (keys['KeyA']) move.x += 1;
    if (keys['KeyD']) move.x -= 1;
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
    if (keys['Space'] && canJump && boxBody.position.y <= 1.1) {
        boxBody.velocity.y = 16;
        canJump = false;
        setTimeout(() => canJump = true, 500);
    }

    // ── SYNC PLAYER ─────────────────────────────────────────────────
if (boxMesh && boxBody) {
    boxMesh.position.copy(boxBody.position);
    boxMesh.quaternion.copy(boxBody.quaternion);
}

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
doorPromptDiv.style.display = targeted ? 'block' : 'none';

// Show messages for locked doors
if (!firstDoorOpenable && doors[0] && !doors[0].isOpen) {
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    raycaster.set(camera.position, direction);
    raycaster.far = DOOR_INTERACT_DISTANCE;
    const hits = raycaster.intersectObject(doors[0].model, true);
    
    if (hits.length > 0 && camera.position.distanceTo(doors[0].model.position) <= DOOR_INTERACT_DISTANCE) {
        doorPromptDiv.textContent = 'Place cube on plate to unlock';
        doorPromptDiv.style.display = 'block';
    }
}

// Show message for second door when not openable
if (!secondDoorOpenable && doors[1] && !doors[1].isOpen) {
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    raycaster.set(camera.position, direction);
    raycaster.far = DOOR_INTERACT_DISTANCE;
    const hits = raycaster.intersectObject(doors[1].model, true);
    
    if (hits.length > 0 && camera.position.distanceTo(doors[1].model.position) <= DOOR_INTERACT_DISTANCE) {
        const occupiedCount = Object.values(platesOccupied).filter(Boolean).length;
        doorPromptDiv.textContent = `Place cubes on plates (${occupiedCount}/3 occupied)`;
        doorPromptDiv.style.display = 'block';
    }
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
    const firstPlateGeo = new THREE.BoxGeometry(3.2, 0.2, 2); 
    const firstPlateMat = new THREE.MeshBasicMaterial({
        color: 0x800000,          // maroon – distinct
        side: THREE.DoubleSide,
    });
    const firstPlateMesh = new THREE.Mesh(firstPlateGeo, firstPlateMat);
    firstPlateMesh.position.set(47.5, 0, 15);      
    firstPlateMesh.receiveShadow = true;
    scene.add(firstPlateMesh);
                            const firstPlateBody = new CANNON.Body({
                                shape: new CANNON.Box(new CANNON.Vec3(3.2/2, 0.2/2, 1)),
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

// Clean up the level
export function cleanupLevel() {
    // remove UI
    document.querySelectorAll('.game-ui').forEach(el => el.remove());

    // remove pointer-lock listener
    document.removeEventListener('pointerlockchange', onPointerLockChange);
    document.removeEventListener('mousemove', onMouseMove);
    
    // remove wheel listener
    renderer.domElement.removeEventListener('wheel', handleMouseWheel);
// Remove door bodies
    doorBodies.forEach((body, index) => {
        if (body) {
            world.removeBody(body);
        }
    });
    // Reset second door puzzle
    secondDoorOpenable = false;
    platesOccupied = {
        plate13: false,
        plate11: false, 
        plate1: false
    };
    
    // Clear all plate timers
    Object.keys(plateTimers).forEach(plateKey => {
        if (plateTimers[plateKey]) {
            clearTimeout(plateTimers[plateKey]);
            plateTimers[plateKey] = null;
        }
    });
    doorBodies = [];
    // physics world
    if (world){
        while (world.bodies.length > 0){
            world.removeBody(world.bodies[0]);
        }
    }
    bullets.forEach(b => b.destroy());
bullets = [];
movableBoxes = [];
selectedBox = null;
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

    const playerCenter = player.position.clone().setY(player.position.y + aimHeightOffset);
    const camDir = new THREE.Vector3().subVectors(targetPos, playerCenter).normalize();

    raycaster.set(playerCenter, camDir);
    raycaster.far = targetPos.distanceTo(playerCenter);
    const obstacles = scene.children.filter(o => o !== player && o.name !== 'goal');
    const hits = raycaster.intersectObjects(obstacles, true);

    if (hits.length > 0) {
        const actual = hits[0].distance - 0.2;               // stay a little inside
        camera.position.copy(playerCenter).addScaledVector(camDir, actual);
    } else {
        camera.position.copy(targetPos);
    }

    camera.lookAt(player.position.x, player.position.y + aimHeightOffset, player.position.z);
}

// Make functions available for the main game loop
window.returnToMainMenuFromLevel3 = returnCallback;
function checkSecondDoorUnlock() {
    const allPlatesOccupied = platesOccupied.plate13 && platesOccupied.plate11 && platesOccupied.plate1;
    
    if (allPlatesOccupied && !secondDoorOpenable) {
        secondDoorOpenable = true;
        console.log("SECOND DOOR UNLOCKED! All plates are occupied!");
    } else if (!allPlatesOccupied && secondDoorOpenable) {
        secondDoorOpenable = false;
        console.log("Second door locked - plates are no longer all occupied");
    }
}