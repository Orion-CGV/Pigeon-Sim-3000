import * as THREE from 'three';
import { input } from "../input/inputHandler.js";

// Speed boost variables
let speedBoostActive = false;
let speedBoostTimer = 0;
const SPEED_BOOST_DURATION = 15.0; // seconds of boost
const SPEED_BOOST_MULTIPLIER = 2.0; // 2x speed
const SPEED_BOOST_THRESHOLD = 1.5; // seconds of continuous forward movement to activate

// updateFlying now accepts an optional state object to support smooth ascent on toggle
export function updateFlying(player, camera, scene, delta, state = {}) {
    // Use level1-like constants and scale per-frame similarly to movement
    const baseSpeed = 0.25; // base per-frame flight speed from level1.js
    const ascendSpeed = 0.2; // smooth ascend step when toggling into flight

    const frameScale = Math.min(4, 60 * delta);

    // Update speed boost system
    updateSpeedBoost(delta, input.forward);

    // Calculate current speed with boost
    const currentSpeed = speedBoostActive ? baseSpeed * SPEED_BOOST_MULTIPLIER : baseSpeed;

    // Store original position for collision detection
    const originalPosition = player.position.clone();

    // If we're ascending to a target fly height, do so first
    if (state.isAscendingToFly) {
        if (player.position.y < state.targetFlyHeight) {
            player.position.y += ascendSpeed * frameScale;
            
            // Check collision during ascent
            if (checkCollision(player, scene)) {
                player.position.copy(originalPosition);
                state.isAscendingToFly = false; // Stop ascent if we hit something
            }
            // don't process horizontal movement until ascent finished
            return false;
        } else {
            state.isAscendingToFly = false;
        }
    }

    // Calculate desired movement
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    direction.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();

    // Calculate movement vectors
    const moveForward = input.forward * currentSpeed * frameScale;
    const moveRight = input.right * currentSpeed * frameScale;
    const moveVertical = input.up * currentSpeed * frameScale;

    // Apply horizontal movement with incremental collision checking
    applyMovementWithCollision(player, direction, moveForward, scene);
    applyMovementWithCollision(player, right, moveRight, scene);

    // Apply vertical movement with incremental collision checking
    applyVerticalMovementWithCollision(player, moveVertical, scene);

    // Ground landing detection (use ground collider if available)
    const groundCollider = scene && scene.userData && scene.userData.groundCollider;
    const halfHeight = 0.5;
    if (groundCollider) {
        const groundY = groundCollider.getHeightAt(player.position.x, player.position.z);
        // If player has descended to or below ground level, snap to ground and signal landed
        if (player.position.y <= groundY + halfHeight) {
            player.position.y = groundY + halfHeight;
            return true; // landed
        }
    }

    return false;
}

// NEW: Apply movement incrementally with collision checking (same as walking)
function applyMovementWithCollision(player, direction, distance, scene) {
    if (distance === 0) return;

    const originalPosition = player.position.clone();
    const stepSize = 0.1; // Smaller steps for more precise collision detection
    const steps = Math.ceil(Math.abs(distance) / stepSize);
    const stepDistance = distance / steps;

    for (let i = 0; i < steps; i++) {
        player.position.addScaledVector(direction, stepDistance);
        
        if (checkCollision(player, scene)) {
            // Collision detected, revert to previous position
            player.position.addScaledVector(direction, -stepDistance);
            
            // Try smaller adjustment to slide along surfaces
            const smallStep = stepDistance * 0.1;
            player.position.addScaledVector(direction, smallStep);
            if (checkCollision(player, scene)) {
                player.position.addScaledVector(direction, -smallStep);
            }
            break;
        }
    }
}

// NEW: Apply vertical movement with incremental collision checking
function applyVerticalMovementWithCollision(player, distance, scene) {
    if (distance === 0) return;

    const stepSize = 0.1; // Smaller steps for more precise collision detection
    const steps = Math.ceil(Math.abs(distance) / stepSize);
    const stepDistance = distance / steps;
    const upVector = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < steps; i++) {
        player.position.addScaledVector(upVector, stepDistance);
        
        if (checkCollision(player, scene)) {
            // Collision detected, revert to previous position
            player.position.addScaledVector(upVector, -stepDistance);
            
            // Try smaller adjustment
            const smallStep = stepDistance * 0.1;
            player.position.addScaledVector(upVector, smallStep);
            if (checkCollision(player, scene)) {
                player.position.addScaledVector(upVector, -smallStep);
            }
            break;
        }
    }
}

function updateSpeedBoost(delta, forwardInput) {
    // Only activate boost when moving forward (forwardInput > 0)
    if (forwardInput > 0) {
        speedBoostTimer += delta;
        
        // Activate boost after holding forward for threshold time
        if (!speedBoostActive && speedBoostTimer >= SPEED_BOOST_THRESHOLD) {
            speedBoostActive = true;
            speedBoostTimer = 0; // Reset timer for duration tracking
            console.log("Speed boost activated!");
        }
        
        // If boost is active, count down duration
        if (speedBoostActive) {
            speedBoostTimer += delta; // Now using timer for duration tracking
            if (speedBoostTimer >= SPEED_BOOST_DURATION) {
                speedBoostActive = false;
                speedBoostTimer = 0;
                console.log("Speed boost ended");
            }
        }
    } else {
        // Reset timer if not moving forward
        speedBoostActive = false;
        speedBoostTimer = 0;
    }
}

// UPDATED: Now checks all collision objects with correct property names
function checkCollision(player, scene) {
    if (!scene.userData) {
        return false;
    }

    // Create player bounding box (same as walking)
    const playerWidth = 0.8;
    const playerHeight = 1.0;
    const playerDepth = 0.8;
    
    const playerBox = new THREE.Box3();
    playerBox.setFromCenterAndSize(
        player.position,
        new THREE.Vector3(playerWidth, playerHeight, playerDepth)
    );

    // Check collision with buildings
    if (scene.userData.buildings) {
        for (const building of scene.userData.buildings) {
            if (building.userData.collider && building.userData.collider.intersectsBox(playerBox)) {
                return true;
            }
        }
    }

    // FIXED: Check collision with trees - use correct property name
    if (scene.userData.treeColliders) {
        for (const treeCollider of scene.userData.treeColliders) {
            if (treeCollider.intersectsBox(playerBox)) {
                return true;
            }
        }
    }

    // FIXED: Check collision with benches - use correct property name
    if (scene.userData.benchColliders) {
        for (const benchCollider of scene.userData.benchColliders) {
            if (benchCollider.intersectsBox(playerBox)) {
                return true;
            }
        }
    }

    // FIXED: Check collision with cars - use correct property name
    if (scene.userData.carColliders) {
        for (const carCollider of scene.userData.carColliders) {
            if (carCollider.intersectsBox(playerBox)) {
                return true;
            }
        }
    }

    // Check collision with parks (if they have colliders)
    if (scene.userData.parks) {
        for (const park of scene.userData.parks) {
            if (park.userData && park.userData.collider && park.userData.collider.intersectsBox(playerBox)) {
                return true;
            }
        }
    }

    // Check collision with parking lots (if they have colliders)
    if (scene.userData.parkingLots) {
        for (const parkingLot of scene.userData.parkingLots) {
            if (parkingLot.userData && parkingLot.userData.collider && parkingLot.userData.collider.intersectsBox(playerBox)) {
                return true;
            }
        }
    }

    // Check collision with sidewalks (if they have colliders)
    if (scene.userData.sidewalks) {
        for (const sidewalk of scene.userData.sidewalks) {
            if (sidewalk.userData && sidewalk.userData.collider && sidewalk.userData.collider.intersectsBox(playerBox)) {
                return true;
            }
        }
    }

    return false;
}

// Getter for speed boost state (useful for UI/effects)
export function getSpeedBoostState() {
    let progress = 0;
    let timeRemaining = 0;
    
    if (speedBoostActive) {
        // Progress for active boost (how much time is left)
        progress = 1 - (speedBoostTimer / SPEED_BOOST_DURATION);
        timeRemaining = Math.max(0, SPEED_BOOST_DURATION - speedBoostTimer);
    } else {
        // Progress for charging boost (how close to activation)
        progress = speedBoostTimer / SPEED_BOOST_THRESHOLD;
        timeRemaining = Math.max(0, SPEED_BOOST_THRESHOLD - speedBoostTimer);
    }
    
    return {
        active: speedBoostActive,
        timer: speedBoostTimer,
        progress: Math.min(1, Math.max(0, progress)), // Clamp between 0-1
        timeRemaining: timeRemaining,
        isCharging: !speedBoostActive && speedBoostTimer > 0
    };
}

// Reset speed boost (useful when changing modes)
export function resetSpeedBoost() {
    speedBoostActive = false;
    speedBoostTimer = 0;
}