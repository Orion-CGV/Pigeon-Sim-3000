import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as CANNON from 'cannon-es';

// Store level-specific variables
let scene, camera, renderer, labelRenderer;
let world, groundBody, groundMesh;
let returnCallback;

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

    // Create ground
    const groundGeo = new THREE.PlaneGeometry(30, 30);
    const groundMat = new THREE.MeshBasicMaterial({
        color: 0x0000ff,
        side: THREE.DoubleSide,
        wireframe: true
    });
    // groundMesh = new THREE.Mesh(groundGeo, groundMat);
    // scene.add(groundMesh);

    // Create physics ground body
    // groundBody = new CANNON.Body({
    //     shape: new CANNON.Box(new CANNON.Vec3(15, 15, 0.1)),
    //     mass: 0 // mass 0 = static body
    // });
    // groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Rotate to be horizontal
    // world.addBody(groundBody);

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
// Create third platform mesh
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
// Create fourth platform mesh
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
// Create fifth platform mesh
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

// Create fourteenth wall mesh (gold, at x=-50, YZ plane)
const fourteenthWallGeo = new THREE.PlaneGeometry(100, 10); // Width=Z=100, Height=Y=10
const fourteenthWallMat = new THREE.MeshBasicMaterial({
    color: 0xffd700, // Gold to distinguish from other platforms and walls
    side: THREE.DoubleSide,
    wireframe: true
});
const fourteenthWallMesh = new THREE.Mesh(fourteenthWallGeo, fourteenthWallMat);
fourteenthWallMesh.position.set(-50, 5, 0); // Center at (-50, 5, 0)
fourteenthWallMesh.receiveShadow = true; // Match platform settings
scene.add(fourteenthWallMesh);

// Create fourteenth physics wall body
const fourteenthWallBody = new CANNON.Body({
    shape: new CANNON.Box(new CANNON.Vec3(100 / 2, 10 / 2, 0.1)), // Half-extents: thickness/2, height/2, depth/2
    mass: 0 // Static body
});
fourteenthWallBody.position.set(-50, 5, 0); // Center matches mesh
fourteenthWallBody.quaternion.setFromEuler(0, -Math.PI / 2, 0);
world.addBody(fourteenthWallBody);

// Store reference for synchronization
fourteenthWallMesh.userData.physicsBody = fourteenthWallBody;

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

        // Night sky background
    scene.background = new THREE.Color(0x001133);
    
    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
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
    const ambientLight = new THREE.AmbientLight(0x404040, 0.3); // Soft gray light with low intensity
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
}

let boxBody, boxMesh;

// Key state tracking object
const keys = {};

// Add key event listeners at the module level (e.g., after imports)
document.addEventListener('keydown', (event) => {
    keys[event.code] = true;
});
document.addEventListener('keyup', (event) => {
    keys[event.code] = false;
});

// Inside addTestObjects() - remove 'const' from boxBody and boxMesh
function addTestObjects() {
    // Add a test box
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const boxMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    boxMesh = new THREE.Mesh(boxGeo, boxMat);  // Now module-level
    boxMesh.position.set(48, 3, 0);
    scene.add(boxMesh);

    // Create physics body for the box
    boxBody = new CANNON.Body({  // Now module-level
        mass: 1,
        shape: new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5))
    });
    boxBody.position.set(48, 3, 0);
    world.addBody(boxBody);

    // Store reference for synchronization
    boxMesh.userData.physicsBody = boxBody;
}

// Remove the old document.addEventListener('keydown') block entirely

// Inside updateLevel() - add movement logic here for smooth updates
export function updateLevel() {
    const timeStep = 1 / 60;
    const speed = 5;  // Adjust this for faster/slower movement
    
    // Step the physics world
    world.step(timeStep);

    // Handle movement based on key states (applied as velocity for physics)
    const velocity = new CANNON.Vec3(0, 0, 0);
    if (keys['KeyW']) velocity.z = -speed;
    if (keys['KeyS']) velocity.z = speed;
    if (keys['KeyA']) velocity.x = -speed;
    if (keys['KeyD']) velocity.x = speed;
    
    // Normalize diagonal movement (optional, prevents faster diagonals)
    if (velocity.length() > 0) {
        velocity.normalize();
        velocity.scale(speed, velocity);
    }
    
    boxBody.velocity.set(velocity.x, boxBody.velocity.y, velocity.z);  // Preserve Y velocity for gravity/jumping

    // Synchronize Three.js objects with Cannon.js bodies
    scene.traverse((object) => {
        if (object.userData.physicsBody) {
            const body = object.userData.physicsBody;
            object.position.copy(body.position);
            object.quaternion.copy(body.quaternion);
        }
    });

    // Synchronize ground
    // groundMesh.position.copy(groundBody.position);
    // groundMesh.quaternion.copy(groundBody.quaternion);

    // Update camera to follow the player (third-person style)
    const cameraOffset = new THREE.Vector3(0, 3, 5); // Behind and above player
    const targetCameraPosition = boxMesh.position.clone().add(cameraOffset);
    camera.position.copy(targetCameraPosition);
    camera.lookAt(boxMesh.position);
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
}

// Clean up the level
export function cleanupLevel() {
    // Remove any event listeners
    // Clean up any resources
    if (world) {
        // Remove all bodies from world
        while(world.bodies.length > 0) {
            world.remove(world.bodies[0]);
        }
    }
}

// Make functions available for the main game loop
window.returnToMainMenuFromLevel3 = returnCallback;

// Bullet class
// class Bullet {
//     constructor(position, direction) {
//         this.geometry = new THREE.SphereGeometry(0.1, 8, 8);
//         this.material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
//         this.mesh = new THREE.Mesh(this.geometry, this.material);
//         this.mesh.position.copy(position);
        
//         this.velocity = direction.clone().multiplyScalar(BULLET_SPEED);
//         this.distanceTraveled = 0;
//         this.active = true;
        
//         scene.add(this.mesh);
//     }
    
//     update() {
//         if (!this.active) return;
        
//         this.mesh.position.add(this.velocity);
//         this.distanceTraveled += this.velocity.length();
        
//         if (this.distanceTraveled >= BULLET_MAX_DISTANCE) {
//             this.destroy();
//         }
//     }
    
//     destroy() {
//         scene.remove(this.mesh);
//         this.active = false;
//     }
// }

// // Variables
// let scene, camera, renderer;
// let returnToMainCallback;

// // Door variables
// let doorPromptDiv; // UI element for "Press E to open"
// const DOOR_INTERACT_DISTANCE = 9; // Max distance for interaction

// // Player controls variables
// let keys = {};
// let spaceHeld = false;
// let spaceLocked = false;
// let yaw = 0;
// let pitch = 0;
// const PI_2 = Math.PI / 2;
// const MOUSE_SENS = 0.0025;

// // Physics variables
// const speed = 0.15;
// // const gravity = -0.03;
// const jumpStrength = 0.45;
// let velocityY = 0;
// const GROUND_TOLERANCE = 0;

// // Player reference
// let player;
// let prevPlayerPos = new THREE.Vector3();

// // Raycaster for camera collision and dragging
// const raycaster = new THREE.Raycaster();
// const cameraVector = new THREE.Vector3();

// // Building dimensions
// // const BUILDING_WIDTH = 30;
// // const BUILDING_DEPTH = 30;
// // const WALL_THICKNESS = 0.3;
// // const SHORT_WALL_HEIGHT = 4;
// // const HALLWAY_LENGTH = 10;
// // const HALLWAY_HEIGHT = 8;

// // Collision boxes array
// // let collisionBoxes = [];

// // Movable boxes
// let movableBoxes = [];
// const BOX_SIZE = 2;
// let dragDistance = 8; // Default distance for dragging

// // Bullets
// let bullets = [];
// const BULLET_SPEED = 1.0;
// const BULLET_MAX_DISTANCE = 50;

// // Selected box for dragging
// let selectedBox = null;
// let lastValidBoxPos = new THREE.Vector3();

// // Gap parameters for bridge puzzle
// // const GAP_WIDTH = 10;
// // const GAP_DEPTH = 8;
// // const GAP_CENTER_X = 0;
// // const GAP_CENTER_Z = -BUILDING_DEPTH / 2 + HALLWAY_LENGTH;

// // UI element for completion message
// let completionDiv;

// export function initLevel(sceneRef, cameraRef, rendererRef, labelRendererRef, callback) {
//     scene = sceneRef;
//     camera = cameraRef;
//     renderer = rendererRef;
//     labelRenderer = labelRendererRef;
//     returnToMainCallback = callback;

//     // Clear the scene
//     while(scene.children.length > 0) { 
//         scene.remove(scene.children[0]); 
//     }
    
//     // Reset control state
//     keys = {};
//     spaceHeld = false;
//     spaceLocked = false;
//     velocityY = 0;
//     yaw = 0;
//     pitch = 0;
//     selectedBox = null;
//     dragDistance = 8;
//     // prevPlayerPos.set(0, 1, BUILDING_DEPTH / 2 - 5); // Match initial player position
//     lastValidBoxPos.set(0, 0, 0);

//     setupLevel3();
//     setupLevelInput();
// }

// function setupLevel3() {
//     // collisionBoxes = [];
//     movableBoxes = [];
//     bullets = [];
    
//     // Night sky background
//     scene.background = new THREE.Color(0x001133);
    
//     // Add directional light
//     const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
//     directionalLight.position.set(10, 20, 10);
//     directionalLight.target.position.set(0, 0, 0);
//     directionalLight.castShadow = true;
//     directionalLight.shadow.mapSize.width = 2048;
//     directionalLight.shadow.mapSize.height = 2048;
//     directionalLight.shadow.camera.left = -20;
//     directionalLight.shadow.camera.right = 20;
//     directionalLight.shadow.camera.top = 20;
//     directionalLight.shadow.camera.bottom = -20;
//     directionalLight.shadow.camera.near = 0.5;
//     directionalLight.shadow.camera.far = 50;
    
//     scene.add(directionalLight);
//     scene.add(directionalLight.target);
//     console.log('Directional light added at position (10, 20, 10)');

//     // Add ambient light
//     const ambientLight = new THREE.AmbientLight(0x404040, 0.3); // Soft gray light with low intensity
//     scene.add(ambientLight);
//     console.log('Ambient light added with color 0x404040 and intensity 0.3');

//     // Enable shadow receiving on the scene
//     scene.traverse((child) => {
//         if (child.isMesh) {
//             child.receiveShadow = true;
//         }
//     });

//     // Create the building
//     createBuilding();

//     // Create player
//     const playerGeometry = new THREE.BoxGeometry(1, 1, 1);
//     const playerMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
//     player = new THREE.Mesh(playerGeometry, playerMaterial);
//     player.position.set(47.5, 1, 0.5);
//     player.name = 'player';
//     player.castShadow = true;
//     scene.add(player);

//     // UI
//     createUI();
    
//     // Set initial camera position/orientation
//     yaw = Math.PI;
//     pitch = -0.1;
//     updateCamera();
// }

// function createPuzzleElements() {
//     const boxMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 }); // Black boxes
    
//     // Box for staircase on ground floor (in front of player, toward north wall)
//     for (let i = 0; i < 1; i++) {
//         createMovableBox(-4, 1, 0, boxMaterial);
//     }
    
//     // Boxes for bridge on ground floor (near gap)
//     for (let i = 0; i < 2; i++) {
//         createMovableBox(-4 + i * 6, BOX_SIZE/2, GAP_CENTER_Z - GAP_DEPTH/2 - 2, boxMaterial);
//     }
// }

// function createGoalDoor() {
//     const goalGeometry = new THREE.BoxGeometry(3, 4, 0.2);
//     const goalMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
//     const goal = new THREE.Mesh(goalGeometry, goalMaterial);
//     goal.position.set(-50, 1, 0); // Lowered to y=1
//     goal.name = 'goal';
//     scene.add(goal);
//     console.log(`Goal door created at (${goal.position.x}, ${goal.position.y}, ${goal.position.z})`);
// }

// function createMovableBox(x, y, z, material) {
//     const boxGeometry = new THREE.BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE);
//     const box = new THREE.Mesh(boxGeometry, material);
//     box.position.set(x, y, z);
//     box.userData.isMovable = true;
//     scene.add(box);
//     movableBoxes.push(box);
//     return box;
// }

// // function createWall(x, y, z, width, height, depth, material) {
// //     const wallGeometry = new THREE.BoxGeometry(width, height, depth);
// //     const wall = new THREE.Mesh(wallGeometry, material);
// //     wall.position.set(x, y, z);
// //     scene.add(wall);
// //     addCollisionBox(wall);
// //     return wall;
// // }

// // function addCollisionBox(mesh) {
// //     const boundingBox = new THREE.Box3().setFromObject(mesh);
// //     // Add small tolerance by shrinking the collision box slightly
// //     const tolerance = 0.05;
// //     boundingBox.expandByVector(new THREE.Vector3(-tolerance, -tolerance, -tolerance));
// //     // collisionBoxes.push(boundingBox);
// // }

// function createUI() {
//     // Title
//     const titleDiv = document.createElement('div');
//     titleDiv.className = "game-ui";
//     titleDiv.textContent = 'LEVEL 3 - Gravity Puzzle';
//     titleDiv.style.cssText = `
//         color: white; font-size: 24px; font-weight: bold; position: absolute; 
//         top: 20px; left: 50%; transform: translateX(-50%); text-shadow: 2px 2px 4px black;
//         z-index: 1000; pointer-events: none;
//     `;
//     document.body.appendChild(titleDiv);

//     // Instructions
//     // const instructionsDiv = document.createElement('div');
//     // instructionsDiv.className = "game-ui";
//     // instructionsDiv.innerHTML = `
//     //     Climb the short wall, traverse the hallway, and cross the gap to reach the green door!<br>
//     //     Left-click to shoot and select a box, then drag with mouse to move it.<br>
//     //     Press F to increase distance, E to decrease, left-click or right-click to deselect and leave the box in place.<br>
//     //     Use boxes to form a staircase to climb the short wall, then a bridge across the gap.<br>
//     //     Press E to open doors when prompted.<br>
//     //     WASD: Move, Mouse: Look, Space: Jump, ESC: Pause Menu
//     // `;
//     // instructionsDiv.style.cssText = `
//     //     color: white; font-size: 16px; position: absolute; top: 60px; left: 50%; 
//     //     transform: translateX(-50%); text-align: center; text-shadow: 2px 2px 4px black;
//     //     z-index: 1000; pointer-events: none;
//     // `;
//     // document.body.appendChild(instructionsDiv);

//     // Completion message
//     completionDiv = document.createElement('div');
//     completionDiv.className = "game-ui";
//     completionDiv.textContent = 'Level Completed!';
//     completionDiv.style.cssText = `
//         color: white; font-size: 24px; font-weight: bold; position: absolute; 
//         top: 50%; left: 50%; transform: translate(-50%, -50%); text-shadow: 2px 2px 4px black;
//         z-index: 1000; pointer-events: none; display: none;
//     `;
//     document.body.appendChild(completionDiv);
//     console.log('completionDiv created');

//     // Door interaction prompt
//     doorPromptDiv = document.createElement('div');
//     doorPromptDiv.className = "game-ui";
//     doorPromptDiv.textContent = 'Press E to open';
//     doorPromptDiv.style.cssText = `
//         color: white; font-size: 18px; position: absolute; 
//         top: 60%; left: 50%; transform: translate(-50%, -50%); 
//         text-shadow: 1px 1px 2px black; z-index: 1000; 
//         pointer-events: none; display: none;
//     `;
//     document.body.appendChild(doorPromptDiv);
//     console.log('doorPromptDiv created');

//     // Crosshair
//     const crosshair = document.createElement('div');
//     crosshair.className = "game-ui";
//     crosshair.style.position = "absolute";
//     crosshair.style.top = "50%";
//     crosshair.style.left = "50%";
//     crosshair.style.width = "20px";
//     crosshair.style.height = "20px";
//     crosshair.style.marginLeft = "-10px";
//     crosshair.style.marginTop = "-10px";
//     crosshair.style.pointerEvents = "none";
//     crosshair.style.zIndex = "10";
//     crosshair.innerHTML = `
//         <div style="position:absolute;top:9px;left:0;width:20px;height:2px;background:white"></div>
//         <div style="position:absolute;top:0;left:9px;width:2px;height:20px;background:white"></div>
//     `;
//     document.body.appendChild(crosshair);
// }

// function shootBullet() {
//     const direction = new THREE.Vector3();
//     camera.getWorldDirection(direction);
//     const startPosition = camera.position.clone().add(direction.clone().multiplyScalar(1));
//     const bullet = new Bullet(startPosition, direction);
//     bullets.push(bullet);
//     console.log('Bullet fired');
// }

// function updateBullets() {
//     for (let i = bullets.length - 1; i >= 0; i--) {
//         const bullet = bullets[i];
//         if (!bullet.active) {
//             bullets.splice(i, 1);
//             continue;
//         }
//         bullet.update();
//         checkBulletCollisions(bullet, i);
//     }
// }

// function checkBulletCollisions(bullet, bulletIndex) {
//     const bulletBox = new THREE.Box3().setFromObject(bullet.mesh);
    
//     for (const box of movableBoxes) {
//         const boxBox = new THREE.Box3().setFromObject(box);
//         if (bulletBox.intersectsBox(boxBox)) {
//             if (selectedBox === box) {
//                 // Deselect if clicking the same box
//                 selectedBox = null;
//                 console.log('Box deselected');
//             } else {
//                 selectedBox = box;
//                 dragDistance = 8; // Reset to default distance
//                 lastValidBoxPos.copy(box.position);
//                 console.log('Box selected for dragging');
//             }
//             bullet.destroy();
//             bullets.splice(bulletIndex, 1);
//             break;
//         }
//     }
// }

// function updateBoxPhysics() {
//     if (!selectedBox) return;

//     // Update previous player position and calculate delta
//     const playerDelta = player.position.clone().sub(prevPlayerPos);

//     // Get camera direction
//     const direction = new THREE.Vector3();
//     camera.getWorldDirection(direction);
    
//     // Compute target position
//     const basePosition = player.position.clone().add(direction.multiplyScalar(dragDistance));
//     const targetPosition = basePosition.add(playerDelta);

//     // Clamp to level bounds
//     const MIN_HEIGHT = BOX_SIZE / 2;
//     const CEILING_HEIGHT = HALLWAY_HEIGHT + BOX_SIZE / 2;
//     const HALF_WIDTH = BUILDING_WIDTH / 2;
//     const HALF_DEPTH = (BUILDING_DEPTH + HALLWAY_LENGTH) / 2;
//     targetPosition.x = Math.max(-HALF_WIDTH + BOX_SIZE / 2, Math.min(HALF_WIDTH - BOX_SIZE / 2, targetPosition.x));
//     targetPosition.y = Math.max(MIN_HEIGHT, Math.min(CEILING_HEIGHT, targetPosition.y));
//     targetPosition.z = Math.max(-HALF_DEPTH + BOX_SIZE / 2, Math.min(HALF_DEPTH - BOX_SIZE / 2, targetPosition.z));

//     // Move box directly to target position (no collision checks during dragging)
//     selectedBox.position.copy(targetPosition);
//     lastValidBoxPos.copy(targetPosition);
//     console.log(`Box dragged to: (${targetPosition.x.toFixed(2)}, ${targetPosition.y.toFixed(2)}, ${targetPosition.z.toFixed(2)}) at distance ${dragDistance.toFixed(2)}, player delta: (${playerDelta.x.toFixed(2)}, ${playerDelta.y.toFixed(2)}, ${playerDelta.z.toFixed(2)})`);

//     // Update prevPlayerPos
//     prevPlayerPos.copy(player.position);
// }

// // function updateBoxCollision(box) {
// //     if (!box) return;
// //     const newCollisionBox = new THREE.Box3().setFromObject(box);
// //     const index = collisionBoxes.findIndex(b => {
// //         const boxPos = new THREE.Vector3();
// //         box.getWorldPosition(boxPos);
// //         return b.min.distanceTo(boxPos) < 0.1;
// //     });
    
// //     if (index > -1) {
// //         collisionBoxes[index] = newCollisionBox;
// //     } else {
// //         collisionBoxes.push(newCollisionBox);
// //     }
// // }

// function setupLevelInput() {
//     document.removeEventListener("keydown", handleKeyDown);
//     document.removeEventListener("keyup", handleKeyUp);
//     document.removeEventListener("pointerlockchange", onPointerLockChange);
//     document.removeEventListener("mousemove", onMouseMove);
//     document.removeEventListener("mousedown", onMouseDown);
    
//     document.addEventListener("keydown", handleKeyDown);
//     document.addEventListener("keyup", handleKeyUp);
//     document.addEventListener("pointerlockchange", onPointerLockChange);
//     document.addEventListener("mousemove", onMouseMove);
//     document.addEventListener("mousedown", onMouseDown);
    
//     if (document.pointerLockElement === renderer.domElement) {
//         document.addEventListener("mousemove", onMouseMove);
//     }
    
//     scene.userData.keyDownHandler = handleKeyDown;
//     scene.userData.keyUpHandler = handleKeyUp;
//     scene.userData.pointerLockHandler = onPointerLockChange;
//     scene.userData.mouseMoveHandler = onMouseMove;
//     scene.userData.mouseDownHandler = onMouseDown;

//     // Ensure pointer lock is requested
//     renderer.domElement.addEventListener("click", requestLock);
// }

// function requestLock() {
//     if (document.pointerLockElement !== renderer.domElement) {
//         renderer.domElement.requestPointerLock();
//     }
// }

// function onMouseDown(e) {
//     if (e.button === 0 && document.pointerLockElement === renderer.domElement) { // Left click
//         if (selectedBox) {
//             // Deselect and update collision box
//             console.log('Box deselected');
//             updateBoxCollision(selectedBox);
//             selectedBox = null;
//         } else {
//             shootBullet();
//         }
//     } else if (e.button === 2 && document.pointerLockElement === renderer.domElement) { // Right click
//         if (selectedBox) {
//             // Deselect and update collision box
//             console.log('Box deselected');
//             updateBoxCollision(selectedBox);
//             selectedBox = null;
//         }
//     }
// }

// function handleKeyDown(e) {
//     if (e.code === "Space") {
//         spaceHeld = true;
//     } else if (e.code === "Escape") {
//         if (window.showPauseMenu) {
//             window.showPauseMenu(3);
//         } else {
//             returnToMainCallback();
//         }
//     } else if (e.code === "KeyE") {
//         keys[e.code] = true;
//         // Check for door interaction
//         const targetedDoor = getTargetedDoor();
//         if (targetedDoor && !targetedDoor.isOpen && targetedDoor.action && !targetedDoor.animationCompleted) {
//             targetedDoor.action.play();
//             targetedDoor.isOpen = true;
//             console.log(`Door ${targetedDoor.model.name} opening (halfway)`);
//             // Remove collision box when door opens (assuming it no longer blocks)
//             // collisionBoxes = collisionBoxes.filter(box => {
//             //     const boxCenter = new THREE.Vector3();
//             //     box.getCenter(boxCenter);
//             //     return boxCenter.distanceTo(targetedDoor.model.position) > 0.1;
//             // });
//         }
//     } else if (e.code === "KeyF" && selectedBox) {
//         keys[e.code] = true;
//     } else {
//         keys[e.key.toLowerCase()] = true;
//     }
// }

// function getTargetedDoor() {
//     const direction = new THREE.Vector3();
//     camera.getWorldDirection(direction);
//     raycaster.set(camera.position, direction);
//     raycaster.far = DOOR_INTERACT_DISTANCE;

//     for (const door of doors) {
//         const intersects = raycaster.intersectObject(door.model, true);
//         if (intersects.length > 0) {
//             const distance = camera.position.distanceTo(door.model.position);
//             if (distance <= DOOR_INTERACT_DISTANCE && !door.isOpen) {
//                 return door;
//             }
//         }
//     }
//     return null;
// }

// function handleKeyUp(e) {
//     if (e.code === "Space") {
//         spaceHeld = false;
//         spaceLocked = false;
//     } else {
//         keys[e.code] = false;
//         keys[e.key.toLowerCase()] = false;
//     }
// }

// function onPointerLockChange() {
//     if (document.pointerLockElement === renderer.domElement) {
//         document.addEventListener("mousemove", onMouseMove);
//     } else {
//         document.removeEventListener("mousemove", onMouseMove);
//     }
// }

// function onMouseMove(e) {
//     yaw -= e.movementX * MOUSE_SENS;
//     pitch += e.movementY * MOUSE_SENS;
//     const maxPitch = PI_2 - 0.1;
//     const minPitch = -maxPitch;
//     pitch = Math.max(minPitch, Math.min(maxPitch, pitch));
// }

// function updatePlayer() {
//     if (!player) return;

//     const _forward = new THREE.Vector3();
//     const _right = new THREE.Vector3();
//     const _moveDir = new THREE.Vector3();
//     const STEP_UP_HEIGHT = 0.5;

//     _forward.set(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
//     _right.crossVectors(_forward, new THREE.Vector3(0, 1, 0)).normalize();

//     _moveDir.set(0, 0, 0);
//     if (keys["w"] || keys["arrowup"]) _moveDir.add(_forward);
//     if (keys["s"] || keys["arrowdown"]) _moveDir.sub(_forward);
//     if (keys["d"] || keys["arrowright"]) _moveDir.add(_right);
//     if (keys["a"] || keys["arrowleft"]) _moveDir.sub(_right);

//     if (_moveDir.lengthSq() > 0) _moveDir.normalize();

//     const prevPos = player.position.clone();
//     const groundHeight = findGroundHeight(prevPos);
//     const isGrounded = Math.abs(player.position.y - groundHeight) <= GROUND_TOLERANCE + 0.1;

//     if (isGrounded) {
//         velocityY = 0;
//         player.position.y = groundHeight;
//         if (spaceHeld && !spaceLocked) {
//             velocityY = jumpStrength;
//             spaceLocked = true;
//         }
//     }

//     velocityY += gravity;
    
//     const moveX = _moveDir.x * speed;
//     const moveZ = _moveDir.z * speed;
//     const targetX = player.position.x + moveX;
//     const targetZ = player.position.z + moveZ;

//     const newHorizontalPos = new THREE.Vector3(targetX, player.position.y, targetZ);
//     if (!checkCollision(newHorizontalPos)) {
//         player.position.x = newHorizontalPos.x;
//         player.position.z = newHorizontalPos.z;
//     } else {
//         const testUpPos = new THREE.Vector3(targetX, player.position.y + STEP_UP_HEIGHT, targetZ);
//         if (!checkCollision(testUpPos)) {
//             player.position.x = targetX;
//             player.position.z = targetZ;
//             player.position.y += STEP_UP_HEIGHT;
//         } else {
//             const tryX = new THREE.Vector3(targetX, player.position.y, player.position.z);
//             if (!checkCollision(tryX)) {
//                 player.position.x = tryX.x;
//             }
//             const tryZ = new THREE.Vector3(player.position.x, player.position.y, targetZ);
//             if (!checkCollision(tryZ)) {
//                 player.position.z = tryZ.z;
//             }
//         }
//     }

//     const newVerticalPos = player.position.y + velocityY;
//     const testPos = new THREE.Vector3(player.position.x, newVerticalPos, player.position.z);
    
//     if (!checkCollision(testPos)) {
//         player.position.y = Math.max(0.5, newVerticalPos); // Clamp to prevent falling through ground
//     } else {
//         if (velocityY > 0) {
//             velocityY = 0;
//         } else {
//             const landedHeight = findGroundHeight(player.position);
//             player.position.y = landedHeight;
//             velocityY = 0;
//             console.log(`Player landed at y=${player.position.y.toFixed(2)}, ground height=${landedHeight.toFixed(2)}`);
//         }
//     }

//     updateCamera();
// }

// function findGroundHeight(position) {
//     const playerHeight = 1;
//     const halfPlayerHeight = playerHeight / 2;
//     const rayDown = new THREE.Vector3(0, -1, 0);
//     const origin = new THREE.Vector3(position.x, position.y - halfPlayerHeight + 0.1, position.z);
//     raycaster.set(origin, rayDown);
//     raycaster.far = 5.0; // Increased to detect floor from box height

//     // Include all scene objects for raycasting (floor and boxes)
//     const intersects = raycaster.intersectObjects(scene.children.filter(obj => obj !== player && obj.name !== 'goal'), true);
//     if (intersects.length > 0) {
//         let highestGround = intersects[0];
//         for (const intersect of intersects) {
//             if (intersect.point.y > highestGround.point.y) {
//                 highestGround = intersect;
//             }
//         }
//         const groundY = highestGround.point.y + halfPlayerHeight;
//         console.log(`Raycast hit at y=${groundY.toFixed(2)} on ${highestGround.object.userData.isMovable ? 'box' : 'floor'}`);
//         return groundY;
//     }

//     // Fallback: check boxes and floor explicitly
//     const testPos = position.clone();
//     for (let y = position.y; y >= 0; y -= 0.1) {
//         testPos.y = y;
//         const testBox = new THREE.Box3().setFromCenterAndSize(
//             testPos,
//             new THREE.Vector3(0.9, playerHeight, 0.9)
//         );
        
//         for (const box of movableBoxes) {
//             const boxBox = new THREE.Box3().setFromObject(box);
//             if (testBox.intersectsBox(boxBox)) {
//                 const groundY = boxBox.max.y + halfPlayerHeight;
//                 console.log(`Fallback ground at y=${groundY.toFixed(2)} on box`);
//                 return groundY;
//             }
//         }
        
//         // Check floor
//         // for (const collisionBox of collisionBoxes) {
//         //     if (testBox.intersectsBox(collisionBox)) {
//         //         const groundY = collisionBox.max.y + halfPlayerHeight;
//         //         console.log(`Fallback ground at y=${groundY.toFixed(2)} on floor`);
//         //         return groundY;
//         //     }
//         // }
        
//         if (y <= halfPlayerHeight) {
//             console.log('No ground detected, clamping to y=0.5');
//             return halfPlayerHeight; // Clamp to ground level
//         }
//     }
    
//     console.log('No ground detected, clamping to y=0.5');
//     return halfPlayerHeight;
// }

// function checkCollision(position) {
//     const testBox = new THREE.Box3().setFromCenterAndSize(
//         position,
//         new THREE.Vector3(0.9, 0.9, 0.9)
//     );
    
//     // Check collisions with walls, floor, and all boxes
//     for (const box of collisionBoxes) {
//         if (testBox.intersectsBox(box)) {
//             console.log('Player movement blocked by collision box');
//             return true;
//         }
//     }
//     return false;
// }

// function updateCamera() {
//     const cameraDistance = 8;
//     const cameraHeightOffset = 1.8;
//     const aimHeightOffset = 1.5;
//     const cosPitch = Math.cos(pitch);

//     const targetPos = new THREE.Vector3(
//         player.position.x - Math.sin(yaw) * cameraDistance * cosPitch,
//         player.position.y + Math.sin(pitch) * cameraDistance + cameraHeightOffset,
//         player.position.z - Math.cos(yaw) * cameraDistance * cosPitch
//     );

//     const playerCenterWithOffset = player.position.clone().setY(player.position.y + aimHeightOffset);
//     cameraVector.subVectors(targetPos, playerCenterWithOffset).normalize();
    
//     raycaster.set(playerCenterWithOffset, cameraVector);
//     raycaster.far = targetPos.distanceTo(playerCenterWithOffset);
//     const obstacles = scene.children.filter(obj => obj.name !== 'player' && obj.name !== 'goal');
//     const intersects = raycaster.intersectObjects(obstacles, true);

//     if (intersects.length > 0) {
//         const intersection = intersects[0];
//         const actualDistance = intersection.distance - 0.2;
//         camera.position.copy(playerCenterWithOffset);
//         camera.position.addScaledVector(cameraVector, actualDistance);
//     } else {
//         camera.position.copy(targetPos);
//     }

//     camera.lookAt(
//         player.position.x,
//         player.position.y + aimHeightOffset,
//         player.position.z
//     );
// }

// function checkGoal() {
//     const playerBox = new THREE.Box3().setFromObject(player);
//     const goal = scene.getObjectByName('goal');
    
//     if (goal) {
//         console.log('Goal found');
//         const goalBox = new THREE.Box3().setFromObject(goal);
//         goalBox.expandByVector(new THREE.Vector3(0.1, 0.1, 0.1)); // Add tolerance
//         console.log(`Player box: min=(${playerBox.min.x.toFixed(2)}, ${playerBox.min.y.toFixed(2)}, ${playerBox.min.z.toFixed(2)}), max=(${playerBox.max.x.toFixed(2)}, ${playerBox.max.y.toFixed(2)}, ${playerBox.max.z.toFixed(2)})`);
//         console.log(`Goal box: min=(${goalBox.min.x.toFixed(2)}, ${goalBox.min.y.toFixed(2)}, ${goalBox.min.z.toFixed(2)}), max=(${goalBox.max.x.toFixed(2)}, ${goalBox.max.y.toFixed(2)}, ${goalBox.max.z.toFixed(2)})`);
//         if (playerBox.intersectsBox(goalBox)) {
//             console.log('Intersection: true, displaying completion message');
//             completionDiv.style.display = 'block';
//             setTimeout(() => {
//                 console.log('Returning to main menu');
//                 returnToMainCallback();
//             }, 2000); // Return to main menu after 2 seconds
//         } else {
//             console.log('Intersection: false');
//         }
//     } else {
//         console.log('Goal not found in scene');
//     }
// }

// export function updateLevel() {
//     world.step(timeStep);
//     if (window.__stats) window.__stats.begin();
//     // Update drag distance if F or E is pressed
//     if (selectedBox) {
//         if (keys["KeyF"]) {
//             dragDistance = Math.min(dragDistance + 0.5, 12);
//             console.log(`Drag distance increased to: ${dragDistance.toFixed(2)}`);
//         } else if (keys["KeyE"]) {
//             dragDistance = Math.max(dragDistance - 0.5, 2);
//             console.log(`Drag distance decreased to: ${dragDistance.toFixed(2)}`);
//         }
//     }
    
//     // Update door animations
//     const delta = 1 / 60; // Assuming 60 FPS for animation updates
//     doors.forEach(door => {
//         if (door.mixer && door.action && !door.animationCompleted) {
//             // Check if animation has reached halfway point
//             if (door.action.time >= door.model.userData.halfDuration) {
//                 // Stop the animation at halfway point
//                 door.action.paused = true;
//                 door.animationCompleted = true;
//                 console.log(`Door ${door.model.name} animation frozen at halfway point`);
//             } else {
//                 // Continue playing animation
//                 door.mixer.update(delta);
//             }
//         } else if (door.mixer && !door.action) {
//             // For doors without specific actions, just update normally
//             door.mixer.update(delta);
//         }
//     });

//     // Check for door interaction prompt
//     const targetedDoor = getTargetedDoor();
//     doorPromptDiv.style.display = targetedDoor ? 'block' : 'none';
    
//     // Rebuild collisionBoxes with all relevant scene objects
//     // collisionBoxes = [];
//     // scene.children.forEach(obj => {
//     //     if (obj.isMesh && obj.name !== 'player' && obj.name !== 'goal' && !obj.userData.isMovable && !obj.name.startsWith('door_')) {
//     //         addCollisionBox(obj);
//     //     }
//     // });
//     // Add movable boxes and closed doors to collisionBoxes
//     // movableBoxes.forEach(box => {
//     //     addCollisionBox(box);
//     // });
//     doors.forEach(door => {
//         if (!door.isOpen) {
//             door.model.traverse(child => {
//                 // if (child.isMesh) {
//                 //     addCollisionBox(child);
//                 // }
//             });
//         }
//     });
    
//     updatePlayer();
//     updateBullets();
//     updateBoxPhysics();
//     checkGoal();
//     if (window.__stats) window.__stats.end();
// }

// export function cleanupLevel() {
//     const uiElements = document.querySelectorAll('.game-ui');
//     uiElements.forEach(el => {
//         const isMainMenuElement = el.closest('#main-menu, #play-submenu, #level-select, #settings, #credits, #instructions, #pause-menu');
//         if (!isMainMenuElement) {
//             el.remove();
//         }
//     });
    
//     document.removeEventListener("keydown", handleKeyDown);
//     document.removeEventListener("keyup", handleKeyUp);
//     document.removeEventListener("pointerlockchange", onPointerLockChange);
//     document.removeEventListener("mousemove", onMouseMove);
//     document.removeEventListener("mousedown", onMouseDown);
    
//     if (renderer && renderer.domElement) {
//         renderer.domElement.removeEventListener("click", requestLock);
//     }
    
//     // collisionBoxes = [];
//     movableBoxes = [];
//     bullets = [];
//     doors = []; // Clear doors array
//     selectedBox = null;
//     dragDistance = 8;
// }