import * as THREE from 'three';
import { createGroundCollider } from "../physics/collider.js";
import * as BufferGeometryUtils from 'https://cdn.jsdelivr.net/npm/three@0.162.0/examples/jsm/utils/BufferGeometryUtils.js';
import { createTreeModel, getTreeColliderSize } from '../models/treeModel.js';
import { createBenchModel, getBenchColliderSize } from '../models/benchModel.js';
import { createCarModel, getCarColliderSize, getRandomCarColor } from '../models/carModel.js';

// Import token models
import {
    createBreadCrumbModel, getBreadCrumbColliderSize,
    createFrenchFryModel, getFrenchFryColliderSize,
    createPizzaCrustModel, getPizzaCrustColliderSize,
    createPopcornModel, getPopcornColliderSize,
    createPretzelModel, getPretzelColliderSize,
    createSeedModel, getSeedColliderSize,
    createHotDogBunModel, getHotDogBunColliderSize,
    createBagelBitModel, getBagelBitColliderSize
} from '../models/tokens/index.js';



    async function createBuildingMaterial() {
        const textureLoader = new THREE.TextureLoader();
        
        try {
            // Load all the PBR textures for your facade
            const colorMap = await textureLoader.loadAsync('./models/textures/Facade001_1K-JPG_Color.jpg');
            const normalMap = await textureLoader.loadAsync('./models/textures/Facade001_1K-JPG_NormalGL.jpg');
            const roughnessMap = await textureLoader.loadAsync('./models/textures/Facade001_1K-JPG_Roughness.jpg');
            const metalnessMap = await textureLoader.loadAsync('./models/textures/Facade001_1K-JPG_Metalness.jpg');
            const displacementMap = await textureLoader.loadAsync('./models/textures/Facade001_1K-JPG_Displacement.jpg');

            // Configure texture settings
            [colorMap, normalMap, roughnessMap, metalnessMap, displacementMap].forEach(texture => {
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                texture.colorSpace = THREE.SRGBColorSpace; // For color map only
            });

            // Create PBR material
            const buildingMat = new THREE.MeshStandardMaterial({
                map: colorMap,
                normalMap: normalMap,
                roughnessMap: roughnessMap,
                metalnessMap: metalnessMap,
                displacementMap: displacementMap,
                displacementScale: 0, // Adjust based on your displacement texture
                metalness: 0.1, // Base metalness
                roughness: 0.8, // Base roughness
            });

            return buildingMat;
        } catch (error) {
            console.warn('Failed to load facade textures, falling back to basic material:', error);
            // Fallback to basic material
            return new THREE.MeshStandardMaterial({ 
                color: 0x444444, 
                metalness: 0.3, 
                roughness: 0.6 
            });
        }
    }

export function createRoads(scene, roadLocations, cellSize) {
    const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });



    // Helper to group connected blocks along X or Z
    const grouped = {}; // key = row or column, value = array of positions

    // Group by Z first (horizontal roads along X)
    roadLocations.forEach(pos => {
        const zKey = pos.z.toFixed(2);
        if (!grouped[zKey]) grouped[zKey] = [];
        grouped[zKey].push(pos.x);
    });

    const roadMeshes = [];

    for (const zKey in grouped) {
        const xs = grouped[zKey].sort((a, b) => a - b);
        let start = xs[0];
        let end = xs[0];

        for (let i = 1; i <= xs.length; i++) {
            if (xs[i] === end + cellSize) {
                // consecutive block
                end = xs[i];
            } else {
                // create one long road strip
                const length = end - start + cellSize;
                const geo = new THREE.PlaneGeometry(length, cellSize * 0.8);
                geo.rotateX(-Math.PI / 2);
                geo.position.set((start + end) / 2, 0.01, parseFloat(zKey));
                roadMeshes.push(geo);

                // start new segment
                start = xs[i];
                end = xs[i];
            }
        }
    }

    // Merge all road geometries into one mesh for performance
    const finalGeometry = roadMeshes.length ? BufferGeometryUtils.mergeBufferGeometries(roadMeshes) : null;
    if(finalGeometry) {
        const roadMesh = new THREE.Mesh(finalGeometry, roadMaterial);
        scene.add(roadMesh);
    }

    return roadMesh;
}

export const playerStartPosition = { x: -10, y: 5, z: 5 };


export async function createLevel() {
    const scene = new THREE.Scene();

    scene.userData.treeColliders = [];
    scene.userData.benchColliders = [];
    scene.userData.carColliders = [];


    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 20, 120);

    const camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        4000
    );

    camera.position.set(0, 300, 500);
    camera.lookAt(0, 0, 0);
    camera.fov = 60;
    camera.updateProjectionMatrix();

    // Lighting: keep shadows limited for perf (enable in renderer)
    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(100, 300, 100);
    // light.castShadow = true; // turn on only when you need it
    scene.add(light);
    const ambient = new THREE.AmbientLight(0x404040, 0.9);
    scene.add(ambient);

    const cellSize = 50;
    const gridSize = 25;
    const worldSize = gridSize * cellSize;

    // Ground (big)
    const groundGeo = new THREE.PlaneGeometry(worldSize, worldSize);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const groundCollider = createGroundCollider(ground);
    scene.userData.groundCollider = groundCollider;

    // === Dense city layout ===
    const layout = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,1,2,2,1,4,2,1,2,1,3,2,1,2,1,4,1,3,1,2,1,2,2,1],
    [1,1,1,2,1,1,1,2,1,2,1,1,3,1,4,1,2,1,1,1,2,1,1,2,1],
    [1,2,2,3,2,1,2,2,1,4,2,2,3,1,2,2,2,1,2,3,4,1,2,2,1],
    [1,1,1,1,2,1,1,1,1,3,1,1,1,1,2,1,1,1,2,1,1,1,4,1,1],
    [1,2,1,2,3,4,3,1,2,3,2,2,1,2,2,1,3,4,2,1,2,4,1,2,1],
    [1,1,1,1,1,1,2,1,1,1,1,3,1,1,2,1,1,1,1,1,2,1,1,1,1],
    [1,2,3,3,1,2,4,1,2,3,1,4,3,1,2,1,3,3,4,1,2,3,4,3,1],
    [1,2,1,1,1,1,2,1,1,1,1,1,1,1,2,1,1,1,2,1,1,1,1,2,1],
    [1,3,1,4,3,4,2,4,3,1,2,3,1,2,3,2,4,1,3,4,3,1,4,2,1],
    [1,1,1,1,3,1,1,1,1,1,1,4,1,1,3,1,1,1,1,1,2,1,1,1,1],
    [1,2,1,3,2,1,2,3,1,2,1,2,2,2,2,1,2,1,3,1,4,3,2,3,1],
    [1,1,1,1,1,1,4,1,1,1,1,1,1,1,2,1,1,1,2,1,1,1,1,2,1],
    [1,3,3,4,3,4,3,1,2,3,1,4,3,1,2,2,3,1,2,3,3,1,3,4,1],
    [1,1,1,1,1,1,2,1,1,1,1,3,1,1,2,1,1,1,1,1,2,1,1,1,1],
    [1,2,1,2,3,2,3,1,2,3,1,2,3,1,2,1,3,1,3,1,2,2,1,3,1],
    [1,1,1,3,1,1,1,2,1,4,1,1,3,1,2,1,3,1,1,1,3,1,1,4,1],
    [1,2,3,4,2,1,3,2,1,4,3,3,3,1,3,2,3,1,3,4,2,1,2,3,1],
    [1,1,1,1,2,1,1,1,1,2,1,1,1,1,3,1,1,1,2,1,1,1,4,1,1],
    [1,2,1,2,3,2,3,1,2,3,1,2,3,1,2,1,3,1,3,1,2,2,1,3,1],
    [1,1,1,1,1,1,2,1,1,1,1,4,1,1,3,1,1,1,1,1,2,1,1,1,1],
    [1,2,4,3,1,3,2,1,2,4,1,4,2,1,2,1,3,3,2,1,3,2,4,3,1],
    [1,2,1,1,1,1,2,1,1,1,1,1,1,1,3,1,1,1,2,1,1,1,1,2,1],
    [1,3,3,4,3,4,3,1,2,3,1,4,3,1,3,2,3,1,2,3,3,1,3,4,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    ];
    

    // === Building generator ===
    // === PBR Building Material with Facade Textures ===

    const buildings = [];
    const offset = (layout.length / 2) * cellSize;

    // Create building material (you might want to make this async)
    const buildingMat = await createBuildingMaterial();

    for (let z = 0; z < layout.length; z++) {
        for (let x = 0; x < layout[z].length; x++) {
            if (layout[z][x] === 1) {
                const width = 40 + Math.random() * 10;
                const height = 60 + Math.random() * 120;
                const depth = 40 + Math.random() * 10;
                const buildingGeo = new THREE.BoxGeometry(width, height, depth);
                const building = new THREE.Mesh(buildingGeo, buildingMat);

                building.position.set(x * cellSize - offset, height / 2, z * cellSize - offset);
                building.castShadow = true; // Enable shadows for better visuals
                building.receiveShadow = true;
                scene.add(building);

                // Calculate texture repetition based on building size
                const repeatX = width / 10; // Adjust divisor to control texture density
                const repeatY = height / 10;
                
                // Apply texture scaling to all material maps
                if (buildingMat.map) buildingMat.map.repeat.set(repeatX, repeatY);
                if (buildingMat.normalMap) buildingMat.normalMap.repeat.set(repeatX, repeatY);
                if (buildingMat.roughnessMap) buildingMat.roughnessMap.repeat.set(repeatX, repeatY);
                if (buildingMat.metalnessMap) buildingMat.metalnessMap.repeat.set(repeatX, repeatY);
                if (buildingMat.displacementMap) buildingMat.displacementMap.repeat.set(repeatX, repeatY);

                const buildingBox = new THREE.Box3();
                buildingBox.setFromCenterAndSize(
                    building.position,
                    new THREE.Vector3(width, height, depth)
                );

                building.userData.collider = buildingBox;
                building.userData.isBuilding = true;
                buildings.push(building);
            }
        }
    }


    
    // --- UTIL: convert grid coord to world coords (center of cell) ---
    function gridToWorld(gridX, gridZ) {
        const worldX = gridX * cellSize - offset;
        const worldZ = gridZ * cellSize - offset;
        return { x: worldX, z: worldZ };
    }

    // --- NEW: Find empty world spaces after buildings are placed ---
    function parseLayoutToWorld(layout, cellSize) {
        const elements = {
            roads: [],
            parks: [],
            parkingLots: [],
            buildings: []
        };

        const offset = (layout.length / 2) * cellSize;

        function gridToWorld(gridX, gridZ) {
            return {
                x: gridX * cellSize - offset,
                z: gridZ * cellSize - offset
            };
        }

        for (let z = 0; z < layout.length; z++) {
            for (let x = 0; x < layout[z].length; x++) {
                const world = gridToWorld(x, z);
                const value = layout[z][x];

                switch (value) {
                    case 1: // building
                        elements.buildings.push(world);
                        break;
                    case 2: // road
                        elements.roads.push(world);
                        break;
                    case 3: // park
                        elements.parks.push(world);
                        break;
                    case 4: // parking lot
                        elements.parkingLots.push(world);
                        break;
                }
            }
        }

        return elements;
    }


    const layoutData = parseLayoutToWorld(layout, cellSize);
        //roads
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x1e1e1e });
    const roadGroup = new THREE.Group();


    layoutData.roads.forEach((road, index) => {
        const geo = new THREE.PlaneGeometry(cellSize, cellSize);
        const mesh = new THREE.Mesh(geo, roadMat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(road.x, 0.01, road.z);
        
        // Road collider for token placement
        const roadCollider = new THREE.Box3();
        roadCollider.setFromCenterAndSize(
            new THREE.Vector3(road.x, 0, road.z),
            new THREE.Vector3(cellSize, 1, cellSize)
        );
        mesh.userData.collider = roadCollider;
        mesh.userData.isRoad = true;

        roadGroup.add(mesh);

    });
    scene.add(roadGroup);

// === SIDEWALKS AROUND BUILDINGS ===
const sidewalks = new THREE.Group();
const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x9a9a9a });
const sidewalkHeight = 0.4;
const sidewalkWidth = 4; // distance from building wall
const sidewalkThickness = 5; // how wide the sidewalk strip is

for (const building of buildings) {
    const { x, z } = building.position;
    const size = new THREE.Vector3();
    building.geometry.computeBoundingBox();
    building.geometry.boundingBox.getSize(size);

    const halfW = size.x / 2;
    const halfD = size.z / 2;
    const y = sidewalkHeight / 2; // slightly above ground

    // FRONT sidewalk
    const frontGeo = new THREE.BoxGeometry(size.x + sidewalkWidth * 2, sidewalkHeight, sidewalkThickness);
    const frontMesh = new THREE.Mesh(frontGeo, sidewalkMat);
    frontMesh.position.set(x, y, z + halfD + sidewalkThickness / 2);
    sidewalks.add(frontMesh);

    // BACK sidewalk
    const backGeo = new THREE.BoxGeometry(size.x + sidewalkWidth * 2, sidewalkHeight, sidewalkThickness);
    const backMesh = new THREE.Mesh(backGeo, sidewalkMat);
    backMesh.position.set(x, y, z - halfD - sidewalkThickness / 2);
    sidewalks.add(backMesh);

    // LEFT sidewalk
    const leftGeo = new THREE.BoxGeometry(sidewalkThickness, sidewalkHeight, size.z + sidewalkWidth * 2);
    const leftMesh = new THREE.Mesh(leftGeo, sidewalkMat);
    leftMesh.position.set(x - halfW - sidewalkThickness / 2, y, z);
    sidewalks.add(leftMesh);

    // RIGHT sidewalk
    const rightGeo = new THREE.BoxGeometry(sidewalkThickness, sidewalkHeight, size.z + sidewalkWidth * 2);
    const rightMesh = new THREE.Mesh(rightGeo, sidewalkMat);
    rightMesh.position.set(x + halfW + sidewalkThickness / 2, y, z);
    sidewalks.add(rightMesh);
}

scene.add(sidewalks);
console.log(`Generated ${sidewalks.children.length} sidewalks around buildings.`);

    // -----------------------------------------
    // PARKS: create a few grassy plazas with instanced trees & benches
    // -----------------------------------------
    const parkColor = 0x7a105;
    const parkMaterial = new THREE.MeshStandardMaterial({ color: parkColor, roughness: 0.3, metalness: 0 });

 
    function makePark(worldX, worldZ, size) {
    const grassGeo = new THREE.PlaneGeometry(size, size);
    const grassMesh = new THREE.Mesh(grassGeo, parkMaterial);
    grassMesh.rotation.x = -Math.PI / 2;
    grassMesh.position.set(worldX, 0.01, worldZ);
    grassMesh.receiveShadow = false;
    scene.add(grassMesh);

    // Instanced Trees using actual tree models
    const treeCount = Math.max(6, Math.floor((size * size) / 400));
    const localTreeColliders = [];
    
    for (let i = 0; i < treeCount; i++) {
        const rx = worldX + (Math.random() - 0.5) * (size * 0.8);
        const rz = worldZ + (Math.random() - 0.5) * (size * 0.8);
        
        const tree = createTreeModel();
        tree.position.set(rx, 0, rz);
        tree.rotation.y = Math.random() * Math.PI;
        scene.add(tree);
        
        // Create collider
        const treeSize = getTreeColliderSize();
        const bbox = new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(rx, treeSize.height / 2, rz),
            new THREE.Vector3(treeSize.width, treeSize.height, treeSize.depth)
        );
        localTreeColliders.push(bbox);
    }

    // Store in scene for collision checks
    scene.userData.treeColliders.push(...localTreeColliders);

    // Instanced benches using actual bench models
    const benchCount = Math.max(2, Math.floor(treeCount / 3));
    const localBenchColliders = [];
    
    for (let i = 0; i < benchCount; i++) {
        const bx = worldX + (Math.random() - 0.5) * size * 0.6;
        const bz = worldZ + (Math.random() - 0.5) * size * 0.6;
        
        const bench = createBenchModel();
        bench.position.set(bx, 0, bz);
        scene.add(bench);
        
        // Create collider
        const benchSize = getBenchColliderSize();
        const bbox = new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(bx, benchSize.height / 2, bz),
            new THREE.Vector3(benchSize.width, benchSize.height, benchSize.depth)
        );
        localBenchColliders.push(bbox);
    }
    
    scene.userData.benchColliders.push(...localBenchColliders);

    return grassMesh;
}



    // Create parks in found empty spaces
    const parks = [];
    layoutData.parks.forEach((space, index) => {
        // Use smaller parks to ensure they fit
        const parkSize = 50;

        const park = makePark(space.x, space.z, parkSize);
        if (park) {
            parks.push(park);
            console.log(`Created park ${index + 1} at (${space.x.toFixed(1)}, ${space.z.toFixed(1)}) size: ${parkSize}`);
        }
    });


    // -----------------------------------------
    // PARKING LOTS: paved areas + instanced cars (low-poly boxes)
    // -----------------------------------------

function makeParkingLot(worldX, worldZ, width, depth) {
    const lotGeo = new THREE.PlaneGeometry(width, depth);
    const lotMat = new THREE.MeshStandardMaterial({ color: 0x2e2e2e });
    const lot = new THREE.Mesh(lotGeo, lotMat);
    lot.rotation.x = -Math.PI / 2;
    lot.position.set(worldX, 0.02, worldZ);
    scene.add(lot);

    const spotWidth = 8;
    const spotDepth = 16;
    const cols = Math.floor((width * 0.9) / spotWidth);
    const rows = Math.floor((depth * 0.9) / spotDepth);

    const localCarColliders = [];

    let idx = 0;
    for (let r = 0; r < rows && idx < 50; r++) {
        for (let c = 0; c < cols && idx < 50; c++) {
            const cx = worldX + (c - cols / 2 + 0.5) * spotWidth;
            const cz = worldZ + (r - rows / 2 + 0.5) * spotDepth;
            const carX = cx + (Math.random()-0.5)*1;
            const carZ = cz + (Math.random()-0.5)*0.5;
            
            const car = createCarModel(getRandomCarColor());
            car.position.set(carX, 0.6, carZ);
            scene.add(car);
            
            // Create collider
            const carSize = getCarColliderSize();
            const bbox = new THREE.Box3().setFromCenterAndSize(
                new THREE.Vector3(carX, 0.6, carZ),
                new THREE.Vector3(carSize.width, carSize.height, carSize.depth)
            );
            localCarColliders.push(bbox);
            idx++;
        }
    }
    
    scene.userData.carColliders.push(...localCarColliders);

    return lot;
}

    // Create parking lots in found empty spaces
    const parkingLots = [];
    layoutData.parkingLots.forEach((space, index) => {
        // Ensure reasonable sizes
        const lotWidth = 50;
        const lotDepth = 60;
        const lot = makeParkingLot(space.x, space.z, lotWidth, lotDepth);
        if (lot) {
            parkingLots.push(lot);
            console.log(`Created parking lot ${index + 1} at (${space.x.toFixed(1)}, ${space.z.toFixed(1)}) size: ${lotWidth}x${lotDepth}`);
        }
    });

    
// === Collectible Tokens - Air Spawning with Compatibility ===
const collectibles = [];
const tokenTypes = [
    { 
        name: "Bread Crumb", 
        color: 0xf5deb3, 
        createModel: createBreadCrumbModel,
        getColliderSize: getBreadCrumbColliderSize,
        size: 0.3 // ADD THIS for all token types
    },
    { 
        name: "French Fry", 
        color: 0xffd700, 
        createModel: createFrenchFryModel,
        getColliderSize: getFrenchFryColliderSize,
        size: 0.4
    },
    { 
        name: "Pizza Crust", 
        color: 0xd2691e, 
        createModel: createPizzaCrustModel,
        getColliderSize: getPizzaCrustColliderSize,
        size: 0.5
    },
    { 
        name: "Popcorn", 
        color: 0xfff8dc, 
        createModel: createPopcornModel,
        getColliderSize: getPopcornColliderSize,
        size: 0.2
    },
    { 
        name: "Pretzel", 
        color: 0x8b4513, 
        createModel: createPretzelModel,
        getColliderSize: getPretzelColliderSize,
        size: 0.4
    },
    { 
        name: "Seed", 
        color: 0xdaa520, 
        createModel: createSeedModel,
        getColliderSize: getSeedColliderSize,
        size: 0.2
    },
    { 
        name: "Hot Dog Bun", 
        color: 0xffe4b5, 
        createModel: createHotDogBunModel,
        getColliderSize: getHotDogBunColliderSize,
        size: 0.5
    },
    { 
        name: "Bagel Bit", 
        color: 0xf0e68c, 
        createModel: createBagelBitModel,
        getColliderSize: getBagelBitColliderSize,
        size: 0.4
    }
];

// --- UTIL: Get height at position for token placement ---
// FIXED: Now properly uses collision boxes to find surfaces
// === DEBUG TOKEN PLACEMENT SYSTEM ===
let debugTokens = []; // Store debug information

// Enhanced debug version of getTokenHeightAtPosition
function getTokenHeightAtPosition(worldX, worldZ, tokenHalfHeight = 0.25, allowAir = true, debugId = null) {
    let bestSurfaceY = 0;
    let surfaceType = "ground";
    const testPoint = new THREE.Vector3(worldX, 0, worldZ);
    
    // Check all collision objects
    for (const building of buildings) {
        if (building.userData.collider) {
            if (Math.abs(worldX - building.position.x) <= (building.geometry.parameters.width / 2) &&
                Math.abs(worldZ - building.position.z) <= (building.geometry.parameters.depth / 2)) {
                const roofY = building.position.y + (building.geometry.parameters.height / 2);
                if (roofY > bestSurfaceY) {
                    bestSurfaceY = roofY;
                    surfaceType = "building_roof";
                }
            }
        }
    }
    
    for (const road of roadGroup.children) {
        if (road.userData.collider && road.userData.collider.containsPoint(testPoint)) {
            const roadY = road.position.y + 0.01;
            if (roadY > bestSurfaceY) {
                bestSurfaceY = roadY;
                surfaceType = "road";
            }
        }
    }
    
    for (const sidewalk of sidewalks.children) {
        if (sidewalk.userData.collider && sidewalk.userData.collider.containsPoint(testPoint)) {
            const sidewalkY = sidewalk.position.y + (sidewalkHeight / 2);
            if (sidewalkY > bestSurfaceY) {
                bestSurfaceY = sidewalkY;
                surfaceType = "sidewalk";
            }
        }
    }
    
    for (const park of parks) {
        if (park.userData && park.userData.collider && park.userData.collider.containsPoint(testPoint)) {
            const parkY = park.position.y + 0.01;
            if (parkY > bestSurfaceY) {
                bestSurfaceY = parkY;
                surfaceType = "park";
            }
        }
    }
    
    for (const parkingLot of parkingLots) {
        if (parkingLot.userData && parkingLot.userData.collider && parkingLot.userData.collider.containsPoint(testPoint)) {
            const lotY = parkingLot.position.y + 0.02;
            if (lotY > bestSurfaceY) {
                bestSurfaceY = lotY;
                surfaceType = "parking_lot";
            }
        }
    }
    
    let finalHeight;
    let placementType = "surface";
    
    if (bestSurfaceY > 0) {
        finalHeight = bestSurfaceY + tokenHalfHeight + 0.05;
    
    } else {
        finalHeight = tokenHalfHeight + 0.05;
        placementType = "ground";
    }
    
    // Store debug information
    if (debugId !== null) {
        debugTokens.push({
            id: debugId,
            x: worldX,
            z: worldZ,
            height: finalHeight,
            surfaceType: surfaceType,
            placementType: placementType,
            surfaceY: bestSurfaceY
        });
    }
    
    return finalHeight;
}

// Enhanced debug version of isPositionValidForToken
function isPositionValidForToken(worldX, worldZ, worldY, tokenHalfSize = 0.25, debugId = null) {
    const pad = 0.1;
    const tokenBox = new THREE.Box3();
    tokenBox.setFromCenterAndSize(
        new THREE.Vector3(worldX, worldY, worldZ),
        new THREE.Vector3(tokenHalfSize * 2 + pad, tokenHalfSize * 2 + pad, tokenHalfSize * 2 + pad)
    );
    
    let collisionType = "none";
    
    // Check all collision types
    for (const building of buildings) {
        if (building.userData.collider && building.userData.collider.intersectsBox(tokenBox)) {
            collisionType = "building";
            break;
        }
    }
    
    if (collisionType === "none") {
        for (const treeCollider of scene.userData.treeColliders) {
            if (treeCollider.intersectsBox(tokenBox)) {
                collisionType = "tree";
                break;
            }
        }
    }
    
    if (collisionType === "none") {
        for (const benchCollider of scene.userData.benchColliders) {
            if (benchCollider.intersectsBox(tokenBox)) {
                collisionType = "bench";
                break;
            }
        }
    }
    
    if (collisionType === "none") {
        for (const carCollider of scene.userData.carColliders) {
            if (carCollider.intersectsBox(tokenBox)) {
                collisionType = "car";
                break;
            }
        }
    }
    
    // Update debug info if this token has debug data
    if (debugId !== null) {
        const debugToken = debugTokens.find(t => t.id === debugId);
        if (debugToken) {
            debugToken.collisionType = collisionType;
            debugToken.valid = collisionType === "none";
        }
    }
    
    return collisionType === "none";
}

// Function to visualize debug information
function createDebugVisualization() {
    const debugGroup = new THREE.Group();
    
    debugTokens.forEach((debugToken, index) => {
        // Create a colored marker based on placement type
        const markerGeometry = new THREE.SphereGeometry(0.5, 8, 6);
        let markerColor;
        
        switch (debugToken.placementType) {
            case "air": markerColor = 0x00ff00; break; // Green for air
            case "surface": markerColor = 0x0000ff; break; // Blue for surface
            case "ground": markerColor = 0xffff00; break; // Yellow for ground
            default: markerColor = 0xff0000; // Red for unknown
        }
        
        const markerMaterial = new THREE.MeshBasicMaterial({ 
            color: markerColor,
            transparent: true,
            opacity: 0.7
        });
        
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.position.set(debugToken.x, debugToken.height + 1, debugToken.z);
        debugGroup.add(marker);
        
        // Add text label (you'll need THREE.TextGeometry for this)
        // For now, just log the information
        console.log(`Token ${index}:`, {
            position: `(${debugToken.x.toFixed(1)}, ${debugToken.z.toFixed(1)})`,
            height: debugToken.height.toFixed(1),
            surface: debugToken.surfaceType,
            placement: debugToken.placementType,
            collision: debugToken.collisionType || "none",
            valid: debugToken.valid !== false
        });
    });
    
    scene.add(debugGroup);
    return debugGroup;
}

// Add this function to check if a position is within world bounds
function isPositionInBounds(x, z, worldSize) {
    const halfSize = worldSize / 2;
    return Math.abs(x) <= halfSize && Math.abs(z) <= halfSize;
}

// Replace your existing token creation section with this enhanced version:

console.log("Creating tokens in north-eastern diagonal line...");

const diagonalTokensCount = 5;
const spacing = 15;
const minRadius = 3;
const maxRadius = 8;
const TOKEN_SCALE_FACTOR = 2.0;

for (let i = 0; i < diagonalTokensCount; i++) {
    const tokenType = tokenTypes[Math.floor(Math.random() * tokenTypes.length)];
    const token = tokenType.createModel();
    
    token.scale.set(TOKEN_SCALE_FACTOR, TOKEN_SCALE_FACTOR, TOKEN_SCALE_FACTOR);
    
    const distance = (i + 1) * spacing;
    const posX = 0 - distance;
    const posZ = 0 + distance;

    const radius = minRadius + Math.random() * (maxRadius - minRadius);
    const angle = Math.random() * Math.PI * 2;
    let finalX = posX + Math.cos(angle) * radius;
    let finalZ = posZ + Math.sin(angle) * radius;

    // BOUNDS CHECKING - Skip if out of bounds
    if (!isPositionInBounds(finalX, finalZ, worldSize)) {
        console.warn(`Diagonal token ${i} out of bounds at (${finalX.toFixed(1)}, ${finalZ.toFixed(1)}), skipping`);
        continue;
    }

    const tokenHalf = tokenType.size / 2;
    const debugId = `diagonal_${i}`;
    
    let tokenHeight = getTokenHeightAtPosition(finalX, finalZ, tokenHalf, false, debugId);

    let placed = isPositionValidForToken(finalX, finalZ, tokenHeight, tokenHalf, debugId);
    let tries = 0;
    
    while (!placed && tries < 8) {
        tries++;
        const testY = tokenHeight + tries * 2;
        if (isPositionValidForToken(finalX, finalZ, testY, tokenHalf, debugId)) {
            tokenHeight = testY;
            placed = true;
            const debugToken = debugTokens.find(t => t.id === debugId);
            if (debugToken) {
                debugToken.adjusted = true;
                debugToken.adjustmentTries = tries;
                debugToken.finalHeight = tokenHeight;
            }
            break;
        }
        
        const jitter = 1 + tries * 0.6;
        const newAngle = Math.random() * Math.PI * 2;
        const nx = posX + Math.cos(newAngle) * (radius * (0.8 + Math.random() * 0.4));
        const nz = posZ + Math.sin(newAngle) * (radius * (0.8 + Math.random() * 0.4));
        
        // BOUNDS CHECKING for new position
        if (!isPositionInBounds(nx, nz, worldSize)) {
            continue;
        }
        
        const newY = getTokenHeightAtPosition(nx, nz, tokenHalf, true, debugId);
        if (isPositionValidForToken(nx, nz, newY, tokenHalf, debugId)) {
            finalX = nx; finalZ = nz; tokenHeight = newY; 
            placed = true; 
            const debugToken = debugTokens.find(t => t.id === debugId);
            if (debugToken) {
                debugToken.adjusted = true;
                debugToken.adjustmentTries = tries;
                debugToken.repositioned = true;
                debugToken.finalPosition = { x: finalX, z: finalZ };
                debugToken.finalHeight = tokenHeight;
            }
            break;
        }
    }

    if (!placed) {
        console.warn(`Could not place diagonal token ${i}, skipping`);
        const debugToken = debugTokens.find(t => t.id === debugId);
        if (debugToken) debugToken.failed = true;
        continue;
    }

    token.position.set(finalX, tokenHeight, finalZ);
    token.userData = { 
        type: tokenType.name, 
        collected: false, 
        value: 1, 
        showOnMinimap: true 
    };
    
    token.rotation.x = Math.random() * Math.PI;
    token.rotation.y = Math.random() * Math.PI;
    token.rotation.z = Math.random() * Math.PI;

    scene.add(token);
    collectibles.push(token);

    console.log(`Created ${tokenType.name} at (${finalX.toFixed(1)}, ${finalZ.toFixed(1)}) height: ${tokenHeight.toFixed(1)}`);
}



console.log("Creating remaining tokens using layout matrix...");
const tokensToCreate = 15;
let tokensCreated = 0;
let attempts = 0;
const maxAttempts = 800;

while (tokensCreated < tokensToCreate && attempts < maxAttempts) {
    attempts++;

    const gridX = Math.floor(Math.random() * layout[0].length);
    const gridZ = Math.floor(Math.random() * layout.length);

    if (layout[gridZ][gridX] === 2 || layout[gridZ][gridX] === 3 || layout[gridZ][gridX] === 4) {
        const tokenType = tokenTypes[Math.floor(Math.random() * tokenTypes.length)];
        const token = tokenType.createModel();
        token.scale.set(TOKEN_SCALE_FACTOR, TOKEN_SCALE_FACTOR, TOKEN_SCALE_FACTOR);

        // Convert grid to world
        const world = gridToWorld(gridX, gridZ);
        const variation = cellSize * 0.3;
        let finalX = world.x + (Math.random() - 0.5) * variation;
        let finalZ = world.z + (Math.random() - 0.5) * variation;

        // BOUNDS CHECKING
        if (!isPositionInBounds(finalX, finalZ, worldSize)) {
            // Try to bring it back within bounds
            finalX = Math.max(-worldSize/2, Math.min(worldSize/2, finalX));
            finalZ = Math.max(-worldSize/2, Math.min(worldSize/2, finalZ));
        }

        const tokenHalf = tokenType.size / 2;
        const debugId = `remaining_${tokensCreated}`;
        
        let tokenHeight = getTokenHeightAtPosition(finalX, finalZ, tokenHalf, false, debugId);

        let placed = isPositionValidForToken(finalX, finalZ, tokenHeight, tokenHalf, debugId);
        let localTries = 0;
        
        while (!placed && localTries < 10) {
            localTries++;
            const tryY = tokenHeight + localTries * 2;
            if (isPositionValidForToken(finalX, finalZ, tryY, tokenHalf, debugId)) {
                tokenHeight = tryY; 
                placed = true; 
                const debugToken = debugTokens.find(t => t.id === debugId);
                if (debugToken) {
                    debugToken.adjusted = true;
                    debugToken.adjustmentTries = localTries;
                    debugToken.finalHeight = tokenHeight;
                }
                break;
            }
            
            finalX = world.x + (Math.random() - 0.5) * variation;
            finalZ = world.z + (Math.random() - 0.5) * variation;
            
            // BOUNDS CHECKING for new position
            if (!isPositionInBounds(finalX, finalZ, worldSize)) {
                finalX = Math.max(-worldSize/2, Math.min(worldSize/2, finalX));
                finalZ = Math.max(-worldSize/2, Math.min(worldSize/2, finalZ));
            }
            
            tokenHeight = getTokenHeightAtPosition(finalX, finalZ, tokenHalf, true, debugId);
            if (isPositionValidForToken(finalX, finalZ, tokenHeight, tokenHalf, debugId)) {
                placed = true; 
                const debugToken = debugTokens.find(t => t.id === debugId);
                if (debugToken) {
                    debugToken.adjusted = true;
                    debugToken.adjustmentTries = localTries;
                    debugToken.repositioned = true;
                    debugToken.finalPosition = { x: finalX, z: finalZ };
                    debugToken.finalHeight = tokenHeight;
                }
                break;
            }
        }

        if (!placed) {
            const debugToken = debugTokens.find(t => t.id === debugId);
            if (debugToken) debugToken.failed = true;
            continue;
        }

        token.position.set(finalX, tokenHeight, finalZ);
        token.userData = { 
            type: tokenType.name, 
            collected: false, 
            value: 1, 
            showOnMinimap: true 
        };
        
        token.rotation.x = Math.random() * Math.PI;
        token.rotation.y = Math.random() * Math.PI;
        token.rotation.z = Math.random() * Math.PI;

        scene.add(token);
        collectibles.push(token);
        tokensCreated++;

        console.log(`Created ${tokenType.name} at grid [${gridZ}][${gridX}] -> world (${finalX.toFixed(1)}, ${finalZ.toFixed(1)}) height: ${tokenHeight.toFixed(1)}`);
    }
}

    if (tokensCreated < tokensToCreate) {
        console.warn(`Only created ${tokensCreated} of ${tokensToCreate} ground tokens after ${attempts} attempts`);
    }

    // Maintain original tokenPositions structure for minimap compatibility
    scene.userData.tokenPositions = collectibles.map(token => ({
        x: token.position.x,
        z: token.position.z,
        color: token.userData.type ? 
            tokenTypes.find(t => t.name === token.userData.type)?.color || 0xffffff 
        : 0xffffff,
        collected: false,
        type: token.userData.type
    }));

    scene.userData.buildings = buildings;
    scene.userData.collectibles = collectibles;
    scene.userData.parks = parks;
    scene.userData.parkingLots = parkingLots;
    scene.userData.sidewalks = sidewalks.children;
    
    console.log('buildings:', buildings.length);
    console.log('parks:', parks ? parks.length : 0);
    console.log('parking lots:', parkingLots ? parkingLots.length : 0);
    console.log('sidewalks:', sidewalks.children.length);
    console.log('tokens:', collectibles.length);

    console.log(`Stored ${scene.userData.tokenPositions.length} token positions for minimap`);

    console.log(`Total collectibles created: ${collectibles.length}`);
    console.log("Tokens placed at various heights including air and flying-only tokens!");


    // Add this debug function to check collisions
function debugPlayerCollision(playerX, playerZ) {
    const playerBox = new THREE.Box3();
    playerBox.setFromCenterAndSize(
        new THREE.Vector3(playerX, 0, playerZ),
        new THREE.Vector3(2, 2, 2) // Approximate player size
    );
    
    // Check buildings
    buildings.forEach((building, i) => {
        if (building.userData.collider.intersectsBox(playerBox)) {
            console.log(`Player colliding with building ${i} at`, building.position);
        }
    });
    
    // Check sidewalks (if they have colliders)
    sidewalks.children.forEach((sidewalk, i) => {
        if (sidewalk.userData.collider && sidewalk.userData.collider.intersectsBox(playerBox)) {
            console.log(`Player colliding with sidewalk ${i} at`, sidewalk.position);
        }
    });
}

// Add this function to check token placement in real-time
function printTokenDebugSummary() {
    console.log("=== TOKEN PLACEMENT DEBUG SUMMARY ===");
    console.log(`Total tokens placed: ${collectibles.length}`);
    console.log(`Total debug tokens: ${debugTokens.length}`);
    
    const placementStats = {};
    const surfaceStats = {};
    
    debugTokens.forEach(token => {
        placementStats[token.placementType] = (placementStats[token.placementType] || 0) + 1;
        surfaceStats[token.surfaceType] = (surfaceStats[token.surfaceType] || 0) + 1;
    });
    
    console.log("Placement Types:", placementStats);
    console.log("Surface Types:", surfaceStats);
    console.log("Failed placements:", debugTokens.filter(t => t.failed).length);
    console.log("Adjusted placements:", debugTokens.filter(t => t.adjusted).length);
    console.log("================================");
}
createDebugVisualization();

printTokenDebugSummary();


console.log('Collision objects loaded:');
console.log('- Buildings:', scene.userData.buildings?.length || 0);
console.log('- Tree colliders:', scene.userData.treeColliders?.length || 0); // FIXED NAME
console.log('- Bench colliders:', scene.userData.benchColliders?.length || 0); // FIXED NAME
console.log('- Car colliders:', scene.userData.carColliders?.length || 0); // FIXED NAME

return { scene, camera };
}

