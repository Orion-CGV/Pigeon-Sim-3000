// Environment Loader - Handles loading environment models (basement, arcades, etc.)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

/**
 * CollisionHelper - Visualizes collision boxes with wireframe boxes
 */
export class CollisionHelper {
    constructor(scene) {
        this.scene = scene;
        this.helpers = new Map(); // Map of object -> helper mesh
        this.visible = false; // Whether helpers are visible by default
    }

    /**
     * Creates a wireframe box to visualize a collision box
     * @param {THREE.Box3} boundingBox - The collision box to visualize
     * @param {number} color - Color of the wireframe (hex)
     * @param {string} name - Name for the helper mesh
     * @returns {THREE.LineSegments} The wireframe helper
     */
    createBoxHelper(boundingBox, color = 0x00ff00, name = 'collision-helper') {
        // Calculate size and center from bounding box
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        boundingBox.getSize(size);
        boundingBox.getCenter(center);

        // Create wireframe box geometry
        const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        const edges = new THREE.EdgesGeometry(geometry);
        const material = new THREE.LineBasicMaterial({ 
            color: color,
            linewidth: 2,
            transparent: true,
            opacity: 0.8
        });
        const helper = new THREE.LineSegments(edges, material);
        helper.position.copy(center);
        helper.name = name;
        
        return helper;
    }

    /**
     * Adds a collision helper for an object
     * @param {THREE.Object3D} object - The object to add collision visualization for
     * @param {THREE.Box3} boundingBox - The collision box
     * @param {number} color - Color of the helper
     * @param {string} name - Name for the helper
     */
    addHelper(object, boundingBox, color = 0x00ff00, name = null) {
        if (!name) name = `${object.name || 'object'}-collision`;
        const helper = this.createBoxHelper(boundingBox, color, name);
        helper.visible = this.visible;
        this.scene.add(helper);
        this.helpers.set(object, helper);
        return helper;
    }

    /**
     * Updates a collision helper to match current object bounds
     * @param {THREE.Object3D} object - The object whose helper to update
     */
    updateHelper(object) {
        const helper = this.helpers.get(object);
        if (!helper) return;

        // Recalculate bounding box from object
        const boundingBox = new THREE.Box3().setFromObject(object);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        boundingBox.getSize(size);
        boundingBox.getCenter(center);

        // Update helper position
        helper.position.copy(center);

        // Only update geometry if size changed significantly (to avoid constant recreation)
        const currentSize = new THREE.Vector3();
        if (helper.geometry.boundingBox) {
            helper.geometry.boundingBox.getSize(currentSize);
        } else {
            helper.geometry.computeBoundingBox();
            helper.geometry.boundingBox.getSize(currentSize);
        }
        
        // If size changed significantly, recreate geometry
        if (Math.abs(currentSize.x - size.x) > 0.1 || 
            Math.abs(currentSize.y - size.y) > 0.1 || 
            Math.abs(currentSize.z - size.z) > 0.1) {
            const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
            const edges = new THREE.EdgesGeometry(geometry);
            helper.geometry.dispose();
            helper.geometry = edges;
            helper.geometry.computeBoundingBox();
        }
    }
    
    /**
     * Updates all collision helpers
     */
    updateAll() {
        this.helpers.forEach((helper, object) => {
            this.updateHelper(object);
        });
    }

    /**
     * Toggles visibility of all collision helpers
     * @param {boolean} visible - Whether to show helpers
     */
    setVisible(visible) {
        this.visible = visible;
        this.helpers.forEach(helper => {
            helper.visible = visible;
        });
    }

    /**
     * Removes all collision helpers
     */
    clear() {
        this.helpers.forEach(helper => {
            this.scene.remove(helper);
            helper.geometry.dispose();
            helper.material.dispose();
        });
        this.helpers.clear();
    }
}

/**
 * EnvironmentLoader - Loads environment models (basement, arcades, etc.)
 */
export class EnvironmentLoader {
    constructor(scene, labelRenderer = null) {
        this.scene = scene;
        this.labelRenderer = labelRenderer;
        this.loader = new GLTFLoader();
        this.collisionHelper = new CollisionHelper(scene);
        this.onBasementLoaded = null; // Callback when basement is loaded (for lighting setup)
    }
    
    /**
     * Sets callback to be called when basement is loaded
     * @param {Function} callback - Callback function
     */
    setOnBasementLoaded(callback) {
        this.onBasementLoaded = callback;
    }

    /**
     * Configures shadow and layer settings for a model
     * @param {THREE.Object3D} model - The model to configure
     */
    configureModelShadows(model) {
        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                // Fix possible missing .layers
                if (child.layers === undefined) {
                    child.layers = new THREE.Layers();
                }
            }
        });

        // Also set layers on the root object
        if (model.layers === undefined) {
            model.layers = new THREE.Layers();
        }
    }

    /**
     * Loads the basement model (which includes arcades)
     * @param {Function} onComplete - Callback when loading completes
     * @param {boolean} showCollision - Whether to show collision helpers for all elements
     */
    loadBasement(onComplete = null, showCollision = false) {
        try {
            this.loader.load(
                './assets/models/environment/the_basement.glb',
                (gltf) => {
                    const basement = gltf.scene;
                    basement.name = 'basement';
                    basement.scale.set(1, 1, 1);
                    basement.position.set(0, 0, 0);

                    // Configure shadows and layers
                    this.configureModelShadows(basement);
                    
                    // Ensure ALL meshes receive shadows (shadows will be cast onto them)
                    basement.traverse((mesh) => {
                        if (mesh.isMesh) {
                            mesh.receiveShadow = true; // Shadows can be cast onto this surface
                            // castShadow is already set by configureModelShadows, but ensure it's on
                            if (!mesh.castShadow) {
                                mesh.castShadow = true;
                            }
                        }
                    });

                    // Add to scene
                    this.scene.add(basement);

                    // Find the Ground object, all arcades, walls, Table, and Treasure within the basement model
                    let groundObject = null;
                    let tableObject = null;
                    let treasureObject = null;
                    let treasureLidObject = null;
                    let secondChestObject = null;
                    let secondChestLidObject = null;
                    let paperObject = null; // Paper inside the second chest
                    let featherMarkObject = null;
                    let carMarkObject = null;
                    let blockMarkObject = null;
                    const arcades = [];
                    const arcadeBoxHelpers = [];
                    const arcadeBoxes = [];
                    const walls = [];
                    const wallBoxHelpers = [];
                    const wallBoxes = [];
                    const colliders = [];
                    const colliderBoxHelpers = [];
                    const colliderBoxes = [];
                    
                    // Look for objects named "arcade-1", "arcade-2", "arcade-3" or similar patterns
                    basement.traverse((child) => {
                        // Check if this is the Ground object
                        if (child.name && (
                            child.name === 'Ground' || 
                            child.name === 'ground' ||
                            child.name.toLowerCase().includes('ground')
                        )) {
                            groundObject = child;
                        }
                        
                        // Check if this is the Table object
                        if (child.name && (
                            child.name === 'Table' || 
                            child.name === 'table' ||
                            child.name.toLowerCase().includes('table')
                        )) {
                            tableObject = child;
                            // Enable shadows for Table object
                            child.traverse((mesh) => {
                                if (mesh.isMesh) {
                                    mesh.castShadow = true;
                                    mesh.receiveShadow = true;
                                }
                            });
                        }
                        
                        // Check if this is the Treasure object
                        if (child.name && (
                            child.name === 'treasure' || 
                            child.name === 'Treasure' ||
                            child.name.toLowerCase() === 'treasure'
                        )) {
                            treasureObject = child;
                            // Enable shadows for Treasure object
                            child.traverse((mesh) => {
                                if (mesh.isMesh) {
                                    mesh.castShadow = true;
                                    mesh.receiveShadow = true;
                                }
                            });
                        }
                        
                        // Check if this is the Treasure Lid object
                        if (child.name && (
                            child.name === 'treasure_lid' || 
                            child.name === 'Treasure_lid' ||
                            child.name === 'Treasure_Lid' ||
                            child.name.toLowerCase().includes('treasure_lid') ||
                            child.name.toLowerCase().includes('treasurelid')
                        )) {
                            treasureLidObject = child;
                            // Enable shadows for Treasure Lid object
                            child.traverse((mesh) => {
                                if (mesh.isMesh) {
                                    mesh.castShadow = true;
                                    mesh.receiveShadow = true;
                                }
                            });
                        }
                        
                        // Check if this is the second chest (mChest__0)
                        if (child.name && (
                            child.name === 'mChest__0' || 
                            child.name.toLowerCase() === 'mchest__0'
                        )) {
                            secondChestObject = child;
                            // Enable shadows for second chest
                            child.traverse((mesh) => {
                                if (mesh.isMesh) {
                                    mesh.castShadow = true;
                                    mesh.receiveShadow = true;
                                }
                            });
                        }
                        
                        // Check if this is the second chest lid (mLid__0)
                        if (child.name && (
                            child.name === 'mLid__0' || 
                            child.name.toLowerCase() === 'mlid__0'
                        )) {
                            secondChestLidObject = child;
                            // Enable shadows for second chest lid
                            child.traverse((mesh) => {
                                if (mesh.isMesh) {
                                    mesh.castShadow = true;
                                    mesh.receiveShadow = true;
                                }
                            });
                        }
                        
                        // Check if this is paper (inside second chest)
                        const childNameLower = child.name ? child.name.toLowerCase() : '';
                        if (child.name && (
                            childNameLower.includes('paper') ||
                            childNameLower.includes('note') ||
                            childNameLower.includes('letter') ||
                            childNameLower.includes('document')
                        )) {
                            paperObject = child;
                            // Enable shadows for paper
                            child.traverse((mesh) => {
                                if (mesh.isMesh) {
                                    mesh.castShadow = true;
                                    mesh.receiveShadow = true;
                                }
                            });
                            console.log(`✅ Found paper object: ${child.name}`);
                        }
                        
                        // Check if this is a mark object (feather mark, car mark, block mark)
                        // Handle both spaces and underscores in the name
                        const normalizedName = childNameLower.replace(/[_\s]/g, ''); // Remove underscores and spaces for comparison
                        
                        if (child.name && (
                            childNameLower === 'feather mark' ||
                            childNameLower === 'feather_mark' ||
                            childNameLower.includes('feather mark') ||
                            childNameLower.includes('feather_mark') ||
                            normalizedName === 'feathermark' ||
                            child.name === 'feather mark' ||
                            child.name === 'feather_mark'
                        )) {
                            featherMarkObject = child;
                            // Hide initially - will be shown when level 1 is completed
                            child.visible = false;
                            console.log(`✅ Found feather mark (${child.name}) - hidden until level 1 is completed`);
                            console.log(`   📊 Visibility: ${child.visible ? 'VISIBLE' : 'HIDDEN'}`);
                        }
                        
                        if (child.name && (
                            childNameLower === 'car mark' ||
                            childNameLower === 'car_mark' ||
                            childNameLower.includes('car mark') ||
                            childNameLower.includes('car_mark') ||
                            normalizedName === 'carmark' ||
                            child.name === 'car mark' ||
                            child.name === 'car_mark'
                        )) {
                            carMarkObject = child;
                            // Hide initially - will be shown when level 2 is completed
                            child.visible = false;
                            console.log(`✅ Found car mark (${child.name}) - hidden until level 2 is completed`);
                            console.log(`   📊 Visibility: ${child.visible ? 'VISIBLE' : 'HIDDEN'}`);
                        }
                        
                        if (child.name && (
                            childNameLower === 'block mark' ||
                            childNameLower === 'block_mark' ||
                            childNameLower.includes('block mark') ||
                            childNameLower.includes('block_mark') ||
                            normalizedName === 'blockmark' ||
                            child.name === 'block mark' ||
                            child.name === 'block_mark'
                        )) {
                            blockMarkObject = child;
                            // Hide initially - will be shown when level 3 is completed
                            child.visible = false;
                            console.log(`✅ Found block mark (${child.name}) - hidden until level 3 is completed`);
                            console.log(`   📊 Visibility: ${child.visible ? 'VISIBLE' : 'HIDDEN'}`);
                        }
                        
                        // Check if this is a Collider object (cube colliders for collision detection)
                        if (child.name && (
                            child.name === 'Collider' || 
                            child.name === 'collider' ||
                            child.name.toLowerCase().includes('collider') ||
                            child.name.match(/collider[-_]?\d*/i)
                        )) {
                            colliders.push(child);
                            
                            // Hide the actual collider mesh - it's only used for collision detection
                            if (child.isMesh) {
                                child.visible = false;
                            } else {
                                // If it's a group, hide all meshes within it
                                child.traverse((mesh) => {
                                    if (mesh.isMesh) {
                                        mesh.visible = false;
                                    }
                                });
                            }
                            
                            // Create BoxHelper for visual debugging
                            const colliderBoxHelper = new THREE.BoxHelper(child, 0xff8800); // Orange color
                            colliderBoxHelper.name = `colliderBoxHelper-${colliders.length}`;
                            colliderBoxHelper.visible = false; // Start hidden
                            this.scene.add(colliderBoxHelper);
                            colliderBoxHelpers.push(colliderBoxHelper);
                            
                            // Create collision box (account for world transforms including scale)
                            const collisionBox = new THREE.Box3().setFromObject(child);
                            collisionBox.expandByVector(new THREE.Vector3(-0.05, -0.05, -0.05));
                            colliderBoxes.push(collisionBox);
                            
                            // Add collision visualization if requested
                            if (showCollision) {
                                this.collisionHelper.addHelper(child, collisionBox, 0xff8800, `collider-${colliders.length}-collision`);
                            }
                            
                            return; // Skip further processing for this collider
                        }
                        
                        // Check if this is a Wall object
                        if (child.name && (
                            child.name === 'Wall' || 
                            child.name === 'wall' ||
                            child.name.toLowerCase().includes('wall') ||
                            child.name.match(/wall[-_]?\d*/i)
                        )) {
                            walls.push(child);
                            
                            // Enable shadows for walls
                            child.traverse((mesh) => {
                                if (mesh.isMesh) {
                                    mesh.castShadow = true;
                                    mesh.receiveShadow = true;
                                }
                            });
                            
                            // Get wall position and bounding box
                            const wallWorldPos = new THREE.Vector3();
                            child.getWorldPosition(wallWorldPos);
                            const wallBox = new THREE.Box3().setFromObject(child);
                            const wallCenter = new THREE.Vector3();
                            wallBox.getCenter(wallCenter);
                            const wallSize = new THREE.Vector3();
                            wallBox.getSize(wallSize);
                            
                            // Create BoxHelper for visual debugging
                            const wallBoxHelper = new THREE.BoxHelper(child, 0xff0000);
                            wallBoxHelper.name = `wallBoxHelper-${walls.length}`;
                            wallBoxHelper.visible = false; // Start hidden
                            this.scene.add(wallBoxHelper);
                            wallBoxHelpers.push(wallBoxHelper);
                            
                            // Get helper position
                            const helperWorldPos = new THREE.Vector3();
                            wallBoxHelper.getWorldPosition(helperWorldPos);
                            
                            // Create collision box (account for world transforms including scale)
                            const collisionBox = new THREE.Box3().setFromObject(child);
                            collisionBox.expandByVector(new THREE.Vector3(-0.05, -0.05, -0.05));
                            wallBoxes.push(collisionBox);
                            
                            const collisionCenter = new THREE.Vector3();
                            collisionBox.getCenter(collisionCenter);
                            const collisionSize = new THREE.Vector3();
                            collisionBox.getSize(collisionSize);
                            
                            // Add collision visualization if requested
                            if (showCollision) {
                                const helper = this.collisionHelper.addHelper(child, collisionBox, 0xff0000, `wall-${walls.length}-collision`);
                                if (helper) {
                                    const collisionHelperPos = new THREE.Vector3();
                                    helper.getWorldPosition(collisionHelperPos);
                                }
                            }
                            
                            return; // Skip further processing for this wall
                        }
                        
                        // Check if this is an arcade (by name pattern)
                        if (child.name && (
                            child.name.toLowerCase().includes('arcade') || 
                            child.name.includes('Arcade') ||
                            child.name.match(/arcade[-_]?[123]/i)
                        )) {
                            // Try to extract level number from name
                            const levelMatch = child.name.match(/(\d+)/);
                            const level = levelMatch ? parseInt(levelMatch[1]) : arcades.length + 1;
                            
                            // Set up arcade userData
                            const colorNames = ["Red", "Blue", "Yellow"];
                            child.userData.level = level;
                            child.userData.colorName = colorNames[level - 1] || colorNames[arcades.length];
                            child.name = `arcade-${level}`;
                            
                            // Ensure layers exist
                            if (child.layers === undefined) {
                                child.layers = new THREE.Layers();
                            }
                            
                            // Enable shadows for arcade
                            child.traverse((mesh) => {
                                if (mesh.isMesh) {
                                    mesh.castShadow = true;
                                    mesh.receiveShadow = true;
                                }
                            });
                            
                            arcades.push(child);
                            
                            // Create BoxHelper for visual debugging
                            const arcadeBoxHelper = new THREE.BoxHelper(child, 0x00ff00);
                            arcadeBoxHelper.name = `arcadeBoxHelper-${level}`;
                            arcadeBoxHelper.visible = false; // Start hidden
                            this.scene.add(arcadeBoxHelper);
                            arcadeBoxHelpers.push(arcadeBoxHelper);
                            
                            // Create collision box (account for world transforms including scale)
                            const arcadeBox = new THREE.Box3().setFromObject(child);
                            arcadeBox.expandByVector(new THREE.Vector3(-0.05, -0.05, -0.05));
                            arcadeBoxes.push(arcadeBox);
                            
                            // Add collision visualization if requested
                            if (showCollision) {
                                this.collisionHelper.addHelper(child, arcadeBox, 0x00ff00, `arcade-${level}-collision`);
                            }
                            
                        }
                        
                        // Add collision helper for all mesh objects if requested (but skip Ground, Walls, and Colliders, we handle them separately)
                        if (showCollision && child.isMesh && child !== groundObject && !walls.includes(child) && !colliders.includes(child)) {
                            const childBox = new THREE.Box3().setFromObject(child);
                            if (childBox.min.distanceTo(childBox.max) > 0.1) { // Only if object has size
                                this.collisionHelper.addHelper(child, childBox, 0xff00ff, `${child.name || 'mesh'}-collision`);
                            }
                        }
                    });
                    
                    // Store arcades in scene userData
                    this.scene.userData.arcades = arcades;
                    this.scene.userData.arcadeBoxHelpers = arcadeBoxHelpers;
                    this.scene.userData.arcadeBoxes = arcadeBoxes;
                    
                    // Store walls in scene userData
                    this.scene.userData.walls = walls;
                    this.scene.userData.wallBoxHelpers = wallBoxHelpers;
                    this.scene.userData.wallBoxes = wallBoxes;
                    
                    // Store colliders in scene userData
                    this.scene.userData.colliders = colliders;
                    this.scene.userData.colliderBoxHelpers = colliderBoxHelpers;
                    this.scene.userData.colliderBoxes = colliderBoxes;
                    
                    // Store treasure objects in scene userData
                    this.scene.userData.treasure = treasureObject;
                    this.scene.userData.treasureLid = treasureLidObject;
                    if (treasureObject) {
                        console.log('✅ Treasure chest found in basement');
                        // Log treasure position
                        const treasurePos = new THREE.Vector3();
                        treasureObject.getWorldPosition(treasurePos);
                        console.log('📍 Treasure position:', treasurePos);
                        console.log('📍 Treasure local position:', treasureObject.position);
                        // Add visual highlight to treasure
                        this.createTreasureHighlight(treasureObject);
                    }
                    if (treasureLidObject) {
                        console.log('✅ Treasure lid found in basement');
                    }
                    
                    // Store second chest objects in scene userData
                    this.scene.userData.secondChest = secondChestObject;
                    this.scene.userData.secondChestLid = secondChestLidObject;
                    this.scene.userData.paper = paperObject; // Store paper object
                    if (secondChestObject) {
                        console.log('✅ Second chest (mChest__0) found in basement');
                        const secondChestPos = new THREE.Vector3();
                        secondChestObject.getWorldPosition(secondChestPos);
                        console.log('📍 Second chest position:', secondChestPos);
                    }
                    if (secondChestLidObject) {
                        console.log('✅ Second chest lid (mLid__0) found in basement');
                    }
                    if (paperObject) {
                        console.log('✅ Paper found in second chest:', paperObject.name);
                    } else {
                        console.log('⚠️ Paper not found in second chest - make sure paper object exists in model');
                    }
                    
                    // Store mark objects in scene userData
                    this.scene.userData.featherMark = featherMarkObject;
                    this.scene.userData.carMark = carMarkObject;
                    this.scene.userData.blockMark = blockMarkObject;
                    
                    // Log mark detection status
                    console.log('📊 Mark Detection Summary:');
                    console.log(`   ${featherMarkObject ? '✅' : '❌'} Feather Mark: ${featherMarkObject ? `Found (${featherMarkObject.name}), Visibility: ${featherMarkObject.visible ? 'VISIBLE' : 'HIDDEN'}` : 'Not found'}`);
                    console.log(`   ${carMarkObject ? '✅' : '❌'} Car Mark: ${carMarkObject ? `Found (${carMarkObject.name}), Visibility: ${carMarkObject.visible ? 'VISIBLE' : 'HIDDEN'}` : 'Not found'}`);
                    console.log(`   ${blockMarkObject ? '✅' : '❌'} Block Mark: ${blockMarkObject ? `Found (${blockMarkObject.name}), Visibility: ${blockMarkObject.visible ? 'VISIBLE' : 'HIDDEN'}` : 'Not found'}`);
                    
                    // Update mark visibility based on completed levels
                    this.updateMarkVisibility();
                    
                    // Create collision box for ground (use Ground object if found, otherwise use basement)
                    let groundBox;
                    if (groundObject) {
                        // Ensure ground receives shadows from ceiling light and other sources
                        groundObject.traverse((mesh) => {
                            if (mesh.isMesh) {
                                mesh.receiveShadow = true;
                                // Ground typically doesn't cast shadows (but can if needed)
                                mesh.castShadow = false;
                            }
                        });
                        
                        // Use the Ground object for collision
                        groundBox = new THREE.Box3().setFromObject(groundObject);
                        groundBox.expandByVector(new THREE.Vector3(-0.05, -0.05, -0.05));
                        groundBox.name = 'groundBox';
                        
                        // Create BoxHelper for Ground (visual debugging)
                        const groundBoxHelper = new THREE.BoxHelper(groundObject, 0xffff00);
                        groundBoxHelper.name = 'groundBoxHelper';
                        groundBoxHelper.visible = false; // Start hidden
                        this.scene.add(groundBoxHelper);
                        this.scene.userData.groundBoxHelper = groundBoxHelper;
                        
                        // Add collision visualization for Ground if requested
                        if (showCollision) {
                            this.collisionHelper.addHelper(groundObject, groundBox, 0xffff00, 'ground-collision');
                        }
                        
                    } else {
                        // Fallback to basement if Ground object not found
                        // Ensure basement floor receives shadows
                        basement.traverse((mesh) => {
                            if (mesh.isMesh) {
                                mesh.receiveShadow = true;
                            }
                        });
                        
                        groundBox = new THREE.Box3().setFromObject(basement);
                        groundBox.expandByVector(new THREE.Vector3(-0.05, -0.05, -0.05));
                        groundBox.name = 'groundBox';
                        
                        // Create BoxHelper for basement (visual debugging)
                        const basementBoxHelper = new THREE.BoxHelper(basement, 0xffff00);
                        basementBoxHelper.name = 'basementBoxHelper';
                        basementBoxHelper.visible = false; // Start hidden
                        this.scene.add(basementBoxHelper);
                        this.scene.userData.groundBoxHelper = basementBoxHelper;
                        
                        // Add collision visualization for basement if requested
                        if (showCollision) {
                            this.collisionHelper.addHelper(basement, groundBox, 0xffff00, 'basement-collision');
                        }
                    }
                    
                    // Store ground box in scene userData
                    this.scene.userData.groundBox = groundBox;
                    
                    // Notify lighting system that model is loaded (so it can attach lights)
                    if (this.onBasementLoaded) {
                        this.onBasementLoaded();
                    }

                    if (onComplete) onComplete();
                },
                undefined,
                (error) => {
                    if (onComplete) onComplete();
                }
            );
        } catch (error) {
            if (onComplete) onComplete();
        }
    }

    /**
     * Loads arcade machines
     * @param {Array} arcadeConfig - Array of { path, position, level, colorName, label }
     * @param {Function} onComplete - Callback when all arcades are loaded
     * @param {boolean} showCollision - Whether to show collision helpers
     */
    loadArcades(arcadeConfig, onComplete = null, showCollision = false) {
        console.log('Creating arcade machines...');
        try {
            const arcades = [];
            const arcadeLabels = [];
            let loadedCount = 0;
            const totalArcades = arcadeConfig.length;

            arcadeConfig.forEach((config, i) => {
                this.loader.load(
                    config.path,
                    (gltf) => {
                        const arcade = gltf.scene;
                        arcade.position.set(config.position.x, config.position.y, config.position.z);
                        arcade.userData.level = config.level;
                        arcade.userData.colorName = config.colorName;
                        arcade.name = `arcade-${config.level}`;

                        // Configure shadows and layers
                        this.configureModelShadows(arcade);

                        // Add to scene
                        this.scene.add(arcade);
                        arcades[i] = arcade;
                        this.scene.userData.arcades = arcades;

                        // Create BoxHelper for visual debugging
                        const arcadeBoxHelper = new THREE.BoxHelper(arcade, 0x00ff00);
                        arcadeBoxHelper.name = `arcadeBoxHelper-${config.level}`;
                        arcadeBoxHelper.visible = false; // Start hidden
                        this.scene.add(arcadeBoxHelper);

                        if (!this.scene.userData.arcadeBoxHelpers) {
                            this.scene.userData.arcadeBoxHelpers = [];
                        }
                        this.scene.userData.arcadeBoxHelpers[i] = arcadeBoxHelper;

                        // Create label if provided
                        if (config.label && this.labelRenderer) {
                            const textDiv = document.createElement('div');
                            textDiv.className = 'arcade-label';
                            textDiv.textContent = config.label;
                            textDiv.style.color = 'white';
                            textDiv.style.fontFamily = 'Arial, sans-serif';
                            textDiv.style.fontSize = '16px';
                            textDiv.style.fontWeight = 'bold';
                            textDiv.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
                            textDiv.style.pointerEvents = 'none';
                            textDiv.style.textAlign = 'center';
                            textDiv.style.whiteSpace = 'nowrap';

                            const label = new CSS2DObject(textDiv);
                            label.position.set(0, 1.5, 0);
                            arcade.add(label);
                            arcadeLabels[i] = label;
                        }

                        // Create collision box
                        const arcadeBox = new THREE.Box3().setFromObject(arcade);
                        arcadeBox.expandByVector(new THREE.Vector3(-0.05, -0.05, -0.05));
                        if (!this.scene.userData.arcadeBoxes) {
                            this.scene.userData.arcadeBoxes = [];
                        }
                        this.scene.userData.arcadeBoxes[i] = arcadeBox;

                        // Add collision visualization if requested
                        if (showCollision) {
                            this.collisionHelper.addHelper(arcade, arcadeBox, 0x00ff00, `arcade-${config.level}-collision`);
                        }

                        loadedCount++;
                        if (loadedCount === totalArcades) {
                            console.log('All arcades loaded');
                            if (onComplete) onComplete();
                        }
                    },
                    (xhr) => {
                        console.log(`Loading ${config.path}: ${(xhr.loaded / xhr.total * 100).toFixed(2)}%`);
                    },
                    (error) => {
                        console.error(`Error loading ${config.path}:`, error);
                        loadedCount++;
                        if (loadedCount === totalArcades && onComplete) {
                            onComplete();
                        }
                    }
                );
            });

            console.log('Arcade GLB loading initiated');
        } catch (error) {
            console.error('Error creating arcade machines:', error);
            if (onComplete) onComplete();
        }
    }

    /**
     * Toggles collision visualization
     * @param {boolean} visible - Whether to show collision helpers
     */
    toggleCollisionHelpers(visible) {
        // Toggle detailed collision helpers
        this.collisionHelper.setVisible(visible);
        
        // Toggle player capsule helper
        const playerCapsuleHelper = this.scene.userData.playerCapsuleHelper;
        if (playerCapsuleHelper) {
            playerCapsuleHelper.visible = visible;
        }
        
        // Toggle wall BoxHelpers
        const wallBoxHelpers = this.scene.userData.wallBoxHelpers;
        if (wallBoxHelpers) {
            wallBoxHelpers.forEach(helper => {
                if (helper) {
                    helper.visible = visible;
                }
            });
        }
        
        // Toggle collider BoxHelpers
        const colliderBoxHelpers = this.scene.userData.colliderBoxHelpers;
        if (colliderBoxHelpers) {
            colliderBoxHelpers.forEach(helper => {
                if (helper) {
                    helper.visible = visible;
                }
            });
        }
        
        // Toggle ground BoxHelper
        const groundBoxHelper = this.scene.userData.groundBoxHelper;
        if (groundBoxHelper) {
            groundBoxHelper.visible = visible;
        }
        
        // Toggle arcade BoxHelpers
        const arcadeBoxHelpers = this.scene.userData.arcadeBoxHelpers;
        if (arcadeBoxHelpers) {
            arcadeBoxHelpers.forEach(helper => {
                if (helper) {
                    helper.visible = visible;
                }
            });
        }
    }

    /**
     * Gets the collision helper instance
     * @returns {CollisionHelper}
     */
    getCollisionHelper() {
        return this.collisionHelper;
    }
    
    /**
     * Creates a visual highlight for the treasure chest
     * @param {THREE.Object3D} treasure - The treasure object to highlight
     */
    createTreasureHighlight(treasure) {
        // Calculate bounding box for the treasure
        const bbox = new THREE.Box3().setFromObject(treasure);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        bbox.getSize(size);
        bbox.getCenter(center);
        
        // Expand the bounding box slightly for better visibility
        const expandedSize = new THREE.Vector3(
            size.x + 0.3,
            size.y + 0.3,
            size.z + 0.3
        );
        
        // Create wireframe box as outline (glowing gold/yellow)
        const outlineGeometry = new THREE.BoxGeometry(expandedSize.x, expandedSize.y, expandedSize.z);
        const outlineMaterial = new THREE.MeshBasicMaterial({
            color: 0xffd700, // Gold color
            wireframe: true,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        
        const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
        outline.position.copy(center);
        outline.name = 'treasure-outline';
        outline.renderOrder = 999; // Render on top
        
        // Add pulsing animation using GSAP
        const pulseAnimation = gsap.to(outlineMaterial, {
            opacity: 0.3,
            duration: 1.5,
            repeat: -1,
            yoyo: true,
            ease: "power1.inOut"
        });
        
        // Also animate scale for pulsing effect
        const scaleAnimation = gsap.to(outline.scale, {
            x: 1.05,
            y: 1.05,
            z: 1.05,
            duration: 1.5,
            repeat: -1,
            yoyo: true,
            ease: "power1.inOut"
        });
        
        // Store animations for cleanup
        outline.userData.pulseAnimation = pulseAnimation;
        outline.userData.scaleAnimation = scaleAnimation;
        
        this.scene.add(outline);
        this.scene.userData.treasureOutline = outline;
        
        console.log('✨ Treasure highlight created');
    }
    
    /**
     * Updates the visibility of mark objects based on completed levels
     */
    updateMarkVisibility() {
        // Get story system from scene
        const storySystem = this.scene.userData.storySystem;
        if (!storySystem) {
            console.log('⚠️ Mark visibility: Story system not available yet');
            return; // Story system not available yet
        }
        
        // Show feather mark if level 1 is completed
        const featherMark = this.scene.userData.featherMark;
        if (featherMark) {
            const level1Completed = storySystem.storyState.levelsCompleted[1] === true;
            featherMark.visible = level1Completed;
            console.log(`📊 Feather Mark: ${featherMark.visible ? 'VISIBLE' : 'HIDDEN'} (Level 1 completed: ${level1Completed})`);
        } else {
            console.log('⚠️ Feather Mark: Not found in scene');
        }
        
        // Show car mark if level 2 is completed
        const carMark = this.scene.userData.carMark;
        if (carMark) {
            const level2Completed = storySystem.storyState.levelsCompleted[2] === true;
            carMark.visible = level2Completed;
            console.log(`📊 Car Mark: ${carMark.visible ? 'VISIBLE' : 'HIDDEN'} (Level 2 completed: ${level2Completed})`);
        } else {
            console.log('⚠️ Car Mark: Not found in scene');
        }
        
        // Show block mark if level 3 is completed
        const blockMark = this.scene.userData.blockMark;
        if (blockMark) {
            const level3Completed = storySystem.storyState.levelsCompleted[3] === true;
            blockMark.visible = level3Completed;
            console.log(`📊 Block Mark: ${blockMark.visible ? 'VISIBLE' : 'HIDDEN'} (Level 3 completed: ${level3Completed})`);
        } else {
            console.log('⚠️ Block Mark: Not found in scene');
        }
        
        console.log('📊 Mark visibility update complete');
    }
}
