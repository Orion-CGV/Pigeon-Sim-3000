// Camera Control System - Handles camera rotation and collision detection
import * as THREE from 'three';

/**
 * CameraControl - Manages camera rotation (yaw/pitch) and collision detection
 */
export class CameraControl {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        
        // Camera rotation state
        this.yaw = 0;   // Horizontal rotation (left/right) in radians
        this.pitch = 0; // Vertical rotation (up/down) in radians
        this.PI_2 = Math.PI / 2; // 90 degrees in radians (used for pitch limits)
        this.baseMouseSensitivity = 0.0025; // Base mouse sensitivity multiplier
        this.mouseSensitivity = 0.0025; // Current mouse sensitivity multiplier
        
        // Camera collision settings
        this.cameraRadius = 0.2; // Radius of camera collision sphere
        this.useCollision = true; // Whether to check camera collisions
        
        // Internal state
        this.isPointerLocked = false;
        
        // Room bounds calculated from walls (inner boundary)
        this.roomBounds = null;
    }

    /**
     * Initializes the camera control system
     */
    init() {
        // Listen for pointer lock changes (when mouse is captured for looking around)
        document.addEventListener("pointerlockchange", () => this.onPointerLockChange());
        
        // Pointer lock on click - when user clicks canvas, capture mouse for looking
        this.renderer.domElement.addEventListener("click", () => {
            // Only request lock if not already locked
            if (document.pointerLockElement !== this.renderer.domElement) {
                // Request pointer lock on renderer canvas
                this.renderer.domElement.requestPointerLock();
            }
        });
    }
    
    /**
     * Calculates the room bounds from walls to define where camera is allowed
     * Should be called after walls are loaded
     */
    calculateRoomBounds() {
        const wallBoxes = this.scene.userData.wallBoxes;
        if (!wallBoxes || wallBoxes.length === 0) {
            // Fallback to ground bounds if no walls
            const groundBox = this.scene.userData.groundBox;
            if (groundBox) {
                this.roomBounds = {
                    minX: groundBox.min.x,
                    maxX: groundBox.max.x,
                    minZ: groundBox.min.z,
                    maxZ: groundBox.max.z
                };
            }
            return;
        }
        
        // Find the inner boundary of the room by analyzing wall positions
        // The inner boundary is the area that is NOT inside any wall but is within the perimeter
        
        // Strategy: Find walls that define the perimeter and calculate inner bounds
        // For now, we'll use a simpler approach: find the bounds of all walls and shrink inward
        
        // Get all wall boxes' min/max values
        let allMinX = Infinity;
        let allMaxX = -Infinity;
        let allMinZ = Infinity;
        let allMaxZ = -Infinity;
        
        // Find the overall bounds (outer edges of all walls)
        for (let box of wallBoxes) {
            allMinX = Math.min(allMinX, box.min.x);
            allMaxX = Math.max(allMaxX, box.max.x);
            allMinZ = Math.min(allMinZ, box.min.z);
            allMaxZ = Math.max(allMaxZ, box.max.z);
        }
        
        // Now find the inner bounds by identifying perimeter walls
        // The inner boundary is the space INSIDE the walls (camera can move here)
        // Start with outer bounds and shrink inward based on wall inner edges
        let innerMinX = allMinX;
        let innerMaxX = allMaxX;
        let innerMinZ = allMinZ;
        let innerMaxZ = allMaxZ;
        
        // Find the most inward edges of perimeter walls
        // For each wall, determine if it's a perimeter wall and use its inner edge
        for (let box of wallBoxes) {
            const wallThickness = Math.min(box.max.x - box.min.x, box.max.z - box.min.z);
            
            // Check if this wall is likely a perimeter wall based on position
            // West wall (smallest X): inner boundary is its max.x (inner edge)
            if (Math.abs(box.min.x - allMinX) < wallThickness * 2) {
                innerMinX = Math.max(innerMinX, box.max.x);
            }
            // East wall (largest X): inner boundary is its min.x (inner edge)
            if (Math.abs(box.max.x - allMaxX) < wallThickness * 2) {
                innerMaxX = Math.min(innerMaxX, box.min.x);
            }
            // South wall (smallest Z): inner boundary is its max.z (inner edge)
            if (Math.abs(box.min.z - allMinZ) < wallThickness * 2) {
                innerMinZ = Math.max(innerMinZ, box.max.z);
            }
            // North wall (largest Z): inner boundary is its min.z (inner edge)
            if (Math.abs(box.max.z - allMaxZ) < wallThickness * 2) {
                innerMaxZ = Math.min(innerMaxZ, box.min.z);
            }
        }
        
        // Validate the calculated bounds
        const groundBox = this.scene.userData.groundBox;
        if (innerMaxX <= innerMinX || innerMaxZ <= innerMinZ || 
            innerMaxX - innerMinX < 0.5 || innerMaxZ - innerMinZ < 0.5) {
            // Calculation failed or room too small, use ground bounds
            if (groundBox) {
                this.roomBounds = {
                    minX: groundBox.min.x,
                    maxX: groundBox.max.x,
                    minZ: groundBox.min.z,
                    maxZ: groundBox.max.z
                };
            } else {
                // Last resort: use a slightly shrunk version of outer bounds
                const shrinkAmount = 0.5;
                this.roomBounds = {
                    minX: allMinX + shrinkAmount,
                    maxX: allMaxX - shrinkAmount,
                    minZ: allMinZ + shrinkAmount,
                    maxZ: allMaxZ - shrinkAmount
                };
            }
        } else {
            // Store the calculated inner room bounds
            this.roomBounds = {
                minX: innerMinX,
                maxX: innerMaxX,
                minZ: innerMinZ,
                maxZ: innerMaxZ
            };
        }
    }

    /**
     * Handles pointer lock state changes (when mouse is captured/released)
     */
    onPointerLockChange() {
        // Check if pointer is now locked to our canvas
        if (document.pointerLockElement === this.renderer.domElement) {
            // Add mouse movement listener for camera control
            document.addEventListener("mousemove", (e) => this.onMouseMove(e));
            this.isPointerLocked = true;
        } else {
            // Remove mouse movement listener when pointer is unlocked
            document.removeEventListener("mousemove", this.onMouseMove);
            this.isPointerLocked = false;
        }
    }

    /**
     * Handles mouse movement for camera control (only when pointer is locked)
     * @param {MouseEvent} e - Mouse movement event
     */
    onMouseMove(e) {
        // Update yaw (horizontal rotation) based on mouse X movement
        this.yaw -= e.movementX * this.mouseSensitivity;
        // Update pitch (vertical rotation) based on mouse Y movement
        this.pitch += e.movementY * this.mouseSensitivity;
        // Define pitch limits to prevent camera from flipping over
        const maxPitch = this.PI_2 - 0.1; // Almost 90 degrees up
        const minPitch = -maxPitch;  // Almost 90 degrees down
        // Clamp pitch to prevent camera from going too far up or down
        this.pitch = Math.max(minPitch, Math.min(maxPitch, this.pitch));
    }

    /**
     * Checks if a point collides with any collidable objects (walls, arcades)
     * AND ensures camera stays inside the environment (not outside walls)
     * @param {THREE.Vector3} point - Point to check
     * @returns {boolean} - True if collision detected or outside allowed area
     */
    checkCollision(point) {
        if (!this.useCollision) return false;
        
        // First check: Ensure camera stays INSIDE the environment bounds
        // We need to check if the camera would be outside the room (outside all walls)
        const wallBoxes = this.scene.userData.wallBoxes;
        if (wallBoxes && wallBoxes.length > 0) {
            // Check if camera is outside ALL walls (would mean it's outside the room)
            // For now, we'll use a simple approach: check if point is way outside reasonable bounds
            // A better approach would be to check if camera is on the "inside" side of walls
            // But for now, we'll rely on the wall collision boxes to keep camera inside
        }
        
        // Check collision with walls (camera cannot be inside wall boxes)
        if (wallBoxes) {
            for (let box of wallBoxes) {
                // Check if camera collision sphere intersects with wall
                if (point.x >= box.min.x - this.cameraRadius && point.x <= box.max.x + this.cameraRadius &&
                    point.y >= box.min.y - this.cameraRadius && point.y <= box.max.y + this.cameraRadius &&
                    point.z >= box.min.z - this.cameraRadius && point.z <= box.max.z + this.cameraRadius) {
                    return true; // Camera collides with wall
                }
            }
        }
        
        // Check collision with arcades
        const arcadeBoxes = this.scene.userData.arcadeBoxes;
        if (arcadeBoxes) {
            for (let box of arcadeBoxes) {
                if (point.x >= box.min.x - this.cameraRadius && point.x <= box.max.x + this.cameraRadius &&
                    point.y >= box.min.y - this.cameraRadius && point.y <= box.max.y + this.cameraRadius &&
                    point.z >= box.min.z - this.cameraRadius && point.z <= box.max.z + this.cameraRadius) {
                    return true; // Camera collides with arcade
                }
            }
        }
        
        // Check collision with colliders
        const colliderBoxes = this.scene.userData.colliderBoxes;
        if (colliderBoxes) {
            for (let box of colliderBoxes) {
                if (point.x >= box.min.x - this.cameraRadius && point.x <= box.max.x + this.cameraRadius &&
                    point.y >= box.min.y - this.cameraRadius && point.y <= box.max.y + this.cameraRadius &&
                    point.z >= box.min.z - this.cameraRadius && point.z <= box.max.z + this.cameraRadius) {
                    return true; // Camera collides with collider
                }
            }
        }
        
        return false;
    }
    
    /**
     * Checks if a point is inside the environment (not outside walls)
     * Uses calculated room bounds from walls to ensure camera stays inside
     * @param {THREE.Vector3} point - Point to check
     * @returns {boolean} - True if point is inside environment bounds
     */
    isInsideEnvironment(point) {
        // First, recalculate room bounds if not already calculated
        if (!this.roomBounds) {
            this.calculateRoomBounds();
        }
        
        // Check room bounds (X and Z - horizontal boundaries)
        if (this.roomBounds) {
            if (point.x < this.roomBounds.minX || point.x > this.roomBounds.maxX ||
                point.z < this.roomBounds.minZ || point.z > this.roomBounds.maxZ) {
                return false; // Camera is outside room bounds (outside walls)
            }
        } else {
            // Fallback to ground bounds if room bounds not calculated
            const groundBox = this.scene.userData.groundBox;
            if (groundBox) {
                // Use ground bounds as room boundaries
                if (point.x < groundBox.min.x || point.x > groundBox.max.x ||
                    point.z < groundBox.min.z || point.z > groundBox.max.z) {
                    return false; // Camera is outside room bounds
                }
            }
        }
        
        // Check vertical bounds (above ground)
        const groundBox = this.scene.userData.groundBox;
        if (groundBox) {
            if (point.y < groundBox.max.y) {
                return false; // Camera is below ground
            }
        }
        
        return true;
    }

    /**
     * Updates camera position with collision detection
     * Ensures camera stays INSIDE walls and automatically adjusts if forced outside
     * @param {THREE.Vector3} targetPosition - Desired camera position
     * @param {THREE.Vector3} playerPosition - Player position (for fallback)
     * @returns {THREE.Vector3} - Actual camera position after collision adjustment
     */
    updateCameraPosition(targetPosition, playerPosition) {
        if (!this.useCollision) {
            // Still check if outside environment and bring it back inside
            if (!this.isInsideEnvironment(targetPosition)) {
                return this.clampToEnvironment(targetPosition, playerPosition);
            }
            return targetPosition;
        }
        
        // First check: If camera is forced outside environment, bring it back inside
        if (!this.isInsideEnvironment(targetPosition)) {
            targetPosition = this.clampToEnvironment(targetPosition, playerPosition);
        }
        
        // Check if target position is valid (no collision with walls/arcades)
        if (!this.checkCollision(targetPosition) && this.isInsideEnvironment(targetPosition)) {
            return targetPosition;
        }
        
        // If target position collides or is outside, find the closest safe position by moving closer to player
        const direction = new THREE.Vector3().subVectors(targetPosition, playerPosition);
        const targetDistance = direction.length();
        
        if (targetDistance < 0.001) {
            // Too close to player, use minimal offset
            return playerPosition.clone().add(new THREE.Vector3(0, 1.5, 0));
        }
        
        // Start from very close to player and move outward, finding the furthest safe position
        // This ensures we get as close as possible to the target while avoiding collision
        // When we hit a wall, the camera will be positioned CLOSER to the player
        let safePosition = playerPosition.clone();
        safePosition.y += 1.5; // Minimum height above player (fallback if all positions collide)
        let minDistance = 0.2; // Start very close to player
        let foundSafe = false;
        
        // Try increasing distances from player until we hit a collision
        // This moves the camera CLOSER to player when there's a wall (stops before collision)
        for (let testDistance = minDistance; testDistance <= targetDistance; testDistance += 0.1) {
            // Interpolate position from player toward target
            const t = testDistance / targetDistance; // 0 at player, 1 at target
            const testPosition = new THREE.Vector3().lerpVectors(
                playerPosition,
                targetPosition,
                t
            );
            
            // Check both collision and environment bounds
            if (!this.checkCollision(testPosition) && this.isInsideEnvironment(testPosition)) {
                // This position is safe, keep it and continue testing further
                safePosition = testPosition;
                foundSafe = true;
            } else {
                // We hit a collision or went outside, stop and use the last safe position (which is closer to player)
                break;
            }
        }
        
        // If we never found a safe position, use minimum distance from player
        if (!foundSafe) {
            safePosition = new THREE.Vector3().lerpVectors(
                playerPosition,
                targetPosition,
                minDistance / targetDistance
            );
            safePosition.y = Math.max(safePosition.y, playerPosition.y + 1.5);
            
            // Ensure it's inside environment
            if (!this.isInsideEnvironment(safePosition)) {
                safePosition = this.clampToEnvironment(safePosition, playerPosition);
            }
        }
        
        return safePosition;
    }
    
    /**
     * Clamps a position to be inside the environment bounds
     * @param {THREE.Vector3} position - Position to clamp
     * @param {THREE.Vector3} playerPosition - Player position (reference)
     * @returns {THREE.Vector3} - Clamped position inside environment
     */
    clampToEnvironment(position, playerPosition) {
        const groundBox = this.scene.userData.groundBox;
        if (!groundBox) {
            // No ground reference, just use player position with offset
            return playerPosition.clone().add(new THREE.Vector3(0, 1.5, 0));
        }
        
        const clamped = position.clone();
        const margin = 10; // Margin from room edges
        
        // Clamp X and Z to within room bounds (with margin)
        clamped.x = Math.max(groundBox.min.x - margin, Math.min(groundBox.max.x + margin, clamped.x));
        clamped.z = Math.max(groundBox.min.z - margin, Math.min(groundBox.max.z + margin, clamped.z));
        
        // Ensure camera is above ground
        clamped.y = Math.max(groundBox.max.y + 0.5, clamped.y);
        
        // Ensure camera is not too far from player (pull it back toward player if needed)
        const toPlayer = new THREE.Vector3().subVectors(playerPosition, clamped);
        const distance = toPlayer.length();
        if (distance > 5) {
            // Camera too far, pull it closer
            toPlayer.normalize().multiplyScalar(5);
            clamped.add(toPlayer);
        }
        
        return clamped;
    }

    /**
     * Gets the current camera state (yaw and pitch)
     * @returns {Object} - Object with yaw and pitch
     */
    getCameraState() {
        return {
            yaw: this.yaw,
            pitch: this.pitch
        };
    }

    /**
     * Sets the camera rotation
     * @param {number} yaw - Horizontal rotation in radians
     * @param {number} pitch - Vertical rotation in radians
     */
    setRotation(yaw, pitch) {
        this.yaw = yaw;
        const maxPitch = this.PI_2 - 0.1;
        const minPitch = -maxPitch;
        this.pitch = Math.max(minPitch, Math.min(maxPitch, pitch));
    }

    /**
     * Sets mouse sensitivity
     * @param {number} sensitivity - Mouse sensitivity multiplier (typically 0.5 to 2.0)
     */
    setMouseSensitivity(sensitivity) {
        // mouseSensitivity = base * sensitivity
        // If sensitivity is 1.0, use base value
        // If sensitivity is 2.0, use 2x base value
        this.mouseSensitivity = this.baseMouseSensitivity * sensitivity;
    }

    /**
     * Enables or disables camera collision detection
     * @param {boolean} enabled - Whether collision detection is enabled
     */
    setCollisionEnabled(enabled) {
        this.useCollision = enabled;
    }

    /**
     * Sets camera collision radius
     * @param {number} radius - Radius of camera collision sphere
     */
           setCameraRadius(radius) {
               this.cameraRadius = radius;
           }

           /**
            * Sets the mouse sensitivity multiplier
            * @param {number} sensitivity - Sensitivity value (typically 0.5 to 2.0)
            */
           setMouseSensitivity(sensitivity) {
               // mouseSensitivity = base * sensitivity
               // If sensitivity is 1.0, use base value
               // If sensitivity is 2.0, use 2x base value
               this.mouseSensitivity = this.baseMouseSensitivity * sensitivity;
           }

           /**
            * Cleanup camera control system
            */
           cleanup() {
        document.removeEventListener("pointerlockchange", this.onPointerLockChange);
        document.removeEventListener("mousemove", this.onMouseMove);
    }
}

