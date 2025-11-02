import * as THREE from 'three';
import { LOD } from 'three';
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
        const roadMesh = new THREE.Mesh(finalGeometry, roadMaterial.clone());
        scene.add(roadMesh);
    }

    return roadMesh;
}

export const playerStartPosition = { x: -10, y: 5, z: 5 };


export async function createLevel() {
    const scene = new THREE.Scene();

    // ─────────────────────────────────────────────────────────────────────────────
//  BUILDING MATERIAL – RANDOM FACADE PER BUILDING
// ─────────────────────────────────────────────────────────────────────────────
async function createBuildingMaterial() {
    const textureLoader = new THREE.TextureLoader();

    // ---- 1. List every façade you own (add/remove as you add more) ----
    const FACADES = [
        '001',
        '005',
        '006',
        // '007',   // <-- just add the number when you drop a new set in /textures/
    ];

    // ---- 2. Pick ONE façade for THIS building (called each time) ----
    const id = FACADES[Math.floor(Math.random() * FACADES.length)];
    const base = `./models/textures/Facade${id}_1K-JPG_`;

    // ---- 3. Load the 5 PBR maps ------------------------------------------------
    const [colorMap, normalMap, roughnessMap, metalnessMap, displacementMap] = await Promise.all(
        [
            `${base}Color.jpg`,
            `${base}NormalGL.jpg`,
            `${base}Roughness.jpg`,
            `${base}Metalness.jpg`,
            `${base}Displacement.jpg`,
        ].map(url => textureLoader.loadAsync(url).catch(err => {
            console.warn(`Texture missing: ${url}`, err);
            return null;               // let the fallback handle it
        }))
    );

    // ---- 4. Configure repeat / color-space ------------------------------------
    const maps = [colorMap, normalMap, roughnessMap, metalnessMap, displacementMap];
    maps.forEach((tex, i) => {
        if (!tex) return;
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        if (i === 0) tex.colorSpace = THREE.SRGBColorSpace;   // only color map
    });

    // ---- 5. Build the material ------------------------------------------------
    const buildingMat = new THREE.MeshStandardMaterial({
        map:               colorMap,
        normalMap:         normalMap,
        roughnessMap:      roughnessMap,
        metalnessMap:      metalnessMap,
        displacementMap:   displacementMap,
        displacementScale: 0,               // tweak if you want real displacement
        metalness:         0.1,
        roughness:         0.8,
    });

    // ---- 6. Fallback if anything failed ---------------------------------------
    if (!colorMap) {
        console.warn(`Facade ${id} failed – using generic material`);
        return new THREE.MeshStandardMaterial({
            color: 0x444444, metalness: 0.3, roughness: 0.6
        });
    }
    return buildingMat;
}

// ---- CACHE LOW-DETAIL MATERIALS (simple color, no textures) ----
    const lowDetailMaterials = new Map();  // Cache by facade ID

    function getLowDetailMaterial(id) {
        if (lowDetailMaterials.has(id)) return lowDetailMaterials.get(id);

        const mat = new THREE.MeshStandardMaterial({
            color: 0x555555,  // Gray fallback color
            metalness: 0.1,
            roughness: 0.9
        });

        lowDetailMaterials.set(id, mat);
        return mat;
    }


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

// ─────────────────────────────────────────────────────────────────────────────
//  BUILDING LOOP – WITH LOD PER BUILDING
// ─────────────────────────────────────────────────────────────────────────────
for (let z = 0; z < layout.length; z++) {
    for (let x = 0; x < layout[z].length; x++) {
        if (layout[z][x] !== 1) continue;

        const width  = 40 + Math.random() * 10;
        const height = 60 + Math.random() * 120;
        const depth  = 40 + Math.random() * 10;

        // ---- HIGH-DETAIL (level 0) ----
        const highMat = await createBuildingMaterial();
        const highGeo = new THREE.BoxGeometry(width, height, depth);
        const highMesh = new THREE.Mesh(highGeo, highMat);

        // Texture repeat for high-detail
        const repeatX = width / 10;
        const repeatY = height / 10;
        [
            highMat.map,
            highMat.normalMap,
            highMat.roughnessMap,
            highMat.metalnessMap,
            highMat.displacementMap,
        ].forEach(tex => tex && tex.repeat.set(repeatX, repeatY));

        highMesh.castShadow = highMesh.receiveShadow = true;

        // ---- LOW-DETAIL (level 1) ----
        const lowId = highMat.name || 'default';  // Use facade ID or default
        const lowMat = getLowDetailMaterial(lowId);
        const lowGeo = new THREE.BoxGeometry(width, height, depth);  // Same geo, no textures
        const lowMesh = new THREE.Mesh(lowGeo, lowMat);
        lowMesh.castShadow = lowMesh.receiveShadow = true;

        // ---- CREATE LOD OBJECT ----
        const lod = new LOD();
        lod.addLevel(highMesh, 0);    // High at < 200 units
        lod.addLevel(lowMesh, 150);   // Low at > 150 units

        lod.position.set(
            x * cellSize - offset,
            height / 2,
            z * cellSize - offset
        );

        scene.add(lod);

        // ---- COLLIDER & USER-DATA (on LOD object) ----
        lod.updateMatrixWorld();
        const buildingBox = new THREE.Box3().setFromObject(lod);
        lod.userData.collider = buildingBox;
        lod.userData.isBuilding = true;
        buildings.push(lod);  // Push LOD instead of mesh
    }
}

    await new Promise(resolve => requestAnimationFrame(resolve)); 
    scene.updateMatrixWorld(true);


    
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
        const mesh = new THREE.Mesh(geo, roadMat.clone());
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

// === SIDEWALKS AROUND BUILDINGS (LOD-SAFE) ===
const sidewalks = new THREE.Group();
const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x9a9a9a });
const sidewalkHeight = 0.4;
const sidewalkWidth = 4; // distance from building wall
const sidewalkThickness = 5; // how wide the sidewalk strip is

for (const building of buildings) {
    // LOD has no .geometry → get size from collider (already computed)
    const box = building.userData.collider;
    if (!box) continue;

    const size = new THREE.Vector3();
    box.getSize(size);

    const halfW = size.x / 2;
    const halfD = size.z / 2;
    const x = building.position.x;
    const z = building.position.z;
    const y = sidewalkHeight / 2;

    // FRONT sidewalk
    const frontGeo = new THREE.BoxGeometry(size.x + sidewalkWidth * 2, sidewalkHeight, sidewalkThickness);
    const frontMesh = new THREE.Mesh(frontGeo, sidewalkMat.clone());
    frontMesh.position.set(x, y, z + halfD + sidewalkThickness / 2);
    sidewalks.add(frontMesh);

    // BACK sidewalk
    const backGeo = new THREE.BoxGeometry(size.x + sidewalkWidth * 2, sidewalkHeight, sidewalkThickness);
    const backMesh = new THREE.Mesh(backGeo, sidewalkMat.clone());
    backMesh.position.set(x, y, z - halfD - sidewalkThickness / 2);
    sidewalks.add(backMesh);

    // LEFT sidewalk
    const leftGeo = new THREE.BoxGeometry(sidewalkThickness, sidewalkHeight, size.z + sidewalkWidth * 2);
    const leftMesh = new THREE.Mesh(leftGeo, sidewalkMat.clone());
    leftMesh.position.set(x - halfW - sidewalkThickness / 2, y, z);
    sidewalks.add(leftMesh);

    // RIGHT sidewalk
    const rightGeo = new THREE.BoxGeometry(sidewalkThickness, sidewalkHeight, size.z + sidewalkWidth * 2);
    const rightMesh = new THREE.Mesh(rightGeo, sidewalkMat.clone());
    rightMesh.position.set(x + halfW + sidewalkThickness / 2, y, z);
    sidewalks.add(rightMesh);
}

scene.add(sidewalks);
console.log(`Generated ${sidewalks.children.length} sidewalks around buildings.`);

    // -----------------------------------------
    // PARKS: create a few grassy plazas with instanced trees & benches
    // -----------------------------------------
    const parkColor = 0x3d8b3d;
    const parkMaterial = new THREE.MeshStandardMaterial({ color: parkColor, roughness: 0.8, metalness: 0 });

 
    function makePark(worldX, worldZ, size) {
    const grassGeo = new THREE.PlaneGeometry(size, size);
    const grassMaterial = parkMaterial.clone();
    const grassMesh = new THREE.Mesh(grassGeo, grassMaterial);
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

        console.log('🧭 PLACING TOKENS IN OPEN SPACES...');
    
    const collectibles = [];
    const TOKEN_SCALE_FACTOR = 4.0;
    const totalTokens = 7; // Total tokens to place

    const tokenTypes = [
        { 
            name: "Bread Crumb", 
            color: 0xf5deb3, 
            createModel: createBreadCrumbModel,
            getColliderSize: getBreadCrumbColliderSize,
            size: 0.3
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

    // === FIND OPEN SPACES FOR TOKEN PLACEMENT ===
    function findOpenSpaces(layout, cellSize, offset) {
        const openSpaces = [];
        
        for (let z = 0; z < layout.length; z++) {
            for (let x = 0; x < layout[z].length; x++) {
                // Only place tokens in non-building areas (roads, parks, parking lots)
                if (layout[z][x] !== 1) {
                    const worldX = x * cellSize - offset;
                    const worldZ = z * cellSize - offset;
                    
                    // Add some randomness within the cell
                    const randomX = worldX + (Math.random() - 0.5) * cellSize * 0.8;
                    const randomZ = worldZ + (Math.random() - 0.5) * cellSize * 0.8;
                    
                    openSpaces.push({
                        x: randomX,
                        z: randomZ,
                        gridX: x,
                        gridZ: z,
                        type: layout[z][x] // 2=road, 3=park, 4=parking lot
                    });
                }
            }
        }
        
        return openSpaces;
    }

    // === CHECK IF POSITION IS CLEAR OF COLLIDERS ===
    function isPositionClear(x, y, z, tokenSize = 0.3) {
        const tokenBox = new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(x, y, z),
            new THREE.Vector3(tokenSize, tokenSize, tokenSize)
        );

        // Check against all colliders
        const allColliders = [
            ...buildings.map(b => b.userData.collider),
            ...scene.userData.treeColliders,
            ...scene.userData.benchColliders,
            ...scene.userData.carColliders
        ].filter(Boolean);

        for (const collider of allColliders) {
            if (collider.intersectsBox(tokenBox)) {
                return false;
            }
        }
        
        return true;
    }

    // === GET SURFACE HEIGHT AT POSITION ===
    function getSurfaceHeight(x, z) {
        // Default ground height
        let height = 0.3;
        
        // Check if on road
        for (const road of roadGroup.children) {
            if (road.userData.collider?.containsPoint(new THREE.Vector3(x, 0, z))) {
                return 0.1;
            }
        }
        
        // Check if on sidewalk
        for (const sidewalk of sidewalks.children) {
            const box = new THREE.Box3().setFromObject(sidewalk);
            if (box.containsPoint(new THREE.Vector3(x, 0, z))) {
                return sidewalk.position.y + 0.2;
            }
        }
        
        // Check if on park
        for (const park of parks) {
            const box = new THREE.Box3().setFromObject(park);
            if (box.containsPoint(new THREE.Vector3(x, 0, z))) {
                return 0.1;
            }
        }
        
        // Check if on parking lot
        for (const lot of parkingLots) {
            const box = new THREE.Box3().setFromObject(lot);
            if (box.containsPoint(new THREE.Vector3(x, 0, z))) {
                return 0.12;
            }
        }
        
        return height;
    }

    // === PLACE TOKENS IN OPEN SPACES ===
    const openSpaces = findOpenSpaces(layout, cellSize, offset);
    let tokensPlaced = 0;
    const maxAttempts = totalTokens * 3; // Prevent infinite loop
    
    console.log(`Found ${openSpaces.length} potential open spaces for tokens`);

    for (let attempt = 0; attempt < maxAttempts && tokensPlaced < totalTokens; attempt++) {
        const space = openSpaces[Math.floor(Math.random() * openSpaces.length)];
        const tokenType = tokenTypes[Math.floor(Math.random() * tokenTypes.length)];
        
        // Get surface height
        const surfaceHeight = getSurfaceHeight(space.x, space.z);
        const tokenHeight = surfaceHeight + 0.3; // Slightly above surface
        
        // Check if position is clear
        if (isPositionClear(space.x, tokenHeight, space.z)) {
            const token = tokenType.createModel();
            
            // Set scale first
            token.scale.set(TOKEN_SCALE_FACTOR, TOKEN_SCALE_FACTOR, TOKEN_SCALE_FACTOR);
            
            // Set position in world coordinates
            token.position.set(space.x, tokenHeight, space.z);
            
            // Apply world matrix transformation
            token.updateMatrix();
            token.updateMatrixWorld(true);
            
            // Determine surface type for token data
            let surfaceType = 'ground';
            switch (space.type) {
                case 2: surfaceType = 'road'; break;
                case 3: surfaceType = 'park'; break;
                case 4: surfaceType = 'parking_lot'; break;
            }
            
            token.userData = {
                type: tokenType.name,
                collected: false,
                value: 1,
                showOnMinimap: true,
                surfaceType: surfaceType,
                collectionRadius: 3.0,
                minimapColor: tokenType.color || 0xffff00
            };
            
            // Add random rotation
            token.rotation.set(
                Math.random() * Math.PI * 0.1,
                Math.random() * Math.PI,
                Math.random() * Math.PI * 0.1
            );
            
            scene.add(token);
            collectibles.push(token);
            tokensPlaced++;
            
            console.log(`  🥐 Token ${tokensPlaced}: ${tokenType.name} at (${space.x.toFixed(1)}, ${tokenHeight.toFixed(1)}, ${space.z.toFixed(1)}) on ${surfaceType}`);
        }
    }

    console.log(`✅ Successfully placed ${tokensPlaced}/${totalTokens} tokens in open spaces!`);

    // Place a few tokens near player start for easy finding
    console.log('🎯 Placing starter tokens near player...');
    const playerStartTokens = [
        { x: playerStartPosition.x + 2, z: playerStartPosition.z + 2, type: 'Bread Crumb' },
        { x: playerStartPosition.x - 2, z: playerStartPosition.z + 2, type: 'French Fry' },
        { x: playerStartPosition.x, z: playerStartPosition.z + 4, type: 'Pizza Crust' }
    ];

    playerStartTokens.forEach((pos, i) => {
        const tokenType = tokenTypes.find(t => t.name === pos.type) || tokenTypes[0];
        const token = tokenType.createModel();
        
        token.scale.set(TOKEN_SCALE_FACTOR, TOKEN_SCALE_FACTOR, TOKEN_SCALE_FACTOR);
        token.position.set(pos.x, 0.5, pos.z);
        token.updateMatrix();
        token.updateMatrixWorld(true);
        
        token.userData = {
            type: tokenType.name,
            collected: false,
            value: 1,
            showOnMinimap: true,
            surfaceType: 'starter',
            collectionRadius: 3.0,
            minimapColor: tokenType.color || 0xffff00
        };
        
        scene.add(token);
        collectibles.push(token);
        console.log(`  🎯 Starter token ${i+1}: ${pos.type} near player`);
    });
    // Set up token positions for minimap
    scene.userData.tokenPositions = collectibles.map(token => ({
        x: token.position.x,
        z: token.position.z,
        color: tokenTypes.find(t => t.name === token.userData.type)?.color || 0xffffff,
        collected: false,
        type: token.userData.type,
        surface: token.userData.surfaceType
    }));

    // Add this function to check if a position is within world bounds
    function isPositionInBounds(x, z, worldSize) {
        const halfSize = worldSize / 2;
        return Math.abs(x) <= halfSize && Math.abs(z) <= halfSize;
    }

    scene.userData.collectibles = collectibles;
    scene.userData.buildings = buildings;

    console.log('Collision objects loaded:');
    console.log('- Buildings:', scene.userData.buildings?.length || 0);
    console.log('- Tree colliders:', scene.userData.treeColliders?.length || 0);
    console.log('- Bench colliders:', scene.userData.benchColliders?.length || 0);
    console.log('- Car colliders:', scene.userData.carColliders?.length || 0);
    console.log('- Tokens:', scene.userData.collectibles?.length || 0);

    return { scene, camera };
}