import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// Bullet class should be at the top level, not inside another function
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

// Rest of your variables...
let scene, camera, renderer, labelRenderer;
// ... continue with the rest of your code
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
// Increased tolerance to prevent ground jittering/little jumps
const GROUND_TOLERANCE = 0; 

// Player reference
let player;

// Raycaster for camera collision
const raycaster = new THREE.Raycaster();
const cameraVector = new THREE.Vector3();

// Building dimensions - INCREASED 5x for more spacious building
const BUILDING_WIDTH = 150;  // Increased from 30 to 150 (5x)
const BUILDING_DEPTH = 100;  // Increased from 20 to 100 (5x)
// Increased FLOOR_HEIGHT for more vertical space
const FLOOR_HEIGHT = 12;     // Increased from 8 to 12 for more vertical space
const WALL_THICKNESS = 0.3;

// Collision boxes array
let collisionBoxes = [];

// Add with your existing variables
let movableBoxes = [];
const BOX_SIZE = 1.5;
const PUSH_FORCE = 0.3;

// Add with your existing variables
let bullets = [];
const BULLET_SPEED = 1.0;
const BULLET_MAX_DISTANCE = 50;

// Stair parameters (for alignment) - Scaled up proportionally
const STAIR_WIDTH = 15;      // Increased from 3 to 15 (5x)
const STAIR_DEPTH = 30;      // Increased from 6 to 30 (5x)
const STEP_COUNT = 24;       // Increased steps for taller floors
const STEP_HEIGHT = FLOOR_HEIGHT / STEP_COUNT;
const STEP_DEPTH = STAIR_DEPTH / STEP_COUNT;
const STAIR_CENTER_X = BUILDING_WIDTH / 2 - STAIR_WIDTH / 2 - 10; // Scaled from -2 to -10
const STAIR_START_Z = -BUILDING_DEPTH / 2 + 5; // Scaled from +1 to +5
const STAIR_END_Z = STAIR_START_Z + STAIR_DEPTH;
const STAIR_CENTER_Z = STAIR_START_Z + STAIR_DEPTH / 2;

// Hole parameters for staircase openings in floors - FIXED: Smaller, properly aligned holes
const HOLE_WIDTH = STAIR_WIDTH + 2; // Slightly wider than stairs for easy access
const HOLE_DEPTH = STEP_DEPTH * 4;  // Cover enough steps for comfortable entry
const HOLE_START_Z = STAIR_END_Z - HOLE_DEPTH; // Hole starts where stairs end minus hole depth
const HOLE_CENTER_Z = HOLE_START_Z + HOLE_DEPTH / 2; // Center of the hole

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

    setupLevel3();
    setupLevelInput();
    
    // Start animation loop
    renderer.setAnimationLoop(animate);
}

function setupLevel3() {
    collisionBoxes = []; // Reset collision array
    
    // Night sky background
    scene.background = new THREE.Color(0x001133);
    
    // Create the 3-story building
    createBuilding();

    createMovableBoxes(); // Add this line
    
    // Create player
    const playerGeometry = new THREE.BoxGeometry(1, 1, 1);
    const playerMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    player = new THREE.Mesh(playerGeometry, playerMaterial);
    
    // Set player to a clear spot on the First Floor (Y=1)
    player.position.set(-40, 1, 40); // Scaled starting position for larger building
    
    player.name = 'player';
    scene.add(player);

    // UI
    createUI();
    
    // Set an initial camera position/orientation for the first frame
    yaw = Math.PI; 
    pitch = -0.1; 
    updateCamera(); 
}

function createMovableBoxes() {
    const boxMaterial = new THREE.MeshBasicMaterial({ color: 0x8B4513 });
    
    // First floor boxes
    createMovableBox(-10, 0.75, 5, boxMaterial);
    createMovableBox(8, 0.75, -8, boxMaterial);
    createMovableBox(-20, 0.75, -15, boxMaterial);
    
    // Second floor boxes  
    createMovableBox(-25, FLOOR_HEIGHT + 0.75, 15, boxMaterial);
    createMovableBox(20, FLOOR_HEIGHT + 0.75, -10, boxMaterial);
    createMovableBox(-35, FLOOR_HEIGHT + 0.75, -5, boxMaterial);
    
    // Third floor boxes
    createMovableBox(-15, FLOOR_HEIGHT * 2 + 0.75, 20, boxMaterial);
    createMovableBox(10, FLOOR_HEIGHT * 2 + 0.75, -15, boxMaterial);
    createMovableBox(25, FLOOR_HEIGHT * 2 + 0.75, 10, boxMaterial);
}

function shootBullet() {
    // Get camera direction for shooting
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    
    // Start bullet slightly in front of camera to avoid self-collision
    const startPosition = camera.position.clone().add(direction.clone().multiplyScalar(1));
    
    const bullet = new Bullet(startPosition, direction);
    bullets.push(bullet);
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

function createMovableBox(x, y, z, material) {
    const boxGeometry = new THREE.BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE);
    const box = new THREE.Mesh(boxGeometry, material);
    box.position.set(x, y, z);
    box.userData.isMovable = true;
    box.userData.normalGravity = true; // true = falls down, false = falls up
    box.userData.velocityY = 0;
    scene.add(box);
    movableBoxes.push(box);
    addCollisionBox(box);
    return box;
}

function checkBulletCollisions(bullet, bulletIndex) {
    const bulletBox = new THREE.Box3().setFromObject(bullet.mesh);
    
    // Check collision with movable boxes
    for (const box of movableBoxes) {
        const boxBox = new THREE.Box3().setFromObject(box);
        
        if (bulletBox.intersectsBox(boxBox)) {
            // Reverse gravity for this box
            box.userData.normalGravity = !box.userData.normalGravity;
            box.userData.velocityY = box.userData.normalGravity ? -0.5 : 0.5;
            
            // Remove the bullet
            bullet.destroy();
            bullets.splice(bulletIndex, 1);
            
            console.log(`Box gravity reversed: ${box.userData.normalGravity ? 'Normal' : 'Reversed'}`);
            break;
        }
    }
}

function updateBoxPhysics() {
    const GRAVITY = 0.02;
    const TERMINAL_VELOCITY = 1.0;
    
    movableBoxes.forEach(box => {
        if (!box.userData.isMovable) return;
        
        // Apply gravity based on current state
        if (box.userData.normalGravity) {
            box.userData.velocityY -= GRAVITY; // Fall down
        } else {
            box.userData.velocityY += GRAVITY; // Fall up
        }
        
        // Limit terminal velocity
        if (Math.abs(box.userData.velocityY) > TERMINAL_VELOCITY) {
            box.userData.velocityY = Math.sign(box.userData.velocityY) * TERMINAL_VELOCITY;
        }
        
        // Test new position
        const newPosition = box.position.clone();
        newPosition.y += box.userData.velocityY;
        
        const testBox = new THREE.Box3().setFromCenterAndSize(
            newPosition, 
            new THREE.Vector3(BOX_SIZE, BOX_SIZE, BOX_SIZE)
        );
        
        let canMove = true;
        
        // Check collisions with walls and other objects
        for (const collisionBox of collisionBoxes) {
            if (testBox.intersectsBox(collisionBox)) {
                canMove = false;
                box.userData.velocityY = 0; // Stop movement
                
                // Snap to surface
                if (box.userData.normalGravity) {
                    box.position.y = collisionBox.max.y + BOX_SIZE/2;
                } else {
                    box.position.y = collisionBox.min.y - BOX_SIZE/2;
                }
                break;
            }
        }
        
        // Check collisions with other boxes
        if (canMove) {
            movableBoxes.forEach(otherBox => {
                if (otherBox !== box && testBox.intersectsBox(new THREE.Box3().setFromObject(otherBox))) {
                    canMove = false;
                    box.userData.velocityY = 0;
                }
            });
        }
        
        // Apply movement if no collision
        if (canMove) {
            box.position.y = newPosition.y;
            updateBoxCollision(box);
        }
    });
}

function checkBoxPushing() {
    const playerBox = new THREE.Box3().setFromObject(player);
    
    movableBoxes.forEach(box => {
        const boxBox = new THREE.Box3().setFromObject(box);
        
        if (playerBox.intersectsBox(boxBox)) {
            const pushDirection = new THREE.Vector3();
            camera.getWorldDirection(pushDirection);
            pushDirection.y = 0;
            pushDirection.normalize();
            
            const newBoxPos = box.position.clone().add(pushDirection.multiplyScalar(PUSH_FORCE));
            const testBox = new THREE.Box3().setFromCenterAndSize(newBoxPos, new THREE.Vector3(BOX_SIZE, BOX_SIZE, BOX_SIZE));
            
            let canMove = true;
            
            // Check wall collisions
            for (const collisionBox of collisionBoxes) {
                if (testBox.intersectsBox(collisionBox)) {
                    canMove = false;
                    break;
                }
            }
            
            // Check other box collisions
            if (canMove) {
                movableBoxes.forEach(otherBox => {
                    if (otherBox !== box && testBox.intersectsBox(new THREE.Box3().setFromObject(otherBox))) {
                        canMove = false;
                    }
                });
            }
            
            if (canMove) {
                box.position.copy(newBoxPos);
                updateBoxCollision(box);
            }
        }
    });
}

function updateBoxCollision(box) {
    const newCollisionBox = new THREE.Box3().setFromObject(box);
    const index = collisionBoxes.findIndex(b => {
        const boxPos = new THREE.Vector3();
        box.getWorldPosition(boxPos);
        return b.min.distanceTo(boxPos) < 0.1;
    });
    
    if (index > -1) {
        collisionBoxes[index] = newCollisionBox;
    }
}

function createBuilding() {
    const wallMaterial = new THREE.MeshBasicMaterial({ color: 0x8B4513 }); // Brown walls
    const floorMaterial = new THREE.MeshBasicMaterial({ color: 0x696969, side: THREE.DoubleSide }); // Gray floors
    const stairMaterial = new THREE.MeshBasicMaterial({ color: 0xA0522D }); // Dark brown stairs

    // Create 3 floors
    for (let floor = 0; floor < 3; floor++) {
        const floorY = floor * FLOOR_HEIGHT;
        
        // Floor (with hole for stairs if floor > 0)
        if (floor === 0) {
            // Ground floor - no hole needed
            const floorGeometry = new THREE.PlaneGeometry(BUILDING_WIDTH, BUILDING_DEPTH);
            const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
            floorMesh.rotation.x = -Math.PI / 2;
            floorMesh.position.y = floorY;
            scene.add(floorMesh);
            addCollisionBox(floorMesh);
        } else {
            // Upper floors - create floors with properly sized holes
            createFloorWithHole(floorY, floorMaterial);
        }
        
        // Outer walls
        
        // West Wall
        createWall(-BUILDING_WIDTH/2, floorY + FLOOR_HEIGHT/2, 0, WALL_THICKNESS, FLOOR_HEIGHT, BUILDING_DEPTH, wallMaterial); 
        // North Wall
        createWall(0, floorY + FLOOR_HEIGHT/2, -BUILDING_DEPTH/2, BUILDING_WIDTH, FLOOR_HEIGHT, WALL_THICKNESS, wallMaterial); 
        // South Wall
        createWall(0, floorY + FLOOR_HEIGHT/2, BUILDING_DEPTH/2, BUILDING_WIDTH, FLOOR_HEIGHT, WALL_THICKNESS, wallMaterial); 

        // East Wall with Staircase Opening (aligned to stairs)
        const stairOpeningZ = STAIR_WIDTH + 2; // Width of the doorway (slightly wider than stairs)
        const openingCenterZ = STAIR_CENTER_Z; // Align to stair center

        // Wall segment South of the opening
        const southSegmentDepth = BUILDING_DEPTH/2 - (openingCenterZ + stairOpeningZ/2);
        if (southSegmentDepth > 0) {
            createWall(
                BUILDING_WIDTH/2, 
                floorY + FLOOR_HEIGHT/2, 
                (BUILDING_DEPTH/2 + (openingCenterZ + stairOpeningZ/2)) / 2, 
                WALL_THICKNESS, 
                FLOOR_HEIGHT, 
                southSegmentDepth, 
                wallMaterial
            ); 
        }
        
        // Wall segment North of the opening
        const northSegmentDepth = (openingCenterZ - stairOpeningZ/2) - (-BUILDING_DEPTH/2);
        if (northSegmentDepth > 0) {
            createWall(
                BUILDING_WIDTH/2, 
                floorY + FLOOR_HEIGHT/2, 
                (-BUILDING_DEPTH/2 + (openingCenterZ - stairOpeningZ/2)) / 2, 
                WALL_THICKNESS, 
                FLOOR_HEIGHT, 
                northSegmentDepth, 
                wallMaterial
            );
        }

        // Header above the opening (Doorway height is 3m)
        const headerHeight = FLOOR_HEIGHT - 3; 
        if (headerHeight > 0) {
            createWall(
                BUILDING_WIDTH/2, 
                floorY + FLOOR_HEIGHT - headerHeight/2, 
                openingCenterZ, 
                WALL_THICKNESS, 
                headerHeight, 
                stairOpeningZ, 
                wallMaterial
            );
        }
        
        // Interior walls - different layouts for each floor (scaled up)
        createFloorLayout(floor, floorY, wallMaterial);
        
        // Stairs between floors (including to rooftop)
        if (floor < 3) {
            createStairs(floorY, stairMaterial);
        }
    }

    // Rooftop (escape point)
    createRooftop();
}

function createFloorWithHole(floorY, floorMaterial) {
    const halfWidth = BUILDING_WIDTH / 2;
    const halfDepth = BUILDING_DEPTH / 2;
    
    // Hole boundaries
    const holeMinX = STAIR_CENTER_X - HOLE_WIDTH / 2;
    const holeMaxX = STAIR_CENTER_X + HOLE_WIDTH / 2;
    const holeMinZ = HOLE_START_Z;
    const holeMaxZ = HOLE_START_Z + HOLE_DEPTH;

    // Create floor segments around the hole

    // 1. Main floor area (most of the building)
    const mainFloorWidth = BUILDING_WIDTH;
    const mainFloorDepth = holeMinZ - (-halfDepth); // From south wall to hole start
    if (mainFloorDepth > 0) {
        const mainGeometry = new THREE.PlaneGeometry(mainFloorWidth, mainFloorDepth);
        const mainMesh = new THREE.Mesh(mainGeometry, floorMaterial);
        mainMesh.rotation.x = -Math.PI / 2;
        mainMesh.position.set(0, floorY, holeMinZ - mainFloorDepth / 2);
        scene.add(mainMesh);
        addCollisionBox(mainMesh);
    }

    // 2. Area behind the hole (north of the hole)
    const behindHoleDepth = halfDepth - holeMaxZ;
    if (behindHoleDepth > 0) {
        const behindGeometry = new THREE.PlaneGeometry(BUILDING_WIDTH, behindHoleDepth);
        const behindMesh = new THREE.Mesh(behindGeometry, floorMaterial);
        behindMesh.rotation.x = -Math.PI / 2;
        behindMesh.position.set(0, floorY, holeMaxZ + behindHoleDepth / 2);
        scene.add(behindMesh);
        addCollisionBox(behindMesh);
    }

    // 3. Left side of hole (west)
    const leftSideWidth = holeMinX - (-halfWidth);
    if (leftSideWidth > 0) {
        const leftGeometry = new THREE.PlaneGeometry(leftSideWidth, HOLE_DEPTH);
        const leftMesh = new THREE.Mesh(leftGeometry, floorMaterial);
        leftMesh.rotation.x = -Math.PI / 2;
        leftMesh.position.set(holeMinX - leftSideWidth / 2, floorY, HOLE_CENTER_Z);
        scene.add(leftMesh);
        addCollisionBox(leftMesh);
    }

    // 4. Right side of hole (east)
    const rightSideWidth = halfWidth - holeMaxX;
    if (rightSideWidth > 0) {
        const rightGeometry = new THREE.PlaneGeometry(rightSideWidth, HOLE_DEPTH);
        const rightMesh = new THREE.Mesh(rightGeometry, floorMaterial);
        rightMesh.rotation.x = -Math.PI / 2;
        rightMesh.position.set(holeMaxX + rightSideWidth / 2, floorY, HOLE_CENTER_Z);
        scene.add(rightMesh);
        addCollisionBox(rightMesh);
    }
}

function createFloorLayout(floor, floorY, wallMaterial) {
    switch(floor) {
        case 0: // First floor - maze-like layout (scaled up 5x)
            createWall(-25, floorY + FLOOR_HEIGHT/2, -25, 40, FLOOR_HEIGHT, WALL_THICKNESS, wallMaterial);
            createWall(25, floorY + FLOOR_HEIGHT/2, 15, 30, FLOOR_HEIGHT, WALL_THICKNESS, wallMaterial);
            createWall(0, floorY + FLOOR_HEIGHT/2, -10, WALL_THICKNESS, FLOOR_HEIGHT, 30, wallMaterial);
            createWall(-15, floorY + FLOOR_HEIGHT/2, 20, 20, FLOOR_HEIGHT, WALL_THICKNESS, wallMaterial);
            // Additional walls for more complex maze
            createWall(-50, floorY + FLOOR_HEIGHT/2, 30, 20, FLOOR_HEIGHT, WALL_THICKNESS, wallMaterial);
            createWall(40, floorY + FLOOR_HEIGHT/2, -20, WALL_THICKNESS, FLOOR_HEIGHT, 25, wallMaterial);
            createWall(-30, floorY + FLOOR_HEIGHT/2, -35, 25, FLOOR_HEIGHT, WALL_THICKNESS, wallMaterial);
            break;
            
        case 1: // Second floor - office layout (scaled up 5x)
            createWall(-40, floorY + FLOOR_HEIGHT/2, 0, 20, FLOOR_HEIGHT, WALL_THICKNESS, wallMaterial);
            createWall(0, floorY + FLOOR_HEIGHT/2, -30, WALL_THICKNESS, FLOOR_HEIGHT, 40, wallMaterial);
            createWall(30, floorY + FLOOR_HEIGHT/2, 20, 30, FLOOR_HEIGHT, WALL_THICKNESS, wallMaterial);
            // Additional office partitions
            createWall(-20, floorY + FLOOR_HEIGHT/2, 25, 15, FLOOR_HEIGHT, WALL_THICKNESS, wallMaterial);
            createWall(15, floorY + FLOOR_HEIGHT/2, -15, WALL_THICKNESS, FLOOR_HEIGHT, 20, wallMaterial);
            // Create some office furniture (scaled up)
            createFurniture(floorY);
            break;
            
        case 2: // Third floor - open plan with obstacles (scaled up 5x)
            createWall(-20, floorY + FLOOR_HEIGHT/2, 30, 50, FLOOR_HEIGHT, WALL_THICKNESS, wallMaterial);
            createWall(35, floorY + FLOOR_HEIGHT/2, -15, WALL_THICKNESS, FLOOR_HEIGHT, 40, wallMaterial);
            // Additional partitions
            createWall(-45, floorY + FLOOR_HEIGHT/2, -25, 25, FLOOR_HEIGHT, WALL_THICKNESS, wallMaterial);
            createWall(20, floorY + FLOOR_HEIGHT/2, 45, WALL_THICKNESS, FLOOR_HEIGHT, 30, wallMaterial);
            // Create storage boxes as obstacles (scaled up)
            createObstacles(floorY);
            break;
    }
}

function createWall(x, y, z, width, height, depth, material) {
    const wallGeometry = new THREE.BoxGeometry(width, height, depth);
    const wall = new THREE.Mesh(wallGeometry, material);
    wall.position.set(x, y, z);
    scene.add(wall);
    addCollisionBox(wall);
    return wall;
}

function createStairs(floorY, material) {
    for (let i = 0; i < STEP_COUNT; i++) {
        const stepGeometry = new THREE.BoxGeometry(STAIR_WIDTH, STEP_HEIGHT, STEP_DEPTH);
        const step = new THREE.Mesh(stepGeometry, material);
        step.position.set(
            STAIR_CENTER_X,
            floorY + (i * STEP_HEIGHT) + STEP_HEIGHT / 2,
            STAIR_START_Z + (i * STEP_DEPTH) + STEP_DEPTH / 2 // North to south progression
        );
        scene.add(step);
        addCollisionBox(step);
    }
}

function createFurniture(floorY) {
    const deskMaterial = new THREE.MeshBasicMaterial({ color: 0x8B4513 });
    const chairMaterial = new THREE.MeshBasicMaterial({ color: 0x654321 });
    
    // Desks (scaled up)
    createFurniturePiece(-30, floorY + 0.5, 20, 10, 1, 5, deskMaterial);
    createFurniturePiece(15, floorY + 0.5, -10, 10, 1, 5, deskMaterial);
    createFurniturePiece(-45, floorY + 0.5, -15, 8, 1, 4, deskMaterial);
    createFurniturePiece(35, floorY + 0.5, 25, 12, 1, 6, deskMaterial);
    
    // Chairs (scaled up)
    createFurniturePiece(-30, floorY + 0.3, 30, 4, 0.6, 4, chairMaterial);
    createFurniturePiece(15, floorY + 0.3, -20, 4, 0.6, 4, chairMaterial);
    createFurniturePiece(-45, floorY + 0.3, -20, 3, 0.6, 3, chairMaterial);
    createFurniturePiece(35, floorY + 0.3, 35, 3, 0.6, 3, chairMaterial);
    
    // Bookshelves
    const shelfMaterial = new THREE.MeshBasicMaterial({ color: 0x5D4037 });
    createFurniturePiece(-60, floorY + 1.5, 0, 3, 3, 8, shelfMaterial);
    createFurniturePiece(50, floorY + 1.5, 10, 3, 3, 6, shelfMaterial);
}

function createObstacles(floorY) {
    const boxMaterial = new THREE.MeshBasicMaterial({ color: 0x964B00 });
    
    // Random boxes on third floor (scaled up)
    createFurniturePiece(-10, floorY + 1, 0, 7.5, 2, 7.5, boxMaterial);
    createFurniturePiece(20, floorY + 1, 25, 7.5, 2, 7.5, boxMaterial);
    createFurniturePiece(0, floorY + 1, -35, 7.5, 2, 7.5, boxMaterial);
    createFurniturePiece(-40, floorY + 1, -20, 7.5, 2, 7.5, boxMaterial);
    // Additional obstacles for larger space
    createFurniturePiece(30, floorY + 1, -10, 6, 3, 6, boxMaterial);
    createFurniturePiece(-25, floorY + 1, 40, 8, 2.5, 8, boxMaterial);
    createFurniturePiece(45, floorY + 1, 15, 5, 4, 5, boxMaterial);
    
    // Pallets and crates
    const palletMaterial = new THREE.MeshBasicMaterial({ color: 0x795548 });
    createFurniturePiece(-15, floorY + 0.2, 15, 12, 0.4, 8, palletMaterial);
    createFurniturePiece(25, floorY + 0.2, -25, 10, 0.4, 10, palletMaterial);
}

function createFurniturePiece(x, y, z, width, height, depth, material) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const piece = new THREE.Mesh(geometry, material);
    piece.position.set(x, y, z);
    scene.add(piece);
    addCollisionBox(piece);
    return piece;
}

function createRooftop() {
    const roofY = 3 * FLOOR_HEIGHT;
    
    // Rooftop floor - full floor, no hole needed
    const roofGeometry = new THREE.PlaneGeometry(BUILDING_WIDTH, BUILDING_DEPTH);
    const roofMaterial = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.rotation.x = -Math.PI / 2;
    roof.position.y = roofY;
    scene.add(roof);
    addCollisionBox(roof);
    
    // Rooftop access door (goal)
    const goalGeometry = new THREE.BoxGeometry(2, 3, 0.2);
    const goalMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const goal = new THREE.Mesh(goalGeometry, goalMaterial);
    goal.position.set(0, roofY + 1.5, -BUILDING_DEPTH/2 + 0.1);
    goal.name = 'goal';
    scene.add(goal);
    
    // Rooftop railing
    createRailing(roofY);
}

function createRailing(roofY) {
    const railingMaterial = new THREE.MeshBasicMaterial({ color: 0x666666 });
    const railingHeight = 1;
    
    // Railings around rooftop
    createWall(-BUILDING_WIDTH/2, roofY + railingHeight/2, 0, 0.1, railingHeight, BUILDING_DEPTH, railingMaterial);
    createWall(BUILDING_WIDTH/2, roofY + railingHeight/2, 0, 0.1, railingHeight, BUILDING_DEPTH, railingMaterial);
    createWall(0, roofY + railingHeight/2, -BUILDING_DEPTH/2, BUILDING_WIDTH, railingHeight, 0.1, railingMaterial);
    createWall(0, roofY + railingHeight/2, BUILDING_DEPTH/2, BUILDING_WIDTH, railingHeight, 0.1, railingMaterial);
}

function addCollisionBox(mesh) {
    const boundingBox = new THREE.Box3().setFromObject(mesh);
    collisionBoxes.push(boundingBox);
}

function createUI() {
    const titleDiv = document.createElement('div');
    titleDiv.className = "game-ui";
    titleDiv.textContent = 'LEVEL 3 - Building Escape (Massive Edition)';
    titleDiv.style.cssText = `
        color: white; font-size: 24px; font-weight: bold; position: absolute; 
        top: 20px; left: 50%; transform: translateX(-50%); text-shadow: 2px 2px 4px black;
        z-index: 1000; pointer-events: none;
    `;
    document.body.appendChild(titleDiv);

    const instructionsDiv = document.createElement('div');
    instructionsDiv.className = "game-ui";
    instructionsDiv.innerHTML = 'Escape to the rooftop!<br>Find the stairs to go up, reach the green door on the roof.<br>WASD: Move, Mouse: Look, Space: Jump, F: Shoot Bullets, ESC: Pause Menu<br>Shoot boxes to reverse their gravity!<br>Building is now 5x larger - explore the massive space!';
    instructionsDiv.style.cssText = `
        color: white; font-size: 16px; position: absolute; top: 60px; left: 50%; 
        transform: translateX(-50%); text-align: center; text-shadow: 2px 2px 4px black;
        z-index: 1000; pointer-events: none;
    `;
    document.body.appendChild(instructionsDiv);

    // Floor indicator
    const floorDiv = document.createElement('div');
    floorDiv.className = "game-ui";
    floorDiv.id = "floor-indicator";
    floorDiv.style.cssText = `
        color: white; font-size: 18px; position: absolute; top: 100px; left: 50%; 
        transform: translateX(-50%); text-align: center; text-shadow: 2px 2px 4px black;
        z-index: 1000; pointer-events: none;
    `;
    document.body.appendChild(floorDiv);
    updateFloorIndicator();

    // ---------- Crosshair (exactly like main.js) ----------
    const crosshair = document.createElement("div");
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

// ... (rest of the code remains exactly the same - updateFloorIndicator, setupLevelInput, handleKeyDown, handleKeyUp, onPointerLockChange, onMouseMove, checkCollision, findGroundHeight, updatePlayer, updateCamera, checkGoal, animate, cleanupLevel)

// Note: The rest of the functions (updateFloorIndicator, setupLevelInput, handleKeyDown, handleKeyUp, onPointerLockChange, onMouseMove, checkCollision, findGroundHeight, updatePlayer, updateCamera, checkGoal, animate, cleanupLevel) remain exactly the same as in the previous version.

function updateFloorIndicator() {
    const floorDiv = document.getElementById('floor-indicator');
    if (floorDiv && player) {
        const currentY = player.position.y - player.geometry.parameters.height / 2; // Bottom of player box
        const floorNumber = Math.floor(currentY / FLOOR_HEIGHT) + 1;
        
        let floorName = '';
        
        if (floorNumber <= 0) { 
            floorName = 'Ground Floor';
        } else if (floorNumber === 1) {
            floorName = 'First Floor';
        } else if (floorNumber === 2) {
            floorName = 'Second Floor';
        } else if (floorNumber === 3) {
            floorName = 'Third Floor';
        } else {
            floorName = 'Rooftop';
        }
        
        floorDiv.textContent = `Current Floor: ${floorName}`;
    }
}

// Input system
function setupLevelInput() {
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    document.addEventListener("pointerlockchange", onPointerLockChange);
    
    renderer.domElement.addEventListener("click", requestLock);
    
    if (document.pointerLockElement === renderer.domElement) {
        document.addEventListener("mousemove", onMouseMove);
    }
    
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
            window.showPauseMenu(3);
        } else {
            // Fallback to direct return if pause menu not available
            returnToMainCallback();
        }
    } else if (e.code === "KeyF") { // Shoot with F key
        shootBullet();
    } else {
        keys[e.key.toLowerCase()] = true;
    }
}

function handleKeyUp(e) {
    if (e.code === "Space") {
        spaceHeld = false;
        spaceLocked = false;
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

// Player movement and physics
function updatePlayer() {
    if (!player) return;

    const _forward = new THREE.Vector3();
    const _right = new THREE.Vector3();
    const _moveDir = new THREE.Vector3();
    
    // Step-up tolerance
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

    // --- Improved Ground Check ---
    const groundHeight = findGroundHeight(prevPos);
    const isGrounded = Math.abs(player.position.y - groundHeight) <= GROUND_TOLERANCE + 0.1;

    if (isGrounded) {
        velocityY = 0;
        player.position.y = groundHeight; // Snap to ground

        // Jumping - only allow jumping when grounded
        if (spaceHeld && !spaceLocked) {
            velocityY = jumpStrength;
            spaceLocked = true;
        }
    }

    // Always apply gravity
    velocityY += gravity;
    
    // --- Horizontal Movement with Step-Up and Sliding ---
    const moveX = _moveDir.x * speed;
    const moveZ = _moveDir.z * speed;
    const targetX = player.position.x + moveX;
    const targetZ = player.position.z + moveZ;

    // 1. Calculate new horizontal position
    const newHorizontalPos = new THREE.Vector3(targetX, player.position.y, targetZ);

    if (!checkCollision(newHorizontalPos)) {
        // If movement is totally clear, apply it.
        player.position.x = newHorizontalPos.x;
        player.position.z = newHorizontalPos.z;
    } else {
        // Collision detected: Try to step up
        const testUpPos = new THREE.Vector3(targetX, player.position.y + STEP_UP_HEIGHT, targetZ);
        if (!checkCollision(testUpPos)) {
            // Step up is clear, move horizontally and vertically
            player.position.x = targetX;
            player.position.z = targetZ;
            player.position.y += STEP_UP_HEIGHT;
        } else {
            // Step-up blocked, try sliding (X then Z)
            
            // Try X movement
            const tryX = new THREE.Vector3(targetX, player.position.y, player.position.z);
            if (!checkCollision(tryX)) {
                player.position.x = tryX.x;
            }

            // Try Z movement
            const tryZ = new THREE.Vector3(player.position.x, player.position.y, targetZ);
            if (!checkCollision(tryZ)) {
                player.position.z = tryZ.z;
            }
        }
    }

    // Vertical Movement (after horizontal)
    const newVerticalPos = player.position.y + velocityY;
    const testPos = new THREE.Vector3(player.position.x, newVerticalPos, player.position.z);
    
    if (!checkCollision(testPos)) {
        player.position.y = newVerticalPos;
    } else {
        // Collision hit - stop vertical movement
        if (velocityY > 0) {
            // Hit ceiling while jumping
            velocityY = 0;
        } else {
            // Landed on something
            const landedHeight = findGroundHeight(player.position);
            player.position.y = landedHeight;
            velocityY = 0;
        }
    }

    // Update floor indicator
    updateFloorIndicator();

    checkBoxPushing(); // Add this line
    
    // Update camera
    updateCamera();
}

// Improved Find ground height at a position
function findGroundHeight(position) {
    const playerHeight = 1; // Changed from 2 to 1 to match 1x1x1 player
    const halfPlayerHeight = playerHeight / 2;
    const rayDown = new THREE.Vector3(0, -1, 0);

    // Cast a ray down from just above the player's feet
    const origin = new THREE.Vector3(position.x, position.y - halfPlayerHeight + 0.1, position.z);
    raycaster.set(origin, rayDown);
    // Use a distance that can detect ground below the player
    raycaster.far = 2.0; // Increased from halfPlayerHeight + 0.1

    // Find collisions with the actual meshes in the scene
    const intersects = raycaster.intersectObjects(scene.children, true); 

    if (intersects.length > 0) {
        // Find the highest ground surface (closest intersection)
        let highestGround = intersects[0];
        for (const intersect of intersects) {
            if (intersect.point.y > highestGround.point.y) {
                highestGround = intersect;
            }
        }
        return highestGround.point.y + halfPlayerHeight; // Return the position for the player's center
    }

    // Fallback to floor collision check for safety 
    const testPos = position.clone();
    for (let y = position.y; y >= 0; y -= 0.1) { // Smaller step for more precision
        testPos.y = y;
        const testBox = new THREE.Box3().setFromCenterAndSize(
            testPos,
            new THREE.Vector3(0.9, playerHeight, 0.9) // Slightly smaller than player for better collision
        );
        
        for (const box of collisionBoxes) {
            if (testBox.intersectsBox(box)) {
                return box.max.y + halfPlayerHeight;
            }
        }
        
        if (y <= halfPlayerHeight) {
            return halfPlayerHeight;
        }
    }
    
    return halfPlayerHeight;
}

// Check collision for a position - IMPROVED for 1x1x1 player
function checkCollision(position) {
    const testBox = new THREE.Box3().setFromCenterAndSize(
        position,
        new THREE.Vector3(0.9, 0.9, 0.9) // Changed from (1, 1, 1) to (0.9, 0.9, 0.9) for better collision
    );
    
    for (const box of collisionBoxes) {
        if (testBox.intersectsBox(box)) {
            return true;
        }
    }
    return false;
}

function updateCamera() {
    const cameraDistance = 8;
    const cameraHeightOffset = 1.8; // Camera offset from player center
    const aimHeightOffset = 1.5; // Where the camera looks on the player body
    const cosPitch = Math.cos(pitch);

    // 1. Calculate the ideal camera position (targetPos)
    const targetPos = new THREE.Vector3(
        player.position.x - Math.sin(yaw) * cameraDistance * cosPitch,
        player.position.y + Math.sin(pitch) * cameraDistance + cameraHeightOffset,
        player.position.z - Math.cos(yaw) * cameraDistance * cosPitch
    );

    // 2. Check for collisions between the player's center (plus offset) and the target camera position
    const playerCenterWithOffset = player.position.clone().setY(player.position.y + aimHeightOffset);
    
    cameraVector.subVectors(targetPos, playerCenterWithOffset).normalize();
    
    raycaster.set(playerCenterWithOffset, cameraVector);
    raycaster.far = targetPos.distanceTo(playerCenterWithOffset);

    // Filter to exclude 'player' and 'goal'
    const obstacles = scene.children.filter(obj => obj.name !== 'player' && obj.name !== 'goal');
    
    const intersects = raycaster.intersectObjects(obstacles, true);

    if (intersects.length > 0) {
        // Camera hit something, place it just before the intersection point
        const intersection = intersects[0];
        // Shorten the distance slightly from the intersection point to prevent z-fighting
        const actualDistance = intersection.distance - 0.2; 
        
        camera.position.copy(playerCenterWithOffset);
        camera.position.addScaledVector(cameraVector, actualDistance);
    } else {
        // No collision, use the ideal target position
        camera.position.copy(targetPos);
    }

    // 3. Make the camera look at the player with the vertical offset
    camera.lookAt(
        player.position.x,
        player.position.y + aimHeightOffset,
        player.position.z
    );
}

// Check for goal collision (rooftop door)
function checkGoal() {
    const playerBox = new THREE.Box3().setFromObject(player);
    const goal = scene.getObjectByName('goal');
    
    if (goal) {
        const goalBox = new THREE.Box3().setFromObject(goal);
        if (playerBox.intersectsBox(goalBox)) {
            alert('Congratulations! You escaped the massive building!');
            returnToMainCallback();
        }
    }
}

// Animation loop
function animate() {
    // Only update if game is not paused
    if (!window.isGamePaused || !window.isGamePaused()) {
        updatePlayer();
        updateBullets();        // Add this line
        updateBoxPhysics();     // Add this line - CRITICAL!
        checkGoal();
    }
    
    renderer.render(scene, camera);
    if (labelRenderer) {
        labelRenderer.render(scene, camera);
    }
}

// Cleanup
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
    
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("keyup", handleKeyUp);
    document.removeEventListener("pointerlockchange", onPointerLockChange);
    document.removeEventListener("mousemove", onMouseMove);
    
    if (renderer && renderer.domElement) {
         renderer.domElement.removeEventListener("click", requestLock);
    }
    
    collisionBoxes = [];
    movableBoxes = [];
    bullets = []; // Add this line to clear bullets
}