import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';
import { input } from "../input/inputHandler.js";

// updateFlying now accepts an optional state object to support smooth ascent on toggle
export function updateFlying(player, camera, scene, delta, state = {}) {
    // Use level1-like constants and scale per-frame similarly to movement
    const speed = 0.25; // base per-frame flight speed from level1.js
    const ascendSpeed = 0.2; // smooth ascend step when toggling into flight

    const frameScale = Math.min(4, 60 * delta);

    // If we're ascending to a target fly height, do so first
    if (state.isAscendingToFly) {
        if (player.position.y < state.targetFlyHeight) {
            player.position.y += ascendSpeed * frameScale;
            // don't process horizontal movement until ascent finished
        } else {
            state.isAscendingToFly = false;
        }
    }

    // Flight movement: allow forward/back in camera direction and strafing
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    direction.normalize();

    // In a third-person setup the camera looks toward the player, so camera
    // forward points at the player. The player 'forward' input should move
    // away from the camera (in the direction the camera is facing), therefore
    // negate the camera direction to get the correct movement vector.
    direction.negate();

    // Forward/backwards (now in camera-facing direction)
    if (input.forward !== 0) {
        player.position.addScaledVector(direction, input.forward * speed * frameScale);
    }

    // Strafing (camera right)
    const right = new THREE.Vector3();
    right.crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();
    if (input.right !== 0) {
        player.position.addScaledVector(right, input.right * speed * frameScale);
    }

    // Vertical via input.up (Space = 1, Shift = -1)
    if (input.up !== 0) {
        player.position.y += input.up * speed * frameScale;
    }

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
