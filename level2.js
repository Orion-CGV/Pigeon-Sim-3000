// level2.js - City Racing Level (Improved)
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scene, camera, renderer, labelRenderer;
let returnToMainCallback;

// Player controls variables
let keys = {};
let spaceHeld = false;
let spaceLocked = false;
let yaw = 0;
let pitch = 0;
let cameraYaw = 0; // Camera horizontal offset from car
let cameraPitch = 0; // Camera vertical offset from car
const PI_2 = Math.PI / 2;
const MOUSE_SENS = 0.0025;

// Physics variables
const WALK_SPEED = 0.15;
const DRIVE_SPEED = 2.75; // Increased from 0.15 for more reasonable speed
const gravity = -0.03;
const jumpStrength = 0.45;
let velocityY = 0;

// Player reference
let player;

// Driving system variables
let isDriving = true; // Always in driving mode
let driveKeyLocked = false;

// Collision objects
let collisionBoxes = []; 

// Car model
let carModel = null;
let carLoaded = false;
let currentCarIndex = 0;

// Audio system
let audioListener = null;
let engineSound = null;
let isEngineRunning = false;

// Texture tracking
let currentTextureIndex = 0;

// Car physics
let carRotation = 0;
const TURN_SPEED = 0.04;
const CAR_ACCELERATION = 0.005; // Reduced from 0.02 for more gradual acceleration
let currentSpeed = 0;

// Building model
let buildingModel = null;
let buildingLoaded = false;

// Check points
const checkpoints = [];
let currentCheckpoint = null;
let totalCheckpoints = 0;
let checkpointsPassed = 0;
let goalUnlocked = false;

// Traffic cars - obstacles
const trafficCars = [];

// Lanes x,y
const lanes = {
    horizontal: [],
    vertical: []
};

// Respawn data points
let lastCheckpointIndex = -1; // -1 = start
let respawnPosition = new THREE.Vector3(0, 0.1, 0);
let respawnRotation = 0;


// Available cars data
const availableCars = [
    { 
        id: 'car01', 
        name: 'Classic Sedan', 
        obj: 'car01.obj', 
        mtl: 'car01.mtl',
        textures: ['car.png', 'car_blue.png', 'car_gray.png', 'car_red.png', 'car_snow.png', 'car_snow_blue.png', 'car_snow_gray.png', 'car_snow_red.png', 'car_snowcovered.png', 'car_snowcovered_blue.png', 'car_snowcovered_gray.png', 'car_snowcovered_red.png']
    },
    { 
        id: 'car02', 
        name: 'Sports Car', 
        obj: 'car02.obj', 
        mtl: 'car02.mtl',
        textures: ['car2.png', 'car2_black.png', 'car2_red.png']
    },
    { 
        id: 'car03', 
        name: 'Compact Car', 
        obj: 'car03.obj', 
        mtl: 'car03.mtl',
        textures: ['car3.png', 'car3_red.png', 'car3_yellow.png']
    },
    { 
        id: 'car04', 
        name: 'Modern Sedan', 
        obj: 'car04.obj', 
        mtl: 'car04.mtl',
        textures: ['car4.png', 'car4_grey.png', 'car4_lightgrey.png', 'car4_lightorange.png']
    },
    { 
        id: 'car05', 
        name: 'Police/Taxi Car', 
        obj: 'car05.obj', 
        mtl: 'car05.mtl',
        textures: ['car5.png', 'car5_green.png', 'car5_grey.png', 'car5_police.png', 'car5_police_la.png', 'car5_taxi.png']
    },
    { 
        id: 'car06', 
        name: 'Utility Vehicle', 
        obj: 'car06.obj', 
        mtl: 'car06.mtl',
        textures: ['car6.png']
    },
    { 
        id: 'car07', 
        name: 'Luxury Car', 
        obj: 'car07.obj', 
        mtl: 'car07.mtl',
        textures: ['car7.png', 'car7_black.png', 'car7_brown.png', 'car7_green.png', 'car7_grey.png', 'car7_red.png']
    },
    { 
        id: 'car08', 
        name: 'Delivery Van', 
        obj: 'car08.obj', 
        mtl: 'car08.mtl',
        textures: ['Car8.png', 'Car8_grey.png', 'Car8_mail.png', 'Car8_purple.png']
    }
];

export function initLevel(sceneRef, cameraRef, rendererRef, labelRendererRef, callback) {
    
    if (!sceneRef) {
        console.error('sceneRef is undefined!');
        return;
    }
    if (!cameraRef) {
        console.error('cameraRef is undefined!');
        return;
    }
    if (!rendererRef) {
        console.error('rendererRef is undefined!');
        return;
    }
    if (!labelRendererRef) {
        console.error('labelRendererRef is undefined!');
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
    
    // Reset control state
    keys = {};
    spaceHeld = false;
    spaceLocked = false;
    velocityY = 0;
    isDriving = true; // Always start in driving mode
    driveKeyLocked = false;
    currentSpeed = 0;
    
    // Reset camera orientation
    yaw = 0;
    pitch = 0;
    cameraYaw = 0;
    cameraPitch = 0;

    setupLevel2();
    setupLevelInput();
    setupAudio();
}

function setupLevel2() {
    collisionBoxes = [];
    
    // Sky background
    scene.background = new THREE.Color(0x87CEEB);
    
    // Large ground
    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    const groundMaterial = new THREE.MeshLambertMaterial({ 
        color: 0x2d5a2d, 
        side: THREE.DoubleSide 
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);

    // Load building model first, then car model
    loadBuildingModel();
    
    // Load car model, then create player
    loadCarModel();

    // Create roads
    createRoads();

    // Goal area
    const goalGeometry = new THREE.BoxGeometry(8, 2, 8);
    const goalMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.7 });
    const goal = new THREE.Mesh(goalGeometry, goalMaterial);
    goal.position.set(80, 1, 80);
    goal.name = 'goal';
    scene.add(goal);

    // Enhanced lighting
    setupRealisticLighting();

    // UI
    createUI();
    
    // Initial camera position
    camera.position.set(0, 10, 15);
    camera.lookAt(0, 0, 0);
    
    // Initialize yaw based on initial camera position
    yaw = Math.atan2(camera.position.x, camera.position.z);
}

function setupRealisticLighting() {
    if (!renderer) {
        console.error('Renderer is undefined in setupRealisticLighting!');
        return;
    }
    
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x87CEEB, 0.4);
    scene.add(ambientLight);
    
    // Main directional light (sun)
    const sunLight = new THREE.DirectionalLight(0xFFE4B5, 1.2);
    sunLight.position.set(100, 80, 50);
    sunLight.target.position.set(0, 0, 0);
    
    // Configure shadows
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 200;
    sunLight.shadow.camera.left = -100;
    sunLight.shadow.camera.right = 100;
    sunLight.shadow.camera.top = 100;
    sunLight.shadow.camera.bottom = -100;
    sunLight.shadow.bias = -0.0001;
    
    scene.add(sunLight);
    scene.add(sunLight.target);
    
    // Fill light
    const fillLight = new THREE.DirectionalLight(0x87CEEB, 0.3);
    fillLight.position.set(-50, 40, -30);
    fillLight.target.position.set(0, 0, 0);
    scene.add(fillLight);
    scene.add(fillLight.target);
    
    // Hemisphere light
    const hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0x2d5a2d, 0.6);
    scene.add(hemisphereLight);
}

function loadCarModel(carIndex = 0) {
    if (carIndex >= availableCars.length) {
        console.error('Invalid car index:', carIndex);
        createFallbackPlayer();
        return;
    }

    const selectedCar = availableCars[carIndex];
    const mtlLoader = new MTLLoader();
    const objLoader = new OBJLoader();
    
    console.log(`Loading car: ${selectedCar.name}`);
    
    // Load material file first
    mtlLoader.load(`assets/models/cars/${selectedCar.mtl}`, (materials) => {
        materials.preload();
        objLoader.setMaterials(materials);
        
        // Load the car model
        objLoader.load(`assets/models/cars/${selectedCar.obj}`, (object) => {
            carModel = object;
            carLoaded = true;
            
            // Scale and position the car
            carModel.scale.set(0.5, 0.5, 0.5);
            carModel.position.set(0, 0.1, 0); // Much lower position to sit properly on ground
            carModel.name = 'player';
            
            // Enable shadows for the car
            carModel.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            
            // Use the car model directly as the player
            player = carModel;
            scene.add(player);
            
            // Apply initial texture
            applyInitialTexture();
            
        }, undefined, (error) => {
            console.error('Error loading car model:', error);
            createFallbackPlayer();
        });
    }, undefined, (error) => {
        console.error('Error loading car materials:', error);
        createFallbackPlayer();
    });
}

function createFallbackPlayer() {
    const playerGeometry = new THREE.BoxGeometry(2, 1, 4);
    const playerMaterial = new THREE.MeshLambertMaterial({ 
        color: 0x333333
    });
    player = new THREE.Mesh(playerGeometry, playerMaterial);
    player.position.set(0, 0.1, 0); // Much lower position to sit properly on ground
    player.name = 'player';
    player.castShadow = true;
    player.receiveShadow = true;
    scene.add(player);
    carLoaded = true;
    console.log('Fallback car player created');
}

function loadBuildingModel() {
    // For now, use fallback buildings
    generateSkyscrapersFallback();
}

function generateSkyscrapersFallback() {
    console.log('Using fallback cube buildings...');
    const buildingColors = [
        0x666666, 0x777777, 0x888888, 0x999999, 
        0x555555, 0x444444, 0x333333, 0x222222
    ];
    
    // Create buildings with proper spacing
    for (let x = -80; x <= 80; x += 25) {
        for (let z = -80; z <= 80; z += 25) {
            // Skip center area for driving space
            if (Math.abs(x) < 30 && Math.abs(z) < 30) continue;
            
            // Add some randomness
            if (Math.random() < 0.2) continue;
            
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
    const material = new THREE.MeshLambertMaterial({ color: color });
    const building = new THREE.Mesh(geometry, material);
    
    // Position building so its bottom is at ground level
    building.position.set(x, y + height/2, z);
    
    // Enable shadows
    building.castShadow = true;
    building.receiveShadow = true;
    
    // Store collision box
    const boundingBox = new THREE.Box3().setFromObject(building);
    collisionBoxes.push(boundingBox);
    
    scene.add(building);
    return building;
}

function createRoads() {
    const roadMaterial = new THREE.MeshLambertMaterial({ 
        color: 0x333333, 
        side: THREE.DoubleSide 
    });
    const lineMaterial = new THREE.MeshLambertMaterial({ 
        color: 0xffff00, 
        side: THREE.DoubleSide 
    });
    
    // Main roads
    for (let x = -90; x <= 90; x += 30) {
        const roadGeometry = new THREE.PlaneGeometry(8, 200);
        const road = new THREE.Mesh(roadGeometry, roadMaterial);
        road.rotation.x = -Math.PI / 2;
        road.position.set(x, 0.1, 0);
        road.receiveShadow = true;
        scene.add(road);
    }
    
    for (let z = -90; z <= 90; z += 30) {
        const roadGeometry = new THREE.PlaneGeometry(200, 8);
        const road = new THREE.Mesh(roadGeometry, roadMaterial);
        road.rotation.x = -Math.PI / 2;
        road.position.set(0, 0.1, z);
        road.receiveShadow = true;
        scene.add(road);
    }
    
    // Road lines
    for (let x = -90; x <= 90; x += 30) {
        for (let z = -95; z <= 95; z += 10) {
            const lineGeometry = new THREE.PlaneGeometry(0.5, 2);
            const line = new THREE.Mesh(lineGeometry, lineMaterial);
            line.rotation.x = -Math.PI / 2;
            line.position.set(x, 0.11, z);
            scene.add(line);
        }
    }
    
    for (let z = -90; z <= 90; z += 30) {
        for (let x = -95; x <= 95; x += 10) {
            const lineGeometry = new THREE.PlaneGeometry(2, 0.5);
            const line = new THREE.Mesh(lineGeometry, lineMaterial);
            line.rotation.x = -Math.PI / 2;
            line.position.set(x, 0.11, z);
            scene.add(line);
        }
    }

    // Record lane centers for spawning traffic
    // vertical lanes are the x coords where we created plane roads earlier (every 30)
    for (let x = -90; x <= 90; x += 30) lanes.vertical.push(x);
    // horizontal lanes are the z coords
    for (let z = -90; z <= 90; z += 30) lanes.horizontal.push(z);

    // Create checkpoints along a main route (example positions) — you can tweak positions
    createCheckpoints();
    updateCheckpointDisplay();

    // Spawn traffic obstacles in lanes
    // spawnTraffic();

}

// function spawnTraffic() {
//     // Remove old traffic
//     trafficCars.forEach(tc => scene.remove(tc.mesh));
//     trafficCars.length = 0;

//     // Helper to load and clone a car model
//     function createTrafficCarModel(carIndex, callback) {
//         const selectedCar = availableCars[carIndex];
//         const mtlLoader = new MTLLoader();
//         const objLoader = new OBJLoader();

//         mtlLoader.load(`assets/models/cars/${selectedCar.mtl}`, (materials) => {
//             materials.preload();
//             objLoader.setMaterials(materials);

//             objLoader.load(`assets/models/cars/${selectedCar.obj}`, (object) => {
//                 object.scale.set(0.5, 0.5, 0.5);
//                 object.traverse((child) => {
//                     if (child.isMesh) {
//                         child.castShadow = true;
//                         child.receiveShadow = true;
//                     }
//                 });
//                 callback(object);
//             }, undefined, () => {
//                 // fallback to box if model fails
//                 const mesh = new THREE.Mesh(
//                     new THREE.BoxGeometry(2, 1, 4),
//                     new THREE.MeshLambertMaterial({ color: 0xff3333 })
//                 );
//                 callback(mesh);
//             });
//         }, undefined, () => {
//             // fallback to box if materials fail
//             const mesh = new THREE.Mesh(
//                 new THREE.BoxGeometry(2, 1, 4),
//                 new THREE.MeshLambertMaterial({ color: 0xff3333 })
//             );
//             callback(mesh);
//         });
//     }

//     // Spawn a few cars per lane (both vertical and horizontal lanes)
//     const carsPerLane = 2;
//     const trafficCarIndices = [1, 2, 3, 4, 5, 6, 7]; // Use different car models for variety

//     lanes.vertical.forEach((x, laneIndex) => {
//         if (Math.abs(x) < 15) return;
//         for (let i = 0; i < carsPerLane; i++) {
//             const carIndex = trafficCarIndices[(laneIndex + i) % trafficCarIndices.length];
//             createTrafficCarModel(carIndex, (mesh) => {
//                 // place at varying z positions
//                 const z = -80 + Math.random() * 160;
//                 mesh.position.set(x, 0.5, z);
//                 mesh.rotation.y = 0; // driving along z axis
//                 scene.add(mesh);

//                 trafficCars.push({
//                     mesh,
//                     laneIndex,
//                     orientation: 'vertical', // moves along z
//                     speed: 0.4 + Math.random() * 0.8,
//                     dir: Math.random() < 0.5 ? 1 : -1,
//                     bbox: new THREE.Box3().setFromObject(mesh)
//                 });
//             });
//         }
//     });

//     lanes.horizontal.forEach((z, laneIndex) => {
//         if (Math.abs(z) < 15) return;
//         for (let i = 0; i < carsPerLane; i++) {
//             const carIndex = trafficCarIndices[(laneIndex + i) % trafficCarIndices.length];
//             createTrafficCarModel(carIndex, (mesh) => {
//                 const x = -80 + Math.random() * 160;
//                 mesh.position.set(x, 0.5, z);
//                 mesh.rotation.y = Math.PI / 2; // driving along x axis
//                 scene.add(mesh);

//                 trafficCars.push({
//                     mesh,
//                     laneIndex,
//                     orientation: 'horizontal', // moves along x
//                     speed: 0.4 + Math.random() * 0.8,
//                     dir: Math.random() < 0.5 ? 1 : -1,
//                     bbox: new THREE.Box3().setFromObject(mesh)
//                 });
//             });
//         }
//     });
// }

function updateTraffic() {
    // Move traffic and update bounding boxes
    for (const tc of trafficCars) {
        if (!tc.mesh) continue;

        if (tc.orientation === 'vertical') {
            tc.mesh.position.z += tc.speed * tc.dir;
            // Reverse at ends
            if (tc.mesh.position.z > 95) tc.dir = -1;
            if (tc.mesh.position.z < -95) tc.dir = 1;
        } else {
            tc.mesh.position.x += tc.speed * tc.dir;
            if (tc.mesh.position.x > 95) tc.dir = -1;
            if (tc.mesh.position.x < -95) tc.dir = 1;
        }

        tc.bbox.setFromObject(tc.mesh);

        // Optional: small bob or rotation for variety
        tc.mesh.rotation.y += Math.sin(performance.now() * 0.0005 + tc.mesh.position.x) * 0.0005;
    }
}

function createCheckpoints() {
    // Clear previous
    checkpoints.forEach(cp => scene.remove(cp.mesh));
    checkpoints.length = 0;
    lastCheckpointIndex = -1;
    respawnPosition.set(0, 0.1, 0);
    respawnRotation = 0;
    checkpointsPassed = 0;
    goalUnlocked = false;

    // Example checkpoint path — you can adjust or generate procedurally
    const cpPositions = [
        new THREE.Vector3(0, 0.1, 0),       // start
        new THREE.Vector3(0, 0.1, 25),
        new THREE.Vector3(30, 0.1, 0),
        new THREE.Vector3(30, 0.1, 40),
        new THREE.Vector3(60, 0.1, 40),
        new THREE.Vector3(80, 0.1, 70)      // near goal
    ];

    const geo = new THREE.TorusGeometry(3, 0.2, 16, 100);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.8 });

    cpPositions.forEach((pos, i) => {
        const mesh = new THREE.Mesh(geo, mat.clone());
        mesh.position.copy(pos);
        mesh.rotation.x = Math.PI / 2;
        mesh.name = `checkpoint_${i}`;
        scene.add(mesh);
        const box = new THREE.Box3().setFromObject(mesh);
        checkpoints.push({ mesh, index: i, box, passed: false });

        // Save start as initial respawn
        if (i === 0) {
            lastCheckpointIndex = 0;
            respawnPosition.copy(pos);
            respawnRotation = 0;
            checkpoints[0].mesh.material.color.set(0x00ff00); // show start as "passed"
            checkpoints[0].passed = true;
        }
    });

    totalCheckpoints = checkpoints.length;
    console.log(`Created ${totalCheckpoints} checkpoints`);

}

function spawnParticles(position) {
    const count = 60; // number of particles
    const positions = new Float32Array(count * 3);
    const speeds = [];

    // randomize starting positions & velocities
    for (let i = 0; i < count; i++) {
        positions[i * 3] = position.x + (Math.random() - 0.5) * 1.5;
        positions[i * 3 + 1] = position.y + (Math.random() - 0.5) * 1.5;
        positions[i * 3 + 2] = position.z + (Math.random() - 0.5) * 1.5;
        speeds.push(
            new THREE.Vector3(
                (Math.random() - 0.5) * 0.1,
                Math.random() * 0.1,
                (Math.random() - 0.5) * 0.1
            )
        );
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
        color: 0x00ff99,
        size: 0.15,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // animate burst fade + movement
    const start = performance.now();
    const duration = 1000; // ms

    function animateBurst() {
        const elapsed = performance.now() - start;
        const positions = particles.geometry.attributes.position.array;

        for (let i = 0; i < count; i++) {
            const speed = speeds[i];
            positions[i * 3] += speed.x;
            positions[i * 3 + 1] += speed.y;
            positions[i * 3 + 2] += speed.z;
            // gravity
            speed.y -= 0.003;
        }

        particles.geometry.attributes.position.needsUpdate = true;
        material.opacity = 1 - elapsed / duration;

        if (elapsed < duration) {
            requestAnimationFrame(animateBurst);
        } else {
            scene.remove(particles);
            particles.geometry.dispose();
            particles.material.dispose();
        }
    }

    animateBurst();
}


function checkCheckpointCollision() {
    if (!player) return;
    const playerBox = new THREE.Box3().setFromObject(player);

    for (const cp of checkpoints) {
        if (!cp) continue;
        const cpBox = new THREE.Box3().setFromObject(cp.mesh);
        if (playerBox.intersectsBox(cpBox) && !cp.passed) {
            // Mark checkpoint passed
            cp.passed = true;
            cp.mesh.material.color.set(0x00ff00);
            lastCheckpointIndex = cp.index;
            respawnPosition.copy(cp.mesh.position);
            respawnPosition.y = 0.1;
            checkpointsPassed++; // Increment the checkpoints passed

            // align direction to face forward toward next checkpoint if available
            const next = checkpoints.find(c => c.index === cp.index + 1);
            if (next) {
                // compute rotation toward next
                const dir = new THREE.Vector3().subVectors(next.mesh.position, cp.mesh.position).normalize();
                respawnRotation = Math.atan2(dir.x, dir.z);
            }
            // nice feedback
            spawnParticles(cp.mesh.position);
            updateCheckpointDisplay();

            // check if all checkpoints passed to unlock goal
            if(checkpointsPassed === totalCheckpoints - 1) {
                unlockGoal();
            }
            break;
        }
    }
}

function unlockGoal() {
    goalUnlocked = true;
    const goal = scene.getObjectByName('goal');
    if (goal) {
        goal.material.color.set(0x0000ff); // change color to indicate unlocked
        spawnParticles(goal.position);
    }

}

function updateCheckpointDisplay() {
    let el = document.getElementById("checkpointDisplay");
    if (!el) {
        el = document.createElement("div");
        el.id = "checkpointDisplay";
        el.style.position = "absolute";
        el.style.top = "40px";
        el.style.left = "10px";
        el.style.color = "#0f0";
        el.style.fontFamily = "monospace";
        el.style.fontSize = "14px";
        document.body.appendChild(el);
    }
    el.innerText = `Checkpoints: ${checkpointsPassed}/${totalCheckpoints - 1}`;
}

function handleCrash() {
    // Respawn at last checkpoint (or start)
    if (!player) return;
    player.position.copy(respawnPosition);
    player.rotation.y = respawnRotation || 0;
    currentSpeed = 0;
    // small camera bump / flash feedback
    updateSpeedDisplay();
    // optional particle or sound
    spawnParticles(player.position);
}



function createUI() {
    // Title
    const titleDiv = document.createElement('div');
    titleDiv.className = "game-ui"; 
    titleDiv.textContent = 'LEVEL 2 - City Racing';
    titleDiv.style.cssText = `
        color: white; font-size: 24px; font-weight: bold; position: absolute; 
        top: 20px; left: 50%; transform: translateX(-50%); text-shadow: 2px 2px 4px black;
        z-index: 1000; pointer-events: none;
    `;
    document.body.appendChild(titleDiv);

    // Car selection display
    const carInfoDiv = document.createElement('div');
    carInfoDiv.className = "game-ui";
    carInfoDiv.id = "car-info";
    carInfoDiv.style.cssText = `
        color: white; font-size: 16px; position: absolute; top: 60px; left: 20px; 
        text-shadow: 2px 2px 4px black; background: rgba(0,0,0,0.7); padding: 10px; border-radius: 5px;
        z-index: 1000; pointer-events: none;
    `;
    document.body.appendChild(carInfoDiv);

    // Texture selection display
    const textureInfoDiv = document.createElement('div');
    textureInfoDiv.className = "game-ui";
    textureInfoDiv.id = "texture-info";
    textureInfoDiv.style.cssText = `
        color: white; font-size: 16px; position: absolute; top: 120px; left: 20px; 
        text-shadow: 2px 2px 4px black; background: rgba(0,0,0,0.7); padding: 10px; border-radius: 5px;
        z-index: 1000; pointer-events: none;
    `;
    document.body.appendChild(textureInfoDiv);

    // Update displays
    updateCarInfo();
    updateTextureInfo();

    // Instructions
    const instructionsDiv = document.createElement('div');
    instructionsDiv.className = "game-ui";
    instructionsDiv.innerHTML = 'Drive to the green goal!<br>W/S: Accelerate/Brake, A/D: Steer, Space: Handbrake<br>Q/R: Switch Car, T/Y: Switch Color, E: Engine Sound, C: Reset Camera, ESC: Pause Menu';
    instructionsDiv.style.cssText = `
        color: white; font-size: 16px; position: absolute; bottom: 20px; left: 50%; 
        transform: translateX(-50%); text-align: center; text-shadow: 2px 2px 4px black;
        background: rgba(0,0,0,0.7); padding: 10px; border-radius: 5px;
        z-index: 1000; pointer-events: none;
    `;
    document.body.appendChild(instructionsDiv);

    // Driving status indicator
    const driveStatusDiv = document.createElement('div');
    driveStatusDiv.className = "game-ui";
    driveStatusDiv.id = "drive-status";
    driveStatusDiv.textContent = 'Drive Mode: ON';
    driveStatusDiv.style.cssText = `
        color: #00ff00; font-size: 18px; position: absolute; top: 60px; right: 20px; 
        text-shadow: 2px 2px 4px black; background: rgba(0,0,0,0.7); padding: 10px; border-radius: 5px;
        z-index: 1000; pointer-events: none;
    `;
    document.body.appendChild(driveStatusDiv);

    // Speed indicator
    const speedDiv = document.createElement('div');
    speedDiv.className = "game-ui";
    speedDiv.id = "speed-display";
    speedDiv.textContent = 'Speed: 0 km/h';
    speedDiv.style.cssText = `
        color: white; font-size: 18px; position: absolute; top: 100px; right: 20px; 
        text-shadow: 2px 2px 4px black; background: rgba(0,0,0,0.7); padding: 10px; border-radius: 5px;
        z-index: 1000; pointer-events: none;
    `;
    document.body.appendChild(speedDiv);
}

function updateDriveStatus() {
    const driveStatusDiv = document.getElementById('drive-status');
    if (driveStatusDiv) {
        driveStatusDiv.textContent = 'Drive Mode: ON';
        driveStatusDiv.style.color = '#00ff00';
    }
}

function updateSpeedDisplay() {
    const speedDiv = document.getElementById('speed-display');
    if (speedDiv && isDriving) {
        const speedKmh = Math.abs(currentSpeed * 80).toFixed(0); // Convert to km/h (roughly 1.6x mph)
        speedDiv.textContent = `Speed: ${speedKmh} km/h`;
        speedDiv.style.color = currentSpeed > 0.1 ? '#ff4444' : 'white'; // Adjusted threshold for new speed scale
    } else if (speedDiv) {
        speedDiv.textContent = 'Speed: 0 km/h';
        speedDiv.style.color = 'white';
    }
}

function switchCar(newCarIndex) {
    if (newCarIndex === currentCarIndex || newCarIndex >= availableCars.length) {
        return;
    }
    
    console.log(`Switching from car ${currentCarIndex} to car ${newCarIndex}`);
    
    // Remove old car model from scene
    if (player) {
        scene.remove(player);
        player = null;
    }
    
    // Reset car loaded state
    carLoaded = false;
    carModel = null;
    currentCarIndex = newCarIndex;
    currentTextureIndex = 0;
    
    // Update displays
    updateCarInfo();
    updateTextureInfo();
    
    // Load new car model
    loadCarModel(newCarIndex);
}

function updateCarInfo() {
    const carInfoDiv = document.getElementById('car-info');
    if (!carInfoDiv) return;
    
    const currentCar = availableCars[currentCarIndex];
    if (currentCar) {
        carInfoDiv.innerHTML = `
            <div><strong>Car:</strong> ${currentCar.name}</div>
            <div><strong>Q/R:</strong> Switch Car</div>
        `;
    }
}

function updateTextureInfo() {
    const textureInfoDiv = document.getElementById('texture-info');
    if (!textureInfoDiv) return;
    
    const currentCar = availableCars[currentCarIndex];
    if (currentCar && currentCar.textures) {
        const currentTexture = currentCar.textures[currentTextureIndex];
        const textureName = currentTexture.replace('.png', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        textureInfoDiv.innerHTML = `
            <div><strong>Color:</strong> ${textureName}</div>
            <div><strong>T/Y:</strong> Switch Color</div>
        `;
    }
}

function getCurrentTextureIndex() {
    return currentTextureIndex;
}

function applyInitialTexture() {
    if (!carModel || !availableCars[currentCarIndex]) return;
    
    const currentCar = availableCars[currentCarIndex];
    if (!currentCar.textures || currentCar.textures.length === 0) return;
    
    switchTexture(currentTextureIndex);
}

function switchTexture(textureIndex) {
    if (!carModel || !availableCars[currentCarIndex]) return;
    
    const currentCar = availableCars[currentCarIndex];
    if (textureIndex >= currentCar.textures.length) return;
    
    currentTextureIndex = textureIndex;
    const textureName = currentCar.textures[textureIndex];
    
    // Update display
    updateTextureInfo();
    
    // Load and apply new texture
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(`assets/textures/cars/${textureName}`, (texture) => {
        // Apply texture to all materials in the car model
        carModel.traverse((child) => {
            if (child.isMesh && child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(material => {
                        material.map = texture;
                        material.needsUpdate = true;
                    });
                } else {
                    child.material.map = texture;
                    child.material.needsUpdate = true;
                }
            }
        });
    }, undefined, (error) => {
        console.error('Error loading texture:', error);
    });
}

function setupAudio() {
    // Create audio listener
    audioListener = new THREE.AudioListener();
    camera.add(audioListener);
    
    // Load engine sound
    const audioLoader = new THREE.AudioLoader();
    audioLoader.load('assets/audio/cars/Car_Engine_Loop.ogg', (buffer) => {
        engineSound = new THREE.Audio(audioListener);
        engineSound.setBuffer(buffer);
        engineSound.setLoop(true);
        engineSound.setVolume(0.3);
        console.log('Engine sound loaded');
    }, undefined, (error) => {
        console.error('Error loading engine sound:', error);
    });
}

function startEngine() {
    if (engineSound && !isEngineRunning) {
        engineSound.play();
        isEngineRunning = true;
        console.log('Engine started');
    }
}

function stopEngine() {
    if (engineSound && isEngineRunning) {
        engineSound.stop();
        isEngineRunning = false;
        console.log('Engine stopped');
    }
}

// Input system
export function setupLevelInput() {
    // Remove existing listeners first to prevent duplicates
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("keyup", handleKeyUp);
    document.removeEventListener("pointerlockchange", onPointerLockChange);
    document.removeEventListener("mousemove", onMouseMove);
    
    // Add event listeners
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    document.addEventListener("pointerlockchange", onPointerLockChange);
    
    // Pointer lock on click - remove existing listener first
    renderer.domElement.removeEventListener("click", requestLock);
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


function requestLock() {
    if (document.pointerLockElement !== renderer.domElement) {
        renderer.domElement.requestPointerLock();
    }
}

function handleKeyDown(e) {
    if (e.code === "Space") {
        spaceHeld = true;
    } else if (e.code === "Escape") {
        // Show pause menu using ESC key
        if (window.showPauseMenu) {
            window.showPauseMenu(2);
        } else {
            // Fallback to direct return if pause menu not available
            returnToMainCallback();
        } 
    // F key toggle removed - always in driving mode
    } else if (e.code === "KeyE") {
        if (isEngineRunning) {
            stopEngine();
        } else {
            startEngine();
        }
    } else if (e.code === "KeyC") {
        // Reset camera to default position
        cameraYaw = 0;
        cameraPitch = 0;
    } else if (e.code === "KeyQ") {
        const newCarIndex = currentCarIndex > 0 ? currentCarIndex - 1 : availableCars.length - 1;
        switchCar(newCarIndex);
    } else if (e.code === "KeyR") {
        const newCarIndex = currentCarIndex < availableCars.length - 1 ? currentCarIndex + 1 : 0;
        switchCar(newCarIndex);
    } else if (e.code === "KeyT") {
        const currentCar = availableCars[currentCarIndex];
        if (currentCar && currentCar.textures) {
            const currentTextureIndex = getCurrentTextureIndex();
            const newTextureIndex = currentTextureIndex > 0 ? currentTextureIndex - 1 : currentCar.textures.length - 1;
            switchTexture(newTextureIndex);
        }
    } else if (e.code === "KeyY") {
        const currentCar = availableCars[currentCarIndex];
        if (currentCar && currentCar.textures) {
            const currentTextureIndex = getCurrentTextureIndex();
            const newTextureIndex = currentTextureIndex < currentCar.textures.length - 1 ? currentTextureIndex + 1 : 0;
            switchTexture(newTextureIndex);
        }
    } else {
        keys[e.key.toLowerCase()] = true;
    }
}

function handleKeyUp(e) {
    if (e.code === "Space") {
        spaceHeld = false;
        spaceLocked = false;
    // F key handling removed - always in driving mode
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
    // Update camera offset from car
    cameraYaw -= e.movementX * MOUSE_SENS;
    cameraPitch += e.movementY * MOUSE_SENS;
    
    // Limit camera pitch to prevent flipping
    const maxPitch = PI_2 - 0.1;
    const minPitch = -maxPitch;
    cameraPitch = Math.max(minPitch, Math.min(maxPitch, cameraPitch));
}

// toggleDriving function removed - always in driving mode

function updatePlayer() {
    if (!player || !carLoaded) return;

    const prevPos = player.position.clone();

    // ----------------------------
    // DRIVING MODE
    // ----------------------------
    if (isDriving) {
        // Handle car rotation (A/D keys) - FIXED STEERING
        let turnMultiplier = 1.0;
        
        // Reduce steering effectiveness at high speeds for realism, but never eliminate it
        if (Math.abs(currentSpeed) > 0.1) {
            turnMultiplier = Math.max(0.3, 1.0 - Math.abs(currentSpeed) * 0.8);
        }
        
        if (keys["a"] || keys["arrowleft"]) {
            carRotation += TURN_SPEED * turnMultiplier;
        }
        if (keys["d"] || keys["arrowright"]) {
            carRotation -= TURN_SPEED * turnMultiplier;
        }
        
        // Apply car rotation to the player
        player.rotation.y = carRotation;
        
        // Acceleration and braking
        if (keys["w"] || keys["arrowup"]) {
            currentSpeed += CAR_ACCELERATION;
            currentSpeed = Math.min(currentSpeed, DRIVE_SPEED);
        } else if (keys["s"] || keys["arrowdown"]) {
            currentSpeed -= CAR_ACCELERATION;
            currentSpeed = Math.max(currentSpeed, -DRIVE_SPEED * 0.5); // Reverse is slower
        } else {
            // Natural deceleration when no keys pressed
            currentSpeed *= 0.95;
            if (Math.abs(currentSpeed) < 0.01) currentSpeed = 0;
        }
        
        // Handbrake (space bar) - also helps with turning
        if (spaceHeld) {
            currentSpeed *= 0.8; // Quick deceleration
            // Allow sharper turns when handbraking
            turnMultiplier *= 1.5;
        }
        
        // Calculate movement direction based on car rotation
        const moveX = Math.sin(carRotation) * currentSpeed;
        const moveZ = Math.cos(carRotation) * currentSpeed;
        
        // Apply movement
        player.position.x += moveX;
        player.position.z += moveZ;
        
        // Keep car on ground
        player.position.y = 0.1; // Much lower position to sit properly on ground

        // Update speed display
        updateSpeedDisplay();
    }

    // Collision detection
    const playerBox = new THREE.Box3().setFromObject(player);
    for (const box of collisionBoxes) {
        if (playerBox.intersectsBox(box)) {
            player.position.copy(prevPos);
            currentSpeed = -currentSpeed * 0.5; // Bounce back when hitting buildings
            break;
        }
    }

    // traffic collisions -> full crash & respawn
    for (const tc of trafficCars) {
        if (!tc || !tc.bbox) continue;
        if (playerBox.intersectsBox(tc.bbox)) {
            // Crash detected
            handleCrash();
            return; // skip rest for this frame
        }
    }


    // Boundary check
    if (player.position.x < -95 || player.position.x > 95 || 
        player.position.z < -95 || player.position.z > 95) {
        player.position.copy(prevPos);
        currentSpeed = -currentSpeed * 0.5;
    }

    // Update camera after movement
    updateCamera();
}

function updateCamera() {
    if (!player) return;
    
    // Third-person car camera with mouse control
    const cameraDistance = 10;
    const cameraHeight = 5;
    
    // Calculate camera position with mouse offset
    const totalYaw = carRotation + cameraYaw;
    const behindX = Math.sin(totalYaw) * cameraDistance;
    const behindZ = Math.cos(totalYaw) * cameraDistance;
    
    // Apply camera pitch for height adjustment
    const pitchOffset = Math.sin(cameraPitch) * cameraDistance * 0.3;
    
    camera.position.x = player.position.x - behindX;
    camera.position.z = player.position.z - behindZ;
    camera.position.y = player.position.y + cameraHeight + pitchOffset;
    
    // Look at the car with slight pitch adjustment
    const lookAtY = player.position.y + 2 + Math.sin(cameraPitch) * 2;
    camera.lookAt(player.position.x, lookAtY, player.position.z);
}

function checkGoal() {
    if (!player) return;
    
    const playerBox = new THREE.Box3().setFromObject(player);
    const goal = scene.getObjectByName('goal');
    
    if (goal && goalUnlocked) {
        const goalBox = new THREE.Box3().setFromObject(goal);
        if (playerBox.intersectsBox(goalBox)) {
            alert('Congratulations! You won the race!');
            returnToMainCallback();
        }
    }
}

// Level update function called by main.js animation loop
export function updateLevel() {
    if (window.__stats) window.__stats.begin();
    updatePlayer();
    checkGoal();
    updateTraffic();
    checkCheckpointCollision();
    if (window.__stats) window.__stats.end();
}

// Cleanup function
export function cleanupLevel() {
    // Remove level-specific UI elements
    const uiElements = document.querySelectorAll('.game-ui');
    uiElements.forEach(el => {
        // Only remove elements that are not part of the main menu system
        const isMainMenuElement = el.closest('#main-menu, #play-submenu, #level-select, #settings, #credits, #instructions, #pause-menu');
        if (!isMainMenuElement) {
            el.remove();
        }
    });
    
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
    
    // Clean up audio
    if (engineSound) {
        engineSound.stop();
        engineSound = null;
    }
    if (audioListener) {
        audioListener = null;
    }

    // Remove traffic
    trafficCars.forEach(tc => {
        if (tc.mesh) scene.remove(tc.mesh);
    });
    trafficCars.length = 0;

    // Remove checkpoints
    checkpoints.forEach(cp => { if (cp.mesh) scene.remove(cp.mesh); });
    checkpoints.length = 0;

    // Clean up models
    buildingModel = null;
    buildingLoaded = false;
    carModel = null;
    carLoaded = false;
}