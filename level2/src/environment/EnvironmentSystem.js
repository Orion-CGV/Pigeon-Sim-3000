/**
 * ========================================
 * ENVIRONMENT SYSTEM
 * ========================================
 * 
 * Manages environment loading and setup:
 * - GLB model loading
 * - Object categorization (car vs environment)
 * - Ground, buildings, fences setup
 * - Environment physics bodies
 * - Collision detection setup
 * - Material and texture fixes
 * 
 * This module handles all environment-related logic.
 * ========================================
 */

export class EnvironmentSystem {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        
        // Model and groups
        this.carModel = null;
        this.carWrapper = null;
        this.environmentGroup = null;
        
        // Environment objects
        this.groundObject = null;
        this.buildings = [];
        this.fences = [];
        this.environmentObjects = [];
        
        // Car components
        this.carBodyGroup = null;
        this.frontWheelsGroup = null;
        this.backWheelsGroup = null;
        
        // Callbacks
        this.onModelLoadedCallback = null;
        this.onProgressCallback = null;
        this.onErrorCallback = null;
    }
    
    /**
     * Load the car model (GLB file)
     * @param {string} modelPath - Path to GLB file
     */
    loadModel(modelPath = './Car.glb') {
        const loader = new GLTFLoader();
        loader.load(
            modelPath,
            (gltf) => this.onModelLoaded(gltf),
            (xhr) => this.onLoadingProgress(xhr),
            (error) => this.onLoadingError(error)
        );
    }
    
    /**
     * Set callback for when model is loaded
     * @param {Function} callback
     */
    setOnModelLoadedCallback(callback) {
        this.onModelLoadedCallback = callback;
    }
    
    /**
     * Set callback for loading progress
     * @param {Function} callback
     */
    setOnProgressCallback(callback) {
        this.onProgressCallback = callback;
    }
    
    /**
     * Set callback for loading errors
     * @param {Function} callback
     */
    setOnErrorCallback(callback) {
        this.onErrorCallback = callback;
    }
    
    /**
     * Handle model loaded
     */
    onModelLoaded(gltf) {
        this.carModel = gltf.scene;
        
        // Create groups
        this.carWrapper = new THREE.Group();
        this.environmentGroup = new THREE.Group();
        
        // Define object categories
        const carObjectNames = ['Car_Body', 'Front_Wheels', 'Back_Wheels', 
                               'FrontLeftWheel', 'FrontRightWheel', 
                               'BackLeftWheel', 'BackRightWheel',
                               'Headlight', 'Backlight'];
        
        const environmentObjectNames = ['Ground', 'Building', 'Fence', 'Road', 
                                       'Wall', 'Obstacle', 'Tree', 'Prop', 'Sign'];
        
        // Categorize objects
        const childrenToMove = [];
        this.carModel.children.forEach(child => {
            childrenToMove.push(child);
        });
        
        childrenToMove.forEach(child => {
            const childName = child.name || '';
            
            const isCarComponent = carObjectNames.some(name => childName.includes(name));
            const isEnvironmentObject = environmentObjectNames.some(name => childName.includes(name));
            
            if (isCarComponent) {
                this.carWrapper.add(child);
            } else if (isEnvironmentObject || childName.includes('Ground')) {
                this.environmentGroup.add(child);
                
                // Track specific environment objects
                if (childName.includes('Ground')) {
                    this.groundObject = child;
                } else if (childName.includes('Building')) {
                    this.buildings.push(child);
                } else if (childName.includes('Fence')) {
                    this.fences.push(child);
                }
                
                // Add to generic environment objects array (for physics)
                if (!childName.includes('Ground')) {
                    this.environmentObjects.push({
                        object: child,
                        type: childName.split('.')[0],
                        name: childName
                    });
                }
            } else {
                console.warn(`⚠ Unknown object type: ${childName} - adding to environment by default`);
                this.environmentGroup.add(child);
                
                this.environmentObjects.push({
                    object: child,
                    type: 'Unknown',
                    name: childName
                });
            }
        });
        
        // Add groups to scene
        this.scene.add(this.carWrapper);
        this.scene.add(this.environmentGroup);
        
        // Setup components
        this.setupGround();
        this.setupBuildings();
        this.setupFences();
        
        // Add the car model back to scene
        this.scene.add(this.carModel);
        
        // Enable shadows and fix textures
        this.fixMaterialsAndShadows(this.carModel);
        this.fixMaterialsAndShadows(this.carWrapper);
        
        // Find car components
        this.findCarComponents();
        
        // Final texture check
        this.performTextureCheck();
        
        // Hide loading indicator
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.classList.add('hidden');
        }
        
        // Call external callback
        if (this.onModelLoadedCallback) {
            this.onModelLoadedCallback({
                carWrapper: this.carWrapper,
                groundObject: this.groundObject,
                environmentObjects: this.environmentObjects,
                frontWheelsGroup: this.frontWheelsGroup
            });
        }
    }
    
    /**
     * Handle loading progress
     */
    onLoadingProgress(xhr) {
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            const percentage = (xhr.loaded / xhr.total) * 100;
            loadingEl.textContent = `Loading car model... ${Math.round(percentage)}%`;
        }
        
        if (this.onProgressCallback) {
            this.onProgressCallback(xhr);
        }
    }
    
    /**
     * Handle loading error
     */
    onLoadingError(error) {
        console.error('Error loading model:', error);
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.textContent = 'Error loading model';
            loadingEl.style.color = 'red';
        }
        
        if (this.onErrorCallback) {
            this.onErrorCallback(error);
        }
    }
    
    /**
     * Setup ground object
     */
    setupGround() {
        if (!this.groundObject) {
            console.warn('⚠ Ground object not found in model!');
            return null;
        }
        
        this.groundObject.updateMatrixWorld(true);
        this.groundObject.visible = true;
        this.groundObject.receiveShadow = true;
        
        this.groundObject.traverse((node) => {
            if (node.isMesh) {
                node.receiveShadow = true;
                node.visible = true;
                node.renderOrder = 0;
                
                if (node.material) {
                    const materials = Array.isArray(node.material) ? node.material : [node.material];
                    materials.forEach(mat => {
                        if (mat && mat.type === 'MeshStandardMaterial') {
                            mat.side = THREE.DoubleSide;
                            mat.flatShading = false;
                            mat.depthWrite = true;
                        }
                    });
                }
            }
        });
        
        let groundBBox = null;
        this.groundObject.traverse((node) => {
            if (node.isMesh) {
                groundBBox = new THREE.Box3().setFromObject(node);
            }
        });
        
        return groundBBox;
    }
    
    /**
     * Setup buildings
     */
    setupBuildings() {
        if (this.buildings.length === 0) return;
        
        this.buildings.forEach((building) => {
            building.traverse((node) => {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                    this.fixTextures(node);
                }
            });
        });
    }
    
    /**
     * Setup fences
     */
    setupFences() {
        if (this.fences.length === 0) return;
        
        this.fences.forEach((fence) => {
            fence.traverse((node) => {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                    this.fixTextures(node);
                }
            });
        });
    }
    
    /**
     * Fix materials and shadows for object
     */
    fixMaterialsAndShadows(object) {
        object.traverse((node) => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
                
                if (node.material) {
                    const materials = Array.isArray(node.material) ? node.material : [node.material];
                    materials.forEach(mat => {
                        if (mat && mat.type === 'MeshStandardMaterial') {
                            mat.side = THREE.DoubleSide;
                            mat.flatShading = false;
                            
                            this.fixTextureEncoding(mat);
                            mat.needsUpdate = true;
                        }
                    });
                }
            }
        });
    }
    
    /**
     * Fix texture encoding for a material
     */
    fixTextureEncoding(mat) {
        if (mat.map) {
            mat.map.encoding = THREE.sRGBEncoding;
            mat.map.flipY = false;
            mat.map.needsUpdate = true;
        }
        if (mat.normalMap) {
            mat.normalMap.encoding = THREE.LinearEncoding;
            mat.normalMap.flipY = false;
            mat.normalMap.needsUpdate = true;
        }
        if (mat.roughnessMap) {
            mat.roughnessMap.encoding = THREE.LinearEncoding;
            mat.roughnessMap.flipY = false;
            mat.roughnessMap.needsUpdate = true;
        }
        if (mat.metalnessMap) {
            mat.metalnessMap.encoding = THREE.LinearEncoding;
            mat.metalnessMap.flipY = false;
            mat.metalnessMap.needsUpdate = true;
        }
    }
    
    /**
     * Fix textures on a mesh node
     */
    fixTextures(node) {
        if (node.material) {
            const materials = Array.isArray(node.material) ? node.material : [node.material];
            materials.forEach((mat) => {
                if (mat.map) {
                    this.fixTextureEncoding(mat);
                } else {
                    console.warn(`⚠ No diffuse/color map for material: ${mat.name || 'unnamed'}`);
                }
                
                mat.needsUpdate = true;
            });
        }
    }
    
    /**
     * Perform final texture check
     */
    performTextureCheck() {
        this.carModel.traverse((node) => {
            if (node.isMesh && node.material) {
                const materials = Array.isArray(node.material) ? node.material : [node.material];
                materials.forEach(mat => {
                    if (!mat.map && mat.type === 'MeshStandardMaterial') {
                        console.warn(`⚠ Object "${node.name}" has no texture - using color only`);
                    }
                });
            }
        });
    }
    
    /**
     * Find car components (wheels, body, etc.)
     */
    findCarComponents() {
        if (!this.carWrapper) {
            console.error('Car wrapper not loaded yet!');
            return;
        }
        
        const frontWheels = [];
        this.carWrapper.traverse((node) => {
            if (node.name === "Car_Body") {
                this.carBodyGroup = node;
            }
            if (node.name === "Front_Wheels") {
                this.frontWheelsGroup = node;
            }
            if (node.name === "Back_Wheels") {
                this.backWheelsGroup = node;
            }
            if (node.name === "FrontRightWheel" || node.name === "FrontLeftWheel") {
                frontWheels.push(node);
            }
        });
        
        if (!this.frontWheelsGroup && frontWheels.length > 0) {
            this.frontWheelsGroup = { wheels: frontWheels };
        }
    }
    
    /**
     * Create physics bodies for environment objects
     * @param {boolean} collidersVisible - Whether to show collision helpers
     * @returns {Array} Environment objects with physics
     */
    createEnvironmentPhysics(collidersVisible = true) {
        const colorMap = {
            'Building': 0x00ffff,
            'Fence': 0xffff00,
            'Wall': 0xff00ff,
            'Tree': 0x00ff00,
            'Road': 0x888888,
            'Obstacle': 0xff8800,
            'Sign': 0xffffff,
            'Prop': 0xff0088,
            'Unknown': 0xff0000
        };
        
        this.environmentObjects.forEach((envObj) => {
            const obj = envObj.object;
            const bbox = new THREE.Box3().setFromObject(obj);
            const size = bbox.getSize(new THREE.Vector3());
            const center = bbox.getCenter(new THREE.Vector3());
            
            // Create box collider
            const shape = new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2));
            const body = new CANNON.Body({
                mass: 0,
                shape: shape,
                material: new CANNON.Material({ friction: 0.3, restitution: 0.1 })
            });
            
            body.position.set(center.x, center.y, center.z);
            this.world.addBody(body);
            
            // Create visual helper
            const helperColor = colorMap[envObj.type] || colorMap['Unknown'];
            const helperGeometry = new THREE.BoxGeometry(size.x, size.y, size.z);
            const helperMaterial = new THREE.MeshBasicMaterial({ 
                color: helperColor, 
                wireframe: true,
                transparent: true,
                opacity: 0.5
            });
            const helper = new THREE.Mesh(helperGeometry, helperMaterial);
            helper.position.copy(center);
            helper.visible = collidersVisible;
            this.scene.add(helper);
            
            // Store references
            obj.userData.physicsHelper = helper;
            obj.userData.physicsBody = body;
        });
        
        return this.environmentObjects;
    }
    
    /**
     * Log model hierarchy (recursive)
     */
    logModelHierarchy(object, indent = '') {
        // Silent method - used internally for debugging
        object.children.forEach(child => this.logModelHierarchy(child, indent + '  '));
    }
    
    /**
     * Find object in hierarchy
     */
    findObjectInHierarchy(root, name) {
        if (root.name === name) {
            return root;
        }
        
        for (let child of root.children) {
            const found = this.findObjectInHierarchy(child, name);
            if (found) return found;
        }
        
        return null;
    }
    
    /**
     * Get car wrapper
     * @returns {THREE.Group}
     */
    getCarWrapper() {
        return this.carWrapper;
    }
    
    /**
     * Get ground object
     * @returns {THREE.Object3D}
     */
    getGroundObject() {
        return this.groundObject;
    }
    
    /**
     * Get environment objects
     * @returns {Array}
     */
    getEnvironmentObjects() {
        return this.environmentObjects;
    }
    
    /**
     * Get front wheels group
     * @returns {THREE.Group|Object}
     */
    getFrontWheelsGroup() {
        return this.frontWheelsGroup;
    }
    
    /**
     * Get car body group
     * @returns {THREE.Group}
     */
    getCarBodyGroup() {
        return this.carBodyGroup;
    }
    
    /**
     * Get back wheels group
     * @returns {THREE.Group}
     */
    getBackWheelsGroup() {
        return this.backWheelsGroup;
    }
    
    /**
     * Cleanup environment system
     */
    cleanup() {
        // Remove physics bodies
        this.environmentObjects.forEach(envObj => {
            if (envObj.object.userData.physicsBody) {
                this.world.removeBody(envObj.object.userData.physicsBody);
            }
            if (envObj.object.userData.physicsHelper) {
                this.scene.remove(envObj.object.userData.physicsHelper);
                envObj.object.userData.physicsHelper.geometry.dispose();
                envObj.object.userData.physicsHelper.material.dispose();
            }
        });
    }
}

