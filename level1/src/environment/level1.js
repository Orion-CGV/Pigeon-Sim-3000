import * as THREE from 'three';
import { createGroundCollider } from "../physics/collider.js";

export function createLevel() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 20, 120);

    const camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, 1.6, 0);
    camera.lookAt(0, 1.6, -1);    
    camera.fov = 60;
    camera.updateProjectionMatrix();

    // Directional sunlight
    const light = new THREE.DirectionalLight(0xffffff, 1.2);
    light.position.set(10, 30, 10);
    scene.add(light);

    // Ambient light for softer shadows
    const ambient = new THREE.AmbientLight(0x404040, 1.5);
    scene.add(ambient);

    const cellSize = 50;
    const gridSize = 25;
    const worldSize = gridSize * cellSize;

    // === Ground setup ===
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
    [1,0,1,0,0,1,0,0,1,0,1,0,0,1,0,1,0,1,0,1,0,1,0,0,1],
    [1,1,1,0,1,1,1,0,1,0,1,1,0,1,0,1,0,1,1,1,0,1,1,0,1],
    [1,0,0,0,0,1,0,0,1,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,1],
    [1,1,1,1,0,1,1,1,1,0,1,1,1,1,0,1,1,1,0,1,1,1,0,1,1],
    [1,0,1,0,0,0,0,1,0,0,0,0,1,0,0,1,0,0,0,1,0,0,1,0,1],
    [1,1,1,1,1,1,0,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1],
    [1,0,0,0,1,0,0,1,0,0,1,0,0,1,0,1,0,0,0,1,0,0,0,0,1],
    [1,0,1,1,1,1,0,1,1,1,1,1,1,1,0,1,1,1,0,1,1,1,1,0,1],
    [1,0,1,0,0,0,0,0,0,1,0,0,1,0,0,0,0,1,0,0,0,1,0,0,1],
    [1,1,1,1,0,1,1,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1],
    [1,0,1,0,0,1,0,0,1,0,1,0,0,1,0,1,0,1,0,1,0,0,0,0,1],
    [1,1,1,1,1,1,0,1,1,1,1,1,1,1,0,1,1,1,0,1,1,1,1,0,1],
    [1,0,0,0,0,0,0,1,0,0,1,0,0,1,0,0,0,1,0,0,0,1,0,0,1],
    [1,1,1,1,1,1,0,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1],
    [1,0,1,0,0,0,0,1,0,0,1,0,0,1,0,1,0,1,0,1,0,0,1,0,1],
    [1,1,1,0,1,1,1,0,1,0,1,1,0,1,0,1,0,1,1,1,0,1,1,0,1],
    [1,0,0,0,0,1,0,0,1,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,1],
    [1,1,1,1,0,1,1,1,1,0,1,1,1,1,0,1,1,1,0,1,1,1,0,1,1],
    [1,0,1,0,0,0,0,1,0,0,0,0,1,0,0,1,0,0,0,1,0,0,1,0,1],
    [1,1,1,1,1,1,0,1,1,1,1,0,1,1,0,1,1,1,1,1,0,1,1,1,1],
    [1,0,0,0,1,0,0,1,0,0,1,0,0,1,0,1,0,0,0,1,0,0,0,0,1],
    [1,0,1,1,1,1,0,1,1,1,1,1,1,1,0,1,1,1,0,1,1,1,1,0,1],
    [1,0,0,0,0,0,0,1,0,0,1,0,0,1,0,0,0,1,0,0,0,1,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    ];

    // === Building generator ===
    const buildings = [];
    const buildingMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.3, roughness: 0.6 });
    const offset = (layout.length / 2) * cellSize;

    for (let z = 0; z < layout.length; z++) {
    for (let x = 0; x < layout[z].length; x++) {
        if (layout[z][x] === 1) {
        const width = 40 + Math.random() * 10;
        const height = 60 + Math.random() * 120;
        const depth = 40 + Math.random() * 10;
        const buildingGeo = new THREE.BoxGeometry(width, height, depth);
        const building = new THREE.Mesh(buildingGeo, buildingMat);

        building.position.set(x * cellSize - offset, height / 2, z * cellSize - offset);
        building.castShadow = true;
        building.receiveShadow = true;
        scene.add(building);

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

    // === City decorations ===
    const streetlightGeo = new THREE.CylinderGeometry(0.05, 0.05, 3);
    const streetlightMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa });
    const lightSphereGeo = new THREE.SphereGeometry(0.2, 12, 12);
    const lightSphereMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });

    for (let i = 0; i < 15; i++) {
        const x = (Math.random() - 0.5) * 80;
        const z = (Math.random() - 0.5) * 80;
        const pole = new THREE.Mesh(streetlightGeo, streetlightMat);
        pole.position.set(x, 1.5, z);
        scene.add(pole);

        const poleBox = new THREE.Box3();
        poleBox.setFromCenterAndSize(
            pole.position,
            new THREE.Vector3(0.1, 3, 0.1)
        );
        pole.userData.collider = poleBox;
        pole.userData.isBuilding = true;
        buildings.push(pole);

        const bulb = new THREE.Mesh(lightSphereGeo, lightSphereMat);
        bulb.position.set(x, 3.2, z);
        scene.add(bulb);
    }

    // === Parked cars ===
    const carGeo = new THREE.BoxGeometry(1.5, 0.6, 0.8);
    const carMat = new THREE.MeshStandardMaterial({ color: 0xff3333 });
    for (let i = 0; i < 10; i++) {
        const car = new THREE.Mesh(carGeo, carMat);
        car.position.set((Math.random() - 0.5) * 60, 0.3, (Math.random() - 0.5) * 60);
        scene.add(car);

        const carBox = new THREE.Box3();
        carBox.setFromCenterAndSize(
            car.position,
            new THREE.Vector3(1.5, 0.6, 0.8)
        );
        car.userData.collider = carBox;
        car.userData.isBuilding = true;
        buildings.push(car);
    }

    // === Collectible Tokens - Items pigeons might find in NYC ===
    const collectibles = [];
    const tokenTypes = [
        { name: "Bread Crumb", color: 0xf5deb3, size: 0.3 }, // Wheat color
        { name: "French Fry", color: 0xffd700, size: 0.4 }, // Golden yellow
        { name: "Pizza Crust", color: 0xd2691e, size: 0.5 }, // Brown
        { name: "Popcorn", color: 0xfff8dc, size: 0.2 }, // Light yellow
        { name: "Pretzel", color: 0x8b4513, size: 0.4 }, // Brown
        { name: "Seed", color: 0xdaa520, size: 0.2 }, // Goldenrod
        { name: "Hot Dog Bun", color: 0xffe4b5, size: 0.5 }, // Moccasin
        { name: "Bagel Bit", color: 0xf0e68c, size: 0.4 }  // Khaki
    ];

    // Player starting position (center of the map)
    const playerStartPosition = { x: 0, z: 0 };

    // Create tokens in a north-eastern diagonal line moving away from the player
    console.log("Creating tokens in north-eastern diagonal line...");

    const diagonalTokensCount = 5;
    const spacing = 15; // Units between tokens
    const minRadius = 3;
    const maxRadius = 8;

    for (let i = 0; i < diagonalTokensCount; i++) {
        const tokenType = tokenTypes[Math.floor(Math.random() * tokenTypes.length)];
        const tokenGeo = new THREE.BoxGeometry(tokenType.size, tokenType.size, tokenType.size);
        const tokenMat = new THREE.MeshBasicMaterial({ color: tokenType.color });
        const token = new THREE.Mesh(tokenGeo, tokenMat);
        
        // Calculate position along north-eastern diagonal
        const distance = (i + 1) * spacing;
        const posX = playerStartPosition.x - distance;
        const posZ = playerStartPosition.z + distance; // Negative Z is north in Three.js
        
        // Apply random radius offset within the 3-8 range
        const radius = minRadius + Math.random() * (maxRadius - minRadius);
        const angle = Math.random() * Math.PI * 2; // Random direction around the target point
        
        const finalX = posX + Math.cos(angle) * radius;
        const finalZ = posZ + Math.sin(angle) * radius;
        
        // Check if this position is inside a building
        let insideBuilding = false;
        for (const building of buildings) {
            const buildingPos = building.position;
            const buildingWidth = building.geometry.parameters.width || 1;
            const buildingDepth = building.geometry.parameters.depth || 1;
            
            if (Math.abs(finalX - buildingPos.x) < buildingWidth/2 + 2 && 
                Math.abs(finalZ - buildingPos.z) < buildingDepth/2 + 2) {
                insideBuilding = true;
                break;
            }
        }
        
        // Skip if inside building, try a closer position
        if (insideBuilding) {
            console.log(`Token ${i} at (${finalX.toFixed(1)}, ${finalZ.toFixed(1)}) is inside building, adjusting...`);
            
            // Try positions with smaller radius
            let placed = false;
            for (let attempt = 1; attempt <= 5; attempt++) {
                const adjustedRadius = radius * (0.8 / attempt);
                const adjustedX = posX + Math.cos(angle) * adjustedRadius;
                const adjustedZ = posZ + Math.sin(angle) * adjustedRadius;
                
                let collision = false;
                for (const building of buildings) {
                    const buildingPos = building.position;
                    const buildingWidth = building.geometry.parameters.width || 1;
                    const buildingDepth = building.geometry.parameters.depth || 1;
                    
                    if (Math.abs(adjustedX - buildingPos.x) < buildingWidth/2 + 2 && 
                        Math.abs(adjustedZ - buildingPos.z) < buildingDepth/2 + 2) {
                        collision = true;
                        break;
                    }
                }
                
                if (!collision) {
                    token.position.set(adjustedX, 5, adjustedZ);
                    placed = true;
                    console.log(`Adjusted token ${i} to (${adjustedX.toFixed(1)}, ${adjustedZ.toFixed(1)}) with radius ${adjustedRadius.toFixed(1)}`);
                    break;
                }
            }
            
            if (!placed) {
                console.warn(`Could not place token ${i} after adjustment attempts, skipping`);
                continue;
            }
        } else {
            token.position.set(finalX, 5, finalZ);
        }
        
        token.userData = {
            type: tokenType.name,
            collected: false,
            value: 1,
            showOnMinimap: true
        };
        
        // Add subtle rotation animation
        token.rotation.x = Math.random() * Math.PI;
        token.rotation.y = Math.random() * Math.PI;
        
        scene.add(token);
        collectibles.push(token);
        
        console.log(`Created ${tokenType.name} at position: (${token.position.x.toFixed(1)}, ${token.position.z.toFixed(1)}) - distance ${distance}, radius ${radius.toFixed(1)}`);
    }

    console.log("Creating remaining tokens using layout matrix...");
    const tokensToCreate = 15;
    let tokensCreated = 0;
    let attempts = 0;
    const maxAttempts = 500;

    while (tokensCreated < tokensToCreate && attempts < maxAttempts) {
        attempts++;
        
        // Pick a random grid position
        const gridX = Math.floor(Math.random() * layout[0].length);
        const gridZ = Math.floor(Math.random() * layout.length);
        
        // Check if this grid cell is empty (0 in the layout)
        if (layout[gridZ][gridX] === 0) {
            const tokenType = tokenTypes[Math.floor(Math.random() * tokenTypes.length)];
            const tokenGeo = new THREE.BoxGeometry(tokenType.size, tokenType.size, tokenType.size);
            const tokenMat = new THREE.MeshBasicMaterial({ color: tokenType.color });
            const token = new THREE.Mesh(tokenGeo, tokenMat);
            
            // Convert grid position to world position
            const worldX = gridX * cellSize - offset;
            const worldZ = gridZ * cellSize - offset;
            
            // Add some random variation within the cell (but not too close to edges)
            const variation = cellSize * 0.3;
            const finalX = worldX + (Math.random() - 0.5) * variation;
            const finalZ = worldZ + (Math.random() - 0.5) * variation;
            
            token.position.set(finalX, 5, finalZ); // Increased height to 5 for minimap visibility
            token.userData = {
                type: tokenType.name,
                collected: false,
                value: 1,
                showOnMinimap: true
            };
            
            token.rotation.x = Math.random() * Math.PI;
            token.rotation.y = Math.random() * Math.PI;
            
            scene.add(token);
            collectibles.push(token);
            tokensCreated++;
            
            console.log(`Created ${tokenType.name} at grid [${gridZ}][${gridX}] -> world (${finalX.toFixed(1)}, ${finalZ.toFixed(1)})`);
        }
    }

    if (tokensCreated < tokensToCreate) {
        console.warn(`Only created ${tokensCreated} of ${tokensToCreate} tokens after ${attempts} attempts`);
    }

    scene.userData.tokenPositions = collectibles.map(token => ({
        x: token.position.x,
        z: token.position.z,
        color: token.material.color.getHex(),
        collected: false,
        type: token.userData.type
    }));

    scene.userData.buildings = buildings;
    scene.userData.collectibles = collectibles;

    console.log(`Stored ${scene.userData.tokenPositions.length} token positions for minimap`);

    console.log(`Total collectibles created: ${collectibles.length}`);
    console.log("Tokens placed in north-eastern diagonal line from player!");

    return { scene, camera };
}