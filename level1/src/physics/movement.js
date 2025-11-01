import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';
import { input } from "../input/inputHandler.js";

// Simple per-level physics state (matches level1.js behavior)
let velocityY = 0;
let spaceLocked = false;

export function updateWalking(player, camera, scene, delta) {
    // Use the same constants as level1.js (frame-style values). We'll scale them by a frame factor
    const speed = 0.15; // base per-frame movement used in level1.js
    const gravity = -0.03;
    const jumpStrength = 0.45;

    // Prevent very large delta spikes from causing huge movement
    const frameScale = Math.min(4, 60 * delta);

    // Compute horizontal forward/right from camera but ignore camera pitch (y)
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    // Ignore vertical component for walking and move away from the camera so
    // 'forward' (W) moves in the direction the camera is facing relative to the player.
    forward.y = 0;
    forward.normalize();
    forward.negate();

    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0,1,0)).normalize();

    // Horizontal movement
    player.position.addScaledVector(forward, input.forward * speed * frameScale);
    player.position.addScaledVector(right, input.right * speed * frameScale);

    // Vertical movement (gravity & jump)
    // half-height for a 1 unit tall player
    const halfHeight = 0.5;

    // Apply gravity
    velocityY += gravity * frameScale;
    player.position.y += velocityY * frameScale;

    // Ground collision using scene's ground collider when available
    let onGround = false;
    const groundCollider = scene && scene.userData && scene.userData.groundCollider;
    const groundY = groundCollider ? groundCollider.getHeightAt(player.position.x, player.position.z) : 0;
    if (player.position.y <= groundY + halfHeight) {
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
