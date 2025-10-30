/**
 * ========================================
 * CAMERA SYSTEM
 * ========================================
 * 
 * Manages all camera functionality:
 * - Camera initialization and setup
 * - Camera modes (behind car, top-down)
 * - Orbit controls and user interaction
 * - Camera collision detection
 * - Smooth camera transitions and auto-reset
 * 
 * This module handles all camera-related logic.
 * ========================================
 */

export class CameraSystem {
    constructor(scene, renderer, existingCamera = null) {
        this.scene = scene;
        this.renderer = renderer;
        this.existingCamera = existingCamera; // Use existing camera if provided
        
        // Camera and controls
        this.camera = null;
        this.controls = null;
        this.raycaster = new THREE.Raycaster();
        
        // Camera state
        this.cameraAngle = 0; // 0 = behind car, 1 = top-down
        this.lastCameraAngle = -1;
        this.initialCameraOffset = new THREE.Vector3(0, 4, 8);
        this.defaultCameraDistance = 20;
        this.defaultCameraHeight = 10;
        
        // Camera control state
        this.isUserControllingCamera = false;
        this.cameraResetTimer = 0;
        this.cameraResetDelay = 0; // Reset immediately after user stops
        this.cameraResetInProgress = false;
        
        // Ground level for collision detection
        this.groundLevel = 0;
        
        // Environment objects for collision detection
        this.environmentObjects = [];
    }
    
    /**
     * Initialize camera and controls
     */
    init() {
        this.setupCamera();
        this.setupControls();
    }
    
    /**
     * Setup the perspective camera
     */
    setupCamera() {
        // Use existing camera if provided, otherwise create new one
        if (this.existingCamera) {
            this.camera = this.existingCamera;
            // Update camera settings to match Arcade game expectations
            this.camera.fov = 45;
            this.camera.near = 0.5;
            this.camera.far = 1000;
            this.camera.updateProjectionMatrix(); // CRITICAL: Apply the changes
        } else {
            this.camera = new THREE.PerspectiveCamera(
                45,
                window.innerWidth / window.innerHeight,
                0.5,
                1000
            );
        }
        
        // Start with behind-car view
        this.camera.position.set(0, 4, 8);
        this.camera.lookAt(0, 0, 5);
        
        this.initialCameraOffset = new THREE.Vector3(0, 4, 8);
    }
    
    /**
     * Setup orbit controls
     */
    setupControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.1;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 50;
        this.controls.maxPolarAngle = Math.PI / 2;
        this.controls.minPolarAngle = 0.1;
        this.controls.enabled = true;
        
        // Disable keyboard controls
        this.controls.keys = {
            LEFT: -1,
            UP: -1,
            RIGHT: -1,
            BOTTOM: -1
        };
        
        this.controls.target.set(0, 0, 0);
        
        // Add event listeners for user interaction detection
        this.controls.addEventListener('start', () => {
            this.isUserControllingCamera = true;
            this.cameraResetTimer = 0;
            this.cameraResetInProgress = false;
        });
        
        this.controls.addEventListener('end', () => {
            this.isUserControllingCamera = false;
            this.cameraResetTimer = 0;
        });
    }
    
    /**
     * Toggle camera mode
     */
    toggleCameraMode() {
        this.cameraAngle = (this.cameraAngle + 1) % 2;
        
        // Reset camera state when switching modes
        this.isUserControllingCamera = false;
        this.cameraResetTimer = 0;
        this.cameraResetInProgress = false;
        
        return this.cameraAngle;
    }
    
    /**
     * Check camera collisions with ground and buildings
     */
    checkCameraCollisions(carWrapper, carPhysicsOffset) {
        if (!carWrapper || !this.camera) return;
        
        // 1. Check ground collision
        if (this.camera.position.y < this.groundLevel) {
            this.camera.position.y = this.groundLevel;
        }
        
        // 2. Check building collisions
        const collidableMeshes = [];
        this.environmentObjects.forEach(envObj => {
            const objType = envObj.type.toLowerCase();
            if (!objType.includes('road') && !objType.includes('prop')) {
                envObj.object.traverse(node => {
                    if (node.isMesh) {
                        collidableMeshes.push(node);
                    }
                });
            }
        });
        
        if (collidableMeshes.length === 0) return;
        
        // Cast ray from car to camera
        const carPos = carWrapper.position.clone();
        if (carPhysicsOffset && carPhysicsOffset.length() > 0) {
            const rotatedOffset = carPhysicsOffset.clone();
            rotatedOffset.applyQuaternion(carWrapper.quaternion);
            carPos.add(rotatedOffset);
        }
        carPos.y += 2;
        
        const cameraPos = this.camera.position.clone();
        const direction = new THREE.Vector3().subVectors(cameraPos, carPos);
        const distance = direction.length();
        
        if (distance < 2) return;
        
        direction.normalize();
        this.raycaster.set(carPos, direction);
        this.raycaster.far = distance;
        
        const intersects = this.raycaster.intersectObjects(collidableMeshes, false);
        
        if (intersects.length > 0) {
            const firstIntersect = intersects[0];
            const safeDistance = Math.max(firstIntersect.distance - 2.0, 3);
            
            if (safeDistance < distance) {
                const newCameraPos = carPos.clone().add(direction.clone().multiplyScalar(safeDistance));
                this.camera.position.lerp(newCameraPos, 0.08);
                
                if (this.camera.position.y < this.groundLevel) {
                    this.camera.position.y = this.groundLevel;
                }
            }
        }
    }
    
    /**
     * Update camera position and controls
     * @param {number} deltaTime - Time since last frame
     * @param {THREE.Object3D} carWrapper - Car wrapper object
     * @param {THREE.Vector3} carPhysicsOffset - Physics offset for car center
     */
    update(deltaTime, carWrapper, carPhysicsOffset) {
        if (!carWrapper) return;
        
        // Calculate car visual center
        const carVisualCenter = carWrapper.position.clone();
        if (carPhysicsOffset && carPhysicsOffset.length() > 0) {
            const rotatedOffset = carPhysicsOffset.clone();
            rotatedOffset.applyQuaternion(carWrapper.quaternion);
            carVisualCenter.add(rotatedOffset);
        }
        
        // Update controls target to follow car
        this.controls.target.copy(carVisualCenter);
        this.controls.update();
        
        // Check collisions in behind-car mode
        if (this.cameraAngle === 0) {
            this.checkCameraCollisions(carWrapper, carPhysicsOffset);
        }
        
        // Update camera based on mode
        if (this.cameraAngle === 0) {
            // Behind car view with mouse control
            this.controls.enabled = true;
            
            // Calculate default camera position
            const backwardDirection = new THREE.Vector3(-1, 0, 0);
            backwardDirection.applyQuaternion(carWrapper.quaternion);
            
            const defaultCameraPos = new THREE.Vector3(
                carVisualCenter.x + backwardDirection.x * this.defaultCameraDistance,
                carVisualCenter.y + this.defaultCameraHeight,
                carVisualCenter.z + backwardDirection.z * this.defaultCameraDistance
            );
            
            // Handle camera reset logic
            if (!this.isUserControllingCamera) {
                this.cameraResetTimer += deltaTime;
                
                if (this.cameraResetTimer >= this.cameraResetDelay) {
                    this.cameraResetInProgress = true;
                }
            }
            
            // Smoothly reset camera to default position
            if (this.cameraResetInProgress) {
                const resetSpeed = 0.05;
                this.camera.position.lerp(defaultCameraPos, resetSpeed);
                
                const distanceToDefault = this.camera.position.distanceTo(defaultCameraPos);
                if (distanceToDefault < 0.5) {
                    this.cameraResetInProgress = false;
                    this.cameraResetTimer = 0;
                }
            }
        } else {
            // Top-down view - disable mouse controls
            this.controls.enabled = false;
            
            this.camera.position.set(
                carVisualCenter.x,
                carVisualCenter.y + 50,
                carVisualCenter.z
            );
            this.camera.lookAt(carVisualCenter);
        }
    }
    
    /**
     * Handle window resize
     */
    handleResize() {
        if (this.camera) {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
        }
    }
    
    /**
     * Set ground level for collision detection
     * @param {number} level - Ground Y position
     */
    setGroundLevel(level) {
        this.groundLevel = level;
    }
    
    /**
     * Set environment objects for collision detection
     * @param {Array} objects - Array of environment objects
     */
    setEnvironmentObjects(objects) {
        this.environmentObjects = objects;
    }
    
    /**
     * Get camera instance
     * @returns {THREE.PerspectiveCamera}
     */
    getCamera() {
        return this.camera;
    }
    
    /**
     * Get controls instance
     * @returns {THREE.OrbitControls}
     */
    getControls() {
        return this.controls;
    }
    
    /**
     * Get current camera mode
     * @returns {number} 0 = behind car, 1 = top-down
     */
    getCameraMode() {
        return this.cameraAngle;
    }
    
    /**
     * Get user control state
     * @returns {boolean}
     */
    isUserControlling() {
        return this.isUserControllingCamera;
    }
    
    /**
     * Get camera reset state
     * @returns {boolean}
     */
    isResettingCamera() {
        return this.cameraResetInProgress;
    }
    
    /**
     * Cleanup camera system
     */
    cleanup() {
        if (this.controls) {
            this.controls.dispose();
        }
    }
}

