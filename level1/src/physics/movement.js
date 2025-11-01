import * as THREE from 'three';
import { input } from "../input/inputHandler.js";

// Simple per-level physics state (matches level1.js behavior)
let velocityY = 0;
let spaceLocked = false;

// Speed boost variables for walking
let walkSpeedBoostActive = false;
let walkSpeedBoostTimer = 0;
const WALK_SPEED_BOOST_DURATION = 5.0; // seconds of boost
const WALK_SPEED_BOOST_MULTIPLIER = 1.8; // 1.8x speed (slightly less than flying)
const WALK_SPEED_BOOST_THRESHOLD = 1.5; // seconds of continuous forward movement to activate

export function updateWalking(player, camera, scene, delta) {
    // Use the same constants as level1.js (frame-style values). We'll scale them by a frame factor
    const baseSpeed = 0.15; // base per-frame movement used in level1.js
    const gravity = -0.03;
    const jumpStrength = 0.45;

    // Prevent very large delta spikes from causing huge movement
    const frameScale = Math.min(4, 60 * delta);

    // Update speed boost system for walking
    updateWalkSpeedBoost(delta, input.forward);

    // Calculate current speed with boost
    const currentSpeed = walkSpeedBoostActive ? baseSpeed * WALK_SPEED_BOOST_MULTIPLIER : baseSpeed;

    // Compute horizontal forward/right from camera but ignore camera pitch (y)
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    // Ignore vertical component for walking and move away from the camera so
    // 'forward' (W) moves in the direction the camera is facing relative to the player.
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0,1,0)).normalize();

    // Calculate desired movement
    const moveForward = input.forward * currentSpeed * frameScale;
    const moveRight = input.right * currentSpeed * frameScale;

    // Store original position for collision detection
    const originalPosition = player.position.clone();

    // Apply horizontal movement
    player.position.addScaledVector(forward, moveForward);
    player.position.addScaledVector(right, moveRight);

    // Check building collisions for horizontal movement
    if (checkBuildingCollision(player, scene)) {
        // Revert horizontal movement if collision detected
        player.position.copy(originalPosition);
        
        // Try moving in just one direction (sliding along walls)
        const tempPos = originalPosition.clone();
        tempPos.addScaledVector(forward, moveForward);
        player.position.copy(tempPos);
        
        if (checkBuildingCollision(player, scene)) {
            player.position.copy(originalPosition);
            
            tempPos.copy(originalPosition);
            tempPos.addScaledVector(right, moveRight);
            player.position.copy(tempPos);
            
            if (checkBuildingCollision(player, scene)) {
                player.position.copy(originalPosition);
            }
        }
    }

    // Vertical movement (gravity & jump)
    // half-height for a 1 unit tall player
    const halfHeight = 0.5;

    // Store vertical position before applying gravity
    const verticalPosition = player.position.clone();

    // Apply gravity
    velocityY += gravity * frameScale;
    player.position.y += velocityY * frameScale;

    // Check building collisions for vertical movement
    if (checkBuildingCollision(player, scene)) {
        // If we hit a building while moving up (jumping), stop upward movement
        if (velocityY > 0) {
            player.position.copy(verticalPosition);
            velocityY = 0;
        } 
        // If we hit a building while falling, treat it as ground
        else if (velocityY < 0) {
            player.position.copy(verticalPosition);
            velocityY = 0;
        }
    }

    // Ground collision using scene's ground collider when available
    let onGround = false;
    const groundCollider = scene && scene.userData && scene.userData.groundCollider;
    const groundY = groundCollider ? groundCollider.getHeightAt(player.position.x, player.position.z) : 0;
    
    // Only check ground collision if we're not colliding with a building
    if (!checkBuildingCollision(player, scene) && player.position.y <= groundY + halfHeight) {
        player.position.y = groundY + halfHeight;
        velocityY = 0;
        onGround = true;
    }

    // Jumping: input.up acts like Space (1 when held)
    if (onGround && input.up > 0 && !spaceLocked) {
        velocityY = jumpStrength;
        spaceLocked = true;
    }

    // Release the space lock once key is released
    if (input.up === 0) spaceLocked = false;
}

function updateWalkSpeedBoost(delta, forwardInput) {
    // Only activate boost when moving forward (forwardInput > 0)
    if (forwardInput > 0) {
        walkSpeedBoostTimer += delta;
        
        // Activate boost after holding forward for threshold time
        if (!walkSpeedBoostActive && walkSpeedBoostTimer >= WALK_SPEED_BOOST_THRESHOLD) {
            walkSpeedBoostActive = true;
            walkSpeedBoostTimer = 0; // Reset timer for duration tracking
            console.log("Walk speed boost activated!");
        }
        
        // If boost is active, count down duration
        if (walkSpeedBoostActive) {
            walkSpeedBoostTimer += delta; // Now using timer for duration tracking
            if (walkSpeedBoostTimer >= WALK_SPEED_BOOST_DURATION) {
                walkSpeedBoostActive = false;
                walkSpeedBoostTimer = 0;
                console.log("Walk speed boost ended");
            }
        }
    } else {
        // Reset timer if not moving forward
        walkSpeedBoostActive = false;
        walkSpeedBoostTimer = 0;
    }
}

function checkBuildingCollision(player, scene) {
    if (!scene.userData || !scene.userData.buildings) {
        return false;
    }

    // Create a more accurate player bounding box
    const playerBox = getPlayerBoundingBox(player);

    // Check collision with each building
    for (const building of scene.userData.buildings) {
        if (building.userData.collider && building.userData.collider.intersectsBox(playerBox)) {
            return true;
        }
    }

    return false;
}

function getPlayerBoundingBox(player) {
    // Create a bounding box that represents the player's collision volume
    // Adjust these values based on your player's actual size
    const playerWidth = 0.8;
    const playerHeight = 1.0;
    const playerDepth = 0.8;
    
    const playerBox = new THREE.Box3();
    playerBox.setFromCenterAndSize(
        player.position,
        new THREE.Vector3(playerWidth, playerHeight, playerDepth)
    );
    
    return playerBox;
}

// Getter for walk speed boost state
export function getWalkSpeedBoostState() {
    let progress = 0;
    let timeRemaining = 0;
    
    if (walkSpeedBoostActive) {
        // Progress for active boost (how much time is left)
        progress = 1 - (walkSpeedBoostTimer / WALK_SPEED_BOOST_DURATION);
        timeRemaining = Math.max(0, WALK_SPEED_BOOST_DURATION - walkSpeedBoostTimer);
    } else {
        // Progress for charging boost (how close to activation)
        progress = walkSpeedBoostTimer / WALK_SPEED_BOOST_THRESHOLD;
        timeRemaining = Math.max(0, WALK_SPEED_BOOST_THRESHOLD - walkSpeedBoostTimer);
    }
    
    return {
        active: walkSpeedBoostActive,
        timer: walkSpeedBoostTimer,
        progress: Math.min(1, Math.max(0, progress)), // Clamp between 0-1
        timeRemaining: timeRemaining,
        isCharging: !walkSpeedBoostActive && walkSpeedBoostTimer > 0
    };
}

// Reset walk speed boost
export function resetWalkSpeedBoost() {
    walkSpeedBoostActive = false;
    walkSpeedBoostTimer = 0;
}

// Debug function to visualize collision boxes
export function enableCollisionDebug(scene, enabled = true) {
    if (!scene.userData || !scene.userData.buildings) return;

    // Remove existing debug helpers
    if (scene.userData.collisionHelpers) {
        scene.userData.collisionHelpers.forEach(helper => scene.remove(helper));
    }

    if (enabled) {
        scene.userData.collisionHelpers = [];
        scene.userData.buildings.forEach(building => {
            if (building.userData.collider) {
                const boxHelper = new THREE.Box3Helper(building.userData.collider, 0xff0000); // Red for visibility
                scene.userData.collisionHelpers.push(boxHelper);
                scene.add(boxHelper);
            }
        });
        console.log(`Enabled collision debug for ${scene.userData.collisionHelpers.length} objects`);
    }
}