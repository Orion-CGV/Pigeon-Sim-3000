// Player System - Handles player model loading, animations, movement, and physics
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Constants
const PLAYER_SPEED = 5;           // Horizontal movement speed (units per second)

/**
 * Helper function to check if a capsule intersects with a box
 * @param {THREE.Vector3} capsuleStart - Start point of capsule (top)
 * @param {THREE.Vector3} capsuleEnd - End point of capsule (bottom)
 * @param {number} capsuleRadius - Radius of the capsule
 * @param {THREE.Box3} box - The box to check collision with
 * @returns {boolean} - True if capsule intersects with box
 */
function capsuleIntersectsBox(capsuleStart, capsuleEnd, capsuleRadius, box) {
    // Get box corners for precise collision
    const boxMin = box.min;
    const boxMax = box.max;
    
    // Find the closest point on the capsule line segment to the box
    const capsuleDir = new THREE.Vector3().subVectors(capsuleEnd, capsuleStart);
    const capsuleLength = capsuleDir.length();
    
    if (capsuleLength < 0.001) {
        // Capsule is a sphere, check if sphere intersects box
        return box.containsPoint(capsuleStart) || 
               box.distanceToPoint(capsuleStart) < capsuleRadius;
    }
    
    capsuleDir.normalize();
    
    // Get box center
    const boxCenter = new THREE.Vector3();
    box.getCenter(boxCenter);
    
    // Find closest point on capsule line segment to box center
    const toBox = new THREE.Vector3().subVectors(boxCenter, capsuleStart);
    const projectionLength = Math.max(0, Math.min(capsuleLength, toBox.dot(capsuleDir)));
    const closestPointOnCapsule = new THREE.Vector3().addVectors(
        capsuleStart,
        capsuleDir.multiplyScalar(projectionLength)
    );
    
    // Reset capsuleDir after multiplication
    capsuleDir.set(
        capsuleEnd.x - capsuleStart.x,
        capsuleEnd.y - capsuleStart.y,
        capsuleEnd.z - capsuleStart.z
    ).normalize();
    
    // Calculate closest point on box to the capsule line segment
    const closestPointOnBox = new THREE.Vector3(
        Math.max(boxMin.x, Math.min(boxMax.x, closestPointOnCapsule.x)),
        Math.max(boxMin.y, Math.min(boxMax.y, closestPointOnCapsule.y)),
        Math.max(boxMin.z, Math.min(boxMax.z, closestPointOnCapsule.z))
    );
    
    // Check if distance between closest points is less than capsule radius
    const distance = closestPointOnCapsule.distanceTo(closestPointOnBox);
    
    // Also check if capsule start/end spheres intersect box
    const startToBoxDist = box.distanceToPoint(capsuleStart);
    const endToBoxDist = box.distanceToPoint(capsuleEnd);
    
    return distance < capsuleRadius || 
           startToBoxDist < capsuleRadius || 
           endToBoxDist < capsuleRadius ||
           box.containsPoint(capsuleStart) ||
           box.containsPoint(capsuleEnd);
}

/**
 * PlayerSystem - Manages player loading, animations, movement, and physics
 */
export class PlayerSystem {
    constructor(scene, camera, clock) {
        this.scene = scene;
        this.camera = camera;
        this.clock = clock;
    }

    /**
     * Loads the player model and sets up animations
     * @param {Function} onComplete - Callback when player is fully loaded
     */
    loadPlayer(onComplete) {
        try {
            const loader = new GLTFLoader();

            // Load the idle model (base character model)
            loader.load(
                './assets/models/characters/character_idle.glb',
                (gltf) => {
                    const player = gltf.scene;

                    // Name the player object for easy access
                    player.name = 'player';
                    // Position player at center of basement (X=0, Z=0, Y will be set by ground collision)
                    // Y position will be adjusted by ground collision system in update()
                    player.position.set(0, 0.50, 0);
                    // Set initial scale
                    player.scale.set(1.5, 1.5, 1.5);
                    
                    // Enable shadows for all meshes in player model
                    player.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });

                    // Calculate capsule dimensions from player bounding box
                    const playerBox = new THREE.Box3().setFromObject(player);
                    const playerSize = new THREE.Vector3();
                    playerBox.getSize(playerSize);
                    
                    // Capsule radius is based on the smaller of width/depth
                    const capsuleRadius = Math.min(playerSize.x, playerSize.z) * 0.65;
                    const capsuleHeight = playerSize.y * 1.5; // Increased height for tall character
                    
                    // Store capsule parameters
                    this.scene.userData.playerCapsuleRadius = capsuleRadius;
                    this.scene.userData.playerCapsuleHeight = capsuleHeight;
                    
                    // Create visual capsule helper (hidden by default, toggleable with F2)
                    const capsuleHelper = this.createCapsuleHelper(capsuleRadius, capsuleHeight, 0xffff00);
                    capsuleHelper.name = 'playerCapsuleHelper';
                    capsuleHelper.visible = false; // Hidden by default, shown when F2 is pressed
                    this.scene.add(capsuleHelper);
                    this.scene.userData.playerCapsuleHelper = capsuleHelper;

                    // Add player to scene
                    this.scene.add(player);

                    // Set up animation mixer if animations exist
                    if (gltf.animations.length > 0) {
                        const playerMixer = new THREE.AnimationMixer(player);
                        this.scene.userData.playerMixer = playerMixer;

                        // Store idle animation
                        const idleAction = playerMixer.clipAction(gltf.animations[0]);
                        idleAction.play();
                        this.scene.userData.currentAction = idleAction;
                        this.scene.userData.idleAction = idleAction;

                        // Load walk animation separately
                        loader.load(
                            './assets/models/characters/character_walk.glb',
                            (walkGltf) => {
                                if (walkGltf.animations.length > 0) {
                                    const walkAction = playerMixer.clipAction(walkGltf.animations[0]);
                                    walkAction.setLoop(THREE.LoopRepeat);
                                    this.scene.userData.walkAction = walkAction;
                                }
                                if (onComplete) onComplete();
                            },
                            undefined,
                            (error) => {
                                if (onComplete) onComplete();
                            }
                        );
                    } else {
                        if (onComplete) onComplete();
                    }

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
     * Creates a visual helper for the capsule collision shape
     * @param {number} radius - Radius of the capsule
     * @param {number} height - Height of the capsule
     * @param {number} color - Color of the helper wireframe
     * @returns {THREE.Group} - Group containing the capsule visualization
     */
    createCapsuleHelper(radius, height, color = 0xffff00) {
        const group = new THREE.Group();
        
        // Calculate cylinder height (total height minus the two hemispheres)
        const cylinderHeight = Math.max(0.01, height - radius * 2);
        
        // Create cylinder for the middle part
        const cylinderGeometry = new THREE.CylinderGeometry(radius, radius, cylinderHeight, 16);
        const cylinderEdges = new THREE.EdgesGeometry(cylinderGeometry);
        const cylinderLine = new THREE.LineSegments(cylinderEdges, new THREE.LineBasicMaterial({ color: color }));
        // Position cylinder so bottom aligns with bottom hemisphere
        cylinderLine.position.y = radius + cylinderHeight / 2;
        group.add(cylinderLine);
        
        // Create top hemisphere
        const topSphereGeometry = new THREE.SphereGeometry(radius, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const topSphereEdges = new THREE.EdgesGeometry(topSphereGeometry);
        const topSphereLine = new THREE.LineSegments(topSphereEdges, new THREE.LineBasicMaterial({ color: color }));
        topSphereLine.position.y = height - radius;
        group.add(topSphereLine);
        
        // Create bottom hemisphere
        const bottomSphereGeometry = new THREE.SphereGeometry(radius, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
        const bottomSphereEdges = new THREE.EdgesGeometry(bottomSphereGeometry);
        const bottomSphereLine = new THREE.LineSegments(bottomSphereEdges, new THREE.LineBasicMaterial({ color: color }));
        bottomSphereLine.position.y = radius;
        group.add(bottomSphereLine);
        
        // Group's local origin is at the bottom of the capsule (y=0)
        // When positioned at player.position, bottom of capsule will be at player.position.y
        
        return group;
    }

    /**
     * Gets the capsule shape parameters for the player
     * @param {THREE.Object3D} player - The player object
     * @returns {Object} - Object with start, end, and radius properties
     */
    getPlayerCapsule(player) {
        const { playerCapsuleRadius, playerCapsuleHeight } = this.scene.userData;
        
        if (!playerCapsuleRadius || !playerCapsuleHeight) {
            // Fallback to bounding box calculation
            const playerBox = new THREE.Box3().setFromObject(player);
            const playerSize = new THREE.Vector3();
            playerBox.getSize(playerSize);
            const radius = Math.min(playerSize.x, playerSize.z) * 0.65;
            const height = playerSize.y * 1.5; // Increased height for tall character
            
            const start = new THREE.Vector3(
                player.position.x,
                player.position.y + height - radius,
                player.position.z
            );
            const end = new THREE.Vector3(
                player.position.x,
                player.position.y + radius,
                player.position.z
            );
            
            return { start, end, radius };
        }
        
        const start = new THREE.Vector3(
            player.position.x,
            player.position.y + playerCapsuleHeight - playerCapsuleRadius,
            player.position.z
        );
        const end = new THREE.Vector3(
            player.position.x,
            player.position.y + playerCapsuleRadius,
            player.position.z
        );
        
        return { 
            start, 
            end, 
            radius: playerCapsuleRadius 
        };
    }

    /**
     * Sets the current animation with fade transitions
     * @param {THREE.AnimationAction} action - The animation action to play
     */
    setAnimation(action) {
        const { playerMixer, currentAction } = this.scene.userData;
        if (!playerMixer || currentAction === action) return;

        // Fade out current animation if exists
        if (currentAction) {
            currentAction.fadeOut(0.2);
        }

        // Fade in and play new animation
        action.reset().fadeIn(0.2).play();
        this.scene.userData.currentAction = action;
    }

    /**
     * Plays the specified animation state
     * @param {string} state - Animation state ('idle', 'walk')
     */
    playAnimation(state) {
        const { playerMixer, idleAction, walkAction, currentAnimation } = this.scene.userData;
        if (!playerMixer) return;

        // Only change animation if the state is different
        if (currentAnimation !== state) {
            if (state === 'walk' && walkAction) {
                this.setAnimation(walkAction);
                this.scene.userData.currentAnimation = 'walk';
            } else {
                this.setAnimation(idleAction);
                this.scene.userData.currentAnimation = 'idle';
            }
        }
    }

    /**
     * Updates player position, physics, and animations
     * @param {Object} inputState - Current input state { keys }
     * @param {Object} cameraState - Current camera state { yaw, pitch }
     * @param {Object} cameraControl - Optional CameraControl instance for collision detection
     */
    update(inputState, cameraState, cameraControl = null) {
        // Get player object from scene
        const player = this.scene.getObjectByName('player');
        if (!player) return;
        
        // Don't allow movement until everything is loaded
        if (!this.scene.userData.gameReady) {
            // Still update animations and camera, just prevent movement
            const delta = this.clock.getDelta();
            
            // Update animation mixer
            if (this.scene.userData.playerMixer) {
                this.scene.userData.playerMixer.update(delta);
            }
            
            // Update camera to follow player
            this.updateCamera(player, cameraState);
            return;
        }

        const delta = this.clock.getDelta();

        // Update animation mixer
        if (this.scene.userData.playerMixer) {
            this.scene.userData.playerMixer.update(delta);
        }

        // Update capsule helper to match player's current position
        const { playerCapsuleHelper, playerCapsuleRadius } = this.scene.userData;
        if (playerCapsuleHelper && playerCapsuleRadius) {
            // Position helper so bottom of capsule aligns with player base
            playerCapsuleHelper.position.set(
                player.position.x,
                player.position.y,
                player.position.z
            );
            playerCapsuleHelper.rotation.y = player.rotation.y;
        }

        // Movement vectors
        const forward = new THREE.Vector3();
        const right = new THREE.Vector3();
        const moveDir = new THREE.Vector3();

        // Calculate forward and right vectors based on yaw
        forward.set(Math.sin(cameraState.yaw), 0, Math.cos(cameraState.yaw)).normalize();
        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        // Compute movement direction
        moveDir.set(0, 0, 0);
        if (inputState.keys["w"] || inputState.keys["arrowup"]) moveDir.add(forward);
        if (inputState.keys["s"] || inputState.keys["arrowdown"]) moveDir.sub(forward);
        if (inputState.keys["d"] || inputState.keys["arrowright"]) moveDir.add(right);
        if (inputState.keys["a"] || inputState.keys["arrowleft"]) moveDir.sub(right);

        // Determine player state for animations
        let playerState = 'idle';
        const isMoving = moveDir.lengthSq() > 0;
        if (isMoving) {
            playerState = 'walk';
        }

        // Play appropriate animation
        this.playAnimation(playerState);

        // Store previous position for collision detection
        const prevPos = player.position.clone();

        // Apply movement if moving
        if (isMoving) {
            moveDir.normalize();
            const moveX = moveDir.x * PLAYER_SPEED * delta;
            const moveZ = moveDir.z * PLAYER_SPEED * delta;

            // Get player capsule shape
            const playerCapsule = this.getPlayerCapsule(player);

            // Test x movement
            player.position.x += moveX;
            let collisionDetected = false;
            const { arcadeBoxes } = this.scene.userData;

            // Update capsule position after x movement
            const capsuleAfterX = this.getPlayerCapsule(player);

            // Check collision with arcade boxes using capsule
            if (arcadeBoxes) {
                for (let box of arcadeBoxes) {
                    if (capsuleIntersectsBox(capsuleAfterX.start, capsuleAfterX.end, capsuleAfterX.radius, box)) {
                        player.position.x = prevPos.x;
                        player.position.z = prevPos.z;
                        collisionDetected = true;
                        break;
                    }
                }
            }
            
            // Check collision with wall boxes using capsule
            if (!collisionDetected) {
                const { wallBoxes } = this.scene.userData;
                if (wallBoxes) {
                    for (let box of wallBoxes) {
                        if (capsuleIntersectsBox(capsuleAfterX.start, capsuleAfterX.end, capsuleAfterX.radius, box)) {
                            player.position.x = prevPos.x;
                            player.position.z = prevPos.z;
                            collisionDetected = true;
                            break;
                        }
                    }
                }
            }
            
            // Check collision with collider boxes using capsule
            if (!collisionDetected) {
                const { colliderBoxes } = this.scene.userData;
                if (colliderBoxes) {
                    for (let box of colliderBoxes) {
                        if (capsuleIntersectsBox(capsuleAfterX.start, capsuleAfterX.end, capsuleAfterX.radius, box)) {
                            player.position.x = prevPos.x;
                            player.position.z = prevPos.z;
                            collisionDetected = true;
                            break;
                        }
                    }
                }
            }

            // Test z movement (only if x movement didn't collide)
            if (!collisionDetected) {
                player.position.z += moveZ;
                const capsuleAfterZ = this.getPlayerCapsule(player);
                
                if (arcadeBoxes) {
                    for (let box of arcadeBoxes) {
                        if (capsuleIntersectsBox(capsuleAfterZ.start, capsuleAfterZ.end, capsuleAfterZ.radius, box)) {
                            player.position.z = prevPos.z;
                            break;
                        }
                    }
                }
                
                // Check collision with wall boxes
                const { wallBoxes } = this.scene.userData;
                if (wallBoxes) {
                    for (let box of wallBoxes) {
                        if (capsuleIntersectsBox(capsuleAfterZ.start, capsuleAfterZ.end, capsuleAfterZ.radius, box)) {
                            player.position.z = prevPos.z;
                            break;
                        }
                    }
                }
                
                // Check collision with collider boxes
                const { colliderBoxes } = this.scene.userData;
                if (colliderBoxes) {
                    for (let box of colliderBoxes) {
                        if (capsuleIntersectsBox(capsuleAfterZ.start, capsuleAfterZ.end, capsuleAfterZ.radius, box)) {
                            player.position.z = prevPos.z;
                            break;
                        }
                    }
                }
            }

            // Rotate character to face movement direction
            if (moveDir.length() > 0.001) {
                const targetAngle = Math.atan2(moveDir.x, moveDir.z);
                player.rotation.y = targetAngle;
            }
        }

        // Keep player on ground using capsule collision
        const { groundBox } = this.scene.userData;
        if (groundBox) {
            const playerCapsule = this.getPlayerCapsule(player);
            const groundMax = groundBox.max;
            
            // Align player capsule bottom with ground top
            // Since capsule bottom = player.position.y (end.y = player.position.y + radius, bottom = end.y - radius = player.position.y)
            // We want capsule bottom = groundMax.y, so player.position.y = groundMax.y
            const targetY = groundMax.y;
            
            // Only adjust if player is floating above ground
            if (player.position.y > targetY) {
                player.position.y = targetY;
            }
            
            // Prevent player from going below ground
            if (capsuleIntersectsBox(playerCapsule.start, playerCapsule.end, playerCapsule.radius, groundBox)) {
                // If intersecting but position is below ground, push up
                const currentCapsule = this.getPlayerCapsule(player);
                const currentCapsuleBottom = currentCapsule.end.y - currentCapsule.radius;
                if (currentCapsuleBottom < groundMax.y) {
                    player.position.y = groundMax.y;
                }
            }
        } else {
            // Fallback: ensure player doesn't go too low if no ground box
            if (player.position.y <= 0.01) {
                player.position.y = 0.01;
            }
        }

        // Update camera to follow player
        this.updateCamera(player, cameraState, cameraControl);
    }

    /**
     * Updates camera position to follow player with third-person view
     * @param {THREE.Object3D} player - The player object
     * @param {Object} cameraState - Current camera state { yaw, pitch }
     * @param {Object} cameraControl - Optional CameraControl instance for collision detection
     */
    updateCamera(player, cameraState, cameraControl = null) {
        const cameraDistance = 3;
        const cameraHeightOffset = 1.8;
        const cosPitch = Math.cos(cameraState.pitch);

        // Calculate desired camera position behind player based on yaw and pitch
        const desiredPosition = new THREE.Vector3(
            player.position.x - Math.sin(cameraState.yaw) * cameraDistance * cosPitch,
            player.position.y + Math.sin(cameraState.pitch) * cameraDistance + cameraHeightOffset,
            player.position.z - Math.cos(cameraState.yaw) * cameraDistance * cosPitch
        );

        // Apply collision detection if camera control is provided
        let finalPosition = desiredPosition;
        if (cameraControl && cameraControl.useCollision) {
            finalPosition = cameraControl.updateCameraPosition(desiredPosition, player.position);
        }

        // Set camera position
        this.camera.position.copy(finalPosition);

        // Point camera slightly above player center for better view
        const aimHeightOffset = 1.5;
        this.camera.lookAt(
            player.position.x,
            player.position.y + aimHeightOffset,
            player.position.z
        );
    }

    /**
     * Resets player physics state
     */
    resetPhysics() {
        // Physics reset (if needed in future)
    }
}
