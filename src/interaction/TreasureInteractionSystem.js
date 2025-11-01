// Treasure Interaction System - Handles treasure chest interaction and viewing mode
import * as THREE from 'three';
// gsap is loaded globally via script tag in index.html

/**
 * TreasureInteractionSystem - Manages treasure chest interaction, camera sequences, and viewing mode
 */
export class TreasureInteractionSystem {
    constructor(scene, camera, cameraControl, storySystem, storyUI, inventorySystem = null) {
        this.scene = scene;
        this.camera = camera;
        this.cameraControl = cameraControl;
        this.storySystem = storySystem;
        this.storyUI = storyUI;
        this.inventorySystem = inventorySystem;
        
        // Viewing mode state
        this.isInViewingMode = false;
        this.treasure = null;
        this.treasureLid = null;
        this.treasurePosition = new THREE.Vector3();
        
        // Stored positions for transitions
        this.originalCameraPos = null;
        this.playerPos = null;
        this.closeUpPosition = null;
        this.topDownPosition = null;
        
        // Joystick collection
        this.joysticks = [];
        this.currentInteractableJoystick = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2(0, 0);
        this.fKeyLocked = false;
        this.collectionPrompt = null;
        
        // Direct keydown listener for F key (fallback)
        this.boundFKeyHandler = this.handleFKeyPress.bind(this);
    }
    
    /**
     * Handle F key press directly (fallback method)
     */
    handleFKeyPress(e) {
        if (this.isInViewingMode && e.key.toLowerCase() === 'f' && !this.fKeyLocked) {
            this.collectAllJoysticks();
            this.fKeyLocked = true;
            setTimeout(() => {
                this.fKeyLocked = false;
            }, 500);
        }
    }
    
    /**
     * Initializes the treasure interaction system
     */
    init() {
        // Get treasure objects from scene
        this.treasure = this.scene.userData.treasure;
        this.treasureLid = this.scene.userData.treasureLid;
        
        if (this.treasure && this.treasureLid) {
            this.treasure.getWorldPosition(this.treasurePosition);
            console.log('✅ TreasureInteractionSystem initialized');
            console.log('📍 Treasure found:', this.treasure.name, 'at position:', this.treasurePosition);
            console.log('✅ Treasure lid found:', this.treasureLid.name);
        } else {
            // Try to find treasure in the scene manually (but don't warn if we're just re-initializing)
            let foundTreasure = false;
            let foundLid = false;
            
            this.scene.traverse((child) => {
                if (child.name && (
                    child.name === 'treasure' || 
                    child.name === 'Treasure' ||
                    child.name.toLowerCase().includes('treasure')
                ) && !child.name.toLowerCase().includes('lid')) {
                    this.treasure = child;
                    this.scene.userData.treasure = child;
                    foundTreasure = true;
                }
                if (child.name && (
                    child.name === 'treasure_lid' || 
                    child.name === 'Treasure_lid' ||
                    child.name === 'Treasure_Lid' ||
                    child.name.toLowerCase().includes('treasure_lid') ||
                    child.name.toLowerCase().includes('treasurelid')
                )) {
                    this.treasureLid = child;
                    this.scene.userData.treasureLid = child;
                    foundLid = true;
                }
            });
            
            if (this.treasure && this.treasureLid) {
                this.treasure.getWorldPosition(this.treasurePosition);
                console.log('✅ TreasureInteractionSystem initialized (found by traversal)');
            } else {
                // Only warn if we're initializing for the first time and objects truly don't exist
                // (Not a critical error if we're just re-initializing during exit)
                if (!foundTreasure) {
                    console.warn('⚠️ Treasure not found in scene.userData.treasure');
                }
                if (!foundLid) {
                    console.warn('⚠️ Treasure lid not found in scene.userData.treasureLid');
                }
            }
        }
        
        // Find and store joysticks
        this.findJoysticks();
        
        // Initialize collection prompt UI
        this.initCollectionPrompt();
        
        // Add direct F key listener
        document.addEventListener('keydown', this.boundFKeyHandler);
    }
    
    /**
     * Finds joystick objects in the scene (only base joysticks, not heads)
     */
    findJoysticks() {
        this.joysticks = [];
        
        this.scene.traverse((child) => {
            if (!child.name) return;
            
            const name = child.name.toLowerCase();
            const isJoystick = name.startsWith('joystick');
            const isJoystickHead = name.includes('head');
            
            // Match patterns like:
            // - "Joystick", "joystick"
            // - "Joystick.001", "Joystick.002", etc.
            // ONLY collect base joysticks, NOT heads
            if (isJoystick && !isJoystickHead) {
                // Regular joystick (not head) - only add these
                if (!child.userData.collected) {
                    this.joysticks.push(child);
                    console.log('✅ Found joystick:', child.name);
                }
            }
            // Don't add joystick heads to collectible list
        });
        
        // Also check in scene.userData (filter out heads)
        if (this.scene.userData.joysticks) {
            this.scene.userData.joysticks.forEach(joystick => {
                if (!joystick.userData.collected && !this.joysticks.includes(joystick)) {
                    const nameLower = joystick.name ? joystick.name.toLowerCase() : '';
                    // Only add if it's not a head
                    if (!nameLower.includes('head')) {
                        this.joysticks.push(joystick);
                    }
                }
            });
        }
        
        console.log(`📍 Found ${this.joysticks.length} joystick(s) in treasure`);
    }
    
    /**
     * Initialize collection prompt UI
     */
    initCollectionPrompt() {
        if (this.collectionPrompt) return;
        
        this.collectionPrompt = document.createElement("div");
        this.collectionPrompt.className = "game-ui collection-prompt";
        this.collectionPrompt.style.cssText = `
            position: fixed;
            bottom: 50px;
            left: 50%;
            transform: translateX(-50%);
            color: #00ff00;
            font-family: 'Press Start 2P', cursive;
            font-size: 16px;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 1);
            pointer-events: none;
            z-index: 10000;
            opacity: 0;
            transition: opacity 0.2s ease;
            text-align: center;
            background: rgba(0, 0, 0, 0.7);
            padding: 10px 18px;
            border-radius: 5px;
            border: 1px solid #00ff00;
        `;
        this.collectionPrompt.textContent = "F to collect all joysticks";
        document.body.appendChild(this.collectionPrompt);
        console.log('✅ Collection prompt initialized');
    }
    
    /**
     * Handles treasure interaction - toggles between viewing mode and normal view
     * Can be called from anywhere when E is pressed near treasure
     */
    handleInteraction() {
        // If already in viewing mode, exit it (doesn't need treasure objects)
        if (this.isInViewingMode) {
            this.exitViewingMode();
            return;
        }
        
        // Try to get treasure objects - refresh from scene if needed
        if (!this.treasure) {
            this.treasure = this.scene.userData.treasure;
        }
        if (!this.treasureLid) {
            this.treasureLid = this.scene.userData.treasureLid;
        }
        
        // If still not found, try to find them by traversing the scene
        if (!this.treasure || !this.treasureLid) {
            this.scene.traverse((child) => {
                if (child.name && (
                    child.name === 'treasure' || 
                    child.name === 'Treasure' ||
                    child.name.toLowerCase().includes('treasure')
                ) && !child.name.toLowerCase().includes('lid')) {
                    this.treasure = child;
                    this.scene.userData.treasure = child;
                }
                if (child.name && (
                    child.name === 'treasure_lid' || 
                    child.name === 'Treasure_lid' ||
                    child.name === 'Treasure_Lid' ||
                    child.name.toLowerCase().includes('treasure_lid') ||
                    child.name.toLowerCase().includes('treasurelid')
                )) {
                    this.treasureLid = child;
                    this.scene.userData.treasureLid = child;
                }
            });
        }
        
        // Only warn if we still can't find them AND we're trying to enter viewing mode
        if (!this.treasure || !this.treasureLid) {
            console.warn('Treasure or treasure lid not found - cannot enter viewing mode');
            return;
        }
        
        // Check if already opened (lid opened)
        const treasureOpened = this.scene.userData.treasureOpened || false;
        
        // Enter viewing mode
        this.enterViewingMode(treasureOpened);
    }
    
    /**
     * Enters viewing mode - locks player and shows treasure
     * @param {boolean} alreadyOpened - Whether the treasure is already opened
     */
    enterViewingMode(alreadyOpened = false) {
        const player = this.scene.getObjectByName('player');
        
        // Lock player in place
        this.scene.userData.playerLocked = true;
        if (player) {
            this.scene.userData.lockedPlayerPosition = player.position.clone();
            this.playerPos = player.position.clone();
        }
        
        // Update treasure position
        this.treasure.getWorldPosition(this.treasurePosition);
        
        // Store original camera state
        this.originalCameraPos = this.camera.position.clone();
        
        // Calculate camera positions
        this.closeUpPosition = new THREE.Vector3(
            this.treasurePosition.x + 0.75,
            this.treasurePosition.y + 0.75,
            this.treasurePosition.z + 0.75
        );
        
        this.topDownPosition = new THREE.Vector3(
            this.treasurePosition.x,
            this.treasurePosition.y + 0.75,
            this.treasurePosition.z
        );
        
        // Disable camera control temporarily
        if (this.cameraControl) {
            this.cameraControl.useCollision = false;
            this.cameraControl.isPointerLocked = false;
            if (document.pointerLockElement) {
                document.exitPointerLock();
            }
        }
        
        // Remove treasure highlight if visible
        this.hideTreasureHighlight();
        
        if (alreadyOpened) {
            // If already opened, go straight to top-down view
            this.showTopDownView();
        } else {
            // If not opened, do the opening sequence
            this.openTreasureSequence();
        }
    }
    
    /**
     * Opens the treasure with camera sequence
     */
    openTreasureSequence() {
        // Step 1: Pan camera to close-up view
        gsap.to(this.camera.position, {
            x: this.closeUpPosition.x,
            y: this.closeUpPosition.y,
            z: this.closeUpPosition.z,
            duration: 1.5,
            ease: "power2.inOut",
            onUpdate: () => {
                this.camera.lookAt(this.treasurePosition);
            },
            onComplete: () => {
                // Step 2: Open the lid
                this.openLid();
            }
        });
    }
    
    /**
     * Opens the treasure lid
     */
    openLid() {
        const originalRotationY = this.treasureLid.rotation.y;
        const targetRotationY = originalRotationY - (Math.PI / 2); // -90 degrees in radians (rotate around Y axis)
        
        gsap.to(this.treasureLid.rotation, {
            y: targetRotationY,
            duration: 1.5,
            ease: "power2.out",
            onComplete: () => {
                console.log('Treasure lid opened!');
                
                // Mark treasure as opened
                this.scene.userData.treasureOpened = true;
                
                // Step 3: Move to top-down view
                this.showTopDownView();
            }
        });
    }
    
    /**
     * Shows top-down view of treasure (viewing mode)
     */
    showTopDownView() {
        gsap.to(this.camera.position, {
            x: this.topDownPosition.x,
            y: this.topDownPosition.y,
            z: this.topDownPosition.z,
            duration: 1.5,
            ease: "power2.inOut",
            onUpdate: () => {
                this.camera.lookAt(this.treasurePosition);
            },
            onComplete: () => {
                this.camera.lookAt(this.treasurePosition);
                this.isInViewingMode = true;
                
                // Refresh joysticks list now that treasure is open
                this.findJoysticks();
                console.log('📦 In viewing mode - Found', this.joysticks.length, 'joysticks');
                
                // Show prompt if joysticks are available
                if (this.joysticks.length > 0 && this.collectionPrompt) {
                    this.collectionPrompt.style.visibility = "visible";
                    this.collectionPrompt.style.display = "block";
                    this.collectionPrompt.style.opacity = "1";
                    this.collectionPrompt.textContent = "F to collect all joysticks";
                }
                
                // Mark objective as complete if not already done
                if (this.storySystem && !this.storySystem.isObjectiveCompleted('found_joysticks')) {
                    this.storySystem.completeObjective('found_joysticks');
                    if (this.storyUI) {
                        this.storyUI.update();
                    }
                }
                
                console.log('Entered viewing mode - Press E to exit, F to collect all joysticks');
            }
        });
    }
    
    /**
     * Exits viewing mode and returns to normal view
     */
    exitViewingMode() {
        if (!this.originalCameraPos) return;
        
        const player = this.scene.getObjectByName('player');
        
        // Get current player position if playerPos is null
        if (!this.playerPos && player) {
            this.playerPos = player.position.clone();
        }
        
        // Hide collection prompt immediately and forcefully
        if (this.collectionPrompt) {
            this.collectionPrompt.style.opacity = "0";
            this.collectionPrompt.style.display = "none";
            this.collectionPrompt.style.visibility = "hidden";
        }
        this.currentInteractableJoystick = null;
        
        // Close the lid first (if treasure is opened)
        // Refresh treasure lid reference if needed
        if (!this.treasureLid) {
            this.treasureLid = this.scene.userData.treasureLid;
        }
        
        const treasureOpened = this.scene.userData.treasureOpened || false;
        if (treasureOpened && this.treasureLid) {
            // Get the original rotation (before it was opened)
            // The lid was rotated -90 degrees, so we need to add +90 to close it
            const currentRotationY = this.treasureLid.rotation.y;
            const originalRotationY = currentRotationY + (Math.PI / 2); // Reverse the rotation (Y axis)
            
            gsap.to(this.treasureLid.rotation, {
                y: originalRotationY,
                duration: 1.5,
                ease: "power2.out",
                onComplete: () => {
                    // Mark treasure as closed
                    this.scene.userData.treasureOpened = false;
                    console.log('Treasure lid closed');
                }
            });
        }
        
        // Fallback: use original camera position as target if no player pos
        const targetLookAt = this.playerPos || this.originalCameraPos;
        
        // Return camera to player view
        gsap.to(this.camera.position, {
            x: this.originalCameraPos.x,
            y: this.originalCameraPos.y,
            z: this.originalCameraPos.z,
            duration: 2.0,
            ease: "power2.inOut",
            onUpdate: () => {
                // Get current player position if available
                if (player) {
                    const currentPlayerPos = player.position;
                    this.camera.lookAt(
                        currentPlayerPos.x,
                        currentPlayerPos.y + 1.5,
                        currentPlayerPos.z
                    );
                } else if (this.playerPos) {
                    // Fallback to stored position
                    this.camera.lookAt(
                        this.playerPos.x,
                        this.playerPos.y + 1.5,
                        this.playerPos.z
                    );
                } else {
                    // Fallback: look at original camera position
                    this.camera.lookAt(
                        this.originalCameraPos.x,
                        this.originalCameraPos.y - 1.5,
                        this.originalCameraPos.z
                    );
                }
            },
            onComplete: () => {
                // Re-enable camera control and player movement
                if (this.cameraControl) {
                    this.cameraControl.useCollision = true;
                }
                this.scene.userData.playerLocked = false;
                this.isInViewingMode = false;
                
                // Ensure collection prompt is hidden
                if (this.collectionPrompt) {
                    this.collectionPrompt.style.opacity = "0";
                    this.collectionPrompt.style.display = "none";
                    this.collectionPrompt.style.visibility = "hidden";
                }
                
                // Clear stored positions
                this.originalCameraPos = null;
                this.playerPos = null;
                
                console.log('Exited viewing mode');
            }
        });
    }
    
    /**
     * Hides the treasure highlight
     */
    hideTreasureHighlight() {
        const treasureOutline = this.scene.userData.treasureOutline;
        if (treasureOutline) {
            // Stop animations
            if (treasureOutline.userData.pulseAnimation) {
                treasureOutline.userData.pulseAnimation.kill();
            }
            if (treasureOutline.userData.scaleAnimation) {
                treasureOutline.userData.scaleAnimation.kill();
            }
            // Fade out and remove
            gsap.to(treasureOutline.material, {
                opacity: 0,
                duration: 0.3,
                onComplete: () => {
                    this.scene.remove(treasureOutline);
                    treasureOutline.geometry.dispose();
                    treasureOutline.material.dispose();
                }
            });
        }
    }
    
    /**
     * Checks for joystick interaction when in viewing mode
     */
    checkJoystickInteraction() {
        if (!this.isInViewingMode) {
            if (this.collectionPrompt) {
                this.collectionPrompt.style.opacity = "0";
                this.collectionPrompt.style.display = "none";
            }
            this.currentInteractableJoystick = null;
            return;
        }

        // Find available (not collected) joysticks - filter out heads just in case
        const availableJoysticks = this.joysticks.filter(js => {
            if (!js || js.userData.collected) return false;
            const nameLower = js.name ? js.name.toLowerCase() : '';
            // Exclude heads
            return !nameLower.includes('head');
        });

        if (availableJoysticks.length === 0) {
            if (this.collectionPrompt) {
                this.collectionPrompt.style.opacity = "0";
                this.collectionPrompt.style.display = "none";
            }
            this.currentInteractableJoystick = null;
            return;
        }

        // Update mouse position for raycaster (center of screen)
        this.mouse.x = 0;
        this.mouse.y = 0;

        // Set up raycaster from camera center
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // Get all meshes from joystick objects (they might be groups)
        const meshesToCheck = [];
        availableJoysticks.forEach(js => {
            js.traverse((child) => {
                if (child.isMesh) {
                    meshesToCheck.push(child);
                }
            });
            // Also add the object itself if it's a mesh
            if (js.isMesh) {
                meshesToCheck.push(js);
            }
        });

        if (meshesToCheck.length === 0) {
            // If no meshes found, just show prompt when in viewing mode and joysticks exist
            // (Maybe they're always visible from the top-down view)
            if (availableJoysticks.length > 0) {
                this.currentInteractableJoystick = availableJoysticks[0]; // Use first available
                if (this.collectionPrompt) {
                    this.collectionPrompt.style.visibility = "visible";
                    this.collectionPrompt.style.display = "block";
                    this.collectionPrompt.style.opacity = "1";
                }
            }
            return;
        }

        // Cast ray to check for joysticks
        const intersects = this.raycaster.intersectObjects(meshesToCheck, true);

        if (intersects.length > 0) {
            // Find which joystick was hit by checking parent hierarchy
            let hitJoystick = null;
            for (const intersect of intersects) {
                let obj = intersect.object;
                // Traverse up the parent chain to find the joystick object
                while (obj && obj !== this.scene) {
                    // Check if this object or any parent is in our available joysticks
                    for (const js of availableJoysticks) {
                        if (obj === js || (js.children && js.children.includes(obj)) || 
                            (obj.parent && obj.parent === js)) {
                            hitJoystick = js;
                            break;
                        }
                    }
                    if (hitJoystick) break;
                    obj = obj.parent;
                }
                if (hitJoystick) break;
            }

            if (hitJoystick) {
                this.currentInteractableJoystick = hitJoystick;
                if (this.collectionPrompt) {
                    this.collectionPrompt.style.visibility = "visible";
                    this.collectionPrompt.style.display = "block";
                    this.collectionPrompt.style.opacity = "1";
                }
                return;
            }
        }

        // If no direct hit but we're in viewing mode with joysticks visible, 
        // show prompt anyway (top-down view, always visible)
        if (availableJoysticks.length > 0) {
            // In top-down viewing mode, joysticks should always be collectible
            this.currentInteractableJoystick = availableJoysticks[0]; // Use closest or first
            if (this.collectionPrompt) {
                this.collectionPrompt.textContent = `F to collect all joysticks (${availableJoysticks.length})`;
                this.collectionPrompt.style.visibility = "visible";
                this.collectionPrompt.style.display = "block";
                this.collectionPrompt.style.opacity = "1";
            }
            return;
        }

        // No joystick found
        this.currentInteractableJoystick = null;
        if (this.collectionPrompt) {
            this.collectionPrompt.style.opacity = "0";
            this.collectionPrompt.style.display = "none";
        }
    }

    /**
     * Handles F key press to collect all joysticks
     * @param {boolean} fKeyPressed - Whether F key is currently pressed
     */
    handleCollectionKey(fKeyPressed) {
        if (!this.isInViewingMode || !fKeyPressed || this.fKeyLocked) {
            return;
        }

        // Collect all available joysticks
        this.collectAllJoysticks();
        this.fKeyLocked = true;
        
        // Unlock after delay
        setTimeout(() => {
            this.fKeyLocked = false;
        }, 500);
    }

    /**
     * Collects all available joysticks at once
     */
    collectAllJoysticks() {
        if (!this.isInViewingMode) {
            return;
        }

        // Find all available (not collected) joysticks - filter out heads
        const availableJoysticks = this.joysticks.filter(js => {
            if (!js || js.userData.collected) return false;
            const nameLower = js.name ? js.name.toLowerCase() : '';
            return !nameLower.includes('head');
        });

        if (availableJoysticks.length === 0) {
            console.log('⚠️ No joysticks available to collect');
            return;
        }

        let collectedCount = 0;
        availableJoysticks.forEach(joystick => {
            this.collectJoystick(joystick);
            collectedCount++;
        });

        console.log(`✅ Collected ${collectedCount} joystick(s)`);

        // Hide joystick heads after collecting joysticks
        this.hideJoystickHeads();

        // Mark objective as complete if not already done (collecting joysticks)
        if (this.storySystem) {
            if (!this.storySystem.isObjectiveCompleted('found_joysticks')) {
                this.storySystem.completeObjective('found_joysticks');
                console.log('✅ Marked "found_joysticks" objective as complete');
            } else {
                // Even if already completed, force update objective statuses to unlock new ones
                this.storySystem.updateObjectiveStatuses();
            }
            
            // Always update story UI after collecting joysticks (forces refresh)
            if (this.storyUI) {
                // Force a fresh update of the UI
                this.storyUI.update();
                console.log('📊 Story UI updated after collecting joysticks');
            }
        }

        // Hide prompt after collecting
        if (this.collectionPrompt) {
            this.collectionPrompt.style.opacity = "0";
            this.collectionPrompt.style.display = "none";
        }
        this.currentInteractableJoystick = null;
    }

    /**
     * Collects a joystick and adds it to inventory
     * @param {THREE.Object3D} joystick - The joystick object to collect
     */
    collectJoystick(joystick) {
        if (!joystick || joystick.userData.collected) {
            return;
        }

        // Double-check: Don't collect heads
        const nameLower = joystick.name ? joystick.name.toLowerCase() : '';
        if (nameLower.includes('head')) {
            console.log('⚠️ Skipping joystick head - only collecting base joysticks');
            return;
        }

        // Mark as collected
        joystick.userData.collected = true;

        // Determine joystick name (should always be 'Joystick' now since we filter heads)
        let joystickName = 'Joystick';

        // Add to inventory if inventory system exists
        if (this.inventorySystem) {
            this.inventorySystem.addItem(joystickName, {
                collectedAt: Date.now(),
                objectName: joystick.name
            });
        }

        // Remove from joysticks array
        const index = this.joysticks.indexOf(joystick);
        if (index > -1) {
            this.joysticks.splice(index, 1);
        }

        // Hide the joystick (or remove from scene)
        joystick.visible = false;
        
        // Optionally remove from scene entirely
        if (joystick.parent) {
            joystick.parent.remove(joystick);
        }
    }

    /**
     * Hides all joystick heads in the scene
     */
    hideJoystickHeads() {
        this.scene.traverse((child) => {
            if (!child.name) return;
            
            const name = child.name.toLowerCase();
            const isJoystickHead = name.includes('joystick') && name.includes('head');
            
            if (isJoystickHead) {
                child.visible = false;
                console.log('🔒 Hid joystick head:', child.name);
            }
        });
    }
    
    /**
     * Updates the system (called every frame)
     * @param {object} keys - Input keys object
     */
    update(keys = {}) {
        // Update treasure position if needed (in case it moves)
        if (this.treasure && this.isInViewingMode) {
            this.treasure.getWorldPosition(this.treasurePosition);
            // Keep camera looking at treasure in viewing mode
            this.camera.lookAt(this.treasurePosition);
            
            // Check for joystick interaction
            this.checkJoystickInteraction();
            
            // Handle collection key - InputSystem stores keys as lowercase
            if (keys && keys['f']) {
                this.handleCollectionKey(true);
            }
        }
    }
    
    /**
     * Checks if currently in viewing mode
     * @returns {boolean} True if in viewing mode
     */
    isViewingMode() {
        return this.isInViewingMode;
    }
    
    /**
     * Cleanup the system
     */
    cleanup() {
        // Exit viewing mode if active
        if (this.isInViewingMode) {
            this.exitViewingMode();
        }
        
        // Remove collection prompt
        if (this.collectionPrompt && this.collectionPrompt.parentNode) {
            this.collectionPrompt.parentNode.removeChild(this.collectionPrompt);
            this.collectionPrompt = null;
        }
        
        // Remove F key listener
        if (this.boundFKeyHandler) {
            document.removeEventListener('keydown', this.boundFKeyHandler);
            this.boundFKeyHandler = null;
        }
        
        // Re-enable player movement
        this.scene.userData.playerLocked = false;
        
        // Clear references
        this.treasure = null;
        this.treasureLid = null;
        this.joysticks = [];
        this.currentInteractableJoystick = null;
    }
}

