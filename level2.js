// level2.js - City Level with Car (based on level1.js)
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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

// Flying system variables (now driving system)
let isDriving = false;
const DRIVE_HEIGHT = 10; // Height player floats to when starting to drive
const DRIVE_SPEED = 0.25; // Speed while driving (faster than walking)
let driveKeyLocked = false; // Prevent rapid toggling

// Dedicated array for collision objects (Optimization)
let collisionBoxes = []; 

// Car model loading
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
let carRotation = 0; // Current rotation of the car
const TURN_SPEED = 0.05; // How fast the car turns

// Building model loading
let buildingModel = null;
let buildingLoaded = false;

// Available cars data with texture variants
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
        name: 'Luxury Sedan', 
        obj: 'car04.obj', 
        mtl: 'car04.mtl',
        textures: ['car4.png', 'car4_grey.png', 'car4_lightgrey.png', 'car4_lightorange.png']
    },
    { 
        id: 'car05', 
        name: 'Police Car', 
        obj: 'car05.obj', 
        mtl: 'car05.mtl',
        textures: ['car5.png', 'car5_green.png', 'car5_grey.png', 'car5_police.png', 'car5_police_la.png', 'car5_taxi.png']
    },
    { 
        id: 'car06', 
        name: 'City Car', 
        obj: 'car06.obj', 
        mtl: 'car06.mtl',
        textures: ['car6.png']
    },
    { 
        id: 'car07', 
        name: 'Family Car', 
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
    isDriving = false;
    driveKeyLocked = false;
    
    // Reset camera orientation
    yaw = 0;
    pitch = 0;

    setupLevel2();
    setupLevelInput();
    setupAudio();
    
    // Start animation loop for this level (main.js loop was stopped by cleanupCurrentLevel)
    renderer.setAnimationLoop(animate);
}

function setupLevel2() {
    collisionBoxes = []; // Reset collision array
    
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
    ground.receiveShadow = true; // Ground receives shadows
    scene.add(ground);

    // Load building model first, then car model
    loadBuildingModel();
    
    // Load car model, then create player
    loadCarModel();

    // Create roads (no collision boxes needed)
    createRoads();

    // Goal area
    const goalGeometry = new THREE.BoxGeometry(4, 2, 4);
    const goalMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const goal = new THREE.Mesh(goalGeometry, goalMaterial);
    goal.position.set(80, 1, 80);
    goal.name = 'goal';
    scene.add(goal);

    // Enhanced lighting system to simulate realistic sun
    setupRealisticLighting();

    // UI
    createUI();
    
    // Initial camera position (third-person view)
    camera.position.set(0, 10, 15);
    camera.lookAt(0, 0, 0);
    
    // Initialize yaw based on initial camera position
    yaw = Math.atan2(camera.position.x, camera.position.z);
}

function setupRealisticLighting() {
    // Enable shadows on the renderer
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Ambient light for overall illumination (simulates sky light)
    const ambientLight = new THREE.AmbientLight(0x87CEEB, 0.4); // Sky blue ambient light
    scene.add(ambientLight);
    
    // Main sun light (directional light from above and to the side)
    const sunLight = new THREE.DirectionalLight(0xFFE4B5, 1.2); // Warm sunlight color
    sunLight.position.set(100, 80, 50); // Position sun high and to the side
    sunLight.target.position.set(0, 0, 0); // Sun points toward center of scene
    
    // Configure shadows for realistic sun shadows
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 200;
    sunLight.shadow.camera.left = -100;
    sunLight.shadow.camera.right = 100;
    sunLight.shadow.camera.top = 100;
    sunLight.shadow.camera.bottom = -100;
    sunLight.shadow.bias = -0.0001; // Reduce shadow acne
    
    scene.add(sunLight);
    scene.add(sunLight.target);
    
    // Secondary fill light to simulate light bouncing off surfaces
    const fillLight = new THREE.DirectionalLight(0x87CEEB, 0.3); // Cooler fill light
    fillLight.position.set(-50, 40, -30); // Opposite side from sun
    fillLight.target.position.set(0, 0, 0);
    scene.add(fillLight);
    scene.add(fillLight.target);
    
    // Hemisphere light for more natural lighting (sky vs ground)
    const hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0x2d5a2d, 0.6);
    // Sky color (top) and ground color (bottom)
    scene.add(hemisphereLight);
    
    console.log('Realistic lighting system initialized with sun simulation');
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
    
    console.log(`Loading car: ${selectedCar.name} (${selectedCar.id})`);
    
    // Load material file first
    mtlLoader.load(`assets/models/cars/${selectedCar.mtl}`, (materials) => {
        materials.preload();
        console.log('Materials loaded:', materials);
        objLoader.setMaterials(materials);
        
        // Load the car model
        objLoader.load(`assets/models/cars/${selectedCar.obj}`, (object) => {
            carModel = object;
            carLoaded = true;
            console.log(`Car model loaded successfully: ${selectedCar.name}`);
            
            // Scale and position the car
            carModel.scale.set(0.5, 0.5, 0.5);
            carModel.position.set(0, 0, 0); // Position at ground level
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
            
            // Debug: Log materials on the car model
            carModel.traverse((child) => {
                if (child.isMesh) {
                    console.log('Car mesh found:', child.name, 'Material:', child.material);
                    if (child.material.map) {
                        console.log('Material has texture map:', child.material.map);
                    } else {
                        console.log('Material has NO texture map');
                    }
                }
            });
            
            // Apply initial texture
            applyInitialTexture();
            
        }, undefined, (error) => {
            console.error('Error loading car model:', error);
            // Fallback to simple box
            createFallbackPlayer();
        });
    }, undefined, (error) => {
        console.error('Error loading car materials:', error);
        // Fallback to simple box
        createFallbackPlayer();
    });
}

function createFallbackPlayer() {
    const PLAYER_SIZE = { x: 1, y: 1, z: 1 };
    const playerGeometry = new THREE.BoxGeometry(PLAYER_SIZE.x, PLAYER_SIZE.y, PLAYER_SIZE.z);
    const playerMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x333333, 
        transparent: true, 
        opacity: 0.3 
    }); // Semi-transparent dark box
    player = new THREE.Mesh(playerGeometry, playerMaterial);
    player.position.set(0, 0, 0); // Position at ground level
    player.name = 'player';
    scene.add(player);
    carLoaded = true;
    console.log('Fallback car player created (semi-transparent)');
}

function loadBuildingModel() {
    const gltfLoader = new GLTFLoader();
    
    console.log('Loading building model...');
    
    gltfLoader.load('assets/models/environment/Buildings.glb', (gltf) => {
        buildingModel = gltf.scene;
        buildingLoaded = true;
        console.log('Building model loaded successfully');
        
        // Debug: Log the structure of the building model
        console.log('Building model children count:', buildingModel.children.length);
        console.log('Building model structure:');
        buildingModel.traverse((child) => {
            if (child.isMesh) {
                console.log('  - Building mesh found:', child.name, 'Type:', child.type, 'Children:', child.children.length);
            } else if (child.isGroup) {
                console.log('  - Group found:', child.name, 'Children:', child.children.length);
            }
        });
        
        // Generate buildings using the loaded model
        generateSkyscrapers();
        
    }, undefined, (error) => {
        console.error('Error loading building model:', error);
        // Fallback to simple cubes if building model fails to load
        generateSkyscrapersFallback();
    });
}

function generateSkyscrapers() {
    if (!buildingModel || !buildingLoaded) {
        console.log('Building model not loaded yet, using fallback');
        generateSkyscrapersFallback();
        return;
    }
    
    console.log('Generating buildings using loaded model (all buildings will be properly aligned and positioned on ground)...');
    
    // Reduced building density - larger spacing and some randomness
    for (let x = -80; x <= 80; x += 40) { // Increased spacing from 20 to 40
        for (let z = -80; z <= 80; z += 40) { // Increased spacing from 20 to 40
            if (Math.abs(x) < 40 && Math.abs(z) < 40) continue; // Larger center exclusion
            
            // Add some randomness to skip some positions (30% chance to skip)
            if (Math.random() < 0.3) continue;
            
            // Create building instance from the loaded model
            const building = createBuildingFromModel(x, 0, z);
            if (building) {
                scene.add(building);
            }
        }
    }
}

function generateSkyscrapersFallback() {
    console.log('Using fallback cube buildings...');
    const buildingColors = [
        0x666666, 0x777777, 0x888888, 0x999999, 
        0x555555, 0x444444, 0x333333, 0x222222
    ];
    
    // Reduced building density - larger spacing and some randomness
    for (let x = -80; x <= 80; x += 40) { // Increased spacing from 20 to 40
        for (let z = -80; z <= 80; z += 40) { // Increased spacing from 20 to 40
            if (Math.abs(x) < 40 && Math.abs(z) < 40) continue; // Larger center exclusion
            
            // Add some randomness to skip some positions (30% chance to skip)
            if (Math.random() < 0.3) continue;
            
            const width = 8 + Math.random() * 6;
            const depth = 8 + Math.random() * 6;
            const height = 20 + Math.random() * 50; 
            const color = buildingColors[Math.floor(Math.random() * buildingColors.length)];
            
            createSkyscraper(x, 0, z, width, height, depth, color);
        }
    }
}

function createBuildingFromModel(x, y, z) {
    if (!buildingModel) return null;
    
    // If the building model has multiple children (multiple buildings), select one randomly
    if (buildingModel.children.length > 1) {
        // Select a random building from the collection
        const randomIndex = Math.floor(Math.random() * buildingModel.children.length);
        const selectedBuilding = buildingModel.children[randomIndex];
        
        // Clone only the selected building
        const building = selectedBuilding.clone();
        
        // Enable shadows for the building
        building.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
        // Random scale variation for diversity
        const scale = 0.8 + Math.random() * 0.4; // Scale between 0.8 and 1.2
        building.scale.set(scale, scale, scale);
        
        // Calculate building height and position it so bottom touches ground
        // IMPORTANT: Calculate bounding box AFTER scaling
        const boundingBox = new THREE.Box3().setFromObject(building);
        const buildingHeight = boundingBox.max.y - boundingBox.min.y;
        const buildingBottom = boundingBox.min.y;
        
        // Position building so its bottom is at ground level (y=0)
        const adjustedY = y - buildingBottom;
        building.position.set(x, adjustedY, z);
        
        console.log(`Building positioned at (${x}, ${adjustedY}, ${z}), height: ${buildingHeight.toFixed(2)}, bottom was at: ${buildingBottom.toFixed(2)}`);
        
        // Debug: Check if building is actually on ground after positioning
        const debugBoundingBox = new THREE.Box3().setFromObject(building);
        console.log(`Final building bounds - min Y: ${debugBoundingBox.min.y.toFixed(2)}, max Y: ${debugBoundingBox.max.y.toFixed(2)}`);
        
        // Safety check: If building is still below ground, force it up
        if (debugBoundingBox.min.y < -0.1) {
            const correction = -debugBoundingBox.min.y;
            building.position.y += correction;
            console.log(`Building was below ground, corrected by ${correction.toFixed(2)} units`);
        }
        
        // Keep buildings aligned (no random rotation)
        building.rotation.x = 0;
        building.rotation.y = 0;
        building.rotation.z = 0;
        
        // Store collision box in dedicated array (recalculate after final positioning)
        const collisionBoundingBox = new THREE.Box3().setFromObject(building);
        collisionBoxes.push(collisionBoundingBox);
        
        return building;
    } else {
        // If there's only one building or it's a single mesh, clone the entire model
        const building = buildingModel.clone();
        
        // Enable shadows for the building
        building.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
        // Random scale variation for diversity
        const scale = 0.8 + Math.random() * 0.4; // Scale between 0.8 and 1.2
        building.scale.set(scale, scale, scale);
        
        // Calculate building height and position it so bottom touches ground
        // IMPORTANT: Calculate bounding box AFTER scaling
        const boundingBox = new THREE.Box3().setFromObject(building);
        const buildingHeight = boundingBox.max.y - boundingBox.min.y;
        const buildingBottom = boundingBox.min.y;
        
        // Position building so its bottom is at ground level (y=0)
        const adjustedY = y - buildingBottom;
        building.position.set(x, adjustedY, z);
        
        console.log(`Building positioned at (${x}, ${adjustedY}, ${z}), height: ${buildingHeight.toFixed(2)}, bottom was at: ${buildingBottom.toFixed(2)}`);
        
        // Debug: Check if building is actually on ground after positioning
        const debugBoundingBox = new THREE.Box3().setFromObject(building);
        console.log(`Final building bounds - min Y: ${debugBoundingBox.min.y.toFixed(2)}, max Y: ${debugBoundingBox.max.y.toFixed(2)}`);
        
        // Safety check: If building is still below ground, force it up
        if (debugBoundingBox.min.y < -0.1) {
            const correction = -debugBoundingBox.min.y;
            building.position.y += correction;
            console.log(`Building was below ground, corrected by ${correction.toFixed(2)} units`);
        }
        
        // Keep buildings aligned (no random rotation)
        building.rotation.x = 0;
        building.rotation.y = 0;
        building.rotation.z = 0;
        
        // Store collision box in dedicated array (recalculate after final positioning)
        const collisionBoundingBox = new THREE.Box3().setFromObject(building);
        collisionBoxes.push(collisionBoundingBox);
        
        return building;
    }
}

function createSkyscraper(x, y, z, width, height, depth, color) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshLambertMaterial({ color: color }); // Changed to Lambert for better lighting
    const building = new THREE.Mesh(geometry, material);
    
    // Position building so its bottom is at ground level (y=0)
    // For BoxGeometry, the center is at (0,0,0), so we need to move it up by half height
    building.position.set(x, y + height/2, z);
    
    // Enable shadows
    building.castShadow = true;
    building.receiveShadow = true;
    
    // Store collision box in dedicated array
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
    
    // Roads (for visual)
    for (let x = -90; x <= 90; x += 20) {
        const roadGeometry = new THREE.PlaneGeometry(4, 200);
        const road = new THREE.Mesh(roadGeometry, roadMaterial);
        road.rotation.x = -Math.PI / 2;
        road.position.set(x, 0.1, 0);
        road.receiveShadow = true; // Roads receive shadows
        scene.add(road);
    }
    
    for (let z = -90; z <= 90; z += 20) {
        const roadGeometry = new THREE.PlaneGeometry(200, 4);
        const road = new THREE.Mesh(roadGeometry, roadMaterial);
        road.rotation.x = -Math.PI / 2;
        road.position.set(0, 0.1, z);
        road.receiveShadow = true; // Roads receive shadows
        scene.add(road);
    }
}

function createUI() {
    // Re-use the 'game-ui' class for easy global cleanup
    const titleDiv = document.createElement('div');
    titleDiv.className = "game-ui"; 
    titleDiv.textContent = 'LEVEL 2 - Car City Drive';
    titleDiv.style.cssText = `
        color: white; font-size: 24px; font-weight: bold; position: absolute; 
        top: 20px; left: 50%; transform: translateX(-50%); text-shadow: 2px 2px 4px black;
    `;
    document.body.appendChild(titleDiv);

    // Car selection display (keyboard controlled)
    const carInfoDiv = document.createElement('div');
    carInfoDiv.className = "game-ui";
    carInfoDiv.id = "car-info";
    carInfoDiv.style.cssText = `
        color: white; font-size: 16px; position: absolute; top: 60px; left: 20px; 
        text-shadow: 2px 2px 4px black; background: rgba(0,0,0,0.7); padding: 10px; border-radius: 5px;
    `;
    document.body.appendChild(carInfoDiv);

    // Texture selection display (keyboard controlled)
    const textureInfoDiv = document.createElement('div');
    textureInfoDiv.className = "game-ui";
    textureInfoDiv.id = "texture-info";
    textureInfoDiv.style.cssText = `
        color: white; font-size: 16px; position: absolute; top: 120px; left: 20px; 
        text-shadow: 2px 2px 4px black; background: rgba(0,0,0,0.7); padding: 10px; border-radius: 5px;
    `;
    document.body.appendChild(textureInfoDiv);

    // Update displays
    updateCarInfo();
    updateTextureInfo();

    const instructionsDiv = document.createElement('div');
    instructionsDiv.className = "game-ui";
    instructionsDiv.innerHTML = 'Drive your car to the green goal building!<br>W/S: Forward/Back, A/D: Turn Left/Right, Mouse: Look, Space: Jump, F: Drive Mode, E: Engine Sound<br>Q/R: Switch Car, T/Y: Switch Color, ESC: Main Menu';
    instructionsDiv.style.cssText = `
        color: white; font-size: 16px; position: absolute; top: 60px; left: 50%; 
        transform: translateX(-50%); text-align: center; text-shadow: 2px 2px 4px black;
    `;
    document.body.appendChild(instructionsDiv);

    // Driving status indicator
    const driveStatusDiv = document.createElement('div');
    driveStatusDiv.className = "game-ui";
    driveStatusDiv.id = "drive-status";
    driveStatusDiv.textContent = 'Drive Mode: OFF';
    driveStatusDiv.style.cssText = `
        color: white; font-size: 16px; position: absolute; top: 100px; left: 50%; 
        transform: translateX(-50%); text-align: center; text-shadow: 2px 2px 4px black;
    `;
    document.body.appendChild(driveStatusDiv);
}

function updateDriveStatus() {
    const driveStatusDiv = document.getElementById('drive-status');
    if (driveStatusDiv) {
        driveStatusDiv.textContent = `Drive Mode: ${isDriving ? 'ON' : 'OFF'}`;
        driveStatusDiv.style.color = isDriving ? '#00ff00' : 'white';
    }
}

function switchCar(newCarIndex) {
    if (newCarIndex === currentCarIndex || newCarIndex >= availableCars.length) {
        return;
    }
    
    console.log(`Switching from car ${currentCarIndex} to car ${newCarIndex}`);
    
    // Remove old car model from scene if it exists
    if (player) {
        scene.remove(player);
        player = null;
    }
    
    // Reset car loaded state
    carLoaded = false;
    carModel = null;
    currentCarIndex = newCarIndex;
    currentTextureIndex = 0; // Reset texture to first option
    
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
    
    const textureName = currentCar.textures[currentTextureIndex];
    console.log(`Applying initial texture: ${textureName}`);
    
    // Load and apply initial texture
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(`assets/textures/cars/${textureName}`, (texture) => {
        console.log('Texture loaded successfully:', texture);
        
        // Apply texture to all materials in the car model
        carModel.traverse((child) => {
            if (child.isMesh && child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(material => {
                        console.log('Applying texture to material array:', material);
                        material.map = texture;
                        material.needsUpdate = true;
                    });
                } else {
                    console.log('Applying texture to single material:', child.material);
                    child.material.map = texture;
                    child.material.needsUpdate = true;
                    
                    // Ensure the material is properly configured
                    if (child.material.type === 'MeshPhongMaterial') {
                        child.material.color = new THREE.Color(0xffffff); // White base color
                        child.material.specular = new THREE.Color(0x111111); // Low specular
                        child.material.shininess = 30;
                    }
                }
            }
        });
        console.log(`Initial texture applied: ${textureName}`);
    }, undefined, (error) => {
        console.error('Error loading initial texture:', error);
    });
}

function switchTexture(textureIndex) {
    if (!carModel || !availableCars[currentCarIndex]) return;
    
    const currentCar = availableCars[currentCarIndex];
    if (textureIndex >= currentCar.textures.length) return;
    
    currentTextureIndex = textureIndex;
    const textureName = currentCar.textures[textureIndex];
    console.log(`Switching to texture: ${textureName}`);
    
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
                    
                    // Ensure the material is properly configured
                    if (child.material.type === 'MeshPhongMaterial') {
                        child.material.color = new THREE.Color(0xffffff); // White base color
                        child.material.specular = new THREE.Color(0x111111); // Low specular
                        child.material.shininess = 30;
                    }
                }
            }
        });
        console.log(`Texture applied: ${textureName}`);
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
    } else if (e.code === "KeyF" && !driveKeyLocked) {
        // Toggle driving mode
        toggleDriving();
        driveKeyLocked = true;
    } else if (e.code === "KeyE") {
        // Toggle engine sound
        if (isEngineRunning) {
            stopEngine();
        } else {
            startEngine();
        }
    } else if (e.code === "KeyQ") {
        // Previous car
        const newCarIndex = currentCarIndex > 0 ? currentCarIndex - 1 : availableCars.length - 1;
        switchCar(newCarIndex);
    } else if (e.code === "KeyR") {
        // Next car
        const newCarIndex = currentCarIndex < availableCars.length - 1 ? currentCarIndex + 1 : 0;
        switchCar(newCarIndex);
    } else if (e.code === "KeyT") {
        // Previous texture
        const currentCar = availableCars[currentCarIndex];
        if (currentCar && currentCar.textures) {
            const currentTextureIndex = getCurrentTextureIndex();
            const newTextureIndex = currentTextureIndex > 0 ? currentTextureIndex - 1 : currentCar.textures.length - 1;
            switchTexture(newTextureIndex);
        }
    } else if (e.code === "KeyY") {
        // Next texture
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
    } else if (e.code === "KeyF") {
        driveKeyLocked = false;
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

// Driving system (formerly flying system)
function toggleDriving() {
    isDriving = !isDriving;

    if (isDriving) {
        velocityY = 0;
        targetDriveHeight = player.position.y + 10; // go 10 units higher than current
        isAscendingToDrive = true;
    } else {
        velocityY = 0; // allow gravity to take over
    }

    updateDriveStatus();
}


// Player movement and physics
// Extra globals for drive transition
let isAscendingToDrive = false;
let targetDriveHeight = 0;

function updatePlayer() {
    if (!player || !carLoaded) return; // Don't update if player hasn't been created yet

    const _forward = new THREE.Vector3();
    const _right = new THREE.Vector3();
    const _moveDir = new THREE.Vector3();

    // Handle car rotation (A/D keys)
    if (keys["a"] || keys["arrowleft"]) {
        carRotation += TURN_SPEED;
    }
    if (keys["d"] || keys["arrowright"]) {
        carRotation -= TURN_SPEED;
    }
    
    // Apply car rotation to the player
    if (player) {
        player.rotation.y = carRotation;
    }
    
    // Calculate movement directions based on car rotation (not camera)
    _forward.set(Math.sin(carRotation), 0, Math.cos(carRotation)).normalize();
    _right.crossVectors(_forward, new THREE.Vector3(0, 1, 0)).normalize();
    
    // Build move direction from inputs (relative to car rotation)
    _moveDir.set(0, 0, 0);
    if (keys["w"] || keys["arrowup"]) _moveDir.add(_forward);
    if (keys["s"] || keys["arrowdown"]) _moveDir.sub(_forward);
    if (_moveDir.lengthSq() > 0) _moveDir.normalize();

    const prevPos = player.position.clone();

    // ----------------------------
    // DRIVING MODE
    // ----------------------------
    if (isDriving) {
        const currentSpeed = DRIVE_SPEED;

        // Smooth ascent when driving is toggled on
        if (isAscendingToDrive) {
            if (player.position.y < targetDriveHeight) {
                player.position.y += 0.2; // ascent speed
            } else {
                player.position.y = targetDriveHeight;
                isAscendingToDrive = false;
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
            const playerFeet = player.position.y;
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
                player.position.y = box.max.y;
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

    // Ground plane check (y=0 is ground level)
    if (player.position.y <= 0) {
        player.position.y = 0;
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
    if (!player) return; // Don't update camera if player hasn't been created yet
    
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
    if (!player) return; // Don't check goal if player hasn't been created yet
    
    const playerBox = new THREE.Box3().setFromObject(player);
    const goal = scene.getObjectByName('goal');
    
    if (goal) {
        const goalBox = new THREE.Box3().setFromObject(goal);
        if (playerBox.intersectsBox(goalBox)) {
            alert('Congratulations! You reached the goal with your car!');
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
    
    // Clean up audio
    if (engineSound) {
        engineSound.stop();
        engineSound = null;
    }
    if (audioListener) {
        audioListener = null;
    }
    
    // Clean up building model
    buildingModel = null;
    buildingLoaded = false;
    
    // The main.js cleanup will stop the animation loop and clear the scene.
}